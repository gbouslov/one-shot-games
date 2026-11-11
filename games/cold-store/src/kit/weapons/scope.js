import * as THREE from 'three';

/**
 * A magnifying optic. Right mouse aims down the sight; the optic's lens shows a
 * render-to-texture view of the world at `zoom`, while the rest of the screen stays
 * at the normal field of view. Opt in per weapon in src/game/weapons.js:
 *
 *   { id: 'smg', model: 'compact', scope: { zoom: 3, res: 384, reticle: '#0b0b0b' }, ... }
 *
 * Works on any coded firearm with an optic (`model: 'carbine' | 'compact'`). The world
 * is rendered a second time only while the sight is up, so hip fire costs nothing.
 * Add the system in main.js: `.add(ScopeSystem)` after WeaponSystem.
 */
export class ScopeSystem {
  static id = 'scope';
  static deps = ['weapons', 'player', 'render'];

  init(ctx) {
    this.ctx = ctx;
    this.lenses = [];
    const ws = ctx.get('weapons');
    for (const slot of ws.slots) {
      const sc = slot.def.scope;
      const optic = slot.vm?.optic;
      if (!sc || !optic || !slot.vm.group) continue;
      this.lenses.push({ slot, sc, mesh: this._lens(slot.vm.group, optic, sc) });
    }
    if (!this.lenses.length) return;
    const res = Math.max(...this.lenses.map((l) => l.sc.res ?? 384));
    this.rt = new THREE.WebGLRenderTarget(res, res, { type: THREE.HalfFloatType, samples: 0 });
    for (const l of this.lenses) l.mesh.material.uniforms.map.value = this.rt.texture;
    this.cam = new THREE.PerspectiveCamera(20, 1, 0.05, 400);
    this.amount = 0;
  }

  _lens(group, optic, sc) {
    const r = (optic.apertureR ?? 0.012) * 1.04;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: null }, ink: { value: new THREE.Color(sc.reticle ?? '#0b0b0b') }, glow: { value: new THREE.Color(sc.dot ?? '#ff3a24') }, fade: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D map; uniform vec3 ink; uniform vec3 glow; uniform float fade; varying vec2 vUv;
        void main(){
          vec2 c = vUv - 0.5; float r = length(c) * 2.0;
          // slight barrel distortion and colour fringe toward the rim, like real glass
          vec2 d = c * (1.0 + 0.10 * r * r);
          vec3 col = vec3(texture2D(map, d * 1.02 + 0.5 + d * 0.004).r, texture2D(map, d + 0.5).g, texture2D(map, d * 0.996 + 0.5).b);
          col *= smoothstep(1.0, 0.72, r) * 1.05;
          // reticle: thin cross with a centre gap, heavier posts outside, a lit centre dot
          float ax = abs(c.x), ay = abs(c.y);
          float thin = (step(ax, 0.0035) * step(0.035, ay) + step(ay, 0.0035) * step(0.035, ax));
          float post = (step(ax, 0.011) * step(0.28, ay) * step(c.y, 0.0) + step(ay, 0.011) * step(0.28, ax));
          float line = clamp(thin + post, 0.0, 1.0);
          col = mix(col, ink, line * 0.92);
          float dot = smoothstep(0.012, 0.006, length(c));
          col += glow * dot * 6.0;
          gl_FragColor = vec4(col * fade, 1.0);
        }`,
      depthWrite: true,
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat);
    mesh.position.set(optic.center[0], optic.center[1], optic.lensZ + 0.0085);
    mesh.renderOrder = 6;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  }

  /** The scope lens for the current weapon, or null. */
  get active() {
    const cur = this.ctx.get('weapons').current;
    return this.lenses.find((l) => l.slot === cur) ?? null;
  }

  update() {
    if (!this.lenses.length) return;
    const ctx = this.ctx;
    const ws = ctx.get('weapons');
    const ads = ws.vm?.adsT ?? 0;
    const act = this.active;
    for (const l of this.lenses) l.mesh.visible = l === act && ads > 0.05;
    if (!act || ads <= 0.05) return;
    act.mesh.material.uniforms.fade.value = Math.min(1, (ads - 0.05) / 0.5);
    const cam = ctx.camera;
    this.cam.position.copy(cam.position);
    this.cam.quaternion.copy(cam.quaternion);
    this.cam.fov = cam.fov / (act.sc.zoom ?? 3);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    const r = ctx.get('render').renderer;
    const shadows = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.render(ctx.scene, this.cam);
    r.setRenderTarget(prev);
    r.shadowMap.autoUpdate = shadows;
  }
}
