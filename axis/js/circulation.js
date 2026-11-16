import * as THREE from 'three';
import { toThree, VEINS, RIGHT_HEART, PULM_ART, LOBES, HILUM, PULM_VEIN, LEFT_HEART, ARTERIES, AIRWAY, HEART_CENTER } from './flowpaths.js';

// Whole-body blood circulation + airway airflow as particles travelling along anatomical centrelines.
// Blood:  body veins -> SVC/IVC -> RA -> (tricuspid, diastole) -> RV -> (pulmonary valve, systole) -> PA -> lung lobe
//         -> capillaries (turns oxygenated) -> pulmonary veins -> LA -> (mitral, diastole) -> LV -> (aortic valve, systole)
//         -> aortic arch -> carotids / subclavians / descending aorta -> body capillaries (turns deoxygenated) -> veins ...
// Air:    trachea -> carina -> main bronchus -> lobar bronchi, moving in on inspiration and out on expiration.

const V3 = (a) => new THREE.Vector3(...toThree(a));
const rand = (s) => { let x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };

class Line {
  constructor(points, step = 0.0015) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : V3(p)), false, 'centripetal');
    this.length = curve.getLength();
    const n = Math.max(2, Math.ceil(this.length / step));
    this.n = n; this.pts = curve.getSpacedPoints(n);
  }
  at(s, out) { // s in metres along the line
    const f = THREE.MathUtils.clamp(s / this.length, 0, 1) * this.n, i = Math.min(this.n - 1, Math.floor(f));
    return out.lerpVectors(this.pts[i], this.pts[i + 1], f - i);
  }
}

// Each cell gets its own little eddy: a random orthonormal frame and a place inside the unit ball. addEddy() moves a
// centreline point to that place inside a tube of radius r, turning slowly around the frame (angle c.th).
function eddy(c) {
  const n = new THREE.Vector3().randomDirection(), a = new THREE.Vector3().randomDirection().cross(n).normalize(), b = n.clone().cross(a);
  c.ea = a; c.eb = b; c.en = n;
  c.rho = Math.sqrt(Math.random()) * 0.92; c.eh = (Math.random() * 2 - 1) * 0.5 * Math.sqrt(1 - c.rho * c.rho);
  c.th = Math.random() * 6.283; c.w = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 3);
  return c;
}
function addEddy(c, r, v) {
  const cs = Math.cos(c.th) * c.rho * r, sn = Math.sin(c.th) * c.rho * r, h = c.eh * r;
  v.x += c.ea.x * cs + c.eb.x * sn + c.en.x * h; v.y += c.ea.y * cs + c.eb.y * sn + c.en.y * h; v.z += c.ea.z * cs + c.eb.z * sn + c.en.z * h;
  return v;
}

const OXY = new THREE.Color(0xff2b2b), DEOXY = new THREE.Color(0x4a63ff), AIR = new THREE.Color(0xc8f4ff);

export class Circulation {
  constructor(scene, anatomy, phys, extra = {}) {
    this.anatomy = anatomy; this.phys = phys; this.extra = extra; this.showBlood = true; this.showAir = true;
    this.group = new THREE.Group(); this.group.name = 'Circulation'; this.group.visible = false;
    scene.add(this.group);
    this.build();
    // blood particles
    const N = this.N = 1100; // enough cells to fill the whole loop, out to the hands, feet and head
    const bg = new THREE.SphereGeometry(0.0015, 6, 4);
    this.blood = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ roughness: 0.35, emissiveIntensity: 0.6, emissive: 0x220000 }), N);
    this.blood.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.blood.frustumCulled = false;
    for (let i = 0; i < N; i++) this.blood.setColorAt(i, DEOXY);
    this.group.add(this.blood);
    this.cells = [];
    for (let i = 0; i < N; i++) {
      const c = eddy({ seg: null, s: 0, oxy: 0, wait: 0, side: 'R', lobe: 0, term: 0, art: null });
      this.startVenous(c, this.pickVein(i));
      // spread the initial population along the whole loop
      const skip = Math.floor(rand(i + 3) * 9);
      for (let k = 0; k < skip; k++) this.advanceSegment(c);
      c.s = rand(i + 9) * (c.seg ? c.seg.line.length : 0);
      this.cells.push(c);
    }
    // air particles
    const NA = this.NA = 280;
    this.air = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0012, 6, 4), new THREE.MeshBasicMaterial({ color: AIR, transparent: true, opacity: 0.85 }), NA);
    this.air.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.air.frustumCulled = false;
    this.group.add(this.air);
    this.puffs = [];
    for (let i = 0; i < NA; i++) {
      const side = rand(i * 1.7) < 0.55 ? 'R' : 'L', lobe = Math.floor(rand(i * 2.3) * 3), term = Math.floor(rand(i * 3.1) * 3);
      this.puffs.push({ side, line: this.airLines[side][lobe][term], d: Math.pow(rand(i * 5.9), 0.6) });
    }
    this._v = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
    this.hc = V3(HEART_CENTER);
    this.hilum = { R: V3(HILUM.R), L: V3(HILUM.L) };
  }

  build() {
    const L = (pts) => new Line(pts);
    // complete loop: arteries continue to the feet, hands and scalp (centrelines traced along the Arteries mesh),
    // veins start there and return (traced along the Veins mesh) into the jugular / arm veins / IVC.
    const limbs = (this.extra && this.extra.limbs) || {};
    const rev = (a) => (a ? [...a].reverse() : []);
    const veinDefs = {
      vLegR: [...rev(limbs.vLegR).slice(0, -1), ...VEINS.ivc.pts], vLegL: [...rev(limbs.vLegL).slice(0, -1), ...VEINS.ivc.pts],
      vHeadR: [...rev(limbs.vHeadR).slice(0, -1), ...VEINS.rJugular.pts], vHeadL: [...rev(limbs.vHeadL).slice(0, -1), ...VEINS.lJugular.pts],
      vArmR: [...rev(limbs.vArmR).slice(0, -1), ...VEINS.rArmV.pts], vArmL: [...rev(limbs.vArmL).slice(0, -1), ...VEINS.lArmV.pts],
    };
    this.veins = {}; for (const [k, pts] of Object.entries(veinDefs)) this.veins[k] = { kind: 'vein', line: L(pts) };
    this.rhIn = { kind: 'av', line: L(RIGHT_HEART.inflow) };
    this.rhOut = { kind: 'out', line: L(RIGHT_HEART.outflow) };
    this.lhIn = { kind: 'av', line: L(LEFT_HEART.inflow) };
    this.lhOut = { kind: 'out', line: L(LEFT_HEART.outflow) };
    this.pa = { R: { kind: 'artery', line: L(PULM_ART.R) }, L: { kind: 'artery', line: L(PULM_ART.L) } };
    this.arts = {}; this.artW = [];
    const artDefs = {
      aLegR: { w: 0.31, end: 'vLegR', pts: [...ARTERIES.descending.pts.slice(0, -1), ...(limbs.aLegR || [])] },
      aLegL: { w: 0.31, end: 'vLegL', pts: [...ARTERIES.descending.pts.slice(0, -1), ...(limbs.aLegL || [])] },
      aHeadR: { w: 0.11, end: 'vHeadR', pts: [...ARTERIES.rCarotid.pts, ...(limbs.aHeadR || []).slice(1)] },
      aHeadL: { w: 0.11, end: 'vHeadL', pts: [...ARTERIES.lCarotid.pts, ...(limbs.aHeadL || []).slice(1)] },
      aArmR: { w: 0.07, end: 'vArmR', pts: [...ARTERIES.rSubclavian.pts, ...(limbs.aArmR || []).slice(1)] },
      aArmL: { w: 0.09, end: 'vArmL', pts: [...ARTERIES.lSubclavian.pts, ...(limbs.aArmL || []).slice(1)] },
    };
    for (const [k, a] of Object.entries(artDefs)) { this.arts[k] = { kind: 'artery', line: L(a.pts), end: a.end, w: a.w, name: k }; this.artW.push([k, a.w]); }
    // lung capillary beds: hilum -> lobe -> terminal (out), terminal -> lobe -> pulmonary vein (back)
    this.lungIn = { R: [], L: [] }; this.lungOut = { R: [], L: [] }; this.airLines = { R: [], L: [] };
    for (const side of ['R', 'L']) {
      LOBES[side].forEach((lobe, li) => {
        const ins = [], outs = [], airs = [];
        for (let t = 0; t < 3; t++) {
          const sx = side === 'R' ? -1 : 1, r = (k) => (rand(li * 31 + t * 7 + k + (side === 'R' ? 0 : 99)) - 0.5);
          const term = [lobe[0] + sx * Math.abs(r(1)) * 0.035 + r(4) * 0.01, lobe[1] + r(2) * 0.035, lobe[2] + r(3) * 0.04];
          const mid = [(HILUM[side][0] + lobe[0]) / 2, (HILUM[side][1] + lobe[1]) / 2 + 0.004, (HILUM[side][2] + lobe[2]) / 2];
          ins.push({ kind: 'lung', line: L([HILUM[side], mid, lobe, term]) });
          outs.push({ kind: 'pv', line: L([term, [lobe[0] * 0.9, lobe[1] + 0.006, lobe[2]], ...PULM_VEIN[side]]) });
          airs.push(L([...AIRWAY.trachea, ...AIRWAY[side].slice(1), [mid[0], mid[1] - 0.004, mid[2]], lobe, term]));
        }
        this.lungIn[side].push(ins); this.lungOut[side].push(outs); this.airLines[side].push(airs);
      });
    }
  }

  pickVein(seed) {
    let r = rand(seed * 1.31 + 0.5), acc = 0;
    for (const [k, w] of this.artW) { acc += w; if (r <= acc) return this.arts[k].end; }
    return 'vLegR';
  }
  pickArtery(seed) {
    let r = rand(seed), acc = 0;
    for (const [k, w] of this.artW) { acc += w; if (r <= acc) return this.arts[k]; }
    return this.arts.aLegR;
  }
  startVenous(c, vein) { c.seg = this.veins[vein]; c.stage = 'vein'; c.s = 0; c.oxy = 0; }

  advanceSegment(c) {
    c.s = 0;
    switch (c.stage) {
      case 'vein': c.stage = 'rhIn'; c.seg = this.rhIn; break;
      case 'rhIn': c.stage = 'rhOut'; c.seg = this.rhOut; break;
      case 'rhOut': c.side = Math.random() < 0.55 ? 'R' : 'L'; c.stage = 'pa'; c.seg = this.pa[c.side]; break;
      case 'pa': c.lobe = Math.floor(Math.random() * 3); c.term = Math.floor(Math.random() * 3); c.stage = 'lungIn'; c.seg = this.lungIn[c.side][c.lobe][c.term]; break;
      case 'lungIn': c.stage = 'lungOut'; c.seg = this.lungOut[c.side][c.lobe][c.term]; break;
      case 'lungOut': c.stage = 'lhIn'; c.seg = this.lhIn; break;
      case 'lhIn': c.stage = 'lhOut'; c.seg = this.lhOut; break;
      case 'lhOut': c.art = this.pickArtery(Math.random()); c.stage = 'artery'; c.seg = c.art; break;
      case 'artery': c.stage = 'tissue'; c.seg = null; c.wait = 0.3 + Math.random() * 0.6; break; // capillary bed
      case 'tissue': this.startVenous(c, c.art ? c.art.end : 'vLegR'); break;
    }
  }

  speed(kind, p, phys) {
    const sys = p > 0.12 && p < 0.46;
    const out = phys.output; // 0 in cardiac arrest
    let v;
    switch (kind) {
      case 'vein': v = 0.07 * (sys ? 0.8 : 1.15); break;
      case 'av': v = sys ? 0.004 : 0.075; break;            // AV valves open in diastole
      case 'out': v = sys ? 0.17 : 0.0; break;              // semilunar valves open in systole
      case 'artery': v = sys ? 0.2 : 0.07; break;
      case 'lung': v = 0.045; break;
      case 'pv': v = 0.05; break;
      default: v = 0.05;
    }
    return v * out * (phys.hr / 72);
  }

  setVisible(on) { this.group.visible = on; }
  setMode(blood, air) { this.showBlood = blood; this.showAir = air; this.blood.visible = blood; this.air.visible = air; this.group.visible = blood || air; }

  update(dt, phys, camera) {
    if (!this.group.visible) return;
    if (camera) { const d = camera.position.distanceTo(this.hc); this._s.setScalar(THREE.MathUtils.clamp(d / 0.45, 0.5, 5)); }
    const p = phys.cardiacPhase, sq = 1 - 0.07 * phys.systole;
    const col = phys.collapse;
    // ---- blood ----
    for (let i = 0; i < this.N; i++) {
      const c = this.cells[i];
      if (c.stage === 'tissue') {
        c.wait -= dt * phys.output; if (c.wait <= 0) this.advanceSegment(c);
        this._m.makeScale(0, 0, 0); this.blood.setMatrixAt(i, this._m); continue;
      }
      // in the lungs, oxygen uptake depends on whether that lung is ventilated
      if (c.stage === 'lungIn') c.oxy = Math.min(1 - 0.85 * col[c.side], c.oxy + dt * 0.25);
      if (c.stage === 'artery' && c.s > c.seg.line.length * 0.7) c.oxy = Math.max(0, c.oxy - dt * 0.3);
      c.s += this.speed(c.seg.kind, p, phys) * dt * (0.85 + 0.3 * rand(i));
      if (c.s >= c.seg.line.length) this.advanceSegment(c);
      if (!c.seg) { this._m.makeScale(0, 0, 0); this.blood.setMatrixAt(i, this._m); continue; }
      const v = c.seg.line.at(c.s, this._v);
      // spread across the vessel / chamber instead of single file: wide in the heart, narrower in the great vessels,
      // thin out in the limbs; cells circle slowly in the chambers
      const dh0 = v.distanceTo(this.hc), k = c.seg.kind;
      const R = k === 'av' ? 0.0065 : k === 'out' ? 0.0055 : dh0 < 0.09 ? 0.0032 : dh0 < 0.25 ? 0.0018 : 0.0009;
      c.th += c.w * dt * (k === 'av' || k === 'out' ? 1 : 0.25);
      addEddy(c, R, v);
      // ride along with the beating heart and the collapsing lung
      const dh = v.distanceTo(this.hc);
      if (dh < 0.07) v.sub(this.hc).multiplyScalar(THREE.MathUtils.lerp(sq, 1, dh / 0.07)).add(this.hc);
      if (c.stage === 'lungIn' || c.stage === 'lungOut') v.lerp(this.hilum[c.side], 0.36 * col[c.side]);
      this._m.compose(v, this._q, this._s); this.blood.setMatrixAt(i, this._m);
      this._c.copy(DEOXY).lerp(OXY, c.oxy); this.blood.setColorAt(i, this._c);
    }
    this.blood.instanceMatrix.needsUpdate = true; this.blood.instanceColor.needsUpdate = true;
    // ---- air (tidal: in on inspiration, out on expiration) ----
    const inh = phys.inhale;
    for (let i = 0; i < this.NA; i++) {
      const a = this.puffs[i];
      const reach = inh * (1 - col[a.side]) * (phys.output > 0 ? 1 : 0.2);
      const u = a.d - (1 - reach) * 1.02;
      if (u <= 0.01) { this._m.makeScale(0, 0, 0); this.air.setMatrixAt(i, this._m); continue; }
      const v = a.line.at(u * a.line.length, this._v);
      if (u > 0.35) v.lerp(this.hilum[a.side], 0.36 * col[a.side]);
      this._m.compose(v, this._q, this._s); this.air.setMatrixAt(i, this._m);
    }
    this.air.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Flow through the open chambers of the cross-section heart ----------
// Chamber points were taken from a measured front render of the cut heart and placed between the cut plane and the
// back wall of each chamber (assets/anatomy_extra.json -> cutflow), so the cells travel inside the visible cavities.
// Heart view: a dense population that only cycles through the heart and the first ~1 cm of the vessels attached to it
// (SVC/IVC and pulmonary veins in; pulmonary arteries and aorta out), filling the chambers in 3D.
export class HeartFlow {
  constructor(scene, circ) {
    this.hc = circ.hc;
    const tail = (pts, len) => { const l = new Line(pts); return new Line(Array.from({ length: 12 }, (_, i) => l.at(l.length - len + len * i / 11, new THREE.Vector3()))); };
    const head = (pts, len) => { const l = new Line(pts); return new Line(Array.from({ length: 12 }, (_, i) => l.at(len * i / 11, new THREE.Vector3()))); };
    const seg = (line, kind, r0, r1 = r0) => ({ line, kind, r0, r1 });
    this.segs = {
      svc: seg(tail(VEINS.rJugular.pts, 0.045), 'vein', 0.0035), ivc: seg(tail(VEINS.ivc.pts, 0.035), 'vein', 0.004),
      pvR: seg(tail(PULM_VEIN.R, 0.035), 'vein', 0.003), pvL: seg(tail(PULM_VEIN.L, 0.035), 'vein', 0.003),
      rhIn: seg(new Line(RIGHT_HEART.inflow), 'av', 0.006, 0.0075), rhOut: seg(new Line(RIGHT_HEART.outflow), 'out', 0.0075, 0.0045),
      lhIn: seg(new Line(LEFT_HEART.inflow), 'av', 0.0055, 0.0075), lhOut: seg(new Line(LEFT_HEART.outflow), 'out', 0.007, 0.0045),
      paR: seg(head(PULM_ART.R, 0.04), 'artery', 0.0035), paL: seg(head(PULM_ART.L, 0.04), 'artery', 0.0035),
      aorta: seg(head(ARTERIES.descending.pts, 0.07), 'artery', 0.0045),
    };
    this.routes = { R: [['svc', 'ivc'], 'rhIn', 'rhOut', ['paR', 'paL']], L: [['pvR', 'pvL'], 'lhIn', 'lhOut', ['aorta']] };
    const N = this.N = 900;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0007, 1), new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: 0x1a0000 }), N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
    const col = new THREE.Color();
    this.cells = Array.from({ length: N }, (_, i) => {
      const c = eddy({ side: i % 2 ? 'L' : 'R', sp: 0.55 + Math.random() * 0.9, sc: 0.75 + Math.random() * 0.5 });
      this.spawn(c, true);
      col.copy(c.side === 'L' ? OXY : DEOXY).offsetHSL((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.12); this.mesh.setColorAt(i, col);
      return c;
    });
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3();
    this.prev = new Float32Array(N * 3);
  }
  pick(c) { const r = this.routes[c.side][c.k]; return Array.isArray(r) ? r[Math.floor(Math.random() * r.length)] : r; }
  spawn(c, scatter) { c.k = scatter ? Math.floor(Math.random() * 4) : 0; c.key = this.pick(c); c.f = scatter ? Math.random() : 0; c.jump = true; }
  speed(kind, f, p, phys) {
    const sys = p > 0.12 && p < 0.46;
    const v = kind === 'vein' ? 0.03 : kind === 'av' ? (sys ? 0.003 : 0.05) : kind === 'out' ? (sys ? 0.11 : (f > 0.75 ? 0.01 : 0.0015)) : (sys ? 0.12 : 0.03);
    return v * phys.output * (phys.hr / 72);
  }
  update(dt, phys) {
    if (!this.mesh.visible || dt <= 0) return;
    const p = phys.cardiacPhase, sys = p > 0.12 && p < 0.46, sq = 1 - 0.07 * phys.systole, v = this._v;
    for (let i = 0; i < this.N; i++) {
      const c = this.cells[i]; let g = this.segs[c.key];
      c.f += this.speed(g.kind, c.f, p, phys) * c.sp * dt / g.line.length;
      if (c.f >= 1) { c.k++; if (c.k > 3) this.spawn(c, false); else { c.key = this.pick(c); c.f = 0; } g = this.segs[c.key]; }
      // slow, chamber-wide turning (all cells the same way per side) instead of each cell jittering on its own
      c.th += (c.side === 'R' ? 1 : -1) * Math.abs(c.w) * 0.3 * dt * (g.kind === 'av' ? (sys ? 0.5 : 1.1) : g.kind === 'out' ? (sys ? 0.4 : 0.8) : 0);
      g.line.at(c.f * g.line.length, v);
      addEddy(c, g.r0 + (g.r1 - g.r0) * c.f, v);
      const dh = v.distanceTo(this.hc);
      if (dh < 0.07) v.sub(this.hc).multiplyScalar(THREE.MathUtils.lerp(sq, 1, dh / 0.07)).add(this.hc);
      streak(this, i, c, v, dt);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Blood inside the cut-open heart ----------
// The flow is confined to the model's real hollow spaces. Offline (tools/cutflow_build.py) the cut heart was voxelised at
// 1 mm and every voxel inside a chamber or great vessel was labelled (right/left atrium, right/left ventricle, pulmonary
// trunk, aorta). Inside every chamber the incompressible-flow (potential) equations were then solved twice: for
// diastole (the ventricle fills from the AV valve and the blood spreads through the whole chamber; the atrium empties
// while the veins keep running) and for systole (the ventricle's blood converges on the outflow valve, about 55% of it
// leaving; the atrium refills from the veins behind the shut valve). Cells are carried by those fields
// (assets/cutflow.json), so they travel venae cavae -> right atrium -> tricuspid valve -> right ventricle -> pulmonary
// valve -> pulmonary trunk, and pulmonary veins -> left atrium -> mitral valve -> left ventricle -> aortic valve -> aorta,
// and because the fields are divergence-free the blood stays evenly spread instead of bunching on one streamline.
// A cell may never step into a voxel that is not blood space, so it cannot cross a wall or the septum.
// Valves are one-way gates driven by the model's own beat: while the ventricles are contracting the semilunar valves
// are open and the AV valves shut (blood pools in the atria); while they relax it is the other way round.
// Positions are kept in the rest pose and drawn displaced by the beating walls, so the blood rides the heartbeat.
const CUT_OXY = new THREE.Color(0xd4001a); // deep crimson: reads against the pale inner walls
const RA = 1, RV = 2, PAR = 3, LA = 4, LV = 5, AOR = 6;
function b64(str, T) { const bin = atob(str), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); }
export class CutawayFlow {
  constructor(model, D, userPaths) {
    this.model = model;
    const [X, Y, Z] = D.dim; this.X = X; this.Y = Y; this.Z = Z; this.h = D.h; this.lo = D.lo; this.XY = X * Y;
    const idx = b64(D.idx, Uint32Array); this.B = b64(D.B, Uint8Array); this.W = b64(D.W, Uint8Array); this.reg = b64(D.reg, Uint8Array);
    // solved velocity fields: direction (int8 x3) + speed (sqrt-coded byte) for diastole (D) and systole (S)
    // great arteries: centreline from the valve to the vessel's open end, with the local radius (voxels)
    this.art = {};
    for (const side of ['R', 'L']) {
      const a = D.arteries[side], P = a.pts, len = [0];
      for (let q = 1; q < P.length; q++) len.push(len[q - 1] + Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1], P[q][2] - P[q - 1][2]));
      this.art[side] = { P, R: a.r, len, L: len[len.length - 1] };
    }
    // the route blood follows (it only ever moves forward on it): in the atria toward the AV valve (falling A, distance
    // to that valve); in the ventricles away from the AV valve while they fill (rising A) and toward the outflow valve
    // while they eject (falling B, distance to the artery's open end). Geodesic distances have no false minima, so no
    // cell can be trapped by the rule.
    if (D.A) { const A = b64(D.A, Uint8Array), Bd = b64(D.B, Uint8Array); this.FA = Float32Array.from(A); this.FB = Float32Array.from(Bd); this.Q = true; this.maxA = D.maxA;
      // ventricles: one progress value along the U-shaped route (0 at the AV valve, 1 at the outflow valve), so blood
      // goes in along the free wall, round the apex and up to the outflow, the same way in every phase
      this.FP = new Float32Array(A.length);
      // harmonic potential solved offline (0 at the AV valve, 1 at the outflow valve, no flow through the walls): it has
      // no false peaks, so a cell climbing it can never be trapped
      if (D.Ul) { const Ul = b64(D.Ul, Float32Array); for (let i = 0; i < A.length; i++) this.FP[i] = Math.max(Ul[i], -20) * 20; } // log scale: the far apex keeps a usable slope
      else if (D.U) { const Uu = b64(D.U, Uint16Array); for (let i = 0; i < A.length; i++) this.FP[i] = Uu[i] / 655.35; }
      else for (let i = 0; i < A.length; i++) this.FP[i] = A[i] / Math.max(1, A[i] + Bd[i]) * 100;
      // the right ventricle leaves through its own outflow tract, right under the pulmonary valve (not through the
      // muscle): cells reaching it while the valve is open join the pulmonary stream there
      this.Ex = D.Ex ? b64(D.Ex, Uint8Array) : null;
      // right ventricle in two legs: in through the tricuspid valve and down the free wall to the apex (R1), then up
      // along the septum to the outflow tract (R2). Each cell remembers whether it has turned at the apex.
      if (D.R1) { this.FR1 = b64(D.R1, Float32Array); this.FR2 = b64(D.R2, Float32Array); this.Az = b64(D.Az, Uint8Array); } }
    this.dD = b64(D.dD, Int8Array); this.mD = b64(D.mD, Uint8Array); this.dS = b64(D.dS, Int8Array); this.mS = b64(D.mS, Uint8Array); this.cap = D.cap;
    this.cell = new Int32Array(X * Y * Z).fill(-1);
    for (let i = 0; i < idx.length; i++) this.cell[idx[i]] = i;
    this.idx = idx;
    // spawn pools: every voxel of each side (even start) and the voxels at each inlet mouth (recycling)
    this.pool = { R: [], L: [] }; this.inlet = { R: [], L: [] }; this.inletM = { R: [], L: [] };
    const near = (i, p, r) => { const x = idx[i] % X, y = Math.floor(idx[i] / X) % Y, z = Math.floor(idx[i] / this.XY); return (x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2 <= r * r; };
    for (let i = 0; i < idx.length; i++) {
      const r = this.reg[i], side = r <= 3 ? 'R' : 'L'; this.pool[side].push(i);
      if (r === RA || r === LA) for (const m of D.inlets[side]) if (near(i, m, 5)) { this.inlet[side].push(i); this.inletM[side].push(m); break; }
    }
    // chamber centres (for the slow chamber vortex)
    this.cen = []; const sum = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    for (let i = 0; i < idx.length; i++) { const s = sum[this.reg[i]]; s[0] += idx[i] % X; s[1] += Math.floor(idx[i] / X) % Y; s[2] += Math.floor(idx[i] / this.XY); s[3]++; }
    this.cen = sum.map(s => s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : [0, 0, 0]);
    // each vein mouth's outward direction (from the atrium's centre through the mouth): returning blood is shown
    // arriving along the vein from a few millimetres outside the heart before it enters the atrium
    this.inletDir = {};
    for (const side of ['R', 'L']) { const c = this.cen[side === 'R' ? RA : LA]; this.inletDir[side] = this.inletM[side].map(m => { const d = [m[0] - c[0], m[1] - c[1], m[2] - c[2]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l, d[2] / l]; }); }
    // where the model's (static) valve leaflets were opened to let blood through: cells fade out while crossing them,
    // so they never show through a leaflet; and each voxel's distance to the nearest real surface, to keep the drawn
    // spheres off the walls and the muscle bands
    this.Hz = D.Hz ? b64(D.Hz, Uint8Array) : null; this.Sd = D.Sd ? Float32Array.from(b64(D.Sd, Uint8Array), q => q / 20) : null; this.Td = D.Td ? Float32Array.from(b64(D.Td, Uint8Array), q => q / 20) : null; this.g3 = [0, 0, 0];
    this.buildLattice();
    // Paths drawn by hand in tools/flow_editor.html (assets/flowpaths_user.json): when one is enabled, blood in that
    // ventricle follows it exactly (inside its width) from the inflow valve to the outflow valve.
    this.up = {};
    for (const [side, key] of [['R', 'RV'], ['L', 'LV']]) {
      const u = userPaths && userPaths[key]; if (!u || !u.enabled || !u.pts || u.pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(u.pts.map(p => new THREE.Vector3(...p)), false, 'centripetal'), len = curve.getLength();
      const samp = []; for (let q = 0; q <= 120; q++) samp.push(curve.getPointAt(q / 120));
      // where the drawn path ends, the cell joins the artery's centreline stream at its nearest point
      const end = u.pts[u.pts.length - 1], ev = [(end[0] - this.lo[0]) / this.h, (end[1] - this.lo[1]) / this.h, (end[2] - this.lo[2]) / this.h], A = this.art[side];
      let bq = 0, bd = Infinity; A.P.forEach((q, j) => { const d = (q[0] - ev[0]) ** 2 + (q[1] - ev[1]) ** 2 + (q[2] - ev[2]) ** 2; if (d < bd) { bd = d; bq = j; } });
      this.up[side] = { curve, len, r: u.r && u.r.length === u.pts.length ? u.r : u.pts.map(() => 0.0025), samp, sJoin: A.len[bq] / A.L };
    }
    this._t = new THREE.Vector3(); this._n = new THREE.Vector3(); this._b = new THREE.Vector3(); this._u = new THREE.Vector3();
    const N = this.N = 3200;
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.00068, 1), new THREE.MeshStandardMaterial({ roughness: 0.35, emissive: 0x2a0606 }), N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.visible = false;
    model.add(this.mesh);
    this.pos = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.prev = new Float32Array(N * 3);
    this.cells = [];
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 'L' : 'R', c = { side, sp: 0.75 + Math.random() * 0.5, sc: 0.8 + Math.random() * 0.4, jump: true, e: [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5] };
      this.place(i, this.pool[side][Math.floor(Math.random() * this.pool[side].length)]); this.cells.push(c);
      col.copy(side === 'L' ? CUT_OXY : DEOXY).offsetHSL((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.1); this.mesh.setColorAt(i, col);
    }
    for (let i = 0; i < N; i++) { const v = this.at(Math.floor(this.pos[i * 3]), Math.floor(this.pos[i * 3 + 1]), Math.floor(this.pos[i * 3 + 2])); const r = v >= 0 ? this.reg[v] : 0; if (r === PAR || r === AOR) this.cells[i].tube = this.tubeCell(this.cells[i], Math.random()); }
    this._d = new THREE.Vector3(); this._p = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3();
    this.speedUp = 3.2; this.phaseT = 0; this.wasEject = false; this.durS = 0.28; this.durD = 0.5; this.c0 = 0; this.cRate = 0; this.cMin = 0; this.cMax = 0; this.eject = false; this.g = [0, 0, 0]; this.g2 = [0, 0, 0]; this.kA = 0.3; this.kVs = 2.6; this.kVd = 1;
  }
  // a cell that left through a great artery comes back through one of the veins of the same side
  respawn(i, cl) {
    const pl = this.inlet[cl.side], k = Math.floor(Math.random() * pl.length);
    this.place(i, pl[k]); cl.jump = true; cl.pre = 6 + Math.random() * 6; cl.preDir = this.inletDir[cl.side][k]; cl.vis = 0;
  }
  // which way is forward for blood in voxel v: atria toward the AV valve; ventricles away from the AV valve only while
  // the blood is still in the inflow half (the entering stream runs down the free wall), and from there on toward the
  // outflow valve in every phase, so blood that has turned the corner keeps rising toward the outflow tract instead of
  // being sent back down to the apex in each diastole (which made it loop in place)
  towardExit(v, r, eject) { return false; }
  routeField(r) { return r === RV || r === LV ? this.FP : r === PAR || r === AOR ? this.FB : this.FA; }
  routeFor(r, cl) { return r === RV && this.FR1 ? (cl.turned ? this.FR2 : this.FR1) : this.routeField(r); }
  routeSign(r) { return r === RV || r === LV ? 1 : -1; }
  place(i, v) {
    const k = i * 3, li = this.idx[v];
    this.pos[k] = li % this.X + Math.random(); this.pos[k + 1] = Math.floor(li / this.X) % this.Y + Math.random(); this.pos[k + 2] = Math.floor(li / this.XY) + Math.random();
    this.vel[k] = this.vel[k + 1] = this.vel[k + 2] = 0;
    const r = this.reg[v]; if (this.cells && this.cells[i]) this.cells[i].tube = (r === PAR || r === AOR) ? this.tubeCell(this.cells[i], Math.random()) : null;
  }
  // a cell inside a great artery: position along the centreline (0..1) and a fixed spot in the vessel's cross-section
  tubeCell(c, s) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * 0.8; return { s, ox: Math.cos(a) * rr, oy: Math.sin(a) * rr }; }
  // centreline point + cross-section offset, in voxel coordinates
  tubeAt(side, t, out) {
    const A = this.art[side], d = t.s * A.L; let q = 1; while (q < A.len.length - 1 && A.len[q] < d) q++;
    const f = (d - A.len[q - 1]) / Math.max(1e-6, A.len[q] - A.len[q - 1]), P0 = A.P[q - 1], P1 = A.P[q];
    const tx = P1[0] - P0[0], ty = P1[1] - P0[1], tz = P1[2] - P0[2], tl = Math.hypot(tx, ty, tz) || 1;
    // two axes across the vessel
    let ax = -ty / tl, ay = tx / tl, az = 0, al = Math.hypot(ax, ay); if (al < 0.2) { ax = 0; ay = -tz / tl; az = ty / tl; al = Math.hypot(ay, az); }
    ax /= al; ay /= al; az /= al;
    const bx = (ty * az - tz * ay) / tl, by = (tz * ax - tx * az) / tl, bz = (tx * ay - ty * ax) / tl;
    const r = Math.max(Math.min(A.R[q - 1], A.R[q]) * 0.8, A.R[q - 1] + (A.R[q] - A.R[q - 1]) * Math.min(1, f));
    out[0] = P0[0] + tx * f + (ax * t.ox + bx * t.oy) * r; out[1] = P0[1] + ty * f + (ay * t.ox + by * t.oy) * r; out[2] = P0[2] + tz * f + (az * t.ox + bz * t.oy) * r;
    return out;
  }
  at(x, y, z) { return x < 0 || y < 0 || z < 0 || x >= this.X || y >= this.Y || z >= this.Z ? -1 : this.cell[x + this.X * (y + this.Y * z)]; }
  // gradient of a field (central differences inside the same side's blood space), in voxels
  grad(F, x, y, z, v, side, out, onlyReg) {
    const f0 = F[v], g = (dx, dy, dz) => { const n = this.at(x + dx, y + dy, z + dz); return n >= 0 && (onlyReg ? this.reg[n] === onlyReg : (this.reg[n] <= 3) === side) ? F[n] : f0; };
    out[0] = g(1, 0, 0) - g(-1, 0, 0); out[1] = g(0, 1, 0) - g(0, -1, 0); out[2] = g(0, 0, 1) - g(0, 0, -1);
    const l = Math.hypot(out[0], out[1], out[2]); if (l > 0) { out[0] /= l; out[1] /= l; out[2] /= l; }
    return out;
  }

  // Coarse lattice (5 mm) tied to the wall vertices around each node (nearest vertex in each of 8 octants, weighted by
  // 1/d^2): gives a smooth displacement field inside the cavities that follows the beating walls.
  buildLattice() {
    const S = this.S = 5, X = this.X, Y = this.Y, Z = this.Z, nx = this.nx = Math.ceil(X / S) + 1, ny = this.ny = Math.ceil(Y / S) + 1, nz = this.nz = Math.ceil(Z / S) + 1;
    const active = new Uint8Array(nx * ny * nz), vent = new Uint8Array(nx * ny * nz);
    for (let i = 0; i < this.idx.length; i++) {
      const li = this.idx[i], x = Math.floor((li % X) / S), y = Math.floor((Math.floor(li / X) % Y) / S), z = Math.floor(Math.floor(li / this.XY) / S), r = this.reg[i];
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) { const n = (x + a) + nx * ((y + b) + ny * (z + c)); active[n] = 1; if (r === RV || r === LV) vent[n] = 1; }
    }
    this.meshes = []; this.model.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry.morphAttributes.position) this.meshes.push(o); });
    this.model.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(this.model.matrixWorld).invert();
    this.rels = this.meshes.map(m => new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    // all wall vertices in voxel coordinates
    const vx = [], v = new THREE.Vector3();
    this.meshes.forEach((m, mi) => { const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i += 2) { v.fromBufferAttribute(P, i).applyMatrix4(this.rels[mi]); vx.push((v.x - this.lo[0]) / this.h, (v.y - this.lo[1]) / this.h, (v.z - this.lo[2]) / this.h, mi, i); } });
    this.nodes = []; this.nodeOf = new Int32Array(nx * ny * nz).fill(-1);
    const used = new Map(); this.bv = []; // unique bound vertices [mi, vi]
    let cx = 0, cy = 0, cz = 0, cn = 0;
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const n = x + nx * (y + ny * z); if (!active[n]) continue;
      const px = x * S, py = y * S, pz = z * S, best = new Float64Array(8).fill(1e9), bi = new Int32Array(8).fill(-1);
      for (let k = 0; k < vx.length; k += 5) {
        const dx = vx[k] - px, dy = vx[k + 1] - py, dz = vx[k + 2] - pz, d = dx * dx + dy * dy + dz * dz, o = (dx > 0 ? 1 : 0) | (dy > 0 ? 2 : 0) | (dz > 0 ? 4 : 0);
        if (d < best[o]) { best[o] = d; bi[o] = k; }
      }
      const b = [], w = []; let ws = 0;
      for (let o = 0; o < 8; o++) if (bi[o] >= 0 && best[o] < 40 * 40) {
        const key = vx[bi[o] + 3] * 1e6 + vx[bi[o] + 4]; let u = used.get(key); if (u === undefined) { u = this.bv.length / 2; used.set(key, u); this.bv.push(vx[bi[o] + 3], vx[bi[o] + 4]); }
        const wt = 1 / (best[o] + 4); b.push(u); w.push(wt); ws += wt;
      }
      this.nodeOf[n] = this.nodes.length;
      this.nodes.push({ b, w: w.map(q => q / ws), p: [px, py, pz], vent: vent[n] });
      if (vent[n]) { cx += px; cy += py; cz += pz; cn++; }
    }
    this.vc = [cx / cn, cy / cn, cz / cn];
    this.bd = new Float32Array(this.bv.length / 2 * 3); this.nd = new Float32Array(this.nodes.length * 3);
    this.base = new Float32Array(this.bd.length);
    for (let u = 0; u < this.bv.length / 2; u++) { const mi = this.bv[u * 2], vi = this.bv[u * 2 + 1]; v.fromBufferAttribute(this.meshes[mi].geometry.attributes.position, vi).applyMatrix4(this.rels[mi]); this.base[u * 3] = v.x; this.base[u * 3 + 1] = v.y; this.base[u * 3 + 2] = v.z; }
  }
  // wall displacement now (model metres) at every lattice node; returns the ventricles' contraction (mean inward motion)
  follow() {
    const v = this._p, bd = this.bd;
    for (let u = 0; u < bd.length / 3; u++) {
      const mi = this.bv[u * 2], vi = this.bv[u * 2 + 1], mesh = this.meshes[mi], g = mesh.geometry, mt = g.morphAttributes.position, inf = mesh.morphTargetInfluences;
      v.fromBufferAttribute(g.attributes.position, vi);
      for (let k = 0; k < mt.length; k++) if (inf[k]) { v.x += mt[k].getX(vi) * inf[k]; v.y += mt[k].getY(vi) * inf[k]; v.z += mt[k].getZ(vi) * inf[k]; }
      v.applyMatrix4(this.rels[mi]);
      bd[u * 3] = v.x - this.base[u * 3]; bd[u * 3 + 1] = v.y - this.base[u * 3 + 1]; bd[u * 3 + 2] = v.z - this.base[u * 3 + 2];
    }
    let c = 0, cn = 0;
    for (let n = 0; n < this.nodes.length; n++) {
      const nd = this.nodes[n]; let x = 0, y = 0, z = 0;
      for (let q = 0; q < nd.b.length; q++) { const u = nd.b[q] * 3, w = nd.w[q]; x += bd[u] * w; y += bd[u + 1] * w; z += bd[u + 2] * w; }
      this.nd[n * 3] = x; this.nd[n * 3 + 1] = y; this.nd[n * 3 + 2] = z;
      if (nd.vent) { const rx = nd.p[0] - this.vc[0], ry = nd.p[1] - this.vc[1], rz = nd.p[2] - this.vc[2], l = Math.hypot(rx, ry, rz) || 1; c -= (x * rx + y * ry + z * rz) / l; cn++; }
    }
    return cn ? c / cn : 0;
  }
  // trilinear displacement at a voxel-space point
  disp(px, py, pz, out) {
    const S = this.S, fx = px / S, fy = py / S, fz = pz / S, x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz), tx = fx - x0, ty = fy - y0, tz = fz - z0;
    let ox = 0, oy = 0, oz = 0, ws = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
      const x = x0 + a, y = y0 + b, z = z0 + c; if (x >= this.nx || y >= this.ny || z >= this.nz) continue;
      const n = this.nodeOf[x + this.nx * (y + this.ny * z)]; if (n < 0) continue;
      const w = (a ? tx : 1 - tx) * (b ? ty : 1 - ty) * (c ? tz : 1 - tz); ox += this.nd[n * 3] * w; oy += this.nd[n * 3 + 1] * w; oz += this.nd[n * 3 + 2] * w; ws += w;
    }
    if (ws > 0) { out.x = ox / ws; out.y = oy / ws; out.z = oz / ws; } else out.set(0, 0, 0);
    return out;
  }

  update(dt, phys) {
    if (!this.mesh.visible || dt <= 0) return;
    // --- valve state from the model's own contraction ---
    const c = this.follow();
    const rate = (c - this.c0) / dt; this.c0 = c; this.cRate += (rate - this.cRate) * Math.min(1, dt * 14);
    this.cMax = Math.max(c, this.cMax - dt * 0.0002); this.cMin = Math.min(c, this.cMin + dt * 0.0002);
    const amp = this.cMax - this.cMin;
    if (amp > 2e-5) { if (this.cRate > amp * 0.9) this.eject = true; else if (this.cRate < amp * 0.15) this.eject = false; }
    else { const p = phys.cardiacPhase; this.eject = p > 0.12 && p < 0.46; }
    // The fields assume systole lasts 0.28 s and diastole 0.50 s; rescale to the durations this model's beat really has,
    // so that what leaves the ventricle in systole equals what enters in diastole (otherwise blood drifts and piles up).
    this.phaseT += dt;
    if (this.eject !== this.wasEject) { const d = this.phaseT; this.phaseT = 0; if (d > 0.08 && d < 2) { if (this.wasEject) this.durS += (d - this.durS) * 0.5; else this.durD += (d - this.durD) * 0.5; } this.wasEject = this.eject; }
    const eject = this.eject && phys.output > 0.05;
    const k = this.speedUp * phys.output * THREE.MathUtils.clamp(eject ? 0.28 / this.durS : 0.5 / this.durD, 0.4, 2.5), h = this.h, g = this.g, P = this._p, X = this.X, XY = this.XY;
    const ease = 1 - Math.exp(-dt * 12);
    for (let i = 0; i < this.N; i++) {
      const cl = this.cells[i], k3 = i * 3, pos = this.pos, vel = this.vel;
      if (cl.tube) {
        // great artery: carried along the vessel; fast while the valve is open, a slow run-off in diastole
        const A = this.art[cl.side], v0 = (eject ? (cl.side === 'L' ? 4.5 : 3.6) : (cl.side === 'L' ? 1.2 : 1.0)) * phys.output;
        cl.tube.s += v0 * cl.sp * dt / (A.L * h * 20);
        // past the vessel's cut end the stream carries on for ~1 cm (fading out) before the cell is recycled
        const ext = 10 / A.L;
        if (cl.tube.s >= 1 + ext) { this.respawn(i, cl); continue; }
        const sRing = 0;
        cl.vis = cl.tube.s > 1 ? 1 - THREE.MathUtils.smoothstep(cl.tube.s, 1 + ext * 0.35, 1 + ext) : cl.tube.s < sRing ? 0 : Math.min(1, (cl.vis ?? 1) + dt * 6);
        this.tubeAt(cl.side, cl.tube, this.g); pos[k3] = this.g[0]; pos[k3 + 1] = this.g[1]; pos[k3 + 2] = this.g[2];
        this.disp(pos[k3], pos[k3 + 1], pos[k3 + 2], P);
        P.x += this.lo[0] + pos[k3] * h; P.y += this.lo[1] + pos[k3 + 1] * h; P.z += this.lo[2] + pos[k3 + 2] * h;
        streak(this, i, cl, P, dt); continue;
      }
      if (cl.ups) { this.followUserPath(i, cl, dt, phys, eject); continue; }
      if (cl.pre > 0) {
        // still in the vein outside the heart: slide in along the vein towards its mouth
        cl.pre -= 22 * cl.sp * Math.max(0.05, phys.output) * dt * (phys.output > 0.02 ? 1 : 0);
        cl.vis = Math.min(1, 1.2 - cl.pre / 12);
        const pr = Math.max(0, cl.pre), d = cl.preDir;
        this.disp(pos[k3], pos[k3 + 1], pos[k3 + 2], P);
        P.x += this.lo[0] + (pos[k3] + d[0] * pr) * h; P.y += this.lo[1] + (pos[k3 + 1] + d[1] * pr) * h; P.z += this.lo[2] + (pos[k3 + 2] + d[2] * pr) * h;
        streak(this, i, cl, P, dt); continue;
      }
      let x = Math.floor(pos[k3]), y = Math.floor(pos[k3 + 1]), z = Math.floor(pos[k3 + 2]), v = this.at(x, y, z);
      if (v < 0) { this.place(i, this.pool[cl.side][Math.floor(Math.random() * this.pool[cl.side].length)]); cl.jump = true; continue; }
      const r = this.reg[v], right = r <= 3, B = this.B[v] / 3, W = this.W[v] / 10;
      if (r === RV && this.Az) { if (cl.turned === undefined) cl.turned = y < 30; if (this.Az[v]) cl.turned = true; } else if (r !== RV) cl.turned = undefined;
      // leaving through the open end of the great artery: come back in through a vein (the rest of the body is off-stage)
      if ((r === PAR || r === AOR) && B < 2.2) { this.respawn(i, cl); continue; }
      // velocity from the solved field for this phase (voxels/s -> m/s)
      const dir = eject ? this.dS : this.dD, mg = (eject ? this.mS : this.mD)[v] / 255, spd = mg * mg * this.cap * h;
      let tx = dir[v * 3] / 127 * spd, ty = dir[v * 3 + 1] / 127 * spd, tz = dir[v * 3 + 2] / 127 * spd;
      tx *= k; ty *= k; tz *= k;
      // each cell also rides its own slowly wandering eddy, so the blood spreads through the whole cavity instead of
      // collecting on one streamline (weaker in the arteries and during ejection, where the flow is a jet)
      const e = cl.e, wob = dt * 0.8;
      e[0] += (Math.random() - 0.5) * wob; e[1] += (Math.random() - 0.5) * wob; e[2] += (Math.random() - 0.5) * wob;
      const el = Math.hypot(e[0], e[1], e[2]) || 1; e[0] /= el; e[1] /= el; e[2] /= el;
      const ed = (r === PAR || r === AOR ? 0.0 : r === RV || r === LV ? 0.0009 : 0.0025) * k;
      tx += e[0] * ed; ty += e[1] * ed; tz += e[2] * ed;
      // one-way route: whatever part of the motion would carry the cell back along its route is removed, and a gentle
      // forward drift keeps the slow blood by the walls moving on, so nothing sloshes to and fro with the beat
      if (this.Q) {
        const vent = r === RV || r === LV, useB = false, q = this.grad(this.routeFor(r, cl), x, y, z, v, right, this.g2, r);
        if (!vent) { q[0] = -q[0]; q[1] = -q[1]; q[2] = -q[2]; }
        // the voxel route field is noisy in the thin right ventricle: each cell steers by a smoothed heading
        const cq = cl.q || (cl.q = [q[0], q[1], q[2]]), sm = Math.min(1, dt * 7);
        cq[0] += (q[0] - cq[0]) * sm; cq[1] += (q[1] - cq[1]) * sm; cq[2] += (q[2] - cq[2]) * sm;
        const cql = Math.hypot(cq[0], cq[1], cq[2]) || 1; q[0] = cq[0] / cql; q[1] = cq[1] / cql; q[2] = cq[2] / cql;
        // in the ventricles the stream follows the route (in along the free wall, round the apex, up the septum to the
        // outflow valve); the solved field only shapes it, so the blood moves as one coherent stream instead of churning
        const art = r === PAR || r === AOR;
        if (vent || art) { tx *= 0.4; ty *= 0.4; tz *= 0.4; }
        const back = tx * q[0] + ty * q[1] + tz * q[2];
        if (back < 0) { tx -= q[0] * back; ty -= q[1] * back; tz -= q[2] * back; }
        const fd = (art ? (eject ? 0.035 : 0.009) : vent ? (eject ? 0.012 : 0.005) : (eject ? 0.0012 : 0.003)) * k;
        tx += q[0] * fd; ty += q[1] * fd; tz += q[2] * fd;
        // residence balance: the big atria hold blood for most of the beat, the ventricles empty briskly each systole,
        // so the cells spread through the heart in proportion to each chamber's volume instead of piling up
        const rk = vent ? (right ? 2.8 : 1) : art ? 1 : this.kA * (right ? 2.4 : 1); tx *= rk; ty *= rk; tz *= rk;
      }
      // near a wall: drop the part of the motion that heads into it (the stream slides along the wall) and ease away
      if (W < 2.6) {
        this.grad(this.W, x, y, z, v, right, g);
        const into = tx * g[0] + ty * g[1] + tz * g[2], f = Math.min(1, (2.6 - W) / 1.4);
        if (into < 0) { tx -= g[0] * into * f; ty -= g[1] * into * f; tz -= g[2] * into * f; }
        const push = 0.03 * Math.max(0, 1.5 - W); tx += g[0] * push; ty += g[1] * push; tz += g[2] * push;
      }
      vel[k3] += (tx - vel[k3]) * ease; vel[k3 + 1] += (ty - vel[k3 + 1]) * ease; vel[k3 + 2] += (tz - vel[k3 + 2]) * ease;
      // move in sub-steps of under one voxel; a step is refused if it leaves the blood space or passes a shut valve
      let mx = vel[k3] * dt / h, my = vel[k3 + 1] * dt / h, mz = vel[k3 + 2] * dt / h;
      const ns = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(my), Math.abs(mz)) / 0.7)); mx /= ns; my /= ns; mz /= ns;
      let cur = r;
      for (let s = 0; s < ns; s++) {
        const ok = (nx2, ny2, nz2) => {
          const n = this.at(Math.floor(nx2), Math.floor(ny2), Math.floor(nz2)); if (n < 0) return false;
          const q = this.reg[n]; if (q === cur) return true;
          if ((cur === RA && q === RV) || (cur === LA && q === LV)) { if (eject) return false; cur = q; return true; }       // AV valves open in diastole only
          if ((cur === RV && q === PAR && !this.Ex) || (cur === LV && q === AOR)) { if (!eject) return false; cur = q; return true; }    // semilunar valves open in systole only
          return false;                                                                                                       // never backwards, never across the septum
        };
        if (ok(pos[k3] + mx, pos[k3 + 1] + my, pos[k3 + 2] + mz)) { pos[k3] += mx; pos[k3 + 1] += my; pos[k3 + 2] += mz; }
        else if (ok(pos[k3] + mx, pos[k3 + 1], pos[k3 + 2])) { pos[k3] += mx; vel[k3 + 1] *= 0.5; vel[k3 + 2] *= 0.5; }
        else if (ok(pos[k3], pos[k3 + 1] + my, pos[k3 + 2])) { pos[k3 + 1] += my; vel[k3] *= 0.5; vel[k3 + 2] *= 0.5; }
        else if (ok(pos[k3], pos[k3 + 1], pos[k3 + 2] + mz)) { pos[k3 + 2] += mz; vel[k3] *= 0.5; vel[k3 + 1] *= 0.5; }
        else {
          // boxed in by the voxel staircase: hop to the neighbouring blood voxel that lies furthest ahead on the route
          // (or, without a route field, one that lies ahead of the motion)
          let moved = false, bx = 0, by = 0, bz = 0, bq = -Infinity;
          const fx = Math.floor(pos[k3]), fy = Math.floor(pos[k3 + 1]), fz = Math.floor(pos[k3 + 2]), F = this.routeFor(r, cl), sg = this.routeSign(r), q0 = this.Q ? F[v] * sg : 0;
          for (let ax = -1; ax <= 1; ax++) for (let ay = -1; ay <= 1; ay++) for (let az = -1; az <= 1; az++) {
            if (!(ax || ay || az)) continue;
            const n = this.at(fx + ax, fy + ay, fz + az); if (n < 0) continue;
            const q = this.reg[n];
            if (q !== r && !((r === RA && q === RV || r === LA && q === LV) && !eject) && !((r === RV && q === PAR && !this.Ex || r === LV && q === AOR) && eject)) continue;
            const sc = this.Q ? (this.reg[n] === r ? F[n] * sg - q0 : 1) + this.W[n] * 0.02 + Math.random() * 0.3 : (ax * mx + ay * my + az * mz) + Math.random() * 0.01;
            if (sc > bq) { bq = sc; bx = ax; by = ay; bz = az; }
          }
          if (this.stat) this.stat.box[r]++;
          if (bq > (this.Q ? -0.2 : 0) && (bx || by || bz)) {
            const n = this.at(fx + bx, fy + by, fz + bz);
            pos[k3] += (fx + bx + 0.5 - pos[k3]) * 0.6; pos[k3 + 1] += (fy + by + 0.5 - pos[k3 + 1]) * 0.6; pos[k3 + 2] += (fz + bz + 0.5 - pos[k3 + 2]) * 0.6;
            if (this.reg[n] !== r) cur = this.reg[n];
            moved = true;
          }
          if (!moved) { vel[k3] *= 0.3; vel[k3 + 1] *= 0.3; vel[k3 + 2] *= 0.3; }
          break;
        }
      }
      // a cell that has sat in the same voxel for half a second is caught on a muscle band or in a recess: lift it
      // out to the open blood voxel up to 2 mm away that lies furthest along its route, so nothing stays snagged
      const vNow = this.at(Math.floor(pos[k3]), Math.floor(pos[k3 + 1]), Math.floor(pos[k3 + 2]));
      if (vNow === cl.lastV && phys.output > 0.05) cl.stillT = (cl.stillT || 0) + dt; else { cl.stillT = 0; cl.lastV = vNow; }
      if (cl.stillT > 0.5 && this.Q && vNow >= 0 && !cl.tube) {
        const rr = this.reg[vNow], F = this.routeFor(rr, cl), sg = this.routeSign(rr);
        const fx = Math.floor(pos[k3]), fy = Math.floor(pos[k3 + 1]), fz = Math.floor(pos[k3 + 2]); let best = -Infinity, bv = -1, bx = 0, by = 0, bz = 0;
        for (let ax = -2; ax <= 2; ax++) for (let ay = -2; ay <= 2; ay++) for (let az = -2; az <= 2; az++) {
          const n = this.at(fx + ax, fy + ay, fz + az); if (n < 0 || this.reg[n] !== rr) continue;
          const sc = (F[n] - F[vNow]) * sg + this.W[n] * 0.08 + Math.random() * 0.5;
          if (sc > best) { best = sc; bv = n; bx = ax; by = ay; bz = az; }
        }
        if (this.stat) this.stat.snag[rr]++;
        if (bv >= 0) { pos[k3] = fx + bx + 0.3 + Math.random() * 0.4; pos[k3 + 1] = fy + by + 0.3 + Math.random() * 0.4; pos[k3 + 2] = fz + bz + 0.3 + Math.random() * 0.4; cl.stillT = 0; cl.lastV = bv; }
      }
      // through the outflow valve: the blood joins the artery's stream, whose centreline starts right at the ventricle's
      // opening and climbs the outflow tract (in this model the pulmonary valve sits ~2 cm above the opening)
      // entering a ventricle that has a hand-drawn path: from here on the cell follows that path
      if (((cur === RV && r === RA) || (cur === LV && r === LA) || ((r === RV || r === LV) && cur === r && cl.ups === undefined)) && this.up[cl.side]) { this.startUserPath(cl, pos, k3, cur !== r); }
      if (cur === RV && eject && this.Ex) { const ve = this.at(Math.floor(pos[k3]), Math.floor(pos[k3 + 1]), Math.floor(pos[k3 + 2])); if (ve >= 0 && this.Ex[ve] && (cl.turned || !this.FR1)) cur = PAR; }
      if (cur === PAR || cur === AOR) { cl.tube = this.tubeCell(cl, 0); vel[k3] = vel[k3 + 1] = vel[k3 + 2] = 0; }
      // draw: rest position + the walls' displacement there, nudged off any surface it would touch
      let ox = 0, oy = 0, oz = 0; const vd = this.at(Math.floor(pos[k3]), Math.floor(pos[k3 + 1]), Math.floor(pos[k3 + 2]));
      let tv = 1;
      if (vd >= 0) {
        if (this.Hz && this.Hz[vd]) tv = 0;                       // crossing a valve leaflet: hidden behind it
        if (this.FR1 && this.reg[vd] === RV && Math.floor(pos[k3 + 1]) >= 43) tv = 0; // the outflow crevice behind the muscle bar
        // thin tissue (valve leaflets, chordae, trabeculae) moves on its own with each beat; a cell right against it
        // would show through, so it fades out there and shrinks a little close to it
        if (this.Td) { const td = this.Td[vd], nearV = this.FA && this.FA[vd] < 54, h0 = nearV ? 1.2 : 1.0, h1 = nearV ? 2 : 1.6; // leaflets and chords near the AV valve, trabeculae elsewhere
          if (td < h0) tv = 0; else if (td < h1) tv = Math.min(tv, 0.4 + 0.6 * (td - h0) / (h1 - h0)); }
        if (this.Sd && this.Sd[vd] < 1.6) {
          const q = this.grad(this.Sd, Math.floor(pos[k3]), Math.floor(pos[k3 + 1]), Math.floor(pos[k3 + 2]), vd, this.reg[vd] <= 3, this.g3), push = (1.6 - this.Sd[vd]) * 0.45;
          ox = q[0] * push; oy = q[1] * push; oz = q[2] * push; tv = Math.min(tv, 0.8);
        }
      }
      cl.vis = (cl.vis ?? 1) + (tv - (cl.vis ?? 1)) * Math.min(1, dt * 14);
      this.disp(pos[k3], pos[k3 + 1], pos[k3 + 2], P);
      // blood by a wall moves with it; blood in the middle of the cavity barely sways with the beat (it streams on)
      if (vd >= 0 && this.Sd && this.swayDamp !== false) P.multiplyScalar(THREE.MathUtils.clamp(1.25 - 0.14 * this.Sd[vd], 0.3, 1));
      P.x += this.lo[0] + (pos[k3] + ox) * h; P.y += this.lo[1] + (pos[k3 + 1] + oy) * h; P.z += this.lo[2] + (pos[k3 + 2] + oz) * h;
      streak(this, i, cl, P, dt);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // counts per region (for tests and the info panel)
  // put a cell on the hand-drawn path of its side: at the start when it comes through the inflow valve, otherwise at the
  // nearest point of the path (cells already in the ventricle when the path is switched on)
  startUserPath(cl, pos, k3, fromValve) {
    const U = this.up[cl.side]; let s = 0;
    if (!fromValve) { const p = this._u.set(this.lo[0] + pos[k3] * this.h, this.lo[1] + pos[k3 + 1] * this.h, this.lo[2] + pos[k3 + 2] * this.h); let bd = Infinity; U.samp.forEach((q, j) => { const d = q.distanceToSquared(p); if (d < bd) { bd = d; s = j / 120; } }); }
    cl.ups = { s, a: Math.random() * 6.283, rr: Math.sqrt(Math.random()) * 0.85 };
  }
  rDisk(U, s) { const f = s * (U.r.length - 1), i = Math.min(U.r.length - 2, Math.floor(f)), a = f - i; return U.r[i] * (1 - a) + U.r[i + 1] * a; }
  followUserPath(i, cl, dt, phys, eject) {
    const U = this.up[cl.side], k3 = i * 3, P = this._p, h = this.h;
    if (!U) { cl.ups = null; return; }
    // speed along the path: a brisk run while the ventricle ejects, a slow drift while it fills
    const v = (eject ? 0.085 : 0.028) * phys.output * (this.speedUp / 3.2) * cl.sp;
    cl.ups.s += v * dt / Math.max(0.005, U.len);
    if (cl.ups.s >= 1) {
      // out through the outflow valve into the artery's stream (the right one starts at the pulmonary valve ring)
      const sStart = U.sJoin || 0; // join the artery's stream where the drawn path ends
      cl.ups = null; cl.tube = this.tubeCell(cl, sStart); cl.vis = 1; return;
    }
    const s = cl.ups.s, p = U.curve.getPointAt(s, this._u), t = U.curve.getTangentAt(s, this._t);
    const up = Math.abs(t.y) > 0.9 ? this._b.set(1, 0, 0) : this._b.set(0, 1, 0);
    const n = this._n.crossVectors(t, up).normalize(), b = this._b.crossVectors(t, n), r = this.rDisk(U, s) * cl.ups.rr;
    const x = p.x + (n.x * Math.cos(cl.ups.a) + b.x * Math.sin(cl.ups.a)) * r, y = p.y + (n.y * Math.cos(cl.ups.a) + b.y * Math.sin(cl.ups.a)) * r, z = p.z + (n.z * Math.cos(cl.ups.a) + b.z * Math.sin(cl.ups.a)) * r;
    this.pos[k3] = (x - this.lo[0]) / h; this.pos[k3 + 1] = (y - this.lo[1]) / h; this.pos[k3 + 2] = (z - this.lo[2]) / h;
    this.disp(this.pos[k3], this.pos[k3 + 1], this.pos[k3 + 2], P); P.multiplyScalar(0.6);
    P.x += x; P.y += y; P.z += z;
    cl.vis = Math.min(1, (cl.vis ?? 1) + dt * 6);
    streak(this, i, cl, P, dt);
  }
  census() { const n = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < this.N; i++) { if (this.cells[i].tube) { n[this.cells[i].side === 'R' ? PAR : AOR]++; continue; } const v = this.at(Math.floor(this.pos[i * 3]), Math.floor(this.pos[i * 3 + 1]), Math.floor(this.pos[i * 3 + 2])); n[v < 0 ? 0 : this.reg[v]]++; } return n; }
}

// Draw a cell stretched along its motion: a short streak shows which way the blood is going.
const Y_AXIS = new THREE.Vector3(0, 1, 0);
function streak(o, i, c, P, dt) {
  const k3 = i * 3, D = o._d.set(P.x - o.prev[k3], P.y - o.prev[k3 + 1], P.z - o.prev[k3 + 2]), dl = D.length(), vel = dt > 0 ? dl / dt : 0;
  o.prev[k3] = P.x; o.prev[k3 + 1] = P.y; o.prev[k3 + 2] = P.z;
  // cells are drawn as round spheres (no stretching along the motion)
  c.jump = false; o._q.identity(); const vv = c.vis ?? 1; o._s.setScalar(vv < 0.3 ? 0 : c.sc * vv); // no half-faded specks left sitting on a surface
  o._m.compose(P, o._q, o._s); o.mesh.setMatrixAt(i, o._m);
}
