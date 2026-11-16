// Phone-only conveniences. Nothing here runs on a desktop-sized screen.
const $ = (id) => document.getElementById(id);
const phone = matchMedia('(max-width: 720px)');

// a close button on the fact card (on phones it sits on top of the model, so it needs to be easy to dismiss).
// It is a sibling of the title, because ui.setFact() rewrites the title text.
const hud = $('fact-hud');
if (hud && !hud.querySelector('.m-close')) {
  const x = document.createElement('button');
  x.className = 'm-close m-only'; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.textContent = '✕';
  x.addEventListener('click', (e) => { e.stopPropagation(); hud.classList.remove('show'); });
  hud.appendChild(x);
}

// tap the long procedure explanation to unfold it
const hint = $('proc-hint');
if (hint) hint.addEventListener('click', () => { if (phone.matches) hint.classList.toggle('open'); });
if (hint) new MutationObserver(() => hint.classList.remove('open')).observe(hint, { childList: true, characterData: true, subtree: true });

// tap the monitor to hide / show the ECG trace and win back some screen
const tel = $('telemetry');
if (tel) tel.addEventListener('click', () => { if (phone.matches) { tel.classList.toggle('mini'); dispatchEvent(new Event('resize')); } });

// an open annotation card and the fact card would stack in the same spot: the newest one wins
const anno = $('anno-card');
if (anno && hud) {
  new MutationObserver(() => { if (phone.matches && !anno.hidden) hud.classList.remove('show'); }).observe(anno, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(() => { if (phone.matches && hud.classList.contains('show') && !anno.hidden) $('anno-x')?.click(); }).observe(hud, { attributes: true, attributeFilter: ['class'] });
}
