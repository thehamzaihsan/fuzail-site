// The operator's hand: physiological tremor, optional real device shake, and a precision drag pad.
import * as THREE from 'three';

export class Tremor {
  constructor() {
    this.ph = Array.from({ length: 9 }, () => Math.random() * 100);
    this.t = 0; this.level = 1;              // 1 = normal steady hand
    this.device = new THREE.Vector3();       // filtered device acceleration (m/s^2)
    this.deviceOn = false;
    this._onMotion = (e) => {
      const a = e.acceleration; if (!a || a.x == null) return;
      this.device.lerp(new THREE.Vector3(a.x, a.y, a.z), 0.35);
    };
  }
  async enableDevice() {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') return false;
      }
      if (typeof DeviceMotionEvent === 'undefined') return false;
      addEventListener('devicemotion', this._onMotion); this.deviceOn = true; return true;
    } catch { return false; }
  }
  disableDevice() { removeEventListener('devicemotion', this._onMotion); this.deviceOn = false; this.device.set(0, 0, 0); }

  // returns an offset in metres: x,y lateral (in the tool's plane), z along the tool axis.
  // The shake follows how you move the precision dial: slow, steady strokes (a few mm/s) keep the hand almost still;
  // fast strokes and sudden starts and stops (jerk) build up a shake of up to ~1.6 mm that settles again within about
  // half a second once you slow down. this.shake (0..1) is exposed for the UI.
  sample(dt, speedMm) {
    this.t += dt; const t = this.t, p = this.ph, sp = Math.abs(speedMm || 0);
    const acc = dt > 0 ? Math.abs(sp - (this._sp || 0)) / dt : 0; this._sp = sp;
    const target = Math.min(1, Math.max(0, (sp - 3) / 28) + Math.min(0.6, Math.max(0, acc - 60) / 500));
    this.shake = (this.shake || 0) + (target - (this.shake || 0)) * Math.min(1, dt * (target > (this.shake || 0) ? 10 : 2.2));
    const amp = (0.00008 + 0.0016 * this.shake) * this.level;
    const drift = 0.00025 * this.level;                                    // slow postural drift
    const f = (i, hz) => Math.sin(2 * Math.PI * hz * t + p[i]);
    const o = new THREE.Vector3(
      amp * (f(0, 9.1) + 0.6 * f(1, 11.7)) + drift * f(2, 0.37),
      amp * (f(3, 8.4) + 0.6 * f(4, 10.3)) + drift * f(5, 0.29),
      amp * 0.8 * (f(6, 9.7) + 0.5 * f(7, 12.2)) + drift * 0.6 * f(8, 0.41));
    if (this.deviceOn) o.addScaledVector(this.device, 0.0016); // real phone shake: 1 m/s^2 -> 1.6 mm
    return o;
  }
}

// Vertical drag strip: drag up = advance, down = withdraw. 1 px = 0.1 mm. Arrow keys / W,S also work.
export class PrecisionPad {
  constructor(el) {
    this.el = el; this.pending = 0; this.speed = 0; this.active = false; this.keys = 0; this.mmPerPx = 0.1;
    let lastY = 0;
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); this.active = true; lastY = e.clientY; el.classList.add('grab'); });
    el.addEventListener('pointermove', e => { if (!this.active) return; const dy = lastY - e.clientY; lastY = e.clientY; this.pending += dy * this.mmPerPx; this.knob(dy); });
    const up = () => { this.active = false; el.classList.remove('grab'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    addEventListener('keydown', e => { if (this.el.offsetParent === null) return; if (['ArrowUp', 'w', 'W'].includes(e.key)) this.keys = e.shiftKey ? 1.2 : 3.5; if (['ArrowDown', 's', 'S'].includes(e.key)) this.keys = e.shiftKey ? -1.2 : -3.5; });
    addEventListener('keyup', e => { if (['ArrowUp', 'w', 'W', 'ArrowDown', 's', 'S'].includes(e.key)) this.keys = 0; });
    this.offset = 0;
  }
  knob(dy) { this.offset = (this.offset - dy + 2000) % 40; this.el.style.backgroundPositionY = `${this.offset}px`; }
  // millimetres requested since last frame (+ advance, - withdraw) and the hand speed in mm/s
  consume(dt) {
    let mm = this.pending + this.keys * dt; this.pending = 0;
    const inst = dt > 0 ? mm / dt : 0;
    this.speed = this.speed + (inst - this.speed) * Math.min(1, dt * 10);
    return mm;
  }
}
