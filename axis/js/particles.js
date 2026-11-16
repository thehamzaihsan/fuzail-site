import * as THREE from 'three';

// ---------- Blood cells flowing along a curve (InstancedMesh) ----------
export class BloodFlow {
  constructor(scene, radius, count = 140) {
    this.count = count; this.radius = radius;
    const geo = new THREE.SphereGeometry(radius * 0.26, 7, 5);
    geo.scale(1, 0.55, 1); // flattened like red cells
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, emissive: 0x330000 });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.p = [];
    for (let i = 0; i < count; i++) this.p.push({ u: Math.random(), a: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * 0.6, spin: Math.random() * 6 });
    this.colOxy = new THREE.Color(0xd81e1e); this.colDeoxy = new THREE.Color(0x5b2a7a);
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, this.colOxy);
    scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this._c = new THREE.Color();
  }

  // frames: {curve, frames} ; flow: 0..1 ; lesionU: position of the narrowing ; blocked: whether narrowing restricts
  // Physically: a narrowing limits how many cells get through per second. Cells arriving faster than the
  // narrowing can pass them queue up and stagnate BEFORE the plaque; the few that get through shoot across the
  // throat as a fast jet, and the artery beyond is under-filled (sparse cells = poor perfusion).
  update(dt, curve, frames, flow, lesionU, pulse) {
    const N = frames.tangents.length - 1;
    const v0 = 0.22 * (0.75 + 0.5 * pulse);           // normal velocity (path fractions per second)
    const gate = lesionU - 0.035;                       // proximal shoulder of the plaque
    this.release = (this.release || 0) + Math.max(0, flow) * 42 * dt * (0.6 + 0.8 * pulse); // cells/s the lumen lets through
    // queue: cells that have not passed yet, nearest the gate first
    const waiting = this.p.filter(q => !q.passed).sort((a, b) => b.u - a.u);
    const gap = 0.0075;
    waiting.forEach((q, k) => { q.maxU = gate - k * gap / (1 + 1.5 * q.r); });
    for (let i = 0; i < this.count; i++) {
      const q = this.p[i];
      if (!q.passed) {
        q.u = Math.max(0, Math.min(q.u + v0 * dt, q.maxU ?? 1)); // a long queue backs up into the left main (u = 0)
        if (q.u >= gate - 1e-4 && this.release >= 1) { this.release -= 1; q.passed = true; }
        q.stall = q.u >= (q.maxU ?? 1) - 1e-4 ? Math.min(1, (q.stall || 0) + dt) : Math.max(0, (q.stall || 0) - dt * 2);
      } else {
        const inJet = q.u < lesionU + 0.05;
        q.u += v0 * dt * (inJet ? 1 + 3.5 * (1 - flow) : 1); // jet through the throat, normal speed beyond
        q.stall = 0;
      }
      q.maxU = undefined;
      if (q.u > 1) { q.u -= 1; q.passed = false; q.a = Math.random() * Math.PI * 2; q.r = Math.sqrt(Math.random()) * 0.6; }
      q.spin += dt * 4 * (1 - 0.8 * (q.stall || 0));
      const idx = Math.min(N, Math.round(q.u * N));
      curve.getPointAt(q.u, this._v);
      const nrm = frames.normals[idx], bin = frames.binormals[idx];
      const squeeze = 1 - 0.8 * (1 - flow) * Math.exp(-((q.u - lesionU) ** 2) / 0.0012); // through the narrow lumen
      const rr = q.r * this.radius * squeeze;
      this._v.addScaledVector(nrm, Math.cos(q.a) * rr).addScaledVector(bin, Math.sin(q.a) * rr);
      this._q.setFromAxisAngle(frames.tangents[idx], q.spin);
      this._m.compose(this._v, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      // stagnant cells darken (pooled, deoxygenating blood); moving blood stays bright red
      this._c.copy(this.colOxy).lerp(this.colDeoxy, 0.55 * (q.stall || 0));
      this.mesh.setColorAt(i, this._c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() { this.mesh.parent && this.mesh.parent.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// ---------- Air bubbles (Points with soft sprite) ----------
function bubbleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.15)');
  grd.addColorStop(0.7, 'rgba(200,235,255,0.55)');
  grd.addColorStop(0.9, 'rgba(255,255,255,0.95)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(24, 22, 5, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class AirParticles {
  constructor(scene, max = 600, size = 0.0045, tint = 0xffffff, blending = THREE.NormalBlending) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.scale = new Float32Array(max);
    this.vel = Array.from({ length: max }, () => new THREE.Vector3());
    this.life = new Float32Array(max); this.age = new Float32Array(max);
    this.target = Array.from({ length: max }, () => null);
    this.alive = new Uint8Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pscale', new THREE.BufferAttribute(this.scale, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: bubbleTexture() }, size: { value: size }, scale: { value: 800 }, tint: { value: new THREE.Color(tint) } },
      vertexShader: `attribute float alpha; attribute float pscale; varying float vA; uniform float size; uniform float scale;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = size * pscale * scale / -mv.z; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 tint; varying float vA; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb * tint, c.a * vA); if(gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false; this.points.renderOrder = 20;
    scene.add(this.points);
    this.acc = 0;
  }

  setViewportHeight(h) { this.points.material.uniforms.scale.value = h; }

  spawn(p, v, life = 2.5, target = null) {
    for (let i = 0; i < this.max; i++) if (!this.alive[i]) {
      this.alive[i] = 1; this.pos.set([p.x, p.y, p.z], i * 3); this.vel[i].copy(v);
      this.life[i] = life * (0.7 + 0.6 * Math.random()); this.age[i] = 0; this.scale[i] = 0.6 + Math.random() * 0.9;
      this.target[i] = target; if (this.home) this.home[i] = null; return i;
    }
    return -1;
  }

  // emitter(): called with (spawn) — the procedure decides where bubbles come from
  update(dt, rate, emitter) {
    this.acc += rate * dt;
    while (this.acc >= 1) { this.acc -= 1; emitter && emitter(this); }
    const tmp = new THREE.Vector3();
    for (let i = 0; i < this.max; i++) {
      if (!this.alive[i]) { this.alpha[i] = 0; continue; }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) { this.alive[i] = 0; this.alpha[i] = 0; continue; }
      if (this.home && this.home[i]) { // settle at a home position (pleural gap) with a little jiggle
        const h = this.home[i];
        this.vel[i].set((h.x - this.pos[i * 3]) * 2, (h.y - this.pos[i * 3 + 1]) * 2, (h.z - this.pos[i * 3 + 2]) * 2);
      } else if (this.target[i]) { // steer toward a drain point, then out along the drain
        tmp.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
        const tg = this.target[i];
        const d = tg.point.clone().sub(tmp);
        if (d.length() < 0.004) this.vel[i].copy(tg.out).multiplyScalar(0.06);
        else this.vel[i].lerp(d.normalize().multiplyScalar(0.045), Math.min(1, dt * 4));
      } else {
        this.vel[i].multiplyScalar(1 - 0.9 * dt);
        this.vel[i].y += 0.004 * dt; // air drifts upward (toward the apex)
      }
      this.pos[i * 3] += this.vel[i].x * dt; this.pos[i * 3 + 1] += this.vel[i].y * dt; this.pos[i * 3 + 2] += this.vel[i].z * dt;
      this.alpha[i] = Math.min(1, t * 6) * (this.life[i] === Infinity ? 1 : (1 - t * t)) * 0.9;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.pscale.needsUpdate = true;
  }

  clear() { this.alive.fill(0); this.alpha.fill(0); }
  count() { let n = 0; for (let i = 0; i < this.max; i++) n += this.alive[i]; return n; }
  // release the newest settled particles toward a target (vent / drain)
  release(n, target) { for (let i = this.max - 1; i >= 0 && n > 0; i--) if (this.alive[i] && this.home && this.home[i]) { this.home[i] = null; this.target[i] = target; this.life[i] = this.age[i] + 2.5; n--; } }
  dispose() { this.points.parent && this.points.parent.remove(this.points); this.points.geometry.dispose(); this.points.material.dispose(); }
}

// ---------- Point cloud driven directly by the caller (pleural air, pooled blood, pericardial blood) ----------
export class PointCloud {
  constructor(scene, max, size, tint, soft = true) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.alpha = new Float32Array(max); this.scale = new Float32Array(max).fill(1);
    for (let i = 0; i < max; i++) this.scale[i] = 0.6 + Math.random() * 0.9;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pscale', new THREE.BufferAttribute(this.scale, 1));
    const tex = soft ? bubbleTexture() : (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 2, 16, 16, 15); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); return t; })();
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, size: { value: size }, scale: { value: 800 }, tint: { value: new THREE.Color(tint) } },
      vertexShader: `attribute float alpha; attribute float pscale; varying float vA; uniform float size; uniform float scale;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * pscale * scale / -mv.z; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 tint; varying float vA; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(c.rgb * tint, c.a * vA); if(gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false,
    }));
    this.points.frustumCulled = false; this.points.renderOrder = 21;
    scene.add(this.points);
  }
  setViewportHeight(h) { this.points.material.uniforms.scale.value = h; }
  set(i, v, a) { this.pos[i * 3] = v.x; this.pos[i * 3 + 1] = v.y; this.pos[i * 3 + 2] = v.z; this.alpha[i] = a; }
  hide(i) { this.alpha[i] = 0; }
  commit() { const g = this.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; }
  dispose() { this.points.parent && this.points.parent.remove(this.points); this.points.geometry.dispose(); this.points.material.dispose(); }
}
