import * as THREE from 'three';
import { BloodFlow } from '../particles.js';

// Coronary angiography and stenting (PCI) of the LAD, in the order it is done in the cath lab:
//   1  guide wire up the aorta to the coronary opening      8  inflate the balloon in the centre of the plaque
//   2  catheter advanced over the wire                      9  deflate and remove the balloon
//   3  guide wire removed                                  10  choose the stent size from the balloon readings
//   4  catheter tip engaged in the coronary opening        11  stent on a new balloon, to the centre of the plaque
//   5  X-ray angiogram with dye: find the plaque           12  inflate to fix the stent, deflate, remove the balloon
//   6  coronary wire across the blockage                   13  remove the catheter
//   7  balloon along the wire to the blockage              14  remove the wire
// Everything moves only when you push or pull it with the precision dial, with your hand tremor. Real failure modes:
// pushing too fast (dissection, plaque rupture), wire down the diagonal branch or out of the end (perforation),
// catheter driven too deep (damping, dissection), balloon or stent off the plaque, over-pressure (rupture, tamponade),
// a stent of the wrong size (malapposition, edge dissection, plaque left uncovered), and the infarct clock.

const R = 0.0021;                 // LAD radius in scene units
const LES = 0.5, BR = 0.3;        // lesion and diagonal-branch positions along the LAD (0..1)
const STEPS = [
  'Guide wire up the aorta to the coronary opening', 'Advance the catheter over the wire', 'Remove the guide wire',
  'Engage the catheter tip in the coronary artery', 'X-ray angiogram: inject dye, find the plaque', 'Coronary wire across the blockage',
  'Balloon along the wire to the blockage', 'Inflate the balloon in the centre of the plaque', 'Deflate and remove the balloon',
  'Choose the stent size', 'Stent on a new balloon to the centre of the plaque', 'Inflate to fix the stent, deflate, remove the balloon',
  'Remove the catheter', 'Remove the wire'];
const STAGES = ['gw', 'cath', 'gwOut', 'engage', 'angio', 'wire', 'balloon', 'inflate', 'balloonOut', 'size', 'stent', 'deploy', 'cathOut', 'wireOut', 'done'];

class Polyline extends THREE.Curve {
  constructor(pts) { super(); this.c = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); }
  getPoint(t, o = new THREE.Vector3()) { return this.c.getPoint(t, o); }
}
// stent struts: zig-zag rings joined by short links, unit radius, unit length along +Y
function stentStruts(rings = 9, crowns = 8) {
  const v = [], P = (a, y) => [Math.cos(a), y, Math.sin(a)];
  for (let r = 0; r < rings; r++) {
    const y0 = -0.5 + r / rings, y1 = y0 + 1 / rings * 0.8;
    for (let c = 0; c < crowns * 2; c++) {
      const a0 = c / (crowns * 2) * Math.PI * 2, a1 = (c + 1) / (crowns * 2) * Math.PI * 2;
      v.push(...P(a0, c % 2 ? y1 : y0), ...P(a1, c % 2 ? y0 : y1));
    }
    if (r < rings - 1) for (let c = 0; c < crowns; c += 2) { const a = (c * 2 + 1) / (crowns * 2) * Math.PI * 2; v.push(...P(a, y1), ...P(a, y1 + 0.2 / rings)); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); return g;
}
// a tube whose radius varies along it (the dye column narrows where the plaque is)
function varTube(curve, uMax, segs, radial, rFn) {
  const pos = [], ind = [], fr = curve.computeFrenetFrames(segs, false), p = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = uMax * i / segs, k = Math.min(segs, Math.round(u * segs)); curve.getPointAt(u, p);
    const N = fr.normals[k], B = fr.binormals[k], r = rFn(u);
    for (let j = 0; j <= radial; j++) { const a = j / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z)); }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; ind.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ind); g.computeVertexNormals(); return g;
}
const pick = a => a[Math.floor(Math.random() * a.length)];

export class StentProcedure {
  constructor(ctx) { this.ctx = ctx; this.active = false; this.name = 'stent'; }

  async start() {
    const { anatomy, ui, scene } = this.ctx;
    if (!this.path) this.path = (await (await fetch('assets/lad_path.json')).json()).lad;
    this.heart = anatomy.heart;
    this.group = new THREE.Group(); this.group.name = 'StentProcedure'; scene.add(this.group);
    const M = (o) => new THREE.MeshStandardMaterial(o);
    this.vesselMat = M({ color: 0xc0262c, roughness: 0.35, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
    this.vessel = new THREE.Mesh(new THREE.BufferGeometry(), this.vesselMat); this.vessel.renderOrder = 6;
    this.branch = new THREE.Mesh(new THREE.BufferGeometry(), this.vesselMat); this.branch.renderOrder = 6;
    this.aorta = new THREE.Mesh(new THREE.BufferGeometry(), M({ color: 0xd04048, roughness: 0.4, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    this.gwire = new THREE.Mesh(new THREE.BufferGeometry(), M({ color: 0xc8d2dc, metalness: 0.9, roughness: 0.25 }));     // guide wire (stage 1-3)
    this.wire = new THREE.Mesh(new THREE.BufferGeometry(), M({ color: 0xe4ecf2, metalness: 0.9, roughness: 0.2 }));       // coronary wire
    this.cath = new THREE.Mesh(new THREE.BufferGeometry(), M({ color: 0x8fb4d5, roughness: 0.45, transparent: true, opacity: 0.85 }));
    this.shaft = new THREE.Mesh(new THREE.BufferGeometry(), M({ color: 0x9fb4c8, roughness: 0.4 }));
    this.plaque = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), M({ color: 0xe9c46a, roughness: 0.8, emissive: 0x3a2a00 }));
    const prof = [[0.12, -0.5], [0.2, -0.44], [1, -0.36], [1, 0.36], [0.2, 0.44], [0.12, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
    this.balloon = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), M({ color: 0x4aa3ff, transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false })); this.balloon.renderOrder = 7;
    this.stent = new THREE.LineSegments(stentStruts(), new THREE.LineBasicMaterial({ color: 0xdfe6ec })); this.stent.renderOrder = 8;
    this.dye = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false })); this.dye.renderOrder = 9;
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(R * 1.6, R * 0.25, 6, 20), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    const ringGeo = new THREE.TorusGeometry(R * 1.4, R * 0.12, 6, 24), ringMat = new THREE.MeshBasicMaterial({ color: 0x3ee08f, transparent: true, opacity: 0.85 });
    this.zoneA = new THREE.Mesh(ringGeo, ringMat); this.zoneB = new THREE.Mesh(ringGeo, ringMat);
    this.group.add(this.vessel, this.branch, this.aorta, this.gwire, this.wire, this.cath, this.shaft, this.plaque, this.balloon, this.stent, this.dye, this.marker, this.zoneA, this.zoneB);
    for (const m of [this.balloon, this.stent, this.marker, this.shaft, this.wire, this.gwire, this.cath, this.dye]) m.visible = false;
    this.flow = new BloodFlow(this.group, R);
    this.bind();
    // the patient: vessel size and lesion length vary from case to case; the balloon measures them
    this.vesselD = pick([2.75, 3.0, 3.5]); this.lesionLen = pick([12, 15, 18]);
    this.mmPer = (this.vesselD / 2) / R;           // scene units -> real millimetres
    // state
    this.gwS = 0; this.catS = 0; this.s = 0; this.inBranch = false; this.sb = 0; this.angle = 0; this.wireAo = 0;
    this.device = null; this.dev = 0; this.pressure = 0; this.deflating = false;
    this.stenosis = 0.85; this.stentR = 0; this.deployed = false; this.diss = 1; this.noReflow = 0; this.stentPick = null; this.measured = null;
    this.perf = null; this.sealT = 0; this.contrast = 0; this.fill = 0; this.injecting = false; this.periCooldown = 0; this.surgeonT = -1; this.done = false;
    this.flags = {}; this.lastActions = ''; this.xray = false; this.found = false; this.flowNow = 0.2; this._opts = null;
    this.active = true;
    anatomy.isolate(['Heart']);
    anatomy.ischemiaUniforms.uIschRadius.value = 0.03;
    // the full angiogram-to-stent sequence has 14 steps: the infarct grows at ~40% of the old rate so a careful operator has time
    this.ctx.phys.damageScale = 0.4;
    this.updateGeometry();
    ui.showProcedure('Coronary angiogram and stent (LAD)', STEPS);
    this.makeReadout();
    this.go('gw');
    this.ctx.phys.log('Patient on the table: access through the radial artery, catheter lab ready');
  }

  // ---------- stages ----------
  go(stage) {
    const { ui } = this.ctx; this.stage = stage; this.lastActions = '';
    ui.setStep(STAGES.indexOf(stage));
    const H = {
      gw: 'Push the guide wire (drag the dial up) up the aorta until its tip reaches the opening of the left coronary artery.',
      cath: 'Advance the catheter over the wire (drag up) to the coronary opening. It cannot pass the tip of the wire.',
      gwOut: 'The catheter is at the opening. Pull the guide wire out (drag down) all the way.',
      engage: 'Gently push only the tip of the catheter into the coronary artery: 2-5 mm. Deeper blocks the artery and can tear it. Then press Confirm.',
      angio: 'X-ray view. Hold "Inject dye": the dark dye fills the artery and shows where the plaque narrows it.',
      wire: 'Push the coronary wire through the catheter down the artery and across the narrowing. Slowly (under ~3 mm/s through the plaque). Rotate the tip AWAY from the diagonal branch.',
      balloon: 'Push the balloon along the wire until it sits between the two green rings, in the centre of the plaque.',
      inflate: 'Hold Inflate to 8-12 atm. The balloon opens the blockage and measures the artery. Above 16 atm it bursts.',
      balloonOut: 'Deflate the balloon, then pull it back out (drag down).',
      size: 'Choose the stent: the same diameter as the measured artery, a few millimetres longer than the plaque.',
      stent: 'The stent is crimped on a new balloon. Push it along the wire to the centre of the plaque (green rings).',
      deploy: 'Hold Inflate to 12-14 atm to open the stent against the wall, then Deflate: the stent stays. Pull the empty balloon out (drag down).',
      cathOut: 'Stent in place. Pull the catheter out (drag down).',
      wireOut: 'Finally pull the wire out (drag down).',
      done: 'Procedure complete.',
    };
    ui.setHint(H[stage]);
    ui.showPad(!['angio', 'size', 'done'].includes(stage), 'Precision dial: drag up to push · down to pull');
    // camera: the aortic root for the catheter work, the whole LAD for the coronary work
    const early = ['gw', 'cath', 'gwOut', 'engage'].includes(stage);
    if (early) this.ctx.focus(this.ost.clone().add(new THREE.Vector3(0, 0.035, 0)), 0.3, new THREE.Vector3(0.35, 0.15, 1));
    else if (stage === 'angio' || stage === 'wire') this.ctx.focus(this.curve.getPointAt(0.45), 0.2, new THREE.Vector3(0.35, 0.15, 1));
    else if (['balloon', 'stent'].includes(stage)) this.ctx.focus(this.curve.getPointAt(LES), 0.13, new THREE.Vector3(0.35, 0.15, 1));
    if (stage === 'angio') this.setXray(true);
    this.updateReadout();
  }

  setXray(on) {
    const { renderer, anatomy } = this.ctx; this.xray = on;
    // fluoroscopy: black-and-white, inverted, so the radio-opaque dye and metal show dark on a pale field
    renderer.domElement.style.filter = on ? 'grayscale(1) invert(1) contrast(1.25) brightness(1.05)' : '';
    const m = anatomy.heart.material;
    if (on) { if (!this._hm) this._hm = { transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }; m.transparent = true; m.opacity = 0.22; m.depthWrite = false; }
    else if (this._hm) { Object.assign(m, this._hm); this._hm = null; }
    m.needsUpdate = true;
    this.lastActions = '';
  }

  // side panel: the readings the stent choice is based on
  makeReadout() {
    const el = document.createElement('div'); el.id = 'stent-readout';
    el.style.cssText = 'position:fixed;right:16px;top:50%;transform:translateY(-50%);width:220px;padding:12px 14px;border-radius:12px;background:rgba(13,17,23,.92);border:1px solid #30363d;color:#e6edf3;font:13px/1.5 system-ui,sans-serif;z-index:30;display:none';
    document.body.append(el); this.readout = el;
  }
  updateReadout() {
    const el = this.readout; if (!el) return;
    const rows = [];
    if (this.found) rows.push(['Angiogram', `${Math.round(this.stenosisFound * 100)}% narrowing, mid LAD`]);
    if (this.measured) rows.push(['Artery diameter', `${this.measured.d.toFixed(2)} mm`], ['Plaque length', `${this.measured.len} mm`], ['Balloon pressure', `${this.measured.atm.toFixed(1)} atm`]);
    if (this.stentPick) rows.push(['Stent chosen', `${this.stentPick.d.toFixed(2)} × ${this.stentPick.len} mm`]);
    el.style.display = rows.length ? '' : 'none';
    el.innerHTML = '<div style="font-weight:600;margin-bottom:6px">Measurements</div>' + rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:8px"><span style="color:#8b949e">${k}</span><b>${v}</b></div>`).join('');
  }

  // ---------- geometry ----------
  bindPoint(pw, nw) {
    const pos = this.heart.geometry.attributes.position, inv = new THREE.Matrix4().copy(this.heart.matrixWorld).invert();
    const pl = pw.clone().applyMatrix4(inv), v = new THREE.Vector3(); let best = 0, bd = Infinity;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const d = v.distanceToSquared(pl); if (d < bd) { bd = d; best = i; } }
    const rest = this.ctx.anatomy.restWorld(this.heart, best);
    if (!nw) nw = new THREE.Vector3().fromBufferAttribute(this.heart.geometry.attributes.normal, best).applyMatrix3(new THREE.Matrix3().getNormalMatrix(this.heart.matrixWorld)).normalize();
    return { vi: best, offset: pw.clone().sub(rest), n: nw.clone() };
  }
  bind() {
    this.anchors = this.path.map(a => this.bindPoint(new THREE.Vector3().fromArray(a.p), new THREE.Vector3().fromArray(a.n).normalize()));
    const rest = new THREE.CatmullRomCurve3(this.path.map(a => new THREE.Vector3().fromArray(a.p)), false, 'centripetal');
    const p0 = rest.getPointAt(BR), t0 = rest.getTangentAt(BR);
    const lat = new THREE.Vector3(1, -0.35, 0.2).normalize(), dirB = t0.clone().multiplyScalar(0.45).add(lat).normalize();
    const pts = [p0.clone()]; let p = p0.clone();
    for (let k = 0; k < 5; k++) { p = p.clone().addScaledVector(dirB, 0.0045); const b = this.bindPoint(p); p = this.ctx.anatomy.restWorld(this.heart, b.vi).clone(); pts.push(p.clone()); }
    this.branchAnchors = pts.slice(1).map(q => this.bindPoint(q));
    this.L0 = rest.getLength(); this.LB0 = new THREE.CatmullRomCurve3(pts, false, 'centripetal').getLength();
    // the route up the aorta to the coronary opening (fixed length, measured once)
    const r0 = rest.getPointAt(0), rt = rest.getTangentAt(0);
    this.aoRest = this.aoPoints(r0, rt); this.La = new THREE.CatmullRomCurve3(this.aoRest, false, 'centripetal').getLength();
  }
  aoPoints(p0, t0) {
    // from far up the aorta (the arm access, off screen) down the ascending aorta to the left coronary opening
    return [p0.clone().add(new THREE.Vector3(-0.02, 0.16, 0.05)), p0.clone().add(new THREE.Vector3(-0.014, 0.09, 0.025)), p0.clone().add(new THREE.Vector3(-0.008, 0.045, 0.01)),
      p0.clone().addScaledVector(t0, -0.014).add(new THREE.Vector3(-0.002, 0.016, 0.005)), p0.clone().addScaledVector(t0, -0.008).add(new THREE.Vector3(0, 0.004, 0.002)), p0.clone()];
  }
  morphed(a) { return this.ctx.anatomy.morphedWorld(this.heart, a.vi).add(a.offset).addScaledVector(a.n, R * 0.9); }

  // a point at distance d along aorta (0..La) then LAD (La..)
  along(d, out = new THREE.Vector3()) {
    if (d <= this.La) return this.aoCurve.getPointAt(THREE.MathUtils.clamp(d / this.La, 0, 1), out);
    return this.curve.getPointAt(THREE.MathUtils.clamp((d - this.La) / this.L0, 0, 0.999), out);
  }
  pathTube(mesh, d0, d1, r, n = 40) {
    const swap = g => { mesh.geometry.dispose(); mesh.geometry = g; };
    if (d1 - d0 < 0.0006) { mesh.visible = false; return; }
    const pts = []; for (let k = 0; k <= n; k++) pts.push(this.along(d0 + (d1 - d0) * k / n));
    swap(new THREE.TubeGeometry(new Polyline(pts), n * 2, r, 6, false)); mesh.visible = true;
  }

  updateGeometry() {
    const swap = (m, g) => { m.geometry.dispose(); m.geometry = g; };
    const pts = this.anchors.map(a => this.morphed(a));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); this.frames = this.curve.computeFrenetFrames(120, false);
    this.ost = pts[0].clone();
    this.aoCurve = new THREE.CatmullRomCurve3(this.aoPoints(pts[0], this.curve.getTangentAt(0)), false, 'centripetal');
    const bp = [this.curve.getPointAt(BR), ...this.branchAnchors.map(a => this.morphed(a))];
    this.bcurve = new THREE.CatmullRomCurve3(bp, false, 'centripetal');
    swap(this.vessel, new THREE.TubeGeometry(this.curve, 90, R, 12, false));
    swap(this.branch, new THREE.TubeGeometry(this.bcurve, 24, R * 0.7, 8, false));
    swap(this.aorta, new THREE.TubeGeometry(this.aoCurve, 40, R * 2.2, 12, false));
    const tr = this.trem || 0, x = this.xray;
    this.vessel.visible = this.branch.visible = !x; this.aorta.visible = !x;
    // guide wire (aorta only)
    if (this.gwS > 0.0005) this.pathTube(this.gwire, 0, Math.min(this.gwS + tr, this.La + 0.004), R * 0.22); else this.gwire.visible = false;
    // catheter: along the aorta, its tip possibly engaged a few mm into the artery
    if (this.catS > 0.0005) this.pathTube(this.cath, 0, this.catS + (['cath', 'engage'].includes(this.stage) ? tr : 0), R * 0.7); else this.cath.visible = false;
    // coronary wire: through the catheter and down the LAD (or the diagonal branch)
    if (this.s > 0.0003 || this.wireAo > 0) {
      const wp = [], end = this.La + Math.min(this.L0 * 0.999, Math.max(0, (this.inBranch ? BR * this.L0 : this.s) + (this.device || this.stage !== 'wire' ? 0 : tr)));
      const start = Math.max(0, this.La - this.wireAo);
      for (let k = 0; k <= 30; k++) wp.push(this.along(start + (end - start) * k / 30));
      if (this.inBranch && this.sb > 0.0003) for (let k = 1; k <= 10; k++) wp.push(this.bcurve.getPointAt(Math.min(1, this.sb / this.LB0) * k / 10));
      swap(this.wire, new THREE.TubeGeometry(new Polyline(wp), 80, R * 0.16, 5, false)); this.wire.visible = true;
    } else this.wire.visible = false;
    // plaque (invisible on X-ray: only the narrowed dye column shows it)
    const q = (uu) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.curve.getTangentAt(uu));
    const lp = this.curve.getPointAt(LES), nrm = this.frames.normals[Math.round(LES * 120)];
    this.plaque.position.copy(lp).addScaledVector(nrm, R * (1 - this.stenosis) * 0.9); this.plaque.quaternion.copy(q(LES));
    this.plaque.scale.set(R * (0.25 + this.stenosis * 0.95), R * 2.8, R * (0.25 + this.stenosis * 0.95)); this.plaque.visible = !x;
    // balloon / stent riding the wire
    const du = THREE.MathUtils.clamp((this.dev + (this.pressure < 0.5 ? tr * 0.5 : 0)) / this.L0, 0, 0.999);
    for (const [ring, k] of [[this.zoneA, -1], [this.zoneB, 1]]) { const zu = LES + k * 0.0025 / this.L0; ring.position.copy(this.curve.getPointAt(zu)); ring.lookAt(ring.position.clone().add(this.curve.getTangentAt(zu))); ring.visible = !!this.device && this.device !== 'delivery' && !x; }
    const onTarget = Math.abs((du - LES) * this.L0) <= 0.0025;
    this.balloon.material.color.set(onTarget ? 0x3ee08f : 0x4aa3ff);
    const sat = this.device === 'balloon' ? 10 : 12;
    const rb = THREE.MathUtils.lerp(R * 0.26, R * 1.0, Math.min(1, this.pressure / sat)) * (this.pressure > 16 ? 1.25 : 1) * (this.device === 'stent' && this.stentPick ? this.stentPick.d / this.vesselD : 1);
    const slen = this.stentPick ? R * 6.2 * this.stentPick.len / this.lesionLen : R * 6.2, blen = this.device === 'balloon' ? R * 6.4 : slen * 1.15;
    const dp = this.curve.getPointAt(du);
    this.balloon.position.copy(dp); this.balloon.quaternion.copy(q(du)); this.balloon.scale.set(rb, blen, rb); this.balloon.visible = !!this.device;
    if (this.device === 'stent') { this.stent.position.copy(dp); this.stent.quaternion.copy(q(du)); this.stentR = rb * 1.06; }
    else if (this.deployed) { this.stent.position.copy(this.curve.getPointAt(this.stentU)); this.stent.quaternion.copy(q(this.stentU)); }
    this.stent.scale.set(this.stentR, slen, this.stentR); this.stent.visible = this.device === 'stent' || this.deployed;
    if (this.device && du > 0.004) { const sp = []; for (let k = 0; k <= 20; k++) sp.push(this.curve.getPointAt(Math.max(0, du - blen * 0.5 / this.L0) * k / 20)); swap(this.shaft, new THREE.TubeGeometry(new Polyline(sp), 40, R * 0.28, 6, false)); this.shaft.visible = true; }
    else this.shaft.visible = false;
    // dye column: fills from the catheter tip downstream, narrowed by the plaque; the stent restores the lumen
    if (this.contrast > 0.02 && this.fill > 0.01) {
      const st = this.stenosis, w = 0.05;
      this.dye.geometry.dispose();
      this.dye.geometry = varTube(this.curve, Math.min(0.999, this.fill), 90, 10, u => R * 0.85 * (1 - st * Math.exp(-(((u - LES) / w) ** 2))) * (0.6 + 0.4 * this.flowNow));
      this.dye.material.opacity = Math.min(1, this.contrast * 1.4); this.dye.visible = true;
    } else this.dye.visible = false;
    if (this.perf) { const pu = this.perf.u, pp = this.perf.branch ? this.bcurve.getPointAt(1) : this.curve.getPointAt(pu); this.marker.position.copy(pp); this.marker.visible = true; this.marker.lookAt(pp.clone().add(this.curve.getTangentAt(Math.min(pu, 1)))); }
    this.ctx.anatomy.ischemiaUniforms.uIschCenter.value.copy(this.curve.getPointAt(0.82));
  }

  perforate(where, rate, branch = false) {
    if (this.perf) return;
    this.perf = { u: where, branch };
    this.ctx.phys.addSource('perforation', { type: 'tamp', rate, persistent: true, label: `CORONARY PERFORATION ${branch ? 'at the end of the diagonal branch' : `at ${Math.round(where * 100)}% of the LAD`}: blood pouring into the pericardium` });
    this.ctx.ui.toast('Perforation!', 'bad');
  }

  // ---------- buttons ----------
  onAction(id) {
    const { phys, ui } = this.ctx;
    if (id === 'confirmEngage' && this.stage === 'engage') { phys.log(`Catheter tip engaged ${(this.engageMm()).toFixed(1)} mm into the left coronary artery`, 'good'); this.go('angio'); }
    if (id === 'xray') this.setXray(!this.xray);
    if (id === 'found' && this.stage === 'angio') { this.go('wire'); }
    if (id === 'rotate') { this.angle = (this.angle + 90) % 360; phys.log(`Wire tip rotated to ${this.angle}°`); }
    if (id === 'loadBalloon' && this.stage === 'balloon' && !this.device) { this.device = 'balloon'; this.dev = 0; this.pressure = 0; phys.log('Balloon catheter loaded on the wire'); }
    if (id === 'deflate') this.deflating = true;
    if (id.startsWith('size:') && this.stage === 'size') {
      const [d, len] = id.slice(5).split('x').map(Number); this.stentPick = { d, len };
      const dd = d - this.vesselD, okD = Math.abs(dd) <= 0.25, okL = len >= this.lesionLen + 2 && len <= this.lesionLen + 10;
      phys.log(`Stent ${d.toFixed(2)} × ${len} mm chosen (artery ${this.vesselD.toFixed(2)} mm, plaque ${this.lesionLen} mm): ${okD && okL ? 'good match' : !okD ? (dd < 0 ? 'UNDERSIZED diameter' : 'OVERSIZED diameter') : len < this.lesionLen + 2 ? 'TOO SHORT to cover the plaque' : 'longer than needed'}`, okD && okL ? 'good' : 'warn');
      this.device = 'stent'; this.dev = 0; this.pressure = 0; this.deflating = false; this.updateReadout(); this.go('stent');
    }
    if (id === 'pericardio' && this.periCooldown <= 0) { phys.pericardiocentesis(0.22); this.periCooldown = 6; }
    if (id === 'surgeon' && this.surgeonT < 0) { this.surgeonT = 60; phys.log('Cardiac surgeon called: theatre in 60 s', 'info'); }
    if (id === 'restart') { this.end(); phys.reset(); this.start(); }
    if (id === 'exit') this.ctx.endProcedure();
  }
  onTool() { }
  engageMm() { return Math.max(0, this.catS - this.La) * this.mmPer; }

  syncActions() {
    const { phys, ui } = this.ctx, st = this.stage, acts = [];
    if (st === 'engage' && this.engageMm() >= 2 && this.engageMm() <= 5.5) acts.push({ id: 'confirmEngage', label: 'Confirm engagement ✓', primary: true });
    if (['engage', 'angio', 'wire', 'balloon', 'inflate', 'balloonOut', 'size', 'stent', 'deploy', 'cathOut'].includes(st) && this.catS > 0.001) acts.push({ id: 'inject', label: 'Hold: inject dye', hold: true, primary: st === 'angio' });
    if (st === 'angio' && this.found) acts.push({ id: 'found', label: 'Plaque found → wire the artery', primary: true });
    if (!['gw', 'cath', 'gwOut'].includes(st)) acts.push({ id: 'xray', label: this.xray ? 'Normal view' : 'X-ray view' });
    if (st === 'wire') acts.push({ id: 'rotate', label: `Rotate tip (${this.angle}°)` });
    if (st === 'balloon' && !this.device) acts.push({ id: 'loadBalloon', label: 'Load balloon on the wire', primary: true });
    if ((st === 'inflate' || st === 'deploy') && this.device && this.device !== 'delivery') acts.push({ id: 'inflate', label: 'Hold: inflate', hold: true, primary: true }, { id: 'deflate', label: st === 'deploy' && this.pressure >= 10 ? 'Deflate (release stent)' : 'Deflate' });
    if (st === 'balloonOut' && this.pressure > 0) acts.push({ id: 'deflate', label: 'Deflate', primary: true });
    if (st === 'size') for (const o of this.sizeOptions()) acts.push({ id: `size:${o.d}x${o.len}`, label: `Stent ${o.d.toFixed(2)} × ${o.len} mm` });
    if (phys.tamponade > 0.06) acts.push({ id: 'pericardio', label: this.periCooldown > 0 ? `Pericardiocentesis (${Math.ceil(this.periCooldown)})` : 'Pericardiocentesis', primary: true });
    if (this.perf && this.surgeonT < 0) acts.push({ id: 'surgeon', label: 'Call surgeon' });
    if (phys.dead || this.done) acts.push({ id: 'restart', label: 'Restart', primary: true });
    acts.push({ id: 'exit', label: 'Exit' });
    const key = acts.map(a => a.label).join('|');
    if (key !== this.lastActions) { this.lastActions = key; ui.setActions(acts); }
  }
  sizeOptions() {
    if (this._opts) return this._opts;
    const L = [8, 12, 15, 18, 20, 23, 28], good = L.find(l => l >= this.lesionLen + 2) || 28, short = [...L].reverse().find(l => l < this.lesionLen) || 8;
    const opts = [{ d: this.vesselD, len: good }, { d: this.vesselD - 0.5, len: good }, { d: this.vesselD + 0.75, len: good }, { d: this.vesselD, len: short }];
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return (this._opts = opts);
  }

  // ---------- every frame ----------
  update(dt) {
    if (!this.active) return;
    const { ui, phys, pad, tremor } = this.ctx;
    const mm = pad.consume(dt), speed = Math.abs(pad.speed), tr = tremor.sample(dt, speed);
    this.trem = tr.z * 0.35;
    const st = this.stage, fine = this.device ? 0.5 : 1, d = fine * mm / 1000;
    const disp = (x) => (x * this.mmPer).toFixed(1);

    if (st === 'gw') {
      this.gwS = THREE.MathUtils.clamp(this.gwS + d, 0, this.La + 0.004);
      ui.setProgress(this.gwS / this.La, `Guide wire ${disp(this.gwS)} mm · ${speed.toFixed(1)} mm/s`);
      if (this.gwS >= this.La) { phys.log('Guide wire tip at the opening of the left coronary artery', 'good'); this.go('cath'); }
    } else if (st === 'cath') {
      const want = this.catS + d;
      if (want > this.gwS - 0.0015 && d > 0) { if (!this.flags.cathAhead) { this.flags.cathAhead = true; ui.toast('The catheter only follows the wire'); } }
      this.catS = THREE.MathUtils.clamp(want, 0, this.gwS - 0.0015);
      ui.setProgress(this.catS / this.La, `Catheter ${disp(this.catS)} mm`);
      if (this.catS >= this.La - 0.0025) { phys.log('Catheter at the coronary opening', 'good'); this.go('gwOut'); }
    } else if (st === 'gwOut') {
      this.gwS = Math.max(0, this.gwS + Math.min(0, d * 1.5));
      ui.setProgress(1 - this.gwS / this.La, `Guide wire ${disp(this.gwS)} mm in · pull it out`);
      if (this.gwS <= 0) { phys.log('Guide wire removed', 'good'); this.go('engage'); }
    } else if (st === 'engage') {
      this.catS = THREE.MathUtils.clamp(this.catS + d * 0.6, this.La - 0.004, this.La + 0.02);
      const e = this.engageMm();
      if (e > 8 && !this.flags.deep) { this.flags.deep = true; phys.log(`Catheter pushed ${e.toFixed(1)} mm into the artery: it blocks the flow (pressure damping)`, 'bad'); }
      if (e > 12 && !this.flags.cathDiss) { this.flags.cathDiss = true; this.diss = Math.min(this.diss, 0.6); phys.log('Catheter tip has torn the left main artery (dissection)', 'bad'); }
      ui.setProgress(Math.min(1, e / 5), `Tip ${e.toFixed(1)} mm into the artery · ${e < 2 ? 'push a little' : e <= 5.5 ? 'GOOD: confirm' : 'TOO DEEP: pull back'}`);
    } else if (st === 'angio') {
      ui.setProgress(this.fill, this.found ? `${Math.round(this.stenosisFound * 100)}% narrowing in the mid LAD` : this.fill > 0 ? 'Dye filling the artery…' : 'Hold "Inject dye"');
    } else if (st === 'wire' || st === 'wireOut') {
      this.wireStep(d, mm, speed, dt);
    } else if (['balloon', 'inflate', 'balloonOut', 'stent', 'deploy'].includes(st)) {
      this.deviceStep(d, dt);
    } else if (st === 'cathOut') {
      this.catS = Math.max(0, this.catS + Math.min(0, d * 1.5));
      ui.setProgress(1 - this.catS / (this.La + 0.004), `Catheter ${disp(this.catS)} mm in · pull it out`);
      if (this.catS <= 0) { phys.log('Catheter removed', 'good'); this.go('wireOut'); }
    }

    // contrast injection (needs the catheter tip in the artery)
    const inj = ui.held('inject') && this.catS > 0.001;
    if (inj) {
      if (this.engageMm() < 0.8) { if (!this.flags.spill) { this.flags.spill = true; phys.log('Dye spills into the aorta: the catheter tip is not in the artery', 'warn'); } }
      else { this.contrast = Math.min(1, this.contrast + dt * 2); this.fill = Math.min(1, this.fill + dt * 0.7 * (0.25 + this.flowNow)); }
    } else { this.contrast = Math.max(0, this.contrast - dt * 0.45); if (this.contrast <= 0) this.fill = 0; }
    if (st === 'angio' && !this.found && this.fill > 0.62) {
      this.found = true; this.stenosisFound = this.stenosis;
      phys.log(`Angiogram: ${Math.round(this.stenosis * 100)}% narrowing of the mid LAD (plaque); the artery beyond fills slowly`, 'warn');
      ui.toast('Plaque found'); this.updateReadout();
    }

    // coronary flow and the rest of the physiology
    this.noReflow = Math.max(0, this.noReflow - dt);
    const occluded = !!this.device && this.pressure > 2, deep = this.engageMm() > 8;
    let flow = Math.max(0, 1 - Math.pow(this.stenosis, 1.5)) * this.diss * (this.noReflow > 0 ? 0.25 : 1);
    if (occluded) flow = 0; if (deep) flow *= 0.3;
    this.flowNow = flow; phys.coronaryFlow = flow;
    this.periCooldown = Math.max(0, this.periCooldown - dt);
    if (this.surgeonT >= 0) { this.surgeonT -= dt; if (this.surgeonT <= 0 && !phys.dead) { phys.removeSource('perforation'); this.perf = null; this.marker.visible = false; phys.tamponade *= 0.2; this.surgeonT = -2; phys.log('Surgeon repaired the perforation', 'good'); } }
    this.updateGeometry();
    // blood only moves while the heart pumps: in arrest the cells stand still where they are
    this.flow.update(dt * THREE.MathUtils.clamp(phys.output, 0, 1), this.curve, this.frames, flow, LES, 1 - phys.systole);
    this.flow.mesh.visible = !this.xray;
    this.syncActions();
    ui.setExtra('LAD flow · infarct', `${Math.round(flow * 100)}% · ${Math.round(phys.damage * 100)}%`, flow < 0.5 || phys.damage > 0.4 ? 'bad' : 'good');
  }

  // the coronary wire: down the LAD and across the plaque (stage 6), and out at the end (stage 14)
  wireStep(d, mm, speed, dt) {
    const { phys, ui } = this.ctx;
    if (this.stage === 'wireOut') {
      if (d < 0) {
        if (this.inBranch) { this.sb += d * 1.5; if (this.sb < 0) { this.inBranch = false; this.sb = 0; } }
        else if (this.s > 0) this.s = Math.max(0, this.s + d * 1.5);
        else this.wireAo = Math.max(0, this.wireAo + d * 1.5);
      }
      ui.setProgress(1 - (this.s + this.wireAo) / (this.L0 * 0.7 + this.La), `Wire ${((this.s + this.wireAo) * this.mmPer).toFixed(1)} mm in · pull it out`);
      if (this.s <= 0 && this.wireAo <= 0 && !this.done) this.finish();
      return;
    }
    if (this.wireAo < this.La) this.wireAo = this.La; // the wire runs all the way through the catheter
    const before = this.s / this.L0;
    if (!this.inBranch) {
      this.s = Math.max(this.engageMm() / this.mmPer, this.s + d);
      const u = this.s / this.L0;
      if (before < BR && u >= BR && this.angle >= 45 && this.angle <= 135) { this.inBranch = true; this.sb = this.s - BR * this.L0; this.s = BR * this.L0; phys.log('Wire has entered the diagonal branch (tip rotated toward it)', 'warn'); ui.toast('Wire in the diagonal branch'); }
      if (speed > 14 && mm > 0 && !this.flags.diss && u > 0.05) { this.flags.diss = true; this.diss = 0.65; phys.log(`Wire pushed at ${speed.toFixed(0)} mm/s: the artery wall is torn (dissection), flow reduced`, 'bad'); }
      if (u > LES - 0.06 && u < LES + 0.06 && speed > 4 && mm > 0 && !this.flags.rupt) { this.flags.rupt = true; this.noReflow = 25; phys.log(`Crossed the plaque at ${speed.toFixed(1)} mm/s: plaque rupture, debris downstream (no-reflow)`, 'bad'); }
      if (u >= 0.985 && mm > 0) { this.s = 0.985 * this.L0; if (speed > 2) this.perforate(0.99, 0.014); }
      if (u >= LES + 0.12) { phys.log('Wire across the plaque, parked beyond it', 'good'); this.go('balloon'); }
    } else {
      this.sb += d;
      if (this.sb < 0) { this.inBranch = false; this.s = BR * this.L0 + this.sb - 0.0002; this.sb = 0; phys.log('Wire pulled back out of the branch'); }
      if (this.sb > this.LB0 * 0.97) { this.sb = this.LB0 * 0.97; if (mm > 0 && speed > 1.5) this.perforate(1, 0.016, true); }
    }
    ui.setProgress(this.inBranch ? BR : this.s / this.L0, `Wire ${((this.inBranch ? this.s + this.sb : this.s) * this.mmPer).toFixed(1)} mm · ${speed.toFixed(1)} mm/s · tip ${this.angle}°${this.inBranch ? ' · IN BRANCH: pull back' : ''}`);
  }

  // balloon and stent on the wire (stages 7-12)
  deviceStep(d, dt) {
    const { phys, ui } = this.ctx, st = this.stage;
    if (!this.device) { ui.setProgress(0, 'Load the balloon'); return; }
    if (this.pressure < 0.5) this.dev = THREE.MathUtils.clamp(this.dev + d, 0, this.s);
    const off = (this.dev / this.L0 - LES) * this.L0 * this.mmPer;      // real mm from the plaque centre
    const onT = Math.abs((this.dev / this.L0 - LES) * this.L0) <= 0.0025;   // within the two green rings
    const hold = (st === 'inflate' || st === 'deploy') && this.device !== 'delivery' && ui.held('inflate');
    if (hold) { this.pressure += dt * 2.5; this.deflating = false; } else if (this.deflating) { this.pressure = Math.max(0, this.pressure - dt * 6); if (this.pressure === 0) this.deflating = false; }
    // reaching the centre of the plaque moves the balloon/stent on to inflation
    if (st === 'balloon' && onT && this.pressure < 0.5) { phys.log('Balloon in the centre of the plaque', 'good'); this.go('inflate'); }
    if (st === 'stent' && onT && this.pressure < 0.5) { phys.log('Stent in the centre of the plaque', 'good'); this.go('deploy'); }
    if (this.device === 'balloon') {
      if (this.pressure > 6 && onT) this.stenosis = Math.min(this.stenosis, THREE.MathUtils.lerp(0.85, 0.35, Math.min(1, this.pressure / 10)));
      if (this.pressure > 9 && !onT && !this.flags.offDiss) { this.flags.offDiss = true; this.diss = Math.min(this.diss, 0.7); phys.log(`Balloon inflated ${Math.abs(off).toFixed(1)} mm off the plaque: healthy artery torn`, 'bad'); }
      if (this.pressure >= 8 && onT && !this.measured) {
        this.measured = { d: this.vesselD + (Math.random() - 0.5) * 0.1, len: this.lesionLen, atm: this.pressure };
        phys.log(`Balloon fully expanded at ${this.pressure.toFixed(1)} atm: artery ${this.measured.d.toFixed(2)} mm across, plaque ${this.lesionLen} mm long`, 'good');
        ui.toast('Measurements recorded'); this.updateReadout();
      }
      if (this.measured && this.pressure > this.measured.atm) { this.measured.atm = this.pressure; this.updateReadout(); }
      if (this.perf && !this.perf.branch && Math.abs(this.dev / this.L0 - this.perf.u) * this.L0 < 0.003 && this.pressure > 4 && this.pressure < 9) { this.sealT += dt; if (this.sealT > 10) { phys.removeSource('perforation'); this.perf = null; this.marker.visible = false; phys.log('Perforation sealed by prolonged balloon inflation', 'good'); } }
      if (this.pressure > 16 && !this.flags.rupture) { this.flags.rupture = true; this.perforate(this.dev / this.L0, 0.022); phys.log(`Balloon burst at ${this.pressure.toFixed(1)} atm`, 'bad'); this.pressure = 0; }
      if (st === 'inflate' && this.measured && this.deflating) this.go('balloonOut');
      if (st === 'balloonOut' && this.pressure < 0.5 && this.dev <= 0.0005) { this.device = null; this.dev = 0; phys.log('Balloon removed', 'good'); this.go('size'); }
    } else if (this.device === 'stent') {
      const pk = this.stentPick, okD = Math.abs(pk.d - this.vesselD) <= 0.25, over = pk.d - this.vesselD > 0.4, cover = pk.len >= this.lesionLen;
      if (this.pressure > 6 && onT) this.stenosis = Math.min(this.stenosis, THREE.MathUtils.lerp(0.85, 0.15, Math.min(1, this.pressure / 12)));
      if (this.pressure > (over ? 13 : 18) && !this.flags.overStent) { this.flags.overStent = true; this.perforate(this.dev / this.L0, 0.022); phys.log(`${over ? 'Oversized stent' : 'Stent'} over-expanded at ${this.pressure.toFixed(1)} atm: artery ruptured`, 'bad'); }
      if (this.deflating && this.pressure >= 10) {
        this.deployed = true; this.stentU = this.dev / this.L0; this.device = 'delivery';
        const under = this.pressure < 12;
        let res = 0.08, msg = 'stent fully expanded against the wall, plaque covered', kind = 'good';
        if (!onT) { res = 0.75; msg = `stent ${Math.abs(off).toFixed(1)} mm off the plaque: plaque left uncovered (geographic miss)`; kind = 'bad'; }
        else if (!cover) { res = 0.4; msg = 'stent shorter than the plaque: its edges are left narrowed'; kind = 'bad'; }
        else if (pk.d < this.vesselD - 0.2) { res = 0.35; msg = 'stent too narrow for the artery: it does not touch the wall (malapposition, clot risk)'; kind = 'bad'; }
        else if (over) { this.diss = Math.min(this.diss, 0.7); res = 0.1; msg = 'stent too wide for the artery: the edges tore the wall (edge dissection)'; kind = 'bad'; }
        else if (under) { res = 0.2; msg = 'stent slightly under-expanded'; kind = 'warn'; }
        this.stenosis = res; phys.log(`Stent deployed at ${this.pressure.toFixed(1)} atm: ${msg}`, kind);
        ui.setHint('Stent released. Let the balloon empty, then pull it out (drag down).');
      } else if (this.deflating && this.pressure > 0 && this.pressure < 10 && !this.flags.lowWarn) { this.flags.lowWarn = true; ui.setHint('Below 10 atm the stent did not lock open: it is still on the balloon. Hold Inflate again to 12-14 atm, then Deflate.'); }
      if (!this.deflating) this.flags.lowWarn = false;
    } else if (this.device === 'delivery') {
      if (this.pressure < 0.5 && this.dev <= 0.0005) { this.device = null; this.dev = 0; phys.log('Empty balloon removed; the stent stays in the artery', 'good'); this.go('cathOut'); }
    }
    const aim = onT ? 'ON TARGET' : off < 0 ? 'push ▲' : 'pull ▼';
    if (this.device === 'delivery' || st === 'balloonOut') ui.setProgress(1 - this.dev / Math.max(1e-6, this.s), this.pressure > 0.5 ? `Deflating · ${this.pressure.toFixed(1)} atm` : `Balloon ${(this.dev * this.mmPer).toFixed(1)} mm in · pull it out ▼`);
    else ui.setProgress(st === 'inflate' || st === 'deploy' ? Math.min(1, this.pressure / 16) : 1 - Math.min(1, Math.abs(off) / 20), `${this.device === 'balloon' ? 'Balloon' : 'Stent'} ${off >= 0 ? '+' : ''}${off.toFixed(1)} mm · ${aim} · ${this.pressure.toFixed(1)} atm`);
  }

  finish() {
    const { phys, ui } = this.ctx; this.done = true; this.go('done');
    const good = phys.coronaryFlow > 0.8;
    phys.log(good ? 'Wire removed. Final result: artery open, normal (TIMI 3) flow' : 'Wire removed. Final result: flow still impaired', good ? 'good' : 'bad');
    ui.toast(good ? 'Procedure complete: artery open' : 'Procedure finished: poor flow', good ? 'good' : 'bad');
  }

  end() {
    if (!this.active) return;
    this.active = false;
    if (this.xray) this.setXray(false);
    if (this.readout) { this.readout.remove(); this.readout = null; }
    this.flow.dispose();
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.ctx.scene.remove(this.group);
    this.ctx.phys.coronaryFlow = 1; this.ctx.phys.damageScale = 1;
    this.ctx.anatomy.isolate(null);
    this.ctx.ui.setExtra(null); this.ctx.ui.showPad(false);
  }
}
