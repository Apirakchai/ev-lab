// Chapter 2 figures
import { scaffold, slider, chips, readouts, legend, C, T, fmt, clamp, lerp, rr, text, glowDot, withAlpha, lang, scale, axes, line, nearestIdx, tip, ticks } from '../lib.js';
import { CHEM } from '../models.js';

const KEYS = ['lfp', 'nmc', 'nca', 'lmfp', 'na', 'lto'];
const NAME = (k) => CHEM[k].short;

// ---------------------------------------------------------------- compare (range bars)
export function compare(inst) {
  const DATA = {
    wh: { th: 'ความหนาแน่นพลังงานระดับเซลล์ (Wh/kg)', en: 'Cell energy density (Wh/kg)', log: false, min: 0, max: 320,
      v: { lfp: [160, 205], nmc: [230, 300], nca: [240, 300], lmfp: [190, 240], na: [140, 175], lto: [60, 110] } },
    cyc: { th: 'จำนวนรอบเต็มจนเหลือ ~80% (สเกลลอการิทึม)', en: 'Full cycles to ~80% (log scale)', log: true, min: 500, max: 30000,
      v: { lfp: [3000, 8000], nmc: [1500, 3000], nca: [1000, 2500], lmfp: [2000, 4000], na: [2000, 5000], lto: [10000, 30000] } },
    v: { th: 'แรงดันระบุของเซลล์ (V)', en: 'Nominal cell voltage (V)', log: false, min: 2, max: 4,
      v: { lfp: [3.2, 3.22], nmc: [3.6, 3.7], nca: [3.6, 3.65], lmfp: [3.7, 3.8], na: [3.0, 3.1], lto: [2.3, 2.4] } },
  };
  const { stage, ctrls } = scaffold(inst, { height: (w, m) => (m ? 640 : 520), minH: 420, maxH: 700, maxVH: 2 });
  let sel = ['lfp', 'nmc', 'nca', 'lmfp', 'na', 'lto'];
  chips(ctrls(), { label: { th: 'เลือกเคมี', en: 'Chemistries' }, multi: true, value: sel, options: KEYS.map((k) => ({ v: k, label: { th: NAME(k), en: NAME(k) }, color: CHEM[k].color })), onChange: (v) => { sel = KEYS.filter((k) => v.includes(k)); stage.request(); } });
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const lx = m ? 14 : 30, labW = m ? 58 : 80, rx = W - (m ? 16 : 34);
    const panels = Object.values(DATA);
    const ph = (H - 66) / panels.length;
    panels.forEach((P, pi) => {
      const y0 = 64 + pi * ph;
      text(c, T(P), lx, y0 + 4, { size: 12.5, weight: 600, color: C.ink });
      const x0 = lx + labW, x1 = rx;
      const sx = P.log ? ((v) => x0 + (Math.log10(v) - Math.log10(P.min)) / (Math.log10(P.max) - Math.log10(P.min)) * (x1 - x0)) : scale(P.min, P.max, x0, x1);
      const tks = P.log ? [500, 1000, 2000, 5000, 10000, 20000] : ticks(P.min, P.max, m ? 4 : 6);
      const rowH = Math.min(22, (ph - 46) / Math.max(1, sel.length));
      const yTop = y0 + 16, yBot = yTop + rowH * sel.length;
      for (const t of tks) { const x = Math.round(sx(t)) + 0.5; c.strokeStyle = C.grid2; c.beginPath(); c.moveTo(x, yTop); c.lineTo(x, yBot); c.stroke();
        text(c, t >= 1000 ? `${fmt(t / 1000)}k` : fmt(t, P.max <= 5 ? 1 : 0), x, yBot + 14, { size: 10.5, color: C.ink3, align: 'center' }); }
      sel.forEach((k, i) => {
        const [a, b] = P.v[k]; const y = yTop + i * rowH + rowH / 2;
        text(c, NAME(k), lx, y + 4, { size: 11.5, weight: 600, color: C.ink2 });
        const xa = sx(a), xb = sx(b);
        c.strokeStyle = CHEM[k].color; c.lineWidth = Math.max(4, rowH * 0.42); c.lineCap = 'round';
        c.beginPath(); c.moveTo(xa, y); c.lineTo(Math.max(xb, xa + 0.5), y); c.stroke(); c.lineCap = 'butt';
        const lab = P.log ? `${fmt(a)}–${fmt(b)}` : (P.max <= 5 ? fmt(a, 1) + (b - a > 0.05 ? `–${fmt(b, 1)}` : '') : `${fmt(a)}–${fmt(b)}`);
        const tx = xb + 10; const fits = tx + 70 < x1 + 30;
        text(c, lab, fits ? tx : xa - 10, y + 4, { size: 10.5, color: C.ink2, align: fits ? 'left' : 'right' });
      });
    });
  });
}

// ---------------------------------------------------------------- OCV curves
export function ocv(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8.5, ratioM: 0.9, minH: 300, maxH: 540 });
  let sel = ['lfp', 'nmc'], zoom = false;
  const box = ctrls();
  chips(box, { label: { th: 'เคมี', en: 'Chemistry' }, multi: true, value: sel, options: KEYS.map((k) => ({ v: k, label: { th: NAME(k), en: NAME(k) }, color: CHEM[k].color })), onChange: (v) => { sel = KEYS.filter((k) => v.includes(k)); stage.request(); } });
  chips(box, { label: { th: 'มุมมอง', en: 'View' }, options: [{ v: 'all', label: { th: 'ทั้งหมด', en: 'Full range' } }, { v: 'zoom', label: { th: 'ซูมช่วงแบนของ LFP', en: "Zoom into LFP's flat zone" } }], value: 'all', onChange: (v) => { zoom = v === 'zoom'; stage.request(); } });
  const xs = Array.from({ length: 201 }, (_, i) => i / 200);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const box = { x: m ? 46 : 60, y: 66, w: W - (m ? 62 : 90), h: H - (m ? 112 : 116) };
    const sx = scale(0, 100, box.x, box.x + box.w);
    const sy = zoom ? scale(3.15, 3.45, box.y + box.h, box.y) : scale(1.5, 4.4, box.y + box.h, box.y);
    axes(c, box, sx, sy, { xl: { th: '% แบต (SOC)', en: 'State of charge (%)' }, yl: { th: 'แรงดันเซลล์ (V)', en: 'Cell voltage (V)' }, fy: (v) => fmt(v, zoom ? 2 : 1), ny: zoom ? 6 : 6 });
    c.save(); c.beginPath(); c.rect(box.x, box.y - 4, box.w, box.h + 8); c.clip();
    if (sel.includes('lfp')) {
      c.fillStyle = 'rgba(47,208,176,.07)'; c.fillRect(sx(15), box.y, sx(90) - sx(15), box.h);
      text(c, T({ th: 'ช่วงแบนของ LFP', en: 'LFP plateau' }), sx(52), box.y + 16, { size: 11, color: C.ok, align: 'center' });
    }
    for (const k of sel) line(c, xs.map((s) => [sx(s * 100), sy(CHEM[k].ocv(s))]), { color: CHEM[k].color, width: 2.4 });
    c.restore();
    // direct labels at right end
    for (const k of sel) { const y = sy(CHEM[k].ocv(1)); if (y > box.y - 2 && y < box.y + box.h) text(c, NAME(k), box.x + box.w - 6, y - 8, { size: 11.5, weight: 700, color: CHEM[k].color, align: 'right' }); }
    // hover
    const p = stage.pointer;
    if (p.inside && p.x >= box.x && p.x <= box.x + box.w) {
      const s = clamp(sx.inv(p.x), 0, 100) / 100;
      c.strokeStyle = 'rgba(231,237,243,.4)'; c.beginPath(); c.moveTo(sx(s * 100), box.y); c.lineTo(sx(s * 100), box.y + box.h); c.stroke();
      const lines = [{ t: `SOC ${fmt(s * 100)}%`, b: true }, ...sel.map((k) => ({ t: `${NAME(k)}: ${fmt(CHEM[k].ocv(s), 3)} V`, k: CHEM[k].color }))];
      for (const k of sel) { const y = sy(CHEM[k].ocv(s)); if (y > box.y && y < box.y + box.h) { c.beginPath(); c.arc(sx(s * 100), y, 4.5, 0, 7); c.fillStyle = CHEM[k].color; c.fill(); c.strokeStyle = C.bg; c.lineWidth = 2; c.stroke(); } }
      tip(c, p.x, p.y, lines, W, H);
    } else if (sel.includes('lfp') && sel.includes('nmc')) {
      const d1 = (CHEM.lfp.ocv(0.9) - CHEM.lfp.ocv(0.2)) * 1000, d2 = (CHEM.nmc.ocv(0.9) - CHEM.nmc.ocv(0.2)) * 1000;
      text(c, T({ th: `จาก 20%→90%: LFP ต่างกัน ${fmt(d1)} mV · NMC ต่างกัน ${fmt(d2)} mV`, en: `From 20%→90%: LFP moves ${fmt(d1)} mV · NMC moves ${fmt(d2)} mV` }), box.x + 8, box.y + box.h - 12, { size: m ? 10.5 : 12, color: C.ink2 });
    }
  });
  stage.onPointer = () => stage.request();
}

// ---------------------------------------------------------------- lattice schematics
export function lattice(inst) {
  const { stage, ctrls } = scaffold(inst, { height: (w, m) => (m ? 760 : Math.min(430, w * 0.36)), minH: 320, maxH: 800, maxVH: 2 });
  const s = { del: 0.3 };
  slider(ctrls(), { label: { th: 'ชาร์จไปแล้ว (ลิเทียมออกจากขั้วบวก)', en: 'Charge level (lithium removed from the cathode)' }, min: 0, max: 0.95, step: 0.01, value: s.del, fmt: (v) => `${fmt(v * 100)}%`, color: C.li, onInput: (v) => { s.del = v; stage.request(); } });
  const rnd = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  stage.loop(() => {});
  stage.draw((c, W, H) => {
    const m = stage.mobile, t = stage.t;
    const panels = [
      { k: 'lay', th: 'ชั้น (NMC/NCA) · ทางเดิน 2 มิติ', en: 'Layered (NMC/NCA) · 2-D planes' },
      { k: 'oli', th: 'โอลิวีน (LFP) · อุโมงค์ 1 มิติ', en: 'Olivine (LFP) · 1-D tunnels' },
      { k: 'spi', th: 'สปิเนล (LMO) · เครือข่าย 3 มิติ', en: 'Spinel (LMO) · 3-D network' },
    ];
    const gap = 16;
    panels.forEach((P, i) => {
      const pw = m ? W - 32 : (W - 60 - gap * 2) / 3, ph = m ? (H - 70) / 3 - gap : H - 90;
      const px = m ? 16 : 30 + i * (pw + gap), py = m ? 46 + i * (ph + gap) : 56;
      rr(c, px, py, pw, ph, 12); c.fillStyle = 'rgba(21,29,37,.7)'; c.fill(); c.strokeStyle = C.line; c.stroke();
      text(c, T(P), px + 12, py + 20, { size: 12, weight: 600, color: C.ink });
      c.save(); rr(c, px, py + 30, pw, ph - 30, 12); c.clip();
      const ix = px + 12, iy = py + 34, iw = pw - 24, ih = ph - 44;
      const keep = 1 - s.del; // fraction of Li still in the cathode
      if (P.k === 'lay') {
        const nL = 5, contract = s.del > 0.75 ? (s.del - 0.75) * 0.6 : 0;
        const sp = (ih / nL) * (1 - contract);
        for (let r = 0; r < nL; r++) {
          const y = iy + r * sp + sp * 0.25;
          rr(c, ix, y, iw, sp * 0.38, 4); c.fillStyle = '#2a2a46'; c.fill(); c.strokeStyle = 'rgba(155,140,255,.4)'; c.stroke();
          for (let x = ix + 8; x < ix + iw; x += 16) { c.beginPath(); c.arc(x, y + sp * 0.19, 2.2, 0, 7); c.fillStyle = 'rgba(155,140,255,.7)'; c.fill(); }
          if (r < nL - 1) {
            const ly = y + sp * 0.69, n = Math.floor(iw / 22);
            for (let k = 0; k < n; k++) { if (rnd(k * 7 + r * 31) > keep) continue; const x = ix + ((k * 22 + (t * 18 * (rnd(k + r) - 0.5) * 2) % 22 + 22) % iw); glowDot(c, x, ly, 3.4, C.li, 0.95); }
          }
        }
        if (s.del > 0.8) { // microcracks
          c.strokeStyle = 'rgba(255,155,47,.75)'; c.lineWidth = 1.4;
          for (let k = 0; k < 3; k++) { const x = ix + iw * (0.25 + k * 0.25); c.beginPath(); c.moveTo(x, iy); for (let yy = iy; yy < iy + ih; yy += 10) c.lineTo(x + (rnd(yy + k) - 0.5) * 10, yy); c.stroke(); }
          text(c, T({ th: 'ชั้นหดตัว → รอยร้าว', en: 'sheets contract → cracks' }), ix + iw - 4, iy + ih - 6, { size: 11, weight: 600, color: C.heat, align: 'right' });
        }
      } else if (P.k === 'oli') {
        const nC = Math.max(3, Math.floor(iw / 40));
        for (let k = 0; k < nC; k++) {
          const x = ix + (k + 0.5) * (iw / nC);
          // framework (FeO6 / PO4)
          for (let y = iy + 4; y < iy + ih; y += 20) {
            c.save(); c.translate(x - iw / nC / 2 + 6, y); c.rotate(Math.PI / 4); c.fillStyle = '#26323a'; c.fillRect(-6, -6, 12, 12); c.restore();
            c.beginPath(); c.moveTo(x + iw / nC / 2 - 10, y - 7); c.lineTo(x + iw / nC / 2 - 2, y + 6); c.lineTo(x + iw / nC / 2 - 18, y + 6); c.closePath(); c.fillStyle = '#3b3550'; c.fill();
          }
          c.strokeStyle = 'rgba(255,77,101,.22)'; c.setLineDash([3, 4]); c.beginPath(); c.moveTo(x, iy); c.lineTo(x, iy + ih); c.stroke(); c.setLineDash([]);
          const n = Math.floor(ih / 22);
          for (let j = 0; j < n; j++) { if (rnd(j * 13 + k * 5) > keep) continue; const y = iy + ((j * 22 + t * 22 * (k % 2 ? 1 : -1)) % ih + ih) % ih; glowDot(c, x, y, 3.4, C.li, 0.95); }
        }
      } else {
        const cell = 34;
        for (let y = iy; y < iy + ih + cell; y += cell) for (let x = ix; x < ix + iw + cell; x += cell) {
          c.strokeStyle = 'rgba(255,155,47,.18)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + cell / 2, y + cell / 2); c.lineTo(x + cell, y); c.moveTo(x + cell / 2, y + cell / 2); c.lineTo(x + cell / 2, y + cell); c.stroke();
          c.beginPath(); c.arc(x + cell / 2, y + cell / 2, 3, 0, 7); c.fillStyle = 'rgba(255,155,47,.55)'; c.fill();
        }
        const n = Math.floor((iw * ih) / 1500);
        for (let j = 0; j < n; j++) {
          if (rnd(j * 3.3) > keep) continue;
          const ph2 = (t * 0.25 + rnd(j)) % 1, dir = Math.floor(rnd(j + 9) * 4);
          const bx = ix + rnd(j + 1) * iw, by = iy + rnd(j + 2) * ih;
          const dx = [1, -1, 1, -1][dir] * ph2 * cell, dy = [1, 1, -1, -1][dir] * ph2 * cell;
          glowDot(c, clamp(bx + dx, ix, ix + iw), clamp(by + dy, iy, iy + ih), 3.4, C.li, 0.95);
        }
      }
      c.restore();
    });
  });
}

// ---------------------------------------------------------------- cell formats to scale
export function formats(inst) {
  const F = [
    { k: '18650', th: '18650', en: '18650', w: 18, h: 65, cyl: true, ah: '~3.5 Ah', note: { th: 'แล็ปท็อป, Tesla รุ่นแรก', en: 'Laptops, early Teslas' } },
    { k: '2170', th: '2170', en: '2170', w: 21, h: 70, cyl: true, ah: '~5 Ah', note: { th: 'Model 3/Y Long Range', en: 'Model 3/Y Long Range' } },
    { k: '4680', th: '4680', en: '4680', w: 46, h: 80, cyl: true, ah: '~22–25 Ah', note: { th: 'Cybertruck, Model Y บางล็อต', en: 'Cybertruck, some Model Y' } },
    { k: 'pri', th: 'ปริซึม', en: 'Prismatic', w: 220, h: 105, cyl: false, ah: '100–300 Ah', note: { th: 'LFP ส่วนใหญ่, หลายยี่ห้อ', en: 'Most LFP, many brands' } },
    { k: 'pouch', th: 'ซอง (pouch)', en: 'Pouch', w: 350, h: 100, cyl: false, thin: true, ah: '50–80 Ah', note: { th: 'Hyundai/Kia, GM', en: 'Hyundai/Kia, GM' } },
    { k: 'blade', th: 'ใบมีด (Blade)', en: 'Blade', w: 960, h: 90, cyl: false, thin: true, ah: '130–200 Ah', note: { th: 'BYD ทุกรุ่น', en: 'All BYD models' } },
  ];
  const { stage } = scaffold(inst, { height: (w, m) => (m ? 580 : 450), minH: 300, maxH: 640, maxVH: 2 });
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    // scale: blade length (960 mm) spans most of the width
    const k = (W - (m ? 40 : 90)) / 980;
    const x0 = m ? 20 : 45;
    let y = 64;
    if (!m) {
      // row 1: small cells + prismatic + pouch side by side, row 2: blade
      let x = x0; const base = 200;
      for (const f of F.slice(0, 5)) {
        const w = f.w * k, h = f.h * k;
        const top = base - h;
        draw(f, x, top, w, h);
        text(c, T(f), x + w / 2, base + 18, { size: 12, weight: 700, color: C.ink, align: 'center' });
        text(c, f.ah, x + w / 2, base + 34, { size: 11, color: C.ink2, align: 'center' });
        x += Math.max(w, 70) + (m ? 16 : 34);
      }
      const bw = F[5].w * k, bh = F[5].h * k, by = H - 74 - bh;
      draw(F[5], x0, by, bw, bh);
      text(c, `${T(F[5])} · ≈ 1 m · ${F[5].ah}`, x0, by - 10, { size: 12, weight: 700, color: C.ink });
      text(c, T(F[5].note), x0 + bw, by - 10, { size: 11, color: C.ink2, align: 'right' });
      // ruler
      const ry = H - 32; c.strokeStyle = C.ink3; c.beginPath(); c.moveTo(x0, ry); c.lineTo(x0 + 100 * k, ry); c.moveTo(x0, ry - 4); c.lineTo(x0, ry + 4); c.moveTo(x0 + 100 * k, ry - 4); c.lineTo(x0 + 100 * k, ry + 4); c.stroke();
      text(c, '100 mm', x0 + 100 * k + 8, ry + 4, { size: 11, color: C.ink3 });
    } else {
      const k2 = (W - 40) / 980;
      let yy = 70;
      const kk = Math.min(k2 * 2.2, 2.4);
      // small cells enlarged ×2.2 on mobile for legibility (noted)
      let x = x0;
      for (const f of F.slice(0, 3)) { const w = f.w * kk, h = f.h * kk; draw(f, x, yy + 80 * kk - h, w, h); text(c, T(f), x + w / 2, yy + 80 * kk + 16, { size: 11, weight: 700, color: C.ink, align: 'center' }); text(c, f.ah, x + w / 2, yy + 80 * kk + 30, { size: 10.5, color: C.ink2, align: 'center' }); x += w + 26; }
      yy += 80 * kk + 56;
      for (const f of F.slice(3)) { const w = f.w * k2, h = f.h * k2; draw(f, x0, yy, w, h); text(c, `${T(f)} · ${f.ah}`, x0, yy - 8, { size: 11, weight: 700, color: C.ink }); yy += h + 40; }
      text(c, T({ th: 'เซลล์ทรงกระบอกขยาย 2 เท่าเพื่อให้เห็นชัด', en: 'Cylindrical cells shown 2× larger for legibility' }), x0, H - 16, { size: 10.5, color: C.ink3 });
    }
    function draw(f, x, yTop, w, h) {
      if (f.cyl) {
        const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#26313b'); g.addColorStop(0.45, '#5b6b79'); g.addColorStop(1, '#1e262e');
        rr(c, x, yTop, w, h, Math.min(4, w / 4)); c.fillStyle = g; c.fill();
        c.fillStyle = 'rgba(78,162,255,.75)'; c.fillRect(x, yTop + h * 0.08, w, Math.max(2, h * 0.05));
        c.fillStyle = '#9aa8b5'; c.fillRect(x + w * 0.3, yTop - 3, w * 0.4, 3);
      } else {
        const g = c.createLinearGradient(0, yTop, 0, yTop + h); g.addColorStop(0, f.thin ? '#3a4652' : '#33404b'); g.addColorStop(1, '#1c242c');
        rr(c, x, yTop, w, h, f.thin ? 3 : 6); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(185,196,207,.3)'; c.stroke();
        c.fillStyle = '#b9c4cf'; c.fillRect(x + w * 0.18, yTop - 4, Math.max(6, w * 0.08), 4); c.fillStyle = C.cu; c.fillRect(x + w * 0.74, yTop - 4, Math.max(6, w * 0.08), 4);
      }
    }
  });
}
