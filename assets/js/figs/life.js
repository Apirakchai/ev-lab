// Chapter 10 figures
import { scaffold, slider, chips, readouts, legend, C, T, fmt, clamp, rr, text, scale, axes, line, glowDot, withAlpha } from '../lib.js';

const traj = (rate, t) => 100 - rate * (Math.min(t, 1) * 2 + Math.max(0, t - 1)); // first year twice as fast

export function curve(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.8, ratioM: 0.9, minH: 320, maxH: 500 });
  const s = { km: 20000, wkm: 160000 };
  const box = ctrls();
  slider(box, { label: { th: 'ขับต่อปี', en: 'Driven per year' }, min: 5000, max: 60000, step: 1000, value: 20000, fmt: (v) => `${fmt(v)} km`, color: C.heat, onInput: (v) => { s.km = v; stage.request(); } });
  chips(box, { label: { th: 'ระยะรับประกัน', en: 'Warranty distance' }, options: [{ v: '160000', label: { th: '160,000 กม.', en: '160,000 km' } }, { v: '192000', label: { th: '192,000 กม.', en: '192,000 km' } }], value: '160000', onChange: (v) => { s.wkm = +v; stage.request(); } });
  const L = [{ r: 1.5, col: '#2fd0b0', lab: { th: 'ใช้ถนอม 1.5%/ปี', en: 'gentle 1.5%/yr' } }, { r: 2.3, col: '#4ea2ff', lab: { th: 'เฉลี่ย 2.3%/ปี', en: 'average 2.3%/yr' } }, { r: 3.0, col: '#ff9b2f', lab: { th: 'DC กำลังสูงประจำ 3.0%/ปี', en: 'habitual high-power DC 3.0%/yr' } }];
  legend(inst, L.map((l) => ({ label: l.lab, color: l.col })), inst.querySelector('.ctrls'));
  const ro = readouts(inst, [{ key: 'wy', label: { th: 'ประกันหมดเมื่อ', en: 'Warranty ends after' } }, { key: 'avg', label: { th: 'สุขภาพเฉลี่ยตอนประกันหมด', en: 'Average health when it ends' } }, { key: 'tesla', label: { th: 'จุดข้อมูล Tesla 320,000 กม. ตรงกับปีที่', en: 'Tesla 320,000 km point lands at year' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const bx = { x: m ? 40 : 56, y: 66, w: W - (m ? 56 : 90), h: H - 108 };
    const ymax = 20;
    const sx = scale(0, ymax, bx.x, bx.x + bx.w), sy = scale(50, 100, bx.y + bx.h, bx.y);
    const wy = Math.min(8, s.wkm / s.km);
    // warranty box
    c.fillStyle = 'rgba(78,162,255,.08)'; c.fillRect(bx.x, sy(100), sx(wy) - bx.x, sy(70) - sy(100));
    c.strokeStyle = 'rgba(78,162,255,.55)'; c.setLineDash([5, 4]); c.strokeRect(bx.x + 0.5, sy(100) + 0.5, sx(wy) - bx.x, sy(70) - sy(100)); c.setLineDash([]);
    text(c, T({ th: `ประกัน: ${fmt(wy, 1)} ปี · ≥70%`, en: `warranty: ${fmt(wy, 1)} yrs · ≥70%` }), bx.x + 8, sy(70) - 8, { size: 11, color: 'rgba(78,162,255,.95)' });
    axes(c, bx, sx, sy, { xl: { th: 'ปี', en: 'years' }, yl: { th: 'สุขภาพแบต (%)', en: 'battery health (%)' }, nx: 10 });
    for (const l of L) {
      const pts = []; for (let t = 0; t <= ymax; t += 0.1) pts.push([sx(t), sy(Math.max(50, traj(l.r, t)))]);
      line(c, pts, { color: l.col, width: 2.4 });
    }
    // Tesla point
    const ty = 320000 / s.km;
    if (ty <= ymax) { glowDot(c, sx(ty), sy(85), 6, '#e7edf3'); text(c, T({ th: 'Tesla: 85% @ 320,000 กม.', en: 'Tesla: 85% @ 320,000 km' }), sx(ty) + (ty > 14 ? -10 : 10), sy(85) - 10, { size: 11.5, weight: 600, color: C.ink, align: ty > 14 ? 'right' : 'left' }); }
    else text(c, T({ th: `Tesla 85% @ 320,000 กม. = ปีที่ ${fmt(ty, 0)} (นอกกราฟ)`, en: `Tesla 85% @ 320,000 km = year ${fmt(ty, 0)} (off chart)` }), bx.x + bx.w - 6, sy(85) - 8, { size: 11, color: C.ink2, align: 'right' });
    ro.set('wy', `${fmt(wy, 1)}<small>${T({ th: 'ปี', en: 'yrs' })}</small>`);
    ro.set('avg', `${fmt(traj(2.3, wy), 1)}<small>%</small>`, 'good');
    ro.set('tesla', `${fmt(ty, 1)}`);
  });
}

export function km(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 6, ratioM: 1.2, minH: 260, maxH: 400 });
  const s = { kwh: 75, wh: 160, cyc: 1500, rate: 2, kmy: 20000 };
  const box = ctrls();
  slider(box, { label: { th: 'แบต', en: 'Battery' }, min: 40, max: 110, step: 1, value: 75, fmt: (v) => `${v} kWh`, color: C.ok, onInput: (v) => { s.kwh = v; stage.request(); } });
  chips(box, { label: { th: 'รอบชาร์จจนเหลือ 80%', en: 'Cycles to 80%' }, options: [{ v: '1500', label: { th: '1,500 (NMC ต่ำ)', en: '1,500 (NMC low)' } }, { v: '3000', label: { th: '3,000 (NMC สูง/LFP ต่ำ)', en: '3,000 (NMC high / LFP low)' } }, { v: '6000', label: { th: '6,000 (LFP)', en: '6,000 (LFP)' } }], value: '1500', onChange: (v) => { s.cyc = +v; stage.request(); } });
  slider(box, { label: { th: 'เสื่อมตามเวลาต่อปี', en: 'Calendar loss per year' }, min: 0.5, max: 4, step: 0.1, value: 2, fmt: (v) => `${fmt(v, 1)}%`, color: C.heat, onInput: (v) => { s.rate = v; stage.request(); } });
  slider(box, { label: { th: 'ขับต่อปี', en: 'Driven per year' }, min: 5000, max: 80000, step: 1000, value: 20000, fmt: (v) => `${fmt(v)} km`, color: C.violet, onInput: (v) => { s.kmy = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'kmc', label: { th: 'ระยะตามรอบชาร์จ', en: 'Distance by cycles' } }, { key: 'yc', label: { th: 'ถึง 80% ด้วยรอบ (ปี)', en: 'Years to 80% by cycles' } }, { key: 'yt', label: { th: 'ถึง 80% ด้วยเวลา (ปี)', en: 'Years to 80% by time' } }, { key: 'lim', label: { th: 'ตัวจำกัด', en: 'Limiting factor' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const kmc = (s.cyc * s.kwh * 0.9 * 1000) / s.wh; // ~90% average usable over life
    const yc = kmc / s.kmy, yt = 20 / s.rate;
    // combined (rough): losses add
    const yboth = 1 / (1 / yc + 1 / yt);
    const x0 = m ? 20 : 40, x1 = W - (m ? 20 : 40), sx = scale(0, 40, x0, x1);
    const rows = [[{ th: 'ตามรอบชาร์จอย่างเดียว', en: 'Cycles alone' }, yc, C.violet], [{ th: 'ตามเวลาอย่างเดียว', en: 'Time alone' }, yt, C.heat], [{ th: 'รวมกัน (ประมาณ)', en: 'Both together (approx.)' }, yboth, C.ok]];
    rows.forEach((r, i) => {
      const y = 76 + i * (m ? 46 : 52);
      text(c, T(r[0]), x0, y, { size: 12, color: C.ink2 });
      rr(c, x0, y + 8, x1 - x0, 14, 7); c.fillStyle = 'rgba(160,188,214,.12)'; c.fill();
      rr(c, x0, y + 8, Math.max(10, sx(Math.min(40, r[1])) - x0), 14, 7); c.fillStyle = r[2]; c.fill();
      text(c, r[1] > 40 ? '> 40' : fmt(r[1], 1), Math.min(x1 - 4, sx(Math.min(40, r[1])) + 8), y + 20, { size: 12, weight: 700, color: C.ink, align: r[1] > 36 ? 'right' : 'left' });
    });
    text(c, T({ th: 'ปีจนเหลือ 80%', en: 'years until 80%' }), x1, 60, { size: 11, color: C.ink3, align: 'right' });
    ro.set('kmc', `${fmt(kmc / 1000)}k<small>km</small>`);
    ro.set('yc', fmt(yc, 1)); ro.set('yt', fmt(yt, 1));
    ro.set('lim', yc < yt ? T({ th: 'รอบชาร์จ (ขับเยอะ)', en: 'cycles (high mileage)' }) : T({ th: 'เวลา (อายุแบต)', en: 'time (calendar)' }));
  });
}
