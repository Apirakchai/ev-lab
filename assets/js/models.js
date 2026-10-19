// EV Lab — physical & empirical battery models (DOM-free, testable in Node)
// Sources: see sources.html. Aging equations are ports of NREL BLAST-Lite v1.1.1 (BSD-3).

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R_GAS = 8.314;
export const K = (c) => c + 273.15;

// ---------- monotone cubic interpolation (Fritsch–Carlson) ----------
export function monotone(xs, ys) {
  const n = xs.length, d = new Array(n - 1), m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
export function piecewise(pts) { // [[x,y],…] linear
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    return pts[pts.length - 1][1];
  };
}

// ---------- graphite anode potential vs Li/Li+ (Safari & Delacourt 2011, as in BLAST-Lite) ----------
export function Ua(soc) {
  const Xa = 0.0085 + soc * (0.78 - 0.0085);
  return 0.6379 + 0.5416 * Math.exp(-305.5309 * Xa) + 0.044 * Math.tanh(-(Xa - 0.1958) / 0.1088)
    - 0.1978 * Math.tanh((Xa - 1.0571) / 0.0854) - 0.6875 * Math.tanh((Xa + 0.0117) / 0.0529) - 0.0175 * Math.tanh((Xa - 0.5692) / 0.0875);
}

// ---------- chemistries (typical values; ranges in chemistry.html) ----------
const S15 = [0, .02, .05, .1, .15, .2, .3, .4, .5, .6, .7, .8, .9, .95, 1];
export const CHEM = {
  lfp: { color: '#2fd0b0', th: 'LFP (ลิเทียมไอรอนฟอสเฟต)', en: 'LFP (lithium iron phosphate)', short: 'LFP', vmax: 3.65, vmin: 2.5, vnom: 3.2, anode: 'graphite',
    ocv: monotone([0, .02, .05, .1, .15, .2, .3, .4, .5, .6, .7, .8, .9, .95, .98, 1], [2.85, 3.05, 3.17, 3.22, 3.245, 3.26, 3.285, 3.292, 3.296, 3.302, 3.318, 3.33, 3.335, 3.345, 3.38, 3.45]),
    wh: [160, 205], cycles: [3000, 8000], cost: 1, safety: 5, cold: 2, fast: 3 },
  nmc: { color: '#9b8cff', th: 'NMC (นิกเกิล-แมงกานีส-โคบอลต์)', en: 'NMC (nickel manganese cobalt)', short: 'NMC', vmax: 4.2, vmin: 2.8, vnom: 3.65, anode: 'graphite',
    ocv: monotone(S15, [3.0, 3.3, 3.44, 3.52, 3.56, 3.59, 3.65, 3.71, 3.78, 3.86, 3.94, 4.02, 4.10, 4.14, 4.18]),
    wh: [230, 300], cycles: [1500, 3000], cost: 3, safety: 3, cold: 4, fast: 4 },
  nca: { color: '#4ea2ff', th: 'NCA (นิกเกิล-โคบอลต์-อะลูมิเนียม)', en: 'NCA (nickel cobalt aluminium)', short: 'NCA', vmax: 4.2, vmin: 2.7, vnom: 3.6, anode: 'graphite',
    ocv: monotone(S15, [3.0, 3.28, 3.42, 3.50, 3.55, 3.59, 3.66, 3.73, 3.80, 3.88, 3.96, 4.04, 4.11, 4.15, 4.19]),
    wh: [240, 300], cycles: [1000, 2500], cost: 3, safety: 2, cold: 4, fast: 4 },
  lmfp: { color: '#a3d95b', th: 'LMFP (ลิเทียมแมงกานีสไอรอนฟอสเฟต)', en: 'LMFP (lithium manganese iron phosphate)', short: 'LMFP', vmax: 4.25, vmin: 2.5, vnom: 3.7, anode: 'graphite',
    ocv: monotone([0, .03, .1, .2, .3, .38, .42, .5, .6, .7, .8, .9, 1], [2.8, 3.15, 3.30, 3.34, 3.37, 3.42, 3.80, 3.93, 3.96, 3.98, 4.0, 4.03, 4.12]),
    wh: [190, 240], cycles: [2000, 4000], cost: 1.5, safety: 4, cold: 2.5, fast: 3 },
  na: { color: '#f5c518', th: 'โซเดียมไอออน (Na-ion)', en: 'Sodium-ion (Na-ion)', short: 'Na-ion', vmax: 4.0, vmin: 1.5, vnom: 3.1, anode: 'hard carbon',
    ocv: monotone([0, .05, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1], [1.9, 2.55, 2.75, 2.92, 3.02, 3.10, 3.17, 3.25, 3.33, 3.45, 3.62, 3.90]),
    wh: [140, 175], cycles: [2000, 5000], cost: 1, safety: 5, cold: 5, fast: 4 },
  lto: { color: '#b9c4cf', th: 'LTO (ลิเทียมไททาเนต ขั้วลบ)', en: 'LTO (lithium titanate anode)', short: 'LTO', vmax: 2.8, vmin: 1.5, vnom: 2.3, anode: 'LTO',
    ocv: monotone([0, .05, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1], [1.7, 2.05, 2.15, 2.22, 2.27, 2.31, 2.35, 2.39, 2.44, 2.50, 2.58, 2.75]),
    wh: [60, 110], cycles: [10000, 30000], cost: 5, safety: 5, cold: 5, fast: 5 },
};
// cathode potential vs Li/Li+ (graphite-anode cells): Uc = Vcell + Ua
export const Uc = (chem, soc) => CHEM[chem].ocv(soc) + (CHEM[chem].anode === 'graphite' ? Ua(soc) : 0);

// ---------- cell resistance (normalised, R(50%,25°C)=1) ----------
export function rRel(soc, tC, Ea = 30000) {
  const fs = 1 + 2.5 * Math.exp(-soc / 0.08) + 0.5 * Math.exp(-soc / 0.3) + 0.12 * Math.max(0, soc - 0.85) / 0.15;
  const ft = Math.exp((Ea / R_GAS) * (1 / K(tC) - 1 / 298.15));
  return fs * ft;
}

// ---------- Arrhenius factor relative to 25 °C ----------
export const arrh = (tC, Ea) => Math.exp(-(Ea / R_GAS) * (1 / K(tC) - 1 / 298.15));

// =====================================================================
// AGING (NREL BLAST-Lite ports). Output: fractional capacity loss.
// =====================================================================
// state update for y = k x^p   (dy/dx = k p (y/k)^((p-1)/p))
function powerStep(y0, dx, k, p) {
  if (dx <= 0 || k <= 0) return 0;
  if (y0 <= 0) return k * Math.pow(dx, p);
  return k * p * Math.pow(y0 / k, (p - 1) / p) * dx;
}
function sqrtStep(y0, dx, k) { return powerStep(y0, dx, k, 0.5); }

export const AGING = {
  // Panasonic NCR18650B (NCA/graphite). Calendar fit to Keil et al. 2016; cycling to Preger et al. 2020.
  nca: {
    th: 'NCA (เซลล์ Panasonic 18650B)', en: 'NCA (Panasonic 18650B cell)', color: '#4ea2ff',
    kcal: (soc, T) => 75.4 * Math.exp(-3340 / T) * Math.exp((353 * soc) / T), pcal: 0.512,
    kcyc: (dod, cr, T) => (1.86e-6 + 4.74e-11 * cr + 1.77e-4 * dod) * (Math.exp(3.34e-11 / T) + Math.exp(-2.81e-9 / T)), pcyc: 0.699,
    validT: [15, 35],
  },
  // Large prismatic LFP/graphite >250 Ah (Gasper et al. 2023).
  lfp: {
    th: 'LFP (เซลล์ปริซึม 250 Ah)', en: 'LFP (250 Ah prismatic cell)', color: '#2fd0b0',
    kcal: (soc, T) => 8.37e4 * Math.exp(-5210 / T) * Math.exp((-3560 * Ua(soc)) / T), pcal: 0.526,
    kcyc: (dod, cr, T) => (4.38e-8 + 1.55e-8 * dod + 1.68e-7 * cr) * (Math.exp(2190 / T) + Math.exp(-1.55e5 / T)), pcyc: 0.828,
    validT: [10, 45],
  },
  // DENSO 50 Ah NMC622/graphite automotive cell (Smith et al. 2021). Square-root kinetics.
  nmc: {
    th: 'NMC622 (เซลล์รถยนต์ 50 Ah)', en: 'NMC622 (50 Ah automotive cell)', color: '#9b8cff',
    b1t: (soc, T) => arrh(T - 273.15, 37000) * (-0.000197 + 0.0101 * soc - 0.0157 * soc * soc + 0.00835 * soc ** 3 - 4.06e-6 * soc * T + 3.32e-5 * Math.max(0, T - 328.15)),
    b1N: (soc, dod, cchg, T) => Math.max(0, 3.24 * arrh(T - 273.15, -58000) * Math.sqrt(dod * cchg) * (1 + 2.1 * soc) - 0.099) + 1.44 * arrh(T - 273.15, -13000) * dod ** 6,
    validT: [10, 60],
  },
};

// hourly SOC profile for one day.  timing: 'arrive' (charge on arrival) | 'depart' (finish just before leaving)
export function dayProfile({ hi = 0.9, lo = 0.4, timing = 'arrive', chargeHours = 4 }) {
  const soc = new Array(24);
  const leave = 7, arrive = 18, drive = (hi - lo);
  for (let h = 0; h < 24; h++) {
    let s;
    if (h >= leave && h < arrive) {
      // away from home: morning drive uses 60 % of the day's energy, evening drive the rest
      s = h < arrive - 1 ? hi - drive * 0.6 : lo;
    } else if (timing === 'arrive') {
      // plug in on arrival: charging runs straight away, then the car waits full all night
      const since = (h - arrive + 24) % 24;
      s = since < chargeHours ? lo + (hi - lo) * Math.min(1, (since + 1) / chargeHours) : hi;
    } else {
      // scheduled departure: car waits low all night, charging ends just before leaving
      const until = (leave - h + 24) % 24;
      s = until <= chargeHours ? hi - (hi - lo) * ((until - 1) / chargeHours) : lo;
    }
    soc[h] = clamp(s, 0, 1);
  }
  return soc;
}

// life simulation with piecewise-constant daily conditions.
// opts: chem, years, profile (24 hourly SOC), tempC (battery mean temp), efcPerDay, cchg (charge C-rate), stepDays
export function simulateLife({ chem = 'nca', years = 10, profile, tempC = 30, efcPerDay = 0.5, cchg = 0.3, crate = 0.3, stepDays = 7 }) {
  const m = AGING[chem], T = K(tempC);
  const soc = profile || new Array(24).fill(0.5);
  const dod = Math.max(...soc) - Math.min(...soc);
  const socMean = soc.reduce((a, b) => a + b, 0) / soc.length;
  let qt = 0, qc = 0, efc = 0;
  const out = { t: [0], q: [1], qcal: [0], qcyc: [0] };
  const steps = Math.round((years * 365) / stepDays);
  let kcal, kcyc;
  if (chem === 'nmc') {
    kcal = m.b1t(socMean, T);
    kcyc = kcal * m.b1N(socMean, Math.max(dod, 0.01), cchg, T) * 0.985;
  } else {
    kcal = soc.reduce((a, s) => a + m.kcal(s, T), 0) / soc.length; // time-average of the rate (as BLAST does)
    kcyc = m.kcyc(Math.max(dod, 0.01), crate, T);
  }
  for (let i = 1; i <= steps; i++) {
    const health = 1 - qt - qc;
    const dEfc = efcPerDay * stepDays * health;
    if (chem === 'nmc') { qt += sqrtStep(qt, stepDays, kcal); qc += sqrtStep(qc, dEfc, kcyc); }
    else { qt += powerStep(qt, stepDays, kcal, m.pcal); qc += powerStep(qc, dEfc, kcyc, m.pcyc); }
    efc += dEfc;
    if (i % Math.max(1, Math.round(30 / stepDays)) === 0 || i === steps) {
      out.t.push((i * stepDays) / 365); out.q.push(1 - qt - qc); out.qcal.push(qt); out.qcyc.push(qc);
    }
  }
  out.efc = efc; out.final = 1 - qt - qc; out.dod = dod; out.socMean = socMean;
  return out;
}

// simple storage-only calendar loss after `days` at fixed soc/temp
export function calendarLoss(chem, soc, tempC, days) {
  return simulateLife({ chem, years: days / 365, profile: new Array(24).fill(soc), tempC, efcPerDay: 0, stepDays: Math.max(1, days / 200) }).qcal.at(-1);
}

// =====================================================================
// CHARGING (pack-level, illustrative but physically consistent)
// =====================================================================
export const PACKS = {
  lfp60: { th: 'LFP 60 kWh · 400 V (เช่น Model Y RWD)', en: 'LFP 60 kWh · 400 V (e.g. Model Y RWD)', chem: 'lfp', kwh: 60, ns: 108, rPack: 0.05, mass: 380,
    map: [[0, 2.5], [0.1, 2.8], [0.2, 2.75], [0.3, 2.45], [0.4, 2.1], [0.5, 1.8], [0.6, 1.5], [0.7, 1.2], [0.8, 0.85], [0.9, 0.45], [0.95, 0.25], [1, 0.08]] },
  nca75: { th: 'NCA/NMC 75 kWh · 400 V (เช่น Model 3/Y Long Range)', en: 'NCA/NMC 75 kWh · 400 V (e.g. Model 3/Y Long Range)', chem: 'nca', kwh: 75, ns: 96, rPack: 0.042, mass: 480,
    map: [[0, 3.0], [0.1, 3.25], [0.2, 3.0], [0.3, 2.4], [0.4, 1.9], [0.5, 1.55], [0.6, 1.25], [0.7, 1.0], [0.8, 0.7], [0.9, 0.38], [0.95, 0.22], [1, 0.07]] },
  nmc77: { th: 'NMC 77 kWh · 800 V (เช่น Ioniq 5, EV6)', en: 'NMC 77 kWh · 800 V (e.g. Ioniq 5, EV6)', chem: 'nmc', kwh: 77.4, ns: 192, rPack: 0.13, mass: 480,
    map: [[0, 2.75], [0.1, 2.85], [0.3, 2.85], [0.4, 2.75], [0.5, 2.55], [0.6, 2.2], [0.7, 1.95], [0.78, 1.8], [0.8, 1.0], [0.85, 0.6], [0.9, 0.42], [0.95, 0.22], [1, 0.07]] },
  blade82: { th: 'LFP Blade 82 kWh · 550 V (เช่น BYD Seal)', en: 'LFP Blade 82 kWh · 550 V (e.g. BYD Seal)', chem: 'lfp', kwh: 82.5, ns: 172, rPack: 0.075, mass: 520,
    map: [[0, 1.6], [0.1, 1.85], [0.2, 1.85], [0.3, 1.8], [0.4, 1.65], [0.5, 1.45], [0.6, 1.25], [0.7, 1.0], [0.8, 0.7], [0.9, 0.36], [0.95, 0.2], [1, 0.07]] },
  mw1000: { th: 'LFP 1000 V ชาร์จ 1 MW (แนวคิดแบบ BYD Super e-Platform)', en: 'LFP 1000 V, 1 MW flash charging (BYD Super e-Platform idea)', chem: 'lfp', kwh: 100, ns: 300, rPack: 0.09, mass: 600,
    map: [[0, 8.5], [0.1, 10], [0.25, 10], [0.4, 8.5], [0.5, 7], [0.6, 5.5], [0.7, 4], [0.8, 2.6], [0.9, 1.2], [0.95, 0.5], [1, 0.1]] },
};
export const CHARGERS = {
  ac7: { th: 'AC 7.4 kW (วอลล์บ็อกซ์บ้าน 1 เฟส)', en: 'AC 7.4 kW (home wallbox, 1-phase)', ac: true, kw: 7.4, eff: 0.92 },
  ac11: { th: 'AC 11 kW (3 เฟส)', en: 'AC 11 kW (3-phase)', ac: true, kw: 11, eff: 0.935 },
  dc30: { th: 'DC 30 kW (ตู้ DC ติดผนัง)', en: 'DC 30 kW (wall-mounted DC)', kw: 30, imax: 100, vmax: 1000 },
  dc50: { th: 'DC 50 kW', en: 'DC 50 kW', kw: 50, imax: 125, vmax: 500 },
  dc120: { th: 'DC 120 kW', en: 'DC 120 kW', kw: 120, imax: 250, vmax: 1000 },
  dc180: { th: 'DC 180 kW', en: 'DC 180 kW', kw: 180, imax: 400, vmax: 1000 },
  sc250: { th: 'DC 250 kW (แบบ Supercharger V3, 500 V)', en: 'DC 250 kW (Supercharger V3 type, 500 V)', kw: 250, imax: 631, vmax: 500 },
  hpc350: { th: 'DC 350 kW (HPC 920 V / 500 A)', en: 'DC 350 kW (HPC, 920 V / 500 A)', kw: 350, imax: 500, vmax: 920 },
  mw1000: { th: 'DC 1,000 kW (1000 V / 1000 A)', en: 'DC 1,000 kW (1000 V / 1000 A)', kw: 1000, imax: 1000, vmax: 1000 },
};
// temperature factor of the BMS current map (cold → plating risk; very hot → thermal protection)
export const tempFactor = piecewise([[-10, 0.08], [0, 0.18], [5, 0.3], [10, 0.45], [15, 0.65], [20, 0.85], [25, 0.97], [30, 1], [45, 1], [50, 0.75], [55, 0.35], [60, 0.05]]);

export const LIMIT = {
  charger: { th: 'กำลังสูงสุดของตู้ชาร์จ', en: 'Charger power limit', color: '#4ea2ff' },
  current: { th: 'กระแสสูงสุดของตู้/สายชาร์จ', en: 'Charger / cable current limit', color: '#9b8cff' },
  bms: { th: 'BMS จำกัดกระแส (กันลิเทียมเพลตติ้ง)', en: 'BMS current map (prevents lithium plating)', color: '#2fd0b0' },
  cv: { th: 'แรงดันชนเพดาน (ช่วง CV)', en: 'Voltage ceiling reached (CV phase)', color: '#ffbf3c' },
  temp: { th: 'ร้อนเกิน ลดกำลังป้องกันแบต', en: 'Too hot: thermal derating', color: '#ff5b4f' },
  ac: { th: 'ชาร์จ AC: จำกัดโดยออนบอร์ดชาร์จเจอร์', en: 'AC: limited by the on-board charger', color: '#b9c4cf' },
  boost: { th: 'แรงดันตู้ต่ำกว่าแบต ต้องใช้วงจรเพิ่มแรงดัน', en: 'Charger voltage below pack: booster mode', color: '#ff9b2f' },
};

export function simulateCharge({ pack = 'nca75', charger = 'sc250', soc0 = 0.1, soc1 = 0.8, tempC = 30, ambient = 32, cooling = true, dt = 4 }) {
  const P = PACKS[pack], ch = CHARGERS[charger], chem = CHEM[P.chem];
  const ah = (P.kwh * 1000) / (P.ns * chem.vnom);
  const cth = P.mass * 1000; // J/K (≈1 kJ/kg·K)
  let s = soc0, T = tempC, t = 0, e = 0;
  const out = { t: [], soc: [], p: [], i: [], v: [], T: [], lim: [], c: [] };
  let guard = 0;
  while (s < soc1 - 1e-4 && guard++ < 200000) {
    const ocvPack = chem.ocv(s) * P.ns;
    const r = P.rPack * rRel(s, T) / rRel(0.5, 25);
    let I, lim;
    if (ch.ac) {
      const pBat = ch.kw * 1000 * ch.eff;
      I = pBat / (ocvPack + 5); lim = 'ac';
      const icv = (chem.vmax * P.ns - ocvPack) / r;
      if (icv < I) { I = Math.max(0, icv); lim = 'cv'; }
    } else {
      const cands = [];
      const boost = ocvPack > ch.vmax;
      if (boost) cands.push([(-ocvPack + Math.sqrt(ocvPack * ocvPack + 4 * r * 50000)) / (2 * r), 'boost']);
      else {
        cands.push([(-ocvPack + Math.sqrt(ocvPack * ocvPack + 4 * r * ch.kw * 1000)) / (2 * r), 'charger']);
        cands.push([ch.imax, 'current']);
      }
      const tf = tempFactor(T);
      const bms = piecewise(P.map)(s) * ah * Math.min(1, tf / 0.97);
      cands.push([bms, T > 47 ? 'temp' : 'bms']);
      cands.push([Math.max(0, (chem.vmax * P.ns - ocvPack) / r), 'cv']);
      [I, lim] = cands.reduce((a, b) => (b[0] < a[0] ? b : a));
    }
    I = Math.max(I, 0.2);
    const v = ocvPack + I * r;
    const pw = v * I;
    // thermal: Joule heat in, chiller out
    const heat = I * I * r;
    const cool = cooling ? Math.min(6500, Math.max(0, (T - 30) * 600)) : 0;
    T += ((heat - cool + (ambient - T) * 25) * dt) / cth;
    const ds = (I * dt) / 3600 / ah;
    s = Math.min(soc1, s + ds); t += dt; e += pw * dt / 3.6e6;
    if (out.t.length === 0 || guard % 3 === 0 || s >= soc1 - 1e-4) {
      out.t.push(t / 60); out.soc.push(s); out.p.push(pw / 1000); out.i.push(I); out.v.push(v); out.T.push(T); out.lim.push(lim); out.c.push(I / ah);
    }
  }
  out.minutes = t / 60; out.kwh = e; out.ah = ah; out.peak = Math.max(...out.p); out.tMax = Math.max(...out.T);
  return out;
}

// =====================================================================
// DRIVING ENERGY (road-load physics)
// =====================================================================
export function whPerKm({ v = 90, mass = 2000, cda = 0.55, crr = 0.009, eta = 0.88, aux = 1.2, rho = 1.17, grade = 0 }) {
  const ms = v / 3.6, g = 9.81;
  const fAero = 0.5 * rho * cda * ms * ms, fRoll = crr * mass * g, fGrade = mass * g * grade;
  const pWheel = (fAero + fRoll + fGrade) * ms;
  const pBat = pWheel / eta + aux * 1000;
  return { whkm: pBat / ms / 3.6, aero: fAero * ms / eta / ms / 3.6, roll: fRoll * ms / eta / ms / 3.6, auxWh: aux * 1000 / ms / 3.6, pBat };
}
