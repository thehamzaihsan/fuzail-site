// Engineering portfolio — everything comes from content.json → "dev" (edited in the dashboard)
import { CONTENT } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^(https:\/\/|mailto:)/.test(u || '') ? u : '');
const img = (id) => `assets/img/${String(id).replace(/[^a-z0-9_-]/gi, '')}.webp`;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const D = CONTENT.dev || {};
const A = CONTENT.artist || {};
const vis = (l) => (l || []).filter((x) => x && !x.hidden);
const PROJECTS = vis(D.projects);
const SKILLS = (D.skills || []).filter((g) => g.items && g.items.length);
const TIMELINE = vis(D.timeline);
const STATS = (D.stats || []).filter((s) => s.label || s.value);
const SOCIALS = (A.socials || []).filter((s) => !s.hidden && safeUrl(s.url));
const EMAIL = A.email || '';
const GH = D.github || '';
const first = (A.first || (A.name || 'Fuzail').split(' ')[0]).toLowerCase();

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('is-on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-on'), 2200); }
const italics = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');

/* ───────── hero ───────── */
$('#logoName').textContent = first;
$('#role').textContent = (D.role || 'computer science engineer').toLowerCase();
const nameParts = (A.name || 'Fuzail Ahmed').toUpperCase().split(' ');
$('#heroName').innerHTML = [nameParts[0], nameParts.slice(1).join(' ') || ''].filter(Boolean)
  .map((w, wi) => `<span>${[...w].map((c, i) => `<b class="ch" style="animation-delay:${(wi * 6 + i) * 45 + 150}ms">${esc(c)}</b>`).join('')}</span>`).join('');
$('#headline').innerHTML = italics(D.headline || '');
if (D.status) { $('#status').hidden = false; $('#status b').textContent = D.status; }
if (D.location) { $('#loc').hidden = false; $('#loc').textContent = D.location; }
const btns = [];
if (GH) btns.push(`<a class="btn btn--solid" href="https://github.com/${esc(GH)}" target="_blank" rel="noopener noreferrer me">github <i>↗</i></a>`);
if (safeUrl(D.resume)) btns.push(`<a class="btn" href="${esc(D.resume)}" target="_blank" rel="noopener noreferrer">résumé / cv <i>↓</i></a>`);
if (EMAIL) btns.push(`<a class="btn ${GH ? '' : 'btn--solid'}" href="mailto:${esc(EMAIL)}">say hello <i>→</i></a>`);
if (PROJECTS.length) btns.push(`<a class="btn" href="#projects">see projects <i>↓</i></a>`);
$('#heroBtns').innerHTML = btns.join('');

/* ───────── stats ───────── */
if (STATS.length) { $('#stats').hidden = false; $('#stats').innerHTML = STATS.map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join(''); }

/* ───────── about ───────── */
if (D.intro) {
  $('#about').hidden = false;
  $('#aboutText').textContent = D.intro;
  const top = SKILLS.flatMap((g) => g.items).slice(0, 5);
  const row = (k, v) => `  <span class="p">${k}</span>: ${v},`;
  const str = (v) => `<span class="s">"${esc(v)}"</span>`;
  $('#aboutCode').innerHTML = [`<span class="k">const</span> ${esc(first)} = {`,
    row('role', str((D.role || 'engineer').toLowerCase())),
    D.location && row('location', str(D.location)),
    top.length && row('stack', `[${top.map(str).join(', ')}]`),
    PROJECTS.length && row('projects', `<span class="n">${PROJECTS.length}</span>`),
    row('side_quest', str('3D art in Blender')),
    D.status && row('status', str(D.status.toLowerCase())),
    '};'].filter(Boolean).join('\n');
}

/* ───────── projects ───────── */
if (PROJECTS.length) {
  $('#projects').hidden = false;
  const ordered = [...PROJECTS].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  const tags = [...new Set(ordered.flatMap((p) => p.stack || []))];
  if (tags.length > 1) $('#projFilters').innerHTML = ['all', ...tags.slice(0, 10)].map((t, i) => `<button class="chip ${i ? '' : 'is-on'}" data-t="${esc(t)}">${esc(t)}</button>`).join('');
  $('#projGrid').innerHTML = ordered.map((p, i) => {
    const big = i === 0 && (p.featured || ordered.length % 2 === 1);
    const initials = p.title.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();
    const code = `$ git clone ${p.repo ? p.repo.replace(/^https:\/\//, '') : p.title.toLowerCase().replace(/\s+/g, '-')}`;
    return `<article class="pcard reveal ${big ? 'is-big' : ''}" data-i="${PROJECTS.indexOf(p)}" data-tags="${esc((p.stack || []).join('|'))}">
      <div class="pcard__media">${p.image ? `<img src="${img(p.image)}" alt="${esc(p.title)}" loading="lazy">` : `<div class="pcard__gen" data-code="${esc(code)}">${esc(initials)}</div>`}</div>
      <div class="pcard__body">
        <div class="pcard__top"><span>${String(i + 1).padStart(2, '0')} / ${esc(p.year || 'project')}</span><span class="pcard__links">${safeUrl(p.repo) ? `<a href="${esc(p.repo)}" target="_blank" rel="noopener noreferrer">code ↗</a>` : ''}${safeUrl(p.live) ? `<a href="${esc(p.live)}" target="_blank" rel="noopener noreferrer">live ↗</a>` : ''}</span></div>
        <h3>${esc(p.title)}</h3>
        ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
        <div class="tags">${(p.stack || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div></article>`;
  }).join('');
  $('#projFilters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    $$('#projFilters .chip').forEach((x) => x.classList.toggle('is-on', x === b));
    $$('.pcard').forEach((c) => c.classList.toggle('is-out', b.dataset.t !== 'all' && !c.dataset.tags.split('|').includes(b.dataset.t)));
  });
  $('#projGrid').addEventListener('click', (e) => { if (e.target.closest('a')) return; const c = e.target.closest('.pcard'); if (c) openProject(+c.dataset.i); });
  $('#projGrid').addEventListener('pointermove', (e) => { const c = e.target.closest('.pcard'); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty('--x', `${e.clientX - r.left}px`); c.style.setProperty('--y', `${e.clientY - r.top}px`); });
}
function openProject(i) {
  const p = PROJECTS[i]; if (!p) return;
  $('#modalBox').innerHTML = `<button class="modal__close" data-close aria-label="Close">✕</button>${p.image ? `<img src="${img(p.image)}" alt="${esc(p.title)}">` : ''}
    <div class="modal__in"><p class="kicker"><span class="g">//</span> ${esc(p.year || 'project')}</p><h3>${esc(p.title)}</h3>
    ${p.summary ? `<p class="sum">${esc(p.summary)}</p>` : ''}${p.body ? `<p class="body">${esc(p.body)}</p>` : ''}
    <div class="tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:22px">${(p.stack || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">${safeUrl(p.repo) ? `<a class="btn btn--solid" href="${esc(p.repo)}" target="_blank" rel="noopener noreferrer">view code <i>↗</i></a>` : ''}${safeUrl(p.live) ? `<a class="btn" href="${esc(p.live)}" target="_blank" rel="noopener noreferrer">open live <i>↗</i></a>` : ''}</div></div>`;
  $('#modal').classList.add('is-open'); $('#modal').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}
function closeModal() { $('#modal').classList.remove('is-open'); $('#modal').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); document.body.classList.remove('menu-open'); } });

/* ───────── GitHub repos (public API, no token) ───────── */
const LANG = { JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584', HTML: '#e34c26', CSS: '#563d7c', Kotlin: '#A97BFF', Swift: '#F05138', Dart: '#00B4AB', PHP: '#4F5D95', Ruby: '#701516', Shell: '#89e051', Jupyter: '#DA5B0B', 'Jupyter Notebook': '#DA5B0B', Vue: '#41b883', GDScript: '#355570' };
let REPOS = [];
async function loadRepos() {
  if (!GH || D.githubRepos === false) return;
  $('#github').hidden = false; $('#ghAll').href = `https://github.com/${GH}?tab=repositories`;
  $('#repoGrid').innerHTML = '<div class="repo sk"></div>'.repeat(3);
  try {
    let data = null;
    try { const c = JSON.parse(sessionStorage.getItem('fz-gh') || 'null'); if (c && c.u === GH && Date.now() - c.t < 30 * 60e3) data = c.d; } catch { /* no storage */ }
    if (!data) {
      const r = await fetch(`https://api.github.com/users/${encodeURIComponent(GH)}/repos?per_page=100&sort=pushed`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(r.status);
      data = (await r.json()).map((x) => ({ name: x.name, d: x.description, url: x.html_url, lang: x.language, stars: x.stargazers_count, forks: x.forks_count, fork: x.fork, pushed: x.pushed_at, archived: x.archived }));
      try { sessionStorage.setItem('fz-gh', JSON.stringify({ u: GH, t: Date.now(), d: data })); } catch { /* no storage */ }
    }
    REPOS = data.filter((x) => !x.fork && !x.archived && x.name.toLowerCase() !== GH.toLowerCase())
      .sort((a, b) => b.stars - a.stars || new Date(b.pushed) - new Date(a.pushed)).slice(0, 6);
    if (!REPOS.length) { $('#github').hidden = true; return; }
    const ago = (d) => { const days = Math.round((Date.now() - new Date(d)) / 864e5); return days < 1 ? 'today' : days < 30 ? `${days}d ago` : days < 365 ? `${Math.round(days / 30)}mo ago` : `${Math.round(days / 365)}y ago`; };
    $('#repoGrid').innerHTML = REPOS.map((x) => `<a class="repo reveal" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer"><h4>${esc(x.name)}</h4><p>${esc(x.d || 'No description yet.')}</p>
      <div class="meta">${x.lang ? `<span class="lang"><i style="background:${LANG[x.lang] || '#8aa'}"></i>${esc(x.lang)}</span>` : ''}<span>★ ${x.stars}</span><span>⑂ ${x.forks}</span><span style="margin-left:auto">${ago(x.pushed)}</span></div></a>`).join('');
    observe();
  } catch { $('#github').hidden = true; }
  buildNav();
}

/* ───────── skills & journey ───────── */
if (SKILLS.length) { $('#skills').hidden = false; $('#skillGrid').innerHTML = SKILLS.map((g) => `<div class="skill reveal"><h4>${esc(g.title)}</h4><ul>${g.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`).join(''); }
if (TIMELINE.length) {
  $('#journey').hidden = false;
  const K = { work: 'work', edu: 'education', award: 'award' };
  $('#timeline').innerHTML = TIMELINE.map((t) => `<li class="tl ${esc(t.kind || 'work')} reveal"><div class="tl__when">${esc(t.when)}</div><div class="tl__body"><h4>${esc(t.title)}<span class="kind">${K[t.kind] || 'work'}</span></h4>${t.org ? `<span class="org">@ ${esc(t.org)}</span>` : ''}${t.note ? `<p>${esc(t.note)}</p>` : ''}</div></li>`).join('');
}

/* ───────── contact ───────── */
$('#mailText').textContent = EMAIL; $('#mailBig').href = 'mailto:' + EMAIL;
$('#socials').innerHTML = [...(GH ? [{ label: 'GitHub', url: `https://github.com/${GH}` }] : []), ...SOCIALS.filter((s) => !(GH && /github\.com/i.test(s.url)))]
  .map((s) => `<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer me">${esc(s.label.toLowerCase())} <i>↗</i></a>`).join('');
const copyMail = (e) => { e.preventDefault(); navigator.clipboard?.writeText(EMAIL).then(() => toast('email copied — talk soon'), () => (location.href = 'mailto:' + EMAIL)); };
$('#copyMail').addEventListener('click', copyMail); $('#mailBig').addEventListener('click', copyMail);
$('#year').textContent = new Date().getFullYear();

/* ───────── nav ───────── */
const SECTIONS = [['about', 'about'], ['projects', 'projects'], ['github', 'github'], ['skills', 'stack'], ['journey', 'journey'], ['contact', 'contact']];
function buildNav() { $('#navLinks').innerHTML = SECTIONS.filter(([id]) => !document.getElementById(id).hidden).map(([id, l]) => `<a href="#${id}">${l}</a>`).join(''); }
buildNav();
$('#navLinks').addEventListener('click', () => document.body.classList.remove('menu-open'));
$('#burger').addEventListener('click', () => document.body.classList.toggle('menu-open'));
addEventListener('scroll', () => { $('#nav').classList.toggle('is-solid', scrollY > 30); }, { passive: true });
const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) $$('#navLinks a').forEach((a) => a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
SECTIONS.forEach(([id]) => spy.observe(document.getElementById(id)));

/* ───────── reveals ───────── */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.12 });
function observe() { $$('.reveal:not(.is-in)').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); }); }
observe();

/* ───────── cursor glow + background network ───────── */
addEventListener('pointermove', (e) => { document.documentElement.style.setProperty('--mx', e.clientX + 'px'); document.documentElement.style.setProperty('--my', e.clientY + 'px'); mx = e.clientX; my = e.clientY; });
const cv = $('#bgNet'), cx = cv.getContext('2d');
let W, H, mx = -999, my = -999, pts = [];
const DPR = Math.min(devicePixelRatio || 1, 2);
function size() {
  W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  pts = Array.from({ length: Math.round(Math.min(80, (W * H) / 22000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18 }));
}
function tick() {
  cx.clearRect(0, 0, W, H);
  const fade = Math.max(0.25, 1 - scrollY / (H * 1.2));
  for (const p of pts) { p.x = (p.x + p.vx + W) % W; p.y = (p.y + p.vy + H) % H; }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    for (let j = i + 1; j < pts.length; j++) {
      const b = pts[j], d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (d < 16000) { cx.strokeStyle = `rgba(60,242,193,${(1 - d / 16000) * 0.16 * fade})`; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke(); }
    }
    const dm = (a.x - mx) ** 2 + (a.y - my) ** 2;
    if (dm < 30000) { cx.strokeStyle = `rgba(155,255,226,${(1 - dm / 30000) * 0.4})`; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(mx, my); cx.stroke(); }
    cx.fillStyle = `rgba(200,255,240,${0.55 * fade})`; cx.fillRect(a.x - 1, a.y - 1, 2, 2);
  }
  requestAnimationFrame(tick);
}
addEventListener('resize', size); size(); if (!reduce) requestAnimationFrame(tick);

/* ───────── interactive shell ───────── */
const out = $('#shellOut'), input = $('#shellInput');
const hist = []; let hi = 0;
const k = (c) => `<button type="button" class="k" data-cmd="${esc(c)}">${esc(c)}</button>`;
function print(html, cls = 'o') { const s = document.createElement('span'); s.className = cls; s.innerHTML = html; out.appendChild(s); out.scrollTop = out.scrollHeight; }
function scrollTo(id) { const el = document.getElementById(id); if (el && !el.hidden) setTimeout(() => el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }), 250); }
const CMDS = {
  help: () => print(`available commands:\n  ${['whoami', 'about', 'projects', 'open &lt;n&gt;', 'stack', 'journey', 'github', 'contact', 'cv', '3d', 'clear'].map((c) => (c.includes('&lt;') ? c : k(c))).join('  ')}`),
  whoami: () => print(`<span class="hl">${esc((A.name || 'Fuzail Ahmed').toLowerCase())}</span> — ${esc((D.role || 'computer science engineer').toLowerCase())}${D.location ? `\nlocation: ${esc(D.location)}` : ''}${D.status ? `\nstatus:   ${esc(D.status)}` : ''}`),
  about: () => { print(esc(D.intro || 'about me: coming soon.')); scrollTo('about'); },
  projects: () => { if (!PROJECTS.length) return print('no projects published yet — check back soon.'); print(PROJECTS.map((p, i) => `  [${i + 1}] <span class="hl">${esc(p.title)}</span>${p.stack && p.stack.length ? `  <span>(${esc(p.stack.slice(0, 3).join(', '))})</span>` : ''}`).join('\n') + `\ntype ${k('open 1')} for details`); },
  ls: () => CMDS.projects(),
  open: (a) => { const n = parseInt(a, 10); if (!PROJECTS[n - 1]) return print(`open: no project #${esc(a || '?')}`, 'o err'); print(`opening ${esc(PROJECTS[n - 1].title)}…`); openProject(n - 1); },
  stack: () => { if (!SKILLS.length) return print('stack: coming soon.'); print(SKILLS.map((g) => `<span class="hl">${esc(g.title)}</span>: ${esc(g.items.join(', '))}`).join('\n')); scrollTo('skills'); },
  skills: () => CMDS.stack(),
  journey: () => { if (!TIMELINE.length) return print('journey: coming soon.'); print(TIMELINE.map((t) => `${esc(t.when).padEnd(12)} <span class="hl">${esc(t.title)}</span>${t.org ? ` @ ${esc(t.org)}` : ''}`).join('\n')); scrollTo('journey'); },
  github: () => { if (!GH) return print('github: not linked yet.'); print(`<a href="https://github.com/${esc(GH)}" target="_blank" rel="noopener noreferrer">github.com/${esc(GH)}</a>${REPOS.length ? '\n' + REPOS.slice(0, 5).map((r) => `  ★${r.stars}  ${esc(r.name)}`).join('\n') : ''}`); },
  contact: () => { print(`email: <a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a>${SOCIALS.map((s) => `\n${esc(s.label.toLowerCase())}: <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url.replace(/^https:\/\/(www\.)?/, ''))}</a>`).join('')}`); },
  email: () => CMDS.contact(),
  cv: () => (safeUrl(D.resume) ? (print('opening cv…'), window.open(D.resume, '_blank', 'noopener')) : print('cv: available on request — try ' + k('contact'))),
  '3d': () => { print('switching to the 3D portfolio…'); setTimeout(() => (location.href = '3d.html'), 500); },
  art: () => CMDS['3d'](),
  clear: () => { out.innerHTML = ''; },
  sudo: () => print('nice try. this incident will be reported. 👀', 'o err'),
  date: () => print(new Date().toString()),
  echo: (a) => print(esc(a || '')),
  exit: () => { print('bye 👋'); setTimeout(() => (location.href = './'), 500); },
};
function run(line) {
  line = line.trim(); if (!line) return;
  print(esc(line), 'cmd'); hist.push(line); hi = hist.length;
  const [c, ...rest] = line.split(/\s+/);
  const fn = CMDS[c.toLowerCase()];
  fn ? fn(rest.join(' ')) : print(`command not found: ${esc(c)} — try ${k('help')}`, 'o err');
}
$('#shellForm').addEventListener('submit', (e) => { e.preventDefault(); run(input.value); input.value = ''; });
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' && hist.length) { hi = Math.max(0, hi - 1); input.value = hist[hi]; e.preventDefault(); }
  if (e.key === 'ArrowDown' && hist.length) { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; e.preventDefault(); }
  if (e.key === 'Tab') { const m = Object.keys(CMDS).find((c) => c.startsWith(input.value.toLowerCase()) && input.value); if (m) { input.value = m; e.preventDefault(); } }
});
out.addEventListener('click', (e) => { const b = e.target.closest('[data-cmd]'); if (b) run(b.dataset.cmd); });
$('#shell').addEventListener('click', (e) => { if (!e.target.closest('a,button') && !getSelection().toString()) input.focus({ preventScroll: true }); });
// boot sequence
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  await sleep(500);
  for (const c of ['whoami', PROJECTS.length ? 'projects' : null].filter(Boolean)) {
    let typed = ''; const line = document.createElement('span'); line.className = 'cmd'; out.appendChild(line);
    for (const ch of c) { typed += ch; line.textContent = typed; await sleep(55 + Math.random() * 45); }
    line.remove(); run(c); await sleep(450);
  }
  print(`type ${k('help')} to see what else I can do`);
})();
loadRepos();
