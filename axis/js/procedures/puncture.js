import * as THREE from 'three';
import { AirParticles, PointCloud } from '../particles.js';

// Free-hand chest needle work. Nothing is scripted: the needle goes where you aim it, as deep as you push it,
// and it carries your hand tremor. Every frame the needle line is ray-traced through the real meshes
// (skin, ribs, parietal pleura = rest-pose lung surface, lung, heart, liver, diaphragm) and whatever the tip is in
// produces injuries in the physiology model. Injuries persist until they are treated (drain, pericardiocentesis,
// transfusion, surgeon) and can kill the patient.

const NEEDLE_LEN = 0.08;
// One step at a time: each stage unlocks only the controls it needs, and the next stage opens when this one is done.
const STEPS = ['Choose the scenario', 'Find the landmark: tap the entry point, then confirm', 'Prepare: clean the skin, local anaesthetic', 'Advance the needle into the pleural space', 'Hold steady: decompress / aspirate', 'Withdraw the needle, cover the site', 'Chest drain in the safe triangle', 'Drain until the lung is up, then remove it', 'Suture and dress the wound'];
const STAGE = { scenario: 0, site: 1, prep: 2, advance: 3, hold: 4, withdraw: 5, drainSite: 6, drain: 7, close: 8, done: 9 };
const DRAIN_MODES = { seal: { name: 'water seal', air: 0.12, blood: 0.025 }, suction: { name: 'suction −20 cmH₂O', air: 0.28, blood: 0.05 }, clamped: { name: 'CLAMPED', air: 0, blood: 0 } };

function makeNeedle() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 1, roughness: 0.2 });
  const r = 0.00085; // 14G
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, NEEDLE_LEN, 10), steel); shaft.position.y = NEEDLE_LEN / 2 + 0.002;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(r, 0.004, 10), steel); tip.rotation.x = Math.PI; tip.position.y = 0.001;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0026, 0.016, 16), new THREE.MeshStandardMaterial({ color: 0x2f9e5b, roughness: 0.5 }));
  hub.position.y = NEEDLE_LEN + 0.01;
  g.add(shaft, tip, hub); return g;
}
function makeDrain() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.16, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.7, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  tube.position.y = 0.08 - 0.04;
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0043, 0.0043, 0.16, 18, 1, true, 0, 0.6), new THREE.MeshBasicMaterial({ color: 0x1d6fd6, side: THREE.DoubleSide }));
  line.position.copy(tube.position); g.add(tube, line); return g;
}

export class PunctureProcedure {
  constructor(ctx) { this.ctx = ctx; this.active = false; this.name = 'puncture'; }

  start() {
    const { anatomy, ui, scene, renderer } = this.ctx;
    this.group = new THREE.Group(); this.group.name = 'PunctureProcedure'; scene.add(this.group);
    const h = renderer.domElement.height;
    this.vent = new AirParticles(this.group, 400, 0.006); this.vent.setViewportHeight(h);
    this.gapAir = new PointCloud(this.group, 700, 0.0075, 0xe6f8ff, true); this.gapAir.setViewportHeight(h);
    this.gapBlood = new PointCloud(this.group, 500, 0.0065, 0xa3121b, false); this.gapBlood.setViewportHeight(h);
    this.peri = new PointCloud(this.group, 420, 0.005, 0x8e0c16, false); this.peri.setViewportHeight(h);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    this.airSlots = Array.from({ length: 700 }, (_, i) => { const side = i % 2 ? 'L' : 'R'; return { side, vi: pick(anatomy.lungSide[side]), t: 0.15 + 0.8 * Math.random(), ph: Math.random() * 6.28 }; });
    this.bloodSlots = Array.from({ length: 500 }, (_, i) => { const side = i % 2 ? 'L' : 'R'; return { side, vi: pick(anatomy.lungBase[side]), t: 0.1 + 0.8 * Math.random(), ph: Math.random() * 6.28 }; });
    this.periSlots = Array.from({ length: 420 }, () => ({ vi: Math.floor(Math.random() * anatomy.heartVerts), t: Math.random() }));
    this.ray = new THREE.Raycaster();
    this.active = true;
    this.needle = null; this.depth = 0; this.injured = {}; this.maxPen = { lung: 0, heart: 0 };
    this.drain = null; this.units = 0; this.periCooldown = 0; this.surgeonT = -1; this.lastActions = '';
    this.stableT = 0; this.done = false; this.holdT = 0; this.prep = { clean: false, la: false };
    this.drainMode = null; this.drainRemoved = false; this.sutured = false; this.dressed = false; this._heal = 1;
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0009, 8, 32), new THREE.MeshBasicMaterial({ color: 0x3ee08f, depthTest: false, transparent: true }));
    this.marker.renderOrder = 20; this.marker.visible = false; this.group.add(this.marker);
    anatomy.isolate(['Lungs', 'Heart', 'Ribcage', 'Diaphragm', 'Skin', 'Spine', 'Liver']);
    this.ctx.focus(anatomy.lungsCenter, 0.55, new THREE.Vector3(0.15, 0.05, 1));
    ui.showProcedure('Chest needle: step by step', STEPS);
    this.go('scenario');
  }

  // move to a stage: sets the step list, the hint, the pad and (through syncActions) the buttons for that stage only
  go(stage) {
    const { ui } = this.ctx; this.state = stage; ui.setStep(STAGE[stage]); this.lastActions = '';
    const H = {
      scenario: 'Choose free practice on a healthy patient, or the emergency: a left tension pneumothorax you must decompress in time.',
      site: this.scenario === 'tension'
        ? 'Tap the LEFT chest at the 2nd intercostal space, mid-clavicular line (just ABOVE the 3rd rib), or the 4th-5th space in the anterior axillary line. Rotate the view first: the needle will follow your line of sight. Then press Confirm site.'
        : 'Tap the chest where you want to enter (the needle follows your line of sight, so rotate the view to set the angle). Tap again to move the mark, then press Confirm site.',
      prep: 'Clean the skin first, then infiltrate local anaesthetic down to the rib.',
      advance: 'Advance with the precision dial. Slow, steady strokes keep the needle still; fast or jerky strokes make it shake. Walk over the UPPER edge of the rib (the vessels run under each rib). Stop as soon as you feel the pop into the pleural space.',
      hold: this.scenario === 'tension' ? 'Hiss of air: hold the needle dead still in the pleural space until the tension is released. Do not push on into the lung.' : 'Tip in the pleural space. Hold it steady for a few seconds to aspirate and confirm; do not push on into the lung.',
      withdraw: 'Withdraw the needle along the same line, then decide: a drain if air is building up, otherwise cover the site.',
      drainSite: 'Chest drain: tap the insertion site in the safe triangle (lateral chest wall, 4th-5th intercostal space, between the anterior and mid-axillary lines).',
      drain: 'Drain on underwater seal. Switch to suction if the lung is slow to come up. Never clamp a bubbling drain. Remove it once bubbling has stopped and the lung is fully up.',
      close: 'Close the drain tract with sutures (an open tract sucks air in), then apply a sterile occlusive dressing.',
      done: 'Procedure complete.',
    };
    ui.setHint(H[stage]);
    ui.showPad(stage === 'advance' || stage === 'hold', 'Precision dial: drag up to advance · down to withdraw');
    this.marker.visible = stage === 'site' && !!this.siteP;
  }

  wantsTap() { return this.active; } // while this procedure runs, taps on the body are needle taps, never 'inspect'

  onAction(id) {
    const { phys, ui } = this.ctx, st = this.state;
    if (st === 'scenario' && (id === 'free' || id === 'tension')) {
      this.scenario = id;
      if (id === 'tension') {
        phys.air.L = 0.85;
        phys.addSource('trauma', { type: 'air', side: 'L', rate: 0.011, persistent: true, label: 'Stab wound, left chest: tension pneumothorax developing' });
      }
      this.go('site');
    }
    if (st === 'site' && id === 'confirmSite' && this.siteP) {
      this.entry = this.siteP; this.dir = this.siteDir; this.marker.visible = false;
      phys.log(`Entry point marked on the ${this.sideOf(this.entry) === 'R' ? 'right' : 'left'} chest`);
      this.go('prep');
    }
    if (st === 'prep' && id === 'clean' && !this.prep.clean) { this.prep.clean = true; phys.log('Skin cleaned with chlorhexidine, sterile drape', 'good'); }
    if (st === 'prep' && id === 'la' && this.prep.clean && !this.prep.la) { this.prep.la = true; phys.log('Local anaesthetic infiltrated down to the rib', 'good'); }
    if (st === 'prep' && id === 'skipLA' && this.prep.clean) { this.prep.la = true; phys.log('Local anaesthetic skipped: time-critical decompression', 'info'); }
    if (st === 'prep' && this.prep.clean && this.prep.la) this.placeNeedle();
    if (st === 'withdraw' && id === 'withdraw') this.withdrawing = true;
    if (st === 'withdraw' && id === 'toDrain') this.go('drainSite');
    if (st === 'withdraw' && id === 'dress' && !this.dressed) {
      this.dressed = true; this.addDressing(this.entry, this.dir); phys.log('Puncture site covered with a sterile dressing', 'good');
      this.finishIfStable();
    }
    if (st === 'drain' && id === 'drainMode' && this.drain) { const order = ['seal', 'suction', 'clamped']; this.setDrainMode(order[(order.indexOf(this.drainMode) + 1) % 3]); }
    if (st === 'drain' && id === 'removeDrain' && this.drain) { this.removeDrain(); this.go('close'); }
    if (st === 'close' && id === 'suture' && !this.sutured) { this.sutured = true; phys.removeSource('drainWound'); this.addStitches(this.drainEntry, this.drainDir); phys.log('Drain wound closed with sutures', 'good'); }
    if (st === 'close' && id === 'dress' && this.sutured && !this.dressed) { this.dressed = true; this.addDressing(this.drainEntry, this.drainDir); phys.log('Sterile occlusive dressing applied', 'good'); this.finishIfStable(); }
    // complications can be treated at any stage
    if (id === 'pericardio' && this.periCooldown <= 0) { phys.pericardiocentesis(0.22); this.periCooldown = 6; }
    if (id === 'transfuse') { this.units++; phys.transfuse(0.5); }
    if (id === 'surgeon' && this.surgeonT < 0) { this.surgeonT = 45; phys.log('Cardiothoracic surgeon called: theatre in 45 s', 'info'); }
    if (id === 'restart') { this.end(); this.ctx.phys.reset(); this.start(); }
    if (id === 'exit') this.ctx.endProcedure();
  }

  placeNeedle() {
    const { anatomy, ui } = this.ctx, entry = this.entry, dir = this.dir;
    this.depth = 0; this._trace = null; this.dwell = 0; this.impaleDepth = null; this.holdT = 0;
    this.u = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(); this.v = new THREE.Vector3().crossVectors(this.u, dir).normalize();
    if (!this.needle) { this.needle = makeNeedle(); this.group.add(this.needle); }
    this.needle.visible = true;
    this.go('advance');
    this.ctx.phys.log('14G needle on the skin');
    // swing the camera to a side view so the needle and its depth are visible (it was placed along the line of sight)
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    if (side.x * (entry.x - anatomy.lungsCenter.x) < 0) side.negate();
    this.ctx.focus(entry.clone().addScaledVector(dir, 0.03), 0.26, side.multiplyScalar(0.8).addScaledVector(dir, -0.6).add(new THREE.Vector3(0, 0.15, 0)));
    ui.toast('Needle on the skin: drag the dial up slowly');
  }

  removeNeedle() {
    const { phys } = this.ctx;
    this.group.remove(this.needle); this.needle = null; this.venting = null;
    phys.removeDrain('needleVent'); phys.removeSource('needleLung'); phys.removeSource('needleSuck'); phys.removeSource('cardiac');
    phys.log('Needle out; pressure over the puncture site', 'good');
    this.needleOut = true; this.lastActions = '';
  }

  // the patient needs a drain when the pleural air is building up (or always in the tension scenario)
  needsDrain() { const phys = this.ctx.phys; return this.scenario === 'tension' || Math.max(phys.air.L, phys.air.R) > 0.12 || Math.max(phys.hemo.L, phys.hemo.R) > 0.15; }
  finishIfStable() { if (!this.done && this.dressed) { this.wantFinish = true; } }

  onTool() { }

  // tap on the canvas: hits = all intersections under the finger, ray = the view ray. Taps only do something in the
  // two stages that ask for a site.
  onTap(hits, ray) {
    const { anatomy, ui } = this.ctx;
    if (this.state !== 'site' && this.state !== 'drainSite') { ui.toast(this.state === 'scenario' ? 'Choose a scenario first' : 'Follow the current step in the panel'); return; }
    const skinHit = hits.find(h => h.object === anatomy.parts.Skin) || hits.find(h => ['Ribcage', 'Lungs'].includes(h.object.userData.part)) || hits[0];
    if (!skinHit) { ui.toast('Tap on the chest'); return; }
    const entry = skinHit.point.clone(), dir = ray.direction.clone().normalize();
    if (this.state === 'drainSite') { this.placeDrain(entry, dir); this.go('drain'); return; }
    this.siteP = entry; this.siteDir = dir;
    this.marker.position.copy(entry).addScaledVector(dir, -0.001); this.marker.lookAt(entry.clone().sub(dir)); this.marker.visible = true;
    this.lastActions = '';
  }

  // first intersection distances along the needle line
  trace(origin) {
    const a = this.ctx.anatomy; const r = this.ray; r.set(origin, this.dir); r.far = 0.2;
    const first = (m) => (m ? r.intersectObject(m, false) : []); this._miss = this._miss || {};
    const d = {};
    const rib = first(a.parts.Ribcage); d.rib = rib.length ? rib[0].distance : Infinity;
    const pl = r.intersectObject(a.pleura, false); d.pleura = pl.length ? pl[0].distance : Infinity;
    const lu = first(a.lungs); d.lungIn = lu.length ? lu[0].distance : Infinity; d.lungOut = lu.length > 1 ? lu[1].distance : Infinity;
    const he = first(a.heart); d.heart = he.length ? he[0].distance : Infinity;
    const li = first(a.parts.Liver); d.liver = li.length ? li[0].distance : Infinity;
    const di = first(a.diaphragm); d.dia = di.length ? di[0].distance : Infinity;
    // the source meshes have small holes; keep the last surface distance if this frame's ray slipped through one
    const prev = this._trace || {};
    for (const k of Object.keys(d)) if (!isFinite(d[k]) && isFinite(prev[k]) && (this._miss[k] = (this._miss[k] || 0) + 1) < 20) d[k] = prev[k]; else if (isFinite(d[k])) this._miss[k] = 0;
    this._trace = d;
    return d;
  }

  sideOf(p) { return p.x < this.ctx.anatomy.lungsCenter.x ? 'R' : 'L'; }

  updateNeedle(dt) {
    const { phys, ui, pad, tremor, anatomy } = this.ctx;
    let mm = pad.consume(dt); const speed = pad.speed;
    if (this.state === 'withdraw') mm = this.withdrawing ? -Math.min(this.depth * 1000, 18 * dt) : 0;  // smooth pull-out along the same line
    const tr = tremor.sample(dt, this.state === 'withdraw' ? 0 : speed); this.shake = tremor.shake || 0;
    const origin = this.entry.clone().addScaledVector(this.u, tr.x).addScaledVector(this.v, tr.y);
    const d = this.trace(origin);
    let want = this.depth + mm / 1000;
    // bone stops the needle
    if (want > d.rib - 0.0004 && this.depth <= d.rib) {
      want = Math.max(0, d.rib - 0.0004);
      if (mm > 0 && !this._boneMsg) { this._boneMsg = true; phys.log('Bone contact: the needle is on a rib. Withdraw and redirect over its upper edge.', 'warn'); ui.toast('Bone: needle on a rib', 'bad'); }
    } else this._boneMsg = false;
    // loss of resistance through the pleura: pushing fast makes the needle jump in
    if (this.depth < d.pleura && want >= d.pleura && speed > 9) {
      const over = Math.min(0.012, speed * 0.0005);
      want += over; phys.log(`Pop through the pleura: needle overshot ${(over * 1000).toFixed(1)} mm (advanced at ${speed.toFixed(0)} mm/s)`, 'warn');
    }
    this.depth = THREE.MathUtils.clamp(want, 0, NEEDLE_LEN);
    const tipD = this.depth + tr.z;
    const tip = origin.clone().addScaledVector(this.dir, tipD);
    this.tip = tip; this.tipD = tipD;
    this.needle.position.copy(tip);
    this.needle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.dir.clone().negate());

    // ---- what is the tip in? ----
    const side = this.sideOf(tip);
    let tissue = 'Outside the body';
    let inLung = tipD >= d.lungIn; // past the visceral pleura = through lung (deeper surfaces are interlobar fissures)
    // an impaled lung cannot fall away from the needle: it stays skewered (and tears) until the needle is pulled back
    if (inLung && this.impaleDepth == null) this.impaleDepth = this.depth;
    if (this.impaleDepth != null) { if (this.depth < this.impaleDepth - 0.0015) this.impaleDepth = null; else inLung = true; }
    if (tipD > 0.0005) tissue = 'Skin';
    if (tipD > 0.004) tissue = 'Subcutaneous fat / chest muscle';
    if (tipD > d.pleura - 0.009 && tipD < d.pleura) tissue = 'Intercostal muscle';
    if (tipD > d.rib - 0.0003 && tipD < d.rib + 0.002) tissue = 'On rib (bone)';
    if (tipD >= d.pleura || inLung) tissue = inLung ? 'LUNG TISSUE' : 'Pleural space';
    if (tipD >= d.heart) tissue = 'HEART (myocardium)';
    if (tipD >= d.liver) tissue = 'LIVER';
    else if (tipD >= d.dia) tissue = 'Diaphragm';
    // once through the parietal pleura the hole holds the tip: hand tremor along the needle does not pop it back out
    // unless it is pulled back more than ~1.5 mm
    if (this.state === 'hold' && !inLung && tipD > d.pleura - 0.0015 && tipD < d.pleura && tipD < d.heart) tissue = 'Pleural space';

    // intercostal neurovascular bundle: just under each rib
    if (tipD > 0.002 && tipD < d.pleura + 0.002 && !this.injured.intercostal) {
      const nr = anatomy.nearestRib(tip, 0.006);
      if (nr && nr.p.y > tip.y && nr.p.y - tip.y < 0.0055 && nr.d < 0.005) {
        this.injured.intercostal = side;
        phys.addSource('intercostal', { type: 'hemo', side, rate: 0.0075, persistent: true, label: `Intercostal artery torn (needle passed under the rib): haemothorax, ${side === 'R' ? 'right' : 'left'}` });
      }
    }
    // lung parenchyma
    if (inLung) {
      const pen = Math.max(0.001, this.impaleDepth != null ? this.depth - this.impaleDepth + 0.001 : tipD - d.lungIn); this.maxPen.lung = Math.max(this.maxPen.lung, pen);
      if (this.dwell > 25) phys.addSource('tearBleed', { type: 'hemo', side, rate: Math.min(0.006, 0.0001 * this.dwell) });
      if (!this.injured.lung) { this.injured.lung = side; phys.log(`Visceral pleura breached: needle in ${side === 'R' ? 'right' : 'left'} lung tissue`, 'bad'); }
      this.dwell = (this.dwell || 0) + dt; // the breathing lung keeps sliding on the needle: the tear grows with time
      // a shaking needle tip saws at the lung: the hole grows with the shake
      this.sawn = (this.sawn || 0) + this.shake * dt;
      phys.addSource('needleLung', { type: 'air', side, rate: 0.02 + 1.0 * pen + Math.min(0.12, 0.0014 * this.dwell) + Math.min(0.08, 0.02 * this.sawn) });
      if (this.dwell > 20 && !this.injured.tear) { this.injured.tear = true; phys.log('Needle left in the lung: the laceration is widening with every breath', 'bad'); }
      if (pen > 0.025 && !this.injured.lungDeep) { this.injured.lungDeep = true; phys.addSource('lungBleed', { type: 'hemo', side, rate: 0.0015, persistent: true, label: 'Deep lung laceration: bleeding into the chest' }); }
    } else phys.removeSource('needleLung');
    if (this.injured.lung && !inLung) phys.addSource('lungHole', { type: 'air', side: this.injured.lung, rate: (0.004 + 0.7 * this.maxPen.lung + Math.min(0.15, 0.0022 * (this.dwell || 0))) * (this._holeDecay ?? 1) * this._heal });
    if (this.injured.lung && !inLung && this.maxPen.lung < 0.012 && (this.dwell || 0) < 8) this._holeDecay = (this._holeDecay ?? 1) * Math.exp(-dt / 35);
    // decompression: a 14G needle with its tip in an air-filled pleural space vents air
    // an open 14G needle in the pleural space: vents only under positive (tension) pressure;
    // otherwise the negative pressure of each breath sucks room air IN through it (open pneumothorax)
    if (tissue === 'Pleural space' && this.depth > 0) {
      if (phys.tension > 0.06) this.ventMode = true; else if (phys.tension < 0.015) this.ventMode = false;
      if (this.ventMode) {
        if (!this.injured.vent) { this.injured.vent = true; phys.log('Hiss of air through the needle: tension decompressed', 'good'); }
        phys.addDrain('needleVent', { side, air: 0.07 }); this.venting = side;
      } else { phys.removeDrain('needleVent'); this.venting = null; }
      const suck = !this.ventMode && phys.rr > 0 ? 0.02 : 0;
      if (suck && !this.injured.suck) { this.injured.suck = true; phys.log('Open needle in the pleural space: air is sucked in with each breath', 'bad'); }
      if (phys.sources.has('needleSuck')) phys.setSourceRate('needleSuck', suck); else phys.addSource('needleSuck', { type: 'air', side, rate: suck });
    } else { phys.removeDrain('needleVent'); if (phys.sources.has('needleSuck')) phys.setSourceRate('needleSuck', 0); this.venting = null; }
    // heart
    if (tipD >= d.heart) {
      const pen = tipD - d.heart; this.maxPen.heart = Math.max(this.maxPen.heart, pen);
      if (!this.injured.heart) { this.injured.heart = true; phys.log('Needle entered the heart: blood filling the pericardium', 'bad'); ui.toast('Cardiac puncture!', 'bad'); }
      phys.addSource('cardiac', { type: 'tamp', rate: 0.01 + 0.8 * pen });
    } else phys.removeSource('cardiac');
    if (this.injured.heart && tipD < d.heart) phys.addSource('cardiacRes', { type: 'tamp', rate: 0.002 + 0.25 * this.maxPen.heart, persistent: true });
    // liver / abdomen
    if (tipD >= d.liver && !this.injured.liver) { this.injured.liver = true; phys.addSource('liver', { type: 'bleed', rate: 0.011, persistent: true, label: 'Liver lacerated (entry too low, through the diaphragm): intra-abdominal bleeding' }); }
    if (tipD >= d.dia && !this.injured.dia && tipD < d.liver) { this.injured.dia = true; phys.log('Needle passed through the diaphragm into the abdomen', 'warn'); }

    this.tissue = tissue;
    // stage logic
    const inPleura = tissue === 'Pleural space';
    if (this.state === 'advance' && inPleura) { phys.log('Loss of resistance: tip in the pleural space', 'good'); this.holdT = 0; this.go('hold'); }
    else if (this.state === 'hold' && !inPleura) { phys.log(tipD > d.pleura ? 'Needle pushed on out of the pleural space' : 'Needle slipped back out of the pleural space', 'warn'); this.go('advance'); }
    if (this.state === 'hold') {
      const steady = this.shake < 0.3 && Math.abs(speed) < 3;
      if (steady) this.holdT += dt;
      const need = this.scenario === 'tension' ? (phys.tension < 0.015 ? 3 : Infinity) : 4;
      const prog = this.scenario === 'tension' ? Math.min(0.95, 1 - phys.tension / 0.5) : this.holdT / 4;
      ui.setProgress(prog, `${(this.depth * 1000).toFixed(1)} mm · pleural space · ${steady ? 'steady' : 'SHAKING: slow down'}${this.venting ? ' · air hissing out' : ''}`);
      if (this.holdT >= need || (this.scenario === 'tension' && phys.tension < 0.015 && this.holdT > 3)) {
        phys.log(this.scenario === 'tension' ? 'Tension released: the mediastinum is back in the midline' : 'Air aspirated: needle position confirmed', 'good');
        this.go('withdraw');
      }
    } else if (this.state === 'withdraw') ui.setProgress(1 - this.depth / Math.max(0.001, this.maxDepth || this.depth), this.needle ? `Withdrawing · ${(this.depth * 1000).toFixed(1)} mm` : 'Needle out');
    else ui.setProgress(this.depth / NEEDLE_LEN, `${(this.depth * 1000).toFixed(1)} mm · ${tissue} · hand ${this.shake < 0.15 ? 'steady' : this.shake < 0.45 ? 'a little shaky' : 'SHAKING'}`);
    this.maxDepth = Math.max(this.maxDepth || 0, this.depth);
    if (this.state === 'withdraw' && this.withdrawing && this.depth <= 0.0001) { this.withdrawing = false; this.removeNeedle(); }
  }

  placeDrain(entry, dir) {
    const { phys, anatomy, ui } = this.ctx;
    const side = this.sideOf(entry);
    this.entry0 = entry;
    const r = new THREE.Raycaster(entry, dir, 0, 0.045);
    const hitHeart = r.intersectObject(anatomy.heart, false).length > 0;
    const hitLiver = r.intersectObject(anatomy.parts.Liver, false).length > 0;
    const lungHits = r.intersectObject(anatomy.lungs, false);
    const lateral = Math.abs(entry.x - anatomy.lungsCenter.x) / ((anatomy.lungsBox.max.x - anatomy.lungsBox.min.x) / 2);
    const high = (entry.y - anatomy.lungsBox.min.y) / (anatomy.lungsBox.max.y - anatomy.lungsBox.min.y);
    this.drain = makeDrain();
    this.drain.position.copy(entry).addScaledVector(dir, 0.04);
    this.drain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    this.group.add(this.drain);
    this.drainTip = entry.clone().addScaledVector(dir, 0.035); this.drainOut = dir.clone().negate();
    this.drainSide = side; this.drainEntry = entry.clone(); this.drainDir = dir.clone();
    this.setDrainMode('seal');
    phys.log(`Chest drain inserted, ${side === 'R' ? 'right' : 'left'} side (${lateral > 0.7 ? 'lateral' : 'anterior/medial'} chest wall, ${high < 0.25 ? 'LOW' : high > 0.7 ? 'high' : 'mid'} position)`, lateral > 0.7 && high >= 0.25 && high <= 0.7 ? 'good' : 'warn');
    if (hitHeart) phys.addSource('drainHeart', { type: 'tamp', rate: 0.035, persistent: true, label: 'Drain trocar perforated the heart' });
    if (hitLiver) phys.addSource('drainLiver', { type: 'bleed', rate: 0.02, persistent: true, label: 'Drain placed below the diaphragm: liver laceration' });
    if (lungHits.length && phys.collapse[side] < 0.5) phys.addSource('drainLung', { type: 'air', side, rate: 0.05, persistent: true, label: 'Drain driven into inflated lung: lung laceration' });
    if (side !== (this.injured.lung || (this.scenario === 'tension' ? 'L' : side))) phys.log('The drain is on the opposite side to the pneumothorax', 'bad');
  }

  setDrainMode(mode) {
    const { phys } = this.ctx, m = DRAIN_MODES[mode];
    this.drainMode = mode; phys.addDrain('drain', { side: this.drainSide, air: m.air, blood: m.blood });
    const leaking = this.airLeakRate() > 0.004;
    phys.log(`Drain set to ${m.name}`, mode === 'clamped' && leaking ? 'bad' : 'info');
    if (mode === 'clamped' && leaking) this.ctx.ui.toast('Clamping a bubbling drain lets air build up again!', 'bad');
  }
  airLeakRate() { let r = 0; for (const s of this.ctx.phys.sources.values()) if (s.type === 'air' && s.side === this.drainSide) r += s.rate; return r; }
  removeDrain() {
    const { phys, ui } = this.ctx;
    const early = phys.air[this.drainSide] > 0.06 || this.airLeakRate() > 0.004 || phys.hemo[this.drainSide] > 0.15;
    phys.removeDrain('drain'); this.group.remove(this.drain); this.drain = null; this.drainRemoved = true;
    // until the tract is sutured the open wound sucks air in with every breath
    phys.addSource('drainWound', { type: 'air', side: this.drainSide, rate: early ? 0.03 : 0.012 });
    if (early) phys.log('Drain removed too early (lung not fully up or still leaking): pneumothorax re-accumulating', 'bad');
    else phys.log('Drain removed at end-expiration: lung fully expanded, no air leak', 'good');
  }
  surfaceFrame(p, dir) {
    const n = dir.clone().negate(), u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(u, n).normalize();
    return { n, u, v };
  }
  addStitches(p, dir) {
    const { n, u, v } = this.surfaceFrame(p, dir), mat = new THREE.MeshStandardMaterial({ color: 0x15202b, roughness: 0.6 });
    const cut = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.0012, 0.0006), new THREE.MeshStandardMaterial({ color: 0x6b1010 }));
    cut.position.copy(p).addScaledVector(n, 0.0012); cut.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); this.group.add(cut);
    for (const k of [-1, 0, 1]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.00045, 0.00045, 0.008, 6), mat);
      st.position.copy(p).addScaledVector(u, k * 0.005).addScaledVector(n, 0.0016);
      st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); this.group.add(st);
    }
  }
  addDressing(p, dir) {
    const { n, u, v } = this.surfaceFrame(p, dir);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.002), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.9 }));
    const gauze = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.0028), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
    for (const m of [pad, gauze]) { m.position.copy(p).addScaledVector(n, 0.003); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); this.group.add(m); }
  }

  syncActions() {
    const { phys, ui } = this.ctx, st = this.state;
    const persistent = [...phys.sources.entries()].filter(([k, s]) => s.persistent && k !== 'trauma');
    const acts = [];
    if (st === 'scenario') acts.push({ id: 'free', label: 'Free practice', primary: true }, { id: 'tension', label: 'Emergency: tension PTX' });
    if (st === 'site') acts.push({ id: 'confirmSite', label: this.siteP ? 'Confirm site ✓' : 'Tap the chest first…', primary: !!this.siteP });
    if (st === 'prep') {
      if (!this.prep.clean) acts.push({ id: 'clean', label: '1 · Clean the skin', primary: true });
      else if (!this.prep.la) { acts.push({ id: 'la', label: '2 · Local anaesthetic', primary: true }); if (this.scenario === 'tension') acts.push({ id: 'skipLA', label: 'Skip (no time)' }); }
    }
    if (st === 'withdraw') {
      if (this.needle) acts.push({ id: 'withdraw', label: this.withdrawing ? 'Withdrawing…' : 'Withdraw the needle', primary: true });
      else if (!this.dressed) {
        // air still building up: a drain is the only way on; a dry puncture just needs covering
        if (this.needsDrain()) acts.push({ id: 'toDrain', label: 'Insert chest drain', primary: true });
        else acts.push({ id: 'dress', label: 'Cover the site', primary: true });
      }
    }
    if (st === 'drain' && this.drain) {
      acts.push({ id: 'drainMode', label: `Drain: ${DRAIN_MODES[this.drainMode].name} ▸` });
      const ready = Math.max(phys.air.L, phys.air.R) < 0.06 && this.airLeakRate() <= 0.004;
      acts.push({ id: 'removeDrain', label: ready ? 'Remove drain ✓' : 'Remove drain (lung not up yet)', primary: ready });
    }
    if (st === 'close') {
      if (!this.sutured) acts.push({ id: 'suture', label: '1 · Suture the wound', primary: true });
      else if (!this.dressed) acts.push({ id: 'dress', label: '2 · Apply dressing', primary: true });
    }
    if (phys.tamponade > 0.06) acts.push({ id: 'pericardio', label: this.periCooldown > 0 ? `Pericardiocentesis (${Math.ceil(this.periCooldown)})` : 'Pericardiocentesis', primary: true });
    if (phys.bloodLoss > 0.35 && this.units < 6) acts.push({ id: 'transfuse', label: `Transfuse 500 mL (${6 - this.units} left)` });
    if (persistent.some(([k, s]) => s.type !== 'air') && this.surgeonT < 0) acts.push({ id: 'surgeon', label: 'Call surgeon' });
    if (phys.dead || this.done) acts.push({ id: 'restart', label: 'Restart', primary: true });
    acts.push({ id: 'exit', label: 'Exit' });
    const key = acts.map(a => a.label).join('|');
    if (key !== this.lastActions) { this.lastActions = key; ui.setActions(acts); }
  }

  updateVisuals(dt) {
    const { phys, anatomy } = this.ctx;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), t = phys.time;
    // pleural air: lives in the gap between the collapsed lung and the chest wall (rest-pose lung surface)
    let n = 0;
    for (let i = 0; i < this.airSlots.length; i++) {
      const s = this.airSlots[i], amt = Math.min(1, phys.air[s.side] / 1.1);
      if ((i >> 1) / (this.airSlots.length / 2) < amt) {
        anatomy.morphedWorld(anatomy.lungs, s.vi, a); anatomy.restWorld(anatomy.lungs, s.vi, b);
        a.lerp(b, s.t); a.y += 0.0012 * Math.sin(t * 2 + s.ph);
        this.gapAir.set(i, a, 0.75); n++;
      } else this.gapAir.hide(i);
    }
    this.gapAir.commit();
    // pleural blood pools at the base
    for (let i = 0; i < this.bloodSlots.length; i++) {
      const s = this.bloodSlots[i], amt = Math.min(1, phys.hemo[s.side] / 1.0);
      if ((i >> 1) / (this.bloodSlots.length / 2) < amt) {
        anatomy.morphedWorld(anatomy.lungs, s.vi, a); anatomy.restWorld(anatomy.lungs, s.vi, b);
        a.lerp(b, s.t); a.y -= 0.004 * s.t; this.gapBlood.set(i, a, 0.9);
      } else this.gapBlood.hide(i);
    }
    this.gapBlood.commit();
    // pericardial blood around the heart
    const nrm = anatomy.heart.geometry.attributes.normal, nm = new THREE.Matrix3().getNormalMatrix(anatomy.heart.matrixWorld);
    const ta = Math.min(1, phys.tamponade / 0.6);
    for (let i = 0; i < this.periSlots.length; i++) {
      const s = this.periSlots[i];
      if (i / this.periSlots.length < ta) {
        anatomy.morphedWorld(anatomy.heart, s.vi, a); b.fromBufferAttribute(nrm, s.vi).applyMatrix3(nm).normalize();
        a.addScaledVector(b, 0.001 + 0.004 * ta * s.t); this.peri.set(i, a, 0.85);
      } else this.peri.hide(i);
    }
    this.peri.commit();
    // vent / drain streams
    let rate = 0, emitter = null;
    if (this.venting && this.tip) {
      rate = 60; const hub = this.tip.clone().addScaledVector(this.dir, -NEEDLE_LEN);
      emitter = (p) => p.spawn(this.tip.clone(), this.dir.clone().multiplyScalar(-0.05), 1.6, { point: hub, out: this.dir.clone().negate() });
    }
    if (this.drain && (phys.air.L + phys.air.R + phys.hemo.L + phys.hemo.R) > 0.05) {
      rate = 70;
      emitter = (p) => p.spawn(this.drainTip.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.02)), new THREE.Vector3(), 3, { point: this.drainTip, out: this.drainOut });
    }
    this.vent.update(dt, rate, emitter);
  }

  update(dt) {
    if (!this.active) return;
    const { phys, ui } = this.ctx;
    if (this.needle && (this.state === 'advance' || this.state === 'hold' || this.state === 'withdraw')) this.updateNeedle(dt);
    if (this.surgeonT >= 0) {
      this.surgeonT -= dt;
      if (this.surgeonT <= 0 && !phys.dead) {
        for (const [k, s] of [...phys.sources.entries()]) if (s.persistent && s.type !== 'air') phys.removeSource(k);
        phys.tamponade *= 0.2; this.surgeonT = -2; phys.log('Surgeon in theatre: bleeding controlled', 'good');
      }
    }
    this.periCooldown = Math.max(0, this.periCooldown - dt);
    // with the lung back up against the chest wall and the drain open, small lung holes seal over (faster on suction)
    if (this.drain && this.drainMode !== 'clamped' && !this.needle && phys.collapse[this.drainSide] < 0.25) {
      const tau = this.drainMode === 'suction' ? 25 : 45; this._heal *= Math.exp(-dt / tau);
      for (const k of ['lungHole', 'drainLung', 'trauma']) { const src = phys.sources.get(k); if (src) { src.rate *= Math.exp(-dt / tau); if (src.rate < 0.0015) { phys.removeSource(k); phys.log(k === 'drainLung' ? 'Lung laceration from the drain has sealed' : k === 'trauma' ? 'Stab-wound lung leak has sealed: drain stopped bubbling' : 'Needle hole in the lung has sealed', 'good'); } } }
    }
    this.updateVisuals(dt);
    this.syncActions();
    const air = Math.max(phys.air.L, phys.air.R);
    ui.setExtra('Pleural air / blood', `${Math.round(air * 100)}% · ${Math.round((phys.hemo.L + phys.hemo.R) * 1000)} mL`, air > 0.4 || phys.hemo.L + phys.hemo.R > 0.4 ? 'bad' : 'good');
    if (this.state === 'withdraw' && !this.needle) ui.setProgress(1, 'Needle out');
    if (this.state === 'drainSite') ui.setProgress(0, 'Tap the safe triangle');
    if (this.state === 'close') ui.setProgress((this.sutured ? 0.5 : 0) + (this.dressed ? 0.5 : 0), this.sutured ? 'Sutured · dressing next' : 'Wound open: suture it');
    if (this.state === 'drain') ui.setProgress(1 - Math.min(1, air / 0.6), `Pleural air ${Math.round(air * 100)}% · ${this.airLeakRate() > 0.004 ? 'bubbling' : 'no bubbling'} · ${DRAIN_MODES[this.drainMode].name}`);
    // outcome: stable patient + every step closed
    const bleeding = [...phys.sources.values()].some(s => s.rate > 0.0005 && s.type !== 'air') || [...phys.sources.values()].some(s => s.type === 'air' && s.rate > 0.004 && !phys.drains.size);
    const stable = !phys.dead && !phys.arrest && !bleeding && air < 0.25 && phys.tamponade < 0.1 && phys.map > 70;
    this.stableT = stable ? this.stableT + dt : 0;
    if (this.wantFinish && !this.done && this.stableT > 2) {
      this.done = true; this.go('done'); phys.log('Procedure complete: patient stable, wound closed and dressed', 'good'); ui.toast('Procedure complete', 'good');
    }
  }

  end() {
    if (!this.active) return;
    this.active = false;
    [this.vent, this.gapAir, this.gapBlood, this.peri].forEach(p => p.dispose());
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.ctx.scene.remove(this.group);
    this.ctx.anatomy.isolate(null);
    this.ctx.ui.setExtra(null); this.ctx.ui.showPad(false);
  }
}
