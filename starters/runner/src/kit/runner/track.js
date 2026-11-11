import * as THREE from 'three';

/**
 * The path a runner follows: a centre line that bends left and right and
 * rises and dips, measured in metres along its length `s`. Built once from a
 * few sine terms (so it is smooth and the same every run) and sampled every
 * metre. Everything in a runner lives in track space, (s, x, y): `s` along
 * the path, `x` across it (lanes), `y` above its surface. Collisions are
 * tested there, so a bend or a dip never changes what is fair.
 *
 *   const track = new Track({ length: 1700, bends: [[amp, wavelength, phase]...], hills: [...], flat: 80 })
 *   track.frame(s, out)          { pos, fwd, right, up } world vectors at s
 *   track.toWorld(s, x, y, out)  a track-space point in the world
 *   track.basis(s, m4)           a Matrix4 whose -Z is forward, X right, Y up, origin on the path
 *
 * `bends` are heading terms in radians (the path turns by amp at its widest),
 * `hills` are height terms in metres. `flat` metres at the start are straight
 * and level, and the terms ease in after them.
 *
 * Written for this repository.
 */
export class Track {
  constructor({ length = 1600, bends = [], hills = [], flat = 60, step = 1 } = {}) {
    this.length = length;
    this.step = step;
    const n = Math.ceil((length + 400) / step) + 2;
    this.n = n;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.heading = new Float32Array(n);
    const ease = (s) => {
      const t = Math.max(0, Math.min(1, (s - flat) / 120));
      return t * t * (3 - 2 * t);
    };
    let x = 0;
    let z = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const s = (i - 1) * step; // index 1 is s = 0; index 0 sits a metre behind
      const k = ease(s);
      let h = 0;
      for (const [a, w, p] of bends) h += a * (Math.sin((s / w) * Math.PI * 2 + p) - Math.sin(p));
      let y = 0;
      for (const [a, w, p] of hills) y += a * (Math.sin((s / w) * Math.PI * 2 + p) - Math.sin(p));
      h *= k;
      y *= k;
      this.heading[i] = h;
      this.px[i] = x;
      this.py[i] = y;
      this.pz[i] = z;
      x += Math.sin(h) * step;
      z -= Math.cos(h) * step;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    // Shift so s = 0 is the origin.
    const ox = this.px[1];
    const oz = this.pz[1];
    for (let i = 0; i < n; i++) {
      this.px[i] -= ox;
      this.pz[i] -= oz;
    }
    this.minY = minY;
    this.maxY = maxY;
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._f = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3() };
  }

  /** Centre-line point at s. */
  point(s, out = new THREE.Vector3()) {
    const f = Math.max(0, Math.min(this.n - 2.001, s / this.step + 1));
    const i = Math.floor(f);
    const t = f - i;
    return out.set(
      this.px[i] + (this.px[i + 1] - this.px[i]) * t,
      this.py[i] + (this.py[i + 1] - this.py[i]) * t,
      this.pz[i] + (this.pz[i + 1] - this.pz[i]) * t,
    );
  }

  /** Heading (radians, 0 = down -Z, positive turns right) at s. */
  headingAt(s) {
    const f = Math.max(0, Math.min(this.n - 2.001, s / this.step + 1));
    const i = Math.floor(f);
    return this.heading[i] + (this.heading[i + 1] - this.heading[i]) * (f - i);
  }

  frame(s, out = this._f) {
    this.point(s, out.pos);
    const a = this.point(s - 1.5, this._a);
    const b = this.point(s + 1.5, this._b);
    out.fwd.subVectors(b, a).normalize();
    // Right stays level (no banking); up leans with the slope.
    out.right.set(-out.fwd.z, 0, out.fwd.x).normalize();
    out.up.crossVectors(out.right, out.fwd).normalize();
    return out;
  }

  toWorld(s, x, y, out = new THREE.Vector3()) {
    const f = this.frame(s);
    return out.copy(f.pos).addScaledVector(f.right, x).addScaledVector(f.up, y);
  }

  basis(s, m = new THREE.Matrix4()) {
    const f = this.frame(s);
    const back = this._a.copy(f.fwd).negate();
    m.makeBasis(f.right, f.up, back);
    m.setPosition(f.pos);
    return m;
  }
}
