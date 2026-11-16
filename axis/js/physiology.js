// AXIS physiology v2 — a lumped, approximated (not medical-grade) patient model with real consequences.
// Injuries are "sources" that add pleural air, pleural blood, pericardial blood or external blood loss every second.
// Their effects chain the way they do clinically:
//   pleural air/blood -> lung collapse -> tension (mediastinal shift) -> less venous return -> low BP -> hypoxia -> arrest
//   pericardial blood -> tamponade -> ventricles cannot fill -> low BP -> PEA arrest
//   blood loss -> hypovolaemic shock ; coronary occlusion -> ischaemia -> infarct damage -> PVCs -> VF
// Nothing heals by itself unless the cause is removed. Untreated arrest for 20 s = death.

const approach = (x, t, dt, tau) => x + (t - x) * (1 - Math.exp(-dt / tau));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const gauss = (p, mu, s) => Math.exp(-((p - mu) ** 2) / (2 * s * s));

export class Physiology {
  constructor() { this.listeners = []; this.reset(); }
  onEvent(fn) { this.listeners.push(fn); }
  log(msg, level = 'info') {
    const e = { t: this.time, msg, level };
    this.events.push(e); this.listeners.forEach(f => f(e));
  }

  reset() {
    this.time = 0;
    this.hr = 72; this.rr = 14; this.spo2 = 98; this.sys = 120; this.dia = 80; this.map = 93;
    this.output = 1;               // relative cardiac output (drives blood-flow particles)
    this.coronaryFlow = 1; this.ischemia = 0; this.damage = 0;
    this.air = { L: 0, R: 0 }; this.hemo = { L: 0, R: 0 }; this.tamponade = 0;
    this.volume = 5.0;             // circulating blood volume (L)
    this.collapse = { L: 0, R: 0 }; this.tension = 0; this.pleuralAir = 0;
    this.sources = new Map(); this.drains = new Map();
    this.cardiacPhase = 0; this.respPhase = 0; this.beat = 0;
    this.arrest = null; this.dead = null;
    this.lowMapT = 0; this.lowSatT = 0;
    this.events = []; this.alarm = 0;
    this.breathAmp = 1;
  }

  // ---------- injury API used by the procedures ----------
  addSource(id, s) { if (!this.sources.has(id)) { this.sources.set(id, { ...s }); if (s.label) this.log(s.label, 'bad'); } else Object.assign(this.sources.get(id), s); }
  setSourceRate(id, rate) { const s = this.sources.get(id); if (s) s.rate = rate; }
  removeSource(id) { this.sources.delete(id); }
  addDrain(id, d) { this.drains.set(id, { ...d }); }
  removeDrain(id) { this.drains.delete(id); }
  transfuse(litres) { this.volume = Math.min(5.2, this.volume + litres); this.log(`Transfused ${Math.round(litres * 1000)} mL blood`, 'good'); }
  pericardiocentesis(amount) { const before = this.tamponade; this.tamponade = Math.max(0, this.tamponade - amount); this.log(`Pericardiocentesis: aspirated ${Math.round((before - this.tamponade) * 400)} mL`, 'good'); }

  get bloodLoss() { return Math.max(0, 5.0 - this.volume); }

  update(dt) {
    if (this.dead) { this.time += dt; return; }
    this.time += dt;
    // ---- injury sources ----
    for (const s of this.sources.values()) {
      const r = s.rate * dt;
      if (s.type === 'air') this.air[s.side] += r;
      else if (s.type === 'hemo') { this.hemo[s.side] += r; this.volume -= r; }
      else if (s.type === 'tamp') { this.tamponade += r; this.volume -= r * 0.4; }
      else if (s.type === 'bleed') this.volume -= r;
    }
    for (const s of ['L', 'R']) { this.air[s] = Math.min(this.air[s], 2.2); this.hemo[s] = Math.min(this.hemo[s], 2.5); }
    for (const d of this.drains.values()) {
      const a = Math.min(this.air[d.side], d.air * dt); this.air[d.side] -= a;
      const b = Math.min(this.hemo[d.side], (d.blood || 0) * dt); this.hemo[d.side] -= b;
    }
    // ---- lungs ----
    for (const s of ['L', 'R']) {
      const fill = this.air[s] + this.hemo[s] / 1.4;
      this.collapse[s] = approach(this.collapse[s], clamp(fill, 0, 1), dt, 0.8);
    }
    const fillMax = Math.max(this.air.L + this.hemo.L / 1.4, this.air.R + this.hemo.R / 1.4);
    this.tension = approach(this.tension, clamp(fillMax - 1, 0, 1.5), dt, 1.5);
    this.pleuralAir = clamp(Math.max(this.air.L, this.air.R), 0, 2);
    // ---- heart ----
    const ischT = clamp((0.75 - this.coronaryFlow) / 0.6, 0, 1);
    this.ischemia = approach(this.ischemia, ischT, dt, ischT > this.ischemia ? 3 : 5);
    if (!this.arrest) this.damage = clamp(this.damage + this.ischemia * dt / 150 * (this.damageScale ?? 1), 0, 1);
    const prevDamage = this._dmgFlag || 0;
    if (this.damage > 0.4 && prevDamage < 1) { this._dmgFlag = 1; this.log('Ventricular ectopics: myocardium becoming irritable (ischaemia)', 'warn'); }
    if (this.damage > 0.75 && prevDamage < 2) { this._dmgFlag = 2; this.log('Runs of ventricular tachycardia: infarct is extending', 'bad'); }

    // ---- haemodynamics ----
    const preload = 1 - 0.65 * clamp(this.tension / 1.1, 0, 1);
    const tampF = 1 - 0.85 * clamp(this.tamponade / 0.6, 0, 1);
    const volF = Math.pow(clamp((this.volume / 5 - 0.45) / 0.55, 0, 1), 0.8);
    const contract = 1 - 0.3 * this.ischemia - 0.45 * this.damage;
    let out = clamp(preload * tampF * volF * contract, 0, 1);
    if (this.arrest) out = this.arrest.rhythm === 'PEA' ? 0.04 : 0;
    this.output = approach(this.output, out, dt, 0.6);

    const collapseSum = this.collapse.L + this.collapse.R;
    let tHR = 72 + 75 * (1 - out) + 25 * Math.max(this.collapse.L, this.collapse.R) + 15 * this.ischemia;
    if (out < 0.3) tHR = 45 + 60 * out; // decompensation: hypoxic bradycardia
    const tMAP = 93 * Math.pow(out, 0.75) + (out > 0.3 ? 8 * (1 - out) : 0);
    let tSpO2 = 98 - 13 * collapseSum - 14 * clamp(this.tension, 0, 1.2) - 25 * clamp(0.5 - out, 0, 0.5);
    let tRR = 14 + 16 * Math.max(this.collapse.L, this.collapse.R) + 14 * (1 - out);
    if (this.arrest) { tHR = this.arrest.rhythm === 'PEA' ? 38 : 0; tSpO2 = 40; tRR = 0; }
    this.hr = approach(this.hr, tHR, dt, 2);
    this.map = approach(this.map, tMAP, dt, 1.5);
    this.sys = this.map + 27 * Math.max(0.2, out); this.dia = Math.max(0, this.map - 13 * Math.max(0.2, out));
    this.spo2 = approach(this.spo2, clamp(tSpO2, 20, 100), dt, 4);
    this.rr = approach(this.rr, tRR, dt, 3);

    // ---- arrest & death ----
    this.lowMapT = this.map < 40 ? this.lowMapT + dt : 0;
    this.lowSatT = this.spo2 < 65 ? this.lowSatT + dt : 0;
    if (!this.arrest) {
      if (this.damage >= 1) this.startArrest('VF', 'Ventricular fibrillation from myocardial infarction (LAD occluded too long)');
      else if (this.lowMapT > 6 || this.lowSatT > 12) this.startArrest('PEA', this.cause());
    } else {
      this.arrest.t += dt;
      if (this.arrest.rhythm === 'VF' && this.arrest.t > 12) this.arrest.rhythm = 'asystole';
      if (this.arrest.t > 20) { this.dead = { cause: this.arrest.cause, time: this.time }; this.log(`Patient died: ${this.arrest.cause}`, 'dead'); }
    }
    this.alarm = this.arrest ? 2 : (this.map < 60 || this.spo2 < 88 || this.hr > 130 || this.hr < 45) ? 2 : (this.map < 70 || this.spo2 < 93 || this.hr > 110) ? 1 : 0;

    // ---- rhythm clocks ----
    const prevP = this.cardiacPhase;
    const rate = this.arrest ? (this.arrest.rhythm === 'PEA' ? 38 : 0) : this.hr;
    this.cardiacPhase = (this.cardiacPhase + dt * rate / 60) % 1;
    if (this.cardiacPhase < prevP) this.beat++;
    if (!this.arrest) this.respPhase = (this.respPhase + dt * this.rr / 60) % 1;
  }

  cause() {
    const haemo = this.hemo.L + this.hemo.R;
    if (this.tamponade > 0.35) return 'Cardiac tamponade (blood in the pericardium compressing the heart)';
    if (this.tension > 0.6) return `Tension ${haemo > 0.8 ? 'haemo' : ''}pneumothorax (mediastinal shift, venous return blocked)`;
    if (this.volume < 3.4) return 'Haemorrhagic shock (exsanguination)';
    if (Math.max(this.collapse.L, this.collapse.R) > 0.8) return 'Hypoxic cardiac arrest (collapsed lung)';
    return 'Cardiogenic shock';
  }

  startArrest(rhythm, cause) {
    this.arrest = { rhythm, cause, t: 0 };
    this.log(`CARDIAC ARREST (${rhythm}): ${cause}`, 'dead');
  }

  get rhythm() {
    if (this.arrest) return this.arrest.rhythm;
    if (this.damage > 0.4 && this.beat % (this.damage > 0.75 ? 2 : 5) === 0) return 'PVC';
    return 'sinus';
  }

  // 0..1 ventricular contraction for the heart morph target
  get systole() {
    if (this.arrest) return this.arrest.rhythm === 'VF' ? 0.12 + 0.08 * Math.sin(this.time * 37) * Math.sin(this.time * 23) : 0;
    const p = this.cardiacPhase;
    if (p < 0.12 || p > 0.46) return 0;
    const x = (p - 0.12) / 0.34;
    return Math.pow(Math.sin(Math.PI * x), 0.8) * (1 - 0.35 * this.ischemia - 0.3 * this.damage) * (0.4 + 0.6 * Math.min(1, this.output * 1.4));
  }

  // 0..1 inspiration (40% inhaling, 60% exhaling); shallow when distressed, none in arrest
  get inhale() {
    const p = this.respPhase;
    const v = p < 0.4 ? 0.5 - 0.5 * Math.cos(Math.PI * p / 0.4) : 0.5 + 0.5 * Math.cos(Math.PI * (p - 0.4) / 0.6);
    return v * (this.arrest ? 0 : 1 - 0.35 * clamp((this.rr - 14) / 16, 0, 1));
  }

  // ECG sample: t = absolute time (s), p = cardiac phase
  ecgSample(t, p, beat) {
    const r = this.arrest ? this.arrest.rhythm : (this.damage > 0.4 && beat % (this.damage > 0.75 ? 2 : 5) === 0 ? 'PVC' : 'sinus');
    if (r === 'VF') return 0.35 * Math.sin(2 * Math.PI * 5.3 * t) + 0.22 * Math.sin(2 * Math.PI * 7.7 * t + 1.3) + 0.12 * Math.sin(2 * Math.PI * 3.1 * t + 0.4);
    if (r === 'asystole') return 0.015 * Math.sin(2 * Math.PI * 0.7 * t);
    if (r === 'PVC') return -0.9 * gauss(p, 0.13, 0.03) + 0.55 * gauss(p, 0.2, 0.04) - 0.3 * gauss(p, 0.38, 0.06);
    let v = 0.12 * gauss(p, 0.04, 0.018) - 0.12 * gauss(p, 0.095, 0.007) + 1.0 * gauss(p, 0.11, 0.008)
      - 0.25 * gauss(p, 0.125, 0.008) + 0.28 * gauss(p, 0.30, 0.035);
    if (this.ischemia > 0.01) {
      const st = 1 / (1 + Math.exp(-(p - 0.135) * 120)) * (1 / (1 + Math.exp((p - 0.33) * 60)));
      v += 0.32 * this.ischemia * st;
    }
    if (r === 'PEA') v *= 0.8;
    return v;
  }
  ecgAt(p) { return this.ecgSample(this.time, p, this.beat); }
}
