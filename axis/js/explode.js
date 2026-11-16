import * as THREE from 'three';

// Exploded view. Every mesh is split (once, lazily) into its connected pieces: the heart into its chambers and great
// vessels, the lungs into left, right and airway, the skeleton into its bones, the kidney set into kidneys, ureters and
// bladder. Each piece gets a per-vertex offset (attribute aExp) pointing away from the view's centre, and the vertex
// shader adds aExp * uExplode after the morph targets, so pieces separate smoothly while the heart keeps beating and the
// lungs keep breathing. Labels ask offsetAt() so their pins travel with their piece.
export class Explode {
  constructor() {
    this.u = { value: 0 };
    this.iso = { value: 0 };          // 0..1: how strongly everything outside the focused part is faded
    this.isoMeshes = [];
    this.samples = []; // [{ p: world pos, d: world displacement }] for label lookup
    this.meshes = [];
  }

  // split a mesh into connected pieces (vertices welded by position so UV seams don't break pieces apart)
  islands(mesh) {
    if (mesh.userData.expIslands) return mesh.userData.expIslands;
    const g = mesh.geometry, P = g.attributes.position, n = P.count;
    const weld = new Map(), wid = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const k = `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
      let w = weld.get(k); if (w === undefined) { w = weld.size; weld.set(k, w); } wid[i] = w;
    }
    const par = new Int32Array(weld.size).map((_, i) => i);
    const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const idx = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
    for (let t = 0; t < idx.length; t += 3) {
      const a = find(wid[idx[t]]), b = find(wid[idx[t + 1]]), c = find(wid[idx[t + 2]]);
      par[b] = a; par[c] = a;
    }
    const map = new Map(), of = new Int32Array(n), cen = [];
    for (let i = 0; i < n; i++) {
      const r = find(wid[i]); let id = map.get(r);
      if (id === undefined) { id = cen.length; map.set(r, id); cen.push({ c: new THREE.Vector3(), n: 0 }); }
      of[i] = id; cen[id].c.x += P.getX(i); cen[id].c.y += P.getY(i); cen[id].c.z += P.getZ(i); cen[id].n++;
    }
    // tiny fragments (a few stray triangles) follow the nearest big piece instead of flying off on their own
    for (const c of cen) c.c.multiplyScalar(1 / c.n);
    const info = { of, cen };
    mesh.userData.expIslands = info;
    return info;
  }

  install(mesh) {
    if (mesh.userData.expInstalled) return;
    mesh.userData.expInstalled = true;
    const g = mesh.geometry;
    g.setAttribute('aExp', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    g.setAttribute('aFocus', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) this.patch(mat);
  }

  patch(mat) {
    if (mat.userData.expPatched) return;
    mat.userData.expPatched = true;
    const prev = mat.onBeforeCompile, U = this.u, I = this.iso;
    mat.onBeforeCompile = (shader, r) => {
      if (prev) prev(shader, r);
      shader.uniforms.uExplode = U; shader.uniforms.uIso = I;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aExp;\nattribute float aFocus;\nvarying float vFocus;\nuniform float uExplode;')
        .replace('#include <project_vertex>', 'transformed += aExp * uExplode;\nvFocus = aFocus;\n#include <project_vertex>');
      // isolation: the focused part keeps full colour with a soft blue rim glow; everything else becomes faint glass
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFocus;\nuniform float uIso;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          float axF = clamp(vFocus, 0.0, 1.0), axFade = uIso * (1.0 - axF);
          float axRim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
          gl_FragColor.rgb += uIso * axF * axRim * vec3(0.05, 0.12, 0.24);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11))) * vec3(0.75, 0.85, 1.0), axFade * 0.7);
          gl_FragColor.a *= mix(1.0, 0.09, axFade);`);
    };
    const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
    mat.customProgramCacheKey = () => key() + '|exp';
    mat.needsUpdate = true;
  }

  // meshes: the visible parts of the current view; center: world point they move away from
  setView(meshes, center) {
    this.meshes = meshes; this.center = center.clone(); this.samples = [];
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    for (const m of meshes) { m.updateWorldMatrix(true, false); tmp.setFromBufferAttribute(m.geometry.attributes.position).applyMatrix4(m.matrixWorld); box.union(tmp); }
    const size = box.getSize(new THREE.Vector3()).length() || 0.1;
    const cw = new THREE.Vector3(), d = new THREE.Vector3(), inv = new THREE.Matrix3(), v = new THREE.Vector3();
    for (const m of meshes) {
      this.install(m);
      const { of, cen } = this.islands(m), attr = m.geometry.attributes.aExp, P = m.geometry.attributes.position;
      inv.setFromMatrix4(m.matrixWorld).invert();
      const local = cen.map(c => {
        cw.copy(c.c).applyMatrix4(m.matrixWorld);
        d.subVectors(cw, center); const len = d.length();
        if (len < 1e-6) d.set(0, 0, 0);
        else d.multiplyScalar((len * 0.5 + size * 0.05) / len); // away from the centre, plus a minimum gap
        return { w: d.clone(), l: d.clone().applyMatrix3(inv) };
      });
      for (let i = 0; i < of.length; i++) { const L = local[of[i]].l; attr.setXYZ(i, L.x, L.y, L.z); }
      attr.needsUpdate = true;
      const step = Math.max(1, Math.floor(P.count / 1500));
      for (let i = 0; i < P.count; i += step) this.samples.push({ p: v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld).clone(), d: local[of[i]].w });
    }
  }

  // ---------- isolate one structure ----------
  // The piece of the model that holds the anchor is focused. When that piece is small (a kidney, a lung, a great
  // vessel stub) all of it is focused; when it is a big piece holding several structures (the heart's main body, the
  // cut ventricles) only the region around the anchor is, with a soft edge, so "Mitral valve" lights the valve and not
  // the whole ventricle wall.
  focus(meshes, anchor, radius) {
    this.clearFocus(true);
    let best = null, bd = Infinity; const v = new THREE.Vector3();
    for (const m of meshes) {
      m.updateWorldMatrix(true, false); const P = m.geometry.attributes.position, step = P.count > 20000 ? 3 : 1;
      for (let i = 0; i < P.count; i += step) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); const d = v.distanceToSquared(anchor); if (d < bd) { bd = d; best = { m, i }; } }
    }
    for (const m of meshes) this.install(m);
    if (!best) return;
    const { of, cen } = this.islands(best.m), isl = of[best.i];
    // size of that piece in world units
    const box = new THREE.Box3(), P = best.m.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) if (of[i] === isl) box.expandByPoint(v.fromBufferAttribute(P, i).applyMatrix4(best.m.matrixWorld));
    const size = box.getSize(new THREE.Vector3()).length(), whole = size < radius * 3.2;
    for (const m of meshes) {
      const a = m.geometry.attributes.aFocus; a.array.fill(0);
      if (m === best.m) {
        const Pm = m.geometry.attributes.position, o = this.islands(m).of;
        for (let i = 0; i < Pm.count; i++) {
          if (o[i] !== isl) continue;
          if (whole) { a.array[i] = 1; continue; }
          const d = v.fromBufferAttribute(Pm, i).applyMatrix4(m.matrixWorld).distanceTo(anchor);
          a.array[i] = 1 - THREE.MathUtils.smoothstep(d, radius * 0.6, radius * 1.15);
        }
      }
      a.needsUpdate = true;
      // faded parts must let the focused one show through: draw them as glass without depth writes
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat.userData.isoSaved) mat.userData.isoSaved = { transparent: mat.transparent, depthWrite: mat.depthWrite };
        mat.transparent = true; mat.depthWrite = m === best.m; // the focused piece keeps proper depth so its inner surfaces don't show through
        mat.needsUpdate = true;
      }
      if (m === best.m) m.renderOrder = 5;
    }
    this.isoMeshes = meshes; this.focusMesh = best.m;
  }
  clearFocus(keep) {
    for (const m of this.isoMeshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) if (mat.userData.isoSaved) { Object.assign(mat, mat.userData.isoSaved); delete mat.userData.isoSaved; mat.needsUpdate = true; }
      if (m.renderOrder === 5) m.renderOrder = 0;
    }
    this.isoMeshes = []; this.focusMesh = null;
    if (!keep) this.iso.value = 0;
  }

  // zero the offsets of meshes that are not part of the current view (so they stay put if shown later)
  reset(meshes) { for (const m of meshes) { const a = m.geometry.attributes.aExp; if (a) { a.array.fill(0); a.needsUpdate = true; } } }

  set(k) { this.u.value = k; }
  get amount() { return this.u.value; }

  // world-space offset of the piece nearest to p, at the current explode amount
  offsetAt(p, out) {
    out.set(0, 0, 0);
    if (!this.u.value || !this.samples.length) return out;
    let best = null, bd = Infinity;
    for (const s of this.samples) { const dd = s.p.distanceToSquared(p); if (dd < bd) { bd = dd; best = s; } }
    return best ? out.copy(best.d).multiplyScalar(this.u.value) : out;
  }
}
