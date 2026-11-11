import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

/**
 * Display-space grade after tone mapping: split toning (cool shadows, warm
 * highlights is the cinematic default), contrast around mid grey, saturation,
 * vignette, the hurt flash and film grain.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.35 },
    grain: { value: 0.03 },
    saturation: { value: 1.08 },
    contrast: { value: 1.0 },
    tint: { value: new THREE.Color(1, 1, 1) },
    shadows: { value: new THREE.Color(1, 1, 1) },
    highlights: { value: new THREE.Color(1, 1, 1) },
    hurt: { value: 0 },
    time: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette, grain, saturation, contrast, hurt, time;
    uniform vec3 tint, shadows, highlights; varying vec2 vUv;
    float rand(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb *= mix(shadows, highlights, smoothstep(0.05, 0.75, l));
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb = max(mix(vec3(l), c.rgb, saturation) * tint, 0.0);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - vignette * smoothstep(0.32, 0.82, d);
      c.rgb = mix(c.rgb, c.rgb * vec3(1.35,0.45,0.42), hurt * smoothstep(0.18, 0.72, d));
      c.rgb += (rand(vUv) - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

/**
 * Light shafts in screen space, before tone mapping: march from each pixel
 * toward the sun and gather the bright sky that shows between occluders. Dark
 * silhouettes (pillars, trees, cranes) block the march, which is what cuts the
 * beams. Written for this repository after the classic radial-blur god-ray
 * technique; three's GodRaysShader (MIT) does the same in more passes.
 */
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
      // start each pixel's march at a different fraction of a step (interleaved gradient noise),
      // so a small bright source smears into grain instead of concentric rings
      float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      vec2 uv = vUv + delta * (1.0 - j);
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

/**
 * Renderer, shadows, ambient occlusion, light shafts, bloom, tone mapping,
 * grade, the held-weapon pass, and a dynamic resolution scaler. The first
 * second of any game is decided here and in src/game/look.js: see
 * skills/make-it-look-great.
 *
 * render.setLook({
 *   exposure, tone: 'aces' | 'agx',
 *   bloom: { strength, radius, threshold },
 *   ao: { radius, intensity },                      high quality only
 *   shafts: { strength, color, density, decay, threshold },
 *   sunDir: [x,y,z],                                where the shafts come from
 *   vignette, grain, saturation, contrast, tint, shadows, highlights,
 * })
 */
export class RenderSystem {
  static id = 'render';
  static deps = [];

  init(ctx) {
    this.ctx = ctx;
    const q = ctx.config.q;
    const canvas = ctx.canvas;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !q.bloom,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: ctx.config.deterministic,
    });
    this.renderer = renderer;
    this.scale = 1;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
    renderer.info.autoReset = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = q.shadowSize > 0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.composer = null;
    this.sunDir = null;
    if (q.bloom) {
      const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      const composer = new EffectComposer(renderer, target);
      const worldPass = new RenderPass(ctx.scene, ctx.camera);
      const viewPass = new RenderPass(ctx.viewScene, ctx.viewCamera);
      viewPass.clear = false;
      viewPass.clearDepth = true;
      composer.addPass(worldPass);
      if (q.ao) {
        // Contact shadow in every crease of the world; the hands are drawn after, untouched.
        this.ao = new GTAOPass(ctx.scene, ctx.camera, 4, 4);
        this.ao.blendIntensity = 1;
        this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1, scale: 1, samples: q.aoSamples ?? 12 });
        this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        // three's pass hides only points and lines from its normal/depth pass. Sprites,
        // glows, flames, trails and other transparent meshes would be drawn there as solid
        // quads and turn black at quality high (found in the flight starter and both caveman
        // runs; fixed there first).
        const ao = this.ao;
        ao._overrideVisibility = function hideNonSolid() {
          const cache = this._visibilityCache;
          this.scene.traverse((o) => {
            if (!o.visible) return;
            const m = o.material;
            const nonSolid = o.isPoints || o.isLine || o.isLine2 || o.isSprite || (m && (m.transparent || m.depthWrite === false));
            if (nonSolid) {
              o.visible = false;
              cache.push(o);
            }
          });
        };
        composer.addPass(this.ao);
      }
      composer.addPass(viewPass);
      this.shafts = new ShaderPass(ShaftShader);
      this.shafts.material.defines.TAPS = q.shaftTaps ?? 24;
      composer.addPass(this.shafts);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.3, 0.55, 0.85);
      this.grade = new ShaderPass(GradeShader);
      composer.addPass(this.bloom);
      composer.addPass(new OutputPass());
      composer.addPass(this.grade);
      this.composer = composer;
    }

    this._frameMs = [];
    this._lastFrame = 0;
    this._cool = 0;
    this.drawCalls = 0;
    this.triangles = 0;
    this.hurt = 0;
    this.adaptive = !ctx.config.deterministic;
    this._sun = new THREE.Vector3();
  }

  setLook({ exposure, tone, bloom, ao, shafts, sunDir, vignette, grain, saturation, contrast, tint, shadows, highlights } = {}) {
    if (exposure !== undefined) this.renderer.toneMappingExposure = exposure;
    if (tone) this.renderer.toneMapping = tone === 'agx' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
    if (this.bloom && bloom) {
      if (bloom.strength !== undefined) this.bloom.strength = bloom.strength;
      if (bloom.radius !== undefined) this.bloom.radius = bloom.radius;
      if (bloom.threshold !== undefined) this.bloom.threshold = bloom.threshold;
    }
    if (this.ao && ao) {
      if (ao.radius !== undefined) this.ao.updateGtaoMaterial({ radius: ao.radius });
      if (ao.intensity !== undefined) this.ao.blendIntensity = ao.intensity;
    }
    if (sunDir) this.sunDir = new THREE.Vector3(...sunDir).normalize();
    if (this.shafts && shafts) {
      const u = this.shafts.uniforms;
      for (const k of ['strength', 'density', 'decay', 'threshold']) if (shafts[k] !== undefined) u[k].value = shafts[k];
      if (shafts.color !== undefined) u.color.value.set(shafts.color);
    }
    if (this.grade) {
      const u = this.grade.uniforms;
      if (vignette !== undefined) u.vignette.value = vignette;
      if (grain !== undefined) u.grain.value = grain;
      if (saturation !== undefined) u.saturation.value = saturation;
      if (contrast !== undefined) u.contrast.value = contrast;
      if (tint !== undefined) u.tint.value.set(tint);
      if (shadows !== undefined) u.shadows.value.set(shadows);
      if (highlights !== undefined) u.highlights.value.set(highlights);
    }
  }

  resize(w, h, ctx) {
    this.w = w;
    this.h = h;
    const pr = Math.min(devicePixelRatio || 1, ctx.config.q.pixelRatio) * this.scale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(pr);
    this.composer?.setSize(w, h);
    if (this.shafts) this.shafts.uniforms.aspect.value = w / h;
  }

  /** Compile every shader before the first frame. Stops mid-play hitches. */
  prewarm(ctx) {
    this.renderer.compile(ctx.scene, ctx.camera);
    this.renderer.compile(ctx.viewScene, ctx.viewCamera);
  }

  _adapt(ctx) {
    if (!this.adaptive) return;
    const now = performance.now();
    const ms = now - this._lastFrame;
    this._lastFrame = now;
    if (ms > 250) return;
    this._frameMs.push(ms);
    if (this._frameMs.length < 45) return;
    const sorted = [...this._frameMs].sort((a, b) => a - b);
    const p50 = sorted[sorted.length >> 1];
    this._frameMs.length = 0;
    const min = ctx.config.q.minScale;
    let next = this.scale;
    if (p50 > 24) next = Math.max(min, this.scale - 0.1);
    else if (p50 < 13) next = Math.min(1, this.scale + 0.05);
    if (next !== this.scale) {
      this.scale = next;
      this.resize(this.w, this.h, ctx);
    }
  }

  /** Where the sun lands on screen, and how much of it is in front of us. */
  _aimShafts(ctx) {
    const u = this.shafts.uniforms;
    if (!this.sunDir) {
      u.visible.value = 0;
      return;
    }
    const cam = ctx.camera;
    this._sun.copy(this.sunDir).multiplyScalar(500).add(cam.position);
    const facing = this._sun.clone().sub(cam.position).normalize().dot(cam.getWorldDirection(new THREE.Vector3()));
    this._sun.project(cam);
    u.sunUv.value.set(this._sun.x * 0.5 + 0.5, this._sun.y * 0.5 + 0.5);
    const edge = Math.max(Math.abs(this._sun.x), Math.abs(this._sun.y));
    u.visible.value = THREE.MathUtils.clamp((facing - 0.1) * 3, 0, 1) * (1 - THREE.MathUtils.smoothstep(edge, 1.1, 1.9));
  }

  render(ctx) {
    const r = this.renderer;
    this._adapt(ctx);
    r.info.reset();
    if (this.grade) {
      this.grade.uniforms.time.value = ctx.config.deterministic ? 0 : ctx.time.elapsed % 10;
      this.grade.uniforms.hurt.value = this.hurt;
    }
    if (this.composer) {
      this._aimShafts(ctx);
      this.composer.render(ctx.time.dt);
    } else {
      r.autoClear = true;
      r.render(ctx.scene, ctx.camera);
      r.autoClear = false;
      r.clearDepth();
      r.render(ctx.viewScene, ctx.viewCamera);
      r.autoClear = true;
    }
    this.drawCalls = r.info.render.calls;
    this.triangles = r.info.render.triangles;
  }
}
