// About page — content from content.json → "about" (+ engineering details from "dev")
import { CONTENT } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (u) => (/^(https:\/\/|mailto:)/.test(u || '') ? u : '');
const sid = (v) => String(v || '').replace(/[^a-z0-9_-]/gi, '');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const AB = CONTENT.about || {}, D = CONTENT.dev || {}, A = CONTENT.artist || {};
const vis = (l) => (l || []).filter((x) => x && !x.hidden);
const EMAIL = A.email || '';
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('is-on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-on'), 2200); }

/* hero */
const parts = (A.name || 'Fuzail Ahmed').toUpperCase().split(' ');
$('#name').innerHTML = [parts[0], parts.slice(1).join(' ')].filter(Boolean)
  .map((w, wi) => `<span class="${wi ? 'b' : 'a'}">${[...w].map((c, i) => `<b class="ch" style="animation-delay:${(wi * 6 + i) * 50 + 200}ms;font-weight:inherit">${esc(c)}</b>`).join('')}</span>`).join('');
const initials = parts.map((w) => w[0]).join('').slice(0, 2);
$('#photoMono').textContent = initials;
if (AB.photo) { const im = $('#photoImg'); im.src = `assets/img/${sid(AB.photo)}.webp`; im.onload = () => { im.hidden = false; $('#photoMono').hidden = true; }; }
// "3D Artist, AI Engineer & Software / Game Developer" → colour the creative and technical halves
const title = AB.title || A.role || '';
$('#title').innerHTML = esc(title).replace(/(3D[^,&]*)/i, '<em>$1</em>').replace(/(AI[^,&]*|Engineer[^,&]*)/, '<span class="t">$1</span>');
$('#ringText').textContent = (title ? title.toUpperCase().replace(/\s*[,&]\s*/g, ' • ') : '3D ARTIST • ENGINEER') + ' • ';
const btns = [];
const CV_PDF = /^assets\/cv\/[a-z0-9][a-z0-9_-]*\.pdf$/.test(AB.cvPdf || '') ? AB.cvPdf : '';
const CV_URL = CV_PDF || safe(AB.cv);
if (CV_PDF) btns.push(`<a class="btn btn--warm" href="#cv">View CV <i>↓</i></a><a class="btn" href="${esc(CV_PDF)}" download="Fuzail_Ahmed_CV.pdf">Download CV <i>⤓</i></a>`);
else if (CV_URL) btns.push(`<a class="btn btn--warm" href="${esc(CV_URL)}" target="_blank" rel="noopener noreferrer">Download CV <i>↓</i></a>`);
if (EMAIL) btns.push(`<a class="btn ${CV_URL ? '' : 'btn--warm'}" href="mailto:${esc(EMAIL)}">Email me <i>→</i></a>`);
btns.push(`<a class="btn" href="#experience">Experience <i>↓</i></a>`);
$('#heroBtns').innerHTML = btns.join('');
$('#facts').innerHTML = (AB.facts || []).filter((f) => f.label || f.value).map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('');

/* summary: paragraphs; highlight a few words */
const sum = (AB.summary || '').split(/\n\s*\n/).filter(Boolean);
$('#summaryText').innerHTML = sum.map((p) => `<p class="reveal">${esc(p)
  .replace(/(3D modeler|environment designer|CGI specialist|3D product designs?|CGI productions?)/gi, '<span class="hl-a">$1</span>')
  .replace(/(computer science|applied AI|software engineering|AXIS|RAG pipeline)/gi, '<span class="hl-b">$1</span>')}</p>`).join('');
if (!sum.length) $('#summary').hidden = true;

/* two sides */
const nProducts = vis(CONTENT.featured).length, nModels = Object.values(CONTENT.models || {}).filter((m) => !m.hidden).length;
$('#artCount').textContent = `${nProducts} product case studies · ${nModels} interactive 3D models`;
const nCode = vis(D.projects).length;
$('#codeCount').textContent = `${nCode} AI, software & hardware projects`;

/* experience */
const tl = (list, el) => { el.innerHTML = list.map((t) => `<li class="reveal"><span class="when">${esc(t.when)}</span><h4>${esc(t.title)}</h4>${t.org ? `<span class="org">${esc(t.org)}</span>` : ''}${t.note ? `<p>${esc(t.note)}</p>` : ''}</li>`).join(''); };
const work = vis(D.timeline).filter((t) => (t.kind || 'work') !== 'edu');
// the 3D contract also lives in the engineering timeline — show it once, on the 3D side
const art = vis(AB.creative);
tl(work.filter((t) => !art.some((a) => a.title === t.title && a.org === t.org)), $('#expCode'));
tl(art, $('#expArt'));
if (!work.length && !art.length) $('#experience').hidden = true;

/* projects */
$('#projCode').innerHTML = vis(D.projects).map((p) => `<a class="proj reveal" href="dev.html#projects"><h4>${esc(p.title)}</h4><span class="when">${esc(p.year || '')}</span>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}</a>`).join('');
$('#projArt').innerHTML = vis(AB.projects3d).map((p) => `<a class="proj reveal ${p.image ? 'has-img' : ''}" href="3d.html">${p.image ? `<img src="assets/thumb/${sid(p.image)}.webp" alt="" loading="lazy">` : ''}<h4>${esc(p.title)}</h4><span class="when">${esc(p.when || '')}</span>${p.role ? `<span class="role">${esc(p.role)}</span>` : ''}${p.note ? `<p>${esc(p.note)}</p>` : ''}</a>`).join('');

/* skills */
const skills = (groups, el, label) => { el.innerHTML = `<h3><span>${label}</span> ${label === '3D' ? '3D &amp; CGI' : 'Engineering'}</h3>` + (groups || []).filter((g) => g.items && g.items.length).map((g) => `<div class="skg reveal"><h4>${esc(g.title)}</h4><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join(''); };
skills(D.skills, $('#skillCode'), '&gt;_');
skills(AB.skills3d, $('#skillArt'), '3D');
$('#skillArt h3 span').textContent = '3D';

/* education */
const edu = vis(D.timeline).filter((t) => t.kind === 'edu');
$('#edu').innerHTML = edu.map((t) => `<div class="reveal"><span class="when">${esc(t.when)}</span><h4>${esc(t.title)}</h4><span class="org">${esc(t.org)}</span>${t.note ? `<p>${esc(t.note)}</p>` : ''}</div>`).join('');
if (!edu.length) $('#education').hidden = true;

/* contact */
$('#mailBig').href = 'mailto:' + EMAIL;
const links = [`<button class="btn btn--warm" id="copyMail">${esc(EMAIL)} <i>⧉</i></button>`];
if (CV_URL) links.push(`<a class="btn" href="${esc(CV_URL)}" ${CV_PDF ? 'download="Fuzail_Ahmed_CV.pdf"' : 'target="_blank" rel="noopener noreferrer"'}>CV <i>↓</i></a>`);
if (D.github) links.push(`<a class="btn" href="https://github.com/${esc(D.github)}" target="_blank" rel="noopener noreferrer me">GitHub <i>↗</i></a>`);
(A.socials || []).filter((s) => !s.hidden && safe(s.url)).forEach((s) => links.push(`<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer me">${esc(s.label)} <i>↗</i></a>`));
$('#contactRow').innerHTML = links.join('');
const copy = (e) => { e.preventDefault(); navigator.clipboard?.writeText(EMAIL).then(() => toast('Email copied — talk soon!'), () => (location.href = 'mailto:' + EMAIL)); };
$('#copyMail').addEventListener('click', copy); $('#mailBig').addEventListener('click', copy);
$('#year').textContent = new Date().getFullYear();

/* CV viewer (pdf.js renders the pages; PDF scripts never run) — one page fills the frame, scroll or arrows flip */
async function cvViewer() {
  if (!CV_PDF) return;
  const sec = $('#cv'); sec.hidden = false;
  const box = $('#cvPagesBox');
  $('#cvOpen').href = CV_PDF; $('#cvDown').href = CV_PDF; $('#cvDown').setAttribute('download', 'Fuzail_Ahmed_CV.pdf');
  let pdf, lib;
  try {
    lib = await import('../vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    pdf = await lib.getDocument({ url: CV_PDF, isEvalSupported: false, enableXfa: false }).promise;
  } catch (e) {
    console.warn('CV viewer fallback:', e);
    box.innerHTML = `<iframe class="cvv__fallback" src="${esc(CV_PDF)}#view=FitH" title="CV"></iframe>`;
    $('.cvsec__nav').hidden = true; return;
  }
  const n = pdf.numPages, pad = (v) => String(v).padStart(2, '0');
  const first = await pdf.getPage(1), vp1 = first.getViewport({ scale: 1 });
  const ar = `${vp1.width} / ${vp1.height}`;
  box.style.setProperty('--ar', ar); box.style.setProperty('--arn', (vp1.width / vp1.height).toFixed(4));
  $('#cvTotal').textContent = pad(n);
  box.innerHTML = Array.from({ length: n }, (_, i) => `<div class="cvv__page" data-n="${i + 1}" style="--ar:${ar}"></div>`).join('');
  $('#cvThumbs').innerHTML = Array.from({ length: n }, (_, i) => `<button type="button" data-n="${i + 1}" aria-label="Page ${i + 1}" style="aspect-ratio:${ar}"></button>`).join('');
  const pages = $$('.cvv__page', box), thumbs = $$('#cvThumbs button');
  const draw = async (num, target, width, q = 1) => {
    const page = await pdf.getPage(num), base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: (width / base.width) * q });
    const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    target.querySelector('canvas')?.remove(); target.appendChild(c);
  };
  const render = (p) => { const w = p.clientWidth || 700; if (p._w === w) return; p._w = w; draw(+p.dataset.n, p, w, Math.min(devicePixelRatio || 1, 2) * 1.3); };
  const io2 = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) render(e.target); }), { root: box, rootMargin: '100% 0px' });
  pages.forEach((p) => io2.observe(p));
  thumbs.forEach((t) => draw(+t.dataset.n, t, 96));
  let now = 1;
  const hint = $('#cvHint'); hint.hidden = n < 2;
  const setNow = (v) => {
    now = v; $('#cvNow').textContent = pad(v); thumbs.forEach((t) => t.classList.toggle('is-on', +t.dataset.n === v));
    const end = v >= n; hint.classList.toggle('is-end', end); $('.cvhint__txt', hint).textContent = end ? 'back to top' : 'scroll'; hint.setAttribute('aria-label', end ? 'Back to the first page' : 'Next page');
  };
  box.addEventListener('scroll', () => { setNow(Math.min(n, Math.round(box.scrollTop / box.clientHeight) + 1)); }, { passive: true });
  const go = (v) => { v = Math.max(1, Math.min(n, v)); box.scrollTo({ top: (v - 1) * box.clientHeight, behavior: reduce ? 'auto' : 'smooth' }); };
  $('#cvPrev').onclick = () => go(now - 1); $('#cvNext').onclick = () => go(now + 1);
  hint.onclick = () => go(now >= n ? 1 : now + 1);
  $('#cvThumbs').addEventListener('click', (e) => { const t = e.target.closest('[data-n]'); if (t) go(+t.dataset.n); });
  box.addEventListener('keydown', (e) => { if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); go(now + 1); } if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(now - 1); } });
  setNow(1);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => pages.forEach((p) => { p._w = 0; const r = p.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.bottom > b.top && r.top < b.bottom) render(p); }), 250); });
}
cvViewer();

/* nav + reveals */
addEventListener('scroll', () => $('.nav').classList.toggle('is-solid', scrollY > 30), { passive: true });
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.1 });
$$('main > section:not(.hero) .reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });

/* sparks along the hero seam */
const cv = $('#heroSparks'), cx = cv.getContext('2d');
let W, H; const sp = [];
const DPR = Math.min(devicePixelRatio || 1, 2);
const size = () => { const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * DPR; cv.height = H * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0); };
addEventListener('resize', size); size();
function loop() {
  cx.clearRect(0, 0, W, H);
  const x1 = W * 0.58, x2 = W * 0.42;
  const g = cx.createLinearGradient(x1, 0, x2, H); g.addColorStop(0, '#3cf2c1'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, '#ff6a2a');
  cx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [[22, 0.06], [8, 0.2], [2, 0.9]]) { cx.strokeStyle = g; cx.globalAlpha = a; cx.lineWidth = w; cx.beginPath(); cx.moveTo(x1, 0); cx.lineTo(x2, H); cx.stroke(); }
  if (Math.random() < 0.5) { const t = Math.random(), d = Math.random() < 0.5 ? -1 : 1; sp.push({ x: x1 + (x2 - x1) * t, y: H * t, vx: d * (0.5 + Math.random() * 1.6), vy: (Math.random() - 0.5) * 0.8, l: 1, c: d < 0 ? '#ff8a3d' : '#3cf2c1' }); }
  for (let i = sp.length - 1; i >= 0; i--) { const p = sp[i]; p.x += p.vx; p.y += p.vy; p.l -= 0.014; if (p.l <= 0) { sp.splice(i, 1); continue; } cx.globalAlpha = p.l; cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, 1.6, 0, 7); cx.fill(); }
  cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(loop);
}
if (!reduce) loop();
