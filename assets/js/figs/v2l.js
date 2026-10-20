// Chapter 8 figures
import { scaffold, slider, chips, readouts, C, T, fmt, fmtDur, clamp, lerp, rr, text, glowDot, scale, axes, line, withAlpha } from '../lib.js';

const APPS = [
  { v: 'rice', th: 'หม้อหุงข้าว', en: 'Rice cooker', w: 700, ico: '🍚' },
  { v: 'fridge', th: 'ตู้เย็น', en: 'Fridge', w: 150, ico: '🧊', surge: 4 },
  { v: 'fan', th: 'พัดลม ×2', en: 'Fans ×2', w: 100, ico: '🌀' },
  { v: 'light', th: 'ไฟ LED', en: 'LED lights', w: 40, ico: '💡' },
  { v: 'tv', th: 'ทีวี', en: 'TV', w: 130, ico: '📺' },
  { v: 'router', th: 'เราเตอร์ + มือถือ', en: 'Router + phones', w: 40, ico: '📶' },
  { v: 'laptop', th: 'โน้ตบุ๊ก', en: 'Laptop', w: 65, ico: '💻' },
  { v: 'ac9', th: 'แอร์อินเวอร์เตอร์ 9,000 BTU', en: 'Inverter A/C 9,000 BTU', w: 800, ico: '❄️', surge: 1.5 },
  { v: 'kettle', th: 'กาต้มน้ำ', en: 'Kettle', w: 1800, ico: '🫖' },
  { v: 'micro', th: 'ไมโครเวฟ', en: 'Microwave', w: 1100, ico: '📦' },
  { v: 'induct', th: 'เตาแม่เหล็กไฟฟ้า', en: 'Induction hob', w: 1800, ico: '🍳' },
  { v: 'pump', th: 'ปั๊มน้ำ', en: 'Water pump', w: 400, ico: '💧', surge: 3 },
];

export function flow(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.6, height: (w, m) => (m ? 372 : w / (16 / 7.6)), minH: 320, maxH: 500 });
  const s = { on: ['rice', 'fridge', 'fan', 'light', 'router'], lim: 3.3, kwh: 75, soc: 80, min: 20 };
  const box = ctrls();
  chips(box, { label: { th: 'เครื่องใช้ไฟฟ้าที่เปิด', en: 'Appliances switched on' }, multi: true, value: s.on, options: APPS.map((a) => ({ v: a.v, label: { th: `${a.th} ${fmt(a.w)} W`, en: `${a.en} ${fmt(a.w)} W` } })), onChange: (v) => { s.on = v; stage.request(); } });
  chips(box, { label: { th: 'V2L สูงสุดของรถ', en: "Car's V2L limit" }, options: ['2.2', '3.3', '3.6', '6.6'].map((v) => ({ v, label: { th: `${v} kW`, en: `${v} kW` } })), value: '3.3', onChange: (v) => { s.lim = +v; stage.request(); } });
  slider(box, { label: { th: 'แบตรถ', en: 'Battery size' }, min: 40, max: 100, step: 1, value: 75, fmt: (v) => `${v} kWh`, color: C.ok, onInput: (v) => { s.kwh = v; stage.request(); } });
  slider(box, { label: { th: '% ตอนเริ่ม', en: 'Charge at start' }, min: 20, max: 100, step: 1, value: 80, fmt: (v) => `${v}%`, color: C.ok, onInput: (v) => { s.soc = v; stage.request(); } });
  slider(box, { label: { th: 'หยุดจ่ายที่', en: 'Stop supplying at' }, min: 10, max: 50, step: 5, value: 20, fmt: (v) => `${v}%`, color: C.bad, onInput: (v) => { s.min = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'load', label: { th: 'โหลดรวม', en: 'Total load' } }, { key: 'time', label: { th: 'ใช้ได้นาน', en: 'Runs for' } }, { key: 'pct', label: { th: 'แบตลดลงต่อชั่วโมง', en: 'Battery used per hour' } }, { key: 'cyc', label: { th: 'เท่ากับรอบชาร์จ', en: 'Equivalent cycles' } }]);
  stage.loop(() => {});
  stage.draw((c, W, H) => {
    const m = stage.mobile, t = stage.t;
    const on = APPS.filter((a) => s.on.includes(a.v));
    const load = on.reduce((a, x) => a + x.w, 0);
    const over = load / 1000 > s.lim;
    const pBat = (Math.min(load, s.lim * 1000) / 0.9 + 150) / 1000; // kW from battery
    const usable = s.kwh * Math.max(0, s.soc - s.min) / 100;
    const hrs = usable / pBat;
    // layout: battery → inverter → outlet → appliance grid
    const y = m ? 110 : H * 0.5, bxW = m ? 70 : 110;
    const bx = m ? 20 : 40, ix = m ? W * 0.42 - 34 : W * 0.32, ox = m ? W - 70 : W * 0.52;
    // battery
    rr(c, bx, y - 34, bxW, 68, 10); c.fillStyle = '#16212a'; c.fill(); c.strokeStyle = C.ok; c.lineWidth = 1.5; c.stroke();
    rr(c, bx + 6, y - 28, (bxW - 12) * (s.soc / 100), 56, 6); c.fillStyle = 'rgba(47,208,176,.45)'; c.fill();
    text(c, `${s.soc}%`, bx + bxW / 2, y + 5, { size: 14, weight: 700, color: C.ink, align: 'center' });
    text(c, T({ th: 'แบต DC ~400 V', en: 'DC pack ~400 V' }), bx + bxW / 2, y + 52, { size: 11, color: C.ink2, align: 'center' });
    // inverter
    rr(c, ix, y - 30, 68, 60, 10); c.fillStyle = '#1a1830'; c.fill(); c.strokeStyle = C.violet; c.stroke();
    text(c, 'DC→AC', ix + 34, y + 5, { size: 12, weight: 700, color: C.ink, align: 'center' });
    text(c, T({ th: 'อินเวอร์เตอร์ (OBC)', en: 'Inverter (OBC)' }), ix + 34, y + 48, { size: 11, color: C.ink2, align: 'center' });
    // DC flow dots
    const flowDots = (x1, x2, col, speed, wave) => {
      const n = Math.max(4, Math.round((x2 - x1) / 22));
      for (let k = 0; k < n; k++) { const ph = (k / n + t * speed) % 1; const xx = lerp(x1, x2, ph); const yy = wave ? y + Math.sin(ph * Math.PI * 8 - t * 6) * 8 : y; glowDot(c, xx, yy, 2.6, col, 0.9); }
    };
    c.strokeStyle = 'rgba(160,188,214,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx + bxW, y); c.lineTo(ix, y); c.stroke();
    if (load > 0) flowDots(bx + bxW + 4, ix - 4, C.ok, 0.25 * clamp(pBat / 2, 0.2, 1.5), false);
    // AC sine to outlet
    if (!m) {
      c.strokeStyle = 'rgba(155,140,255,.5)'; c.beginPath();
      for (let x = ix + 68; x <= ox; x += 2) { const yy = y + Math.sin((x - ix) * 0.08 - t * 6) * 12; if (x === ix + 68) c.moveTo(x, yy); else c.lineTo(x, yy); }
      c.stroke();
      text(c, '230 V · 50 Hz', (ix + 68 + ox) / 2, y - 24, { size: 11.5, weight: 600, color: C.violet, align: 'center' });
    }
    // outlet
    const oxx = m ? W - 66 : ox;
    rr(c, oxx, y - 26, 52, 52, 12); c.fillStyle = '#e7edf3'; c.fill();
    c.fillStyle = '#0a0e12'; c.fillRect(oxx + 16, y - 10, 5, 12); c.fillRect(oxx + 31, y - 10, 5, 12); c.beginPath(); c.arc(oxx + 26, y + 12, 4, 0, 7); c.fill();
    // load meter
    const mx = m ? 20 : W * 0.62, mw = m ? W - 40 : W * 0.34, my = m ? y + 86 : y - 100;
    text(c, T({ th: 'โหลดเทียบขีดจำกัด V2L', en: 'Load vs V2L limit' }), mx, my - 8, { size: 12, weight: 600, color: C.ink });
    rr(c, mx, my, mw, 14, 7); c.fillStyle = 'rgba(160,188,214,.15)'; c.fill();
    rr(c, mx, my, Math.max(8, mw * Math.min(1, load / 1000 / 7)), 14, 7); c.fillStyle = over ? C.bad : C.violet; c.fill();
    const lx = mx + mw * (s.lim / 7); c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, my - 5); c.lineTo(lx, my + 19); c.stroke();
    text(c, `${fmt(load / 1000, 2)} / ${s.lim} kW`, mx, my + 34, { size: 13, weight: 700, color: over ? C.bad : C.ink });
    if (over) text(c, T({ th: 'เกินพิกัด: รถจะตัดการจ่ายไฟ', en: 'Over the limit: the car will cut power' }), mx, my + 54, { size: 12, color: C.bad });
    // appliance icons (what is switched on)
    {
      const per = m ? Math.max(5, Math.floor((W - 40 + 8) / 48)) : 5;
      const ax = m ? 20 : W * 0.62, ay = m ? my + (over ? 72 : 54) : my + 80;
      if (m) text(c, T({ th: 'เปิดอยู่', en: 'Switched on' }), ax, ay - 8, { size: 11.5, color: C.ink3 });
      on.slice(0, per * 2).forEach((a, k) => { const xx = ax + (k % per) * 48, yy = ay + Math.floor(k / per) * 46; rr(c, xx, yy, 40, 40, 10); c.fillStyle = '#151d25'; c.fill(); c.font = '20px system-ui'; c.textAlign = 'center'; c.fillText(a.ico, xx + 20, yy + 28); });
      if (!on.length) text(c, T({ th: 'ยังไม่ได้เปิดเครื่องใช้ไฟฟ้า', en: 'Nothing switched on yet' }), ax, ay + 24, { size: 12, color: C.ink3 });
    }
    ro.set('load', `${fmt(load)}<small>W</small>`, over ? 'bad' : '');
    ro.set('time', over ? '–' : hrs > 48 ? `${fmt(hrs / 24, 1)}<small>${T({ th: 'วัน', en: 'days' })}</small>` : fmtDur(hrs * 60));
    ro.set('pct', `${fmt((pBat / s.kwh) * 100, 1)}<small>%</small>`);
    ro.set('cyc', fmt(usable / s.kwh, 2));
  });
}

export function pwm(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8, ratioM: 0.85, minH: 320, maxH: 500 });
  const s = { fc: 15, mi: 0.85 };
  const box = ctrls();
  slider(box, { label: { th: 'จำนวนพัลส์ต่อรอบ (ความถี่สวิตช์)', en: 'Pulses per cycle (switching frequency)' }, min: 5, max: 60, step: 1, value: 15, fmt: (v) => `${v}×`, color: C.violet, onInput: (v) => { s.fc = v; stage.request(); } });
  slider(box, { label: { th: 'ดัชนีมอดูเลชัน (ขนาดคลื่น)', en: 'Modulation index (amplitude)' }, min: 0.2, max: 1, step: 0.01, value: 0.85, fmt: (v) => fmt(v, 2), color: C.ok, onInput: (v) => { s.mi = v; stage.request(); } });
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const N = 900, x0 = m ? 16 : 40, x1 = W - (m ? 16 : 40);
    const rows = [{ y: 90, h: (H - 140) * 0.32 }, { y: 0, h: (H - 140) * 0.26 }, { y: 0, h: (H - 140) * 0.32 }];
    rows[1].y = rows[0].y + rows[0].h + 34; rows[2].y = rows[1].y + rows[1].h + 34;
    const X = (k) => x0 + (k / N) * (x1 - x0);
    const ref = (k) => s.mi * Math.sin((2 * Math.PI * k) / N);
    const tri = (k) => { const ph = ((k / N) * s.fc) % 1; return ph < 0.5 ? -1 + 4 * ph : 3 - 4 * ph; };
    const sw = (k) => (ref(k) > tri(k) ? 1 : -1);
    // panel 1: reference & carrier
    const yc = (r, v) => r.y + r.h / 2 - (v * r.h) / 2;
    text(c, T({ th: '1) คลื่นไซน์อ้างอิง เทียบกับคลื่นสามเหลี่ยม', en: '1) sine reference vs triangle carrier' }), x0, rows[0].y - 12, { size: 11.5, color: C.ink2 });
    line(c, Array.from({ length: N + 1 }, (_, k) => [X(k), yc(rows[0], tri(k))]), { color: 'rgba(160,188,214,.45)', width: 1 });
    line(c, Array.from({ length: N + 1 }, (_, k) => [X(k), yc(rows[0], ref(k))]), { color: C.ok, width: 2.2 });
    // panel 2: switch output
    text(c, T({ th: '2) แรงดันที่สวิตช์ออกมา (เปิด/ปิด ±V)', en: '2) switched output (±V on/off)' }), x0, rows[1].y - 12, { size: 11.5, color: C.ink2 });
    const pts = []; for (let k = 0; k <= N; k++) { pts.push([X(k), yc(rows[1], sw(k) * 0.9)]); }
    line(c, pts, { color: C.violet, width: 1.4 });
    // panel 3: filtered
    text(c, T({ th: '3) หลังผ่านตัวกรอง LC ได้คลื่นไซน์ 50 Hz', en: '3) after the LC filter: a 50 Hz sine' }), x0, rows[2].y - 12, { size: 11.5, color: C.ink2 });
    let f = 0, g = 0; const out = []; const a = 1 / (N / (s.fc * 4.4));
    for (let pass = 0; pass < 3; pass++) for (let k = 0; k <= N; k++) { f += (sw(k) - f) * a; g += (f - g) * a; if (pass === 2) out.push([X(k), yc(rows[2], g * 1.15)]); }
    line(c, out, { color: C.e, width: 2.2 });
    line(c, Array.from({ length: N + 1 }, (_, k) => [X(k), yc(rows[2], ref(k))]), { color: 'rgba(47,208,176,.4)', width: 1, dash: [4, 4] });
  });
}
