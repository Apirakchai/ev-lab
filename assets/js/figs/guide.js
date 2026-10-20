// Chapter 11 figures (also used by the lab)
import { scaffold, slider, chips, readouts, C, T, fmt, rr, text, scale, wrapLines } from '../lib.js';

const FT = 0.1623, VAT = 1.07;
export function billNormal(kwh) {
  const b1 = Math.min(kwh, 150), b2 = Math.min(Math.max(kwh - 150, 0), 250), b3 = Math.max(kwh - 400, 0);
  return (b1 * 3.2484 + b2 * 4.2218 + b3 * 4.4217 + kwh * FT + 24.62) * VAT;
}
export function billTou(on, off) { return (on * 5.7982 + off * 2.6369 + (on + off) * FT + 24.62) * VAT; }

export function tou(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 5.6, height: (w, m) => (m ? 236 : w / (16 / 5.6)), minH: 220, maxH: 320 });
  const s = { house: 500, houseOff: 40, km: 1500, evOff: 100 };
  const box = ctrls();
  slider(box, { label: { th: 'ไฟบ้าน (ไม่รวมรถ) ต่อเดือน', en: 'Home use (excluding car) per month' }, min: 100, max: 2000, step: 10, value: 500, fmt: (v) => `${fmt(v)} kWh`, color: C.violet, onInput: (v) => { s.house = v; stage.request(); } });
  slider(box, { label: { th: 'ไฟบ้านที่ใช้ช่วง Off-Peak', en: 'Home use falling off-peak' }, min: 0, max: 100, step: 5, value: 40, fmt: (v) => `${v}%`, color: C.e, onInput: (v) => { s.houseOff = v; stage.request(); } });
  slider(box, { label: { th: 'ขับต่อเดือน', en: 'Driven per month' }, min: 0, max: 6000, step: 100, value: 1500, fmt: (v) => `${fmt(v)} km`, color: C.heat, onInput: (v) => { s.km = v; stage.request(); } });
  slider(box, { label: { th: 'ชาร์จรถช่วง Off-Peak', en: 'Car charging off-peak' }, min: 0, max: 100, step: 5, value: 100, fmt: (v) => `${v}%`, color: C.ok, onInput: (v) => { s.evOff = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'n', label: { th: 'อัตราปกติ', en: 'Normal tariff' } }, { key: 't', label: { th: 'TOU', en: 'TOU' } }, { key: 'd', label: { th: 'ต่อปี ประหยัด/แพงขึ้น', en: 'Per year, saved / extra' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const ev = (s.km * 0.16) / 0.93;
    const on = s.house * (1 - s.houseOff / 100) + ev * (1 - s.evOff / 100), off = s.house * (s.houseOff / 100) + ev * (s.evOff / 100);
    const n = billNormal(s.house + ev), t = billTou(on, off);
    const x0 = m ? 20 : 40, x1 = W - (m ? 20 : 40), max = Math.max(n, t);
    const sx = scale(0, max, x0, x1 - 78); // room for the baht label after the longest bar
    [[{ th: 'อัตราปกติ (ก้าวหน้า)', en: 'Normal (progressive)' }, n, '#b9c4cf'], [{ th: 'TOU', en: 'TOU' }, t, t < n ? C.ok : C.bad]].forEach((r, i) => {
      const y = 74 + i * (m ? 62 : 70);
      text(c, T(r[0]), x0, y, { size: 12.5, weight: 600, color: C.ink2 });
      rr(c, x0, y + 8, Math.max(8, sx(r[1]) - x0), 22, 6); c.fillStyle = r[2]; c.fill();
      text(c, `${fmt(r[1])} ฿`, sx(r[1]) + 8, y + 24, { size: 13, weight: 700, color: C.ink });
    });
    text(c, T({ th: `รถใช้ไฟราว ${fmt(ev)} kWh/เดือน`, en: `car uses about ${fmt(ev)} kWh/month` }), x0, H - 18, { size: 11.5, color: C.ink3 });
    ro.set('n', `${fmt(n)}<small>฿</small>`); ro.set('t', `${fmt(t)}<small>฿</small>`, t < n ? 'good' : 'bad');
    ro.set('d', `${t < n ? '−' : '+'}${fmt(Math.abs(n - t) * 12)}<small>฿</small>`, t < n ? 'good' : 'bad');
  });
}

export function cost(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7, ratioM: 0.95, minH: 300, maxH: 460 });
  const s = { wh: 160, kmy: 20000, kml: 14, fuel: 41.44, dcOn: 7.5, dcOff: 4.8 };
  const box = ctrls();
  slider(box, { label: { th: 'รถไฟฟ้ากินไฟ', en: 'EV consumption' }, min: 110, max: 250, step: 5, value: 160, fmt: (v) => `${v} Wh/km`, color: C.ok, onInput: (v) => { s.wh = v; stage.request(); } });
  slider(box, { label: { th: 'ขับต่อปี', en: 'Driven per year' }, min: 5000, max: 60000, step: 1000, value: 20000, fmt: (v) => `${fmt(v)} km`, color: C.violet, onInput: (v) => { s.kmy = v; stage.request(); } });
  slider(box, { label: { th: 'รถน้ำมันที่เทียบ', en: 'Petrol car compared' }, min: 8, max: 25, step: 0.5, value: 14, fmt: (v) => `${fmt(v, 1)} km/L`, color: C.heat, onInput: (v) => { s.kml = v; stage.request(); } });
  slider(box, { label: { th: 'ราคาน้ำมัน', en: 'Fuel price' }, min: 25, max: 50, step: 0.1, value: 41.44, fmt: (v) => `${fmt(v, 2)} ฿/L`, color: C.heat, onInput: (v) => { s.fuel = v; stage.request(); } });
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const kwhKm = s.wh / 1000;
    const rows = [
      { l: { th: 'บ้าน TOU Off-Peak', en: 'Home, TOU off-peak' }, v: (kwhKm / 0.93) * (2.6369 + FT) * VAT, k: '#2fd0b0' },
      { l: { th: 'บ้าน อัตราปกติ (หน่วยที่เกิน 400)', en: 'Home, normal tariff (units above 400)' }, v: (kwhKm / 0.93) * (4.4217 + FT) * VAT, k: '#4ea2ff' },
      { l: { th: 'DC สาธารณะ Off-Peak', en: 'Public DC, off-peak' }, v: (kwhKm / 0.95) * s.dcOff, k: '#9b8cff' },
      { l: { th: 'DC สาธารณะ On-Peak', en: 'Public DC, on-peak' }, v: (kwhKm / 0.95) * s.dcOn, k: '#e0628f' },
      { l: { th: `รถน้ำมัน ${fmt(s.kml, 1)} กม./ลิตร`, en: `Petrol car, ${fmt(s.kml, 1)} km/L` }, v: s.fuel / s.kml, k: '#ff9b2f' },
    ];
    const labW = m ? W * 0.4 : 280, x0 = (m ? 14 : 30) + labW, x1 = W - (m ? 56 : 150);
    const sx = scale(0, Math.max(...rows.map((r) => r.v)) * 1.05, x0, x1);
    const rh = Math.min(48, (H - 90) / rows.length);
    text(c, m ? T({ th: 'บาท/กม.', en: 'THB/km' }) : T({ th: 'บาท/กม. · บาท/ปี', en: 'THB/km · THB/year' }), W - (m ? 14 : 30), 62, { size: 11, color: C.ink3, align: 'right' });
    rows.forEach((r, i) => {
      const y = 76 + i * rh;
      const ls = wrapLines(c, T(r.l), labW - 12, m ? 10.5 : 12);
      ls.forEach((ln, j) => text(c, ln, x0 - 10, y + rh / 2 + (j - (ls.length - 1) / 2) * 13, { size: m ? 10.5 : 12, color: C.ink2, align: 'right' }));
      rr(c, x0, y + rh / 2 - 13, Math.max(6, sx(r.v) - x0), 18, 5); c.fillStyle = r.k; c.fill();
      text(c, `${fmt(r.v, 2)}`, sx(r.v) + 8, y + rh / 2 + 1, { size: 12.5, weight: 700, color: C.ink });
      if (!m) text(c, `${fmt(r.v * s.kmy)} ฿`, W - 30, y + rh / 2 + 1, { size: 12, color: C.ink2, align: 'right' });
      else text(c, `${fmt(r.v * s.kmy / 1000, 1)}k ฿/${T({ th: 'ปี', en: 'yr' })}`, x0, y + rh / 2 + 18, { size: 10, color: C.ink3 });
    });
  });
}
