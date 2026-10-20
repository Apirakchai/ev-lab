// Chapter 3 figures
import { scaffold, slider, chips, readouts, legend, note, C, T, fmt, clamp, lerp, rr, text, glowDot, withAlpha, scale, axes, line, area, tip, nearestIdx, mix, wrapLines } from '../lib.js';
import { CHEM, Ua, Uc, AGING, simulateLife, dayProfile, K } from '../models.js';

// ---------------------------------------------------------------- potential ladder
export function ladder(inst) {
  const { stage, ctrls } = scaffold(inst, { height: (w, m) => (m ? 560 : 440), minH: 380, maxH: 620, maxVH: 2 });
  const s = { soc: 0.8, chem: 'nmc' };
  const box = ctrls();
  slider(box, { label: { th: '% แบต (SOC)', en: 'State of charge' }, min: 0, max: 100, step: 1, value: 80, fmt: (v) => `${v}%`, color: C.ok, onInput: (v) => { s.soc = v / 100; stage.request(); } });
  chips(box, { label: { th: 'ขั้วบวก', en: 'Cathode' }, options: [{ v: 'nmc', label: { th: 'NMC (นิกเกิล)', en: 'NMC (nickel)' }, color: CHEM.nmc.color }, { v: 'lfp', label: { th: 'LFP', en: 'LFP' }, color: CHEM.lfp.color }], value: 'nmc', onChange: (v) => { s.chem = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'ua', label: { th: 'ศักย์ขั้วลบ', en: 'Anode potential' } }, { key: 'uc', label: { th: 'ศักย์ขั้วบวก', en: 'Cathode potential' } }, { key: 'v', label: { th: 'แรงดันเซลล์', en: 'Cell voltage' } }, { key: 'sei', label: { th: 'อัตราโตของ SEI (เทียบที่ 50%)', en: 'SEI growth rate (vs 50%)' } }]);
  const seiRel = (soc) => Math.exp((-3560 * Ua(soc)) / 298.15) / Math.exp((-3560 * Ua(0.5)) / 298.15);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const ua = Ua(s.soc), uc = Uc(s.chem, s.soc), v = CHEM[s.chem].ocv(s.soc);
    const top = 70, bot = H - 40;
    // two gauges
    const gw = m ? (W - 70) / 2 : 120, gap = m ? 24 : 250;
    const gx1 = m ? 40 : W * 0.5 - gw - gap / 2, gx2 = gx1 + gw + gap;
    const sa = scale(0, 0.8, bot, top);       // anode gauge 0–0.8 V
    const sc = scale(3.2, 4.6, bot, top);     // cathode gauge 3.2–4.6 V
    const gauge = (x, sy, lo, hi, title, zones) => {
      rr(c, x, top, gw, bot - top, 10); c.fillStyle = 'rgba(21,29,37,.85)'; c.fill(); c.strokeStyle = C.line; c.stroke();
      c.save(); rr(c, x, top, gw, bot - top, 10); c.clip();
      for (const z of zones) { c.fillStyle = z.fill; const y1 = sy(Math.min(hi, z.to)), y0 = sy(Math.max(lo, z.from)); c.fillRect(x, y1, gw, y0 - y1);
        const zl = z.label ? wrapLines(c, T(z.label), gw - 12, m ? 10 : 10.5, 600) : [];
        zl.forEach((ln, j) => text(c, ln, x + gw / 2, (y0 + y1) / 2 + 4 + (j - (zl.length - 1) / 2) * 13, { size: m ? 10 : 10.5, weight: 600, color: z.ink, align: 'center' })); }
      c.restore();
      for (let t = lo; t <= hi + 1e-9; t += (hi - lo) / 7) { const y = sy(t); c.strokeStyle = C.grid2; c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x, y); c.stroke(); text(c, fmt(t, 2), x - 8, y + 4, { size: 10, color: C.ink3, align: 'right' }); }
      text(c, T(title), x + gw / 2, top - 12, { size: 12, weight: 600, color: C.ink, align: 'center' });
    };
    gauge(gx1, sa, 0, 0.8, { th: 'ขั้วลบ (V vs Li)', en: 'Anode (V vs Li)' }, [
      { from: 0, to: 0.0, fill: 'transparent', ink: C.ink, label: '' },
      { from: 0, to: 0.12, fill: 'rgba(255,91,79,.18)', ink: '#ffb3ad', label: { th: 'SEI โตเร็ว', en: 'fast SEI growth' } },
      { from: 0.12, to: 0.8, fill: 'rgba(245,197,24,.07)', ink: 'rgba(245,197,24,.75)', label: { th: 'ต่ำกว่า ~0.8 V: ต้องพึ่ง SEI ตลอด', en: 'below ~0.8 V: SEI always needed' } },
    ]);
    const cz = [
      { from: 4.3, to: 4.6, fill: 'rgba(255,91,79,.2)', ink: '#ffb3ad', label: { th: 'อิเล็กโทรไลต์ถูกออกซิไดซ์', en: 'electrolyte oxidises' } },
    ];
    if (s.chem === 'nmc') cz.push({ from: 4.15, to: 4.3, fill: 'rgba(255,155,47,.16)', ink: '#ffcf99', label: { th: 'H2→H3 (นิกเกิลสูง)', en: 'H2→H3 (high-Ni)' } });
    gauge(gx2, sc, 3.2, 4.6, { th: 'ขั้วบวก (V vs Li)', en: 'Cathode (V vs Li)' }, cz);
    // markers
    const ya = sa(clamp(ua, 0, 0.8)), yc = sc(clamp(uc, 3.2, 4.6));
    const mark = (x, y, col, lab) => { c.fillStyle = col; c.fillRect(x - 4, y - 2, gw + 8, 4); glowDot(c, x + gw / 2, y, 7, col); text(c, lab, x + gw + 10, y + 4, { size: 12.5, weight: 700, color: C.ink }); };
    mark(gx1, ya, C.li, `${fmt(ua, 3)} V`);
    mark(gx2, yc, CHEM[s.chem].color, `${fmt(uc, 2)} V`);
    // connector showing cell voltage
    if (!m) {
      c.strokeStyle = 'rgba(231,237,243,.35)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(gx1 + gw + 70, ya); c.bezierCurveTo(gx1 + gw + 110, ya, gx2 - 50, yc, gx2 - 8, yc); c.stroke(); c.setLineDash([]);
      // label sits in the free space between the anode's value and the cathode's scale, on two lines
      const lx = (gx1 + gw + 72 + gx2 - 42) / 2, ly = (ya + yc) / 2;
      c.fillStyle = 'rgba(10,14,18,.85)'; rr(c, lx - 66, ly - 30, 132, 44, 8); c.fill();
      text(c, T({ th: 'แรงดันเซลล์', en: 'cell voltage' }), lx, ly - 12, { size: 11.5, color: C.ink3, align: 'center' });
      text(c, `${fmt(uc, 2)} − ${fmt(ua, 2)} = ${fmt(v, 2)} V`, lx, ly + 6, { size: 12, weight: 600, color: C.ink2, align: 'center' });
      // SEI meter on far right
      const mx = gx2 + gw + 110, mw = Math.min(160, W - mx - 30);
      if (mw > 80) {
        const r = seiRel(s.soc);
        text(c, T({ th: 'อัตราโต SEI', en: 'SEI growth rate' }), mx, top + 8, { size: 12, weight: 600, color: C.ink });
        rr(c, mx, top + 20, mw, 12, 6); c.fillStyle = 'rgba(160,188,214,.15)'; c.fill();
        rr(c, mx, top + 20, Math.max(8, mw * Math.min(1, r / 2)), 12, 6); c.fillStyle = mix('#2fd0b0', '#ff5b4f', clamp((r - 0.5) / 1.2, 0, 1)); c.fill();
        text(c, `×${fmt(r, 2)}`, mx, top + 54, { size: 18, weight: 700, color: C.ink, disp: true });
        text(c, T({ th: 'เทียบกับที่ 50%', en: 'vs 50% charge' }), mx, top + 72, { size: 11, color: C.ink3 });
      }
    }
    ro.set('ua', `${fmt(ua, 3)}<small>V</small>`, ua < 0.12 ? 'warn' : '');
    ro.set('uc', `${fmt(uc, 2)}<small>V</small>`, uc > 4.2 ? 'bad' : uc > 4.1 ? 'warn' : '');
    ro.set('v', `${fmt(v, 2)}<small>V</small>`);
    const r = seiRel(s.soc); ro.set('sei', `×${fmt(r, 2)}`, r > 1.3 ? 'warn' : r < 0.8 ? 'good' : '');
  });
}

// ---------------------------------------------------------------- calendar ageing chart
export function calendar(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8.6, ratioM: 0.9, minH: 320, maxH: 540 });
  const s = { chem: 'nca', soc: 0.9, temp: 30 };
  const box = ctrls();
  chips(box, { label: { th: 'เซลล์ (แบบจำลอง)', en: 'Cell (model)' }, options: ['nca', 'lfp', 'nmc'].map((k) => ({ v: k, label: AGING[k], color: AGING[k].color })), value: 'nca', onChange: (v) => { s.chem = v; recompute(); } });
  slider(box, { label: { th: '% ที่จอดเก็บ', en: 'Stored at' }, min: 10, max: 100, step: 5, value: 90, fmt: (v) => `${v}%`, color: C.li, onInput: (v) => { s.soc = v / 100; recompute(); } });
  slider(box, { label: { th: 'อุณหภูมิแบตเฉลี่ย', en: 'Average battery temperature' }, min: 15, max: 45, step: 1, value: 30, fmt: (v) => `${v}°C`, color: C.heat, onInput: (v) => { s.temp = v; recompute(); } });
  const ro = readouts(inst, [{ key: 'y1', label: { th: 'เหลือหลัง 1 ปี', en: 'Left after 1 year' } }, { key: 'y5', label: { th: 'หลัง 5 ปี', en: 'After 5 years' } }, { key: 'y10', label: { th: 'หลัง 10 ปี', en: 'After 10 years' } }, { key: 'rel', label: { th: 'เร็วกว่าจอดที่ 50% กี่เท่า', en: 'Faster than storing at 50%' } }]);
  let ref = [], main = null, base50 = null;
  const refSoc = [0.3, 0.5, 0.8, 1.0];
  function sim(soc) { return simulateLife({ chem: s.chem, years: 10, profile: new Array(24).fill(soc), tempC: s.temp, efcPerDay: 0, stepDays: 10 }); }
  function recompute() { ref = refSoc.map((x) => ({ soc: x, r: sim(x) })); main = sim(s.soc); base50 = ref[1].r; stage.request(); }
  recompute();
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const bx = { x: m ? 44 : 60, y: 66, w: W - (m ? 60 : 150), h: H - 112 };
    const lo = Math.min(70, Math.floor(Math.min(...main.q, ...ref.map((r) => Math.min(...r.r.q))) * 100 / 5) * 5);
    const sx = scale(0, 10, bx.x, bx.x + bx.w), sy = scale(lo, 100, bx.y + bx.h, bx.y);
    axes(c, bx, sx, sy, { xl: { th: 'ปี', en: 'years' }, yl: { th: 'ความจุที่เหลือ (%)', en: 'capacity left (%)' }, nx: 10 });
    for (const r of ref) {
      const pts = r.r.t.map((t, i) => [sx(t), sy(r.r.q[i] * 100)]);
      line(c, pts, { color: 'rgba(160,188,214,.45)', width: 1.3 });
      const last = pts[pts.length - 1];
      if (!m) text(c, `${fmt(r.soc * 100)}%`, last[0] + 8, last[1] + 4, { size: 11, color: C.ink3 });
    }
    const pts = main.t.map((t, i) => [sx(t), sy(main.q[i] * 100)]);
    line(c, pts, { color: AGING[s.chem].color, width: 3 });
    const last = pts[pts.length - 1];
    text(c, T({ th: `จอดที่ ${fmt(s.soc * 100)}%`, en: `stored at ${fmt(s.soc * 100)}%` }), m ? last[0] - 4 : last[0] + 8, last[1] + (m ? -10 : 4), { size: 12, weight: 700, color: AGING[s.chem].color, align: m ? 'right' : 'left' });
    // hover
    const p = stage.pointer;
    if (p.inside && p.x > bx.x && p.x < bx.x + bx.w) {
      const yr = sx.inv(p.x), i = nearestIdx(main.t, yr);
      c.strokeStyle = 'rgba(231,237,243,.35)'; c.beginPath(); c.moveTo(sx(main.t[i]), bx.y); c.lineTo(sx(main.t[i]), bx.y + bx.h); c.stroke();
      tip(c, p.x, p.y, [{ t: `${fmt(main.t[i], 1)} ${T({ th: 'ปี', en: 'yr' })}`, b: true }, { t: `${fmt(s.soc * 100)}%: ${fmt(main.q[i] * 100, 1)}%`, k: AGING[s.chem].color }, ...ref.map((r) => ({ t: `${fmt(r.soc * 100)}%: ${fmt(r.r.q[nearestIdx(r.r.t, main.t[i])] * 100, 1)}%`, k: 'rgba(160,188,214,.6)' }))], W, H);
    }
    const at = (yr) => main.q[nearestIdx(main.t, yr)] * 100;
    ro.set('y1', `${fmt(at(1), 1)}<small>%</small>`); ro.set('y5', `${fmt(at(5), 1)}<small>%</small>`); ro.set('y10', `${fmt(at(10), 1)}<small>%</small>`);
    const rel = (1 - main.q.at(-1)) / (1 - base50.q.at(-1));
    ro.set('rel', `×${fmt(rel, 2)}`, rel > 1.15 ? 'warn' : rel < 0.9 ? 'good' : '');
  });
  stage.onPointer = () => stage.request();
}

// ---------------------------------------------------------------- cracking particle
export function particle(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8, ratioM: 0.95, minH: 320, maxH: 520 });
  const s = { soc: 0.6, cyc: 0 };
  const box = ctrls();
  slider(box, { label: { th: '% แบตตอนนี้', en: 'Charge level now' }, min: 0, max: 100, step: 1, value: 60, fmt: (v) => `${v}% · ${fmt(Uc('nmc', v / 100), 2)} V vs Li`, color: C.li, onInput: (v) => { s.soc = v / 100; stage.request(); } });
  slider(box, { label: { th: 'จำนวนครั้งที่ชาร์จถึง 100%', en: 'Times charged to 100%' }, min: 0, max: 1500, step: 10, value: 0, fmt: (v) => fmt(v), color: C.heat, onInput: (v) => { s.cyc = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'st', label: { th: 'สภาพผลึก', en: 'Lattice' } }, { key: 'gap', label: { th: 'ผิวใหม่ที่สัมผัสอิเล็กโทรไลต์ (เทียบ)', en: 'Fresh surface exposed (relative)' } }]);
  // jittered hex grains
  const grains = [];
  const R = 1, step = 0.2;
  for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) {
    const x = (q + r / 2) * step * 1.02, y = r * step * 0.88;
    if (x * x + y * y > (R - 0.08) ** 2) continue;
    const j = Math.sin(q * 12.3 + r * 7.1) * 0.5 + 0.5;
    grains.push({ x: x + (j - 0.5) * 0.05, y: y + (Math.cos(q * 3.1 + r * 5.7) * 0.5) * 0.05, ang: j * Math.PI, r: step * 0.56 });
  }
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const cx = m ? W / 2 : W * 0.38, cy = H / 2 + 14, rad = Math.min(m ? W * 0.42 : W * 0.26, H * 0.38);
    const uc = Uc('nmc', s.soc);
    const live = clamp((uc - 4.08) / 0.22, 0, 1);           // reversible contraction near H2→H3
    const perm = clamp(s.cyc / 1500, 0, 1);                  // accumulated damage
    const shrink = 0.04 * live + 0.06 * Math.sqrt(perm);
    // electrolyte background
    c.beginPath(); c.arc(cx, cy, rad * 1.04, 0, 7); c.fillStyle = 'rgba(78,162,255,.10)'; c.fill();
    for (const g of grains) {
      c.save(); c.translate(cx + g.x * rad, cy + g.y * rad); c.rotate(g.ang);
      const sxk = 1 - shrink * 1.6, syk = 1 - shrink * 0.4; // anisotropic shrink
      c.scale(sxk, syk);
      c.beginPath();
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; const px = Math.cos(a) * g.r * rad, py = Math.sin(a) * g.r * rad; if (k === 0) c.moveTo(px, py); else c.lineTo(px, py); }
      c.closePath();
      const grd = c.createLinearGradient(-g.r * rad, -g.r * rad, g.r * rad, g.r * rad); grd.addColorStop(0, '#463d78'); grd.addColorStop(1, '#2a2546');
      c.fillStyle = grd; c.fill(); c.strokeStyle = 'rgba(155,140,255,.35)'; c.lineWidth = 1; c.stroke();
      // layered texture
      c.strokeStyle = 'rgba(155,140,255,.18)'; for (let l = -2; l <= 2; l++) { c.beginPath(); c.moveTo(-g.r * rad * 0.7, l * g.r * rad * 0.3); c.lineTo(g.r * rad * 0.7, l * g.r * rad * 0.3); c.stroke(); }
      c.restore();
    }
    // outline
    c.beginPath(); c.arc(cx, cy, rad * 1.04, 0, 7); c.strokeStyle = 'rgba(231,237,243,.25)'; c.stroke();
    text(c, '≈ 10 µm', cx, cy + rad * 1.04 + 22, { size: 11.5, color: C.ink3, align: 'center' });
    if (!m) {
      const tx = W * 0.66;
      const lines = [
        { th: '• เกรนเล็กๆ (primary) อัดรวมเป็นอนุภาคใหญ่ (secondary)', en: '• Small primary grains packed into a secondary particle' },
        { th: '• ชาร์จสูง: ผลึกหดไม่เท่ากันทุกทิศ ขอบเกรนแยก', en: '• High charge: grains shrink unevenly, boundaries open' },
        { th: '• อิเล็กโทรไลต์ (สีฟ้า) ซึมเข้ารอยร้าว เกิดผิวใหม่', en: '• Electrolyte (blue) seeps in, exposing fresh surface' },
        { th: '• ชาร์จเต็มซ้ำๆ รอยร้าวสะสมถาวร ความต้านทานเพิ่ม', en: '• Repeated full charges make cracks permanent; resistance climbs' },
      ];
      lines.forEach((l, i) => text(c, T(l), tx, H * 0.34 + i * 26, { size: 12.5, color: C.ink2, maxW: W - tx - 20 }));
    }
    ro.set('st', live > 0.6 ? T({ th: 'H3: หดตัวมาก', en: 'H3: strongly contracted' }) : live > 0.05 ? T({ th: 'เริ่มหดตัว', en: 'starting to contract' }) : T({ th: 'ปกติ (H1/H2)', en: 'normal (H1/H2)' }), live > 0.6 ? 'bad' : live > 0.05 ? 'warn' : 'good');
    ro.set('gap', `×${fmt(1 + 6 * shrink * 4, 1)}`);
  });
}

// ---------------------------------------------------------------- 24-hour habit comparison
export function timeline(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.6, ratioM: 0.95, minH: 320, maxH: 520 });
  const s = { target: 90, arrive: 18, depart: 7, kw: 7.4, km: 60, kwh: 60, chem: 'nca' };
  const box = ctrls();
  slider(box, { label: { th: 'ชาร์จถึง', en: 'Charge to' }, min: 60, max: 100, step: 5, value: 90, fmt: (v) => `${v}%`, color: C.li, onInput: (v) => { s.target = v; stage.request(); } });
  slider(box, { label: { th: 'ขับต่อวัน', en: 'Driven per day' }, min: 10, max: 200, step: 5, value: 60, fmt: (v) => `${v} km`, color: C.heat, onInput: (v) => { s.km = v; stage.request(); } });
  slider(box, { label: { th: 'ถึงบ้าน / ออกจากบ้าน', en: 'Arrive / leave' }, min: 16, max: 22, step: 1, value: 18, fmt: (v) => `${v}:00 → 0${s.depart}:00`, color: C.violet, onInput: (v) => { s.arrive = v; stage.request(); } });
  chips(box, { label: { th: 'ที่ชาร์จบ้าน', en: 'Home charger' }, options: [{ v: '3.7', label: { th: '3.7 kW', en: '3.7 kW' } }, { v: '7.4', label: { th: '7.4 kW', en: '7.4 kW' } }, { v: '11', label: { th: '11 kW', en: '11 kW' } }], value: '7.4', onChange: (v) => { s.kw = +v; stage.request(); } });
  chips(box, { label: { th: 'แบบจำลองเซลล์', en: 'Cell model' }, options: [{ v: 'nca', label: { th: 'NCA', en: 'NCA' }, color: AGING.nca.color }, { v: 'lfp', label: { th: 'LFP', en: 'LFP' }, color: AGING.lfp.color }], value: 'nca', onChange: (v) => { s.chem = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'ha', label: { th: 'ชม. ที่ ≥80% · ชาร์จทันที', en: 'Hours ≥80% · on arrival' } }, { key: 'hb', label: { th: 'ชม. ที่ ≥80% · ตั้งเวลา', en: 'Hours ≥80% · scheduled' } }, { key: 'rel', label: { th: 'การเสื่อมตามเวลา (ตั้งเวลา vs ทันที)', en: 'Calendar ageing (scheduled vs arrival)' } }, { key: 'cost', label: { th: 'ค่าไฟต่อเดือน TOU (ทันที → ตั้งเวลา)', en: 'Monthly TOU cost (arrival → scheduled)' } }]);
  legend(inst, [{ label: { th: 'ชาร์จทันทีที่ถึงบ้าน', en: 'Charge on arrival' }, color: C.bad }, { label: { th: 'ตั้งเวลาให้เสร็จตอนออกจากบ้าน', en: 'Scheduled to finish at departure' }, color: C.ok }, { label: { th: 'ช่วง Off-Peak (22:00–09:00)', en: 'Off-peak window (22:00–09:00)' }, color: 'rgba(78,162,255,.5)' }], inst.querySelector('.ctrls'));
  const RATE_ON = (5.7982 + 0.1623) * 1.07, RATE_OFF = (2.6369 + 0.1623) * 1.07; // THB/kWh incl. Ft & VAT
  const prof = (scheduled) => {
    // 48 half-hour samples from 12:00 to 12:00
    const use = (s.km * 0.16) / s.kwh * 100; // % per day (≈160 Wh/km)
    const lo = Math.max(5, s.target - use);
    const hrs = ((s.target - lo) / 100) * s.kwh / (s.kw * 0.92);
    const out = [];
    for (let i = 0; i <= 48; i++) {
      const h = (12 + i * 0.5) % 24; // clock hour
      const tt = 12 + i * 0.5;        // hours since previous noon
      let soc;
      const tArr = s.arrive, tDep = 24 + s.depart;
      if (tt < tArr) soc = s.target - use * 0.6 - (use * 0.4) * clamp((tt - (tArr - 1)) / 1, 0, 1);
      else if (tt >= tDep) soc = s.target - use * 0.6 * clamp((tt - tDep) / 1, 0, 1);
      else {
        const tStart = scheduled ? Math.max(tArr, tDep - hrs) : tArr;
        soc = tt < tStart ? lo : Math.min(s.target, lo + (s.target - lo) * ((tt - tStart) / hrs));
      }
      out.push({ h, tt, soc: clamp(soc, 0, 100) });
    }
    return { pts: out, hrs, lo };
  };
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const A = prof(false), B = prof(true);
    const bx = { x: m ? 40 : 56, y: 64, w: W - (m ? 56 : 90), h: H - 108 };
    const sx = scale(12, 36, bx.x, bx.x + bx.w), sy = scale(0, 100, bx.y + bx.h, bx.y);
    // off-peak shading 22→33 (09:00 next day)
    c.fillStyle = 'rgba(78,162,255,.08)'; c.fillRect(sx(22), bx.y, sx(33) - sx(22), bx.h);
    text(c, 'Off-Peak', sx(27.5), bx.y + 14, { size: 11, color: 'rgba(78,162,255,.9)', align: 'center' });
    c.fillStyle = 'rgba(255,91,79,.06)'; c.fillRect(bx.x, sy(100), bx.w, sy(80) - sy(100));
    axes(c, bx, sx, sy, { xt: [12, 15, 18, 21, 24, 27, 30, 33, 36], fx: (v) => `${String(v % 24).padStart(2, '0')}:00`, yl: { th: '% แบต', en: 'charge %' }, ny: 5 });
    line(c, A.pts.map((p) => [sx(p.tt), sy(p.soc)]), { color: C.bad, width: 2.6 });
    line(c, B.pts.map((p) => [sx(p.tt), sy(p.soc)]), { color: C.ok, width: 2.6, dash: [7, 5] });
    // metrics
    const hoursAbove = (P) => P.pts.slice(0, 48).filter((p) => p.soc >= 80).length * 0.5;
    const kAvg = (P) => { const T = K(30); const ag = AGING[s.chem]; return P.pts.slice(0, 48).reduce((a, p) => a + ag.kcal(p.soc / 100, T), 0) / 48; };
    const rel = kAvg(B) / kAvg(A);
    // cost: charging energy per day split by tariff window (weekday)
    const cost = (P) => { let e = 0; for (let i = 1; i < P.pts.length; i++) { const d = P.pts[i].soc - P.pts[i - 1].soc; if (d > 0) { const h = P.pts[i].h; const off = h >= 22 || h < 9; e += (d / 100) * s.kwh / 0.92 * (off ? RATE_OFF : RATE_ON); } } return e; };
    const monthly = (P) => cost(P) * 22 + cost(prof(true)) * 8; // weekends are off-peak all day
    ro.set('ha', `${fmt(hoursAbove(A), 1)}<small>${T({ th: 'ชม.', en: 'h' })}</small>`, 'bad');
    ro.set('hb', `${fmt(hoursAbove(B), 1)}<small>${T({ th: 'ชม.', en: 'h' })}</small>`, 'good');
    ro.set('rel', `${fmt((rel - 1) * 100, 0)}<small>%</small>`, rel < 0.98 ? 'good' : '');
    ro.set('cost', `${fmt(monthly(A))} → ${fmt(monthly(B))}<small>฿</small>`);
  });
}
