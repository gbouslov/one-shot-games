/**
 * Post-processing pipeline:
 *   RenderPass → [GTAO] → [sun shafts] → [UnrealBloom] → composite (speed lines,
 *   radial blur, chromatic aberration, hit tint, flash, grain) → OutputPass
 *   (tone mapping + sRGB) → display grade (split toning, contrast, saturation,
 *   vignette).
 * Falls back to a plain renderer.render() when disabled or if construction failed.
 *
 * Adapted from bridge-mind/turbo-kart-rush src/fx/PostFX.ts (MIT); the AO pass,
 * the sun shafts and the display grade follow this repository's
 * starters/fps-three/src/kit/render/render.js.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import type { IPostFX } from '../core/types';
import { events } from '../core/events';
import { clamp01, damp } from '../core/math';
import { COMPOSITE_FRAGMENT, COMPOSITE_VERTEX } from './shaders';

const HIT_EVENT_DECAY = 0.6;
/** Linear-light grain amplitude at rest / added at full boost (~1% / +0.8%). */
const GRAIN_REST = 0.012;
const GRAIN_BOOST = 0.008;

/** Display-space grade after tone mapping (see fps-three render.js). */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.3 },
    saturation: { value: 1.06 },
    contrast: { value: 1.04 },
    tint: { value: new THREE.Color(1, 1, 1) },
    shadows: { value: new THREE.Color(1, 1, 1) },
    highlights: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette, saturation, contrast;
    uniform vec3 tint, shadows, highlights; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb *= mix(shadows, highlights, smoothstep(0.05, 0.75, l));
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb = max(mix(vec3(l), c.rgb, saturation) * tint, 0.0);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - vignette * smoothstep(0.3, 0.85, d);
      gl_FragColor = c;
    }`,
};

/** Screen-space light shafts toward the sun, cut by dark silhouettes (see fps-three render.js). */
const ShaftShader = {
  defines: { TAPS: 24 },
  uniforms: {
    tDiffuse: { value: null },
    sunUv: { value: new THREE.Vector2(0.5, 0.5) },
    visible: { value: 0 },
    strength: { value: 0 },
    density: { value: 0.85 },
    decay: { value: 0.955 },
    threshold: { value: 1.1 },
    color: { value: new THREE.Color(1, 0.85, 0.65) },
    aspect: { value: 1.78 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 sunUv; uniform float visible, strength, density, decay, threshold, aspect;
    uniform vec3 color; varying vec2 vUv;
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      if (visible <= 0.0 || strength <= 0.0) { gl_FragColor = base; return; }
      vec2 delta = (vUv - sunUv) * density / float(TAPS);
      vec2 uv = vUv;
      float w = 1.0;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < TAPS; i++) {
        uv -= delta;
        vec3 s = texture2D(tDiffuse, clamp(uv, 0.0, 1.0)).rgb;
        float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
        acc += s * (max(l - threshold, 0.0) / max(l, 1e-3)) * w;
        w *= decay;
      }
      vec2 o = (vUv - sunUv) * vec2(aspect, 1.0);
      float falloff = 1.0 / (1.0 + dot(o, o) * 3.0);
      gl_FragColor = vec4(base.rgb + acc / float(TAPS) * strength * visible * falloff * color, base.a);
    }`,
};

export interface PostFXOptions {
  bloom?: boolean;
  ao?: boolean;
  shafts?: boolean;
  /** MSAA samples on the HDR target (0 = off). */
  samples?: number;
}

export interface LookSettings {
  exposure?: number;
  bloom?: { strength?: number; radius?: number; threshold?: number };
  ao?: { radius?: number; intensity?: number };
  shafts?: { strength?: number; color?: number; density?: number; decay?: number; threshold?: number };
  vignette?: number;
  saturation?: number;
  contrast?: number;
  tint?: number;
  shadows?: number;
  highlights?: number;
}

export class PostFX implements IPostFX {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;

  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private aoPass: GTAOPass | null = null;
  private shaftPass: ShaderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private compositePass: ShaderPass | null = null;
  private outputPass: OutputPass | null = null;
  private gradePass: ShaderPass | null = null;

  private enabled = true;
  private failed = false;
  private options: PostFXOptions = { bloom: true, ao: false, shafts: true, samples: 0 };
  private sunDir: THREE.Vector3 | null = null;
  private readonly sunTmp = new THREE.Vector3();
  private readonly camDir = new THREE.Vector3();
  /** True when the camera should not be smeared (title, captures). */
  calm = false;

  private speedTarget = 0;
  private boostTarget = 0;
  private hitTarget = 0;
  private speed = 0;
  private boost = 0;
  private hit = 0;
  private hitPulse = 0;
  private flashLevel = 0;
  private flashDuration = 0;
  private flashPeak = 0;
  private time = 0;

  private width = 1;
  private height = 1;
  private pixelRatio = 1;

  private readonly flashColor = new THREE.Color(1, 1, 1);
  private readonly unsubs: (() => void)[] = [];

  constructor() {
    this.unsubs.push(events.on('item:shock', () => this.flash(0xcfe6ff, 0.5)));
    this.unsubs.push(events.on('item:hit', (e) => {
      if (e.isPlayer) this.hitPulse = 1;
    }));
    this.unsubs.push(events.on('kart:spin', (e) => {
      if (e.kartId === 0) this.hitPulse = Math.max(this.hitPulse, 0.8);
    }));
  }

  setOptions(options: PostFXOptions): void {
    this.options = { ...this.options, ...options };
  }

  init(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    this.disposePipeline();
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.failed = false;

    const size = renderer.getSize(new THREE.Vector2());
    this.width = Math.max(1, size.x);
    this.height = Math.max(1, size.y);
    this.pixelRatio = renderer.getPixelRatio();
    const o = this.options;

    try {
      const bufW = Math.max(1, Math.floor(this.width * this.pixelRatio));
      const bufH = Math.max(1, Math.floor(this.height * this.pixelRatio));
      const target = new THREE.WebGLRenderTarget(bufW, bufH, {
        type: THREE.HalfFloatType,
        samples: o.samples ?? 0,
        depthBuffer: true,
        stencilBuffer: false,
      });
      const composer = new EffectComposer(renderer, target);
      composer.setPixelRatio(this.pixelRatio);
      composer.setSize(this.width, this.height);

      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      if (o.ao) {
        const ao = new GTAOPass(scene, camera, bufW, bufH);
        ao.blendIntensity = 0.85;
        ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 1.5, scale: 1, samples: 12 });
        ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        composer.addPass(ao);
        this.aoPass = ao;
      }
      if (o.shafts) {
        const shafts = new ShaderPass(ShaftShader);
        composer.addPass(shafts);
        this.shaftPass = shafts;
      }
      if (o.bloom) {
        // UnrealBloomPass halves the resolution it is given internally.
        const bloom = new UnrealBloomPass(new THREE.Vector2(bufW, bufH), 0.35, 0.35, 0.9);
        composer.addPass(bloom);
        this.bloomPass = bloom;
      }
      const composite = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uResolution: { value: new THREE.Vector2(bufW, bufH) },
          uTime: { value: 0 },
          uSpeed: { value: 0 },
          uBoost: { value: 0 },
          uHit: { value: 0 },
          uFlash: { value: 0 },
          uFlashColor: { value: new THREE.Color(1, 1, 1) },
          uGrain: { value: GRAIN_REST },
        },
        vertexShader: COMPOSITE_VERTEX,
        fragmentShader: COMPOSITE_FRAGMENT,
      });
      composer.addPass(composite);
      const output = new OutputPass();
      composer.addPass(output);
      const grade = new ShaderPass(GradeShader);
      composer.addPass(grade);

      this.composer = composer;
      this.renderPass = renderPass;
      this.compositePass = composite;
      this.outputPass = output;
      this.gradePass = grade;
    } catch (err) {
      console.warn('[PostFX] failed to build pipeline, falling back to plain rendering', err);
      this.failed = true;
      this.disposePipeline();
    }
  }

  /** Bloom, AO, shafts and the grade; see src/game/look.js. */
  setLook(look: LookSettings): void {
    if (look.exposure !== undefined && this.renderer) this.renderer.toneMappingExposure = look.exposure;
    if (this.bloomPass && look.bloom) {
      if (look.bloom.strength !== undefined) this.bloomPass.strength = look.bloom.strength;
      if (look.bloom.radius !== undefined) this.bloomPass.radius = look.bloom.radius;
      if (look.bloom.threshold !== undefined) this.bloomPass.threshold = look.bloom.threshold;
    }
    if (this.aoPass && look.ao) {
      if (look.ao.radius !== undefined) this.aoPass.updateGtaoMaterial({ radius: look.ao.radius });
      if (look.ao.intensity !== undefined) this.aoPass.blendIntensity = look.ao.intensity;
    }
    if (this.shaftPass && look.shafts) {
      const u = this.shaftPass.uniforms;
      for (const k of ['strength', 'density', 'decay', 'threshold'] as const) {
        const v = look.shafts[k];
        if (v !== undefined) u[k].value = v;
      }
      if (look.shafts.color !== undefined) (u.color.value as THREE.Color).set(look.shafts.color);
    }
    if (this.gradePass) {
      const u = this.gradePass.uniforms;
      if (look.vignette !== undefined) u.vignette.value = look.vignette;
      if (look.saturation !== undefined) u.saturation.value = look.saturation;
      if (look.contrast !== undefined) u.contrast.value = look.contrast;
      if (look.tint !== undefined) (u.tint.value as THREE.Color).set(look.tint);
      if (look.shadows !== undefined) (u.shadows.value as THREE.Color).set(look.shadows);
      if (look.highlights !== undefined) (u.highlights.value as THREE.Color).set(look.highlights);
    }
  }

  /** Direction toward the sun, for the light shafts. */
  setSunDirection(dir: THREE.Vector3): void {
    this.sunDir = dir.clone().normalize();
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
    if (this.renderPass) this.renderPass.camera = camera;
  }

  private aimShafts(): void {
    const pass = this.shaftPass;
    const cam = this.camera as THREE.PerspectiveCamera | null;
    if (!pass || !cam) return;
    const u = pass.uniforms;
    if (!this.sunDir) {
      u.visible.value = 0;
      return;
    }
    cam.getWorldDirection(this.camDir);
    const facing = this.sunDir.dot(this.camDir);
    this.sunTmp.copy(this.sunDir).multiplyScalar(500).add(cam.position).project(cam);
    u.sunUv.value.set(this.sunTmp.x * 0.5 + 0.5, this.sunTmp.y * 0.5 + 0.5);
    const edge = Math.max(Math.abs(this.sunTmp.x), Math.abs(this.sunTmp.y));
    u.visible.value = THREE.MathUtils.clamp((facing - 0.1) * 3, 0, 1) * (1 - THREE.MathUtils.smoothstep(edge, 1.1, 1.9));
    u.aspect.value = this.width / Math.max(1, this.height);
  }

  render(dt: number): void {
    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    if (!renderer || !scene || !camera) return;

    dt = Math.min(Math.max(dt, 0), 0.1);
    this.time += dt;

    // Smooth targets; hit combines the API target with the event pulse.
    this.speed = damp(this.speed, this.calm ? 0 : this.speedTarget, 6, dt);
    this.boost = damp(this.boost, this.calm ? 0 : this.boostTarget, this.boostTarget > this.boost ? 10 : 4, dt);
    if (this.hitPulse > 0) this.hitPulse = Math.max(0, this.hitPulse - dt / HIT_EVENT_DECAY);
    this.hit = damp(this.hit, Math.max(this.hitTarget, this.hitPulse), 12, dt);

    if (this.flashLevel > 0 && this.flashDuration > 0) {
      this.flashLevel = Math.max(0, this.flashLevel - dt / this.flashDuration);
    } else {
      this.flashLevel = 0;
    }

    if (!this.enabled || this.failed || !this.composer || !this.compositePass) {
      renderer.render(scene, camera);
      return;
    }

    this.aimShafts();
    const u = this.compositePass.uniforms;
    u.uTime.value = this.time;
    u.uSpeed.value = this.speed;
    u.uBoost.value = this.boost;
    u.uHit.value = this.hit;
    u.uGrain.value = GRAIN_REST + GRAIN_BOOST * this.boost;
    const f = this.flashLevel;
    u.uFlash.value = this.flashPeak * f * f;
    (u.uFlashColor.value as THREE.Color).copy(this.flashColor);

    try {
      this.composer.render(dt);
    } catch (err) {
      console.warn('[PostFX] composer render failed, disabling post-processing', err);
      this.failed = true;
      renderer.render(scene, camera);
    }
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.pixelRatio = Math.max(0.25, pixelRatio);
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(this.width, this.height);
    }
    if (this.compositePass) {
      (this.compositePass.uniforms.uResolution.value as THREE.Vector2).set(
        Math.max(1, Math.floor(this.width * this.pixelRatio)),
        Math.max(1, Math.floor(this.height * this.pixelRatio)),
      );
    }
  }

  setSpeedEffect(intensity: number): void {
    this.speedTarget = clamp01(intensity);
  }

  setBoostEffect(intensity: number): void {
    this.boostTarget = clamp01(intensity);
  }

  setHitEffect(intensity: number): void {
    this.hitTarget = clamp01(intensity);
  }

  flash(color: number, duration: number): void {
    this.flashColor.setHex(color);
    this.flashDuration = Math.max(0.05, duration);
    this.flashLevel = 1;
    this.flashPeak = 0.9;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private disposePipeline(): void {
    this.aoPass?.dispose();
    this.shaftPass?.dispose();
    this.bloomPass?.dispose();
    this.compositePass?.dispose();
    this.outputPass?.dispose();
    this.gradePass?.dispose();
    this.renderPass?.dispose();
    this.composer?.dispose();
    this.composer = null;
    this.renderPass = null;
    this.aoPass = null;
    this.shaftPass = null;
    this.bloomPass = null;
    this.compositePass = null;
    this.outputPass = null;
    this.gradePass = null;
  }

  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs.length = 0;
    this.disposePipeline();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}
