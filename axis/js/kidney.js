import * as THREE from 'three';
import { toThree } from './flowpaths.js';

// Kidneys: renal vessels + their own two flows.
//   Blood  (red → blue): abdominal aorta → renal artery → branches to the cortex (filtration) → back to the hilum →
//          renal vein → inferior vena cava. Arterial cells surge with each heartbeat.
//   Urine  (amber):      cortex → renal pelvis → ureter (peristaltic waves, a few per minute) → bladder, where it collects.
// Renal blood flow follows cardiac output, and urine production follows blood pressure (it stops when MAP falls below
// about 60 mmHg, as in shock), so the procedures' complications show up here too.
const V3 = (p) => new THREE.Vector3(...toThree(p));
const RED = new THREE.Color(0xff2b2b), BLUE = new THREE.Color(0x4a63ff), URINE = new THREE.Color(0xf2c63b);

class Path {
  constructor(points, n = 40) {
    const c = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.length = c.getLength(); this.n = n; this.pts = c.getSpacedPoints(n);
  }
  at(f, out) { const x = THREE.MathUtils.clamp(f, 0, 1) * this.n, i = Math.min(this.n - 1, Math.floor(x)); return out.lerpVectors(this.pts[i], this.pts[i + 1], x - i); }
}

// Each cell has a fixed place in the tube's cross-section that slowly turns, so the stream has volume.
function cell(extra) {
  const n = new THREE.Vector3().randomDirection(), a = new THREE.Vector3().randomDirection().cross(n).normalize(), b = n.clone().cross(a);
  return { a, b, rho: Math.sqrt(Math.random()) * 0.9, th: Math.random() * 6.28, w: 0.4 + Math.random() * 0.8, sp: 0.7 + Math.random() * 0.6, ...extra };
}
function spread(c, r, v) { const cs = Math.cos(c.th) * c.rho * r, sn = Math.sin(c.th) * c.rho * r; v.x += c.a.x * cs + c.b.x * sn; v.y += c.a.y * cs + c.b.y * sn; v.z += c.a.z * cs + c.b.z * sn; return v; }

export class KidneyFlow {
  constructor(scene, anatomy, K) {
    this.K = K;
    const aortaAt = (z) => { const p = [[0.002, -0.048, 1.188], [-0.009, -0.060, 1.120], [-0.006, -0.051, 1.030]]; const t = (p[0][2] - z) / (p[0][2] - p[1][2]); return t <= 1 ? p[0].map((v, i) => v + (p[1][i] - v) * t) : p[1].map((v, i) => v + (p[2][i] - v) * (z - p[1][2]) / (p[2][2] - p[1][2])); };
    const ivcAt = (z) => { const a = [-0.011, -0.053, 1.139], b = [-0.012, -0.057, 1.060]; const t = (a[2] - z) / (a[2] - b[2]); return a.map((v, i) => v + (b[i] - v) * t); };
    this.paths = {};
    this.vessels = [];
    const tubeMat = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.05 });
    for (const s of ['L', 'R']) {
      const side = s === 'L' ? 1 : -1, k = K[s], hil = k.hilum, z = hil[2];
      const ao = aortaAt(z + 0.006), iv = ivcAt(z - 0.004);
      // renal artery: from the side of the aorta to the hilum; renal vein: hilum to the IVC (the left one crosses in front of the aorta)
      const aStart = [ao[0] + side * 0.004, ao[1] + 0.002, ao[2]];
      const art = [aStart, [(aStart[0] + hil[0]) / 2, (aStart[1] + hil[1]) / 2 + 0.002, (aStart[2] + hil[2]) / 2 + 0.004], [hil[0], hil[1] - 0.002, hil[2] + 0.004]].map(V3);
      const vEnd = [iv[0] - 0.003, iv[1] - (s === 'L' ? 0.004 : 0), iv[2]];
      const vein = [[hil[0], hil[1] - 0.004, hil[2] - 0.004], [(vEnd[0] + hil[0]) / 2, (vEnd[1] + hil[1]) / 2 - (s === 'L' ? 0.008 : 0.002), (vEnd[2] + hil[2]) / 2 - 0.003], vEnd].map(V3);
      this.paths['art' + s] = new Path(art); this.paths['vein' + s] = new Path(vein);
      for (const [name, pts, r, col] of [['RenalArtery' + s, art, 0.0021, 0xc8322b], ['RenalVein' + s, vein, 0.0028, 0x3b4fc4]]) {
        const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 24, r, 10, false), tubeMat(col));
        m.name = name; m.userData.part = name; m.userData.baseEmissive = new THREE.Color(0);
        anatomy.root.add(m); anatomy.parts[name] = m; this.vessels.push(m);
      }
      // inside the kidney: hilum → branches → each cortex point, and back
      const H = V3(hil), C = V3(k.centre);
      this.paths['in' + s] = k.cortex.map(p => { const P = V3(p); return new Path([H, H.clone().lerp(C, 0.5).lerp(P, 0.25), H.clone().lerp(P, 0.7), P], 16); });
      this.paths['out' + s] = k.cortex.map(p => { const P = V3(p); return new Path([P, H.clone().lerp(P, 0.65).add(new THREE.Vector3(0, -0.003, 0)), H.clone().lerp(C, 0.35), H], 16); });
      this.paths['pelvis' + s] = k.cortex.map(p => { const P = V3(p); return new Path([P, P.clone().lerp(C, 0.5), C.clone().lerp(H, 0.6), H], 16); });
      this.paths['ureter' + s] = new Path(k.ureter.map(V3), 60);
      this.paths['aorta' + s] = new Path([aortaAt(1.175), aortaAt(z + 0.02), ao].map(V3), 20);
      this.paths['ivc' + s] = new Path([iv, ivcAt(1.14), ivcAt(1.175)].map(V3), 20);
    }
    const b = K.bladder; this.bladderC = V3(b.centre); this.bladderR = b.radius;
    this.mesh = this.particles(scene, 760, 0.00085);
    this.urine = this.particles(scene, 300, 0.00075);
    this.blood = [];
    for (let i = 0; i < 760; i++) this.blood.push(this.spawnBlood(cell({ side: i % 2 ? 'L' : 'R' }), true));
    this.pee = [];
    for (let i = 0; i < 300; i++) { const c = this.spawnUrine(cell({ side: i % 2 ? 'L' : 'R' }), true); this.pee.push(c); this.urine.setColorAt(i, URINE.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1)); }
    this.urine.instanceColor.needsUpdate = true;
    this._v = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
    this.wave = 0; this.urineRate = 1;
  }
  particles(scene, n, r) {
    const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: 0x150500 }), n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.visible = false;
    for (let i = 0; i < n; i++) m.setColorAt(i, RED);
    scene.add(m); return m;
  }
  setVisible(on) { this.mesh.visible = on; this.urine.visible = on; }
  get visible() { return this.mesh.visible; }

  // blood route: aorta → renal artery → in (to cortex) → out (to hilum) → renal vein → IVC
  spawnBlood(c, scatter) {
    c.k = scatter ? Math.floor(Math.random() * 6) : 0; c.f = scatter ? Math.random() : 0; c.t = Math.floor(Math.random() * this.K[c.side].cortex.length);
    return c;
  }
  seg(c) {
    const s = c.side, P = this.paths;
    return [P['aorta' + s], P['art' + s], P['in' + s][c.t], P['out' + s][c.t], P['vein' + s], P['ivc' + s]][c.k];
  }
  spawnUrine(c, scatter) {
    c.k = scatter ? Math.floor(Math.random() * 3) : 0; c.f = scatter ? Math.random() : 0; c.t = Math.floor(Math.random() * this.K[c.side].cortex.length);
    c.wait = 0; c.home = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()) * this.bladderR * 0.55).add(this.bladderC); c.home.y -= this.bladderR * 0.15;
    return c;
  }

  update(dt, phys) {
    if (!this.mesh.visible || dt <= 0) return;
    const p = phys.cardiacPhase, sys = p > 0.12 && p < 0.46, flow = phys.output * (phys.hr / 72), v = this._v;
    // urine production falls with blood pressure (autoregulation fails below ~60 mmHg mean)
    this.urineRate = THREE.MathUtils.clamp((phys.map - 58) / 30, 0, 1.2) * Math.min(1, phys.output);
    this.wave += dt * 0.07; // peristaltic waves travel down each ureter
    for (let i = 0; i < this.blood.length; i++) {
      const c = this.blood[i]; let g = this.seg(c);
      const v0 = c.k <= 1 ? (sys ? 0.16 : 0.06) : c.k <= 3 ? 0.03 : 0.05;
      c.f += v0 * flow * c.sp * dt / g.length;
      if (c.f >= 1) { c.k++; c.f = 0; if (c.k > 5) this.spawnBlood(c, false); g = this.seg(c); }
      c.th += c.w * dt * 0.4;
      g.at(c.f, v); spread(c, [0.0045, 0.0015, 0.0012, 0.0012, 0.002, 0.005][c.k], v);
      this._m.compose(v, this._q, this._s); this.mesh.setMatrixAt(i, this._m);
      // oxygen given up in the kidney: red until the cortex, blue on the way out
      const ox = c.k < 2 ? 1 : c.k === 2 ? 1 - 0.4 * c.f : c.k === 3 ? 0.6 - 0.6 * c.f : 0;
      this.mesh.setColorAt(i, this._c.copy(BLUE).lerp(RED, ox));
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    for (let i = 0; i < this.pee.length; i++) {
      const c = this.pee[i], s = c.side;
      if (c.k === 3) { // in the bladder: drift to a resting place, stay a while, then recycle
        v.copy(c.pos).lerp(c.home, Math.min(1, dt * 1.5)); c.pos.copy(v); c.wait -= dt;
        if (c.wait <= 0) this.spawnUrine(c, false);
      } else {
        let g = c.k === 0 ? this.paths['pelvis' + s][c.t] : c.k === 1 ? this.paths['pelvis' + s][c.t] : this.paths['ureter' + s];
        let sp;
        if (c.k < 2) sp = 0.008 * this.urineRate;
        else { const ph = (c.f - this.wave * 6) * Math.PI * 2 * 3; sp = 0.004 + 0.05 * Math.max(0, Math.sin(ph)) ** 4; sp *= Math.max(0.15, this.urineRate); }
        c.f += sp * c.sp * dt / g.length;
        if (c.f >= 1) { c.f = 0; c.k = c.k === 0 ? 2 : c.k + 1; if (c.k === 3) { c.pos = this.paths['ureter' + s].at(1, new THREE.Vector3()); c.wait = 8 + Math.random() * 10; } }
        if (c.k !== 3) { g = c.k < 2 ? this.paths['pelvis' + s][c.t] : this.paths['ureter' + s]; g.at(c.f, v); c.th += dt * 0.3; spread(c, c.k < 2 ? 0.0012 : 0.0007, v); }
      }
      const show = this.urineRate > 0.01 || c.k === 3;
      this._s.setScalar(show ? 1 : 0);
      this._m.compose(c.k === 3 ? c.pos : v, this._q, this._s); this.urine.setMatrixAt(i, this._m); this._s.setScalar(1);
    }
    this.urine.instanceMatrix.needsUpdate = true;
  }

  // label anchor helpers (three.js world coords)
  anchors() {
    const K = this.K, A = (p) => V3(p);
    const mid = (path) => path.at(0.5, new THREE.Vector3());
    return {
      aorta: this.paths.aortaL.at(0.15, new THREE.Vector3()), ivc: this.paths.ivcR.at(0.85, new THREE.Vector3()),
      arteryL: mid(this.paths.artL), veinL: mid(this.paths.veinL), pelvisR: A(K.R.hilum), ureterL: this.paths.ureterL.at(0.45, new THREE.Vector3()),
    };
  }
}
