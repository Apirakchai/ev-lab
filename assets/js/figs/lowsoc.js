// Chapter 4 figures
import { scaffold, slider, chips, readouts, legend, C, T, fmt, clamp, lerp, rr, text, glowDot, scale, axes, line, area, tip, nearestIdx, mix, withAlpha } from '../lib.js';
import { CHEM, rRel, AGING, simulateLife } from '../models.js';

const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

// ---------------------------------------------------------------- resistance / sag / power
export function sag(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8.4, ratioM: 0.8, minH: 340, maxH: 560 });
  const s = { soc: 0.15, kw: 150, temp: 30 };
  const NS = 96, R50 = 0.042, VMIN = 3.0 * NS, PMOTOR = 300;
  const box = ctrls();
  slider(box, { label: { th: '% แบต', en: 'Charge level' }, min: 1, max: 100, step: 1, value: 15, fmt: (v) => `${v}%`, color: C.ok, onInput: (v) => { s.soc = v / 100; stage.request(); } });
  slider(box, { label: { th: 'กำลังที่ขอ (เหยียบคันเร่ง)', en: 'Power demanded (pedal)' }, min: 20, max: 300, step: 5, value: 150, fmt: (v) => `${v} kW`, color: C.e, onInput: (v) => { s.kw = v; stage.request(); } });
  slider(box, { label: { th: 'อุณหภูมิแบต', en: 'Battery temperature' }, min: 0, max: 45, step: 1, value: 30, fmt: (v) => `${v}°C`, color: C.heat, onInput: (v) => { s.temp = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'r', label: { th: 'ความต้านทาน (เทียบที่ 50%, 25°C)', en: 'Resistance (vs 50%, 25 °C)' } }, { key: 'v', label: { th: 'แรงดันขณะเร่ง', en: 'Voltage under load' } }, { key: 'pmax', label: { th: 'กำลังสูงสุดที่จ่ายได้', en: 'Max power available' } }, { key: 'heat', label: { th: 'ความร้อนในแบต', en: 'Heat in the pack' } }]);
  const R = (soc, T) => (R50 * rRel(soc, T)) / rRel(0.5, 25);
  const pmax = (soc, T) => { const voc = NS * CHEM.nmc.ocv(soc); return Math.min(PMOTOR * 1000, (VMIN * (voc - VMIN)) / R(soc, T)) / 1000; };
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const xs = linspace(0.01, 1, 120);
    const left = m ? 44 : 60, right = W - (m ? 16 : 260);
    const h1 = (H - 130) / 2;
    const b1 = { x: left, y: 66, w: right - left, h: h1 }, b2 = { x: left, y: 66 + h1 + 52, w: right - left, h: h1 };
    const sx = scale(0, 100, left, right);
    const rmax = Math.max(4, ...xs.map((x) => rRel(x, s.temp) / rRel(0.5, 25)));
    const sy1 = scale(0, Math.ceil(rmax), b1.y + b1.h, b1.y);
    axes(c, b1, sx, sy1, { yl: { th: 'ความต้านทาน (เท่า)', en: 'resistance (×)' }, ny: 4, fx: () => '' });
    line(c, xs.map((x) => [sx(x * 100), sy1(rRel(x, s.temp) / rRel(0.5, 25))]), { color: C.heat, width: 2.4 });
    const sy2 = scale(0, 320, b2.y + b2.h, b2.y);
    axes(c, b2, sx, sy2, { xl: { th: '% แบต', en: 'charge %' }, yl: { th: 'กำลังสูงสุด (kW)', en: 'max power (kW)' }, ny: 4 });
    area(c, xs.map((x) => [sx(x * 100), sy2(pmax(x, s.temp))]), sy2(0), 'rgba(78,162,255,.12)');
    line(c, xs.map((x) => [sx(x * 100), sy2(pmax(x, s.temp))]), { color: C.e, width: 2.4 });
    c.strokeStyle = 'rgba(231,237,243,.35)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(left, sy2(s.kw)); c.lineTo(right, sy2(s.kw)); c.stroke(); c.setLineDash([]);
    text(c, T({ th: `ที่ขอ ${s.kw} kW`, en: `demand ${s.kw} kW` }), right - 4, sy2(s.kw) - 6, { size: 11, color: C.ink2, align: 'right' });
    // markers
    const x0 = sx(s.soc * 100);
    glowDot(c, x0, sy1(rRel(s.soc, s.temp) / rRel(0.5, 25)), 6, C.heat);
    glowDot(c, x0, sy2(pmax(s.soc, s.temp)), 6, C.e);
    // numbers
    const voc = NS * CHEM.nmc.ocv(s.soc), r = R(s.soc, s.temp), pm = pmax(s.soc, s.temp);
    const p = Math.min(s.kw, pm) * 1000;
    const disc = voc * voc - 4 * r * p;
    const I = disc >= 0 ? (voc - Math.sqrt(disc)) / (2 * r) : voc / (2 * r);
    const vt = voc - I * r, heat = I * I * r / 1000;
    if (!m) {
      const px = W - 230;
      text(c, T({ th: 'ตอนเหยียบคันเร่ง', en: 'Under that pedal' }), px, 86, { size: 12.5, weight: 600, color: C.ink });
      const rows = [
        [{ th: 'แรงดันขณะพัก', en: 'Resting voltage' }, `${fmt(voc)} V`],
        [{ th: 'แรงดันขณะเร่ง', en: 'Under load' }, `${fmt(vt)} V`],
        [{ th: 'แรงดันตก', en: 'Sag' }, `${fmt(voc - vt)} V`],
        [{ th: 'กระแส', en: 'Current' }, `${fmt(I)} A`],
        [{ th: 'ความร้อนในแบต', en: 'Heat in pack' }, `${fmt(heat, 1)} kW`],
        [{ th: 'สูญเสียเป็นความร้อน', en: 'Lost as heat' }, `${fmt((heat / (p / 1000 + heat)) * 100, 1)}%`],
      ];
      rows.forEach((rw, i) => { text(c, T(rw[0]), px, 116 + i * 30, { size: 12, color: C.ink2 }); text(c, rw[1], W - 24, 116 + i * 30, { size: 13, weight: 700, color: C.ink, align: 'right' }); });
      if (pm < s.kw) { rr(c, px - 8, 116 + 6 * 30 - 4, 214, 50, 10); c.fillStyle = 'rgba(255,191,60,.12)'; c.fill(); text(c, T({ th: 'รถจำกัดกำลังไว้ที่', en: 'Car caps power at' }), px, 116 + 6 * 30 + 16, { size: 12, color: C.warn }); text(c, `${fmt(pm)} kW`, px, 116 + 6 * 30 + 36, { size: 16, weight: 700, color: C.warn, disp: true }); }
    }
    ro.set('r', `×${fmt(r / R50, 1)}`, r / R50 > 2 ? 'warn' : '');
    ro.set('v', `${fmt(vt)}<small>V</small>`);
    ro.set('pmax', `${fmt(pm)}<small>kW</small>`, pm < s.kw ? 'warn' : '');
    ro.set('heat', `${fmt(heat, 1)}<small>kW</small>`, heat > 8 ? 'warn' : '');
  });
}

// ---------------------------------------------------------------- DoD windows
export function dod(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8, ratioM: 0.85, minH: 320, maxH: 520 });
  const s = { lo: 20, hi: 80, km: 50, chem: 'nmc', kwh: 75 };
  const box = ctrls();
  const sLo = slider(box, { label: { th: 'ชาร์จเมื่อเหลือ (ต่ำสุด)', en: 'Recharge at (low end)' }, min: 0, max: 60, step: 5, value: 20, fmt: (v) => `${v}%`, color: C.bad, onInput: (v) => { s.lo = Math.min(v, s.hi - 10); if (s.lo !== v) sLo.set(s.lo); stage.request(); } });
  const sHi = slider(box, { label: { th: 'ชาร์จถึง (สูงสุด)', en: 'Charge to (high end)' }, min: 40, max: 100, step: 5, value: 80, fmt: (v) => `${v}%`, color: C.ok, onInput: (v) => { s.hi = Math.max(v, s.lo + 10); if (s.hi !== v) sHi.set(s.hi); stage.request(); } });
  slider(box, { label: { th: 'ขับต่อวัน', en: 'Driven per day' }, min: 10, max: 200, step: 10, value: 50, fmt: (v) => `${v} km`, color: C.heat, onInput: (v) => { s.km = v; stage.request(); } });
  chips(box, { label: { th: 'แบบจำลอง', en: 'Model' }, options: [{ v: 'nmc', label: AGING.nmc, color: AGING.nmc.color }, { v: 'nca', label: AGING.nca, color: AGING.nca.color }], value: 'nmc', onChange: (v) => { s.chem = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'soh', label: { th: 'สุขภาพหลัง 10 ปี (ช่วงที่เลือก)', en: 'Health after 10 years (your window)' } }, { key: 'km', label: { th: 'ระยะทางรวม', en: 'Total distance' } }, { key: 'cyc', label: { th: 'จำนวนรอบเต็มเทียบเท่า', en: 'Equivalent full cycles' } }]);
  const run = (lo, hi) => simulateLife({ chem: s.chem, years: 10, profile: linspace(lo / 100, hi / 100, 24), tempC: 30, efcPerDay: (s.km * 0.16) / s.kwh, cchg: 0.25, crate: 0.25, stepDays: 15 });
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const wins = [[0, 100], [10, 90], [20, 80], [30, 70], [40, 60]];
    const res = wins.map(([a, b]) => ({ a, b, r: run(a, b) }));
    const mine = run(s.lo, s.hi);
    const bx = { x: m ? 92 : 150, y: 70, w: W - (m ? 120 : 260), h: H - 110 };
    const all = [...res.map((x) => x.r.final), mine.final];
    const lo = Math.floor(Math.min(...all) * 100 / 5) * 5 - 5;
    const sx = scale(lo, 100, bx.x, bx.x + bx.w);
    const rows = [...res.map((x) => ({ lab: `${x.a}–${x.b}%`, v: x.r.final, cal: x.r.qcal.at(-1), cyc: x.r.qcyc.at(-1), me: false })), { lab: T({ th: `ของคุณ ${s.lo}–${s.hi}%`, en: `yours ${s.lo}–${s.hi}%` }), v: mine.final, cal: mine.qcal.at(-1), cyc: mine.qcyc.at(-1), me: true }];
    const rh = bx.h / rows.length;
    text(c, T({ th: 'สุขภาพแบตหลัง 10 ปี (%)', en: 'Battery health after 10 years (%)' }), bx.x, bx.y - 14, { size: 11.5, color: C.ink2 });
    for (const t of [lo, ...[80, 85, 90, 95, 100].filter((x) => x > lo)]) { const x = sx(t); c.strokeStyle = C.grid2; c.beginPath(); c.moveTo(x, bx.y); c.lineTo(x, bx.y + bx.h); c.stroke(); text(c, fmt(t), x, bx.y + bx.h + 16, { size: 10.5, color: C.ink3, align: 'center' }); }
    rows.forEach((r, i) => {
      const y = bx.y + i * rh + rh * 0.2, hh = rh * 0.6;
      text(c, r.lab, bx.x - 10, y + hh / 2 + 4, { size: m ? 11 : 12, weight: r.me ? 700 : 500, color: r.me ? C.ink : C.ink2, align: 'right' });
      // bar from 100 down to value: show loss split cal / cyc
      const x100 = sx(100), xv = sx(r.v * 100), xc = sx(100 - r.cal * 100);
      rr(c, sx(lo), y, x100 - sx(lo), hh, 4); c.fillStyle = 'rgba(160,188,214,.07)'; c.fill();
      rr(c, sx(lo), y, xv - sx(lo), hh, 4); c.fillStyle = r.me ? withAlpha(AGING[s.chem].color, 0.95) : withAlpha(AGING[s.chem].color, 0.45); c.fill();
      // loss segments
      c.fillStyle = 'rgba(255,155,47,.55)'; c.fillRect(xc, y, x100 - xc, hh); // calendar
      c.fillStyle = 'rgba(255,91,79,.65)'; c.fillRect(xv, y, xc - xv, hh);    // cycling
      text(c, `${fmt(r.v * 100, 1)}%`, xv - 6, y + hh / 2 + 4, { size: 11, weight: 700, color: '#0a0e12', align: 'right' });
    });
    if (!m) {
      const lx = bx.x + bx.w + 20;
      const it = [[{ th: 'เสื่อมตามเวลา', en: 'calendar loss' }, 'rgba(255,155,47,.8)'], [{ th: 'เสื่อมตามรอบ', en: 'cycle loss' }, 'rgba(255,91,79,.85)']];
      it.forEach((x, i) => { c.fillStyle = x[1]; c.fillRect(lx, bx.y + 6 + i * 22, 12, 12); text(c, T(x[0]), lx + 18, bx.y + 16 + i * 22, { size: 11.5, color: C.ink2 }); });
    }
    ro.set('soh', `${fmt(mine.final * 100, 1)}<small>%</small>`);
    ro.set('km', `${fmt(s.km * 3650)}<small>km</small>`);
    ro.set('cyc', fmt(mine.efc));
  });
}

// ---------------------------------------------------------------- over-discharge schematic
export function over(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8, ratioM: 0.85, minH: 340, maxH: 520 });
  const s = { soc: 0.05 };
  slider(ctrls(), { label: { th: 'ระดับประจุจริงของเซลล์', en: 'True cell charge level' }, min: -20, max: 30, step: 1, value: 5, fmt: (v) => `${v}%`, color: C.bad, onInput: (v) => { s.soc = v / 100; stage.request(); } });
  const ro = readouts(inst, [{ key: 'z', label: { th: 'สถานะ', en: 'Status' } }, { key: 'what', label: { th: 'เกิดอะไรขึ้น', en: 'What is happening' } }]);
  // schematic potentials (V vs Li) as a function of true SOC (0 = cell cut-off at 2.75 V)
  const anode = (x) => x >= 0.03 ? 0.18 + 0.57 * Math.exp(-(x - 0.03) / 0.045) : x >= -0.12 ? 0.75 + (3.5 - 0.75) * clamp((0.03 - x) / 0.06, 0, 1) : 3.55;
  const cathode = (x) => x >= 0 ? 3.5 + 0.35 * Math.min(1, x / 0.3) ** 0.5 : Math.max(1.2, 3.5 - (-x) * 20);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const bx = { x: m ? 44 : 60, y: 70, w: W - (m ? 60 : 100), h: H - 118 };
    const sx = scale(30, -20, bx.x, bx.x + bx.w), sy = scale(0, 4.2, bx.y + bx.h, bx.y);
    const zone = (a, b, col, lab) => { c.fillStyle = col; c.fillRect(sx(a), bx.y, sx(b) - sx(a), bx.h); text(c, T(lab), (sx(a) + sx(b)) / 2, bx.y + 14, { size: m ? 9.5 : 11, weight: 600, color: C.ink2, align: 'center', maxW: sx(b) - sx(a) - 6 }); };
    zone(30, 4, 'rgba(47,208,176,.05)', { th: 'ใช้งานปกติ', en: 'normal use' });
    zone(4, 0, 'rgba(155,140,255,.10)', { th: 'บัฟเฟอร์', en: 'buffer' });
    zone(0, -12, 'rgba(255,155,47,.10)', { th: 'คายประจุเกิน: SEI สลาย, ทองแดงละลาย', en: 'over-discharge: SEI breaks, Cu dissolves' });
    zone(-12, -20, 'rgba(255,91,79,.16)', { th: 'ทองแดงทะลุ → ลัดวงจรภายใน', en: 'Cu bridges → internal short' });
    axes(c, bx, sx, sy, { xt: [30, 20, 10, 0, -10, -20], fx: (v) => `${v}%`, xl: { th: 'ระดับประจุจริง (0% = จุดตัดของเซลล์)', en: 'true charge level (0% = cell cut-off)' }, yl: { th: 'ศักย์ (V vs Li)', en: 'potential (V vs Li)' }, ny: 4 });
    const xs = linspace(0.3, -0.2, 160);
    line(c, xs.map((x) => [sx(x * 100), sy(anode(x))]), { color: C.cu, width: 2.6 });
    line(c, xs.map((x) => [sx(x * 100), sy(cathode(x))]), { color: C.violet, width: 2.6 });
    c.strokeStyle = 'rgba(228,140,92,.6)'; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(bx.x, sy(3.45)); c.lineTo(bx.x + bx.w, sy(3.45)); c.stroke(); c.setLineDash([]);
    text(c, T({ th: 'ทองแดงเริ่มละลาย ~3.4–3.5 V', en: 'copper starts dissolving ~3.4–3.5 V' }), bx.x + 6, sy(3.45) - 6, { size: 11, color: C.cu });
    text(c, T({ th: 'ขั้วบวก', en: 'cathode' }), sx(25), sy(cathode(0.25)) - 8, { size: 11.5, weight: 700, color: C.violet });
    text(c, T({ th: 'ขั้วลบ (ทองแดงอยู่ที่นี่)', en: 'anode (on copper foil)' }), sx(25), sy(anode(0.25)) - 8, { size: 11.5, weight: 700, color: C.cu });
    const x = s.soc; c.strokeStyle = 'rgba(231,237,243,.5)'; c.beginPath(); c.moveTo(sx(x * 100), bx.y); c.lineTo(sx(x * 100), bx.y + bx.h); c.stroke();
    glowDot(c, sx(x * 100), sy(anode(x)), 6, C.cu); glowDot(c, sx(x * 100), sy(cathode(x)), 6, C.violet);
    let z, w, cls;
    if (x >= 0.04) { z = T({ th: 'ปกติ', en: 'Normal' }); w = T({ th: 'ลิเทียมยังเหลือในขั้วลบ', en: 'Lithium still left in the anode' }); cls = 'good'; }
    else if (x >= 0) { z = T({ th: 'บัฟเฟอร์ของรถ', en: "Car's buffer" }); w = T({ th: 'จอบอก 0% แล้ว แต่เซลล์ยังปลอดภัย', en: 'Screen shows 0%, cells still safe' }); cls = 'warn'; }
    else if (x >= -0.12) { z = T({ th: 'คายประจุเกิน', en: 'Over-discharged' }); w = T({ th: 'SEI สลาย มีแก๊ส ทองแดงละลาย', en: 'SEI decomposes, gas forms, copper dissolves' }); cls = 'bad'; }
    else { z = T({ th: 'อันตราย', en: 'Dangerous' }); w = T({ th: 'ทองแดงงอกทะลุแผ่นกั้น ลัดวงจรภายใน', en: 'Copper bridges the separator: internal short' }); cls = 'bad'; }
    ro.set('z', z, cls); ro.set('what', w);
  });
}

// ---------------------------------------------------------------- parked drain
export function drain(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.2, ratioM: 0.95, minH: 300, maxH: 460 });
  const s = { start: 20, rate: 1.5, days: 60 };
  const box = ctrls();
  slider(box, { label: { th: '% ตอนเริ่มจอด', en: 'Charge when parked' }, min: 2, max: 100, step: 1, value: 20, fmt: (v) => `${v}%`, color: C.ok, onInput: (v) => { s.start = v; stage.request(); } });
  slider(box, { label: { th: 'กินไฟตอนจอดต่อวัน', en: 'Drain per day while parked' }, min: 0.2, max: 8, step: 0.1, value: 1.5, fmt: (v) => `${fmt(v, 1)}%`, color: C.bad, onInput: (v) => { s.rate = v; stage.request(); } });
  slider(box, { label: { th: 'ระยะเวลาที่จอด', en: 'Time parked' }, min: 7, max: 180, step: 1, value: 60, fmt: (v) => `${v} ${T({ th: 'วัน', en: 'days' })}`, color: C.violet, onInput: (v) => { s.days = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'd10', label: { th: 'ถึง 10% ใน', en: 'Reaches 10% after' } }, { key: 'd0', label: { th: 'ถึง 0% บนจอใน', en: 'Shows 0% after' } }, { key: 'end', label: { th: 'เมื่อกลับมา', en: 'When you return' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const bx = { x: m ? 40 : 56, y: 66, w: W - (m ? 56 : 90), h: H - 108 };
    const sx = scale(0, s.days, bx.x, bx.x + bx.w), sy = scale(-10, 100, bx.y + bx.h, bx.y);
    c.fillStyle = 'rgba(255,191,60,.08)'; c.fillRect(bx.x, sy(10), bx.w, sy(0) - sy(10));
    c.fillStyle = 'rgba(255,91,79,.14)'; c.fillRect(bx.x, sy(0), bx.w, sy(-10) - sy(0));
    text(c, T({ th: 'ใต้ 0% บนจอ: กำลังกินบัฟเฟอร์ เสี่ยงคายประจุเกิน', en: 'below screen 0%: eating the buffer, over-discharge risk' }), bx.x + 8, sy(-5) + 4, { size: 11, color: '#ffb3ad' });
    axes(c, bx, sx, sy, { xl: { th: 'วันที่จอด', en: 'days parked' }, yl: { th: '% บนจอ', en: 'screen %' }, yt: [0, 20, 40, 60, 80, 100] });
    const pts = []; for (let d = 0; d <= s.days; d += s.days / 200) pts.push([sx(d), sy(Math.max(-10, s.start - s.rate * d))]);
    line(c, pts, { color: C.ok, width: 2.6 });
    const d10 = Math.max(0, (s.start - 10) / s.rate), d0 = s.start / s.rate;
    if (d10 <= s.days) glowDot(c, sx(d10), sy(10), 5, C.warn);
    if (d0 <= s.days) glowDot(c, sx(d0), sy(0), 5, C.bad);
    const end = s.start - s.rate * s.days;
    ro.set('d10', s.start <= 10 ? T({ th: 'ต่ำกว่าแล้ว', en: 'already below' }) : `${fmt(d10)}<small>${T({ th: 'วัน', en: 'days' })}</small>`, d10 < 14 ? 'warn' : '');
    ro.set('d0', `${fmt(d0)}<small>${T({ th: 'วัน', en: 'days' })}</small>`, d0 < 30 ? 'bad' : '');
    ro.set('end', end > 10 ? `${fmt(end)}<small>%</small>` : end > 0 ? `${fmt(end)}<small>% ⚠︎</small>` : T({ th: 'แบตหมด ⚠︎', en: 'flat ⚠︎' }), end > 10 ? 'good' : 'bad');
  });
}
