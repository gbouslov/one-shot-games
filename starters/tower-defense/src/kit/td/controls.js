import * as THREE from 'three';

/**
 * Every way to play goes through one function, `controls.act(name, ...args)`:
 * mouse, touch, keyboard, the HUD buttons and the autoplay bot. That is what
 * lets the playtest trust the bot: it presses the same buttons a player does.
 *
 *   act('start')            title or end screen -> a fresh round
 *   act('tool', i)          pick tower type i (again to put it down)
 *   act('cell', c, r)       what a click or tap on that cell does: build, select or clear
 *   act('upgrade') act('sell') act('call') act('speed') act('cancel')
 *
 * Keys: 1-9 tower types, click/tap a tile to build, click a tower to select it,
 * U upgrade, S sell, Space or Enter calls the next wave, F game speed, Esc cancel.
 * Also draws the hover tile, the ghost of the tower about to be built and range rings.
 */
export class ControlsSystem {
  static id = 'controls';
  static deps = ['defense', 'audio'];

  init(ctx) {
    this.ctx = ctx;
    this.tool = null;
    this.hover = null; // [c, r]
    this.pointer = new THREE.Vector2();
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.listeners = [];
    this._down = null;
    this.lastInput = 'mouse';

    const canvas = ctx.canvas;
    const on = (el, type, fn, opts) => {
      el.addEventListener(type, fn, opts);
      this.listeners.push(() => el.removeEventListener(type, fn, opts));
    };
    const unlock = () => ctx.get('audio').unlock();
    on(window, 'pointerdown', unlock, true);
    on(window, 'keydown', unlock, true);
    on(canvas, 'pointermove', (e) => {
      this.lastInput = e.pointerType || 'mouse';
      this._aim(e);
    });
    on(canvas, 'pointerdown', (e) => {
      this.lastInput = e.pointerType || 'mouse';
      this._down = { x: e.clientX, y: e.clientY };
      this._aim(e);
    });
    on(canvas, 'pointerup', (e) => {
      if (!this._down) return;
      const moved = Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y);
      this._down = null;
      if (moved > 18) return;
      this._aim(e);
      const d = ctx.get('defense');
      if (d.state !== 'playing') return this.act('start');
      if (this.hover) this.act('cell', this.hover[0], this.hover[1]);
      else this.act('cancel');
    });
    on(canvas, 'pointerleave', () => { if (this.lastInput === 'mouse') this.hover = null; });
    on(canvas, 'contextmenu', (e) => {
      e.preventDefault();
      this.act('cancel');
    });
    on(window, 'keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      const d = ctx.get('defense');
      if (k.startsWith('Digit')) return this.act('tool', Number(k.slice(5)) - 1);
      if (k === 'Space' || k === 'Enter' || k === 'NumpadEnter') {
        e.preventDefault();
        return d.state === 'playing' ? this.act('call') : this.act('start');
      }
      if (k === 'Escape') return this.act('cancel');
      if (k === 'KeyU') return this.act('upgrade');
      if (k === 'KeyS' || k === 'Delete' || k === 'Backspace') return this.act('sell');
      if (k === 'KeyF') return this.act('speed');
    });

    this._buildCursor();
  }

  act(name, ...a) {
    const d = this.ctx.get('defense');
    const audio = this.ctx.get('audio');
    switch (name) {
      case 'start':
        if (d.state === 'playing') return false;
        this.tool = null;
        d.start();
        audio.play('click');
        return true;
      case 'tool': {
        const i = a[0];
        if (d.state !== 'playing' || !d.towerDefs[i]) return false;
        this.tool = this.tool === i ? null : i;
        d.selected = null;
        audio.play('click');
        return true;
      }
      case 'cell': {
        const [c, r] = a;
        if (d.state !== 'playing') return false;
        const t = d.towerAt(c, r);
        if (t) {
          d.selected = d.selected === t ? null : t;
          this.tool = null;
          audio.play('click');
          return true;
        }
        if (this.tool !== null) {
          const built = d.build(this.tool, c, r);
          if (!built) audio.play('deny');
          // keep the tool in hand while there is gold for another
          else if (d.gold < d.towerDefs[this.tool].cost) this.tool = null;
          return !!built;
        }
        d.selected = null;
        return false;
      }
      case 'upgrade':
        if (!d.selected) return false;
        if (!d.upgrade(d.selected)) {
          audio.play('deny');
          return false;
        }
        return true;
      case 'sell':
        return d.selected ? d.sell(d.selected) : false;
      case 'call':
        return d.callWave();
      case 'speed':
        d.cycleSpeed();
        audio.play('click');
        return true;
      case 'cancel':
        this.tool = null;
        d.selected = null;
        return true;
      default:
        return false;
    }
  }

  /** Screen position (CSS px) of a cell centre, for the HUD, the bot and the playtest. */
  screenOf(c, r) {
    const d = this.ctx.get('defense');
    const p = d.board.toWorld(c, r);
    const v = new THREE.Vector3(p.x, d.level.heightAt(p.x, p.z), p.z).project(this.ctx.camera);
    const rect = this.ctx.canvas.getBoundingClientRect();
    return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
  }

  _aim(e) {
    const rect = this.ctx.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.ctx.camera);
    const hit = new THREE.Vector3();
    const d = this.ctx.get('defense');
    if (!d.board || !this.ray.ray.intersectPlane(this.plane, hit)) {
      this.hover = null;
      return;
    }
    this.hover = d.board.toCell(hit.x, hit.z);
  }

  _buildCursor() {
    const ctx = this.ctx;
    const tile = new THREE.PlaneGeometry(1, 1);
    tile.rotateX(-Math.PI / 2);
    this.tileMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: { color: { value: new THREE.Color('#bff0a0') }, time: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 color; uniform float time; varying vec2 vUv;
        void main(){
          vec2 q = abs(vUv - 0.5) * 2.0;
          float box = max(q.x, q.y);
          float edge = smoothstep(0.78, 0.9, box) * (1.0 - smoothstep(0.96, 1.0, box));
          float fill = 0.10 * (1.0 - box);
          float a = edge * (0.75 + 0.25 * sin(time * 5.0)) + fill;
          gl_FragColor = vec4(color * 1.6, a);
        }`,
    });
    this.tile = new THREE.Mesh(tile, this.tileMat);
    this.tile.renderOrder = 5;
    this.tile.visible = false;
    ctx.scene.add(this.tile);

    const ring = new THREE.RingGeometry(0.985, 1, 96, 1);
    ring.rotateX(-Math.PI / 2);
    const disc = new THREE.CircleGeometry(1, 96);
    disc.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#fff2d6', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
    this.discMat = new THREE.MeshBasicMaterial({ color: '#fff2d6', transparent: true, opacity: 0.08, depthWrite: false, toneMapped: false });
    this.ring = new THREE.Group();
    this.ring.add(new THREE.Mesh(ring, this.ringMat), new THREE.Mesh(disc, this.discMat));
    this.ring.renderOrder = 6;
    this.ring.visible = false;
    ctx.scene.add(this.ring);

    this.ghosts = new Map();
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#d8f5c0', transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false });
  }

  _ghost(i) {
    if (!this.ghosts.has(i)) {
      const d = this.ctx.get('defense');
      const g = d.models.tower(this.ctx, d.towerDefs[i], 0);
      g.traverse((o) => {
        if (o.isMesh || o.isPoints) {
          o.material = this.ghostMat;
          o.castShadow = false;
        }
        if (o.isLight) o.intensity = 0;
      });
      g.visible = false;
      this.ctx.scene.add(g);
      this.ghosts.set(i, g);
    }
    return this.ghosts.get(i);
  }

  update(dt) {
    const d = this.ctx.get('defense');
    this.tileMat.uniforms.time.value += dt;
    for (const g of this.ghosts.values()) g.visible = false;
    this.tile.visible = false;
    this.ring.visible = false;
    if (d.state !== 'playing' || !d.board) return;

    const h = this.hover;
    if (this.tool !== null && h) {
      const def = d.towerDefs[this.tool];
      const ok = d.canBuild(def, h[0], h[1]);
      const p = d.board.toWorld(h[0], h[1]);
      const y = d.level.heightAt(p.x, p.z);
      this.tile.visible = true;
      this.tile.position.set(p.x, y + 0.06, p.z);
      this.tile.scale.setScalar(d.board.cell * 0.96);
      this.tileMat.uniforms.color.value.set(ok ? '#bff0a0' : '#ff7a5c');
      this.ring.visible = true;
      this.ring.position.set(p.x, y + 0.08, p.z);
      this.ring.scale.setScalar(def.range);
      this.ringMat.color.set(ok ? '#fff2d6' : '#ff9a80');
      if (d.board.at(h[0], h[1]) === '.' && !d.towerAt(h[0], h[1])) {
        const g = this._ghost(this.tool);
        g.visible = true;
        g.position.set(p.x, y, p.z);
      }
    } else if (d.selected) {
      const t = d.selected;
      this.ring.visible = true;
      this.ring.position.set(t.x, t.y + 0.08, t.z);
      this.ring.scale.setScalar(t.range);
      this.ringMat.color.set('#fff2d6');
      this.tile.visible = true;
      this.tile.position.set(t.x, t.y + 0.06, t.z);
      this.tile.scale.setScalar(d.board.cell * 0.96);
      this.tileMat.uniforms.color.value.set('#ffe0a0');
    } else if (h && this.lastInput === 'mouse' && d.towerAt(h[0], h[1])) {
      const t = d.towerAt(h[0], h[1]);
      this.tile.visible = true;
      this.tile.position.set(t.x, t.y + 0.06, t.z);
      this.tile.scale.setScalar(d.board.cell * 0.96);
      this.tileMat.uniforms.color.value.set('#ffe0a0');
    }
  }
}
