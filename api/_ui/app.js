// Fuzail Portfolio — Studio (admin dashboard)
// Vanilla JS, no inline scripts (strict CSP). All text is escaped before it touches innerHTML.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
// WEB = the copy of this dashboard served by the live site at /admincontrol (edits go straight to GitHub)
const WEB = location.pathname.startsWith('/admincontrol');
const SITE = WEB ? '' : '/site';
const APIBASE = WEB ? '/admincontrol/api/' : '/api/';
const A = (p) => APIBASE + p.replace(/^\/api\//, '');
const IMG = (id) => `${SITE}/assets/img/${encodeURIComponent(id)}.webp`;
const THUMB = (id) => `${SITE}/assets/thumb/${encodeURIComponent(id)}.webp`;
const POSTER = (id) => `${SITE}/assets/video/${encodeURIComponent(id)}.webp`;
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(c || '');

/* ─────────────── icons ─────────────── */
const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  home: I('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  cube: I('<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/>'),
  chair: I('<path d="M6 10V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/><path d="M4 10h16v5H4zM6 15v6M18 15v6"/>'),
  mountain: I('<path d="M3 20l6-10 4 6 3-4 5 8z"/><circle cx="17" cy="6" r="2"/>'),
  building: I('<path d="M4 21V5l8-3v19M12 8l8 3v10M8 7v.01M8 11v.01M8 15v.01M16 13v.01M16 17v.01M2 21h20"/>'),
  film: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/>'),
  grid: I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  image: I('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>'),
  clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  shield: I('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  drag: I('<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
  eye: I('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeoff: I('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7a9.6 9.6 0 0 0 4.4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  copy: I('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
  trash: I('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  upload: I('<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>'),
  lock: I('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  code: I('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'),
  split: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4L10 20"/>'),
};

/* ─────────────── API ─────────────── */
addEventListener('hashchange', () => { if (/k=/.test(location.hash)) location.reload(); });
let CSRF = null;
const KEY = (() => {
  const m = location.hash.match(/(?:^#|&)k=([A-Za-z0-9_-]{20,})/);
  if (m) { sessionStorage.setItem('fzk', m[1]); history.replaceState(null, '', location.pathname); }
  return sessionStorage.getItem('fzk') || '';
})();

const LOCAL = ['127.0.0.1', 'localhost'].includes(location.hostname);
const store = { get(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
// a phone opening the pairing link carries its permanent device key in the #dk= fragment (never sent in URLs to servers)
const PAIR = (() => { const m = location.hash.match(/dk=([A-Za-z0-9_-]{20,})/); if (m) history.replaceState(null, '', location.pathname); return m ? m[1] : ''; })();
async function api(method, path, body, extra = {}) {
  const headers = { ...(extra.headers || {}) };
  if (CSRF) headers['X-CSRF'] = CSRF;
  if (extra.launch && KEY) headers['X-Launch-Key'] = KEY;
  let payload;
  if (body instanceof Blob || body instanceof ArrayBuffer) { headers['Content-Type'] = 'application/octet-stream'; payload = body; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(A(path), { method, headers, body: payload, credentials: 'same-origin', cache: 'no-store' });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  if (r.status === 401 && !extra.launch) { await relogin(); return api(method, path, body, extra); }
  if (!r.ok) throw new Error((data && data.error) || `Request failed (${r.status})`);
  return data;
}

// the web admin can only take requests up to ~4 MB, so big renders are shrunk in the browser first
async function shrink(file) {
  if (!WEB || file.size < 3_500_000) return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  for (const q of [0.92, 0.85, 0.75]) {
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    if (b && b.size < 4_000_000) return b;
  }
  throw new Error('That image is too large even after resizing — upload it from the PC admin');
}
async function upload(kind, file, onProgress) {
  if (WEB && kind !== 'image') throw new Error('Videos and 3D models are uploaded from the admin on your PC (too large for the web).');
  const name = file.name; file = await shrink(file);
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('POST', A(`upload?kind=${kind}&name=${encodeURIComponent(name)}`));
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.setRequestHeader('X-CSRF', CSRF);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch {} x.status === 200 ? res(d) : rej(new Error(d.error || 'Upload failed')); };
    x.onerror = () => rej(new Error('Upload failed'));
    x.send(file);
  });
}

/* ─────────────── toasts / modal / drawer ─────────────── */
function toast(msg, kind = '') {
  const t = el(`<div class="toast ${kind}">${esc(msg)}</div>`);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 6000 : 3200);
}
function openModal(html, cls = '') {
  // fresh element every time so click handlers from earlier dialogs can't fire again
  const old = $('#modalBox'); const box = old.cloneNode(false); old.replaceWith(box);
  box.className = 'modal__box ' + cls; box.innerHTML = html;
  $('#modal').classList.add('open'); $('#modal').setAttribute('aria-hidden', 'false');
  return box;
}
function closeModal() { $('#modal').classList.remove('open'); $('#modal').setAttribute('aria-hidden', 'true'); $('#modalBox').innerHTML = ''; }
function confirmBox(title, text, okLabel = 'Confirm', danger = false) {
  return new Promise((res) => {
    const b = openModal(`<div class="mhead"><h3>${esc(title)}</h3></div><div class="mbody"><p class="muted" style="margin:0">${esc(text)}</p></div>
      <div class="mfoot"><button class="btn ghost" data-a="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(okLabel)}</button></div>`, 'small');
    b.addEventListener('click', (e) => { const a = e.target.closest('[data-a]'); if (!a) return; closeModal(); res(a.dataset.a === 'yes'); });
  });
}
let drawerClose = null;
function openDrawer(build, { wide = false } = {}) {
  const d = $('#drawer'); d.classList.toggle('wide', wide);
  const old = $('#drawerPanel'); const p = old.cloneNode(false); old.replaceWith(p);
  drawerClose = build(p) || null;
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  if (typeof drawerClose === 'function') drawerClose();
  drawerClose = null;
  $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true');
  setTimeout(() => { if (!$('#drawer').classList.contains('open')) $('#drawerPanel').innerHTML = ''; }, 350);
}
$('#drawer').addEventListener('mousedown', (e) => { if (e.target.id === 'drawer') closeDrawer(); });
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('#modal').classList.contains('open')) closeModal(); else if ($('#drawer').classList.contains('open')) closeDrawer();
});

/* ─────────────── QR codes ─────────────── */
function fixQr(root) {
  $$('.qr script, .qr foreignObject', root).forEach((n) => n.remove());
  $$('.qr svg', root).forEach((svg) => {
    const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    if (!svg.getAttribute('viewBox') && w && h) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  });
}

/* ─────────────── gate: setup & login ─────────────── */
const gate = $('#gate');
const SHIELD = `<div class="shield"><span>Local-only server</span><span>Launch key</span><span>scrypt password</span><span>2-factor codes</span><span>Auto-lock</span></div>`;
function showGate(html) { $('#app').hidden = true; gate.hidden = false; gate.innerHTML = html; return gate; }

function noKeyScreen() {
  if (!LOCAL) return showGate(`<div class="card"><div class="lockico">${ICON.lock}</div><h1>Phone not paired</h1>
    <p>This device isn’t paired with your studio yet.</p>
    <p>On your PC open <b>Studio → Security → Pair a phone</b>, then scan the QR code with this phone’s camera. You only do this once — the phone stays paired until you revoke it.</p>${SHIELD}</div>`);
  showGate(`<div class="card"><div class="lockico">${ICON.lock}</div><h1>Locked</h1>
    <p>For your security the dashboard only opens from the launcher on your computer.</p>
    <p>Double-click <b>Start Admin.bat</b> in your <b>_website</b> folder — it opens this page with a one-time launch key.</p>${SHIELD}</div>`);
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 12) s++; if (pw.length >= 16) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

function setupScreen() {
  let pw = '', done;
  const finished = new Promise((r) => (done = r));
  const step1 = () => {
    const g = showGate(`<form class="card" id="f" autocomplete="off"><div class="steps"><i class="on"></i><i></i><i></i></div>
      <div class="lockico">${ICON.shield}</div><h1>Secure your studio</h1>
      <p>Choose a password only you know. At least 12 characters — a short sentence works great.</p>
      <div class="f"><label>Password</label><input type="password" id="p1" autocomplete="new-password" required minlength="12"></div>
      <div class="meter"><i id="m"></i></div>
      <div class="f"><label>Repeat password</label><input type="password" id="p2" autocomplete="new-password" required></div>
      <div class="err" id="err"></div><button class="btn primary">Continue</button>${SHIELD}</form>`);
    $('#p1', g).addEventListener('input', (e) => { const s = strength(e.target.value); const m = $('#m', g); m.style.width = (s + 1) * 20 + '%'; m.style.background = ['#ff5d5d', '#ff5d5d', '#f2b84b', '#a6d65a', '#4ccf8a'][s]; });
    $('#f', g).addEventListener('submit', (e) => {
      e.preventDefault();
      const a = $('#p1', g).value, b = $('#p2', g).value;
      if (a.length < 12) return ($('#err', g).textContent = 'Use at least 12 characters.');
      if (a !== b) return ($('#err', g).textContent = 'Passwords don’t match.');
      if (strength(a) < 2) return ($('#err', g).textContent = 'Make it a little stronger — mix words, numbers or symbols.');
      pw = a; step2();
    });
  };
  const step2 = async () => {
    let d;
    try { d = await api('POST', '/api/setup/begin', {}, { launch: true }); } catch (e) { return showGate(`<div class="card"><h1>Setup error</h1><p>${esc(e.message)}</p></div>`); }
    const g = showGate(`<form class="card" id="f" autocomplete="off"><div class="steps"><i class="on"></i><i class="on"></i><i></i></div>
      <h1>Add 2-step login</h1><p>Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 2FAS, Authy…). Then type the 6-digit code it shows.</p>
      ${d.qr ? `<div class="qr">${d.qr}</div>` : ''}
      <p class="mono muted" style="text-align:center;margin-bottom:6px">Can’t scan? Enter this key manually:</p><div class="secret">${esc(d.secret.replace(/(.{4})/g, '$1 ').trim())}</div>
      <div class="f" style="margin-top:16px"><label>6-digit code</label><input class="otp" id="c" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></div>
      <div class="err" id="err"></div><button class="btn primary" id="go">Verify & finish</button></form>`);
    // the QR svg comes from our own server (segno) — strip anything unexpected and make it scale
    fixQr(g);
    $('#c', g).focus();
    $('#f', g).addEventListener('submit', async (e) => {
      e.preventDefault(); $('#go', g).disabled = true;
      try { const r = await api('POST', '/api/setup/finish', { password: pw, code: $('#c', g).value }, { launch: true }); pw = ''; step3(r.recovery); }
      catch (er) { $('#err', g).textContent = er.message; $('#go', g).disabled = false; }
    });
  };
  const step3 = (codes) => {
    const g = showGate(`<div class="card"><div class="steps"><i class="on"></i><i class="on"></i><i class="on"></i></div>
      <h1>Save these codes</h1><p>If you lose your phone, each code below lets you sign in <b>once</b>. Store them somewhere safe and offline.</p>
      <div class="codes">${codes.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
      <div style="display:flex;gap:10px;margin-bottom:14px"><button class="btn" id="dl">Download .txt</button><button class="btn" id="cp">Copy</button></div>
      <label class="toggle"><input type="checkbox" id="ok"> I’ve saved my recovery codes</label>
      <button class="btn primary" id="go" disabled>Go to sign in</button></div>`);
    const txt = `Fuzail Portfolio — admin recovery codes\nGenerated ${new Date().toLocaleString()}\nEach code works once.\n\n${codes.join('\n')}\n`;
    $('#dl', g).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = 'portfolio-recovery-codes.txt'; a.click(); };
    $('#cp', g).onclick = () => navigator.clipboard.writeText(txt).then(() => toast('Copied'));
    $('#ok', g).onchange = (e) => ($('#go', g).disabled = !e.target.checked);
    $('#go', g).onclick = () => done();
  };
  step1();
  return finished;
}

function loginScreen({ resume } = {}) {
  return new Promise((resolve) => {
    const g = showGate(`<form class="card" id="f"><div class="lockico">${ICON.lock}</div><h1>${resume ? 'Session ended' : 'Welcome back'}</h1>
      <p>${resume ? 'You were signed out after a period of inactivity. Your unsaved edits are still here.' : 'Sign in to edit your portfolio.'}</p>
      <div class="f"><label>Password</label><input type="password" id="p" autocomplete="current-password" required></div>
      <div class="f"><label><span id="cl">Authenticator code</span><button type="button" class="mono muted" id="rc">Use a recovery code</button></label>
      <input class="otp" id="c" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required></div>
      <div class="err" id="err"></div><button class="btn primary" id="go">Sign in</button>${SHIELD}</form>`);
    let rcMode = false;
    $('#rc', g).onclick = () => {
      rcMode = !rcMode; const c = $('#c', g);
      c.classList.toggle('otp', !rcMode); c.maxLength = rcMode ? 16 : 6; c.inputMode = rcMode ? 'text' : 'numeric'; c.value = '';
      $('#cl', g).textContent = rcMode ? 'Recovery code' : 'Authenticator code'; $('#rc', g).textContent = rcMode ? 'Use authenticator' : 'Use a recovery code';
    };
    $('#p', g).focus();
    $('#f', g).addEventListener('submit', async (e) => {
      e.preventDefault(); const go = $('#go', g); go.disabled = true; go.innerHTML = '<span class="spin"></span>';
      try {
        const r = await api('POST', '/api/login', { password: $('#p', g).value, code: $('#c', g).value }, { launch: true });
        CSRF = r.csrf;
        if (r.recoveryLeft < 3) setTimeout(() => toast(`Only ${r.recoveryLeft} recovery codes left — make new ones in Security.`, 'bad'), 800);
        gate.hidden = true; gate.innerHTML = ''; resolve();
      } catch (er) { $('#err', g).textContent = er.message; go.disabled = false; go.textContent = 'Sign in'; $('#c', g).value = ''; }
    });
  });
}

let relogging = null;
async function relogin() {
  if (!relogging) {
    relogging = (async () => {
      CSRF = null;
      const wasApp = !$('#app').hidden;
      await loginScreen({ resume: wasApp });
      if (wasApp) $('#app').hidden = false;
    })().finally(() => (relogging = null));
  }
  return relogging;
}

/* ─────────────── app state ─────────────── */
let C = null, ORIG = '', MEDIA = { images: [], videos: [], models: [] }, PAGE = 'overview';
const dirty = () => JSON.stringify(C) !== ORIG;
function touch() {
  const d = dirty();
  $('#dirty').hidden = !d; $('#discardBtn').hidden = !d; $('#publishBtn').disabled = !d;
  renderNav();
}
addEventListener('beforeunload', (e) => { if (C && dirty()) { e.preventDefault(); e.returnValue = ''; } });
async function loadAll() {
  C = await api('GET', '/api/content'); normalize(C); ORIG = JSON.stringify(C);
  await refreshMedia();
}
async function refreshMedia() { MEDIA = await api('GET', '/api/media'); }
const mediaMeta = (id) => MEDIA.images.find((m) => m.id === id) || {};

/* ─────────────── sections (page order on the live site) ─────────────── */
// built-in site sections → the dashboard page that edits them
const BUILTIN = {
  work: { page: 'featured', label: 'Products', site: 'Work', icon: 'folder' },
  furniture: { page: 'furniture', label: 'Furniture', site: 'Furniture', icon: 'chair' },
  environments: { page: 'environments', label: 'Environments', site: 'Environments', icon: 'mountain' },
  archviz: { page: 'archviz', label: 'ArchViz', site: 'ArchViz', icon: 'building' },
  reel: { page: 'reel', label: 'Motion reel', site: 'Motion', icon: 'film' },
  more: { page: 'more', label: 'Archive', site: 'Archive', icon: 'grid', nav: false },
  about: { page: 'about', label: 'About & contact', site: 'About', icon: 'user' },
};
function normalize(c) {
  const list = Array.isArray(c.sections) ? c.sections : [];
  const have = new Set(list.map((x) => x.id));
  Object.entries(BUILTIN).forEach(([id, b]) => { if (!have.has(id)) list.push({ id, label: b.site, nav: b.nav !== false }); });
  c.sections = list;
  c.artist.socials = c.artist.socials || [];
  c.landing = c.landing || {};
  c.about = Object.assign({ photo: '', title: '', summary: '', cv: '', facts: [], creative: [], projects3d: [], skills3d: [] }, c.about || {});
  c.dev = Object.assign({ role: 'Computer Science Engineer', headline: '', intro: '', status: '', github: '', githubRepos: true, resume: '', terminal: [], projects: [], skills: [], timeline: [], stats: [] }, c.dev || {});
}
const secName = (s) => (s.custom ? s.label || s.title || 'Untitled section' : BUILTIN[s.id]?.label || s.id);

/* ─────────────── navigation ─────────────── */
function pages() {
  const content = [['overview', 'Overview', 'home'], ['sections', 'Page layout', 'drag'], ['models', '3D Models', 'cube']];
  (C ? C.sections : Object.keys(BUILTIN).map((id) => ({ id }))).forEach((s) => {
    if (s.custom) content.push(['sec:' + s.id, secName(s), 'image', s.hidden]);
    else if (BUILTIN[s.id]) content.push([BUILTIN[s.id].page, BUILTIN[s.id].label, BUILTIN[s.id].icon, s.hidden]);
  });
  return [['grp', 'Content'], ...content,
    ['grp', 'Start & engineering'], ['landing', 'Start page', 'split'], ['aboutme', 'About me', 'user'], ['devprofile', 'Engineering profile', 'code'], ['devprojects', 'Code projects', 'code'], ['devskills', 'Skills & journey', 'code'],
    ['grp', 'Library'], ['media', 'Media library', 'image'], ['grp', 'System'], ['history', 'History', 'clock'], ['security', 'Security', 'shield']];
}
const COUNT = { devprojects: () => (C.dev.projects || []).length, featured: () => C.featured.length, models: () => Object.keys(C.models).length, furniture: () => C.furniture.length, environments: () => C.environments.length, archviz: () => C.archviz.items.length, reel: () => C.reel.length, more: () => C.more.length };
const count = (k) => (k.startsWith('sec:') ? (C.sections.find((s) => 'sec:' + s.id === k)?.items || []).length : COUNT[k] ? COUNT[k]() : 0);
function renderNav() {
  $('#nav').innerHTML = pages().map(([k, l, ic, off]) => k === 'grp' ? `<div class="grp">${l}</div>` :
    `<button data-p="${esc(k)}" class="${PAGE === k ? 'on' : ''}" ${off ? 'style="opacity:.5" title="Hidden on the site"' : ''}>${ICON[ic]}<span>${esc(l)}</span>${count(k) ? `<span class="n">${count(k)}</span>` : ''}</button>`).join('');
}
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) go(b.dataset.p); });
function go(p) {
  PAGE = p; renderNav();
  let def = pages().find((x) => x[0] === p);
  if (!def) { p = PAGE = 'overview'; def = pages().find((x) => x[0] === p); renderNav(); }
  $('#title').textContent = def[1]; $('#crumb').textContent = 'Studio / ' + def[1];
  const v = $('#view'); v.innerHTML = '';
  if (p.startsWith('sec:')) customSectionPage(v, p.slice(4));
  else (VIEWS[p] || (() => {}))(v);
  window.scrollTo(0, 0);
}

/* ─────────────── publish ─────────────── */
$('#publishBtn').addEventListener('click', () => {
  const b = openModal(`<div class="mhead"><h3>Publish changes</h3></div><div class="mbody">
    <p class="muted" style="margin-top:0">Your live site updates as soon as you publish. A snapshot of the current version is kept in History so you can roll back.</p>
    <div class="f"><label>What changed? <em>optional</em></label><input type="text" id="note" maxlength="120" placeholder="e.g. Added new perfume project"></div></div>
    <div class="mfoot"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="yes">Publish now</button></div>`, 'small');
  $('#note', b).focus();
  b.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'no') return closeModal();
    a.disabled = true; a.innerHTML = '<span class="spin"></span>';
    try {
      const r = await api('PUT', '/api/content', { rev: C.rev, content: C, note: $('#note', b).value });
      C.rev = r.rev; ORIG = JSON.stringify(C); closeModal(); touch(); toast('Published — refresh your site to see it', 'ok');
      if (r.deploy) watchDeploy();
    } catch (er) { closeModal(); toast(er.message, 'bad'); }
  });
});
$('#discardBtn').addEventListener('click', async () => {
  if (!(await confirmBox('Discard changes?', 'All edits since your last publish will be lost.', 'Discard', true))) return;
  C = JSON.parse(ORIG); touch(); go(PAGE);
});
$('#lockBtn').addEventListener('click', async () => {
  if (dirty() && !(await confirmBox('Lock with unsaved changes?', 'Your unpublished edits will be lost.', 'Lock anyway', true))) return;
  try { await api('POST', '/api/logout', {}); } catch {}
  C = null; ORIG = ''; CSRF = null; location.reload();
});

/* ─────────────── GitHub publishing status ─────────────── */
let deployTimer = null;
async function watchDeploy() {
  clearTimeout(deployTimer);
  let first = true;
  const poll = async () => {
    let d; try { d = await api('GET', '/api/deploy'); } catch { return; }
    paintDeploy(d);
    if (d.state === 'queued' || d.state === 'running') { if (first) toast('Pushing to GitHub…'); first = false; deployTimer = setTimeout(poll, 2000); return; }
    if (d.state === 'ok') toast(`GitHub updated${d.commit ? ' (' + d.commit + ')' : ''}`, 'ok');
    if (d.state === 'error') toast('GitHub push failed — see Overview for details', 'bad');
    if (d.state === 'conflict') toast('Pushed, but some files were edited on GitHub too and were left untouched — see Overview', 'bad');
  };
  deployTimer = setTimeout(poll, 800);
}
function paintDeploy(d) {
  const box = $('#deployBox'); if (!box) return;
  const col = { ok: 'var(--ok)', conflict: 'var(--warn)', error: 'var(--bad)', running: 'var(--warn)', queued: 'var(--warn)', idle: 'var(--mut)' }[d.state] || 'var(--mut)';
  box.innerHTML = d.enabled ? `<p style="margin:0 0 6px"><b style="color:${col}">● ${esc(d.state === 'idle' ? 'Ready' : d.state)}</b> <span class="muted">${d.time ? esc(new Date(d.time * 1000).toLocaleString()) : ''}</span></p>
    <p class="muted" style="margin:0 0 12px;white-space:pre-wrap;font-size:12.5px">${esc(d.message || 'Every Publish is merged into the GitHub repo and pushed automatically — code edited on GitHub is kept.')}</p>
    <p class="mono muted" style="margin:0 0 12px">${esc(d.repo)} · ${esc(d.branch)}${d.commit ? ' · ' + esc(d.commit) : ''}</p>
    <button class="btn sm" id="pushNow">Push now</button>` : '<p class="muted" style="margin:0">GitHub publishing is not set up.</p>';
  const b = $('#pushNow', box); if (b) b.onclick = async () => { try { await api('POST', '/api/deploy', {}); watchDeploy(); } catch (er) { toast(er.message, 'bad'); } };
}

/* ─────────────── sortable lists ─────────────── */
function sortable(container, itemSel, onMove) {
  let from = null;
  container.addEventListener('pointerdown', (e) => { const h = e.target.closest('.handle, .it'); const it = h && h.closest(itemSel); if (it) it.draggable = true; });
  container.addEventListener('dragstart', (e) => { const it = e.target.closest(itemSel); if (!it) return; from = +it.dataset.i; it.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); });
  container.addEventListener('dragover', (e) => { const it = e.target.closest(itemSel); if (from === null || !it) return; e.preventDefault(); $$(itemSel, container).forEach((x) => x.classList.toggle('over', x === it)); });
  container.addEventListener('drop', (e) => { const it = e.target.closest(itemSel); if (from === null || !it) return; e.preventDefault(); const to = +it.dataset.i; if (to !== from) onMove(from, to); });
  container.addEventListener('dragend', () => { from = null; $$(itemSel, container).forEach((x) => { x.classList.remove('drag', 'over'); x.draggable = false; }); });
}
const move = (arr, a, b) => { const [x] = arr.splice(a, 1); arr.splice(b, 0, x); };

/* ─────────────── media picker ─────────────── */
function thumbHTML(kind, id) {
  if (!id) return '';
  return kind === 'video' ? `<img src="${POSTER(id)}" alt="" loading="lazy">` : `<img src="${THUMB(id)}" alt="" loading="lazy">`;
}
function pickMedia({ kind = 'image', multi = false, selected = [] } = {}) {
  return new Promise((resolve) => {
    let sel = [...selected], q = '', tab = kind;
    const b = openModal(`<div class="mhead"><h3>${multi ? 'Choose images' : kind === 'video' ? 'Choose a video' : 'Choose an image'}</h3>
      <input type="search" id="q" placeholder="Search…" style="max-width:220px;height:36px"></div>
      <div class="mbody"><label class="drop" id="drop"><input type="file" id="file" hidden multiple accept="${kind === 'video' ? 'video/mp4,video/quicktime,video/webm,.mkv' : 'image/jpeg,image/png,image/webp'}">
      ${ICON.upload}<div><b>Drop ${kind === 'video' ? 'videos' : 'renders'} here</b> or click to upload</div>
      <div class="muted mono" style="margin-top:4px">${kind === 'video' ? 'MP4 / MOV / MKV / WebM — converted for the web automatically' : 'JPG / PNG / WebP — resized to 2400px, metadata stripped'}</div><div class="prog" id="prog" hidden><i></i></div></label>
      <div class="lib" id="lib"></div></div>
      <div class="mfoot"><span class="muted" id="cnt" style="margin-right:auto;align-self:center"></span><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="yes">Use ${multi ? 'selected' : 'this'}</button></div>`);
    const list = () => (tab === 'video' ? MEDIA.videos : MEDIA.images).filter((m) => !q || m.id.includes(q));
    const draw = () => {
      $('#lib', b).innerHTML = list().map((m) => {
        const k = sel.indexOf(m.id);
        return `<button class="tile ${k >= 0 ? 'sel' : ''}" data-id="${esc(m.id)}"><div class="im">${thumbHTML(tab, m.id)}</div><div class="cap">${esc(m.id)}</div>
          ${k >= 0 && multi ? `<span class="k">${k + 1}</span>` : ''}${m.used && m.used.length ? `<span class="u">in use</span>` : ''}</button>`;
      }).join('') || '<p class="muted">Nothing here yet — upload something above.</p>';
      $('#cnt', b).textContent = multi ? `${sel.length} selected` : '';
    };
    draw();
    $('#q', b).addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    $('#lib', b).addEventListener('click', (e) => {
      const t = e.target.closest('.tile'); if (!t) return;
      const id = t.dataset.id;
      if (multi) { const i = sel.indexOf(id); i >= 0 ? sel.splice(i, 1) : sel.push(id); }
      else sel = [id];
      draw();
    });
    $('#lib', b).addEventListener('dblclick', (e) => { if (!multi && e.target.closest('.tile')) { closeModal(); resolve(sel); } });
    const doUpload = async (files) => {
      const pr = $('#prog', b); pr.hidden = false;
      for (const [i, f] of [...files].entries()) {
        try {
          const r = await upload(tab, f, (p) => ($('i', pr).style.width = ((i + p) / files.length) * 100 + '%'));
          if (multi) sel.push(r.id); else sel = [r.id];
          toast(`Uploaded ${f.name}`, 'ok');
        } catch (er) { toast(`${f.name}: ${er.message}`, 'bad'); }
      }
      pr.hidden = true; await refreshMedia(); draw();
    };
    $('#file', b).addEventListener('change', (e) => doUpload(e.target.files));
    const drop = $('#drop', b);
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); doUpload(e.dataTransfer.files); });
    b.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      closeModal(); resolve(a.dataset.a === 'yes' ? sel : null);
    });
  });
}

/* ─────────────── form builder ─────────────── */
// field: { k, label, t, help, max, opts, ... }  — mutates obj in place and calls onChange
function buildForm(fields, obj, onChange = () => {}) {
  const wrap = document.createElement('div');
  for (const f of fields) {
    if (f.t === 'section') { wrap.appendChild(el(`<div class="sect">${esc(f.label)}</div>`)); continue; }
    if (f.t === 'row') { const r = el(`<div class="grid${f.fields.length}"></div>`); r.appendChild(buildForm(f.fields, obj, onChange)); [...r.firstChild.children].forEach((c) => r.appendChild(c)); r.firstChild.remove(); wrap.appendChild(r); continue; }
    const box = el(`<div class="f"><label>${esc(f.label || '')}${f.max ? `<em class="cc"></em>` : ''}</label></div>`);
    const set = (v) => { obj[f.k] = v; onChange(f.k, v); };
    const counter = () => { const cc = $('.cc', box); if (cc) cc.textContent = `${String(obj[f.k] || '').length}/${f.max}`; };
    switch (f.t) {
      case 'text': case 'email': {
        const i = el(`<input type="${f.t}" ${f.max ? `maxlength="${f.max}"` : ''} placeholder="${esc(f.ph || '')}" ${f.list ? `list="dl-${f.k}"` : ''}>`);
        i.value = obj[f.k] ?? ''; i.oninput = () => { set(i.value); counter(); }; box.appendChild(i); counter();
        if (f.list) box.appendChild(el(`<datalist id="dl-${f.k}">${f.list().map((o) => `<option value="${esc(o)}">`).join('')}</datalist>`));
        break;
      }
      case 'textarea': {
        const i = el(`<textarea ${f.max ? `maxlength="${f.max}"` : ''} rows="${f.rows || 5}"></textarea>`);
        i.value = obj[f.k] ?? ''; i.oninput = () => { set(i.value); counter(); }; box.appendChild(i); counter(); break;
      }
      case 'select': {
        const i = el(`<select>${f.opts().map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>`);
        i.value = obj[f.k] ?? ''; i.onchange = () => set(i.value); box.appendChild(i); break;
      }
      case 'color': {
        const c = el(`<div class="color"><input type="color"><input type="text" maxlength="7" spellcheck="false"></div>`);
        const [pick, txt] = $$('input', c);
        const sync = (v) => { pick.value = isHex(v) ? v : '#000000'; txt.value = v || ''; };
        sync(obj[f.k]);
        pick.oninput = () => { txt.value = pick.value; set(pick.value); };
        txt.oninput = () => { if (isHex(txt.value)) { pick.value = txt.value; set(txt.value.toLowerCase()); } };
        box.appendChild(c); box._sync = sync; break;
      }
      case 'toggle': {
        box.className = ''; box.innerHTML = '';
        const t = el(`<label class="toggle"><input type="checkbox"><span>${esc(f.label)}${f.help ? `<small>${esc(f.help)}</small>` : ''}</span></label>`);
        const i = $('input', t); i.checked = f.invert ? !obj[f.k] : !!obj[f.k];
        i.onchange = () => set(f.invert ? !i.checked : i.checked);
        box.appendChild(t); break;
      }
      case 'tags': {
        const t = el(`<div class="tags"><input type="text" placeholder="${esc(f.ph || 'Type and press Enter')}" maxlength="${f.itemMax || 40}"></div>`);
        const inp = $('input', t);
        const draw = () => {
          $$('span', t).forEach((s) => s.remove());
          (obj[f.k] || []).forEach((v, i) => { const s = el(`<span>${esc(v)}<button type="button" data-i="${i}">×</button></span>`); t.insertBefore(s, inp); });
        };
        t.onclick = (e) => { const x = e.target.closest('button'); if (x) { obj[f.k].splice(+x.dataset.i, 1); set(obj[f.k]); draw(); } else inp.focus(); };
        inp.onkeydown = (e) => {
          if ((e.key === 'Enter' || e.key === ',') && inp.value.trim()) { e.preventDefault(); obj[f.k] = [...(obj[f.k] || []), inp.value.trim()].slice(0, f.maxItems || 20); inp.value = ''; set(obj[f.k]); draw(); }
          else if (e.key === 'Backspace' && !inp.value && (obj[f.k] || []).length) { obj[f.k].pop(); set(obj[f.k]); draw(); }
        };
        draw(); box.appendChild(t); if (f.help) box.appendChild(el(`<p class="help">${esc(f.help)}</p>`)); break;
      }
      case 'pairs': {
        const p = el(`<div class="pairs"></div>`);
        const draw = () => {
          p.innerHTML = '';
          (obj[f.k] || []).forEach((row, i) => {
            const r = el(`<div class="pair"><input type="text" maxlength="60" placeholder="${esc(f.ph1 || 'Label')}"><input type="text" maxlength="80" placeholder="${esc(f.ph2 || 'Value')}"><button type="button" class="icon-btn" title="Remove">${ICON.x}</button></div>`);
            const [a, b2] = $$('input', r); a.value = row.label; b2.value = row.value;
            a.oninput = () => { row.label = a.value; set(obj[f.k]); }; b2.oninput = () => { row.value = b2.value; set(obj[f.k]); };
            $('button', r).onclick = () => { obj[f.k].splice(i, 1); set(obj[f.k]); draw(); };
            p.appendChild(r);
          });
          if ((obj[f.k] || []).length < (f.maxItems || 6)) {
            const add = el(`<button type="button" class="btn xs ghost" style="align-self:flex-start">${ICON.plus} Add row</button>`);
            add.onclick = () => { obj[f.k] = [...(obj[f.k] || []), { label: '', value: '' }]; set(obj[f.k]); draw(); };
            p.appendChild(add);
          }
        };
        draw(); box.appendChild(p); break;
      }
      case 'swatches': {
        const p = el(`<div class="pairs"></div>`);
        const draw = () => {
          p.innerHTML = '';
          (obj[f.k] || []).forEach((row, i) => {
            const r = el(`<div class="pair three"><input type="color"><input type="text" maxlength="40" placeholder="Name e.g. Emerald"><button type="button" class="icon-btn">${ICON.x}</button></div>`);
            const [c, n] = $$('input', r); c.value = isHex(row.color) ? row.color : '#888888'; n.value = row.name || '';
            c.oninput = () => { row.color = c.value; set(obj[f.k]); }; n.oninput = () => { row.name = n.value; set(obj[f.k]); };
            $('button', r).onclick = () => { obj[f.k].splice(i, 1); set(obj[f.k]); draw(); };
            p.appendChild(r);
          });
          if ((obj[f.k] || []).length < 12) {
            const add = el(`<button type="button" class="btn xs ghost" style="align-self:flex-start">${ICON.plus} Add colour</button>`);
            add.onclick = () => { obj[f.k] = [...(obj[f.k] || []), { name: '', color: '#888888' }]; set(obj[f.k]); draw(); };
            p.appendChild(add);
          }
        };
        draw(); box.appendChild(p); if (f.help) box.appendChild(el(`<p class="help">${esc(f.help)}</p>`)); break;
      }
      case 'images': {
        const g = el(`<div class="imgs"></div>`);
        const draw = () => {
          const list = obj[f.k] || [];
          g.innerHTML = list.map((id, i) => `<div class="it" data-i="${i}"><img src="${THUMB(id)}" alt="" loading="lazy"><span class="n">${i === 0 ? 'Cover' : i + 1}</span><button type="button" data-x="${i}">×</button></div>`).join('') +
            `<button type="button" class="add" data-add>${ICON.plus}<br>Add / upload</button>`;
        };
        g.onclick = async (e) => {
          const x = e.target.closest('[data-x]');
          if (x) { obj[f.k].splice(+x.dataset.x, 1); set(obj[f.k]); draw(); return; }
          if (e.target.closest('[data-add]')) { const r = await pickMedia({ kind: 'image', multi: true, selected: obj[f.k] || [] }); if (r) { obj[f.k] = r.slice(0, f.maxItems || 24); set(obj[f.k]); draw(); } }
        };
        sortable(g, '.it', (a, b2) => { move(obj[f.k], a, b2); set(obj[f.k]); draw(); });
        draw(); box.appendChild(g); box.appendChild(el(`<p class="help">${esc(f.help || 'Drag to reorder. The first image is the cover.')}</p>`)); break;
      }
      case 'image': case 'video': {
        const s = el(`<div class="single"><div class="th"></div><span></span><button type="button" class="btn xs">Choose</button><button type="button" class="icon-btn" title="Clear">${ICON.x}</button></div>`);
        const draw = () => { $('.th', s).innerHTML = thumbHTML(f.t, obj[f.k]); $('span', s).textContent = obj[f.k] || (f.optional ? 'None' : 'Nothing chosen'); $('.icon-btn', s).hidden = !f.optional || !obj[f.k]; };
        $('.btn', s).onclick = async () => { const r = await pickMedia({ kind: f.t, selected: obj[f.k] ? [obj[f.k]] : [] }); if (r && r[0]) { set(r[0]); draw(); } };
        $('.icon-btn', s).onclick = () => { set(''); draw(); };
        draw(); box.appendChild(s); break;
      }
      case 'stages': {
        const p = el(`<div class="list"></div>`);
        const draw = () => {
          p.innerHTML = '';
          (obj[f.k] || []).forEach((row, i) => {
            const r = el(`<div class="row" data-i="${i}" style="grid-template-columns:22px 64px 1fr auto"><span class="handle">${ICON.drag}</span><button type="button" class="th">${thumbHTML('image', row.image)}</button>
              <input type="text" maxlength="40" placeholder="Label e.g. Wireframe"><div class="acts"><button type="button" class="icon-btn" data-x>${ICON.trash}</button></div></div>`);
            const inp = $('input', r); inp.value = row.label || '';
            inp.oninput = () => { row.label = inp.value; set(obj[f.k]); };
            $('.th', r).onclick = async () => { const res = await pickMedia({ kind: 'image', selected: [row.image] }); if (res && res[0]) { row.image = res[0]; set(obj[f.k]); draw(); } };
            $('[data-x]', r).onclick = () => { obj[f.k].splice(i, 1); set(obj[f.k]); draw(); };
            p.appendChild(r);
          });
          const add = el(`<button type="button" class="btn xs ghost" style="align-self:flex-start">${ICON.plus} Add step</button>`);
          add.onclick = async () => { const res = await pickMedia({ kind: 'image', multi: true }); if (res) { obj[f.k] = [...(obj[f.k] || []), ...res.map((id) => ({ label: '', image: id }))].slice(0, 12); set(obj[f.k]); draw(); } };
          p.appendChild(add);
        };
        sortable(p, '.row', (a, b2) => { move(obj[f.k], a, b2); set(obj[f.k]); draw(); });
        draw(); box.appendChild(p); break;
      }
      case 'range': {
        const r = el(`<div class="range"><input type="range" min="${f.min}" max="${f.max2}" step="${f.step}"><input type="number" min="${f.min}" max="${f.max2}" step="${f.step}"></div>`);
        const [sl, num] = $$('input', r);
        const get = () => (f.get ? f.get(obj) : obj[f.k]);
        const put = (v) => { v = Math.max(f.min, Math.min(f.max2, +v || 0)); if (f.put) f.put(obj, v); else obj[f.k] = v; onChange(f.k, v); };
        sl.value = num.value = (+get()).toFixed(f.dp ?? 2);
        sl.oninput = () => { num.value = sl.value; put(sl.value); };
        num.onchange = () => { sl.value = num.value; put(num.value); };
        box.appendChild(r); break;
      }
      case 'checks': {
        const opts = f.opts();
        const c = el(`<div class="chips">${opts.length ? opts.map((o) => `<label><input type="checkbox" value="${esc(o)}">${esc(o)}</label>`).join('') : '<span class="muted">Nothing found in this model.</span>'}</div>`);
        $$('input', c).forEach((i) => { i.checked = (obj[f.k] || []).includes(i.value); i.onchange = () => { obj[f.k] = $$('input', c).filter((x) => x.checked).map((x) => x.value); set(obj[f.k]); }; });
        box.appendChild(c); if (f.help) box.appendChild(el(`<p class="help">${esc(f.help)}</p>`)); break;
      }
      case 'custom': box.appendChild(f.render(obj, set)); break;
    }
    if (f.help && !['tags', 'swatches', 'images', 'checks', 'toggle'].includes(f.t)) box.appendChild(el(`<p class="help">${esc(f.help)}</p>`));
    box.dataset.k = f.k || '';
    wrap.appendChild(box);
  }
  return wrap;
}

function slugId(s, taken, max = 40, sep = '-') {
  let base = String(s || 'item').toLowerCase().replace(/[^a-z0-9]+/g, sep).replace(new RegExp(`^${sep}+|${sep}+$`, 'g'), '').slice(0, max - 4) || 'item';
  if (!/^[a-z0-9]/.test(base)) base = 'x' + base;
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}${sep}${n++}`;
  return id;
}

/* ─────────────── generic list page ─────────────── */
function editDrawer({ title, item, fields, onSave, onDelete, extra }) {
  const draft = clone(item);
  openDrawer((p) => {
    p.innerHTML = `<div class="dhead"><h2>${esc(title)}</h2><button class="icon-btn" data-a="x">${ICON.x}</button></div><div class="dbody"></div>
      <div class="dfoot">${onDelete ? `<button class="btn danger" data-a="del" style="margin-right:auto">${ICON.trash} Delete</button>` : ''}<button class="btn ghost" data-a="x">Cancel</button><button class="btn primary" data-a="ok">Done</button></div>`;
    const body = $('.dbody', p);
    if (extra) body.appendChild(extra(draft));
    body.appendChild(buildForm(fields, draft));
    p.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'x') closeDrawer();
      if (a.dataset.a === 'ok') { if (onSave(draft) === false) return; closeDrawer(); touch(); }
      if (a.dataset.a === 'del' && (await confirmBox('Delete this item?', 'It will be removed from your site when you publish. Images stay in the media library.', 'Delete', true))) { onDelete(); closeDrawer(); touch(); }
    });
  });
}

function listPage(v, cfg) {
  const { get, newItem, fields, thumb, label, sub, titleFor, intro, kind = 'image', after } = cfg;
  let q = '';
  if (intro) v.appendChild(el(`<p class="muted" style="margin:-6px 0 18px;max-width:760px">${esc(intro)}</p>`));
  if (cfg.top) v.appendChild(cfg.top());
  const bar = el(`<div class="toolbar"><input type="search" class="search" placeholder="Search…"><span class="spacer"></span>
    ${cfg.bulk ? `<button class="btn" data-bulk>${ICON.upload} Add from images</button>` : ''}<button class="btn primary" data-new>${ICON.plus} ${esc(cfg.newLabel || 'Add new')}</button></div>`);
  const list = el(`<div class="list"></div>`);
  v.append(bar, list);
  const draw = () => {
    const arr = get();
    list.innerHTML = arr.map((it, i) => {
      if (q && !JSON.stringify(it).toLowerCase().includes(q)) return '';
      return `<div class="row ${it.hidden ? 'is-hidden' : ''}" data-i="${i}"><span class="handle" title="Drag to reorder">${ICON.drag}</span>
        <div class="th">${thumbHTML(kind, thumb(it))}</div>
        <div class="t"><b>${esc(label(it) || 'Untitled')}${it.hidden ? '<span class="badge">Hidden</span>' : ''}${cfg.badge ? cfg.badge(it) : ''}</b><span>${esc(sub ? sub(it) : '')}</span></div>
        <div class="acts"><button class="icon-btn" data-a="vis" title="${it.hidden ? 'Show on site' : 'Hide from site'}">${it.hidden ? ICON.eyeoff : ICON.eye}</button>
        <button class="icon-btn" data-a="dup" title="Duplicate">${ICON.copy}</button><button class="icon-btn" data-a="edit" title="Edit">${ICON.edit}</button></div></div>`;
    }).join('') || `<div class="empty">Nothing here yet. Click “${esc(cfg.newLabel || 'Add new')}” to create one.</div>`;
  };
  const edit = (i, isNew = false) => {
    const arr = get(); const item = isNew ? newItem() : arr[i];
    editDrawer({
      title: isNew ? (cfg.newLabel || 'New item') : (titleFor ? titleFor(item) : label(item) || 'Edit'), item, fields: typeof fields === 'function' ? fields() : fields,
      onSave: (d) => {
        const problem = cfg.check && cfg.check(d);
        if (problem) { toast(problem, 'bad'); return false; }
        if (cfg.beforeSave) cfg.beforeSave(d, isNew); if (isNew) arr.unshift(d); else arr[i] = d; draw();
      },
      onDelete: isNew ? null : () => { arr.splice(i, 1); draw(); },
    });
  };
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.row'); if (!row) return;
    const i = +row.dataset.i, arr = get(), a = e.target.closest('[data-a]');
    if (a && a.dataset.a === 'vis') { arr[i].hidden = !arr[i].hidden; draw(); touch(); return; }
    if (a && a.dataset.a === 'dup') { const c = clone(arr[i]); if (cfg.beforeSave) cfg.beforeSave(c, true); arr.splice(i + 1, 0, c); draw(); touch(); return; }
    if (e.target.closest('.handle')) return;
    edit(i);
  });
  bar.querySelector('[data-new]').onclick = () => edit(-1, true);
  if (cfg.bulk) bar.querySelector('[data-bulk]').onclick = async () => {
    const r = await pickMedia({ kind, multi: true }); if (!r || !r.length) return;
    get().unshift(...r.map((id) => cfg.bulk(id))); draw(); touch(); toast(`Added ${r.length} item(s) — edit titles anytime`);
  };
  bar.querySelector('input').oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  sortable(list, '.row', (a, b) => { move(get(), a, b); draw(); touch(); });
  draw();
  if (after) v.appendChild(after());
}

/* ─────────────── colour helpers ─────────────── */
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const mix = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t)); return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join(''); };
function matchColours(imageId) {
  const m = mediaMeta(imageId);
  if (!m.avg) return null;
  const dark = lum(m.avg) < 0.5;
  const bg = dark ? mix(m.dom || m.avg, '#000000', 0.35) : mix(m.avg, '#ffffff', 0.25);
  let accent = m.accent || m.avg;
  if (Math.abs(lum(accent) - lum(bg)) < 0.25) accent = dark ? mix(accent, '#ffffff', 0.45) : mix(accent, '#000000', 0.45);
  const ink = dark ? mix(accent, '#ffffff', 0.7) : mix(accent, '#000000', 0.75);
  return { bg, ink, accent, dark };
}
function colourHelper(obj, imgKey, keys = ['bg', 'ink', 'accent']) {
  const box = el(`<div class="panel" style="padding:14px;margin-bottom:16px;display:flex;gap:14px;align-items:center">
    <div class="sw" style="width:120px;height:64px;border-radius:10px;display:grid;place-items:center;font-family:var(--display);font-size:26px;flex:none">Aa</div>
    <div style="flex:1"><b style="font-size:13.5px">Colour match</b><p class="muted" style="margin:2px 0 0;font-size:12.5px">The page background, text and accent shift to these colours when visitors scroll to this item.</p></div>
    <button type="button" class="btn sm">Match from cover</button></div>`);
  const sw = $('.sw', box);
  const paint = () => { sw.style.background = obj[keys[0]]; sw.style.color = obj[keys[1]]; sw.style.boxShadow = `inset 0 -6px 0 ${obj[keys[2]] || obj[keys[1]]}`; };
  paint();
  $('button', box).onclick = () => {
    const id = Array.isArray(obj[imgKey]) ? obj[imgKey][0] : obj[imgKey];
    const c = id && matchColours(id);
    if (!c) return toast('Add a cover image first', 'bad');
    obj[keys[0]] = c.bg; obj[keys[1]] = c.ink; if (keys[2]) obj[keys[2]] = c.accent;
    paint();
    const form = box.closest('.dbody') || document;
    keys.forEach((k) => { const f = form && form.querySelector(`.f[data-k="${k}"]`); if (f && f._sync) f._sync(obj[k]); });
    toast('Colours matched to the cover image');
  };
  box._paint = paint;
  return box;
}

/* ─────────────── views ─────────────── */
const modelOpts = (none = true) => () => [...(none ? [['', '— No 3D model —']] : []), ...Object.entries(C.models).map(([k, m]) => [k, m.title])];

/* ─────────────── page layout (sections) ─────────────── */
const VIEWS_EXTRA = {};
const SEC_HEAD = [
  { t: 'row', fields: [{ k: 'label', label: 'Name in the site menu', t: 'text', max: 30 }, { k: 'eyebrow', label: 'Small label above the heading', t: 'text', max: 60, ph: 'e.g. Character design' }] },
  { t: 'row', fields: [{ k: 'title', label: 'Big heading (line 1)', t: 'text', max: 40, ph: 'Leave empty to keep the current one' }, { k: 'title2', label: 'Outlined line 2', t: 'text', max: 40 }] },
  { k: 'copy', label: 'Paragraph next to the heading', t: 'textarea', max: 600, rows: 3 },
  { k: 'nav', label: 'Show in the site’s top menu', t: 'toggle' },
  { k: 'hidden', label: 'Show this section on the live site', t: 'toggle', invert: true },
];
const SEC_CUSTOM = [
  { t: 'row', fields: [{ k: 'style', label: 'Layout', t: 'select', opts: () => [['grid', 'Grid — mixed sizes (like ArchViz)'], ['scroll', 'Sideways row of tall cards']] },
    { k: 'theme', label: 'Text style', t: 'select', opts: () => [['dark', 'Light text on dark'], ['light', 'Dark text on light']] }] },
  { t: 'row', fields: [{ k: 'bg', label: 'Background colour', t: 'color' }, { k: 'ink', label: 'Text colour', t: 'color' }] },
];
const RESERVED = ['hero', 'statement', 'contact', 'top'];
function sectionDrawer(sec, isNew, after) {
  editDrawer({
    title: isNew ? 'New section' : 'Section · ' + secName(sec), item: sec,
    fields: sec.custom ? [...SEC_HEAD, ...SEC_CUSTOM] : SEC_HEAD,
    onSave: (d) => {
      if (d.custom && !d.label && !d.title) { toast('Give the section a name', 'bad'); return false; }
      Object.keys(d).forEach((k) => { if (d[k] === '' && k !== 'id') delete d[k]; });
      if (!d.hidden) delete d.hidden;
      if (isNew) {
        const base = (d.label || d.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'section';
        let id = base, n = 2;
        while (C.sections.some((x) => x.id === id) || BUILTIN[id] || RESERVED.includes(id)) id = `${base}-${n++}`;
        d.id = id; C.sections.push(d);
      } else { Object.keys(sec).forEach((k) => delete sec[k]); Object.assign(sec, d); }
      renderNav(); after && after(isNew ? d : sec);
    },
    onDelete: sec.custom && !isNew ? () => { C.sections.splice(C.sections.indexOf(sec), 1); renderNav(); go('sections'); } : null,
  });
}
VIEWS_EXTRA.sections = (v) => {
  v.appendChild(el(`<p class="muted" style="margin:-6px 0 18px;max-width:780px">The order of the sections on your live site. Drag to move them. Add your own sections (e.g. Characters, Vehicles) and drop them anywhere — the site and this sidebar follow the same order.</p>`));
  const bar = el(`<div class="toolbar"><span class="spacer"></span><button class="btn primary" data-new>${ICON.plus} Add section</button></div>`);
  const list = el(`<div class="list"></div>`);
  v.append(bar, list, el(`<p class="muted" style="margin-top:14px;font-size:12.5px">The 3D showroom and statement at the top, and the contact block at the bottom, stay in place.</p>`));
  const draw = () => {
    list.innerHTML = C.sections.map((s, i) => `<div class="row ${s.hidden ? 'is-hidden' : ''}" data-i="${i}"><span class="handle" title="Drag to reorder">${ICON.drag}</span>
      <div class="th sicon" style="display:grid;place-items:center;color:var(--mut)">${ICON[s.custom ? 'image' : BUILTIN[s.id]?.icon || 'grid']}</div>
      <div class="t"><b>${esc(secName(s))}${s.hidden ? '<span class="badge">Hidden</span>' : ''}${s.custom ? '<span class="badge">Custom</span>' : ''}</b>
      <span>${esc(s.custom ? `${(s.items || []).length} image(s) · ${s.style === 'scroll' ? 'sideways row' : 'grid'}` : 'Built-in section')}${s.nav === false ? ' · not in menu' : ''}</span></div>
      <div class="acts"><button class="icon-btn" data-a="vis" title="${s.hidden ? 'Show on site' : 'Hide from site'}">${s.hidden ? ICON.eyeoff : ICON.eye}</button>
      <button class="icon-btn" data-a="open" title="Edit content">${ICON.folder}</button><button class="icon-btn" data-a="edit" title="Heading & settings">${ICON.edit}</button></div></div>`).join('');
  };
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.row'); if (!row || e.target.closest('.handle')) return;
    const s = C.sections[+row.dataset.i], a = e.target.closest('[data-a]');
    if (a && a.dataset.a === 'vis') { s.hidden = !s.hidden; if (!s.hidden) delete s.hidden; draw(); renderNav(); touch(); return; }
    if (a && a.dataset.a === 'open') return go(s.custom ? 'sec:' + s.id : BUILTIN[s.id].page);
    sectionDrawer(s, false, draw);
  });
  $('[data-new]', bar).onclick = () => sectionDrawer({ custom: true, label: '', title: '', title2: '', eyebrow: '', copy: '', style: 'grid', theme: 'dark', bg: '#121212', ink: '#f2ede4', nav: true, items: [] }, true, (d) => { draw(); toast('Section added at the end — drag it where you want it', 'ok'); });
  sortable(list, '.row', (a, b) => { move(C.sections, a, b); draw(); renderNav(); touch(); });
  draw();
};

function customSectionPage(v, id) {
  const sec = C.sections.find((s) => s.id === id); if (!sec) return go('sections');
  sec.items = sec.items || [];
  const head = el(`<div class="panel" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><h3 style="margin:0">${esc(secName(sec))}</h3>
    <p style="margin:4px 0 0">${esc([sec.title, sec.title2].filter(Boolean).join(' ') || 'No heading yet')} · ${sec.style === 'scroll' ? 'Sideways row' : 'Grid'}${sec.hidden ? ' · hidden on the site' : ''}</p></div>
    <button class="btn" data-a="set">${ICON.edit} Heading, colours & layout</button><button class="btn ghost" data-a="order">${ICON.drag} Move section</button></div>`);
  $('[data-a=set]', head).onclick = () => sectionDrawer(sec, false, () => go('sec:' + sec.id));
  $('[data-a=order]', head).onclick = () => go('sections');
  v.appendChild(head);
  listPage(v, {
    get: () => sec.items, newLabel: 'New image', newItem: () => ({ id: '', title: '', note: '', model: '', hidden: false }),
    bulk: (iid) => ({ id: iid, title: iid.replace(/[-_][0-9a-f]{6}$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), note: '', hidden: false }),
    check: (d) => (!d.id ? 'Pick an image first' : ''),
    beforeSave: (d) => { if (!d.model) delete d.model; if (d.gallery && !d.gallery.length) delete d.gallery; },
    thumb: (e) => e.id, label: (e) => e.title, sub: (e) => [e.note, e.model && C.models[e.model] ? '3D: ' + C.models[e.model].title : '', (e.gallery || []).length ? `+${e.gallery.length} renders` : ''].filter(Boolean).join(' · '),
    fields: () => [{ k: 'id', label: 'Image', t: 'image' }, { t: 'row', fields: [{ k: 'title', label: 'Title', t: 'text', max: 80 }, { k: 'note', label: 'Caption', t: 'text', max: 200 }] },
      { k: 'model', label: '3D model (optional — clicking the card opens it in 3D)', t: 'select', opts: modelOpts() },
      { k: 'gallery', label: 'More renders — shown under the 3D model when you scroll down', t: 'images', maxItems: 40, help: 'Drag to reorder. These appear in the gallery below the 3D view (and in the full-screen viewer).' },
      { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true }],
  });
}

const SOCIAL_PRESETS = [['Instagram', 'https://instagram.com/'], ['ArtStation', 'https://www.artstation.com/'], ['GitHub', 'https://github.com/'], ['Behance', 'https://www.behance.net/'], ['LinkedIn', 'https://www.linkedin.com/in/'], ['X', 'https://x.com/'], ['YouTube', 'https://www.youtube.com/@'], ['Sketchfab', 'https://sketchfab.com/']];
function socialsPanel() {
  const p = el(`<div class="panel"><h3>Social links</h3><p>Shown as buttons in the About section. Full links starting with https://. Drag to reorder.</p><div class="list" id="soc"></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px" id="socAdd"></div></div>`);
  const list = $('#soc', p), S = C.artist.socials;
  const draw = () => {
    list.innerHTML = S.map((x, i) => `<div class="row soc ${x.hidden ? 'is-hidden' : ''}" data-i="${i}"><span class="handle" title="Drag to reorder">${ICON.drag}</span>
      <input type="text" maxlength="30" value="${esc(x.label)}" data-f="label" placeholder="Name">
      <input type="url" maxlength="300" value="${esc(x.url)}" data-f="url" placeholder="https://…">
      <div class="acts"><button class="icon-btn" data-a="vis" title="${x.hidden ? 'Show' : 'Hide'}">${x.hidden ? ICON.eyeoff : ICON.eye}</button><button class="icon-btn" data-a="del" title="Remove">${ICON.trash}</button></div></div>`).join('')
      || '<div class="empty">No social links yet — add one below.</div>';
  };
  list.addEventListener('input', (e) => {
    const f = e.target.dataset.f; if (!f) return;
    const x = S[+e.target.closest('.row').dataset.i]; x[f] = e.target.value.trim();
    e.target.classList.toggle('bad', f === 'url' && !!x.url && !/^(https:\/\/|mailto:)\S+$/.test(x.url)); touch();
  });
  list.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return; const i = +a.closest('.row').dataset.i;
    if (a.dataset.a === 'del') S.splice(i, 1); else { S[i].hidden = !S[i].hidden; if (!S[i].hidden) delete S[i].hidden; }
    draw(); touch();
  });
  $('#socAdd', p).innerHTML = SOCIAL_PRESETS.map(([n]) => `<button class="btn xs ghost" data-n="${esc(n)}">${ICON.plus} ${esc(n)}</button>`).join('') + `<button class="btn xs ghost" data-n="">${ICON.plus} Other link</button>`;
  $('#socAdd', p).onclick = (e) => {
    const b = e.target.closest('[data-n]'); if (!b) return;
    if (S.length >= 12) return toast('Up to 12 links', 'bad');
    const pr = SOCIAL_PRESETS.find(([n]) => n === b.dataset.n);
    S.push({ label: pr ? pr[0] : 'Website', url: pr ? pr[1] : 'https://' }); draw(); touch();
    const inp = $$('input[data-f=url]', list).pop(); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  };
  sortable(list, '.row', (a, b) => { move(S, a, b); draw(); touch(); });
  draw();
  return p;
}

/* ─────────────── start page & engineering portfolio ─────────────── */
const SITE_URL = WEB ? '/' : 'http://localhost:8080/';
const openSite = (path, label) => `<a class="btn sm" href="${SITE_URL}${path}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
const devSlug = (t) => (t || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project';

VIEWS_EXTRA.landing = (v) => {
  const L = C.landing;
  v.appendChild(el(`<p class="muted" style="margin:-6px 0 18px;max-width:780px">The first thing visitors see: your two portfolios split by a glowing seam. The left side shows your 3D models (with their colours); the right side is the engineering side with a live terminal.</p>`));
  const top = el(`<div class="panel" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b style="flex:1">Preview</b>${openSite('', 'Start page')}${openSite('dev.html', 'Engineering portfolio')}${openSite('3d.html', '3D portfolio')}</div>`);
  const p1 = el(`<div class="panel"><h3>Left · 3D side</h3><p>Shown over the rotating 3D model.</p></div>`);
  p1.appendChild(buildForm([
    { k: 'model', label: '3D model on the start page', t: 'select', opts: () => [['', 'Cycle through the showroom models'], ...Object.entries(C.models).filter(([, m]) => !m.hidden).map(([k, m]) => [k, m.title])] },
    { t: 'row', fields: [{ k: 'leftKicker', label: 'Small label', t: 'text', max: 40, ph: 'Creative side' }, { k: 'leftTitle', label: 'Big title', t: 'text', max: 30, ph: '3D ARTIST' }] },
    { k: 'leftSub', label: 'One-line description', t: 'text', max: 140 },
    { k: 'leftCta', label: 'Button text', t: 'text', max: 30, ph: 'Enter the studio' },
  ], L, touch));
  const p2 = el(`<div class="panel"><h3>Right · engineering side</h3><p>The terminal on this side types your name, projects, stack and status automatically.</p></div>`);
  p2.appendChild(buildForm([
    { t: 'row', fields: [{ k: 'rightKicker', label: 'Small label', t: 'text', max: 40, ph: 'Technical side' }, { k: 'rightTitle', label: 'Big title', t: 'text', max: 30, ph: 'ENGINEER' }] },
    { k: 'rightSub', label: 'One-line description', t: 'text', max: 140 },
    { k: 'rightCta', label: 'Button text', t: 'text', max: 30, ph: 'Open the terminal' },
  ], L, touch));
  v.append(top, p1, p2);
};

VIEWS_EXTRA.devprofile = (v) => {
  const D = C.dev;
  v.appendChild(el(`<p class="muted" style="margin:-6px 0 18px;max-width:780px">Your engineering portfolio (fuzailahmed.com/dev.html). Sections without content stay hidden, so the page only shows what you've filled in.</p>`));
  const p1 = el(`<div class="panel"><h3>Intro</h3></div>`);
  p1.appendChild(buildForm([
    { t: 'row', fields: [{ k: 'role', label: 'Role / title', t: 'text', max: 60, ph: 'Computer Science Engineer' }, { k: 'location', label: 'Location', t: 'text', max: 60, ph: 'e.g. Lahore, Pakistan' }] },
    { k: 'headline', label: 'Headline', t: 'text', max: 120, help: 'Wrap a word in *stars* to set it in italic serif, e.g. I build *fast* software.' },
    { k: 'intro', label: 'About you', t: 'textarea', max: 1500, rows: 5 },
    { k: 'status', label: 'Status pill', t: 'text', max: 80, ph: 'Open to opportunities' },
  ], D, touch));
  const p2 = el(`<div class="panel"><h3>Links</h3><p>Your email and social links come from About &amp; contact.</p></div>`);
  p2.appendChild(buildForm([
    { t: 'row', fields: [{ k: 'github', label: 'GitHub username', t: 'text', max: 39, ph: 'e.g. fuzailahmed' }, { k: 'resume', label: 'CV / résumé link (https://…)', t: 'text', max: 300, ph: 'https://drive.google.com/…' }] },
    { k: 'githubRepos', label: 'Show my public GitHub repositories automatically', t: 'toggle', help: 'Top 6 by stars, loaded live from GitHub (forks hidden).' },
  ], D, touch));
  const p3 = el(`<div class="panel"><h3>Numbers &amp; terminal</h3></div>`);
  p3.appendChild(buildForm([
    { k: 'stats', label: 'Big numbers (up to 4)', t: 'pairs', maxItems: 4, ph1: 'Label e.g. projects shipped', ph2: 'Value e.g. 12' },
    { k: 'terminal', label: 'Extra lines for the start-page terminal', t: 'tags', maxItems: 12, itemMax: 120, ph: 'Start with "$ " for a command, e.g. $ cat goals.txt', help: 'Optional — the terminal already types your name, projects, stack and status.' },
  ], D, touch));
  v.append(p1, p2, p3);
};

VIEWS_EXTRA.devprojects = (v) => {
  listPage(v, {
    intro: 'Software projects on your engineering portfolio. Mark one as featured to show it extra large at the top.',
    get: () => C.dev.projects, newLabel: 'New project',
    newItem: () => ({ id: '', title: '', year: String(new Date().getFullYear()), summary: '', body: '', stack: [], repo: '', live: '', image: '', featured: false, hidden: false }),
    check: (d) => (!d.title ? 'Give it a title' : [d.repo, d.live].some((u) => u && !/^https:\/\//.test(u)) ? 'Links must start with https://' : ''),
    beforeSave: (d, isNew) => {
      if (isNew || !d.id) { let id = devSlug(d.title), n = 2; while (C.dev.projects.some((x) => x !== d && x.id === id)) id = `${devSlug(d.title)}-${n++}`; d.id = id; }
      ['repo', 'live', 'image', 'body', 'summary', 'year'].forEach((k) => { if (!d[k]) delete d[k]; });
    },
    thumb: (p) => p.image || '', label: (p) => p.title, sub: (p) => [p.year, (p.stack || []).join(', ')].filter(Boolean).join(' · '),
    badge: (p) => (p.featured ? '<span class="badge">Featured</span>' : ''),
    fields: [
      { t: 'row', fields: [{ k: 'title', label: 'Title', t: 'text', max: 80 }, { k: 'year', label: 'Year', t: 'text', max: 12 }] },
      { k: 'summary', label: 'One-line summary', t: 'text', max: 400 },
      { k: 'body', label: 'Details (shown when someone opens the project)', t: 'textarea', max: 2000, rows: 5 },
      { k: 'stack', label: 'Tech used', t: 'tags', maxItems: 20, ph: 'e.g. React — press Enter' },
      { t: 'row', fields: [{ k: 'repo', label: 'Code link (https://github.com/…)', t: 'text', max: 300 }, { k: 'live', label: 'Live demo link', t: 'text', max: 300 }] },
      { k: 'image', label: 'Screenshot (optional — a code-style cover is drawn if empty)', t: 'image', optional: true },
      { k: 'featured', label: 'Featured (shown large)', t: 'toggle' },
      { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true },
    ],
  });
};

VIEWS_EXTRA.devskills = (v) => {
  const D = C.dev;
  const p = el(`<div class="panel"><h3>Skills</h3><p>Groups of skills, e.g. Languages · Frameworks · Tools.</p><div id="sk"></div></div>`);
  const draw = () => {
    const box = $('#sk', p); box.innerHTML = '';
    D.skills.forEach((g, i) => {
      const r = el(`<div style="display:grid;grid-template-columns:200px 1fr 34px;gap:10px;align-items:start;margin-bottom:10px"></div>`);
      const f = buildForm([{ k: 'title', t: 'text', max: 60 }, { k: 'items', t: 'tags', maxItems: 20 }], g, touch);
      [...f.children].forEach((c) => { c.style.marginBottom = '0'; $('label', c)?.remove(); r.appendChild(c); });
      const x = el(`<button class="icon-btn" title="Remove group">${ICON.trash}</button>`); x.onclick = () => { D.skills.splice(i, 1); touch(); draw(); }; r.appendChild(x);
      box.appendChild(r);
    });
    if (D.skills.length < 10) { const a = el(`<button class="btn xs ghost">${ICON.plus} Add group</button>`); a.onclick = () => { D.skills.push({ title: D.skills.length ? 'New group' : 'Languages', items: [] }); touch(); draw(); }; box.appendChild(a); }
  };
  v.appendChild(p); draw();
  v.appendChild(el(`<h3 style="margin:28px 0 12px">Journey — education &amp; experience</h3>`));
  const KIND = { work: 'Work', edu: 'Education', award: 'Award' };
  listPage(v, {
    get: () => D.timeline, newLabel: 'New entry',
    newItem: () => ({ kind: 'edu', when: '', title: '', org: '', note: '', hidden: false }),
    check: (d) => (!d.title ? 'Give it a title' : ''),
    thumb: () => '', label: (t) => t.title, sub: (t) => [KIND[t.kind], t.when, t.org].filter(Boolean).join(' · '),
    fields: [
      { t: 'row', fields: [{ k: 'kind', label: 'Type', t: 'select', opts: () => Object.entries(KIND) }, { k: 'when', label: 'When', t: 'text', max: 40, ph: '2021 — 2025' }] },
      { t: 'row', fields: [{ k: 'title', label: 'Title', t: 'text', max: 100, ph: 'BS Computer Science / Software Intern' }, { k: 'org', label: 'University / company', t: 'text', max: 100 }] },
      { k: 'note', label: 'Note', t: 'textarea', max: 400, rows: 3 },
      { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true },
    ],
  });
};

VIEWS_EXTRA.aboutme = (v) => {
  const AB = C.about;
  v.appendChild(el(`<p class="muted" style="margin:-6px 0 18px;max-width:780px">Your About page (opens when visitors click your photo in the middle of the start page). Engineering experience, education and skills come from <b>Skills &amp; journey</b>; engineering projects from <b>Code projects</b>.</p>`));
  v.appendChild(el(`<div class="panel" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><b style="flex:1">Preview</b>${openSite('about.html', 'About page')}${openSite('', 'Start page')}</div>`));
  const p1 = el(`<div class="panel"><h3>Photo &amp; intro</h3><p>Use a clear, roughly square headshot — it's shown in a circle.</p></div>`);
  p1.appendChild(buildForm([
    { k: 'photo', label: 'Profile photo', t: 'image', optional: true },
    { k: 'title', label: 'Title under your name', t: 'text', max: 120 },
    { k: 'summary', label: 'Summary (leave an empty line between paragraphs)', t: 'textarea', max: 3000, rows: 9 },
    { k: 'cv', label: 'CV download link (https://…) — adds a “Download CV” button', t: 'text', max: 300, ph: 'https://drive.google.com/…' },
    { k: 'facts', label: 'Quick facts under the photo', t: 'pairs', maxItems: 8, ph1: 'Label e.g. Based in', ph2: 'Value e.g. Islamabad' },
  ], AB, touch));
  v.appendChild(p1);
  v.appendChild(el(`<h3 style="margin:28px 0 12px">3D &amp; CGI experience</h3>`));
  listPage(v, {
    get: () => AB.creative, newLabel: 'New role', newItem: () => ({ when: '', title: '', org: '', note: '', hidden: false }),
    check: (d) => (!d.title ? 'Give it a title' : ''), thumb: () => '', label: (t) => t.title, sub: (t) => [t.when, t.org].filter(Boolean).join(' · '),
    fields: [{ t: 'row', fields: [{ k: 'title', label: 'Role', t: 'text', max: 100 }, { k: 'when', label: 'When', t: 'text', max: 40, ph: 'Jan 2024 — Present' }] },
      { k: 'org', label: 'Company / client', t: 'text', max: 100 }, { k: 'note', label: 'What you did', t: 'textarea', max: 400, rows: 3 }, { k: 'hidden', label: 'Show on the About page', t: 'toggle', invert: true }],
  });
  v.appendChild(el(`<h3 style="margin:28px 0 12px">3D &amp; CGI projects</h3>`));
  listPage(v, {
    get: () => AB.projects3d, newLabel: 'New 3D project', newItem: () => ({ title: '', when: '', role: '', note: '', image: '', hidden: false }),
    check: (d) => (!d.title ? 'Give it a title' : ''), beforeSave: (d) => { if (!d.image) delete d.image; },
    thumb: (p) => p.image || '', label: (p) => p.title, sub: (p) => [p.when, p.role].filter(Boolean).join(' · '),
    fields: [{ t: 'row', fields: [{ k: 'title', label: 'Title', t: 'text', max: 100 }, { k: 'when', label: 'When', t: 'text', max: 40 }] },
      { k: 'role', label: 'Your role', t: 'text', max: 100 }, { k: 'note', label: 'Description', t: 'textarea', max: 400, rows: 3 },
      { k: 'image', label: 'Thumbnail (optional)', t: 'image', optional: true }, { k: 'hidden', label: 'Show on the About page', t: 'toggle', invert: true }],
  });
  const p3 = el(`<div class="panel" style="margin-top:28px"><h3>3D &amp; CGI skills</h3><div id="sk3"></div></div>`);
  const draw = () => {
    const box = $('#sk3', p3); box.innerHTML = '';
    AB.skills3d.forEach((g, i) => {
      const r = el(`<div style="display:grid;grid-template-columns:200px 1fr 34px;gap:10px;align-items:start;margin-bottom:10px"></div>`);
      const f = buildForm([{ k: 'title', t: 'text', max: 60 }, { k: 'items', t: 'tags', maxItems: 20 }], g, touch);
      [...f.children].forEach((c) => { c.style.marginBottom = '0'; $('label', c)?.remove(); r.appendChild(c); });
      const x = el(`<button class="icon-btn" title="Remove group">${ICON.trash}</button>`); x.onclick = () => { AB.skills3d.splice(i, 1); touch(); draw(); }; r.appendChild(x);
      box.appendChild(r);
    });
    if (AB.skills3d.length < 8) { const a = el(`<button class="btn xs ghost">${ICON.plus} Add group</button>`); a.onclick = () => { AB.skills3d.push({ title: 'New group', items: [] }); touch(); draw(); }; box.appendChild(a); }
  };
  v.appendChild(p3); draw();
};

const VIEWS = {
  ...VIEWS_EXTRA,
  async overview(v) {
    const st = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
    v.innerHTML = `<div class="stats">${st(C.featured.filter((x) => !x.hidden).length, 'Live projects')}${st(Object.keys(C.models).length, '3D models')}${st(MEDIA.images.length, 'Images')}${st(MEDIA.videos.length, 'Videos')}</div>
      <div class="quick">
        <button data-q="project"><span class="ico">${ICON.folder}</span><b>New project</b><span>Case study with renders, specs & a 3D model</span></button>
        <button data-q="model"><span class="ico">${ICON.cube}</span><b>Upload 3D model</b><span>Drop a .glb exported from Blender</span></button>
        <button data-q="media"><span class="ico">${ICON.upload}</span><b>Upload renders</b><span>Images & videos go to the media library</span></button>
      </div>
      <div class="panel"><h3>GitHub</h3><div id="deployBox"><p class="muted">Loading…</p></div></div>
      <div class="two"><div class="panel"><h3>Recent activity</h3><p>Sign-ins, uploads and publishes.</p><table id="act"><tbody><tr><td>Loading…</td></tr></tbody></table></div>
      <div class="panel"><h3>How editing works</h3><p>Everything you change stays a draft until you hit <b>Publish</b>. Every publish keeps a snapshot in History and is pushed to GitHub.</p>
      <ol class="muted" style="margin:0;padding-left:18px;line-height:1.9"><li>Upload renders or a .glb</li><li>Add or edit items in any section</li><li>Drag rows to reorder, use the eye to hide</li><li>Publish, then refresh your site</li></ol></div></div>`;
    v.querySelector('.quick').onclick = (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      if (b.dataset.q === 'project') { go('featured'); setTimeout(() => $('[data-new]').click(), 50); }
      if (b.dataset.q === 'model') { go('models'); setTimeout(() => $('#uploadModel').click(), 50); }
      if (b.dataset.q === 'media') go('media');
    };
    api('GET', '/api/deploy').then(paintDeploy).catch(() => {});
    try {
      const a = await api('GET', '/api/audit');
      $('#act tbody', v).innerHTML = a.slice(0, 8).map((x) => `<tr><td><b>${esc(x.event.replace(/_/g, ' '))}</b>${x.note ? ` — ${esc(x.note)}` : ''}${x.id ? ` — ${esc(x.id)}` : ''}</td><td style="text-align:right">${esc(new Date(x.t).toLocaleString())}</td></tr>`).join('') || '<tr><td>No activity yet</td></tr>';
    } catch {}
  },

  featured(v) {
    listPage(v, {
      intro: 'The big colour-matched case studies under “Selected work”. Each one gets its own background colour, gallery and optional 3D model.',
      get: () => C.featured, newLabel: 'New product',
      newItem: () => ({ id: '', cat: 'Product Visuals', title: '', model: '', bg: '#141414', ink: '#f2ede4', accent: '#ff5a1f', text: '', tools: ['Blender'], specs: [], images: [], video: '', hidden: false }),
      beforeSave: (d, isNew) => { if (isNew || !d.id) d.id = slugId(d.title || 'project', new Set(C.featured.map((p) => p.id))); },
      check: (d) => (!d.title.trim() ? 'Give the project a title' : ''),
      thumb: (p) => p.images[0], label: (p) => p.title, sub: (p) => `${p.cat}${p.model ? ' · 3D: ' + (C.models[p.model]?.title || p.model) : ''} · ${p.images.length} image(s)`,
      badge: (p) => (!p.images.length ? '<span class="badge warn">No images</span>' : ''),
      fields: () => [
        { t: 'section', label: 'Story' },
        { k: 'title', label: 'Product title', t: 'text', max: 80, ph: 'e.g. J. Janan Oud' },
        { t: 'row', fields: [{ k: 'cat', label: 'Category', t: 'text', max: 60, list: () => [...new Set(C.featured.map((p) => p.cat))] }, { k: 'model', label: '3D model (optional)', t: 'select', opts: modelOpts() }] },
        { k: 'text', label: 'Description', t: 'textarea', max: 2000, rows: 6 },
        { k: 'tools', label: 'Software used', t: 'tags', ph: 'Blender, Substance Painter…' },
        { k: 'specs', label: 'Big numbers (up to 3 look best)', t: 'pairs', maxItems: 6, ph1: 'Label e.g. Tris', ph2: 'Value e.g. 110k' },
        { t: 'section', label: 'Media' },
        { k: 'images', label: 'Renders', t: 'images' },
        { k: 'video', label: 'Product film (optional)', t: 'video', optional: true },
        { t: 'section', label: 'Colours' },
        { k: '_c', t: 'custom', render: (obj) => colourHelper(obj, 'images') },
        { t: 'row', fields: [{ k: 'bg', label: 'Background', t: 'color' }, { k: 'ink', label: 'Text', t: 'color' }, { k: 'accent', label: 'Accent', t: 'color' }] },
        { t: 'section', label: 'Visibility' },
        { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true },
      ],
    });
  },

  models(v) { modelsPage(v); },

  furniture(v) {
    listPage(v, {
      intro: 'Each entry becomes a tab in the furniture configurator: the 3D model with fabric colourways (set in 3D Models) plus a step-by-step breakdown.',
      get: () => C.furniture, newLabel: 'New furniture piece',
      newItem: () => ({ id: '', title: '', model: Object.keys(C.models)[0], poly: [{ label: 'Low poly', value: '' }, { label: 'High poly', value: '' }, { label: 'Method', value: 'Sub-D modelling' }], stages: [], hidden: false }),
      beforeSave: (d, isNew) => { if (isNew || !d.id) d.id = slugId(d.title || 'piece', new Set(C.furniture.map((p) => p.id))); },
      check: (d) => (!d.title.trim() ? 'Give it a name' : !d.stages.every((s) => s.image) ? 'Every step needs an image' : ''),
      thumb: (f) => f.stages[0]?.image, label: (f) => f.title, sub: (f) => `3D: ${C.models[f.model]?.title || '—'} · ${f.stages.length} breakdown steps`,
      fields: () => [
        { k: 'title', label: 'Name', t: 'text', max: 80 },
        { k: 'model', label: '3D model', t: 'select', opts: modelOpts(false), help: 'Fabric colours are edited on the model itself (3D Models → Colourways).' },
        { k: 'poly', label: 'Poly-count cards', t: 'pairs', maxItems: 6 },
        { k: 'stages', label: 'Breakdown steps (final, clay, wireframe, UVs…)', t: 'stages' },
        { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true },
      ],
    });
  },

  environments(v) {
    listPage(v, {
      intro: 'The cinematic sideways-scrolling gallery. Tip: use “Add from images” to drop in several renders at once.',
      get: () => C.environments, newLabel: 'New environment',
      newItem: () => ({ id: '', title: '', sub: 'Environment', note: '', hidden: false }),
      bulk: (id) => ({ id, title: id.replace(/[-_][0-9a-f]{6}$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), sub: 'Environment', note: '', hidden: false }),
      thumb: (e) => e.id, label: (e) => e.title, sub: (e) => [e.sub, e.note].filter(Boolean).join(' · '),
      fields: [{ k: 'id', label: 'Render', t: 'image' }, { k: 'title', label: 'Title', t: 'text', max: 80 }, { t: 'row', fields: [{ k: 'sub', label: 'Type', t: 'text', max: 60 }, { k: 'note', label: 'One-line note', t: 'text', max: 160 }] }, { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true }],
      check: (d) => (!d.id ? 'Pick a render first' : !d.title ? 'Give it a title' : ''),
      top: () => {
        const p = el(`<div class="panel"><h3>Before / after slider</h3><p>The draggable comparison under the gallery (e.g. clay pass vs final render). Both images should share the same camera.</p></div>`);
        p.appendChild(buildForm([
          { t: 'row', fields: [{ k: 'before', label: 'Left image (before)', t: 'image' }, { k: 'after', label: 'Right image (after)', t: 'image' }] },
          { t: 'row', fields: [{ k: 'beforeLabel', label: 'Left label', t: 'text', max: 30, ph: 'Clay' }, { k: 'afterLabel', label: 'Right label', t: 'text', max: 30, ph: 'Final' }] },
          { t: 'row', fields: [{ k: 'title', label: 'Heading', t: 'text', max: 120 }, { k: 'note', label: 'Caption', t: 'text', max: 300 }] },
        ], C.compare, touch));
        return p;
      },
    });
  },

  archviz(v) {
    const p = el(`<div class="panel"><h3>Live 3D building</h3><p>The interactive model with the sun slider at the top of the ArchViz section.</p></div>`);
    p.appendChild(buildForm([{ t: 'row', fields: [{ k: 'model', label: '3D model', t: 'select', opts: modelOpts() }, { k: 'title', label: 'Title', t: 'text', max: 80 }, { k: 'tag', label: 'Small tag', t: 'text', max: 80 }] }], C.archviz, touch));
    v.appendChild(p);
    listPage(v, {
      get: () => C.archviz.items, newLabel: 'New render', newItem: () => ({ id: '', title: '', note: '', hidden: false }),
      bulk: (id) => ({ id, title: id.replace(/[-_][0-9a-f]{6}$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), note: '', hidden: false }),
      check: (d) => (!d.id ? 'Pick a render first' : ''),
      thumb: (e) => e.id, label: (e) => e.title, sub: (e) => e.note,
      fields: [{ k: 'id', label: 'Render', t: 'image' }, { k: 'title', label: 'Title', t: 'text', max: 80 }, { k: 'note', label: 'Caption', t: 'text', max: 200 }, { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true }],
    });
  },

  reel(v) {
    listPage(v, {
      intro: 'Video clips that play on hover. The first clip is shown large. Uploaded videos are converted to web-friendly MP4 automatically.',
      get: () => C.reel, kind: 'video', newLabel: 'New clip', newItem: () => ({ id: '', title: '', hidden: false }),
      bulk: (id) => ({ id, title: id.replace(/[-_][0-9a-f]{6}$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), hidden: false }),
      check: (d) => (!d.id ? 'Pick a video first' : ''),
      thumb: (e) => e.id, label: (e) => e.title, sub: (e) => e.id,
      fields: [{ k: 'id', label: 'Video', t: 'video' }, { k: 'title', label: 'Title', t: 'text', max: 80 }, { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true }],
    });
  },

  more(v) {
    listPage(v, {
      intro: 'The Nike-style product grid with category filters. Categories are created automatically from what you type.',
      get: () => C.more, newLabel: 'New archive item', newItem: () => ({ id: '', title: '', cat: 'Product', hidden: false }),
      bulk: (id) => ({ id, title: id.replace(/[-_][0-9a-f]{6}$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), cat: 'Product', hidden: false }),
      check: (d) => (!d.id ? 'Pick an image first' : ''),
      thumb: (e) => e.id, label: (e) => e.title, sub: (e) => e.cat,
      fields: () => [{ k: 'id', label: 'Image', t: 'image' }, { t: 'row', fields: [{ k: 'title', label: 'Title', t: 'text', max: 80 }, { k: 'cat', label: 'Category', t: 'text', max: 40, list: () => [...new Set(C.more.map((m) => m.cat))] }] }, { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true }],
    });
  },

  about(v) {
    const A = C.artist;
    const p1 = el(`<div class="panel"><h3>Profile</h3><p>Your name, contact email and the intro text used in the statement and About sections.</p></div>`);
    p1.appendChild(buildForm([
      { t: 'row', fields: [{ k: 'name', label: 'Full name', t: 'text', max: 80 }, { k: 'role', label: 'Role', t: 'text', max: 60 }] },
      { k: 'email', label: 'Contact email (shown on the site)', t: 'email', max: 200 },
      { t: 'row', fields: [{ k: 'claim1', label: 'Hero line 1', t: 'text', max: 80 }, { k: 'claim2', label: 'Hero line 2 (italic)', t: 'text', max: 80 }] },
      { k: 'intro', label: 'Statement / intro', t: 'textarea', max: 1200 },
      { k: 'intro2', label: 'Second About paragraph', t: 'textarea', max: 1200 },
    ], A, touch));
    const p2 = el(`<div class="panel"><h3>Words</h3><p>The scrolling orange marquee, and which words in your statement are set in italic serif.</p></div>`);
    p2.appendChild(buildForm([{ k: 'marquee', label: 'Marquee words', t: 'tags', maxItems: 40 }, { k: 'highlights', label: 'Italic words in the statement', t: 'tags', maxItems: 40 }], C, touch));
    const p3 = el(`<div class="panel"><h3>Toolkit</h3><p>Up to 6 groups shown in big type on the orange About section.</p><div id="tk"></div></div>`);
    const drawTk = () => {
      const tk = $('#tk', p3); tk.innerHTML = '';
      C.toolkit.forEach((g, i) => {
        const r = el(`<div style="display:grid;grid-template-columns:200px 1fr 34px;gap:10px;align-items:start;margin-bottom:10px"></div>`);
        const f = buildForm([{ k: 'title', t: 'text', max: 60 }, { k: 'items', t: 'tags', maxItems: 20 }], g, touch);
        [...f.children].forEach((c) => { c.style.marginBottom = '0'; $('label', c)?.remove(); r.appendChild(c); });
        const x = el(`<button class="icon-btn" title="Remove group">${ICON.trash}</button>`); x.onclick = () => { C.toolkit.splice(i, 1); touch(); drawTk(); }; r.appendChild(x);
        tk.appendChild(r);
      });
      if (C.toolkit.length < 6) { const a = el(`<button class="btn xs ghost">${ICON.plus} Add group</button>`); a.onclick = () => { C.toolkit.push({ title: 'New group', items: [] }); touch(); drawTk(); }; tk.appendChild(a); }
    };
    v.append(p1, socialsPanel(), p2, p3); drawTk();
  },

  async media(v) {
    let tab = 'images';
    v.innerHTML = `<label class="drop" id="drop"><input type="file" id="file" hidden multiple>${ICON.upload}<div><b>Drop renders, videos or .glb models here</b> — or click to browse</div>
      <div class="muted mono" style="margin-top:4px">Files are checked, converted and given safe names automatically</div><div class="prog" id="prog" hidden><i></i></div></label>
      <div class="toolbar"><div class="tabs" id="tabs"><button data-t="images" class="on">Images</button><button data-t="videos">Videos</button><button data-t="models">3D models</button></div><span class="spacer"></span><span class="muted" id="cnt"></span></div>
      <div class="lib" id="lib"></div>`;
    const draw = () => {
      const list = MEDIA[tab];
      $('#cnt', v).textContent = `${list.length} file(s)`;
      $('#lib', v).innerHTML = list.map((m) => `<div class="tile" data-id="${esc(m.id)}"><div class="im">${tab === 'models' ? `<div style="height:100%;display:grid;place-items:center;color:var(--mut)">${ICON.cube}</div>` : thumbHTML(tab === 'videos' ? 'video' : 'image', m.id)}</div>
        <div class="cap" title="${esc((m.used || []).join(', '))}">${esc(m.id)}<br><span style="color:${m.used.length ? 'var(--ok)' : 'var(--dim)'}">${m.used.length ? 'Used in ' + m.used.length + ' place(s)' : 'Not used'}</span></div>
        ${m.used.length ? '' : `<button class="icon-btn" data-del style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);color:#fff" title="Move to trash">${ICON.trash}</button>`}</div>`).join('') || '<p class="muted">Empty.</p>';
    };
    $('#tabs', v).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; $$('#tabs button', v).forEach((x) => x.classList.toggle('on', x === b)); draw(); };
    $('#lib', v).onclick = async (e) => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      const id = d.closest('.tile').dataset.id;
      if (!(await confirmBox('Remove this file?', `“${id}” will be moved to admin_data/trash (you can recover it from there).`, 'Remove', true))) return;
      try { await api('DELETE', `/api/media?kind=${tab.slice(0, -1)}&id=${encodeURIComponent(id)}`); await refreshMedia(); draw(); toast('Moved to trash'); } catch (er) { toast(er.message, 'bad'); }
    };
    const doUpload = async (files) => {
      const pr = $('#prog', v); pr.hidden = false;
      for (const [i, f] of [...files].entries()) {
        const kind = /\.glb$/i.test(f.name) ? 'model' : f.type.startsWith('video') || /\.(mkv|mov|webm|mp4)$/i.test(f.name) ? 'video' : 'image';
        try { await upload(kind, f, (p) => ($('i', pr).style.width = ((i + p) / files.length) * 100 + '%')); toast(`Uploaded ${f.name}${kind === 'model' ? ' — add it in 3D Models' : ''}`, 'ok'); }
        catch (er) { toast(`${f.name}: ${er.message}`, 'bad'); }
      }
      pr.hidden = true; await refreshMedia(); draw(); renderNav();
    };
    $('#file', v).onchange = (e) => doUpload(e.target.files);
    const drop = $('#drop', v);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); doUpload(e.dataTransfer.files); };
    await refreshMedia(); draw();
  },

  async history(v) {
    v.innerHTML = `<p class="muted" style="margin:-6px 0 18px">Every publish saves the previous version here (last 80 kept). Restoring publishes that version immediately — the current one is snapshotted first, so nothing is ever lost.</p><div class="panel"><table><thead><tr><th>Saved</th><th>Version</th><th>Size</th><th></th></tr></thead><tbody id="h"><tr><td>Loading…</td></tr></tbody></table></div>`;
    const h = await api('GET', '/api/history');
    $('#h', v).innerHTML = h.map((x) => `<tr><td><b>${esc(new Date(x.time * 1000).toLocaleString())}</b></td><td>v${x.rev}</td><td>${(x.size / 1024).toFixed(1)} KB</td><td style="text-align:right"><button class="btn xs" data-id="${esc(x.id)}">Restore</button></td></tr>`).join('') || '<tr><td colspan="4">No snapshots yet — they appear after your first publish.</td></tr>';
    $('#h', v).onclick = async (e) => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      if (dirty() && !(await confirmBox('Discard unsaved edits?', 'Restoring replaces your current draft.', 'Continue', true))) return;
      if (!(await confirmBox('Restore this version?', 'Your live site will switch to this version right away.', 'Restore'))) return;
      try { await api('POST', '/api/history/restore', { id: b.dataset.id }); await loadAll(); touch(); toast('Restored and published', 'ok'); go('history'); } catch (er) { toast(er.message, 'bad'); }
    };
  },

  async security(v) {
    if (WEB) return webSecurity(v);
    v.innerHTML = `<div class="panel"><h3>How your studio is protected</h3><p>Seven layers stand between the internet and your content.</p><div class="layers">
      ${[['Private network only', 'The admin listens on 127.0.0.1. A paired phone reaches it only through your own encrypted Tailscale network, and only when Tailscale confirms it’s your account.'],
         ['Launch key', 'A fresh 256-bit key is created every start and only given to the browser the launcher opens.'],
         ['Password', 'Hashed with scrypt; never stored in plain text. 12+ characters required.'],
         ['2-step codes', 'A 6-digit authenticator code is needed every sign-in (codes can’t be reused).'],
         ['Sessions', 'HttpOnly, SameSite=Strict cookies. On the PC they expire after 30 min idle; on a paired phone after 30 days without use.'],
         ['Brute-force lock', '5 wrong attempts locks sign-in for 15 minutes.'],
         ['Safe uploads', 'Files are type-checked by content, images & videos re-encoded, models validated.'],
         ['Rollback', 'Every publish is versioned; every sign-in and change is written to the audit log.']]
        .map(([a, b]) => `<div class="layer"><i>✓</i><div><b>${a}</b><span>${b}</span></div></div>`).join('')}</div></div>
      <div class="two">
        <form class="panel" id="pw" autocomplete="off"><h3>Change password</h3><p>Other open sessions are signed out.</p>
          <div class="f"><label>Current password</label><input type="password" name="current" autocomplete="current-password" required></div>
          <div class="f"><label>New password (12+ characters)</label><input type="password" name="new" autocomplete="new-password" minlength="12" required></div>
          <div class="f"><label>Authenticator code</label><input type="text" name="code" inputmode="numeric" maxlength="6" required></div>
          <button class="btn primary">Update password</button></form>
        <div><form class="panel" id="rc" autocomplete="off"><h3>Recovery codes</h3><p>Make a fresh set of 10 one-time codes. Old codes stop working.</p>
          <div class="f"><label>Authenticator code</label><input type="text" name="code" inputmode="numeric" maxlength="6" required></div>
          <button class="btn">Generate new codes</button><div id="rcout"></div></form>
        <div class="panel"><h3>Sessions</h3><p>Sign out every browser that is signed in, including this one.</p><button class="btn danger" id="all">Sign out everywhere</button></div></div>
      </div>
      <div class="panel"><h3>Phones & devices</h3><p>A paired phone stays paired until you revoke it here. It can use the studio anywhere at <b>fuzailahmed.com/admincontrol</b>, or privately through Tailscale. It still needs your password and authenticator code to sign in.</p>
        <table><thead><tr><th>Device</th><th>Paired</th><th>Last sign-in</th><th></th></tr></thead><tbody id="devs"><tr><td>Loading…</td></tr></tbody></table>
        <div style="margin-top:14px" id="pairBox"></div></div>
      <div class="panel" id="webPanel"><h3>Web admin · fuzailahmed.com/admincontrol</h3>
        <p>The online copy of this studio runs on Vercel and saves straight to GitHub. There is no link to it anywhere on the site; to anyone whose browser isn’t paired, the address shows “404”.</p>
        <p>It needs two settings in <b>Vercel → your project → Settings → Environment Variables</b> (once, and again after you change your password):</p>
        <form id="webForm" autocomplete="off"><div class="f" style="max-width:360px"><label>Authenticator code</label><div style="display:flex;gap:10px"><input type="text" name="code" inputmode="numeric" maxlength="6" required style="flex:1"><button class="btn">Show settings</button></div></div></form>
        <div id="webOut"></div></div>
      <div class="panel"><h3>Audit log</h3><p>The last 200 security events (stored in admin_data/audit.log).</p><table><thead><tr><th>When</th><th>Event</th><th>Details</th></tr></thead><tbody id="log"></tbody></table></div>`;
    $('#pw', v).onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      try { await api('POST', '/api/password', Object.fromEntries(f)); e.target.reset(); toast('Password updated', 'ok'); } catch (er) { toast(er.message, 'bad'); }
    };
    $('#rc', v).onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await api('POST', '/api/recovery', Object.fromEntries(new FormData(e.target))); e.target.reset();
        $('#rcout', v).innerHTML = `<div class="codes" style="margin-top:14px">${r.recovery.map((c) => `<span>${esc(c)}</span>`).join('')}</div><p class="help muted">Save these now — they won’t be shown again.</p>`;
      } catch (er) { toast(er.message, 'bad'); }
    };
    $('#all', v).onclick = async () => { if (await confirmBox('Sign out everywhere?', 'You will need your password and authenticator again.', 'Sign out')) { await api('POST', '/api/logout-all', {}); location.reload(); } };
    const drawDevs = async () => {
      const d = await api('GET', '/api/devices');
      const fmt = (t) => (t ? new Date(t * 1000).toLocaleString() : '—');
      $('#devs', v).innerHTML = d.devices.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${fmt(x.created)}</td><td>${fmt(x.last)}</td><td style="text-align:right"><button class="btn xs danger" data-rev="${esc(x.id)}">Revoke</button></td></tr>`).join('') || '<tr><td colspan="4">No phones paired yet.</td></tr>';
      const pb = $('#pairBox', v);
      if (!d.remote.host) pb.innerHTML = '<p class="muted" style="margin:0">Remote access isn’t set up on this PC.</p>';
      else if (d.here === 'phone') pb.innerHTML = '<p class="muted" style="margin:0">You’re on a paired phone. New phones are paired from the PC.</p>';
      else { pb.innerHTML = `<button class="btn primary sm" id="pairNew">${ICON.plus} Pair a phone</button> <span class="muted mono" style="margin-left:8px">${esc(d.remote.host)}</span>`; $('#pairNew', pb).onclick = pairNew; }
    };
    const pairNew = async () => {
      let r; try { r = await api('POST', '/api/pair/new', {}); } catch (er) { return toast(er.message, 'bad'); }
      const L = r.links || {};
      const tabs = [['web', 'Anywhere (website)', 'Opens fuzailahmed.com/admincontrol. Give the PC a minute to push the pairing to GitHub first (see Overview → GitHub).'],
                    ['private', 'Private (Tailscale)', 'Turn Tailscale on in the phone first. Works only while this PC is on.']].filter(([k]) => L[k]);
      const b = openModal(`<div class="mhead"><h3>Pair a phone</h3></div><div class="mbody" style="text-align:center">
        <p class="muted" style="margin-top:0">Scan with the phone’s camera, open the link, then sign in with your password + authenticator code. You can scan both codes — it’s the same phone.</p>
        <div class="seg" id="pairTabs" style="justify-content:center;margin-bottom:12px">${tabs.map(([k, n], i) => `<button type="button" class="btn sm ${i ? 'ghost' : 'primary'}" data-t="${k}">${esc(n)}</button>`).join('')}</div>
        ${tabs.map(([k, , help], i) => `<div data-p="${k}" ${i ? 'hidden' : ''}><div class="qr">${L[k].qr || ''}</div><p class="mono muted" style="word-break:break-all;font-size:11px">${esc(L[k].url)}</p><p class="muted" style="font-size:12.5px">${esc(help)}</p></div>`).join('')}
        <p class="muted" style="font-size:12.5px"><b>Keep this code private</b> — it never expires. If a phone is lost, revoke it below.</p></div><div class="mfoot"><button class="btn primary" data-a="done">Done</button></div>`, 'small');
      fixQr(b);
      b.addEventListener('click', (e) => { const t = e.target.closest('[data-t]'); if (!t) return; $$('[data-t]', b).forEach((x) => { x.classList.toggle('ghost', x !== t); x.classList.toggle('primary', x === t); }); $$('[data-p]', b).forEach((x) => (x.hidden = x.dataset.p !== t.dataset.t)); });
      b.addEventListener('click', (e) => { if (e.target.closest('[data-a]')) { closeModal(); drawDevs(); } });
    };
    $('#devs', v).onclick = async (e) => {
      const b = e.target.closest('[data-rev]'); if (!b) return;
      if (!(await confirmBox('Revoke this device?', 'It is signed out immediately and can’t open the studio until paired again.', 'Revoke', true))) return;
      try { await api('POST', '/api/devices/revoke', { id: b.dataset.rev }); toast('Device revoked'); drawDevs(); } catch (er) { toast(er.message, 'bad'); }
    };
    drawDevs();
    $('#webForm', v).onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await api('POST', '/api/webadmin', Object.fromEntries(new FormData(e.target))); e.target.reset();
        const out = $('#webOut', v);
        out.innerHTML = `<p style="margin:14px 0 6px"><b>1.</b> Key <b class="mono">FZ_ADMIN</b>, value (secret — copy it exactly, never share it):</p>
          <textarea readonly rows="4" class="mono" style="width:100%;font-size:11px;word-break:break-all">${esc(r.FZ_ADMIN)}</textarea>
          <button type="button" class="btn sm" data-copy style="margin-top:6px">${ICON.copy} Copy value</button>
          <p style="margin:16px 0 6px"><b>2.</b> Key <b class="mono">FZ_GITHUB_TOKEN</b>, value: a GitHub token that can write to <b>${esc(r.repo || 'the repo')}</b>. Make one at GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token → Repository access: <i>Only select repositories</i> → <b>${esc(r.repo || 'the repo')}</b> → Permissions → <b>Contents: Read and write</b>.</p>
          <p class="muted" style="margin:10px 0 0"><b>3.</b> In Vercel open Deployments → ⋯ → <b>Redeploy</b>. Then pair your phone with the “Anywhere (website)” code above.</p>`;
        $('[data-copy]', out).onclick = () => { navigator.clipboard.writeText(r.FZ_ADMIN).then(() => toast('Copied', 'ok')); };
      } catch (er) { toast(er.message, 'bad'); }
    };
    const a = await api('GET', '/api/audit');
    $('#log', v).innerHTML = a.map((x) => { const { t, event, ...rest } = x; return `<tr><td>${esc(new Date(t).toLocaleString())}</td><td><b style="color:${/fail|error/.test(event) ? 'var(--bad)' : 'var(--ink)'}">${esc(event.replace(/_/g, ' '))}</b></td><td>${esc(Object.entries(rest).map(([k, val]) => `${k}: ${val}`).join(' · '))}</td></tr>`; }).join('');
  },
};

/* ─────────────── 3D models page ─────────────── */
function usedBy(key) {
  const u = [];
  if (C.showroom.includes(key)) u.push('hero showroom');
  C.featured.forEach((p) => p.model === key && u.push('project “' + p.title + '”'));
  C.furniture.forEach((f) => f.model === key && u.push('furniture “' + f.title + '”'));
  if (C.archviz.model === key) u.push('ArchViz');
  return u;
}
function modelsPage(v) {
  v.appendChild(el(`<p class="muted" style="margin:-6px 0 18px;max-width:780px">Upload a .glb from Blender (File → Export → glTF 2.0, “glTF Binary”, tick Draco compression), then set its colours, orientation and size with the live preview. Turn on “Hero showroom” to put it in the homepage carousel.</p>`));
  const strip = el(`<div class="panel"><h3>Hero showroom order</h3><p>Drag to reorder the homepage carousel.</p><div class="list" id="sr" style="flex-direction:row;flex-wrap:wrap"></div></div>`);
  const grid = el(`<div class="mgrid" id="mg"></div>`);
  const file = el(`<input type="file" id="uploadModelInput" accept=".glb,model/gltf-binary" hidden>`);
  v.append(strip, grid, file);
  const drawStrip = () => {
    $('#sr', strip).innerHTML = C.showroom.map((k, i) => `<div class="row" data-i="${i}" style="grid-template-columns:18px auto;padding:8px 12px"><span class="handle">${ICON.drag}</span><b style="font-size:13px">${i + 1}. ${esc(C.models[k]?.title || k)}</b></div>`).join('') || '<span class="muted">No models in the showroom yet.</span>';
  };
  const draw = () => {
    grid.innerHTML = Object.entries(C.models).map(([k, m]) => `<button class="mcard" data-k="${esc(k)}"><div class="sw" style="background:radial-gradient(70% 70% at 50% 60%, ${esc(m.bg2)}, ${esc(m.bg)});color:${esc(m.ink)}"><b>${esc(m.word || '3D')}</b>
      ${C.showroom.includes(k) ? '<i>Showroom</i>' : ''}</div><div class="meta"><b>${esc(m.title)}</b><span>${esc(m.kind || '')}${m.hidden ? ' · hidden' : ''}</span></div></button>`).join('') +
      `<button class="mcard add" id="uploadModel"><div>${ICON.upload}<br><b>Upload .glb</b><br><span class="muted">or drop it on this card</span></div></button>`;
    drawStrip();
  };
  sortable($('#sr', strip), '.row', (a, b) => { move(C.showroom, a, b); drawStrip(); touch(); });
  grid.onclick = (e) => {
    if (e.target.closest('#uploadModel')) return file.click();
    const c = e.target.closest('[data-k]'); if (c) modelEditor(c.dataset.k, draw);
  };
  const handleFile = async (f) => {
    if (!f) return;
    const t = toast; t(`Uploading ${f.name}…`);
    try {
      const r = await upload('model', f);
      const title = f.name.replace(/\.glb$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
      const key = slugId(title, new Set(Object.keys(C.models)), 24, '_');
      C.models[key] = { file: r.file, title, word: title.split(' ')[0].toUpperCase().slice(0, 10), kind: 'Product Visual', blurb: '', bg: '#141414', bg2: '#3a3a3a', ink: '#f2ede4', glow: '#ff8a2a', dark: true, rot: [0, 0, 0], fit: 1.8, y: 0, inspector: true, hidden: false };
      await refreshMedia(); touch(); draw(); modelEditor(key, draw, r);
    } catch (er) { toast(er.message, 'bad'); }
  };
  file.onchange = () => handleFile(file.files[0]);
  grid.ondragover = (e) => { if (e.target.closest('#uploadModel')) e.preventDefault(); };
  grid.ondrop = (e) => { if (!e.target.closest('#uploadModel')) return; e.preventDefault(); handleFile(e.dataTransfer.files[0]); };
  draw();
}

let previewLib = null;
async function getPreview() {
  if (!previewLib) {
    const [stage, data] = await Promise.all([import(`${SITE}/js/stage.js`), import(`${SITE}/js/data.js`)]);
    previewLib = { ...stage, MODELS: data.MODELS };
  }
  return previewLib;
}

function modelEditor(key, redraw, info0) {
  const draft = clone(C.models[key]);
  draft.rot = draft.rot || [0, 0, 0];
  const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;
  let inShow = C.showroom.includes(key), stage = null, info = info0 || null, raf = 0, pkey = '__pv_' + key;
  openDrawer((p) => {
    p.innerHTML = `<div class="split"><div class="preview" id="pv"><div class="pv-word" id="pvw"></div><canvas id="pvc"></canvas><div class="pv-info"><span id="pvs"></span><span>Drag to rotate</span></div><div class="pv-msg" id="pvm"><span class="spin"></span></div></div>
      <div style="display:flex;flex-direction:column;min-height:0"><div class="dhead"><h2>${esc(draft.title)}</h2><button class="icon-btn" data-a="x">${ICON.x}</button></div><div class="dbody"></div>
      <div class="dfoot"><button class="btn danger" data-a="del" style="margin-right:auto">${ICON.trash} Delete</button><button class="btn ghost" data-a="x">Cancel</button><button class="btn primary" data-a="ok">Done</button></div></div></div>`;
    const body = $('.dbody', p);
    const paintBg = () => { const pv = $('#pv', p); pv.style.background = `radial-gradient(60% 60% at 50% 55%, ${draft.bg2}, ${draft.bg} 75%)`; $('#pvw', p).textContent = draft.word || ''; $('#pvw', p).style.color = draft.ink; $('#pvw', p).style.opacity = .9; };
    const refresh = (rebuild = true) => {
      paintBg();
      if (!stage) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(async () => {
        const lib = await getPreview();
        lib.MODELS[pkey] = clone(draft);
        stage.setColors(draft);
        if (rebuild) { const m = await stage.show(pkey, { animate: false }); if (m) $('#pvs', p).textContent = `${m.userData.stats.tris.toLocaleString()} tris · ${m.userData.stats.meshes} meshes`; }
      });
    };
    const onChange = (k) => { if (['title'].includes(k)) $('.dhead h2', p).textContent = draft.title; refresh(!['bg', 'bg2', 'ink', 'word'].includes(k)); };
    const loadInfo = async () => {
      if (info) return info;
      try { info = await api('GET', `/api/model-info?id=${encodeURIComponent(draft.file.replace(/^assets\/models\/|\.glb$/g, ''))}`); } catch { info = { materials: [], meshes: [] }; }
      return info;
    };
    const showToggle = el(`<label class="toggle"><input type="checkbox"><span>Hero showroom<small>Show in the homepage 3D carousel</small></span></label>`);
    $('input', showToggle).checked = inShow; $('input', showToggle).onchange = (e) => (inShow = e.target.checked);
    const replace = el(`<div class="single" style="margin-bottom:16px"><div class="th">${ICON.cube}</div><span>${esc(draft.file)}</span><button class="btn xs" type="button">Replace .glb</button><input type="file" accept=".glb" hidden></div>`);
    $('button', replace).onclick = () => $('input', replace).click();
    $('input', replace).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const r = await upload('model', f); draft.file = r.file; info = r; $('span', replace).textContent = r.file; const lib = await getPreview(); lib.forget(pkey); refresh(); renderChecks(); toast('Model replaced', 'ok'); } catch (er) { toast(er.message, 'bad'); }
    };
    body.append(replace, showToggle);
    body.appendChild(buildForm([
      { t: 'section', label: 'Text' },
      { t: 'row', fields: [{ k: 'title', label: 'Title', t: 'text', max: 80 }, { k: 'word', label: 'Giant word behind it', t: 'text', max: 14 }] },
      { k: 'kind', label: 'Tag', t: 'text', max: 60, ph: 'Product Visual, Hard-Surface…' },
      { k: 'blurb', label: 'Short description', t: 'textarea', max: 400, rows: 3 },
      { t: 'section', label: 'Colours (page matches these)' },
      { t: 'row', fields: [{ k: 'bg', label: 'Background', t: 'color' }, { k: 'bg2', label: 'Glow behind model', t: 'color' }] },
      { t: 'row', fields: [{ k: 'ink', label: 'Text / word', t: 'color' }, { k: 'glow', label: 'Rim light', t: 'color' }] },
      { k: 'dark', label: 'Dark scene', t: 'toggle', help: 'Moodier lighting for dark backgrounds' },
      { t: 'section', label: 'Placement' },
      { k: 'rx', label: 'Tilt (X°)', t: 'range', min: -180, max2: 180, step: 1, dp: 0, get: (o) => deg(o.rot[0]), put: (o, val) => (o.rot[0] = +rad(val).toFixed(3)) },
      { k: 'ry', label: 'Turn (Y°)', t: 'range', min: -180, max2: 180, step: 1, dp: 0, get: (o) => deg(o.rot[1]), put: (o, val) => (o.rot[1] = +rad(val).toFixed(3)) },
      { k: 'rz', label: 'Roll (Z°)', t: 'range', min: -180, max2: 180, step: 1, dp: 0, get: (o) => deg(o.rot[2]), put: (o, val) => (o.rot[2] = +rad(val).toFixed(3)) },
      { t: 'row', fields: [{ k: 'fit', label: 'Size', t: 'range', min: 0.3, max2: 4, step: 0.05 }, { k: 'y', label: 'Height', t: 'range', min: -1.5, max2: 1.5, step: 0.05 }] },
      { t: 'section', label: 'Inspector & effects' },
      { k: 'inspector', label: 'Available in the 3D inspector', t: 'toggle' },
      { k: 'explode', label: 'Stack-style exploded view', t: 'toggle', help: 'Layers lift straight up (great for keyboards); off = parts fly outward' },
      { k: 'clay', label: 'White clay look', t: 'toggle', help: 'Ignore materials and render as white architecture' },
      { k: 'hidden', label: 'Show on the live site', t: 'toggle', invert: true },
      { t: 'section', label: 'Colourways' },
      { k: 'swatches', label: 'Fabric colours (for furniture)', t: 'swatches', help: 'Applied to the materials ticked under “Fabric materials”.' },
    ], draft, onChange));
    const checks = el(`<div></div>`);
    body.appendChild(checks);
    const renderChecks = async () => {
      const inf = await loadInfo();
      checks.innerHTML = '';
      checks.appendChild(buildForm([
        { t: 'section', label: 'Materials & parts' },
        { k: 'fabric', label: 'Fabric materials (tinted by colourways)', t: 'checks', opts: () => inf.materials },
        { k: 'glass', label: 'Clear glass materials', t: 'checks', opts: () => inf.materials, help: 'Forces see-through glass (e.g. a watch crystal).' },
        { k: 'hide', label: 'Hide these parts', t: 'checks', opts: () => inf.meshes, help: 'Hide text, stands or helper objects that came along in the export.' },
        ...((inf.animations || []).length ? [{ t: 'section', label: 'Animation' }, { k: 'anim', label: 'Animation that plays on the site', t: 'select',
          opts: () => [['', 'Automatic (Idle if there is one)'], ...inf.animations.map((a) => [a, a]), ['none', 'None — rest pose']] }] : []),
      ], draft, onChange));
    };
    renderChecks();
    p.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'x') closeDrawer();
      if (a.dataset.a === 'ok') {
        ['fabric', 'glass', 'hide'].forEach((k) => { if (Array.isArray(draft[k]) && !draft[k].length) delete draft[k]; });
        if (draft.swatches && !draft.swatches.length) delete draft.swatches;
        C.models[key] = draft;
        const i = C.showroom.indexOf(key);
        if (inShow && i < 0) C.showroom.push(key); if (!inShow && i >= 0) C.showroom.splice(i, 1);
        closeDrawer(); touch(); redraw();
      }
      if (a.dataset.a === 'del') {
        const u = usedBy(key).filter((x) => x !== 'hero showroom');
        if (u.length) return toast('Still used by ' + u.join(', ') + ' — change those first', 'bad');
        if (!(await confirmBox('Delete this model?', 'It disappears from the site when you publish. The .glb stays in the media library.', 'Delete', true))) return;
        delete C.models[key]; const i = C.showroom.indexOf(key); if (i >= 0) C.showroom.splice(i, 1);
        closeDrawer(); touch(); redraw();
      }
    });
    paintBg();
    (async () => {
      try {
        const lib = await getPreview();
        stage = new lib.Stage($('#pvc', p), { autoRotate: 0.3, distance: 5.4, float: 0 });
        lib.forget(pkey);
        refresh(); $('#pvm', p).remove();
      } catch (er) { $('#pvm', p).textContent = 'Preview unavailable: ' + er.message; }
    })();
    return () => { cancelAnimationFrame(raf); if (stage) stage.destroy(); };
  }, { wide: true });
}

/* ─────────────── security page on the web copy ─────────────── */
async function webSecurity(v) {
  v.innerHTML = `<div class="panel"><h3>Web admin</h3><p>You’re using the online studio. Every publish is saved straight to GitHub and the live site updates about a minute later. Your PC admin picks the changes up automatically.</p>
    <div class="layers">${[['Paired devices only', 'This address shows “404” to any browser that wasn’t paired from your PC.'], ['Password + 2-step code', 'Same password and authenticator as your PC admin.'], ['30-day sessions', 'You stay signed in on this phone while you keep using it; revoke the phone on your PC to cut it off.'], ['Every change is a commit', 'Undo anything from History, or from GitHub.']]
      .map(([a, b]) => `<div class="layer"><i>✓</i><div><b>${a}</b><span>${b}</span></div></div>`).join('')}</div>
    <p class="muted">Passwords, new phones, deleting files and uploading videos or 3D models are done from the admin on your PC.</p></div>
    <div class="panel"><h3>Paired devices</h3><table><thead><tr><th>Device</th><th>Paired</th></tr></thead><tbody id="devs"></tbody></table></div>
    <div class="panel"><h3>Recent changes on GitHub</h3><table><thead><tr><th>When</th><th>Change</th></tr></thead><tbody id="log"></tbody></table></div>`;
  const fmt = (t) => (t ? new Date(t * 1000).toLocaleString() : '—');
  api('GET', '/api/devices').then((d) => { $('#devs', v).innerHTML = d.devices.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${fmt(x.created)}</td></tr>`).join(''); }).catch(() => {});
  const a = await api('GET', '/api/audit');
  $('#log', v).innerHTML = a.map((x) => `<tr><td>${esc(new Date(x.t).toLocaleString())}</td><td>${esc(x.note)}</td></tr>`).join('');
}

/* ─────────────── boot ─────────────── */
async function claimPair() {
  showGate(`<div class="card"><div class="lockico">${ICON.shield}</div><h1>Pairing…</h1><p>Linking this phone to your studio.</p></div>`);
  const ua = navigator.userAgent;
  const name = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android phone' : 'Device';
  try {
    await api('POST', '/api/pair/claim', { key: PAIR, name }, { launch: true });
    store.del('fzdev');
    toast('Phone paired for good — sign in with your password and code', 'ok');
  } catch (er) { showGate(`<div class="card"><h1>Pairing failed</h1><p>${esc(er.message)}</p></div>`); await new Promise(() => {}); }
}

async function boot() {
  if (PAIR) await claimPair();
  let st;
  try { st = await (await fetch(A('state'), { cache: 'no-store' })).json(); } catch { return showGate('<div class="card"><h1>Offline</h1><p>The admin server isn’t running. Start it with Start Admin.bat.</p></div>'); }
  // phones paired with the older version kept their key in localStorage: move it into the permanent cookie
  if (!st.paired && !KEY && store.get('fzdev')) {
    try { await api('POST', '/api/pair/claim', { key: store.get('fzdev'), name: 'iPhone' }, { launch: true }); st.paired = true; } catch {}
    store.del('fzdev');
  }
  if (st.authed) CSRF = st.csrf;
  else {
    if (!KEY && !st.paired) return noKeyScreen();
    if (st.setup) await setupScreen();
    await loginScreen();
  }
  await loadAll();
  gate.hidden = true; $('#app').hidden = false;
  touch(); go('overview');
}
boot();
