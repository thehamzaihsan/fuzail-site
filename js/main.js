import * as THREE from 'three';
import { Stage, manager, loadGLTF, setColorway, setMode, explode } from './stage.js';
import { ARTIST, MODELS, SHOWROOM, FEATURED, FURNITURE, ENVIRONMENTS, COMPARE, ARCHVIZ, MORE, REEL, TOOLKIT, MARQUEE, HIGHLIGHTS } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);
const isTouch = matchMedia('(hover: none)').matches;
const small = () => innerWidth < 760;
const img = (id) => `assets/img/${id}.webp`;
const thumb = (id) => `assets/thumb/${id}.webp`;
let MEDIA = {};
// escape any content text before it goes into HTML (defence in depth for admin-edited content)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const col = (v, d = '#888888') => (/^#[0-9a-f]{3,8}$/i.test(v || '') ? v : d);
const sid = (v) => String(v ?? '').replace(/[^a-z0-9_-]/gi, '');

/* ───────────── smooth scroll ───────────── */
const lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
$$('[data-link]').forEach((a) => a.addEventListener('click', (e) => {
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('#')) return;
  e.preventDefault();
  document.body.classList.remove('menu-open');
  lenis.start();
  lenis.scrollTo(href === '#top' ? 0 : href, { duration: 1.6, offset: 0 });
}));

/* ───────────── cursor ───────────── */
const cursor = $('#cursor'), cLabel = $('#cursorLabel');
let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
gsap.ticker.add(() => { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; cursor.style.transform = `translate(${cx}px, ${cy}px)`; });
document.addEventListener('pointerover', (e) => {
  const t = e.target.closest('[data-cursor]');
  if (t) { cLabel.textContent = t.dataset.cursor; cursor.classList.add('is-big'); }
  else if (e.target.closest('.shot, .card, .env, .clip')) { cLabel.textContent = 'View'; cursor.classList.add('is-big'); }
  else cursor.classList.remove('is-big');
});

/* ───────────── toast ───────────── */
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-on'), 2200); }

/* ───────────── menu ───────────── */
$('#burger').addEventListener('click', () => document.body.classList.toggle('menu-open'));

/* ═════════════ HERO SHOWROOM ═════════════ */
const heroStage = new Stage($('#heroCanvas'), { autoRotate: 0.22, distance: 5.4, float: 0.05, offsetY: (w, h) => (w < 760 ? h * 0.1 : w < 1100 ? h * 0.05 : 0) });
let heroIdx = 0, autoT = 0, heroHover = false;
const AUTO = 7.5;
const rail = $('#rail');
SHOWROOM.forEach((k, i) => {
  const c = MODELS[k];
  const b = document.createElement('button');
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-label', c.title);
  b.style.setProperty('--sw-bg', c.bg); b.style.setProperty('--sw-ink', c.dark ? c.ink : c.glow);
  b.innerHTML = `<span>${esc(c.title)}</span><svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="27"/></svg>`;
  b.addEventListener('click', () => { setHero(i); autoT = 0; });
  rail.appendChild(b);
});
$('#heroTotal').textContent = String(SHOWROOM.length).padStart(2, '0');
$('#prevModel').onclick = () => { setHero((heroIdx - 1 + SHOWROOM.length) % SHOWROOM.length); autoT = 0; };
$('#nextModel').onclick = () => { setHero((heroIdx + 1) % SHOWROOM.length); autoT = 0; };
$('#heroCanvasWrap').addEventListener('pointerdown', () => { autoT = -6; });
$('#hero').addEventListener('pointerenter', () => (heroHover = true));
$('#hero').addEventListener('pointerleave', () => (heroHover = false));

function splitWord(el, word) {
  el.innerHTML = [...String(word || '')].map((ch) => `<span class="ch">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  return $$('.ch', el);
}
function setHeroVars(c) {
  root.style.setProperty('--hero-bg', c.bg);
  root.style.setProperty('--hero-bg2', c.bg2);
  root.style.setProperty('--hero-ink', c.ink);
  root.style.setProperty('--hero-glow', c.glow);
  $('meta[name=theme-color]').setAttribute('content', c.bg);
}
function setHero(i, first = false) {
  heroIdx = i;
  const key = SHOWROOM[i], c = MODELS[key];
  setHeroVars(c);
  if (inHero) { root.style.setProperty('--page-bg', c.bg); root.style.setProperty('--nav-ink', c.ink); }
  heroStage.setColors(c);
  heroStage.show(key, { animate: !first });
  $$('button', rail).forEach((b, j) => b.classList.toggle('is-active', j === i));
  $('#heroIdx').textContent = String(i + 1).padStart(2, '0');
  const solid = splitWord($('#wordSolid'), c.word), outline = splitWord($('#wordOutline'), c.word);
  if (!first) {
    gsap.fromTo([solid, outline], { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.04 });
    gsap.fromTo('#heroInfo > *', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06 });
  }
  $('#heroKind').textContent = c.kind;
  $('#heroTitle').textContent = c.title;
  $('#heroBlurb').textContent = c.blurb;
}
$('#heroInspect').addEventListener('click', (e) => openInspector(SHOWROOM[heroIdx], e));

// autoplay progress ring
gsap.ticker.add((t, dms) => {
  if (!heroStage.visible || document.hidden) return;
  if (!heroHover) autoT += dms / 1000;
  const p = Math.max(0, Math.min(1, autoT / AUTO));
  const circ = $$('circle', rail)[heroIdx];
  $$('circle', rail).forEach((c) => (c.style.strokeDashoffset = 170));
  if (circ) circ.style.strokeDashoffset = 170 - 170 * p;
  if (autoT >= AUTO && ready) { autoT = 0; setHero((heroIdx + 1) % SHOWROOM.length); }
});

// hero scroll parallax
let inHero = true;
ScrollTrigger.create({
  trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true,
  onUpdate: (st) => {
    const p = st.progress;
    $('#heroCanvasWrap').style.transform = `translateY(${p * 22}vh) scale(${1 - p * 0.15})`;
    $('#wordSolid').style.transform = `translateY(calc(-50% + ${p * -14}vh)) scale(${1 + p * 0.2})`;
    $('#wordOutline').style.transform = `translateY(calc(-50% + ${p * -14}vh)) scale(${1 + p * 0.2})`;
  },
});

/* ═════════════ PAGE COLOUR MATCHING ═════════════ */
function bindColor(el) {
  const set = () => {
    root.style.setProperty('--page-bg', el.dataset.bg);
    root.style.setProperty('--page-ink', el.dataset.ink);
    root.style.setProperty('--nav-ink', el.dataset.ink);
  };
  ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%', onEnter: set, onEnterBack: set });
}
ScrollTrigger.create({
  trigger: '#hero', start: 'top top', end: 'bottom 55%',
  onEnterBack: () => { inHero = true; const c = MODELS[SHOWROOM[heroIdx]]; root.style.setProperty('--page-bg', c.bg); root.style.setProperty('--nav-ink', c.ink); },
  onLeave: () => { inHero = false; },
});
// nav hide/show + solid
let lastY = 0;
lenis.on('scroll', ({ scroll }) => {
  const nav = $('#nav');
  nav.classList.toggle('is-solid', scroll > innerHeight * 0.9);
  nav.classList.toggle('is-hidden', scroll > lastY && scroll > innerHeight * 0.9 && !document.body.classList.contains('menu-open'));
  lastY = scroll;
});

/* ═════════════ MARQUEE + STATEMENT ═════════════ */
$('#marquee').innerHTML = [...MARQUEE, ...MARQUEE].map((w) => `<span>${esc(w)}</span>`).join('');
$('#claim1').textContent = ARTIST.claim1 || '';
$('#claim2').textContent = ARTIST.claim2 || '';
const stmt = $('#statementText');
const hl = HIGHLIGHTS.map((h) => h.toLowerCase());
stmt.innerHTML = String(ARTIST.intro || '').split(' ').map((w) => {
  const it = hl.some((h) => h && w.toLowerCase().replace(/[^a-z]/g, '') === h.replace(/[^a-z]/g, ''));
  return `<span class="w">${it ? `<em>${esc(w)}</em>` : esc(w)}</span>`;
}).join(' ');
gsap.to('#statementText .w', { opacity: 1, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: '#statementText', start: 'top 80%', end: 'bottom 45%', scrub: true } });

/* ═════════════ FEATURED PROJECTS ═════════════ */
const featured = $('#featured');
const lbSets = {};
FEATURED.forEach((p, pi) => {
  p = { ...p, id: sid(p.id), model: MODELS[p.model] ? p.model : '', bg: col(p.bg, '#111111'), ink: col(p.ink, '#ffffff'), accent: col(p.accent, '#ff5a1f'), images: (p.images || []).map(sid), video: sid(p.video), no: String(pi + 1).padStart(2, '0') };
  const s = document.createElement('article');
  s.className = 'proj';
  s.id = 'p-' + p.id;
  Object.assign(s.dataset, { bg: p.bg, ink: p.ink, theme: 'dark' });
  s.style.setProperty('--accent', p.accent); s.style.setProperty('--bg', p.bg);
  const layout = p.images.length >= 4 ? ['g-a', 'g-b', 'g-c', 'g-d'] : p.images.length === 3 ? ['g-a', 'g-b', 'g-w'] : p.images.length === 2 ? ['g-c', 'g-d'] : ['g-w'];
  const titleLines = p.title.split(' ').reduce((acc, w) => { const l = acc[acc.length - 1]; if (l && (l + ' ' + w).length <= 10) acc[acc.length - 1] = l + ' ' + w; else acc.push(w); return acc; }, []);
  s.innerHTML = `
    <div class="proj__head">
      <span class="proj__no">${p.no}</span>
      <div><span class="proj__cat">${esc(p.cat)}</span><h3 class="proj__title">${titleLines.map((l) => `<span class="ln"><span>${esc(l)}</span></span>`).join('')}</h3></div>
    </div>
    ${p.model ? `<button class="proj__float" data-model="${p.model}" data-cursor="Open" aria-label="Inspect ${esc(p.title)} in 3D">
      <svg viewBox="0 0 200 200" width="100%" height="100%"><defs><path id="c-${p.id}" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs>
      <g class="ring" style="transform-origin:100px 100px"><text font-size="13" fill="currentColor" font-family="JetBrains Mono, monospace"><textPath href="#c-${p.id}" textLength="486" lengthAdjust="spacing">INSPECT IN 3D • DRAG • ORBIT • ZOOM •</textPath></text></g>
      <circle cx="100" cy="100" r="36" fill="${p.accent}"/><text x="100" y="109" text-anchor="middle" font-size="24" fill="${p.bg}" font-family="Anton, Impact">3D</text></svg>
    </button>` : ''}
    <div class="proj__body">
      <div>
        <p class="proj__text fade-up">${esc(p.text)}</p>
      </div>
      <div class="fade-up">
        <dl class="proj__specs">${(p.specs || []).map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl>
        <div class="proj__tools">${(p.tools || []).map((t) => `<span>${esc(t)}</span>`).join('')}</div>
        <div class="proj__btns">
          ${p.model ? `<button class="pill pill--solid" data-model="${p.model}" data-cursor="Open">Inspect 3D model <span class="arrow">↗</span></button>` : ''}
          <button class="pill pill--ghost" data-gallery="${p.id}">Full gallery</button>
        </div>
      </div>
    </div>
    <div class="proj__gallery">
      ${p.images.map((id, i) => `<figure class="shot reveal-img ${layout[i] || 'g-h'}" data-lb="${p.id}" data-i="${i}"><img src="${img(id)}" alt="${esc(p.title)} render ${i + 1}" loading="lazy" data-speed="${i % 2 ? 0.06 : -0.04}"><figcaption>${esc(p.title)} — ${String(i + 1).padStart(2, '0')}</figcaption></figure>`).join('')}
      ${p.video ? `<figure class="shot reveal-img g-w" data-lb="${p.id}" data-i="${p.images.length}"><video src="assets/video/${p.video}.mp4" poster="assets/video/${p.video}.webp" muted loop playsinline preload="none"></video><figcaption>Product film</figcaption></figure>` : ''}
    </div>`;
  featured.appendChild(s);
  lbSets[p.id] = [...p.images.map((id) => ({ type: 'img', src: img(id), cap: p.title })), ...(p.video ? [{ type: 'video', src: `assets/video/${p.video}.mp4`, cap: p.title + ' — film' }] : [])];
  gsap.from($$('.proj__title .ln > span', s), { yPercent: 105, duration: 1.2, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: s, start: 'top 70%' } });
  gsap.from($('.proj__no', s), { opacity: 0, x: -30, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 70%' } });
  gsap.to($('.proj__float .ring', s), { rotate: 360, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true } });
});
$$('[data-bg]').forEach(bindColor);
document.addEventListener('click', (e) => {
  const m = e.target.closest('[data-model]'); if (m) return openInspector(m.dataset.model, e);
  const g = e.target.closest('[data-gallery]'); if (g) return openLB(lbSets[g.dataset.gallery], 0);
  const sh = e.target.closest('[data-lb]'); if (sh) return openLB(lbSets[sh.dataset.lb], +sh.dataset.i);
});
// gallery parallax
$$('.proj__gallery img[data-speed]').forEach((im) => {
  gsap.fromTo(im, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: im.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
});
// in-gallery videos play when visible
$$('.proj__gallery video').forEach((v) => new IntersectionObserver((e) => { e[0].isIntersecting ? v.play().catch(() => {}) : v.pause(); }, { threshold: 0.3 }).observe(v));

/* ═════════════ FURNITURE ═════════════ */
let furnStage = null, furnKey = 'chair';
$('#furnTabs').innerHTML = FURNITURE.map((f, i) => `<button class="chip ${i === 0 ? 'is-active' : ''}" data-furn="${i}">${esc(f.title)}</button>`).join('');
if (!FURNITURE.length) $('#furniture').style.display = 'none';
function initFurniture() {
  if (!FURNITURE.length) return;
  furnStage = new Stage($('#furnCanvas'), { autoRotate: 0.3, distance: 5, float: 0.02 });
  furnStage.setColors({ glow: '#ffd27a', dark: true });
  setFurniture(0);
}
$$('#furnTabs .chip').forEach((b) => b.addEventListener('click', () => { $$('#furnTabs .chip').forEach((x) => x.classList.toggle('is-active', x === b)); setFurniture(+b.dataset.furn); }));
async function setFurniture(key) {
  furnKey = key;
  const F = FURNITURE[key], c = MODELS[F.model];
  const SW = c.swatches || [];
  const model = await furnStage.show(F.model);
  const sw = $('#furnSwatches');
  sw.innerHTML = SW.map((s, i) => `<button class="swatch ${i === 0 ? 'is-active' : ''}" style="--c:${col(s.color)}" data-hex="${col(s.color)}"><i></i>${esc(s.name)}</button>`).join('');
  if (model && SW.length) setColorway(model, col(SW[0].color));
  $$('.swatch', sw).forEach((b) => b.addEventListener('click', () => {
    $$('.swatch', sw).forEach((x) => x.classList.toggle('is-active', x === b));
    if (furnStage.model) setColorway(furnStage.model, b.dataset.hex);
  }));
  $('#furnPoly').innerHTML = (F.poly || []).map((p) => `<div><dt>${esc(p.label)}</dt><dd>${esc(p.value)}</dd></div>`).join('');
  const steps = $('#furnSteps');
  const ST = F.stages || [];
  steps.innerHTML = ST.map((s, i) => `<button class="${i === 0 ? 'is-active' : ''}" data-i="${i}"><b>${String(i + 1).padStart(2, '0')}</b>${esc(s.label)}</button>`).join('');
  lbSets.furn = ST.map((s) => ({ type: 'img', src: img(sid(s.image)), cap: `${F.title} — ${s.label}` }));
  const box = $('#furnImg');
  box.innerHTML = ST.map((s, i) => `<img src="${img(sid(s.image))}" alt="${esc(F.title)} ${esc(s.label)}" style="opacity:${i === 0 ? 1 : 0}" loading="lazy">`).join('');
  box.onclick = () => openLB(lbSets.furn, furnStep);
  furnStep = 0;
  $$('button', steps).forEach((b) => b.addEventListener('click', () => showStep(+b.dataset.i)));
}
let furnStep = 0;
function showStep(i) {
  furnStep = i;
  $$('#furnSteps button').forEach((b, j) => b.classList.toggle('is-active', j === i));
  $$('#furnImg img').forEach((im, j) => { im.style.opacity = j === i ? 1 : 0; im.style.transform = j === i ? 'scale(1)' : 'scale(1.06)'; });
}

/* ═════════════ ENVIRONMENTS ═════════════ */
const envTrack = $('#envTrack');
envTrack.innerHTML = ENVIRONMENTS.map((e, i) => `
  <article class="env" data-lb="env" data-i="${i}">
    <div class="env__img"><img src="${img(sid(e.id))}" alt="${esc(e.title)}" loading="lazy"><span class="env__no">${String(i + 1).padStart(2, '0')} / ${ENVIRONMENTS.length}</span></div>
    <div class="env__meta"><h3>${esc(e.title)}</h3><span>${esc(e.sub)}<br>${esc(e.note)}</span></div>
  </article>`).join('');
lbSets.env = ENVIRONMENTS.map((e) => ({ type: 'img', src: img(sid(e.id)), cap: `${e.title} — ${e.note}` }));
function initHScroll() {
  if (small()) return;
  const dist = () => envTrack.scrollWidth - innerWidth;
  const tween = gsap.to(envTrack, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '#hscroll', start: 'center center', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 } });
  $$('.env__img img', envTrack).forEach((im) => {
    gsap.fromTo(im, { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: im.closest('.env'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
  });
}

// compare slider
(function compare() {
  const c = $('#compare'); let on = false;
  if (!COMPARE || !COMPARE.before || !COMPARE.after) { $('.compare-wrap').style.display = 'none'; return; }
  $('#cmpTitle').textContent = COMPARE.title || ''; $('#cmpNote').textContent = COMPARE.note || '';
  $('#cmpAfter').src = img(sid(COMPARE.after)); $('#cmpBefore').src = img(sid(COMPARE.before));
  $('#cmpLblL').textContent = COMPARE.beforeLabel || 'Clay'; $('#cmpLblR').textContent = COMPARE.afterLabel || 'Final';
  const set = (x) => { const r = c.getBoundingClientRect(); c.style.setProperty('--x', Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)) + '%'); };
  c.addEventListener('pointerdown', (e) => { on = true; set(e.clientX); c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', (e) => { if (on || !isTouch) set(e.clientX); });
  c.addEventListener('pointerup', () => (on = false));
  gsap.fromTo(c, { '--x': '92%' }, { '--x': '35%', duration: 1.8, ease: 'expo.inOut', scrollTrigger: { trigger: c, start: 'top 70%' } });
})();

/* ═════════════ ARCHVIZ ═════════════ */
let archStage = null;
function initArch() {
  if (!MODELS[ARCHVIZ.model]) { $('.arch__stage').style.display = 'none'; return; }
  archStage = new Stage($('#archCanvas'), { orbit: true, autoRotate: 0.12, distance: 6.4, realShadows: true, shadow: false, float: 0, fov: 32 });
  archStage.setColors({ glow: '#ffffff', dark: false });
  archStage.rim.intensity = 0;
  archStage.scene.environmentIntensity = 0.55;
  archStage.camera.position.set(4.2, 2.2, 4.6);
  archStage.controls.maxPolarAngle = Math.PI / 2.05;
  archStage.show(ARCHVIZ.model, { animate: false }).then(() => setSun(+$('#sun').value));
  // allow page scroll on wheel – only zoom inside fullscreen
  archStage.controls.enableZoom = false;
}
function setSun(v) {
  if (!archStage) return;
  const t = v / 100; // 6:00 → 19:00
  const az = -Math.PI * 0.85 + t * Math.PI * 1.7;
  const el = Math.sin(t * Math.PI) * 1.1 + 0.08;
  archStage.key.position.set(Math.cos(az) * 6, Math.max(0.4, Math.sin(el) * 7), Math.sin(az) * 6);
  const warm = 1 - Math.sin(t * Math.PI);
  archStage.key.color.setRGB(1, 0.86 + 0.14 * (1 - warm), 0.7 + 0.3 * (1 - warm));
  archStage.key.intensity = 1.6 + 2.2 * Math.sin(t * Math.PI);
  const mins = Math.round(360 + t * 780); $('#sunTime').textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
$('#sun').addEventListener('input', (e) => setSun(+e.target.value));
$('#archInspect').addEventListener('click', (e) => openInspector(ARCHVIZ.model, e));
$('#archTitle').textContent = ARCHVIZ.title || ''; $('#archTag').textContent = ARCHVIZ.tag || '';
$('#archGrid').innerHTML = ARCHVIZ.items.map((a, i) => `<figure class="shot reveal-img" data-lb="arch" data-i="${i}"><img src="${img(sid(a.id))}" alt="${esc(a.title)}" loading="lazy"><div class="cap"><h4>${esc(a.title)}</h4><p>${esc(a.note)}</p></div></figure>`).join('');
lbSets.arch = ARCHVIZ.items.map((a) => ({ type: 'img', src: img(sid(a.id)), cap: `${a.title} — ${a.note}` }));

/* ═════════════ REEL ═════════════ */
$('#reelGrid').innerHTML = REEL.map((r, i) => `<figure class="clip" data-lb="reel" data-i="${i}"><img src="assets/video/${sid(r.id)}.webp" alt="${esc(r.title)}" loading="lazy"><video muted loop playsinline preload="none" src="assets/video/${sid(r.id)}.mp4"></video><div class="clip__meta"><h4>${esc(r.title)}</h4><span class="clip__play">▶</span></div></figure>`).join('');
lbSets.reel = REEL.map((r) => ({ type: 'video', src: `assets/video/${sid(r.id)}.mp4`, cap: r.title }));
$$('.clip').forEach((c, i) => {
  const v = $('video', c);
  const play = () => { v.play().then(() => c.classList.add('is-playing')).catch(() => {}); };
  const stop = () => { v.pause(); c.classList.remove('is-playing'); };
  if (isTouch || i === 0) new IntersectionObserver((e) => (e[0].isIntersecting ? play() : stop()), { threshold: 0.5 }).observe(c);
  else { c.addEventListener('pointerenter', play); c.addEventListener('pointerleave', stop); }
});

/* ═════════════ MORE (product grid) ═════════════ */
const cats = ['All', ...new Set(MORE.map((m) => m.cat))];
$('#filters').innerHTML = cats.map((c, i) => `<button class="chip ${i === 0 ? 'is-active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
function renderMore() {
  $('#moreGrid').innerHTML = MORE.map((m, i) => {
    const md = MEDIA[m.id] || {};
    const sw = [md.dom, md.accent, md.avg].filter(Boolean);
    return `<article class="card" data-lb="more" data-i="${i}" data-cat="${esc(m.cat)}"><div class="card__img" style="background:${col(md.avg, '#dddddd')}"><img src="${thumb(sid(m.id))}" alt="${esc(m.title)}" loading="lazy"></div><div class="card__meta"><h4>${esc(m.title)}</h4><p>${esc(m.cat)}</p><div class="sw">${sw.map((c) => `<i style="background:${col(c)}"></i>`).join('')}</div></div></article>`;
  }).join('');
}
lbSets.more = MORE.map((m) => ({ type: 'img', src: img(sid(m.id)), cap: `${m.title} — ${m.cat}` }));
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  $$('#filters .chip').forEach((x) => x.classList.toggle('is-active', x === b));
  $$('#moreGrid .card').forEach((c) => c.classList.toggle('is-out', b.dataset.cat !== 'All' && c.dataset.cat !== b.dataset.cat));
  ScrollTrigger.refresh();
});

/* ═════════════ ABOUT / CONTACT ═════════════ */
$('#aboutText').textContent = ARTIST.intro;
$('#aboutText2').textContent = ARTIST.intro2;
$('#toolkit').innerHTML = TOOLKIT.map((g) => `<div><h4>${esc(g.title)}</h4><ul>${(g.items || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join('');
$('#mailText').textContent = ARTIST.email;
$('#mailLink').href = 'mailto:' + ARTIST.email;
$('#year').textContent = new Date().getFullYear();
const copy = (e) => { e.preventDefault(); navigator.clipboard?.writeText(ARTIST.email).then(() => toast('Email copied — talk soon!'), () => (location.href = 'mailto:' + ARTIST.email)); };
$('#copyMail').addEventListener('click', copy);
$('#mailBig').addEventListener('click', copy);
gsap.from('#contact .contact__big .in', { xPercent: (i) => (i ? 12 : -12), opacity: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1, clearProps: 'transform,opacity', scrollTrigger: { trigger: '#contact', start: 'top 60%' } });
gsap.from('#toolkit li', { yPercent: 80, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.05, clearProps: 'transform,opacity', scrollTrigger: { trigger: '#toolkit', start: 'top 80%' } });

/* ═════════════ REVEALS ═════════════ */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.15 });
const observeReveals = () => $$('.reveal-img:not(.is-in), .fade-up:not(.is-in)').forEach((el) => io.observe(el));
gsap.utils.toArray('.mega').forEach((m) => gsap.from(m, { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: m, start: 'top 85%' } }));

/* ═════════════ INSPECTOR ═════════════ */
let insp = null, inspKey = null, inspMode = 'textured', inspSpin = true;
const inspEl = $('#inspector');
const INSP_KEYS = Object.keys(MODELS).filter((k) => MODELS[k].inspector !== false && !MODELS[k].hidden);
$('#inspModels').innerHTML = INSP_KEYS.map((k) => `<button data-k="${esc(k)}">${esc(MODELS[k].title)}</button>`).join('');
$('#inspModels').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) loadInspector(b.dataset.k); });
function openInspector(key, ev) {
  if (!MODELS[key]) return;
  if (ev && ev.clientX != null) { inspEl.style.setProperty('--ox', ev.clientX + 'px'); inspEl.style.setProperty('--oy', ev.clientY + 'px'); }
  inspEl.classList.add('is-open'); inspEl.setAttribute('aria-hidden', 'false');
  lenis.stop();
  heroStage.running = false;
  if (!insp) {
    insp = new Stage($('#inspCanvas'), { orbit: true, zoom: true, autoRotate: 0.35, distance: 5.4, preserve: true, float: 0, offsetX: (w) => (w > 1100 ? 150 : 0) });
    if (innerWidth < 760) insp.camera.position.setLength(7.5);
  }
  insp.running = true; insp.renderer.setAnimationLoop(insp._loop); insp.resize();
  loadInspector(key);
}
function closeInspector() {
  inspEl.classList.remove('is-open'); inspEl.setAttribute('aria-hidden', 'true');
  lenis.start(); heroStage.running = true;
  setTimeout(() => { if (insp && !inspEl.classList.contains('is-open')) { insp.running = false; insp.renderer.setAnimationLoop(null); } }, 900);
}
async function loadInspector(key) {
  inspKey = key;
  const c = MODELS[key];
  inspEl.style.setProperty('--i-bg', c.bg); inspEl.style.setProperty('--i-bg2', c.bg2); inspEl.style.setProperty('--i-ink', c.ink);
  $('#inspTitle').textContent = c.title; $('#inspKind').textContent = c.kind; $('#inspWord').textContent = c.word;
  $$('#inspModels button').forEach((b) => b.classList.toggle('is-active', b.dataset.k === key));
  insp.setColors(c); applyLight('match');
  insp.camera.position.set(0, 0.6, (c.clay ? 6.5 : 5.2) * (innerWidth < 760 ? 1.45 : 1)); insp.controls.target.set(0, 0, 0);
  const m = await insp.show(key);
  if (!m) return;
  setMode(m, inspMode, c.ink);
  $('#inspExplode').value = 0;
  $('#inspExplodeG').style.display = m.userData.parts.length > 2 ? '' : 'none';
  const sw = $('#inspSwatches');
  if (c.swatches && c.swatches.length) {
    $('#inspSwatchG').style.display = '';
    sw.innerHTML = c.swatches.map((s, i) => `<button title="${esc(s.name)}" style="--c:${col(s.color)}" data-hex="${col(s.color)}" class="${i === 0 ? 'is-active' : ''}"></button>`).join('');
    setColorway(m, col(c.swatches[0].color));
  } else $('#inspSwatchG').style.display = 'none';
  const st = m.userData.stats;
  const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : n);
  $('#inspStats').innerHTML = `<div><dt>Tris</dt><dd>${fmt(st.tris)}</dd></div><div><dt>Meshes</dt><dd>${st.meshes}</dd></div><div><dt>Mats</dt><dd>${st.materials}</dd></div>`;
}
$('#inspSwatches').addEventListener('click', (e) => { const b = e.target.closest('[data-hex]'); if (!b || !insp.model) return; $$('#inspSwatches button').forEach((x) => x.classList.toggle('is-active', x === b)); setColorway(insp.model, b.dataset.hex); });
$('#inspModes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]'); if (!b || !insp.model) return;
  inspMode = b.dataset.mode; $$('#inspModes button').forEach((x) => x.classList.toggle('is-active', x === b));
  setMode(insp.model, inspMode, MODELS[inspKey].ink);
});
function applyLight(kind) {
  const c = MODELS[inspKey];
  $$('#inspLights button').forEach((x) => x.classList.toggle('is-active', x.dataset.light === kind));
  if (kind === 'match') { insp.setColors(c); insp.renderer.toneMappingExposure = 1.05; }
  if (kind === 'studio') { insp.rim.color.set('#ffffff'); insp.rim.intensity = 10; insp.key.intensity = 3; insp.scene.environmentIntensity = 1.2; insp.renderer.toneMappingExposure = 1.15; }
  if (kind === 'night') { insp.rim.color.set('#4b7bff'); insp.rim.intensity = 40; insp.key.intensity = 0.5; insp.scene.environmentIntensity = 0.25; insp.renderer.toneMappingExposure = 0.95; }
}
$('#inspLights').addEventListener('click', (e) => { const b = e.target.closest('[data-light]'); if (b) applyLight(b.dataset.light); });
$('#inspExplode').addEventListener('input', (e) => insp.model && explode(insp.model, e.target.value / 100));
$('#inspSpin').addEventListener('click', () => { inspSpin = !inspSpin; insp.controls.autoRotate = inspSpin; $('#inspSpin').textContent = 'Auto-rotate: ' + (inspSpin ? 'on' : 'off'); });
$('#inspShot').addEventListener('click', () => { const a = document.createElement('a'); a.href = insp.screenshot(); a.download = `${inspKey}-fuzail-ahmed.png`; a.click(); toast('Snapshot saved'); });
$('#inspClose').addEventListener('click', closeInspector);

/* ═════════════ LIGHTBOX ═════════════ */
let lbList = [], lbI = 0;
const lb = $('#lightbox');
function openLB(list, i) { if (!list) return; lbList = list; lbI = i; lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false'); lenis.stop(); showLB(); }
function showLB() {
  const it = lbList[lbI];
  $('#lbFig').innerHTML = it.type === 'video' ? `<video src="${it.src}" controls autoplay loop playsinline></video>` : `<img src="${it.src}" alt="${esc(it.cap)}">`;
  $('#lbCap').textContent = `${it.cap}  ·  ${lbI + 1} / ${lbList.length}`;
  gsap.fromTo('#lbFig > *', { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' });
}
function closeLB() { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); $('#lbFig').innerHTML = ''; if (!inspEl.classList.contains('is-open')) lenis.start(); }
$('#lbClose').onclick = closeLB;
$('#lbPrev').onclick = () => { lbI = (lbI - 1 + lbList.length) % lbList.length; showLB(); };
$('#lbNext').onclick = () => { lbI = (lbI + 1) % lbList.length; showLB(); };
lb.addEventListener('click', (e) => { if (e.target === lb) closeLB(); });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (lb.classList.contains('is-open')) closeLB(); else if (inspEl.classList.contains('is-open')) closeInspector(); }
  if (lb.classList.contains('is-open')) { if (e.key === 'ArrowRight') $('#lbNext').click(); if (e.key === 'ArrowLeft') $('#lbPrev').click(); }
  else if (!inspEl.classList.contains('is-open') && heroStage.visible) { if (e.key === 'ArrowRight') $('#nextModel').click(); if (e.key === 'ArrowLeft') $('#prevModel').click(); }
});

/* ═════════════ LOADER & BOOT ═════════════ */
let loaded = false, ready = false, shown = 0, target = 0;
const msgs = ['Warming up the render engine', 'Loading meshes', 'Decoding Draco geometry', 'Baking light', 'Almost there'];
manager.onProgress = (_u, l, t) => { target = Math.max(target, Math.round((l / t) * 100)); };
const tick = () => {
  shown += (Math.min(target, loaded ? 100 : 96) - shown) * 0.12;
  const v = Math.round(shown);
  $('#loadNum').textContent = v; $('#loadBar').style.width = v + '%';
  $('#loadMsg').textContent = msgs[Math.min(msgs.length - 1, Math.floor(v / 22))];
  if (loaded && v >= 99) finishLoad(); else requestAnimationFrame(tick);
};
requestAnimationFrame(tick);

function finishLoad() {
  const tl = gsap.timeline();
  tl.to('#loader .loader__count, #loader .loader__bar, #loader .loader__top, #loader .loader__bottom', { y: -40, opacity: 0, duration: 0.6, ease: 'power3.in', stagger: 0.04 })
    .to('#loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.2')
    .add(() => { $('#loader').classList.add('is-done'); document.body.classList.remove('is-loading'); lenis.start(); ScrollTrigger.refresh(); }, '-=0.6')
    .from('#wordSolid .ch, #wordOutline .ch', { yPercent: 110, duration: 1.4, ease: 'expo.out', stagger: 0.05 }, '-=0.7')
    .from('.nav > *, .hero__intro > *, .hero__meta > *', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.06, clearProps: 'transform,opacity' }, '-=1.1');
  heroStage.model && (heroStage.model.userData.intro = 0);
  ready = true; autoT = 0;
}

async function boot() {
  try { MEDIA = await (await fetch('assets/media.json')).json(); } catch { MEDIA = {}; }
  renderMore();
  if (SHOWROOM.length) setHero(0, true); else $('#hero').style.display = 'none';
  const first = SHOWROOM.length ? loadGLTF(SHOWROOM[0]) : Promise.resolve();
  await Promise.race([Promise.all([first, document.fonts.ready]), new Promise((r) => setTimeout(r, 15000))]);
  target = 100; loaded = true;
  observeReveals();
  // lazy init secondary stages when near viewport
  const lazy = (sel, fn) => { const o = new IntersectionObserver((e) => { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: '600px' }); o.observe($(sel)); };
  lazy('#furnCanvasWrap', initFurniture);
  lazy('#archCanvasWrap', initArch);
  initHScroll();
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  // warm the cache with the other showroom models
  setTimeout(() => SHOWROOM.slice(1).forEach((k, i) => setTimeout(() => loadGLTF(k), i * 400)), 1500);
  setTimeout(() => ScrollTrigger.refresh(), 2500);
  addEventListener('load', () => ScrollTrigger.refresh());
}
boot();
window.__portfolio = { heroStage, MODELS, openInspector, setHero };
