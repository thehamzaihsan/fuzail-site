import * as THREE from 'three';
import { info } from './info.js';

// Numbered annotations (Sketchfab style): a numbered pin sits on each structure, fixed to the model, so it stays put
// when you rotate or pan. Tapping a pin opens an information card; the arrows step through the annotations in order
// and the camera turns to face each one. Pins behind the model fade but stay tappable. In the exploded view the pins
// travel with their part (offsetFn).
export class Labels {
  constructor(camera, raycastTargets) {
    this.camera = camera; this.targets = raycastTargets;
    this.root = document.getElementById('labels');
    this.card = document.getElementById('anno-card');
    this.items = []; this.frame = 0; this.ray = new THREE.Raycaster();
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._p = new THREE.Vector3();
    this.active = -1; this.onSelect = null; this.onClose = null; this.offsetFn = null; this.dirty = true;
    this.card.querySelector('#anno-x').onclick = () => this.close();
    this.card.querySelector('#anno-prev').onclick = () => this.open((this.active - 1 + this.items.length) % this.items.length);
    this.card.querySelector('#anno-next').onclick = () => this.open((this.active + 1) % this.items.length);
    addEventListener('keydown', e => {
      if (this.active < 0) return;
      if (e.key === 'ArrowRight') this.card.querySelector('#anno-next').click();
      if (e.key === 'ArrowLeft') this.card.querySelector('#anno-prev').click();
      if (e.key === 'Escape') this.close();
    });
  }

  // list: [{ text, anchor: Vector3 (world) }] in reading order; opts.facing / opts.occluders: see update()
  set(list, center, reach, opts = {}) {
    this.clear();
    this.center = center.clone();
    this.facing = opts.facing || null; this.occluders = opts.occluders || null; this.last = null; this.rr = 0; this.burst = 0;
    list.forEach((it, i) => {
      const el = document.createElement('button');
      el.className = 'pin'; el.textContent = i + 1; el.title = it.text; el.setAttribute('aria-label', `${i + 1}. ${it.text}`);
      el.addEventListener('pointerdown', e => e.stopPropagation());
      el.addEventListener('click', e => { e.stopPropagation(); this.active === i ? this.close() : this.open(i); });
      this.root.append(el);
      this.items.push({ ...it, el, vis: 1, off: new THREE.Vector3() });
    });
    this.root.hidden = !this.items.length; this.dirty = true;
  }

  clear() { this.close(); for (const it of this.items) it.el.remove(); this.items = []; this.root.hidden = true; }
  show(on) { this.root.style.display = on ? '' : 'none'; this.last = null; if (!on) this.close(); }
  // world position of a pin, including its exploded-view offset
  pos(it, out = this._p) { return out.copy(it.anchor).add(it.off); }
  refreshOffsets() { this.dirty = true; }

  open(i) {
    const it = this.items[i]; if (!it) return;
    if (this.active >= 0 && this.items[this.active]) this.items[this.active].el.classList.remove('on');
    this.active = i; it.el.classList.add('on');
    for (const o of this.items) o.el.classList.toggle('dim', o !== it);
    const t = info(it.text);
    this.card.querySelector('#anno-num').textContent = i + 1;
    this.card.querySelector('#anno-title').textContent = it.text;
    this.card.querySelector('#anno-desc').textContent = t.d || 'No description yet.';
    const k = this.card.querySelector('#anno-key'); k.textContent = t.k || ''; k.hidden = !t.k;
    this.card.querySelector('#anno-count').textContent = `${i + 1} / ${this.items.length}`;
    this.card.hidden = false;
    if (this.onSelect) this.onSelect(this.pos(it, new THREE.Vector3()), this.center, it);
  }
  close() {
    const was = this.active >= 0;
    if (was && this.items[this.active]) this.items[this.active].el.classList.remove('on');
    for (const o of this.items) o.el.classList.remove('dim');
    this.active = -1; if (this.card) this.card.hidden = true;
    if (was && this.onClose) this.onClose();
  }

  update() {
    if (!this.items.length || this.root.style.display === 'none') return;
    const W = innerWidth, H = innerHeight, cam = this.camera;
    cam.updateMatrixWorld();
    if (this.dirty) { for (const it of this.items) { if (this.offsetFn) this.offsetFn(it.anchor, it.off); else it.off.set(0, 0, 0); } }
    const key = cam.matrixWorld.elements.join(',') + cam.projectionMatrix.elements[0] + cam.projectionMatrix.elements[5] + W + 'x' + H;
    const camMoved = key !== this.last || this.dirty; this.last = key; this.dirty = false;
    let fadeChanged = false;
    if (camMoved) this.burst = this.items.length;
    if (this.burst > 0 || (this.frame++ % 6) === 0) {
      // occlusion: one ray per frame, every pin quickly after the camera moves
      this.burst--;
      const it = this.items[this.rr++ % this.items.length], p = this.pos(it);
      const dir = this._a.copy(p).sub(cam.position); const dist = dir.length();
      this.ray.set(cam.position, dir.normalize()); this.ray.far = dist;
      let hidden = false;
      if (this.occluders) {
        const hit = this.ray.intersectObjects(this.occluders(), false)[0];
        hidden = (hit && hit.distance < dist - 0.004) || (this.facing && this._b.copy(cam.position).sub(p).normalize().dot(this.facing) < -0.05);
      } else if (this.targets) {
        const hit = this.ray.intersectObjects(this.targets(), false).find(h => h.object.visible && !(h.object.material && h.object.material.opacity < 0.3));
        hidden = !!hit && hit.distance < dist - 0.015;
      }
      const v = hidden ? 0.38 : 1;
      if (v !== it.vis) { it.vis = v; fadeChanged = true; }
    }
    if (!camMoved && !fadeChanged) return;
    for (const it of this.items) {
      const a = this._a.copy(this.pos(it)).project(cam);
      const o = a.z > 1 ? 0 : it.vis;
      if (o !== it.o) { it.o = o; it.el.style.opacity = o; it.el.style.pointerEvents = o ? 'auto' : 'none'; it.el.classList.toggle('behind', o < 1); }
      if (!camMoved) continue;
      it.el.style.transform = `translate(${((a.x + 1) / 2 * W - 13).toFixed(1)}px, ${((1 - a.y) / 2 * H - 13).toFixed(1)}px)`;
    }
  }
}
