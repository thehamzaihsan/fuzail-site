import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Physiology } from './physiology.js';
import { Anatomy, LAYERS, FACTS, baseBox } from './anatomy.js';
import { Labels } from './labels.js';
import { toThree, ARTERIES, VEINS } from './flowpaths.js';
import { StentProcedure } from './procedures/stent.js';
import { PunctureProcedure } from './procedures/puncture.js';
import { UI } from './ui.js';
import { Circulation, CutawayFlow, HeartFlow } from './circulation.js';
import { Tremor, PrecisionPad } from './hand.js';
import { GUIDES } from './guides.js';
import { Explode } from './explode.js';
import { KidneyFlow } from './kidney.js';

const $ = (id) => document.getElementById(id);
const ui = new UI();

// ---------- renderer / scene ----------
const container = $('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.localClippingEnabled = true;
renderer.setClearColor(0x000000, 0); // transparent: the dark gradient behind comes from CSS
const isMobile = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = null;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a1e1c, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(1, 2, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x6fb6ff, 1.1); rim.position.set(-2, 1, -2.5); scene.add(rim); // cool rim light separates the model from the dark background

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.005, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.06; controls.maxDistance = 4;
controls.autoRotateSpeed = 1.2;

const phys = new Physiology();
const anatomy = new Anatomy(scene);
// models are Draco-compressed (about half the download); the decoder ships in lib/ so it also works offline
const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('./lib/three/addons/libs/draco/'));
const tremor = new Tremor();
const pad = new PrecisionPad($('pad'));
let circulation = { update() {}, setVisible() {} };
const explode = new Explode();
let kidneyFlow = null, explodeOn = false, cutOccluders = null;
let flowOn = false, bloodOn = false, airOn = false, labelsOn = true, currentView = 'thorax', cutFlow = null, extra = {}, labels = null;
phys.onEvent(e => ui.logEvent(e));

// ---------- camera focus with easing ----------
let tween = null;
let focusDist = 1.2;
function focus(point, dist, dir = new THREE.Vector3(0, 0.1, 1)) {
  // portrait screens: keep the same horizontal coverage by moving further back
  if (camera.aspect < 1) dist = dist * Math.min(2.2, 0.95 / Math.max(camera.aspect, 0.4));
  focusDist = dist;
  const fromT = controls.target.clone(), fromP = camera.position.clone();
  const toT = point.clone(), toP = point.clone().add(dir.clone().normalize().multiplyScalar(dist));
  tween = { t: 0, fromT, fromP, toT, toP };
  $('zoomSlider').value = 50;
}
function updateTween(dt) {
  if (!tween) return;
  tween.t = Math.min(1, tween.t + dt / 0.9);
  const e = tween.t < 0.5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2;
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  camera.position.lerpVectors(tween.fromP, tween.toP, e);
  if (tween.t >= 1) tween = null;
}
window.adjustCameraZoom = (v) => {
  const k = v / 100; const d = focusDist * THREE.MathUtils.lerp(0.45, 2.2, k);
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(dir, d);
};

// ---------- procedures ----------
const ctx = { scene, renderer, camera, anatomy, phys, ui, focus, pad, tremor, endProcedure: () => endProcedure() };
const procedures = { stent: new StentProcedure(ctx), puncture: new PunctureProcedure(ctx) };
let current = null;
async function startProcedure(name) {
  if (current && current.name === name && current.active) return;
  endProcedure(true);
  if (anatomy.cutaway && anatomy.cutaway.visible) anatomy.showCutaway(false);
  phys.reset(); ui.reviewing = false; ui.clearLog(); ui.hideDeath(); // every procedure starts on a fresh patient
  if (labels) labels.clear();
  current = procedures[name];
  await current.start();
  // the guide pauses the simulation while it is open, so the clock does not run while reading
  const wasPlaying = playing; playing = false;
  ui.showGuide(GUIDES[name], () => { playing = wasPlaying; });
}
function endProcedure(keepTool) {
  if (current) current.end();
  current = null;
  ui.hideProcedure();
  if (!keepTool) setTool('inspect');
  if (!keepTool) applyLabels();
}
ui.actionHandler = (id) => current && current.onAction(id);

// ---------- tools (dock) ----------
let tool = 'inspect';
const TOOL_INFO = {
  inspect: ['Inspect', 'Tap any structure to highlight it and read about it. One finger rotates, pinch zooms, two fingers pan.'],
  needle: ['Needle / trocar', 'Lung puncture: tap a lung to insert the needle and simulate a pneumothorax.'],
  catheter: ['Guide wire / catheter', 'Coronary stent: navigate a guide wire down the LAD artery to the blockage.'],
  stent: ['Stent deployer', 'Deploys the stent once the balloon has opened the blockage.'],
};
function setTool(t) {
  tool = t;
  document.querySelectorAll('.dock-item').forEach(el => el.classList.toggle('active', el.dataset.tool === t));
  if (!current) ui.setFact(...TOOL_INFO[t]);
}
window.selectTool = async (t) => {
  setTool(t);
  if (t === 'needle') await startProcedure('puncture');
  else if (t === 'catheter') await startProcedure('stent');
  else if (t === 'stent') {
    if (!current || current.name !== 'stent') { await startProcedure('stent'); ui.toast('Advance the wire and inflate the balloon first'); }
    else current.onTool('stent');
  }
};

// ---------- picking (tap without drag) ----------
const ray = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dtm = performance.now() - down.t; down = null;
  if (moved > 8 || dtm > 450) return;
  const p = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(p, camera);
  const all = [...anatomy.pickables(), anatomy.parts.Skin].filter(Boolean);
  const hits = ray.intersectObjects(all, false);
  if (current && current.wantsTap && current.wantsTap()) { current.onTap(hits, ray.ray); return; }
  const hit = hits.find(h => h.object.userData.part !== 'Skin');
  if (hit) {
    const part = hit.object.userData.part;
    anatomy.highlight(hit.object);
    const f = FACTS[part] || [part, ''];
    ui.setFact(f[0], f[1]);
    $('fact-hud').classList.add('show');
  }
});

// ---------- assets drawer: views + layers ----------
const VIEWS = {
  full: { label: 'Complete human model', icon: '🧍', parts: null, focus: () => [new THREE.Vector3(0, 1.0, 0), 2.3, new THREE.Vector3(0, 0.15, 1)] },
  thorax: { label: 'Thorax', icon: '🩻', parts: ['Heart', 'Lungs', 'Diaphragm', 'Liver', 'Skin'], focus: () => [anatomy.lungsCenter, 0.65, new THREE.Vector3(0, 0.1, 1)] },
  heart: { label: 'Heart', icon: '🫀', parts: ['Heart'], focus: () => [anatomy.heartCenter, 0.2, new THREE.Vector3(0.2, 0.1, 1)] },
  cutaway: { label: 'Heart cross-section', icon: '🔪', cutaway: true, focus: () => [anatomy.heartCenter, 0.24, new THREE.Vector3(0, 0.05, 1)] },
  lungs: { label: 'Lungs', icon: '🫁', parts: ['Lungs'], focus: () => [anatomy.lungsCenter, 0.5, new THREE.Vector3(0, 0.1, 1)] },
  vessels: { label: 'Blood vessels', icon: '🩸', parts: ['Arteries', 'Veins', 'Heart'], focus: () => [new THREE.Vector3(0, 1.0, 0), 2.1, new THREE.Vector3(0, 0.1, 1)] },
  kidneys: { label: 'Kidneys', icon: '🫘', parts: ['KidneyL', 'KidneyR', 'UreterL', 'UreterR', 'Bladder', 'RenalArteryL', 'RenalArteryR', 'RenalVeinL', 'RenalVeinR', 'Arteries', 'Veins'], focus: () => [kidneyCenter(), 0.66, new THREE.Vector3(0, 0.05, 1)], fact: ['Kidneys and urinary tract', 'Two kidneys filter the blood; urine runs down the ureters into the bladder. Press 🩸 for the blood and urine flow, 💥 for the exploded view, and tap a number to read about each part.'] },
  skeleton: { label: 'Skeleton', icon: '🦴', parts: ['Ribcage', 'Spine', 'Skull', 'Pelvis', 'Arms', 'Legs'], focus: () => [new THREE.Vector3(0, 1.0, 0), 2.2, new THREE.Vector3(0, 0.1, 1)] },
};
function kidneyCenter() { const b = new THREE.Box3(); for (const n of ['KidneyL', 'KidneyR', 'Bladder']) if (anatomy.parts[n]) b.union(baseBox(anatomy.parts[n])); return b.isEmpty() ? new THREE.Vector3(0, 1, 0.04) : b.getCenter(new THREE.Vector3()); }
async function showView(key) {
  const v = VIEWS[key];
  currentView = key;
  endProcedure();
  setExplode(0, true);
  explode.clearFocus(); isoAnim = null;
  if (v.cutaway) {
    ui.setFact('Loading', 'Loading cross-section heart...');
    await anatomy.loadCutaway(loader);
    anatomy.showCutaway(true);
    ui.setFact(...FACTS.Ventricles);
  } else {
    anatomy.showCutaway(false);
    anatomy.isolate(v.parts);
    if (v.fact) ui.setFact(...v.fact);
    else ui.setFact(v.label, v.parts ? `Showing: ${v.parts.join(', ')}.` : 'Full body with semi-transparent skin. Use the Layers tab to peel structures away.');
  }
  focus(...v.focus());
  toggleAssetsModal(false);
  if (v.cutaway && !cutFlow) {
    try { const userPaths = await fetch('assets/flowpaths_user.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null); cutFlow = new CutawayFlow(anatomy.cutawayModel, await (await fetch('assets/cutflow.json')).json(), userPaths); }
    catch (e) { console.error('cutflow', e); }
  }
  if (key === 'lungs' && !airOn && !bloodOn) ui.toast('Tip: press 🌬️ to watch only the air flow');
  if (key === 'kidneys' && !bloodOn) ui.toast('Tip: press 🩸 to see the kidney\'s blood and urine flow');
  applyFlow(); applyLabels();
  if (explodeOn) { prepareExplode(); animateExplode(0.6); tween.toP.sub(tween.toT).multiplyScalar(1.3).add(tween.toT); }
}
function buildDrawer() {
  $('fullbody-tab').innerHTML = `<div class="thumbnail-card" data-view="full"><div class="thumbnail-icon">🧍</div><div class="thumbnail-title">Complete human model</div><div class="asset-status">thorax.glb · 4.5 MB</div></div>`;
  $('individual-grid').innerHTML = Object.entries(VIEWS).filter(([k]) => k !== 'full').map(([k, v]) =>
    `<div class="thumbnail-card" data-view="${k}"><div class="thumbnail-icon">${v.icon}</div><div class="thumbnail-title">${v.label}</div><div class="asset-status">${v.cutaway ? 'heart_cutaway.glb' : 'Ready'}</div></div>`).join('');
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => showView(el.dataset.view)));
  $('layers-tab').innerHTML = Object.entries(LAYERS).map(([k, l]) =>
    `<label class="layer-row"><input type="checkbox" data-layer="${k}" ${l.visible ? 'checked' : ''}><span>${l.label}</span></label>`).join('') +
    `<label class="layer-row"><input type="range" id="skinOpacity" min="0" max="100" value="16"><span>Skin opacity</span></label>
     <label class="layer-row"><input type="checkbox" id="autoRotate"><span>Auto-rotate</span></label>
     <label class="layer-row"><input type="checkbox" id="phoneShake"><span>Use phone motion as hand shake</span></label>
     <label class="layer-row"><input type="range" id="tremorLevel" min="0" max="300" value="100"><span>Hand tremor</span></label>
     <label class="layer-row"><input type="checkbox" id="soundOn" checked><span>Monitor sound</span></label>`;
  document.querySelectorAll('[data-layer]').forEach(el => el.addEventListener('change', () => { anatomy.showCutaway(false); anatomy.setLayer(el.dataset.layer, el.checked); }));
  $('skinOpacity').addEventListener('input', e => { const m = anatomy.parts.Skin.material; m.opacity = e.target.value / 100; m.depthWrite = m.opacity > 0.95; });
  $('autoRotate').addEventListener('change', e => { controls.autoRotate = e.target.checked; });
  $('phoneShake').addEventListener('change', async e => { if (e.target.checked) { const ok = await tremor.enableDevice(); if (!ok) { e.target.checked = false; ui.toast('Motion sensor not available on this device'); } } else tremor.disableDevice(); });
  $('tremorLevel').addEventListener('input', e => { tremor.level = e.target.value / 100; });
  $('soundOn').addEventListener('change', e => { ui.sound = e.target.checked; });
}
function toggleAssetsModal(force) {
  const m = $('assets-modal'); const show = force === undefined ? m.style.display !== 'block' : force;
  m.style.display = show ? 'block' : 'none';
}
window.toggleAssetsModal = toggleAssetsModal;
window.switchTab = (id, btn) => {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  $(id).classList.add('active'); btn.classList.add('active');
};

// ---------- playback toolbar ----------
let playing = true, simSpeed = 1; const speeds = [0.5, 1, 1.5, 2]; let speedIdx = 1;
window.playAnim = () => { playing = true; $('playBtn').classList.add('active'); $('pauseBtn').classList.remove('active'); };
window.pauseAnim = () => { playing = false; $('pauseBtn').classList.add('active'); $('playBtn').classList.remove('active'); };
window.cycleSpeed = () => { speedIdx = (speedIdx + 1) % speeds.length; simSpeed = speeds[speedIdx]; $('speedDisplay').textContent = simSpeed.toFixed(1) + 'x'; };
window.resetAnim = () => { ui.reviewing = false; endProcedure(); phys.reset(); ui.clearLog(); ui.hideDeath(); anatomy.showCutaway(false); anatomy.isolate(null); focus(...VIEWS.thorax.focus()); ui.toast('Simulation reset'); };
$('proc-help').addEventListener('click', () => { if (!current) return; const wasPlaying = playing; playing = false; ui.showGuide(GUIDES[current.name], () => { playing = wasPlaying; }); });
$('info-toggle').addEventListener('click', () => $('fact-hud').classList.toggle('show'));
// ---------- floating labels per view (anchors measured on the Blender model: assets/anatomy_extra.json) ----------
function labelsFor(view) {
  const B = (a) => new THREE.Vector3(...toThree(a)), E = extra;
  if (!E.heart) return null;
  const from = (obj, keys) => keys.filter(k => obj && obj[k]).map(k => ({ text: k, anchor: B(obj[k]) }));
  const front = (part, dx = 0) => { const b = baseBox(anatomy.parts[part]); const c = b.getCenter(new THREE.Vector3()); return new THREE.Vector3(c.x + dx, c.y, b.max.z); };
  const body = new THREE.Vector3(0, 1.0, 0);
  const L = (k) => E.limbs && E.limbs[k];
  switch (view) {
    case 'heart': return { list: from(E.heart, Object.keys(E.heart)), center: anatomy.heartCenter, reach: 0.03 };
    case 'cutaway': {
      const m = anatomy.cutawayModel; if (!m || !anatomy.cutaway.visible) return null; m.updateWorldMatrix(true, true);
      // still (non-morphing) copies of the cut heart: cheap occlusion tests (raycasting the beating mesh made the view lag)
      if (!cutOccluders) {
        cutOccluders = [];
        m.traverse(o => {
          if (!o.isMesh || o.isInstancedMesh) return;
          const g = new THREE.BufferGeometry(); g.setAttribute('position', o.geometry.attributes.position); g.setIndex(o.geometry.index);
          g.computeBoundingSphere(); g.boundingSphere.radius *= 1.3;
          const pm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); pm.matrixAutoUpdate = false; pm.matrixWorld = o.matrixWorld;
          cutOccluders.push(pm);
        });
      }
      return { list: Object.entries(E.cutaway).map(([k, p]) => ({ text: k, anchor: m.localToWorld(B(p)) })), center: anatomy.heartCenter, reach: 0.032,
        facing: new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld), occluders: () => (explode.amount > 0.02 ? [] : cutOccluders) };
    }
    case 'lungs': return { list: from(E.lungs, Object.keys(E.lungs)), center: anatomy.lungsCenter, reach: 0.06 };
    case 'thorax': return { list: [
      { text: 'Heart', anchor: B(E.heart['Right ventricle']) }, { text: 'Right lung', anchor: B(E.lungs['Right middle lobe']) },
      { text: 'Left lung', anchor: B(E.lungs['Left upper lobe']) }, { text: 'Trachea', anchor: B(E.lungs['Trachea']) },
      { text: 'Diaphragm', anchor: front('Diaphragm', 0.05) }, { text: 'Liver', anchor: front('Liver') }],
      center: anatomy.lungsCenter, reach: 0.11 };
    case 'skeleton': return { list: [...from(E.skeleton, ['Skull', 'Sternum', 'Spine (lumbar)', 'Humerus', 'Femur']), { text: 'Pelvis', anchor: front('Pelvis', -0.06) }, { text: 'Rib cage', anchor: front('Ribcage', 0.09) }], center: body, reach: 0.16 };
    case 'vessels': return { list: [
      { text: 'Aortic arch', anchor: B(ARTERIES.descending.pts[0]) }, { text: 'Descending aorta', anchor: B([-0.009, -0.060, 1.120]) },
      { text: 'Inferior vena cava', anchor: B([-0.006, -0.041, 1.189]), far: 1.4 }, { text: 'Superior vena cava', anchor: B(VEINS.rJugular.pts[4]) },
      { text: 'Common carotid', anchor: B([-0.048, -0.053, 1.492]) }, { text: 'Internal jugular', anchor: B([0.035, -0.054, 1.516]) },
      { text: 'Subclavian artery', anchor: B([0.051, -0.032, 1.406]) },
      ...(L('aLegR') ? [{ text: 'Femoral artery', anchor: B(L('aLegR')[14]) }] : []), ...(L('vLegL') ? [{ text: 'Femoral vein', anchor: B(L('vLegL')[14]) }] : []),
      ...(L('aArmL') ? [{ text: 'Brachial artery', anchor: B(L('aArmL')[14]) }] : [])], center: body, reach: 0.14 };
    case 'kidneys': {
      if (!kidneyFlow) return null;
      const A = kidneyFlow.anchors(), P = anatomy.parts;
      // front-most vertex of a mesh near (x, y): pins sit on the visible surface
      const surf = (mesh, x, y) => { let best = null, bs = -Infinity; const v = new THREE.Vector3(), pos = mesh.geometry.attributes.position; mesh.updateWorldMatrix(true, false);
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); const d = Math.hypot(v.x - x, v.y - y); const sc = v.z - d * 3; if (sc > bs) { bs = sc; best = v.clone(); } } return best; };
      const cR = baseBox(P.KidneyR).getCenter(new THREE.Vector3()), cL = baseBox(P.KidneyL).getCenter(new THREE.Vector3()), cB = baseBox(P.Bladder).getCenter(new THREE.Vector3());
      return { list: [
        { text: 'Abdominal aorta', anchor: A.aorta }, { text: 'Inferior vena cava (abdomen)', anchor: A.ivc },
        { text: 'Right kidney', anchor: surf(P.KidneyR, cR.x - 0.008, cR.y + 0.018) }, { text: 'Left kidney', anchor: surf(P.KidneyL, cL.x + 0.008, cL.y + 0.018) },
        { text: 'Renal cortex', anchor: surf(P.KidneyL, cL.x + 0.022, cL.y - 0.022) }, { text: 'Renal artery', anchor: A.arteryL }, { text: 'Renal vein', anchor: A.veinL },
        { text: 'Renal pelvis', anchor: surf(P.KidneyR, A.pelvisR.x, A.pelvisR.y) }, { text: 'Ureter', anchor: A.ureterL }, { text: 'Urinary bladder', anchor: surf(P.Bladder, cB.x, cB.y) },
      ], center: kidneyCenter(), reach: 0.05 };
    }
    case 'full': return { list: [
      ...from(E.skeleton, ['Skull', 'Humerus', 'Femur']), { text: 'Heart', anchor: B(E.heart['Right ventricle']) },
      { text: 'Lungs', anchor: B(E.lungs['Right upper lobe']) }, { text: 'Liver', anchor: front('Liver') }, { text: 'Pelvis', anchor: front('Pelvis', -0.06) },
      ...(anatomy.parts.KidneyL ? [{ text: 'Left kidney', anchor: front('KidneyL') }] : [])], center: body, reach: 0.2 };
  }
  return null;
}
function applyLabels() {
  if (!labels) return;
  const set = labelsOn && !current ? labelsFor(currentView) : null;
  if (set) labels.set(set.list.filter(it => it.anchor), set.center, set.reach, { facing: set.facing, occluders: set.occluders }); else labels.clear();
}
// Heart-only view: show the heart plus the blood within ~1 cm of it, not the whole body's circulation.
let heartClip = null, heartFlow = null;
function heartClipPlanes() {
  if (!heartClip) {
    const b = baseBox(anatomy.parts.Heart).expandByScalar(0.01);
    heartClip = [new THREE.Plane(new THREE.Vector3(1, 0, 0), -b.min.x), new THREE.Plane(new THREE.Vector3(-1, 0, 0), b.max.x),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -b.min.y), new THREE.Plane(new THREE.Vector3(0, -1, 0), b.max.y),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -b.min.z), new THREE.Plane(new THREE.Vector3(0, 0, -1), b.max.z)];
  }
  return heartClip;
}
let kidneyClip = null;
function boxPlanes(b) {
  return [new THREE.Plane(new THREE.Vector3(1, 0, 0), -b.min.x), new THREE.Plane(new THREE.Vector3(-1, 0, 0), b.max.x),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -b.min.y), new THREE.Plane(new THREE.Vector3(0, -1, 0), b.max.y),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -b.min.z), new THREE.Plane(new THREE.Vector3(0, 0, -1), b.max.z)];
}
// kidney view: only the aorta / vena cava segment around the kidneys, not the whole vessel tree
function kidneyClipPlanes() {
  if (!kidneyClip) {
    const b = new THREE.Box3(); for (const n of ['KidneyL', 'KidneyR', 'Bladder', 'UreterL', 'UreterR']) if (anatomy.parts[n]) b.union(baseBox(anatomy.parts[n]));
    b.expandByVector(new THREE.Vector3(0.012, 0.02, 0.03)); kidneyClip = boxPlanes(b);
  }
  return kidneyClip;
}
function setClip(planes) {
  const mats = [anatomy.parts.Arteries, anatomy.parts.Veins, circulation.blood, circulation.air, heartFlow && heartFlow.mesh].filter(Boolean).flatMap(m => Array.isArray(m.material) ? m.material : [m.material]);
  for (const m of mats) { if ((m.clippingPlanes || null) !== planes) { m.clippingPlanes = planes; m.needsUpdate = true; } }
}
function applyFlow() {
  const cut = anatomy.cutaway && anatomy.cutaway.visible;
  if (cutFlow) cutFlow.mesh.visible = cut && bloodOn;
  const heartOnly = !cut && currentView === 'heart', kid = !cut && currentView === 'kidneys';
  const exploded = explode.amount > 0.02; // particles follow the assembled anatomy, so they pause while it is pulled apart
  if (cutFlow) cutFlow.mesh.visible = cut && bloodOn && !exploded;
  // heart / kidney views: only that organ's own blood, not the whole-body loop or the body's vessel tree
  circulation.setMode(!cut && !heartOnly && !kid && bloodOn && !exploded, !cut && airOn && !exploded);
  anatomy.setXray(!cut && (bloodOn || airOn));
  if (heartOnly && (bloodOn || airOn)) { anatomy.parts.Arteries.visible = false; anatomy.parts.Veins.visible = false; }
  if (kid) { anatomy.parts.Arteries.visible = true; anatomy.parts.Veins.visible = true; }
  if (heartFlow) heartFlow.mesh.visible = heartOnly && bloodOn && !exploded;
  if (kidneyFlow) kidneyFlow.setVisible(kid && bloodOn && !exploded);
  setClip(heartOnly && (bloodOn || airOn) ? heartClipPlanes() : kid ? kidneyClipPlanes() : null);
  $('flowBtn').classList.toggle('active', bloodOn); $('airBtn').classList.toggle('active', airOn);
}
window.toggleAir = () => {
  airOn = !airOn; applyFlow();
  if (airOn) ui.setFact('Air flow', 'Pale dots = air. On each breath in, air travels down the trachea, splits at the carina into the main bronchi and fills the lobes; on breathing out it leaves the same way. A collapsed lung receives almost none.');
};
window.toggleLabels = () => { labelsOn = !labelsOn; $('labelBtn').classList.toggle('active', labelsOn); applyLabels(); };
window.toggleFlow = () => {
  bloodOn = !bloodOn; applyFlow();
  const flowOn = bloodOn;
  if (currentView === 'kidneys' && flowOn) { ui.setFact('Kidney blood and urine flow', 'Red: blood from the aorta enters each kidney and is filtered; it leaves blue into the vena cava. Amber: urine runs down the ureters in waves into the bladder. Low blood pressure stops urine.'); return; }
  ui.setFact(flowOn ? 'Blood and air flow' : 'Flow view off', flowOn ? 'Blue = deoxygenated blood (veins, right heart, pulmonary arteries). Red = oxygenated (pulmonary veins, left heart, aorta). The ventricles eject only in systole; the atria empty in diastole. Pale dots = air moving in and out of the trachea and bronchi with each breath.' : '');
};
// ---------- exploded view ----------
// body-wide meshes (vessel tree, skin) would set the scale for everything else, so they stay put except in the vessel view
function viewMeshes() { return anatomy.pickables().filter(m => m.visible && !m.isInstancedMesh && (currentView === 'vessels' || !['Arteries', 'Veins', 'Skin'].includes(m.userData.part))); }
let explodeMeshes = [];
function prepareExplode() {
  explode.reset(explodeMeshes);
  explodeMeshes = viewMeshes();
  const v = VIEWS[currentView]; const c = v && v.focus ? v.focus()[0] : controls.target;
  explode.setView(explodeMeshes, currentView === 'kidneys' ? kidneyCenter() : c);
  if (labels) labels.refreshOffsets();
}
function setExplode(k, silent) {
  explode.set(k);
  $('explodeSlider').value = Math.round(k * 100); $('explodeVal').textContent = Math.round(k * 100) + '%';
  if (anatomy.parts.Skin) anatomy.parts.Skin.visible = k > 0.02 ? false : (currentView === 'full' || currentView === 'thorax' ? LAYERS.skin.visible : anatomy.parts.Skin.visible);
  if (labels) labels.refreshOffsets();
  const ex = k > 0.02; if (!silent && ex !== wasExploded) applyFlow(); wasExploded = ex;
}
let wasExploded = false;
window.toggleExplode = () => {
  explodeOn = !explodeOn;
  $('explodeBtn').classList.toggle('active', explodeOn); $('explode-panel').classList.toggle('show', explodeOn);
  if (explodeOn) { prepareExplode(); animateExplode(0.6); zoomBy(1.3); ui.toast('Exploded view: drag the slider to pull the parts apart'); }
  else animateExplode(0);
};
let explodeAnim = null, isoAnim = null;
// Isolation: tapping a numbered pin spotlights that structure and fades the rest of the model to faint glass.
function isolate(item) {
  const meshes = anatomy.pickables().filter(m => m.visible && !m.isInstancedMesh && m.userData.part !== 'Skin');
  if (!meshes.length || !item) return;
  // focus radius scales with what is on screen: about a sixth of the view
  const r = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.11, 0.008, 0.25);
  explode.focus(meshes, item.anchor, r);
  isoAnim = { from: explode.iso.value, to: 1, t: 0 };
}
// pull the camera back (k > 1) or in, keeping the view direction, so the separated parts stay in frame
function zoomBy(k) { const dir = camera.position.clone().sub(controls.target); tween = { t: 0, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: controls.target.clone(), toP: controls.target.clone().add(dir.multiplyScalar(k)) }; }
function animateExplode(to) { explodeAnim = { from: explode.amount, to, t: 0 }; }
$('explodeSlider').addEventListener('input', e => { explodeAnim = null; setExplode(e.target.value / 100); });
$('death-retry').addEventListener('click', () => { ui.reviewing = false; const name = current && current.name; ui.hideDeath(); if (name) { current.end(); current = null; startProcedure(name); } else window.resetAnim(); });
$('death-close').addEventListener('click', () => { ui.reviewing = true; ui.hideDeath(); playing = false; $('pauseBtn').classList.add('active'); $('playBtn').classList.remove('active'); ui.toast('Reviewing the scene: rotate and zoom freely. Press ▶ or ⏮ to continue.'); });

// ---------- resize ----------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (current && current.air) current.air.setViewportHeight(renderer.domElement.height);
});

// ---------- boot ----------
// on phones, shift the rendered view up so the organ sits above the procedure panel
let viewShifted = null;
function updateViewOffset() {
  const want = innerWidth <= 720 && !$('proc').hidden;
  if (want === viewShifted) return;
  viewShifted = want;
  if (want) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.12, innerWidth, innerHeight);
  else camera.clearViewOffset();
}
addEventListener('resize', () => { viewShifted = null; });

const clock = new THREE.Clock();
function frame() {
  updateViewOffset();
  const raw = Math.min(clock.getDelta(), 0.05);
  const dt = playing ? raw * simSpeed : 0;
  updateTween(raw);
  phys.update(dt);
  anatomy.update(dt, phys, !playing);
  if (current) current.update(dt);
  circulation.update(dt, phys, camera);
  if (cutFlow) cutFlow.update(dt, phys);
  if (heartFlow) heartFlow.update(dt, phys);
  if (kidneyFlow) kidneyFlow.update(dt, phys);
  if (isoAnim) { isoAnim.t = Math.min(1, isoAnim.t + raw / 0.45); explode.iso.value = isoAnim.from + (isoAnim.to - isoAnim.from) * (1 - Math.pow(1 - isoAnim.t, 3)); if (isoAnim.t >= 1) { const d = isoAnim.done; isoAnim = null; if (d) d(); } }
  if (explodeAnim) { explodeAnim.t = Math.min(1, explodeAnim.t + raw / 0.7); const e = 1 - Math.pow(1 - explodeAnim.t, 3); setExplode(explodeAnim.from + (explodeAnim.to - explodeAnim.from) * e); if (explodeAnim.t >= 1) explodeAnim = null; }
  labels.update();
  if (phys.dead && !ui.reviewing) ui.showDeath(phys);
  ui.updateTelemetry(phys, dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

(async () => {
  try {
    ui.loading(0.05, 'Loading anatomy (4.5 MB)...');
    await anatomy.load(loader, p => ui.loading(0.05 + p * 0.9));
    ui.loading(1, 'Ready');
    try { extra = await (await fetch('assets/anatomy_extra.json')).json(); } catch { extra = {}; }
    circulation = new Circulation(scene, anatomy, phys, extra);
    heartFlow = new HeartFlow(scene, circulation);
    if (extra.kidney && anatomy.parts.KidneyL) { kidneyFlow = new KidneyFlow(scene, anatomy, extra.kidney); anatomy.setLayer('vessels', LAYERS.vessels.visible); }
    labels = new Labels(camera, () => anatomy.pickables());
    labels.offsetFn = (p, out) => explode.offsetAt(p, out);
    labels.onClose = () => { isoAnim = { from: explode.iso.value, to: 0, t: 0, done: () => explode.clearFocus() }; };
    // tapping a numbered pin turns the camera to face that structure (like Sketchfab annotations)
    labels.onSelect = (p, center, item) => {
      isolate(item);
      const dir = p.clone().sub(center); if (dir.lengthSq() < 1e-8) return;
      dir.normalize(); const cur = camera.position.clone().sub(controls.target).normalize();
      dir.lerp(cur, 0.35).normalize(); if (dir.z < 0.15 && currentView === 'cutaway') dir.z = 0.15;
      const dist = camera.position.distanceTo(controls.target) * 0.9;
      const toT = center.clone().lerp(p, 0.45);
      tween = { t: 0, fromT: controls.target.clone(), fromP: camera.position.clone(), toT, toP: toT.clone().addScaledVector(dir.normalize(), dist) };
    };
    buildDrawer();
    focus(...VIEWS.thorax.focus());
    camera.position.copy(tween.toP); controls.target.copy(tween.toT); tween = null;
    setTool('inspect');
    ui.hideLoading();
    applyLabels();
    window.AXIS = { get cutFlow() { return cutFlow; }, explode, get kidneyFlow() { return kidneyFlow; }, labels, toggleExplode: window.toggleExplode, THREE, scene, camera, controls, anatomy, phys, procedures, ui, circulation, pad, tremor, startProcedure, endProcedure, showView, get current() { return current; } };
    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    ui.fatal('Could not load the 3D models. Open AXIS through a local web server (see README), not by double-clicking index.html.');
  }
})();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
