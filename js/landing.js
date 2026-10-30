// Start page: two portfolios split by a live, glowing seam.
// Side A renders the 3D showroom models; side B is a reactive code network + typing terminal.
import { CONTENT, MODELS, SHOWROOM, asset } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const L = CONTENT.landing || {};
const D = CONTENT.dev || {};
const A = CONTENT.artist || {};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const art = $('#sideArt'), code = $('#sideCode'), me = $('#me');
const AB = CONTENT.about || {};

// ───────── text from the dashboard ─────────
const txt = (id, v) => { if (v) $(id).textContent = v; };
txt('#lKick', L.leftKicker); txt('#lTitle', L.leftTitle); txt('#lSub', L.leftSub); txt('#lCta', L.leftCta);
txt('#rKick', L.rightKicker); txt('#rTitle', L.rightTitle); txt('#rSub', L.rightSub); txt('#rCta', L.rightCta);
if (A.first) $('.brand__a').textContent = A.first;

// ───────── split geometry ─────────
// s = where the seam crosses the middle (0…1 across the screen); tilt = how slanted it is
const S = { s: 0.5, target: 0.5, tilt: 0.08, flash: 0, leaving: false };
let W = innerWidth, H = innerHeight, portrait = H > W;
let mx = W / 2, my = H / 2, pointerIn = false;
const seamPts = () => {
  const t = portrait ? S.tilt * H : S.tilt * W;
  return portrait ? [[0, S.s * H + t], [W, S.s * H - t]] : [[S.s * W + t, 0], [S.s * W - t, H]];
};
function applyClip() {
  const [[x1, y1], [x2, y2]] = seamPts();
  if (portrait) {
    art.style.clipPath = `polygon(0 0, ${W}px 0, ${W}px ${y2}px, 0 ${y1}px)`;
    code.style.clipPath = `polygon(0 ${y1}px, ${W}px ${y2}px, ${W}px ${H}px, 0 ${H}px)`;
  } else {
    art.style.clipPath = `polygon(0 0, ${x1}px 0, ${x2}px ${H}px, 0 ${H}px)`;
    code.style.clipPath = `polygon(${x1}px 0, ${W}px 0, ${W}px ${H}px, ${x2}px ${H}px)`;
  }
  // the profile photo sits on the middle of the seam
  // the photo is pinned to the centre of the screen (the seam always crosses it when the split is even)
  if (me) me.style.transform = `translate3d(${W / 2}px, ${H / 2}px, 0) translate(-50%, -50%)`;
  // keep each side's content centred in the part of the screen it owns, and fade it as it gets squeezed
  const a = S.s, b = 1 - S.s;
  const stage = $('#artStage');
  if (portrait) stage.style.transform = `translate3d(${W * 0.2}px, ${((a / 2) - 0.5) * H + H * 0.12}px, 0) scale(.6)`;
  else stage.style.transform = `translate3d(${((a / 2) - 0.5) * W}px, 0, 0)`;
  if (!S.leaving) {
    art.querySelector('.side__copy').style.opacity = Math.min(1, Math.max(0, (a - 0.22) / 0.2));
    code.querySelector('.side__copy').style.opacity = Math.min(1, Math.max(0, (b - 0.22) / 0.2));
    const term = $('.term'); if (term) term.style.opacity = document.body.classList.contains('is-intro') ? 0 : Math.min(1, Math.max(0, (b - 0.36) / 0.14));
  }
}
addEventListener('resize', () => { W = innerWidth; H = innerHeight; portrait = H > W; sizeCanvases(); });
addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; pointerIn = true; });
document.addEventListener('pointerleave', () => { pointerIn = false; });

// which side is the pointer on?
function sideAt(x, y) {
  const [[x1, y1], [x2, y2]] = seamPts();
  const cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
  return portrait ? (cross < 0 ? 'code' : 'art') : (cross > 0 ? 'art' : 'code');
}

// ───────── seam: a glowing cut with shards and sparks flying off it ─────────
const seam = $('#seam'), sctx = seam.getContext('2d');
const net = $('#codeNet'), nctx = net.getContext('2d');
const DPR = Math.min(devicePixelRatio || 1, 2);
function sizeCanvases() {
  for (const c of [seam, net]) { c.width = W * DPR; c.height = H * DPR; }
  sctx.setTransform(DPR, 0, 0, DPR, 0, 0); nctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  seedNet();
}
const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
const sparks = [];
function spawn(n, burst = 1) {
  const [[x1, y1], [x2, y2]] = seamPts();
  for (let i = 0; i < n; i++) {
    const t = Math.random(), x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    // normal to the seam, randomly to either side
    let nx = -(y2 - y1), ny = x2 - x1; const len = Math.hypot(nx, ny); nx /= len; ny /= len;
    const dir = Math.random() < 0.5 ? -1 : 1, sp = (0.4 + Math.random() * 2.2) * burst;
    sparks.push({ x, y, vx: nx * dir * sp + (Math.random() - 0.5) * 0.6, vy: ny * dir * sp + (Math.random() - 0.5) * 0.6, life: 1, side: dir,
      shard: Math.random() < 0.28, size: 2 + Math.random() * (burst > 1 ? 16 : 9), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.12 });
  }
}
function drawSeam() {
  sctx.clearRect(0, 0, W, H);
  const [[x1, y1], [x2, y2]] = seamPts();
  const aG = css('--a-glow') || '#ff7a2a', bG = '#3cf2c1';
  const g = sctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, bG); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, aG);
  const pulse = 0.75 + Math.sin(performance.now() / 380) * 0.15 + S.flash;
  sctx.save(); sctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [[34, 0.05], [16, 0.12], [6, 0.35], [2, 1]]) {
    sctx.strokeStyle = g; sctx.globalAlpha = a * pulse; sctx.lineWidth = w + S.flash * 30; sctx.lineCap = 'round';
    sctx.beginPath();
    // a slightly jagged energy line
    const segs = 18;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, jx = (i % segs ? (Math.random() - 0.5) * (w < 3 ? 3 : 0) : 0);
      const x = x1 + (x2 - x1) * t + jx, y = y1 + (y2 - y1) * t;
      i ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
    }
    sctx.stroke();
  }
  // sparks & glass shards
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.vy *= 0.985; p.vy += 0.012; p.rot += p.vr; p.life -= p.shard ? 0.008 : 0.016;
    if (p.life <= 0) { sparks.splice(i, 1); continue; }
    const col = p.side > 0 ? (portrait ? aG : bG) : (portrait ? bG : aG);
    sctx.globalAlpha = Math.max(0, p.life);
    if (p.shard) {
      sctx.save(); sctx.translate(p.x, p.y); sctx.rotate(p.rot);
      sctx.fillStyle = col; sctx.globalAlpha = p.life * 0.55;
      sctx.beginPath(); sctx.moveTo(-p.size, -p.size * 0.25); sctx.lineTo(p.size * 0.9, -p.size * 0.5); sctx.lineTo(p.size * 0.3, p.size * 0.45); sctx.closePath(); sctx.fill();
      sctx.strokeStyle = '#ffffff'; sctx.globalAlpha = p.life * 0.8; sctx.lineWidth = 1; sctx.stroke();
      sctx.restore();
    } else {
      sctx.fillStyle = col; sctx.beginPath(); sctx.arc(p.x, p.y, p.size * 0.18 * p.life + 0.6, 0, Math.PI * 2); sctx.fill();
    }
  }
  sctx.restore();
}

// ───────── side B: a code network that reacts to the cursor ─────────
const GLYPHS = ['{ }', '</>', '=>', '01', 'fn', '[]', '&&', '::', '#', '$_', 'λ', '++', '!=', '//'];
let nodes = [];
function seedNet() {
  const n = Math.round(Math.min(110, (W * H) / 15000));
  nodes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
    g: Math.random() < 0.16 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : null, r: 1 + Math.random() * 1.6 }));
}
function drawNet() {
  nctx.clearRect(0, 0, W, H);
  const near = pointerIn && sideAt(mx, my) === 'code';
  const R = 130, R2 = R * R;
  for (const p of nodes) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20; if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
    if (near) { const dx = mx - p.x, dy = my - p.y, d2 = dx * dx + dy * dy; if (d2 < 220 * 220) { p.x += dx * 0.004; p.y += dy * 0.004; } }
  }
  nctx.lineWidth = 1;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < R2) { nctx.strokeStyle = `rgba(60,242,193,${(1 - d2 / R2) * 0.22})`; nctx.beginPath(); nctx.moveTo(a.x, a.y); nctx.lineTo(b.x, b.y); nctx.stroke(); }
    }
    if (near) {
      const dx = a.x - mx, dy = a.y - my, d2 = dx * dx + dy * dy;
      if (d2 < 180 * 180) { nctx.strokeStyle = `rgba(160,255,230,${(1 - d2 / 32400) * 0.6})`; nctx.beginPath(); nctx.moveTo(a.x, a.y); nctx.lineTo(mx, my); nctx.stroke(); }
    }
  }
  nctx.font = '500 12px "JetBrains Mono", monospace';
  for (const p of nodes) {
    if (p.g) { nctx.fillStyle = 'rgba(60,242,193,.55)'; nctx.fillText(p.g, p.x, p.y); }
    else { nctx.fillStyle = 'rgba(200,255,240,.7)'; nctx.beginPath(); nctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); nctx.fill(); }
  }
}

// ───────── terminal that types itself ─────────
const term = $('#termBody');
function script() {
  const name = (A.name || 'Fuzail Ahmed').toLowerCase();
  const lines = [['whoami', `${name} — ${(D.role || 'computer science engineer').toLowerCase()}`]];
  const projects = (D.projects || []).filter((p) => !p.hidden).map((p) => p.title);
  if (projects.length) lines.push(['ls ~/projects', projects.slice(0, 6).join('   ')]);
  const stack = (D.skills || []).flatMap((g) => g.items || []);
  if (stack.length) lines.push(['cat stack.txt', stack.slice(0, 9).join(' · ')]);
  (D.terminal || []).forEach((l) => lines.push(l.startsWith('$ ') ? [l.slice(2), ''] : ['', l]));
  if (D.github) lines.push([`git remote -v`, `github.com/${D.github}`]);
  lines.push(['echo $STATUS', D.status || 'building something new']);
  lines.push(['./portfolio --open', '']);
  return lines;
}
const escH = (v) => String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
async function typeTerminal() {
  const lines = script();
  let html = '';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const paint = (extra = '') => { term.innerHTML = html + extra + '<span class="cur"></span>'; };
  for (;;) {
    html = '';
    for (const [cmd, out] of lines) {
      if (cmd) {
        let typed = '';
        for (const ch of cmd) { typed += ch; paint(`<span class="p">❯</span> ${escH(typed)}`); await sleep(reduce ? 0 : 38 + Math.random() * 50); }
        html += `<span class="p">❯</span> ${escH(cmd)}\n`;
        await sleep(220);
      }
      if (out) { html += `<span class="c">${escH(out)}</span>\n`; paint(); await sleep(reduce ? 0 : 520); }
    }
    paint(); await sleep(5200);
  }
}

// ───────── side A: the 3D showroom, cycling through the models ─────────
function setArtColours(c) {
  if (!c) return;
  root.style.setProperty('--a-bg', c.bg || '#2a1206'); root.style.setProperty('--a-bg2', c.bg2 || '#7a3410');
  root.style.setProperty('--a-ink', c.ink || '#ffd9a8'); root.style.setProperty('--a-glow', c.glow || '#ff7a2a');
  $('meta[name=theme-color]').setAttribute('content', c.bg || '#120a06');
}
async function startArt() {
  const keys = (L.model && MODELS[L.model] ? [L.model] : SHOWROOM).filter((k) => MODELS[k]);
  if (!keys.length) return;
  setArtColours(MODELS[keys[0]]);
  if (L.image) { const im = $('#artPoster'); im.src = asset(`assets/img/${L.image}.webp`); im.hidden = false; }
  let gl = null; try { gl = document.createElement('canvas').getContext('webgl2'); } catch { /* no webgl */ }
  if (!gl) return;
  const { Stage } = await import('./stage.js');
  const stage = new Stage($('#artCanvas'), { autoRotate: 0.28, distance: 5.6, float: 0.06 });
  let i = 0;
  const show = async () => {
    const k = keys[i % keys.length], c = MODELS[k];
    setArtColours(c); stage.setColors(c);
    await stage.show(k);
    $('#artPoster').hidden = true;
  };
  await show();
  if (keys.length > 1 && !reduce) setInterval(() => { if (!document.hidden && !S.leaving && sideAt(mx, my) !== 'art') { i++; show(); } }, 6500);
  // nudge the model toward the cursor when it's on the 3D side
  addEventListener('pointermove', () => { if (sideAt(mx, my) === 'art') { stage.mouse.x = (mx / W) * 2 - 1; stage.mouse.y = (my / H) * 2 - 1; } });
}

// ───────── choosing a side ─────────
let downAt = null;
for (const el of [art, code]) {
  el.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  el.addEventListener('click', (e) => {
    // a drag on the 3D model shouldn't count as a click
    if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 8) { e.preventDefault(); return; }
    e.preventDefault();
    // which side was actually under the pointer (both links cover the whole screen, clip-path decides what you see)
    const pick = e.clientX || e.clientY ? sideAt(e.clientX, e.clientY) : (el === art ? 'art' : 'code');
    choose(pick);
  });
  el.addEventListener('mouseenter', () => prefetch(el.getAttribute('href')));
}
const fetched = new Set();
function prefetch(href) { if (fetched.has(href)) return; fetched.add(href); const l = document.createElement('link'); l.rel = 'prefetch'; l.href = href; document.head.appendChild(l); }
function choose(side) {
  if (S.leaving) return;
  S.leaving = true; document.body.classList.add('is-leaving');
  const href = (side === 'art' ? art : code).getAttribute('href');
  try { sessionStorage.setItem('fz-side', side); } catch { /* private mode */ }
  spawn(140, 3.2); S.flash = 1;
  S.target = side === 'art' ? (portrait ? 1.2 : 1.25) : (portrait ? -0.2 : -0.25);
  setTimeout(() => { location.href = href; }, reduce ? 50 : 900);
}
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === '1') choose('art');
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === '2') choose('code');
  if (e.key === 'a' || e.key === 'A') me.click();
});
addEventListener('pageshow', (e) => { if (e.persisted) { S.leaving = false; S.target = 0.5; S.s = 0.5; document.body.classList.remove('is-leaving', 'is-going'); } });

// ───────── the profile photo → About page ─────────
let meHover = false;
if (AB.photo) { const im = $('#mePhoto'); im.src = asset(`assets/thumb/${AB.photo}.webp`); im.onload = () => { im.hidden = false; $('#meMono').hidden = true; }; }
const initials = (A.name || 'Fuzail Ahmed').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
$('#meMono').textContent = initials;
me.addEventListener('pointerenter', () => { meHover = true; S.flash = Math.max(S.flash, 0.35); prefetch('about.html'); });
me.addEventListener('pointerleave', () => { meHover = false; });
me.addEventListener('click', (e) => {
  e.preventDefault(); if (S.leaving) return;
  S.leaving = true; document.body.classList.add('is-leaving', 'is-going'); S.flash = 1; spawn(120, 2.6);
  setTimeout(() => { location.href = 'about.html'; }, reduce ? 50 : 760);
});

// ───────── main loop ─────────
let last = performance.now();
function frame(now) {
  const dt = Math.min(50, now - last); last = now;
  if (!S.leaving) {
    // lean toward the side under the cursor
    // near the photo the split settles back to the middle, so nothing slides away from the cursor
    const r = (me.offsetWidth || 180) / 2, nearMe = meHover || Math.hypot(mx - W / 2, my - H / 2) < r * 2.4;
    const hov = pointerIn && !nearMe ? sideAt(mx, my) : null;
    S.target = hov === 'art' ? 0.58 : hov === 'code' ? 0.42 : 0.5;
    art.classList.toggle('is-hot', hov === 'art'); code.classList.toggle('is-hot', hov === 'code');
  }
  const k = S.leaving ? 0.075 : 0.06;
  S.s += (S.target - S.s) * (1 - Math.pow(1 - k, dt / 16.7));
  S.flash *= 0.92;
  applyClip();
  if (!reduce && Math.random() < 0.55) spawn(1);
  drawSeam();
  drawNet();
  requestAnimationFrame(frame);
}

sizeCanvases();
applyClip();
requestAnimationFrame(frame);
requestAnimationFrame(() => { setTimeout(() => { document.body.classList.remove('is-intro'); spawn(60, 2); S.flash = 0.6; }, 150); });
typeTerminal();
startArt().catch((e) => console.warn('3D side unavailable:', e));
