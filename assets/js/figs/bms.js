// Chapter 9 figures
import { scaffold, slider, chips, button, readouts, legend, C, T, fmt, clamp, lerp, rr, text, scale, axes, line, area, glowDot, withAlpha, mix } from '../lib.js';
import { CHEM } from '../models.js';

// ---------------------------------------------------------------- SOC estimation drift
export function soc(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.6, ratioM: 0.9, minH: 320, maxH: 500 });
  const s = { chem: 'lfp', off: 0.3, full: 'never', target: 80 };
  const box = ctrls();
  chips(box, { label: { th: 'เคมี', en: 'Chemistry' }, options: [{ v: 'nmc', label: { th: 'NMC', en: 'NMC' }, color: CHEM.nmc.color }, { v: 'lfp', label: { th: 'LFP', en: 'LFP' }, color: CHEM.lfp.color }], value: s.chem, onChange: (v) => { s.chem = v; stage.request(); } });
  slider(box, { label: { th: 'ความคลาดเคลื่อนเซนเซอร์กระแส', en: 'Current-sensor offset' }, min: 0, max: 0.6, step: 0.05, value: s.off, fmt: (v) => `${fmt(v, 2)} A`, color: C.bad, onInput: (v) => { s.off = v; stage.request(); } });
  chips(box, { label: { th: 'ชาร์จเต็ม 100%', en: 'Full 100% charge' }, options: [{ v: 'never', label: { th: 'ไม่เคย', en: 'never' } }, { v: 'week', label: { th: 'สัปดาห์ละครั้ง', en: 'once a week' } }], value: s.full, onChange: (v) => { s.full = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'max', label: { th: 'คลาดเคลื่อนสูงสุด', en: 'Largest error' } }, { key: 'end', label: { th: 'คลาดเคลื่อนวันสุดท้าย', en: 'Error on the last day' } }]);
  legend(inst, [{ label: { th: '% จริง', en: 'true %' }, color: '#e7edf3' }, { label: { th: '% ที่ BMS ประเมิน', en: 'BMS estimate' }, color: C.heat }], inst.querySelector('.ctrls'));
  const AH = 200, DT = 0.25; // hours
  function run() {
    let tr = 0.8, es = 0.8; const out = { t: [], tr: [], es: [] };
    const slope = (x) => { const h = 0.01; return Math.abs(CHEM[s.chem].ocv(Math.min(1, x + h)) - CHEM[s.chem].ocv(Math.max(0, x - h))) / (2 * h); };
    for (let k = 0; k <= 14 * 24 / DT; k++) {
      const t = k * DT, day = Math.floor(t / 24), h = t % 24;
      const full = s.full === 'week' && day % 7 === 5;
      const tgt = full ? 1 : s.target / 100;
      let I = 0, rest = false; // A, + = discharge
      if ((h >= 7 && h < 8) || (h >= 17 && h < 18)) I = 0.12 * AH;          // driving
      else if (h >= 22 || h < 4) { if (tr < tgt) I = -0.1 * AH; else rest = true; } // overnight charging
      else rest = true;
      tr = clamp(tr - (I * DT) / AH, 0, 1);
      es = es - ((I + s.off) * DT) / AH; // sensor reads current + offset
      if (rest) { const k1 = clamp(Math.pow(slope(tr) / 0.8, 2) * 0.45, 0, 0.45); es += (tr - es) * k1 * DT * 4; }
      if (I < 0 && tr >= 0.999) es += (1 - es) * 0.6; // charger termination re-anchors at the top
      es = clamp(es, 0, 1);
      if (k % 2 === 0) { out.t.push(t / 24); out.tr.push(tr * 100); out.es.push(es * 100); }
    }
    return out;
  }
  stage.draw((c, W, H) => {
    const m = stage.mobile, r = run();
    const bx = { x: m ? 40 : 56, y: 66, w: W - (m ? 56 : 90), h: H - 108 };
    const sx = scale(0, 14, bx.x, bx.x + bx.w), sy = scale(0, 100, bx.y + bx.h, bx.y);
    axes(c, bx, sx, sy, { xl: { th: 'วัน', en: 'days' }, yl: { th: '% แบต', en: 'charge %' }, nx: 7 });
    const pt = r.t.map((t, i) => [sx(t), sy(r.tr[i])]), pe = r.t.map((t, i) => [sx(t), sy(r.es[i])]);
    c.save(); c.beginPath(); pt.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); for (let i = pe.length - 1; i >= 0; i--) c.lineTo(pe[i][0], pe[i][1]); c.closePath(); c.fillStyle = 'rgba(255,155,47,.18)'; c.fill(); c.restore();
    line(c, pt, { color: '#e7edf3', width: 1.8 });
    line(c, pe, { color: C.heat, width: 2.2 });
    const err = r.tr.map((x, i) => Math.abs(x - r.es[i]));
    ro.set('max', `${fmt(Math.max(...err), 1)}<small>%</small>`, Math.max(...err) > 5 ? 'warn' : 'good');
    ro.set('end', `${fmt(err.at(-1), 1)}<small>%</small>`);
  });
}

// ---------------------------------------------------------------- balancing
export function balance(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7, ratioM: 0.95, minH: 300, maxH: 460 });
  const N = 8;
  const cap = [1.0, 0.975, 1.02, 0.99, 1.03, 0.985, 1.01, 0.97];
  const init = [0.52, 0.47, 0.55, 0.5, 0.45, 0.58, 0.49, 0.53];
  const s = { soc: [...init], mode: 'charge', bal: 'passive', bled: 0, status: '' };
  const box = ctrls();
  const modeCh = chips(box, { label: { th: 'สถานะ', en: 'Mode' }, options: [{ v: 'charge', label: { th: 'ชาร์จ', en: 'Charge' } }, { v: 'drive', label: { th: 'ใช้งาน', en: 'Drive' } }], value: 'charge', onChange: (v) => { s.mode = v; } });
  const rb = document.createElement('div'); rb.className = 'ctl'; box.appendChild(rb);
  button(rb, { label: { th: 'เริ่มใหม่', en: 'Reset' }, onClick: () => { s.soc = [...init]; s.bled = 0; s.mode = 'charge'; modeCh.set('charge'); } });
  chips(box, { label: { th: 'การบาลานซ์', en: 'Balancing' }, options: [{ v: 'off', label: { th: 'ปิด', en: 'Off' } }, { v: 'passive', label: { th: 'พาสซีฟ (ระบายเป็นความร้อน)', en: 'Passive (bleed as heat)' } }, { v: 'active', label: { th: 'แอคทีฟ (ย้ายพลังงาน)', en: 'Active (move energy)' } }], value: 'passive', onChange: (v) => { s.bal = v; } });
  const ro = readouts(inst, [{ key: 'spread', label: { th: 'ต่างกันสูงสุด-ต่ำสุด', en: 'Spread (max − min)' } }, { key: 'st', label: { th: 'สถานะ', en: 'Status' } }, { key: 'bled', label: { th: 'พลังงานที่ระบายทิ้ง', en: 'Energy bled off' } }]);
  stage.loop((dt) => {
    const k = dt * 0.06;
    const mx = Math.max(...s.soc), mn = Math.min(...s.soc);
    if (s.mode === 'charge') {
      if (mx < 0.999) { const I = mx > 0.9 ? 0.25 : 1; for (let i = 0; i < N; i++) s.soc[i] = Math.min(1, s.soc[i] + (k * I) / cap[i]); s.status = mx > 0.9 ? 'taper' : 'charging'; }
      else s.status = 'top';
      if (s.bal !== 'off' && mx > 0.75) {
        for (let i = 0; i < N; i++) {
          const d = s.soc[i] - mn;
          if (d > 0.004) {
            const b = Math.min(d, k * 0.18);
            s.soc[i] -= b; s.bled += s.bal === 'passive' ? b * cap[i] : 0;
            if (s.bal === 'active') { const j = s.soc.indexOf(Math.min(...s.soc)); s.soc[j] += (b * cap[i] * 0.9) / cap[j]; }
          }
        }
      }
    } else {
      if (mn > 0.001) { for (let i = 0; i < N; i++) s.soc[i] = Math.max(0, s.soc[i] - k / cap[i]); s.status = 'driving'; }
      else s.status = 'empty';
    }
  });
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const x0 = m ? 20 : 50, x1 = W - (m ? 20 : 50), top = 70, bot = H - 50;
    const bw = (x1 - x0) / N;
    const mx = Math.max(...s.soc), mn = Math.min(...s.soc);
    for (let i = 0; i < N; i++) {
      const x = x0 + i * bw + bw * 0.18, w = bw * 0.64, hMax = (bot - top) * cap[i] / 1.03;
      const y0 = bot - hMax;
      rr(c, x, y0, w, hMax, 8); c.fillStyle = 'rgba(160,188,214,.08)'; c.fill(); c.strokeStyle = 'rgba(160,188,214,.35)'; c.stroke();
      rr(c, x + w * 0.3, y0 - 7, w * 0.4, 6, 2); c.fillStyle = 'rgba(160,188,214,.35)'; c.fill();
      const fh = hMax * s.soc[i];
      const col = s.soc[i] === mx ? C.warn : s.soc[i] === mn ? C.e : C.ok;
      c.save(); rr(c, x, y0, w, hMax, 8); c.clip(); c.fillStyle = withAlpha(col, 0.75); c.fillRect(x, bot - fh, w, fh); c.restore();
      text(c, `${fmt(s.soc[i] * 100, 1)}%`, x + w / 2, bot - fh - 8 > top ? bot - fh - 8 : top + 12, { size: m ? 10 : 11.5, weight: 700, color: C.ink, align: 'center' });
      text(c, `#${i + 1}`, x + w / 2, bot + 18, { size: 11, color: C.ink3, align: 'center' });
      if (s.mode === 'charge' && s.bal === 'passive' && mx > 0.75 && s.soc[i] - mn > 0.004) { glowDot(c, x + w / 2, y0 + 14, 4, C.heat); }
    }
    const stT = { charging: { th: 'กำลังชาร์จ', en: 'Charging' }, taper: { th: 'ใกล้เต็ม: ลดกระแสและบาลานซ์', en: 'Near full: tapering and balancing' }, top: { th: 'หยุด: กลุ่มที่สูงสุดเต็มแล้ว', en: 'Stopped: the highest group is full' }, driving: { th: 'กำลังใช้งาน', en: 'Driving' }, empty: { th: 'หยุด: กลุ่มที่ต่ำสุดหมดแล้ว', en: 'Stopped: the lowest group is empty' } }[s.status] || { th: '–', en: '–' };
    ro.set('spread', `${fmt((mx - mn) * 100, 1)}<small>%</small>`, mx - mn > 0.05 ? 'warn' : 'good');
    ro.set('st', T(stT));
    ro.set('bled', `${fmt(s.bled * 100 / N, 2)}<small>%</small>`);
  });
}
