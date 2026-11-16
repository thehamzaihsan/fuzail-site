// DOM side of AXIS: telemetry + ECG + alarms, procedure panel, precision pad, event log, death/debrief, toasts.
const $ = (id) => document.getElementById(id);
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export class UI {
  constructor() {
    this.holding = new Set();
    this.actionHandler = () => {};
    this.ecg = $('ecg'); this.ecgCtx = this.ecg.getContext('2d');
    this.ecgX = 0; this.ecgLastY = null;
    this.resizeECG();
    addEventListener('resize', () => this.resizeECG());
    addEventListener('pointerup', () => { this.holding.clear(); document.querySelectorAll('.proc-btn.pressed').forEach(b => b.classList.remove('pressed')); });
    addEventListener('pointercancel', () => this.holding.clear());
    this.telemetryTick = 0; this.lastBeat = -1; this.alarmT = 0;
    this.sound = true; this.audio = null;
    addEventListener('pointerdown', () => { if (!this.audio) try { this.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { } }, { once: true });
  }

  // ---------- loading ----------
  loading(p, label) { $('load-bar').style.width = `${Math.round(p * 100)}%`; if (label) $('load-label').textContent = label; }
  hideLoading() { $('loading').classList.add('done'); setTimeout(() => $('loading').remove(), 600); }
  fatal(msg) { $('load-label').textContent = msg; $('loading').classList.add('error'); }

  setFact(title, text) { $('fact-title').textContent = title; $('fact-text').textContent = text; }

  // ---------- sound ----------
  beep(freq, dur, vol = 0.05) {
    if (!this.sound || !this.audio) return;
    const a = this.audio, o = a.createOscillator(), g = a.createGain();
    o.frequency.value = freq; o.type = 'sine'; g.gain.value = vol;
    g.gain.setTargetAtTime(0, a.currentTime + dur * 0.6, dur * 0.2);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }

  // ---------- telemetry ----------
  resizeECG() {
    const r = this.ecg.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    this.ecg.width = Math.max(10, r.width * d); this.ecg.height = Math.max(10, r.height * d); this.ecgScale = d;
    this.ecgCtx.fillStyle = '#04100d'; this.ecgCtx.fillRect(0, 0, this.ecg.width, this.ecg.height);
    this.ecgX = 0; this.ecgLastY = null;
  }

  drawECG(phys, dt) {
    const c = this.ecgCtx, W = this.ecg.width, H = this.ecg.height, d = this.ecgScale;
    const speed = 70 * d, dx = speed * dt, n = Math.max(1, Math.ceil(dx));
    const rate = (phys.arrest ? (phys.arrest.rhythm === 'PEA' ? 38 : 0) : phys.hr) / 60;
    let phase = (phys.cardiacPhase - dt * rate + 1) % 1, t = phys.time - dt;
    c.lineWidth = 1.6 * d;
    c.strokeStyle = phys.arrest ? '#ff5a4f' : phys.ischemia > 0.35 ? '#ffb347' : '#3cff9b';
    for (let i = 0; i < n; i++) {
      phase = (phase + (dt / n) * rate) % 1; t += dt / n;
      const x = this.ecgX + dx * (i + 1) / n;
      const y = H * 0.6 - phys.ecgSample(t, phase, phys.beat) * H * 0.45;
      c.fillStyle = '#04100d'; c.fillRect(x, 0, 8 * d, H);
      if (this.ecgLastY !== null && x > this.ecgX) { c.beginPath(); c.moveTo(x - dx / n, this.ecgLastY); c.lineTo(x, y); c.stroke(); }
      this.ecgLastY = y;
    }
    this.ecgX += dx;
    if (this.ecgX > W) { this.ecgX = 0; this.ecgLastY = null; }
  }

  updateTelemetry(phys, dt) {
    this.drawECG(phys, dt);
    // pulse beep on each beat, pitch follows SpO2 (like a real monitor); alarm tones
    if (dt > 0 && phys.beat !== this.lastBeat) { this.lastBeat = phys.beat; if (!phys.arrest) this.beep(300 + (phys.spo2 - 70) * 12, 0.08, 0.035); }
    this.alarmT -= dt;
    if (phys.alarm === 2 && this.alarmT <= 0 && dt > 0) { this.beep(880, 0.18, 0.06); setTimeout(() => this.beep(880, 0.18, 0.06), 260); this.alarmT = 1.4; }
    document.body.classList.toggle('alarm', phys.alarm === 2);
    this.telemetryTick += dt;
    if (this.telemetryTick < 0.25) return;
    this.telemetryTick = 0;
    const set = (id, v, bad) => { const e = $(id); e.textContent = v; e.parentElement.classList.toggle('bad', !!bad); };
    const dead = !!phys.arrest;
    set('t-hr', dead && phys.arrest.rhythm !== 'PEA' ? '---' : Math.round(phys.hr), phys.hr > 110 || phys.hr < 50 || dead);
    set('t-bp', dead ? '--/--' : `${Math.round(phys.sys)}/${Math.round(phys.dia)}`, phys.map < 65 || dead);
    set('t-spo2', dead ? '--' : `${Math.round(phys.spo2)}%`, phys.spo2 < 92 || dead);
    set('t-rr', Math.round(phys.rr), phys.rr > 22 || phys.rr < 8);
    $('t-clock').textContent = fmt(phys.time);
    $('t-rhythm').textContent = phys.arrest ? phys.arrest.rhythm : phys.rhythm === 'PVC' ? 'Ectopics' : phys.hr > 100 ? 'Sinus tachy' : 'Sinus';
  }

  setExtra(label, value, kind) {
    const e = $('t-extra');
    if (!label) { e.hidden = true; return; }
    e.hidden = false; $('t-extra-label').textContent = label; $('t-extra-val').textContent = value;
    e.classList.toggle('bad', kind === 'bad');
  }

  // ---------- event log ----------
  logEvent(e) {
    const li = document.createElement('li'); li.className = e.level;
    li.innerHTML = `<b>${fmt(e.t)}</b> ${e.msg}`;
    const box = $('log'); box.prepend(li); while (box.children.length > 40) box.lastChild.remove();
    if (e.level === 'bad' || e.level === 'dead') this.toast(e.msg, 'bad');
  }
  clearLog() { $('log').innerHTML = ''; }

  // ---------- death / debrief ----------
  showDeath(phys) {
    const o = $('death'); if (!o.hidden) return;
    $('death-cause').textContent = phys.dead.cause;
    $('death-time').textContent = `Time of death ${fmt(phys.dead.time)}`;
    $('death-events').innerHTML = phys.events.filter(e => e.level !== 'info').map(e => `<li class="${e.level}"><b>${fmt(e.t)}</b> ${e.msg}</li>`).join('');
    o.hidden = false;
  }
  hideDeath() { $('death').hidden = true; }

  // ---------- step-by-step guide ----------
  showGuide(guide, onDone) {
    if (!guide) return;
    let i = 0; const n = guide.steps.length;
    const render = () => {
      const s = guide.steps[i];
      $('guide-title').textContent = guide.title;
      $('guide-dots').innerHTML = guide.steps.map((_, k) => `<span class="${k <= i ? 'on' : ''}" data-k="${k}"></span>`).join('');
      $('guide-dots').querySelectorAll('span').forEach(d => d.onclick = () => { i = +d.dataset.k; render(); });
      $('guide-body').innerHTML = `<div class="g-step"><div class="g-icon">${s.icon}</div><div><div class="g-count">Step ${i + 1} of ${n}</div><h3>${s.title}</h3>
        <ol>${s.do.map(x => `<li>${x}</li>`).join('')}</ol>${s.watch ? `<div class="g-watch"><b>Watch for:</b> ${s.watch}</div>` : ''}</div></div>`;
      $('guide-prev').style.visibility = i === 0 ? 'hidden' : 'visible';
      $('guide-next').textContent = i === n - 1 ? 'Start procedure' : 'Next';
    };
    const close = () => { $('guide').hidden = true; removeEventListener('keydown', key); onDone && onDone(); };
    const key = (e) => { if (e.key === 'ArrowRight') $('guide-next').click(); if (e.key === 'ArrowLeft' && i > 0) { i--; render(); } if (e.key === 'Escape') close(); };
    $('guide-prev').onclick = () => { if (i > 0) { i--; render(); } };
    $('guide-next').onclick = () => { if (i < n - 1) { i++; render(); } else close(); };
    $('guide-x').onclick = close;
    addEventListener('keydown', key);
    $('guide').hidden = false; render();
  }
  get guideOpen() { return !$('guide').hidden; }

  // ---------- procedure panel ----------
  showProcedure(title, steps) {
    $('proc').hidden = false;
    if (innerWidth <= 720) $('fact-hud').classList.remove('show');
    $('proc-title').textContent = title;
    $('proc-steps').innerHTML = steps.map((s, i) => `<li data-i="${i}" data-n="${i + 1}">${s}</li>`).join('');
    this.setProgress(0, '');
  }
  hideProcedure() { $('proc').hidden = true; this.setActions([]); this.showPad(false); }
  setStep(i) { document.querySelectorAll('#proc-steps li').forEach(li => { const k = +li.dataset.i; li.classList.toggle('done', k < i); li.classList.toggle('current', k === i); }); }
  setHint(t) { $('proc-hint').textContent = t; }
  setProgress(k, label) { $('proc-bar').style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`; $('proc-progress-label').textContent = label || ''; }
  showPad(on, label) { $('pad-wrap').hidden = !on; if (label) $('pad-label').textContent = label; }
  setActions(list) {
    const box = $('proc-actions'); box.innerHTML = '';
    for (const a of list) {
      const b = document.createElement('button');
      b.className = 'proc-btn' + (a.primary ? ' primary' : '') + (a.hold ? ' hold' : '');
      b.textContent = a.label;
      if (a.hold) {
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); this.holding.add(a.id); b.classList.add('pressed'); });
        const up = () => { this.holding.delete(a.id); b.classList.remove('pressed'); };
        b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
        b.addEventListener('contextmenu', e => e.preventDefault());
      } else b.addEventListener('click', () => this.actionHandler(a.id));
      box.appendChild(b);
    }
  }
  held(id) { return this.holding.has(id); }

  toast(msg, kind = '') {
    const box = $('toasts'); if (box.children.length > 3) box.firstChild.remove();
    const t = document.createElement('div'); t.className = `toast ${kind}`; t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3800);
  }
}
