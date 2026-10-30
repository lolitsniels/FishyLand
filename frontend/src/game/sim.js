// Deterministic fight simulation. MUST stay identical to backend/sim.py.
export const DT = 1.0 / 30.0;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function zoneOf(pos, gw) {
  const d = Math.abs(pos - 0.5);
  if (d <= gw) return 0;
  if (d <= gw + 0.1) return 1;
  if (d <= gw + 0.2) return 2;
  return 3;
}

export class FightSim {
  constructor(p) {
    this.p = p;
    this.rng = mulberry32(p.seed);
    this.pos = 0.5; this.vel = 0.0; this.fill = 0.15; this.red = 0.0;
    this.ff = 0.0; this.target = 0.0; this.tf = 0.0; this.zone = 0;
    this.tick = 0; this.outcome = null;
  }

  step(h) {
    if (this.outcome) return this.outcome;
    const p = this.p, s = p.strength, e = p.erratic, tick = this.tick;
    if (tick >= p.limit_ticks) { this.outcome = "timeout"; return this.outcome; }
    if (tick % 6 === 0) {
      this.target = (this.rng() * 2.0 - 1.0) * e + (this.rng() - 0.35) * s * 0.6;
    }
    this.ff = this.ff + (this.target - this.ff) * 0.25;
    let tf = 0.0;
    for (const tr of p.tricks) {
      if (tr.at <= tick && tick < tr.at + tr.dur) {
        const k = tr.kind;
        if (k === "dive") tf = tf + 1.6 * s;
        else if (k === "run") tf = tf - 1.3 * s;
        else if (k === "shake") tf = tf + (tick % 4 < 2 ? 1.4 * s : -1.4 * s);
        else tf = tf + 1.2 * s;
      }
    }
    this.tf = tf;
    const pf = h ? 1.15 : -1.05;
    const acc = (pf + (this.ff + tf) / p.control) * 3.0;
    this.vel = this.vel * 0.86 + acc * DT;
    this.pos = this.pos + this.vel * DT;
    if (this.pos < 0.0) { this.pos = 0.0; this.vel = 0.0; }
    if (this.pos > 1.0) { this.pos = 1.0; this.vel = 0.0; }
    const z = zoneOf(this.pos, p.green_w);
    this.zone = z;
    if (z === 0) this.fill = this.fill + (DT * p.power) / (6.0 + 10.0 * s);
    else if (z === 1) this.fill = this.fill + (DT * 0.35 * p.power) / (6.0 + 10.0 * s);
    else if (z === 2) this.fill = this.fill - DT * 0.1;
    else this.fill = this.fill - DT * 0.15;
    if (this.fill < 0.0) this.fill = 0.0;
    if (z === 3) this.red = this.red + DT;
    else this.red = 0.0;
    this.tick = tick + 1;
    if (this.fill >= 1.0) this.outcome = "landed";
    else if (this.red > 0.6 * p.line) this.outcome = this.pos > 0.5 ? "snapped" : "escaped";
    else if (this.tick >= p.limit_ticks) this.outcome = "timeout";
    return this.outcome;
  }
}
