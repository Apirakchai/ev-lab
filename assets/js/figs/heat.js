// Chapter 7 figures
import { scaffold, slider, chips, readouts, legend, C, T, fmt, clamp, lerp, rr, text, scale, axes, line, glowDot, withAlpha, mix } from '../lib.js';
import { calendarLoss, AGING } from '../models.js';

const R = 8.314;
const mult = (tC, Ea) => Math.exp(-(Ea / R) * (1 / (tC + 273.15) - 1 / 298.15));

// ---------------------------------------------------------------- Arrhenius multipliers
export function arrhenius(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.6, ratioM: 0.95, minH: 300, maxH: 480 });
  const s = { t: 35 };
  slider(ctrls(), { label: { th: 'อุณหภูมิแบตเฉลี่ย', en: 'Average battery temperature' }, min: 10, max: 50, step: 1, value: 35, fmt: (v) => `${v}°C`, color: C.heat, onInput: (v) => { s.t = v; stage.request(); } });
  const L = [
    { k: 'nca', ea: 3340 * R, col: AGING.nca.color, lab: { th: 'NCA (Ea ≈ 28 kJ/mol)', en: 'NCA (Ea ≈ 28 kJ/mol)' } },
    { k: 'nmc', ea: 37000, col: AGING.nmc.color, lab: { th: 'NMC622 (37 kJ/mol)', en: 'NMC622 (37 kJ/mol)' } },
    { k: 'lfp', ea: 5210 * R, col: AGING.lfp.color, lab: { th: 'LFP (43 kJ/mol)', en: 'LFP (43 kJ/mol)' } },
    { k: 'rule', ea: 53000, col: '#b9c4cf', dash: true, lab: { th: 'กฎ “สองเท่าทุก 10°C”', en: '"double per 10 °C" rule' } },
  ];
  const ro = readouts(inst, L.map((l) => ({ key: l.k, label: l.lab })));
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const bx = { x: m ? 40 : 56, y: 66, w: W - (m ? 56 : 90), h: H - 108 };
    const sx = scale(10, 50, bx.x, bx.x + bx.w), sy = scale(0, 4.5, bx.y + bx.h, bx.y);
    c.fillStyle = 'rgba(255,155,47,.07)'; c.fillRect(sx(28), bx.y, sx(36) - sx(28), bx.h);
    text(c, T({ th: 'ช่วงที่พบบ่อยในไทย', en: 'typical in Thailand' }), sx(32), bx.y + 14, { size: 11, color: C.heat, align: 'center' });
    axes(c, bx, sx, sy, { xl: { th: '°C', en: '°C' }, yl: { th: 'เร็วกว่าที่ 25°C (เท่า)', en: '× faster than at 25 °C' }, fy: (v) => fmt(v, 0) });
    for (const l of L) {
      const pts = []; for (let t = 10; t <= 50; t += 0.5) pts.push([sx(t), sy(Math.min(4.5, mult(t, l.ea)))]);
      line(c, pts, { color: l.col, width: l.dash ? 1.6 : 2.4, dash: l.dash ? [6, 5] : null });
      const y = sy(Math.min(4.4, mult(48, l.ea))); if (!m) text(c, T(l.lab), sx(48) - 6, y - 8, { size: 11, color: l.col, align: 'right' });
    }
    c.strokeStyle = 'rgba(231,237,243,.4)'; c.beginPath(); c.moveTo(sx(s.t), bx.y); c.lineTo(sx(s.t), bx.y + bx.h); c.stroke();
    for (const l of L) { glowDot(c, sx(s.t), sy(Math.min(4.5, mult(s.t, l.ea))), 4.5, l.col); ro.set(l.k, `×${fmt(mult(s.t, l.ea), 2)}`); }
  });
}

// ---------------------------------------------------------------- parking scenarios
export function parking(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.4, ratioM: 0.9, minH: 300, maxH: 480 });
  const s = { chem: 'nca' };
  chips(ctrls(), { label: { th: 'แบบจำลองเซลล์', en: 'Cell model' }, options: [{ v: 'nca', label: AGING.nca, color: AGING.nca.color }, { v: 'lfp', label: AGING.lfp, color: AGING.lfp.color }, { v: 'nmc', label: AGING.nmc, color: AGING.nmc.color }], value: 'nca', onChange: (v) => { s.chem = v; stage.request(); } });
  const spots = [{ th: 'ในอาคาร ~29°C', en: 'Indoors ~29 °C', t: 29 }, { th: 'ร่มไม้ ~31°C', en: 'Tree shade ~31 °C', t: 31 }, { th: 'ตากแดดประจำ ~35°C', en: 'Daily sun ~35 °C', t: 35 }];
  const socs = [{ v: 0.5, col: '#2fd0b0' }, { v: 0.8, col: '#ffbf3c' }, { v: 1.0, col: '#ff5b4f' }];
  legend(inst, socs.map((x) => ({ label: { th: `จอดที่ ${x.v * 100}%`, en: `parked at ${x.v * 100}%` }, color: x.col, dot: true })), inst.querySelector('.ctrls'));
  const ro = readouts(inst, [{ key: 'best', label: { th: 'ดีที่สุด (ในอาคาร 50%)', en: 'Best (indoors, 50%)' } }, { key: 'worst', label: { th: 'แย่สุด (ตากแดด 100%)', en: 'Worst (sun, 100%)' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const res = spots.map((sp) => socs.map((so) => 100 * (1 - calendarLoss(s.chem, so.v, sp.t, 8 * 365))));
    const all = res.flat(); const lo = Math.floor(Math.min(...all) / 5) * 5 - 5;
    const bx = { x: m ? 40 : 56, y: 66, w: W - (m ? 56 : 90), h: H - 112 };
    const sy = scale(lo, 100, bx.y + bx.h, bx.y);
    const gw = bx.w / spots.length;
    for (let t = lo; t <= 100; t += 5) { const y = Math.round(sy(t)) + 0.5; c.strokeStyle = C.grid2; c.beginPath(); c.moveTo(bx.x, y); c.lineTo(bx.x + bx.w, y); c.stroke(); text(c, `${t}%`, bx.x - 8, y + 4, { size: 11, color: C.ink3, align: 'right' }); }
    text(c, T({ th: 'ความจุที่เหลือหลัง 8 ปี (เฉพาะการเสื่อมตามเวลา)', en: 'capacity after 8 years (calendar ageing only)' }), bx.x, bx.y - 12, { size: 11.5, color: C.ink2 });
    spots.forEach((sp, i) => {
      const bw = Math.min(46, (gw - 30) / 3);
      socs.forEach((so, k) => {
        const x = bx.x + i * gw + gw / 2 - (bw * 3 + 8) / 2 + k * (bw + 4), v = res[i][k];
        rr(c, x, sy(v), bw, sy(lo) - sy(v), 4); c.fillStyle = so.col; c.fill();
        text(c, fmt(v, 0), x + bw / 2, sy(v) - 6, { size: 11, weight: 700, color: C.ink, align: 'center' });
      });
      text(c, T(sp), bx.x + i * gw + gw / 2, bx.y + bx.h + 18, { size: m ? 10.5 : 12, weight: 600, color: C.ink2, align: 'center' });
    });
    ro.set('best', `${fmt(res[0][0], 1)}<small>%</small>`, 'good');
    ro.set('worst', `${fmt(res[2][2], 1)}<small>%</small>`, 'bad');
  });
}

// ---------------------------------------------------------------- thermal runaway ladder
export function runaway(inst) {
  const { stage, ctrls } = scaffold(inst, { height: (w, m) => (m ? 600 : 470), minH: 420, maxH: 660, maxVH: 2 });
  const s = { t: 60 };
  slider(ctrls(), { label: { th: 'อุณหภูมิเซลล์', en: 'Cell temperature' }, min: 25, max: 700, step: 1, value: 60, fmt: (v) => `${v}°C`, color: C.bad, onInput: (v) => { s.t = v; stage.request(); } });
  const NMC = { name: 'NMC811 (100%)', onset: 90, sep: 117, vent: 165, runaway: 190, peak: 615,
    ev: [[60, 130, { th: 'SEI สลายตัว ปล่อยความร้อน', en: 'SEI breaks down, releasing heat' }], [110, 130, { th: 'แผ่นกั้น PE หลอม', en: 'PE separator melts' }], [130, 250, { th: 'ขั้วบวกสลาย ปล่อยออกซิเจน', en: 'Cathode decomposes, releasing oxygen' }], [165, 700, { th: 'ระบายแก๊สออกจากเซลล์', en: 'Cell vents gas' }], [190, 700, { th: 'Runaway เต็มรูปแบบ ลัดวงจรภายใน', en: 'Full runaway, internal short' }]] };
  const LFP = { name: 'LFP', onset: 120, sep: 130, vent: 200, runaway: 230, peak: 620,
    ev: [[60, 130, { th: 'SEI สลายตัว ปล่อยความร้อน', en: 'SEI breaks down, releasing heat' }], [110, 130, { th: 'แผ่นกั้น PE หลอม', en: 'PE separator melts' }], [200, 700, { th: 'ระบายแก๊สออกจากเซลล์', en: 'Cell vents gas' }], [230, 700, { th: 'Runaway (ขั้วบวก LFP ปล่อยออกซิเจนน้อยมาก)', en: 'Runaway (the LFP cathode releases little oxygen)' }]] };
  const ro = readouts(inst, [{ key: 'nmc', label: { th: 'NMC811 ที่อุณหภูมินี้', en: 'NMC811 at this temperature' } }, { key: 'lfp', label: { th: 'LFP ที่อุณหภูมินี้', en: 'LFP at this temperature' } }]);
  const stateOf = (X, t) => t >= X.runaway ? 3 : t >= X.vent ? 2 : t >= X.onset ? 1 : 0;
  const stateText = [{ th: 'ปกติ', en: 'Normal' }, { th: 'เริ่มร้อนขึ้นเอง', en: 'Self-heating' }, { th: 'ระบายแก๊ส', en: 'Venting' }, { th: 'Thermal runaway', en: 'Thermal runaway' }];
  stage.loop(() => {});
  stage.draw((c, W, H) => {
    const m = stage.mobile, tt = stage.t;
    const cols = [NMC, LFP];
    const colW = m ? W - 32 : (W - 90) / 2;
    cols.forEach((X, i) => {
      const x0 = m ? 16 : 30 + i * (colW + 30), y0 = m ? 56 + i * ((H - 70) / 2) : 60, h = m ? (H - 70) / 2 - 14 : H - 80;
      rr(c, x0, y0, colW, h, 12); c.fillStyle = 'rgba(21,29,37,.75)'; c.fill(); c.strokeStyle = C.line; c.stroke();
      text(c, X.name, x0 + 14, y0 + 22, { size: 14, weight: 700, color: i ? C.ok : C.violet, disp: true });
      // cell drawing
      const st = stateOf(X, s.t);
      const cw = Math.min(70, colW * 0.18), ch = Math.min(150, h * 0.55);
      const cx = x0 + 24 + cw / 2, cy = y0 + 46 + ch / 2;
      const swell = st >= 1 ? 1 + 0.05 * Math.min(1, (s.t - X.onset) / 60) : 1;
      const g = c.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0); g.addColorStop(0, '#2a333c'); g.addColorStop(0.5, '#56636f'); g.addColorStop(1, '#232b33');
      rr(c, cx - (cw * swell) / 2, cy - ch / 2, cw * swell, ch, 8); c.fillStyle = g; c.fill();
      const heatA = clamp((s.t - 40) / 250, 0, 1);
      rr(c, cx - (cw * swell) / 2, cy - ch / 2, cw * swell, ch, 8); c.fillStyle = `rgba(255,${Math.round(140 - heatA * 100)},40,${heatA * 0.55})`; c.fill();
      if (st >= 2) for (let k = 0; k < 6; k++) { const ph = (tt * 0.8 + k / 6) % 1; c.beginPath(); c.arc(cx + Math.sin(k * 2 + tt) * 10, cy - ch / 2 - 8 - ph * 50, 6 + ph * 12, 0, 7); c.fillStyle = `rgba(200,205,212,${0.35 * (1 - ph)})`; c.fill(); }
      if (st >= 3) for (let k = 0; k < 9; k++) { const ph = (tt * 1.6 + k / 9) % 1; const fx = cx + Math.sin(k * 3.1 + tt * 4) * cw * 0.4; const fy = cy - ch / 2 - ph * 70; c.beginPath(); c.arc(fx, fy, (1 - ph) * 12 + 3, 0, 7); c.fillStyle = `rgba(255,${Math.round(180 - ph * 120)},40,${0.85 * (1 - ph)})`; c.fill(); }
      // event list
      const lx = x0 + 24 + cw + 30, lw = colW - (lx - x0) - 14;
      text(c, `${T(stateText[st])}`, lx, y0 + 50, { size: 15, weight: 700, color: [C.ok, C.warn, C.heat, C.bad][st], disp: true });
      X.ev.forEach((e, k) => {
        const active = s.t >= e[0];
        const y = y0 + 80 + k * (m ? 22 : 26);
        c.beginPath(); c.arc(lx + 5, y - 4, 4, 0, 7); c.fillStyle = active ? C.heat : 'rgba(160,188,214,.25)'; c.fill();
        text(c, `${e[0]}°C+  ${T(e[2])}`, lx + 16, y, { size: m ? 10.5 : 12, color: active ? C.ink : C.ink3, maxW: lw - 16 });
      });
      text(c, T({ th: `อุณหภูมิสูงสุดเมื่อเกิดเหตุ ~${X.peak}°C`, en: `peak during runaway ~${X.peak} °C` }), lx, y0 + h - 14, { size: 11, color: C.ink3 });
    });
    ro.set('nmc', T(stateText[stateOf(NMC, s.t)]), ['good', 'warn', 'warn', 'bad'][stateOf(NMC, s.t)]);
    ro.set('lfp', T(stateText[stateOf(LFP, s.t)]), ['good', 'warn', 'warn', 'bad'][stateOf(LFP, s.t)]);
  });
}
