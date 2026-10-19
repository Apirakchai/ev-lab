// Chapter 6 figures
import { scaffold, slider, select, chips, readouts, C, T, fmt, clamp, rr, text, scale, axes, line, withAlpha, mix, glowDot } from '../lib.js';
import { PACKS, tempFactor, CHEM } from '../models.js';
import { cmaxPlating } from './charging.js';

const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const pw = (pts) => (x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, b] = pts[i - 1], [c, d] = pts[i]; return b + (d - b) * (x - a) / (c - a); } return pts.at(-1)[1]; };

// ---------------------------------------------------------------- risk heatmap + BMS line
export function risk(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8.2, ratioM: 0.85, minH: 330, maxH: 540 });
  const s = { temp: 25, pack: 'nca75' };
  const box = ctrls();
  slider(box, { label: { th: 'อุณหภูมิแบต', en: 'Battery temperature' }, min: 0, max: 45, step: 1, value: 25, fmt: (v) => `${v}°C`, color: C.heat, onInput: (v) => { s.temp = v; cache = null; stage.request(); } });
  select(box, { label: { th: 'แพ็กตัวอย่าง', en: 'Example pack' }, options: ['lfp60', 'nca75', 'nmc77', 'blade82'].map((k) => ({ v: k, label: PACKS[k] })), value: s.pack, onChange: (v) => { s.pack = v; stage.request(); } });
  let cache = null;
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const bx = { x: m ? 44 : 60, y: 66, w: W - (m ? 60 : 100), h: H - 112 };
    const sx = scale(0, 100, bx.x, bx.x + bx.w), sy = scale(0, 4, bx.y + bx.h, bx.y);
    // heatmap
    const nx = m ? 50 : 90, ny = 40;
    if (!cache) { cache = []; for (let i = 0; i < nx; i++) { const soc = (i + 0.5) / nx; cache.push(cmaxPlating(soc, s.temp)); } }
    const cw = bx.w / nx, chh = bx.h / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const cr = ((j + 0.5) / ny) * 4; const margin = (cache[i] - cr) / 4; // >0 safe
      const col = margin > 0 ? mix('#0f2a2a', '#123a33', clamp(margin * 2, 0, 1)) : mix('#3a1418', '#7a1d22', clamp(-margin * 3, 0, 1));
      c.fillStyle = col; c.fillRect(bx.x + i * cw, bx.y + bx.h - (j + 1) * chh, cw + 0.6, chh + 0.6);
    }
    axes(c, bx, sx, sy, { xl: { th: '% แบต', en: 'charge %' }, yl: { th: 'กระแส (C-rate)', en: 'current (C-rate)' }, ny: 4 });
    // plating boundary
    line(c, linspace(0.02, 0.99, 100).map((x) => [sx(x * 100), sy(Math.min(4, cmaxPlating(x, s.temp)))]), { color: '#ff8a80', width: 1.6, dash: [5, 4] });
    // BMS map
    const P = PACKS[s.pack], f = pw(P.map), tf = Math.min(1, tempFactor(s.temp) / 0.97);
    line(c, linspace(0, 1, 120).map((x) => [sx(x * 100), sy(Math.min(4, f(x) * tf))]), { color: '#ffffff', width: 2.8 });
    text(c, T({ th: 'เส้นขาว: กระแสที่ BMS ยอมให้', en: 'white: current the BMS allows' }), bx.x + 8, bx.y + 16, { size: 11.5, color: C.ink });
    text(c, T({ th: 'เส้นประแดง: ขอบเขตเกิดเพลตติ้ง', en: 'red dashes: plating boundary' }), bx.x + 8, bx.y + 34, { size: 11.5, color: '#ff8a80' });
  });
}

// ---------------------------------------------------------------- field evidence bars
export function evidence(inst) {
  const { stage } = scaffold(inst, { height: (w, m) => (m ? 640 : 470), minH: 400, maxH: 700, maxVH: 2 });
  const groups = [
    { t: { th: 'Geotab: สัดส่วนการชาร์จ DC', en: 'Geotab: share of DC sessions' }, u: { th: '% ต่อปี', en: '%/yr' }, max: 3.5, rows: [
      { l: { th: 'DC น้อยกว่า 12%', en: 'DC under 12%' }, v: 1.5, k: '#2fd0b0' }, { l: { th: 'DC มากกว่า 12%', en: 'DC over 12%' }, v: 2.5, k: '#ff9b2f' }] },
    { t: { th: 'Geotab: กำลังชาร์จ (กลุ่มใช้ DC หนัก)', en: 'Geotab: charging power (heavy DC users)' }, u: { th: '% ต่อปี', en: '%/yr' }, max: 3.5, rows: [
      { l: { th: 'ชาร์จเกิน 100 kW < 40% ของครั้ง', en: '>100 kW in under 40% of sessions' }, v: 2.2, k: '#ffbf3c' }, { l: { th: 'ชาร์จเกิน 100 kW > 40% ของครั้ง', en: '>100 kW in over 40% of sessions' }, v: 3.0, k: '#ff5b4f' }] },
    { t: { th: 'Geotab: เวลาที่อยู่ช่วงสุดขอบ (<20% หรือ >80%)', en: 'Geotab: time at extremes (<20% or >80%)' }, u: { th: '% ต่อปี', en: '%/yr' }, max: 3.5, rows: [
      { l: { th: 'น้อยกว่า 50% ของเวลา', en: 'under 50% of the time' }, v: 1.4, k: '#2fd0b0' }, { l: { th: '50–80% ของเวลา', en: '50–80% of the time' }, v: 1.5, k: '#a3d95b' }, { l: { th: 'มากกว่า 80% ของเวลา', en: 'over 80% of the time' }, v: 2.0, k: '#ffbf3c' }] },
    { t: { th: 'INL: Nissan Leaf ที่ 40,000 ไมล์', en: 'INL: Nissan Leaf at 40,000 miles' }, u: { th: '% ความจุที่หาย', en: '% capacity lost' }, max: 30, rows: [
      { l: { th: 'ชาร์จ AC ล้วน', en: 'AC only' }, v: 22, k: '#4ea2ff' }, { l: { th: 'ชาร์จ DC 50 kW ล้วน', en: '50 kW DC only' }, v: 25, k: '#ff9b2f' }] },
  ];
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const lx = m ? 14 : 30, labW = m ? W * 0.44 : 290, x0 = lx + labW, x1 = W - (m ? 50 : 80);
    let y = 64;
    const gh = (H - 120) / groups.length;
    for (const g of groups) {
      text(c, `${T(g.t)} · ${T(g.u)}`, lx, y, { size: 12.5, weight: 600, color: C.ink, maxW: W - 40 });
      const sx = scale(0, g.max, x0, x1);
      const rh = Math.min(26, (gh - 30) / g.rows.length);
      g.rows.forEach((r, i) => {
        const yy = y + 14 + i * rh;
        text(c, T(r.l), x0 - 10, yy + rh / 2 + 4, { size: m ? 10.5 : 11.5, color: C.ink2, align: 'right', maxW: labW - 14 });
        rr(c, x0, yy + 4, Math.max(6, sx(r.v) - x0), rh - 8, 4); c.fillStyle = r.k; c.fill();
        text(c, fmt(r.v, g.max > 10 ? 0 : 1), sx(r.v) + 8, yy + rh / 2 + 4, { size: 12, weight: 700, color: C.ink });
      });
      y += gh;
    }
    rr(c, lx, y - 6, W - lx * 2, 44, 10); c.fillStyle = 'rgba(78,162,255,.10)'; c.fill();
    text(c, T({ th: 'Recurrent: Tesla ชาร์จเร็ว ≥90% vs <10% ของเวลา → ไม่ต่างอย่างมีนัยสำคัญ', en: 'Recurrent: Teslas fast-charging ≥90% vs <10% of the time → no significant difference' }), lx + 12, y + 20, { size: m ? 10.5 : 12.5, weight: 600, color: C.ink, maxW: W - lx * 2 - 20 });
  });
}

// ---------------------------------------------------------------- Geotab-based estimator
export function mixEst(inst) { return mixFn(inst); }
export { mixFn as mix };
function mixFn(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 4.4, ratioM: 1.5, minH: 200, maxH: 300 });
  const s = { dc: 20, hp: 50, hot: true, ext: 40 };
  const box = ctrls();
  slider(box, { label: { th: 'สัดส่วนครั้งที่ชาร์จ DC', en: 'Share of sessions that are DC' }, min: 0, max: 100, step: 1, value: 20, fmt: (v) => `${v}%`, color: C.heat, onInput: (v) => { s.dc = v; stage.request(); } });
  slider(box, { label: { th: 'ในนั้นเป็นการชาร์จเกิน 100 kW', en: 'Of those, sessions above 100 kW' }, min: 0, max: 100, step: 5, value: 50, fmt: (v) => `${v}%`, color: C.bad, onInput: (v) => { s.hp = v; stage.request(); } });
  slider(box, { label: { th: 'เวลาที่อยู่ <20% หรือ >80%', en: 'Time spent <20% or >80%' }, min: 0, max: 100, step: 5, value: 40, fmt: (v) => `${v}%`, color: C.violet, onInput: (v) => { s.ext = v; stage.request(); } });
  chips(box, { label: { th: 'ภูมิอากาศ', en: 'Climate' }, options: [{ v: 'hot', label: { th: 'ร้อน (แบบไทย)', en: 'Hot (like Thailand)' } }, { v: 'mild', label: { th: 'อบอุ่น', en: 'Mild' } }], value: 'hot', onChange: (v) => { s.hot = v === 'hot'; stage.request(); } });
  const ro = readouts(inst, [{ key: 'yr', label: { th: 'เสื่อมต่อปี (ประมาณ)', en: 'Loss per year (approx.)' } }, { key: 'y8', label: { th: 'สุขภาพแบตที่ 8 ปี', en: 'Health at 8 years' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    let base = s.dc > 12 ? (s.hp > 40 ? 3.0 : 2.2) : 1.5;
    const extAdj = s.ext > 80 ? 0.5 : s.ext > 50 ? 0.1 : 0;
    const clim = s.hot ? 0.2 : -0.2; // ±half of the 0.4 pp hot–mild gap around the mixed average
    const yr = clamp(base + extAdj + clim, 0.8, 4.5);
    const y8 = 100 - yr * 8;
    // gauge: 8-year projection bar
    const x0 = m ? 20 : 40, x1 = W - (m ? 20 : 40), y = Math.max(96, H * 0.45);
    const sx = scale(60, 100, x0, x1);
    rr(c, x0, y, x1 - x0, 18, 9); c.fillStyle = 'rgba(160,188,214,.12)'; c.fill();
    const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#ff5b4f'); g.addColorStop(0.5, '#ffbf3c'); g.addColorStop(1, '#2fd0b0');
    rr(c, x0, y, sx(y8) - x0, 18, 9); c.fillStyle = g; c.fill();
    for (const t of [60, 70, 80, 90, 100]) text(c, `${t}%`, sx(t), y + 38, { size: 11, color: C.ink3, align: 'center' });
    c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(sx(70), y - 8); c.lineTo(sx(70), y + 26); c.stroke();
    text(c, T({ th: 'เกณฑ์รับประกันทั่วไป 70%', en: 'typical warranty floor 70%' }), sx(70), y + 56, { size: 11, color: C.ink2, align: 'center' });
    text(c, T({ th: `ประมาณ ${fmt(y8)}% ที่ 8 ปี`, en: `about ${fmt(y8)}% at 8 years` }), x0, y - 30, { size: 15, weight: 700, color: C.ink, disp: true });
    ro.set('yr', `${fmt(yr, 1)}<small>%</small>`, yr > 2.5 ? 'warn' : 'good');
    ro.set('y8', `${fmt(y8)}<small>%</small>`, y8 < 80 ? 'warn' : 'good');
  });
}
