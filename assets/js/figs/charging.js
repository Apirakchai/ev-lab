// Chapter 5 figures
import { scaffold, slider, select, chips, readouts, legend, C, T, fmt, fmtDur, clamp, lerp, rr, text, glowDot, scale, axes, line, area, tip, nearestIdx, withAlpha, el, bi } from '../lib.js';
import { CHEM, Ua, PACKS, CHARGERS, LIMIT, simulateCharge } from '../models.js';

const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

// ---------------------------------------------------------------- full simulator
export function sim(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8.2, ratioM: 0.82, minH: 340, maxH: 560 });
  const s = { pack: 'nca75', charger: 'sc250', soc0: 10, soc1: 100, temp: 30, price: 7.5, view: 'soc' };
  const box = ctrls();
  select(box, { label: { th: 'แพ็กแบต (ตัวอย่าง)', en: 'Battery pack (example)' }, options: Object.entries(PACKS).map(([v, o]) => ({ v, label: o })), value: s.pack, onChange: (v) => { s.pack = v; run(); } });
  select(box, { label: { th: 'ตู้ชาร์จ', en: 'Charger' }, options: Object.entries(CHARGERS).map(([v, o]) => ({ v, label: o })), value: s.charger, onChange: (v) => { s.charger = v; run(); } });
  slider(box, { label: { th: 'เริ่มชาร์จที่', en: 'Start at' }, min: 0, max: 90, step: 1, value: s.soc0, fmt: (v) => `${v}%`, color: C.bad, onInput: (v) => { s.soc0 = v; run(); } });
  slider(box, { label: { th: 'ชาร์จถึง', en: 'Charge to' }, min: 20, max: 100, step: 1, value: s.soc1, fmt: (v) => `${v}%`, color: C.ok, onInput: (v) => { s.soc1 = v; run(); } });
  slider(box, { label: { th: 'อุณหภูมิแบตตอนเริ่ม', en: 'Battery temperature at start' }, min: 0, max: 45, step: 1, value: s.temp, fmt: (v) => `${v}°C`, color: C.heat, onInput: (v) => { s.temp = v; run(); } });
  slider(box, { label: { th: 'ราคาค่าชาร์จ', en: 'Price per kWh' }, min: 2, max: 10, step: 0.1, value: s.price, fmt: (v) => `${fmt(v, 2)} ฿/kWh`, color: C.violet, onInput: (v) => { s.price = v; stage.request(); } });
  chips(box, { label: { th: 'แกนนอน', en: 'X axis' }, options: [{ v: 'soc', label: { th: '% แบต', en: 'Charge %' } }, { v: 'time', label: { th: 'เวลา', en: 'Time' } }], value: 'soc', onChange: (v) => { s.view = v; stage.request(); } });
  const ro = readouts(inst, [
    { key: 'time', label: { th: 'เวลาที่ใช้', en: 'Time taken' } },
    { key: 't1', label: { th: '10→80%', en: '10→80%' } },
    { key: 't2', label: { th: '80→100%', en: '80→100%' } },
    { key: 'kwh', label: { th: 'พลังงานเข้าแบต', en: 'Energy in' } },
    { key: 'cost', label: { th: 'ค่าชาร์จ', en: 'Cost' } },
    { key: 'peak', label: { th: 'กำลังสูงสุด', en: 'Peak power' } },
    { key: 'tmax', label: { th: 'อุณหภูมิแบตสูงสุด', en: 'Max battery temp' } },
  ]);
  const lg = el('div', 'legend'); inst.insertBefore(lg, inst.querySelector('.ctrls'));
  let R = null, r1 = null, r2 = null;
  function run() {
    const a = Math.min(s.soc0, s.soc1 - 1) / 100, b = s.soc1 / 100;
    R = simulateCharge({ pack: s.pack, charger: s.charger, soc0: a, soc1: b, tempC: s.temp });
    r1 = simulateCharge({ pack: s.pack, charger: s.charger, soc0: 0.1, soc1: 0.8, tempC: s.temp });
    r2 = simulateCharge({ pack: s.pack, charger: s.charger, soc0: 0.8, soc1: 1.0, tempC: s.temp });
    const used = [...new Set(R.lim)];
    lg.innerHTML = used.map((k) => `<span><i style="--k:${LIMIT[k].color}"></i>${bi(LIMIT[k])}</span>`).join('');
    stage.request();
  }
  run();
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const bx = { x: m ? 44 : 64, y: 66, w: W - (m ? 60 : 100), h: H - 112 };
    const ch = CHARGERS[s.charger];
    const pmax = Math.max(ch.kw * 1.05, R.peak * 1.15, 20);
    const xs = s.view === 'soc' ? R.soc.map((v) => v * 100) : R.t;
    const sx = s.view === 'soc' ? scale(0, 100, bx.x, bx.x + bx.w) : scale(0, Math.max(5, R.minutes * 1.04), bx.x, bx.x + bx.w);
    const sy = scale(0, pmax, bx.y + bx.h, bx.y);
    if (s.view === 'soc') { c.fillStyle = 'rgba(255,191,60,.06)'; c.fillRect(sx(80), bx.y, sx(100) - sx(80), bx.h); text(c, T({ th: '20% สุดท้าย', en: 'last 20%' }), sx(90), bx.y + 14, { size: 11, color: C.warn, align: 'center' }); }
    axes(c, bx, sx, sy, { xl: s.view === 'soc' ? { th: '% แบต', en: 'charge %' } : { th: 'นาที', en: 'minutes' }, yl: { th: 'กำลังชาร์จ (kW)', en: 'charging power (kW)' } });
    // charger ceiling
    c.strokeStyle = 'rgba(78,162,255,.35)'; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(bx.x, sy(ch.kw)); c.lineTo(bx.x + bx.w, sy(ch.kw)); c.stroke(); c.setLineDash([]);
    text(c, `${T(ch)}`, bx.x + bx.w - 4, sy(ch.kw) - 6, { size: 11, color: 'rgba(78,162,255,.9)', align: 'right' });
    // area + coloured segments
    area(c, xs.map((x, i) => [sx(x), sy(R.p[i])]), sy(0), 'rgba(160,188,214,.07)');
    for (let i = 1; i < xs.length; i++) {
      c.strokeStyle = LIMIT[R.lim[i]].color; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx(xs[i - 1]), sy(R.p[i - 1])); c.lineTo(sx(xs[i]), sy(R.p[i])); c.stroke();
    }
    // hover
    const p = stage.pointer;
    if (p.inside && p.x > bx.x && p.x < bx.x + bx.w) {
      const i = nearestIdx(xs, sx.inv(p.x));
      c.strokeStyle = 'rgba(231,237,243,.35)'; c.beginPath(); c.moveTo(sx(xs[i]), bx.y); c.lineTo(sx(xs[i]), bx.y + bx.h); c.stroke();
      glowDot(c, sx(xs[i]), sy(R.p[i]), 5, LIMIT[R.lim[i]].color);
      tip(c, p.x, p.y, [{ t: `${fmt(R.soc[i] * 100)}% · ${fmtDur(R.t[i])}`, b: true }, `${fmt(R.p[i])} kW · ${fmt(R.i[i])} A · ${fmt(R.v[i])} V`, `${fmt(R.c[i], 2)}C · ${fmt(R.T[i], 1)}°C`, { t: T(LIMIT[R.lim[i]]), k: LIMIT[R.lim[i]].color }], W, H);
    }
    ro.set('time', fmtDur(R.minutes));
    ro.set('t1', fmtDur(r1.minutes));
    ro.set('t2', fmtDur(r2.minutes), r2.minutes > r1.minutes * 0.6 ? 'warn' : '');
    ro.set('kwh', `${fmt(R.kwh, 1)}<small>kWh</small>`);
    ro.set('cost', `${fmt(R.kwh * s.price)}<small>฿</small>`);
    ro.set('peak', `${fmt(R.peak)}<small>kW</small>`);
    ro.set('tmax', `${fmt(R.tMax, 1)}<small>°C</small>`, R.tMax > 45 ? 'warn' : '');
  });
  stage.onPointer = () => stage.request();
}

// ---------------------------------------------------------------- CC-CV single cell
export function cccv(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8.6, ratioM: 0.8, minH: 340, maxH: 520 });
  const s = { c: 1 };
  slider(ctrls(), { label: { th: 'กระแสช่วง CC', en: 'CC-stage current' }, min: 0.3, max: 3, step: 0.1, value: 1, fmt: (v) => `${fmt(v, 1)}C`, color: C.e, onInput: (v) => { s.c = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'cv', label: { th: 'เริ่ม CV ที่', en: 'CV starts at' } }, { key: 't80', label: { th: 'เวลา 0→80%', en: 'Time 0→80%' } }, { key: 't100', label: { th: 'เวลา 80→~100%', en: 'Time 80→~100%' } }]);
  const AH = 5, R = 0.03, VMAX = 4.2;
  function simulate() {
    let soc = 0, t = 0, cvSoc = null, t80 = null; const out = { t: [], v: [], i: [], soc: [] };
    for (let k = 0; k < 40000; k++) {
      const voc = CHEM.nmc.ocv(soc); let I = s.c * AH;
      if (voc + I * R > VMAX) { I = Math.max(0, (VMAX - voc) / R); if (cvSoc === null) cvSoc = soc; }
      const dt = 10; soc = Math.min(1, soc + (I * dt) / 3600 / AH); t += dt;
      if (t80 === null && soc >= 0.8) t80 = t;
      if (k % 6 === 0) { out.t.push(t / 60); out.v.push(Math.min(VMAX, voc + I * R)); out.i.push(I / AH); out.soc.push(soc); }
      if (I < 0.05 * AH || soc >= 0.999) break;
    }
    out.cvSoc = cvSoc; out.t80 = (t80 || t) / 60; out.tend = t / 60; return out;
  }
  stage.draw((c, W, H) => {
    const m = stage.mobile, r = simulate();
    const h = (H - 130) / 2;
    const b1 = { x: m ? 44 : 60, y: 66, w: W - (m ? 60 : 96), h }, b2 = { x: b1.x, y: 66 + h + 50, w: b1.w, h };
    const sx = scale(0, r.tend * 1.02, b1.x, b1.x + b1.w);
    const sy1 = scale(3.0, 4.3, b1.y + b1.h, b1.y), sy2 = scale(0, Math.max(1, s.c * 1.15), b2.y + b2.h, b2.y);
    axes(c, b1, sx, sy1, { yl: { th: 'แรงดันที่ขั้ว (V)', en: 'terminal voltage (V)' }, fx: () => '', ny: 4, fy: (v) => fmt(v, 1) });
    axes(c, b2, sx, sy2, { yl: { th: 'กระแส (C)', en: 'current (C)' }, xl: { th: 'นาที', en: 'minutes' }, ny: 4, fy: (v) => fmt(v, 1) });
    c.strokeStyle = 'rgba(255,91,79,.6)'; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(b1.x, sy1(VMAX)); c.lineTo(b1.x + b1.w, sy1(VMAX)); c.stroke(); c.setLineDash([]);
    text(c, T({ th: 'เพดาน 4.2 V', en: 'ceiling 4.2 V' }), b1.x + b1.w - 4, sy1(VMAX) - 6, { size: 11, color: C.bad, align: 'right' });
    line(c, r.t.map((t, i) => [sx(t), sy1(r.v[i])]), { color: C.violet, width: 2.4 });
    line(c, r.t.map((t, i) => [sx(t), sy2(r.i[i])]), { color: C.e, width: 2.4 });
    // CV boundary
    const iCv = r.soc.findIndex((x) => r.cvSoc !== null && x >= r.cvSoc);
    if (iCv > 0) {
      const x = sx(r.t[iCv]);
      c.fillStyle = 'rgba(255,191,60,.07)'; c.fillRect(x, b1.y, b1.x + b1.w - x, b1.h); c.fillRect(x, b2.y, b2.x + b2.w - x, b2.h);
      text(c, 'CC', (b1.x + x) / 2, b1.y + 16, { size: 12, weight: 700, color: C.ink2, align: 'center' });
      text(c, 'CV', (x + b1.x + b1.w) / 2, b1.y + 16, { size: 12, weight: 700, color: C.warn, align: 'center' });
    }
    ro.set('cv', r.cvSoc === null ? '–' : `${fmt(r.cvSoc * 100)}<small>%</small>`);
    ro.set('t80', fmtDur(r.t80));
    ro.set('t100', fmtDur(r.tend - r.t80), 'warn');
  });
}

// ---------------------------------------------------------------- plating boundary
const UaExt = (x) => (x <= 1 ? Ua(x) : Math.max(-0.05, Ua(1) * (1 - (x - 1) / 0.15)));
export function cmaxPlating(soc, tC, margin = 0.01) {
  const ra = 0.025 * Math.exp((40000 / 8.314) * (1 / (tC + 273.15) - 1 / 298.15));
  const f = (C) => UaExt(soc + 0.12 * C) - C * ra - margin;
  if (f(0.02) < 0) return 0;
  let lo = 0.02, hi = 8; if (f(hi) > 0) return hi;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return lo;
}
export function plating(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8.2, ratioM: 0.85, minH: 330, maxH: 520 });
  const s = { temp: 25, c: 2 };
  const box = ctrls();
  slider(box, { label: { th: 'อุณหภูมิแบต', en: 'Battery temperature' }, min: 0, max: 45, step: 1, value: 25, fmt: (v) => `${v}°C`, color: C.heat, onInput: (v) => { s.temp = v; stage.request(); } });
  slider(box, { label: { th: 'กระแสที่อยากชาร์จ', en: 'Current you want' }, min: 0.3, max: 5, step: 0.1, value: 2, fmt: (v) => `${fmt(v, 1)}C`, color: C.e, onInput: (v) => { s.c = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'lim', label: { th: 'เริ่มเสี่ยงเพลตติ้งเมื่อเกิน', en: 'Plating risk begins above' } }, { key: 'c80', label: { th: 'กระแสปลอดภัยที่ 80%', en: 'Safe current at 80%' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const bx = { x: m ? 44 : 60, y: 66, w: W - (m ? 60 : 100), h: H - 112 };
    const sx = scale(0, 100, bx.x, bx.x + bx.w), sy = scale(0, 5.5, bx.y + bx.h, bx.y);
    const xs = linspace(0.02, 0.99, 120);
    // danger area above the user's temperature curve
    const cur = xs.map((x) => [sx(x * 100), sy(Math.min(5.5, cmaxPlating(x, s.temp)))]);
    c.save(); c.beginPath(); c.moveTo(cur[0][0], bx.y); cur.forEach((p) => c.lineTo(p[0], p[1])); c.lineTo(cur[cur.length - 1][0], bx.y); c.closePath(); c.fillStyle = 'rgba(255,91,79,.13)'; c.fill(); c.restore();
    axes(c, bx, sx, sy, { xl: { th: '% แบต', en: 'charge %' }, yl: { th: 'กระแสสูงสุดที่ปลอดภัย (C)', en: 'max safe current (C)' }, fy: (v) => fmt(v, 0) });
    for (const [tc, col] of [[10, '#4ea2ff'], [25, '#2fd0b0'], [40, '#ff9b2f']]) {
      line(c, xs.map((x) => [sx(x * 100), sy(Math.min(5.5, cmaxPlating(x, tc)))]), { color: col, width: 1.4, alpha: 0.55, dash: [4, 4] });
      const y = sy(Math.min(5.5, cmaxPlating(0.3, tc))); text(c, `${tc}°C`, sx(30), y - 6, { size: 11, color: col });
    }
    line(c, cur, { color: C.ink, width: 2.8 });
    text(c, T({ th: 'เขตลิเทียมเพลตติ้ง', en: 'plating zone' }), sx(80), sy(4.6), { size: 12.5, weight: 700, color: '#ffb3ad', align: 'center' });
    // requested current line
    c.strokeStyle = C.e; c.setLineDash([6, 4]); c.lineWidth = 1.6; c.beginPath(); c.moveTo(bx.x, sy(s.c)); c.lineTo(bx.x + bx.w, sy(s.c)); c.stroke(); c.setLineDash([]);
    let lim = null; for (const x of xs) if (cmaxPlating(x, s.temp) < s.c) { lim = x; break; }
    if (lim !== null) { glowDot(c, sx(lim * 100), sy(s.c), 6, C.bad); }
    ro.set('lim', lim === null ? T({ th: 'ปลอดภัยทั้งช่วง', en: 'safe all the way' }) : `${fmt(lim * 100)}<small>%</small>`, lim !== null && lim < 0.5 ? 'bad' : lim !== null ? 'warn' : 'good');
    ro.set('c80', `${fmt(cmaxPlating(0.8, s.temp), 1)}<small>C</small>`);
  });
}

// ---------------------------------------------------------------- 400 V vs 800 V
export function volt(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 6.4, ratioM: 0.9, minH: 280, maxH: 420 });
  const s = { kw: 200, imax: 500 };
  const box = ctrls();
  slider(box, { label: { th: 'กำลังที่ต้องการ', en: 'Power wanted' }, min: 50, max: 400, step: 10, value: 200, fmt: (v) => `${v} kW`, color: C.e, onInput: (v) => { s.kw = v; stage.request(); } });
  slider(box, { label: { th: 'ขีดจำกัดกระแสของสาย/หัว', en: 'Cable / connector current limit' }, min: 200, max: 1000, step: 50, value: 500, fmt: (v) => `${v} A`, color: C.violet, onInput: (v) => { s.imax = v; stage.request(); } });
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const sys = [{ v: 400, col: '#4ea2ff' }, { v: 800, col: '#9b8cff' }];
    const colW = m ? W - 40 : (W - 120) / 2;
    sys.forEach((S, i) => {
      const x = m ? 20 : 40 + i * (colW + 40), y = m ? 64 + i * ((H - 70) / 2) : 70;
      const Ineed = (s.kw * 1000) / S.v, I = Math.min(Ineed, s.imax), P = (I * S.v) / 1000;
      const rCable = 0.004; const loss = (I * I * rCable) / 1000;
      text(c, `${S.v} V`, x, y + 8, { size: 20, weight: 700, color: S.col, disp: true });
      const rows = [
        [{ th: 'กระแสที่ต้องใช้', en: 'Current needed' }, `${fmt(Ineed)} A`],
        [{ th: 'กำลังที่ได้จริง', en: 'Power delivered' }, `${fmt(P)} kW${Ineed > s.imax ? ' ⚠︎' : ''}`],
        [{ th: 'ความร้อนในสาย (สมมติ 4 mΩ)', en: 'Cable heat (assume 4 mΩ)' }, `${fmt(loss, 2)} kW`],
      ];
      const bw = colW - 10, barY = y + 26;
      rr(c, x, barY, bw, 12, 6); c.fillStyle = 'rgba(160,188,214,.15)'; c.fill();
      rr(c, x, barY, Math.max(10, bw * Math.min(1, Ineed / 1000)), 12, 6); c.fillStyle = Ineed > s.imax ? C.bad : S.col; c.fill();
      const lx = x + bw * (s.imax / 1000); c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, barY - 5); c.lineTo(lx, barY + 17); c.stroke();
      text(c, T({ th: `ขีดจำกัด ${s.imax} A`, en: `limit ${s.imax} A` }), lx, barY + 32, { size: 10.5, color: C.ink2, align: 'center' });
      rows.forEach((r, k) => { const yy = barY + (m ? 54 : 64) + k * (m ? 22 : 28); text(c, T(r[0]), x, yy, { size: 12, color: C.ink2 }); text(c, r[1], x + bw, yy, { size: 13, weight: 700, color: C.ink, align: 'right' }); });
    });
  });
}
