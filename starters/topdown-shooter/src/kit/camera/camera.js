import * as THREE from 'three';

/**
 * The follow camera. Two rigs share one system:
 *   'topdown'   high and tilted, fixed heading, leads toward where you aim
 *   'shoulder'  behind and right of the player, turns with the aim (third person)
 *
 *   camera.configure({ mode, pitch, distance, height, lead, fov, shoulder, damping })
 *   camera.groundBasis()        screen-up and screen-right as ground directions
 *   camera.screenToGround(x, y, h)  where a screen pixel lands on the plane y = h
 *   camera.shake(amount)        trauma, 0..1, decays by itself
 *   camera.scripted = true      leaves the camera where a capture shot put it
 */
export class CameraSystem {
  static id = 'camera';
  static deps = ['player'];

  init(ctx) {
    this.ctx = ctx;
    this.cam = ctx.camera;
    this.mode = 'topdown';
    this.pitch = 0.98; // radians above the horizon
    this.distance = 21;
    this.heading = 0; // the camera looks toward -z at heading 0
    this.lead = 0.22;
    this.maxLead = 4.5;
    this.damping = 7;
    this.shoulder = [0.85, 1.75, -3.6];
    this.target = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.trauma = 0;
    this.scripted = false;
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._v = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
    this.cam.near = 0.3;
    this.cam.far = 400;
    this.rng = ctx.rng.fork();
  }

  configure(o = {}) {
    Object.assign(this, o);
    if (o.fov) {
      this.cam.fov = o.fov;
      this.cam.updateProjectionMatrix();
    }
  }

  groundBasis() {
    const h = this.heading;
    // forward = screen up, right = screen right
    return { fx: -Math.sin(h), fz: -Math.cos(h), rx: Math.cos(h), rz: -Math.sin(h) };
  }

  screenToGround(px, py, h = 0, out = { x: 0, z: 0 }) {
    const w = this.ctx.canvas.clientWidth || innerWidth;
    const hh = this.ctx.canvas.clientHeight || innerHeight;
    this._ndc.set((px / w) * 2 - 1, -(py / hh) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.cam);
    this._plane.constant = -h;
    const hit = this._ray.ray.intersectPlane(this._plane, this._v);
    if (!hit) return null;
    out.x = hit.x;
    out.z = hit.z;
    return out;
  }

  /** Where a world point lands on screen, in CSS pixels. */
  toScreen(x, y, z, out = { x: 0, y: 0 }) {
    this._v.set(x, y, z).project(this.cam);
    out.x = (this._v.x * 0.5 + 0.5) * (this.ctx.canvas.clientWidth || innerWidth);
    out.y = (-this._v.y * 0.5 + 0.5) * (this.ctx.canvas.clientHeight || innerHeight);
    out.behind = this._v.z > 1;
    return out;
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Jump straight to the follow position, no easing (round start, capture). */
  snap() {
    this._follow(1e6);
  }

  _follow(dt) {
    const p = this.ctx.get('player');
    const k = 1 - Math.exp(-this.damping * dt);
    if (this.mode === 'shoulder') {
      // Heading follows the aim; the camera sits behind and over the right shoulder.
      this.heading = p.yaw + Math.PI;
      const s = Math.sin(p.yaw);
      const c = Math.cos(p.yaw);
      const [ox, oy, oz] = this.shoulder;
      const want = this._v.set(p.x + c * -ox + s * oz, oy, p.z - s * -ox + c * oz);
      this.cam.position.lerp(want, k);
      this.focus.set(p.x + s * 8 + c * -ox * 0.6, 1.3, p.z + c * 8 - s * -ox * 0.6);
      this.target.lerp(this.focus, k);
      this.cam.lookAt(this.target);
      return;
    }
    const ax = p.aimX - p.x;
    const az = p.aimZ - p.z;
    const al = Math.hypot(ax, az);
    const lead = Math.min(this.maxLead, al * this.lead);
    this.focus.set(p.x + (al > 0 ? (ax / al) * lead : 0), 0, p.z + (al > 0 ? (az / al) * lead : 0));
    this.target.lerp(this.focus, k);
    const h = this.heading;
    const cp = Math.cos(this.pitch);
    this.cam.position.set(
      this.target.x + Math.sin(h) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(h) * cp * this.distance,
    );
    this.cam.lookAt(this.target);
  }

  lateUpdate(dt) {
    if (this.scripted) return;
    this._follow(dt);
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma;
      const r = this.rng;
      this.cam.position.x += r.signed() * s * 0.35;
      this.cam.position.z += r.signed() * s * 0.35;
      this.cam.rotation.z += r.signed() * s * 0.02;
      this.trauma = Math.max(0, this.trauma - dt * 2.4);
    }
  }
}
