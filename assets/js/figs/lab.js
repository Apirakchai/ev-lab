// Lab-only figures
import { scaffold, slider, chips, readouts, C, T, fmt, rr, text, scale, axes, line, glowDot } from '../lib.js';
import { whPerKm } from '../models.js';

const BODY = { sedan: { m: 1850, cda: 0.5, th: 'เก๋ง', en: 'Sedan' }, suv: { m: 2050, cda: 0.62, th: 'SUV', en: 'SUV' }, mpv: { m: 2400, cda: 0.8, th: 'MPV/ตู้', en: 'MPV / van' }, small: { m: 1500, cda: 0.55, th: 'รถเล็ก', en: 'Small car' } };
export function range(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.6, ratioM: 0.85, minH: 320, maxH: 500 });
  const s = { body: 'suv', v: 100, aux: 1.2, load: 150, kwh: 75 };
  const box = ctrls();
  chips(box, { label: { th: 'ประเภทรถ', en: 'Body type' }, options: Object.entries(BODY).map(([v, o]) => ({ v, label: o })), value: 'suv', onChange: (v) => { s.body = v; stage.request(); } });
  slider(box, { label: { th: 'ความเร็วคงที่', en: 'Steady speed' }, min: 30, max: 140, step: 5, value: 100, fmt: (v) => `${v} km/h`, color: C.e, onInput: (v) => { s.v = v; stage.request(); } });
  slider(box, { label: { th: 'แอร์และระบบอื่น', en: 'A/C and other loads' }, min: 0.2, max: 3, step: 0.1, value: 1.2, fmt: (v) => `${fmt(v, 1)} kW`, color: C.heat, onInput: (v) => { s.aux = v; stage.request(); } });
  slider(box, { label: { th: 'ผู้โดยสาร + สัมภาระ', en: 'Passengers + luggage' }, min: 0, max: 500, step: 10, value: 150, fmt: (v) => `${v} kg`, color: C.violet, onInput: (v) => { s.load = v; stage.request(); } });
  slider(box, { label: { th: 'แบตที่ใช้ได้', en: 'Usable battery' }, min: 40, max: 110, step: 1, value: 75, fmt: (v) => `${v} kWh`, color: C.ok, onInput: (v) => { s.kwh = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'wh', label: { th: 'อัตรากินไฟ', en: 'Consumption' } }, { key: 'r', label: { th: 'ระยะทาง 100→0%', en: 'Range 100→0%' } }, { key: 'r2', label: { th: 'ระยะทาง 80→10%', en: 'Range 80→10%' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile, B = BODY[s.body];
    const f = (v) => whPerKm({ v, mass: B.m + s.load, cda: B.cda, aux: s.aux });
    const bx = { x: m ? 44 : 60, y: 66, w: W - (m ? 60 : 100), h: H - 110 };
    const sx = scale(30, 140, bx.x, bx.x + bx.w);
    const rmax = Math.ceil((s.kwh * 1000) / f(30).whkm / 100) * 100;
    const sy = scale(0, Math.max(300, rmax), bx.y + bx.h, bx.y);
    axes(c, bx, sx, sy, { xl: { th: 'ความเร็ว (กม./ชม.)', en: 'speed (km/h)' }, yl: { th: 'ระยะทาง (กม.)', en: 'range (km)' } });
    const pts = []; for (let v = 30; v <= 140; v += 2) pts.push([sx(v), sy((s.kwh * 1000) / f(v).whkm)]);
    line(c, pts, { color: C.ok, width: 2.6 });
    const cur = f(s.v), r = (s.kwh * 1000) / cur.whkm;
    glowDot(c, sx(s.v), sy(r), 6, C.ok);
    // breakdown bar
    if (!m) {
      const x0 = bx.x + bx.w - 250, y0 = bx.y + 6, tot = cur.whkm;
      const parts = [[{ th: 'แรงต้านอากาศ', en: 'aero drag' }, cur.aero, C.e], [{ th: 'ยาง', en: 'tyres' }, cur.roll, C.violet], [{ th: 'แอร์/ระบบ', en: 'A/C & systems' }, cur.auxWh, C.heat]];
      text(c, T({ th: `ที่ ${s.v} กม./ชม. ใช้ไฟไปกับ`, en: `At ${s.v} km/h energy goes to` }), x0, y0 + 8, { size: 11.5, color: C.ink2 });
      let x = x0;
      parts.forEach((p) => { const w = (p[1] / tot) * 240; rr(c, x, y0 + 16, Math.max(2, w - 2), 12, 3); c.fillStyle = p[2]; c.fill(); x += w; });
      parts.forEach((p, i) => text(c, `${T(p[0])} ${fmt((p[1] / tot) * 100)}%`, x0, y0 + 46 + i * 17, { size: 11, color: p[2] }));
    }
    ro.set('wh', `${fmt(cur.whkm)}<small>Wh/km</small>`);
    ro.set('r', `${fmt(r)}<small>km</small>`);
    ro.set('r2', `${fmt(r * 0.7)}<small>km</small>`);
  });
}
