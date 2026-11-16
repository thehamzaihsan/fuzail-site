import * as THREE from 'three';

// Layer groups map to node names in assets/thorax.glb (exported from Human_Anotumy_AXIS.blend)
export const LAYERS = {
  skin: { label: 'Skin', parts: ['Skin'], visible: true },
  skeleton: { label: 'Skeleton', parts: ['Ribcage', 'Spine', 'Skull', 'Pelvis', 'Arms', 'Legs'], visible: true },
  vessels: { label: 'Blood vessels', parts: ['Arteries', 'Veins', 'RenalArteryL', 'RenalArteryR', 'RenalVeinL', 'RenalVeinR'], visible: false },
  organs: { label: 'Organs', parts: ['Heart', 'Lungs', 'Diaphragm', 'Liver'], visible: true },
  urinary: { label: 'Kidneys and urinary tract', parts: ['KidneyL', 'KidneyR', 'UreterL', 'UreterR', 'Bladder'], visible: true },
};

export const FACTS = {
  Heart: ['Heart', 'Four-chambered muscular pump, about 300 g. Pumps roughly 5 L of blood per minute at rest. The left anterior descending (LAD) artery supplies the front wall of the left ventricle.'],
  Lungs: ['Lungs', 'Right lung has 3 lobes, left lung 2. Held open by negative pressure in the pleural space; air entering that space (pneumothorax) lets the lung collapse.'],
  Diaphragm: ['Diaphragm', 'Main muscle of breathing. It contracts and flattens on inspiration, enlarging the chest cavity and drawing air in.'],
  Liver: ['Liver', 'Largest internal organ (about 1.5 kg), sitting under the right dome of the diaphragm.'],
  Ribcage: ['Rib cage', '12 pairs of ribs and the sternum protect the heart and lungs. Chest needles are inserted just above a rib to avoid the vessels running under each rib.'],
  Spine: ['Vertebral column', '33 vertebrae; the thoracic vertebrae anchor the ribs.'],
  Arteries: ['Arteries', 'Carry oxygenated blood away from the heart (except the pulmonary arteries).'],
  Veins: ['Veins', 'Return deoxygenated blood to the heart.'],
  Skin: ['Skin', 'Outer layer, shown semi-transparent so the organs stay visible.'],
  Skull: ['Skull', 'Protects the brain.'], Pelvis: ['Pelvis', 'Connects the spine to the legs.'],
  Arms: ['Upper limb bones', ''], Legs: ['Lower limb bones', ''],
  KidneyL: ['Left kidney', 'Filters the blood: about a fifth of each heartbeat\'s output passes through the two kidneys, and they make 1–2 litres of urine a day.'],
  KidneyR: ['Right kidney', 'Sits a little lower than the left kidney, under the liver. Blood enters by the renal artery and leaves by the renal vein.'],
  UreterL: ['Left ureter', 'Muscular tube carrying urine from the kidney to the bladder in peristaltic waves.'],
  UreterR: ['Right ureter', 'Muscular tube carrying urine from the kidney to the bladder in peristaltic waves.'],
  Bladder: ['Urinary bladder', 'Stores urine; holds about 400–600 mL.'],
  RenalArteryL: ['Left renal artery', 'Branch of the abdominal aorta supplying the left kidney.'], RenalArteryR: ['Right renal artery', 'Branch of the abdominal aorta supplying the right kidney.'],
  RenalVeinL: ['Left renal vein', 'Drains the left kidney into the inferior vena cava, crossing in front of the aorta.'], RenalVeinR: ['Right renal vein', 'Short vein draining the right kidney into the inferior vena cava.'],
  Ventricles: ['Ventricles (cut-away)', 'Left and right ventricles shown in section, with valves and papillary muscles. The beat here is the model\'s own 26-frame cycle, scaled to the live heart rate.'],
  LeftAtrium: ['Left atrium', 'Receives oxygenated blood from the pulmonary veins.'],
  RightAtrium: ['Right atrium', 'Receives deoxygenated blood from the venae cavae.'],
};

// bounding box of the rest pose only (Box3.setFromObject also includes morph-target extremes)
export function baseBox(root) {
  const box = new THREE.Box3(), b = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse(o => {
    if (o.isMesh) { b.setFromBufferAttribute(o.geometry.attributes.position).applyMatrix4(o.matrixWorld); box.union(b); }
  });
  return box;
}

export class Anatomy {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); this.root.name = 'Thorax';
    this.parts = {};
    this.cutaway = null; this.mixer = null;
    this.highlighted = null; this.highlightT = 0;
    this.ischemiaUniforms = { uIschCenter: { value: new THREE.Vector3() }, uIschRadius: { value: 0.03 }, uIsch: { value: 0 } };
    scene.add(this.root);
  }

  async load(loader, onProgress) {
    const gltf = await loader.loadAsync('assets/thorax.glb', e => onProgress && e.total && onProgress(e.loaded / e.total));
    this.root.add(gltf.scene);
    gltf.scene.traverse(o => {
      if (o.isMesh) {
        this.parts[o.name] = o;
        o.userData.part = o.name;
        o.material = o.material.clone();
        o.userData.baseEmissive = o.material.emissive ? o.material.emissive.clone() : new THREE.Color(0);
        o.frustumCulled = false; // morph targets move vertices outside the static bounds
      }
    });
    // kidneys and urinary tract (from the anatomy pack's urinary system, same body coordinates)
    try {
      const k = await loader.loadAsync('assets/kidneys.glb');
      this.root.add(k.scene);
      k.scene.traverse(o => { if (o.isMesh) { this.parts[o.name] = o; o.userData.part = o.name; o.material = o.material.clone(); o.userData.baseEmissive = o.material.emissive ? o.material.emissive.clone() : new THREE.Color(0); } });
    } catch (e) { console.warn('kidneys.glb not loaded', e); }
    const skin = this.parts.Skin;
    if (skin) {
      Object.assign(skin.material, { transparent: true, opacity: 0.16, depthWrite: false });
      skin.renderOrder = 10;
    }
    for (const k of Object.keys(LAYERS)) this.setLayer(k, LAYERS[k].visible);
    this.heart = this.parts.Heart; this.lungs = this.parts.Lungs; this.diaphragm = this.parts.Diaphragm;
    this.idx = {
      systole: this.heart.morphTargetDictionary.AXIS_Systole,
      inhale: this.lungs.morphTargetDictionary.AXIS_Inhale,
      exhale: this.lungs.morphTargetDictionary.AXIS_Exhale,
      colR: this.lungs.morphTargetDictionary.AXIS_CollapseR,
      colL: this.lungs.morphTargetDictionary.AXIS_CollapseL,
      dIn: this.diaphragm.morphTargetDictionary.AXIS_Inhale,
      dEx: this.diaphragm.morphTargetDictionary.AXIS_Exhale,
    };
    this.heart.morphTargetInfluences.fill(0);
    this.lungs.morphTargetInfluences.fill(0);
    this.installIschemiaShader(this.heart.material);
    this.heartCenter = baseBox(this.heart).getCenter(new THREE.Vector3());
    this.lungsBox = baseBox(this.lungs);
    this.lungsCenter = this.lungsBox.getCenter(new THREE.Vector3());
    this.buildIndices();
    return gltf;
  }

  // ---------- geometry helpers used by the procedures ----------
  restWorld(mesh, i, out = new THREE.Vector3()) { return out.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld); }
  morphedWorld(mesh, i, out = new THREE.Vector3()) {
    const g = mesh.geometry, m = g.morphAttributes.position || [], inf = mesh.morphTargetInfluences || [];
    out.fromBufferAttribute(g.attributes.position, i);
    for (let k = 0; k < m.length; k++) if (inf[k]) { out.x += m[k].getX(i) * inf[k]; out.y += m[k].getY(i) * inf[k]; out.z += m[k].getZ(i) * inf[k]; }
    return out.applyMatrix4(mesh.matrixWorld);
  }

  buildIndices() {
    this.root.updateWorldMatrix(true, true);
    // rib vertices in a 5 mm hash grid (intercostal neurovascular bundle runs under each rib)
    const rib = this.parts.Ribcage, v = new THREE.Vector3();
    this.ribGrid = new Map(); this.cell = 0.005;
    const key = (x, y, z) => `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)},${Math.floor(z / this.cell)}`;
    this._key = key;
    const pos = rib.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      this.restWorld(rib, i, v);
      const k = key(v.x, v.y, v.z); if (!this.ribGrid.has(k)) this.ribGrid.set(k, []); this.ribGrid.get(k).push(v.x, v.y, v.z);
    }
    // lung vertices per side (patient's right = -X) + the lowest quarter for pooling blood
    const lp = this.lungs.geometry.attributes.position, cx = this.lungsCenter.x;
    this.lungSide = { L: [], R: [] }; this.lungBase = { L: [], R: [] };
    const ys = [];
    for (let i = 0; i < lp.count; i++) { this.restWorld(this.lungs, i, v); if (Math.abs(v.x - cx) < 0.02) continue; const s = v.x < cx ? 'R' : 'L'; this.lungSide[s].push(i); ys.push(v.y); }
    const yCut = this.lungsBox.min.y + (this.lungsBox.max.y - this.lungsBox.min.y) * 0.3;
    for (const s of ['L', 'R']) this.lungBase[s] = this.lungSide[s].filter(i => this.restWorld(this.lungs, i, v).y < yCut);
    // static (rest pose) copy of the lungs = parietal pleura / inner chest wall, used for ray tests
    this.pleura = new THREE.Mesh(this.lungs.geometry.clone(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    this.pleura.geometry.morphAttributes = {};
    this.pleura.matrixAutoUpdate = false; this.pleura.matrix.copy(this.lungs.matrixWorld); this.pleura.matrixWorld.copy(this.lungs.matrixWorld);
    this.heartVerts = this.heart.geometry.attributes.position.count;
  }

  nearestRib(p, r = 0.006) {
    const c = this.cell, n = Math.ceil(r / c); let best = null, bd = r * r;
    const ix = Math.floor(p.x / c), iy = Math.floor(p.y / c), iz = Math.floor(p.z / c);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (let d = -n; d <= n; d++) {
      const arr = this.ribGrid.get(`${ix + a},${iy + b},${iz + d}`); if (!arr) continue;
      for (let k = 0; k < arr.length; k += 3) {
        const dx = arr[k] - p.x, dy = arr[k + 1] - p.y, dz = arr[k + 2] - p.z, dd = dx * dx + dy * dy + dz * dz;
        if (dd < bd) { bd = dd; best = new THREE.Vector3(arr[k], arr[k + 1], arr[k + 2]); }
      }
    }
    return best ? { d: Math.sqrt(bd), p: best } : null;
  }

  // X-ray view for the blood/air flow: organs become glass so the particles inside are visible
  setXray(on) {
    const glass = { Heart: 0.28, Lungs: 0.2, Diaphragm: 0.2, Arteries: 0.35, Veins: 0.35, Ribcage: 0.25, Liver: 0.3, Spine: 0.4, Skin: 0.06,
      KidneyL: 0.3, KidneyR: 0.3, UreterL: 0.45, UreterR: 0.45, Bladder: 0.3, RenalArteryL: 0.45, RenalArteryR: 0.45, RenalVeinL: 0.45, RenalVeinR: 0.45 };
    for (const [name, op] of Object.entries(glass)) {
      const m = this.parts[name]; if (!m) continue;
      const mat = m.material;
      if (on) {
        if (!m.userData.solid) m.userData.solid = { transparent: mat.transparent, opacity: mat.opacity, depthWrite: mat.depthWrite };
        Object.assign(mat, { transparent: true, opacity: op, depthWrite: false }); mat.needsUpdate = true;
      } else if (m.userData.solid) { Object.assign(mat, m.userData.solid); mat.needsUpdate = true; }
    }
    this.xray = on;
    if (on) { this.parts.Arteries.visible = true; this.parts.Veins.visible = true; }
    else this.setLayer('vessels', LAYERS.vessels.visible);
  }

  async loadCutaway(loader) {
    if (this.cutaway) return this.cutaway;
    const gltf = await loader.loadAsync('assets/heart_cutaway.glb');
    const g = new THREE.Group(); g.name = 'HeartCutaway';
    const model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.userData.part = o.name; o.frustumCulled = false; this.parts[o.name] = o; o.userData.baseEmissive = o.material.emissive.clone(); } });
    // fit the cut-away heart into the chest at the same size as the body heart
    const box = baseBox(model);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const hs = baseBox(this.heart).getSize(new THREE.Vector3());
    const s = Math.max(hs.x, hs.y, hs.z) / Math.max(size.x, size.y, size.z);
    model.position.sub(c);
    g.add(model); g.scale.setScalar(s); g.position.copy(this.heartCenter); this.cutawayModel = model;
    g.visible = false;
    this.scene.add(g);
    this.mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations.find(a => a.name === 'Heartbeat') || gltf.animations[0];
    if (clip) { this.beatAction = this.mixer.clipAction(clip); this.beatAction.play(); this.clipDuration = clip.duration; }
    this.cutaway = g;
    return g;
  }

  showCutaway(on) {
    if (this.cutaway) this.cutaway.visible = on;
    this.root.visible = !on;
  }

  installIschemiaShader(mat) {
    const U = this.ischemiaUniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, U);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAxWorld;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvAxWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAxWorld;\nuniform vec3 uIschCenter; uniform float uIschRadius; uniform float uIsch;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          float axD = distance(vAxWorld, uIschCenter);
          float axW = uIsch * (1.0 - smoothstep(uIschRadius * 0.35, uIschRadius, axD));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * vec3(0.42, 0.40, 0.70) + vec3(0.03, 0.02, 0.08), axW);`);
    };
    mat.needsUpdate = true;
  }

  setLayer(key, visible) {
    LAYERS[key].visible = visible;
    for (const p of LAYERS[key].parts) if (this.parts[p]) this.parts[p].visible = visible;
  }

  isolate(names) {
    for (const [k, l] of Object.entries(LAYERS)) for (const p of l.parts) if (this.parts[p]) this.parts[p].visible = names ? names.includes(p) : l.visible;
  }

  highlight(mesh) {
    if (this.highlighted && this.highlighted.material.emissive) this.highlighted.material.emissive.copy(this.highlighted.userData.baseEmissive);
    this.highlighted = mesh; this.highlightT = 0;
  }

  pickables() {
    const arr = [];
    const scan = (root) => root.traverse(o => { if (o.isMesh && o.visible && o.userData.part && o.userData.part !== 'Skin') arr.push(o); });
    if (this.root.visible) scan(this.root);
    if (this.cutaway && this.cutaway.visible) scan(this.cutaway);
    return arr;
  }

  update(dt, phys, paused) {
    const i = this.idx;
    this.heart.morphTargetInfluences[i.systole] = phys.systole;
    const collapse = Math.max(phys.collapse.L, phys.collapse.R);
    // gentle tidal breathing (the AXIS_Inhale key is a deep breath; normal tidal volume is ~40% of it)
    const inh = 0.4 * phys.inhale * (1 - 0.6 * collapse);
    const L = this.lungs.morphTargetInfluences;
    L[i.inhale] = inh; L[i.exhale] = 0.18 * (1 - phys.inhale);
    L[i.colR] = phys.collapse.R; L[i.colL] = phys.collapse.L;
    const D = this.diaphragm.morphTargetInfluences;
    D[i.dIn] = 0.5 * phys.inhale; D[i.dEx] = 0.18 * (1 - phys.inhale);
    this.ischemiaUniforms.uIsch.value = phys.ischemia;
    if (this.mixer && this.cutaway && this.cutaway.visible) {
      this.mixer.timeScale = phys.hr / 72;
      this.mixer.update(paused ? 0 : dt);
    }
    if (this.highlighted && this.highlighted.material.emissive) {
      this.highlightT += dt;
      const k = 0.25 + 0.2 * Math.sin(this.highlightT * 5);
      this.highlighted.material.emissive.setRGB(0.05 + k * 0.4, 0.25 * k + 0.05, 0.6 * k);
      if (this.highlightT > 2.4) this.highlight(null);
    }
  }
}
