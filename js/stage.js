// Reusable WebGL "model stage" used by the hero, inspector, furniture and archviz viewers.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MODELS } from './data.js';

const LITE = new URLSearchParams(location.search).has('lite');
export const manager = new THREE.LoadingManager();
const draco = new DRACOLoader(manager).setDecoderPath('vendor/draco/');
const gltfLoader = new GLTFLoader(manager).setDRACOLoader(draco);
const texLoader = new THREE.TextureLoader(manager);
const cache = new Map();

export function loadGLTF(key) {
  if (!cache.has(key)) {
    const cfg = MODELS[key];
    cache.set(key, new Promise((res, rej) => gltfLoader.load(cfg.file, res, undefined, rej)));
  }
  return cache.get(key);
}

const texCache = new Map();
function tex(url, srgb) {
  const k = url + srgb;
  if (!texCache.has(k)) {
    const t = texLoader.load(url);
    t.flipY = false;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(k, t);
  }
  return texCache.get(k);
}

// grayscale copy of a texture so fabric colourways can be tinted cleanly
const grayCache = new WeakMap();
function grayscale(texture) {
  if (!texture || !texture.image) return texture;
  if (grayCache.has(texture)) return grayCache.get(texture);
  const img = texture.image;
  const c = document.createElement('canvas');
  const w = (c.width = Math.min(1024, img.width)), h = (c.height = Math.min(1024, img.height));
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h), p = d.data;
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) sum += 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
  const mean = sum / (p.length / 4) || 128;
  for (let i = 0; i < p.length; i += 4) {
    const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
    const v = Math.max(0, Math.min(255, 200 + (l - mean) * 1.6));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = texture.flipY; t.wrapS = texture.wrapS; t.wrapT = texture.wrapT;
  t.repeat.copy(texture.repeat); t.offset.copy(texture.offset); t.anisotropy = 8;
  grayCache.set(texture, t);
  return t;
}

// Build a normalised, material-fixed instance of a model
export async function buildModel(key) {
  const cfg = MODELS[key];
  const gltf = await loadGLTF(key);
  const root = gltf.scene.clone(true);
  const pivot = new THREE.Group();
  const holder = new THREE.Group();
  holder.add(root);
  pivot.add(holder);
  holder.rotation.set(...(cfg.rot || [0, 0, 0]));

  root.traverse((o) => {
    if (!o.isMesh) return;
    if (cfg.hide && cfg.hide.some((n) => o.name.startsWith(n))) { o.visible = false; return; }
    o.castShadow = true; o.receiveShadow = true;
    const fix = (m) => {
      m = m.clone();
      if (m.emissiveIntensity > 6) m.emissiveIntensity = 6;
      if (cfg.glass && cfg.glass.includes(m.name)) {
        const g = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.02, thickness: 0.05, ior: 1.5, metalness: 0, transparent: true, opacity: 0.25 });
        g.name = m.name; m = g;
      }
      if (m.transmission > 0.5 && !(cfg.glass && cfg.glass.includes(m.name))) {
        m.thickness = m.thickness || 0.3;
        m.roughness = Math.min(m.roughness, 0.25);
      }
      if (cfg.recolor && cfg.recolor[m.name]) m.color = new THREE.Color(cfg.recolor[m.name]);
      if (cfg.fabric && cfg.fabric.includes(m.name)) {
        m.userData.fabric = true;
        if (m.map) { m.userData.srcMap = m.map; }
        m.roughness = 0.92; m.metalness = 0;
        if ('sheen' in m) { m.sheen = 0.35; m.sheenRoughness = 0.5; m.sheenColor = new THREE.Color('#ffffff'); }
      }
      if (cfg.tex) {
        m = new THREE.MeshStandardMaterial({
          map: tex(cfg.tex.map, true), normalMap: tex(cfg.tex.normal, false),
          roughnessMap: tex(cfg.tex.orm, false), metalnessMap: tex(cfg.tex.orm, false), aoMap: tex(cfg.tex.orm, false),
          metalness: 1, roughness: 1, name: m.name,
        });
      }
      if (cfg.clay) {
        m = new THREE.MeshStandardMaterial({ color: m.name === 'WINDOWS' ? '#1c2228' : '#f2efe9', roughness: m.name === 'WINDOWS' ? 0.15 : 0.55, metalness: m.name === 'WINDOWS' ? 0.6 : 0, name: m.name, side: THREE.DoubleSide });
      }
      m.userData.orig = true;
      return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    o.userData.origMat = o.material;
  });

  // normalise to a unit box
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = (cfg.fit || 2) / Math.max(size.x, size.y, size.z);
  holder.scale.setScalar(s);
  holder.position.copy(center).multiplyScalar(-s);
  holder.position.y += (cfg.y || 0);
  pivot.userData = { key, cfg, height: size.y * s, radius: Math.max(size.x, size.z) * s * 0.5, bottom: -size.y * s / 2 };

  // stats
  let tris = 0, meshes = 0; const mats = new Set();
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    meshes++;
    const g = o.geometry; tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m.name));
  });
  pivot.userData.stats = { tris: Math.round(tris), meshes, materials: mats.size };

  // explode data
  const parts = [];
  root.traverse((o) => { if (o.isMesh && o.visible) parts.push(o); });
  const mc = new THREE.Vector3();
  parts.forEach((p) => {
    const b = new THREE.Box3().setFromObject(p); b.getCenter(mc);
    p.userData.basePos = p.position.clone();
    p.userData.worldC = mc.clone();
  });
  pivot.userData.parts = parts;
  if (cfg.swatches) setColorway(pivot, cfg.swatches[0][1]);
  return pivot;
}

export function setColorway(model, hex) {
  model.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.userData.origMat) ? o.userData.origMat : [o.userData.origMat];
    list.forEach((m) => {
      if (!m || !m.userData.fabric) return;
      if (m.userData.srcMap) m.map = grayscale(m.userData.srcMap);
      m.color.set(hex);
      if (m.sheenColor) m.sheenColor.set(hex).lerp(new THREE.Color('#ffffff'), 0.35);
      m.needsUpdate = true;
    });
  });
}

const clayMat = new THREE.MeshStandardMaterial({ color: '#d9d4cb', roughness: 0.62, metalness: 0 });
const normalMat = new THREE.MeshNormalMaterial();
const wireMat = new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.55 });

export function setMode(model, mode, ink = '#ffffff') {
  wireMat.color.set(ink);
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (mode === 'textured') o.material = o.userData.origMat;
    else if (mode === 'clay') o.material = clayMat;
    else if (mode === 'normals') o.material = normalMat;
    else if (mode === 'wire') o.material = wireMat;
  });
}

export function explode(model, t) {
  const parts = model.userData.parts || [];
  const cfg = model.userData.cfg;
  if (!parts.length) return;
  if (cfg && cfg.explode) {
    // stack layers vertically (keyboard style): sort by world height
    const sorted = [...parts].sort((a, b) => a.userData.worldC.y - b.userData.worldC.y);
    const n = sorted.length;
    sorted.forEach((p, i) => {
      const parentScale = p.parent.getWorldScale(new THREE.Vector3()).x || 1;
      const lift = ((i - n / 2) * 0.22 * t) / parentScale;
      const up = new THREE.Vector3(0, 1, 0);
      p.position.copy(p.userData.basePos).addScaledVector(up, lift);
    });
  } else {
    const c = new THREE.Vector3();
    parts.forEach((p) => {
      const parentScale = p.parent.getWorldScale(new THREE.Vector3()).x || 1;
      const dir = p.userData.worldC.clone().sub(c);
      if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      dir.normalize();
      // convert to parent space direction approx (parents are mostly unrotated)
      p.position.copy(p.userData.basePos).addScaledVector(dir, (0.5 * t) / parentScale);
    });
  }
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.25)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); return t;
}

export class Stage {
  constructor(canvas, opts = {}) {
    this.opts = Object.assign({ orbit: false, drag: true, autoRotate: 0.25, shadow: true, fov: 30, distance: 5.2, realShadows: false, pixelRatio: 2, zoom: false }, opts);
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preserve, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(LITE ? 0.5 : Math.min(window.devicePixelRatio, this.opts.pixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (this.opts.realShadows) { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.9;
    this.camera = new THREE.PerspectiveCamera(this.opts.fov, 1, 0.01, 200);
    this.camera.position.set(0, 0.25, this.opts.distance);
    this.target = new THREE.Vector3(0, 0, 0);
    this.camera.lookAt(this.target);

    this.key = new THREE.DirectionalLight('#ffffff', 2.2); this.key.position.set(3, 4, 3);
    this.rim = new THREE.PointLight('#ff8a2a', 18, 12, 1.6); this.rim.position.set(-2.5, 1.5, -2.5);
    this.fill = new THREE.HemisphereLight('#ffffff', '#222222', 0.35);
    this.scene.add(this.key, this.rim, this.fill);
    if (this.opts.realShadows) {
      this.key.castShadow = true; this.key.shadow.mapSize.set(2048, 2048);
      const sc = this.key.shadow.camera; sc.left = sc.bottom = -3; sc.right = sc.top = 3; sc.near = 0.1; sc.far = 20;
      this.key.shadow.bias = -0.0005; this.key.shadow.normalBias = 0.02;
      this.ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.28 }));
      this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true; this.scene.add(this.ground);
    }

    this.turntable = new THREE.Group(); this.scene.add(this.turntable);
    if (this.opts.shadow && !this.opts.realShadows) {
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
      this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
    }

    this.model = null; this.visible = true; this.clock = new THREE.Clock();
    this.rotY = 0; this.velY = 0; this.tiltX = 0; this.tiltTarget = 0; this.mouse = { x: 0, y: 0 };
    this.floatAmp = this.opts.float ?? 0.04;

    if (this.opts.orbit) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true; this.controls.dampingFactor = 0.07;
      this.controls.enablePan = false; this.controls.enableZoom = this.opts.zoom;
      this.controls.minDistance = 1.6; this.controls.maxDistance = 12;
      this.controls.autoRotate = !!this.opts.autoRotate; this.controls.autoRotateSpeed = this.opts.autoRotate * 4;
      this.controls.target.copy(this.target);
    } else if (this.opts.drag) this._bindDrag();

    this._resize = this.resize.bind(this);
    window.addEventListener('resize', this._resize);
    this.resize();
    this.io = new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; }, { threshold: 0 });
    this.io.observe(canvas);
    this._loop = this.loop.bind(this);
    this.running = true;
    this.renderer.setAnimationLoop(this._loop);
  }

  _bindDrag() {
    let down = false, lx = 0, ly = 0;
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => { down = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); this.dragging = true; });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!down) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      this.velY = dx * 0.0065; this.rotY += dx * 0.0065;
      this.tiltTarget = Math.max(-0.5, Math.min(0.5, this.tiltTarget + dy * 0.004));
    });
    const up = () => { down = false; this.dragging = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { this.mouse.x = 0; this.mouse.y = 0; });
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the model framed on narrow screens
    const base = this.opts.distance;
    if (!this.opts.orbit) this.camera.position.setLength(base * (this.camera.aspect < 0.8 ? 1.45 : this.camera.aspect < 1.2 ? 1.15 : 1));
    const ox = typeof this.opts.offsetX === 'function' ? this.opts.offsetX(w, h) : (this.opts.offsetX || 0);
    const oy = typeof this.opts.offsetY === 'function' ? this.opts.offsetY(w, h) : (this.opts.offsetY || 0);
    if (ox || oy) this.camera.setViewOffset(w, h, ox, oy, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  setColors({ glow, dark }) {
    this.rim.color.set(glow || '#ffffff');
    this.rim.intensity = dark ? 22 : 8;
    this.key.intensity = dark ? 2.0 : 2.6;
    this.scene.environmentIntensity = dark ? 0.75 : 1.0;
    this.fill.intensity = dark ? 0.25 : 0.55;
    if (this.shadow) this.shadow.material.opacity = dark ? 0.9 : 0.55;
  }

  async show(key, { animate = true } = {}) {
    const token = (this._token = Symbol());
    const m = await buildModel(key);
    if (token !== this._token) return null;
    const old = this.model;
    this.model = m;
    m.userData.intro = animate ? 0 : 1;
    this.turntable.add(m);
    if (this.shadow) {
      const r = Math.max(m.userData.radius * 2.6, 1.2);
      this.shadow.scale.set(r, r, 1);
      this.shadow.position.y = m.userData.bottom - 0.01;
    }
    if (this.ground) this.ground.position.y = m.userData.bottom - 0.001;
    if (this._old) { this.turntable.remove(this._old); dispose(this._old); this._old = null; }
    if (old) { old.userData.outro = 0; this._old = old; }
    return m;
  }

  loop() {
    if (!this.visible || !this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    if (this.controls) this.controls.update();
    else {
      if (!this.dragging) { this.velY *= 0.94; this.rotY += this.velY + this.opts.autoRotate * dt; this.tiltTarget *= 0.97; }
      this.turntable.rotation.y = this.rotY;
      this.tiltX += (this.tiltTarget + this.mouse.y * 0.08 - this.tiltX) * 0.08;
      this.turntable.rotation.x = this.tiltX;
      this.turntable.rotation.z += (-this.mouse.x * 0.05 - this.turntable.rotation.z) * 0.06;
    }
    const m = this.model;
    if (m) {
      if (m.userData.intro < 1) {
        m.userData.intro = Math.min(1, m.userData.intro + dt * 1.4);
        const e = 1 - Math.pow(1 - m.userData.intro, 3);
        m.scale.setScalar(0.6 + 0.4 * e);
        m.rotation.y = (1 - e) * -1.6;
        m.position.y = (1 - e) * -0.6;
        m.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((x) => { if (!x) return; x.transparent = x.transparent || e < 1; x.opacity = x.userData._op ?? (x.userData._op = x.opacity); x.opacity = x.userData._op * e; }); } });
        if (e >= 1) m.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((x) => { if (!x) return; x.opacity = x.userData._op ?? 1; if (!(x.transmission > 0) && x.userData._op === 1) x.transparent = false; }); });
      }
      if (this.floatAmp) m.position.y += (Math.sin(t * 1.2) * this.floatAmp - (m.userData._fy || 0));
      m.userData._fy = Math.sin(t * 1.2) * this.floatAmp;
    }
    const o = this._old;
    if (o) {
      o.userData.outro += dt * 2.2;
      const e = Math.min(1, o.userData.outro);
      o.scale.setScalar(1 - 0.5 * e); o.position.y = e * 0.8; o.rotation.y = e * 1.4;
      if (e >= 1) { this.turntable.remove(o); this._old = null; dispose(o); }
    }
    if (this.onFrame) this.onFrame(dt, t);
    this.renderer.render(this.scene, this.camera);
  }

  screenshot() { this.renderer.render(this.scene, this.camera); return this.canvas.toDataURL('image/png'); }

  destroy() {
    this.running = false; this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._resize); this.io.disconnect();
    if (this.controls) this.controls.dispose();
    if (this.model) dispose(this.model);
    this.renderer.dispose();
  }
}

function dispose(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      // geometries are shared with the cached GLTF, materials are clones
      const ms = Array.isArray(o.userData.origMat) ? o.userData.origMat : [o.userData.origMat];
      ms.forEach((m) => m && m.dispose && m.dispose());
    }
  });
}
