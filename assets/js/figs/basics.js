// Chapter 1 figures
import { scaffold, slider, select, chips, readouts, legend, note, C, T, fmt, clamp, lerp, rr, text, glowDot, dot, withAlpha, lang, arrow, line } from '../lib.js';
import { CHEM } from '../models.js';

const hash = (i) => { const x = Math.sin(i * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- cell
export function cell(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 8.2, ratioM: 4 / 5, minH: 300, maxH: 560 });
  const N = 18; // lithium "units"
  const state = { mode: 'charge', c: 1, soc: 0.25 };
  // each Li: where it rests (cathode site i / anode site j), travelling progress
  const li = Array.from({ length: N }, (_, i) => ({ side: i < Math.round(N * (1 - state.soc)) ? 'c' : 'a', k: 0, mv: false, lane: hash(i) }));
  const elecs = [];
  let acc = 0;
  const box = ctrls();
  chips(box, { label: { th: 'สถานะ', en: 'What the car is doing' }, options: [{ v: 'charge', label: { th: 'กำลังชาร์จ', en: 'Charging' } }, { v: 'drive', label: { th: 'กำลังขับ (ใช้ไฟ)', en: 'Driving (discharging)' } }], value: 'charge', onChange: (v) => { state.mode = v; } });
  slider(box, { label: { th: 'กระแส (C-rate)', en: 'Current (C-rate)' }, min: 0.2, max: 3, step: 0.1, value: 1, fmt: (v) => `${fmt(v, 1)}C`, color: C.li, onInput: (v) => (state.c = v) });
  const ro = readouts(inst, [{ key: 'soc', label: { th: '% แบต (SOC)', en: 'State of charge' } }, { key: 'v', label: { th: 'แรงดันเซลล์ (NMC)', en: 'Cell voltage (NMC)' } }, { key: 'dir', label: { th: 'ทิศทางลิเทียม', en: 'Lithium moves' } }]);

  stage.loop((dt) => {
    // spawn moves at a rate ∝ C (1C ≈ a full transfer in ~24 s of animation)
    const from = state.mode === 'charge' ? 'c' : 'a';
    const avail = li.filter((x) => x.side === from && !x.mv);
    acc += dt * state.c * (N / 24);
    while (acc >= 1) {
      acc -= 1;
      if (!avail.length) break;
      const x = avail.splice(Math.floor(Math.random() * avail.length), 1)[0];
      x.mv = true; x.k = 0; x.dir = from === 'c' ? 1 : -1;
      elecs.push({ k: 0, dir: x.dir });
    }
    if (!li.some((x) => x.side === from && !x.mv) && !li.some((x) => x.mv)) {
      // reached the end: flip automatically so it never stalls
      state.mode = state.mode === 'charge' ? 'drive' : 'charge';
      box.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === state.mode)));
    }
    for (const x of li) if (x.mv) { x.k += dt * (0.55 + state.c * 0.18); if (x.k >= 1) { x.mv = false; x.side = x.dir > 0 ? 'a' : 'c'; } }
    state.ph = ((state.ph || 0) + dt * 0.05 * state.c * (state.mode === 'charge' ? 1 : -1) + 1) % 1;
    elecs.length = 0;
  });

  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const pad = m ? 14 : 30, top = m ? 120 : 112, bot = H - (m ? 34 : 38);
    const x0 = pad, x1 = W - pad, sw = x1 - x0;
    const g = { al: [x0, sw * 0.03], cat: [x0 + sw * 0.03, sw * 0.31], sep: [x0 + sw * 0.34, sw * 0.1], an: [x0 + sw * 0.44, sw * 0.53], cu: [x0 + sw * 0.97, sw * 0.03] };
    const h = bot - top;
    // layers
    c.fillStyle = '#8d99a6'; c.fillRect(g.al[0], top, g.al[1], h);
    c.fillStyle = '#211d36'; c.fillRect(g.cat[0], top, g.cat[1], h);
    c.fillStyle = 'rgba(78,162,255,.06)'; c.fillRect(g.cat[0], top, g.cat[1] + g.sep[1] + g.an[1], h);
    c.fillStyle = '#16232d'; c.fillRect(g.sep[0], top, g.sep[1], h);
    c.strokeStyle = 'rgba(200,220,240,.1)';
    for (let y = top + 5; y < bot; y += 8) { c.beginPath(); c.moveTo(g.sep[0] + 2, y); c.lineTo(g.sep[0] + g.sep[1] - 2, y + 3); c.stroke(); }
    c.fillStyle = '#191d22'; c.fillRect(g.an[0], top, g.an[1], h);
    c.fillStyle = '#b4693d'; c.fillRect(g.cu[0], top, g.cu[1], h);
    // graphite sheets
    const rows = 6;
    for (let r = 0; r <= rows; r++) { const y = top + 10 + (r * (h - 20)) / rows; c.strokeStyle = 'rgba(185,196,207,.28)'; c.lineWidth = 2; c.beginPath(); c.moveTo(g.an[0] + 8, y); c.lineTo(g.an[0] + g.an[1] - 8, y); c.stroke(); }
    // SEI film
    c.fillStyle = 'rgba(245,197,24,.35)'; c.fillRect(g.an[0], top, 3, h);
    // site positions
    const cs = [], as = [];
    const cc = 3, cr = Math.ceil(N / cc);
    for (let i = 0; i < N; i++) { const col = i % cc, row = Math.floor(i / cc); cs.push([g.cat[0] + g.cat[1] * (0.22 + col * 0.28), top + 16 + (row + 0.5) * ((h - 32) / cr)]); }
    const ac = 3;
    for (let i = 0; i < N; i++) { const col = i % ac, row = Math.floor(i / ac); as.push([g.an[0] + g.an[1] * (0.2 + col * 0.3), top + 10 + (row + 0.5) * ((h - 20) / rows)]); }
    // host sites
    for (const p of cs) { c.beginPath(); c.arc(p[0], p[1], 7, 0, Math.PI * 2); c.strokeStyle = 'rgba(155,140,255,.35)'; c.lineWidth = 1.2; c.stroke(); }
    for (const p of as) { c.beginPath(); c.arc(p[0], p[1], 6, 0, Math.PI * 2); c.strokeStyle = 'rgba(185,196,207,.22)'; c.stroke(); }
    // assign each Li to a slot
    let ci = 0, ai = 0;
    for (let i = 0; i < N; i++) {
      const x = li[i];
      const cp = cs[i % N], ap = as[i % N];
      if (!x.mv) { const p = x.side === 'c' ? cp : ap; glowDot(c, p[0], p[1], 5, C.li, 1); continue; }
      const a = x.dir > 0 ? cp : ap, b = x.dir > 0 ? ap : cp;
      const k = x.k, wob = Math.sin(k * Math.PI * 3 + x.lane * 10) * 10 * Math.sin(Math.PI * k);
      glowDot(c, lerp(a[0], b[0], k), lerp(a[1], b[1], k) + wob, 5, C.li, 1);
    }
    // outer circuit
    const yw = top - (m ? 46 : 50), ax = g.al[0] + g.al[1] / 2, bx = g.cu[0] + g.cu[1] / 2, mid = (ax + bx) / 2;
    c.strokeStyle = 'rgba(78,162,255,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, top); c.lineTo(ax, yw); c.lineTo(bx, yw); c.lineTo(bx, top); c.stroke();
    const isCh = state.mode === 'charge';
    rr(c, mid - 62, yw - 18, 124, 36, 10); c.fillStyle = '#121a22'; c.fill(); c.strokeStyle = isCh ? C.e : C.ok; c.lineWidth = 1.5; c.stroke();
    text(c, isCh ? T({ th: 'ที่ชาร์จ', en: 'Charger' }) : T({ th: 'มอเตอร์', en: 'Motor' }), mid, yw + 5, { size: 13.5, weight: 600, color: C.ink, align: 'center' });
    const L = (yw < top ? (top - yw) * 2 : 0) + (bx - ax);
    const nE = Math.max(8, Math.round(L / 26));
    for (let i = 0; i < nE; i++) {
      // charging: electrons are pushed out of the cathode side (Al) and around to the anode (Cu); driving reverses it
      let d = (((i / nE) + (state.ph || 0)) % 1) * L, ex, ey; const v = top - yw;
      if (d < v) { ex = ax; ey = top - d; } else if (d < v + (bx - ax)) { ex = ax + d - v; ey = yw; } else { ex = bx; ey = yw + d - v - (bx - ax); }
      if (Math.abs(ex - mid) < 66 && Math.abs(ey - yw) < 2) continue;
      glowDot(c, ex, ey, 3, C.e, 0.95);
    }
    // direction arrow over electrolyte
    const ay = top + h / 2;
    const dir = isCh ? 1 : -1;
    // labels
    const ls = m ? 10.5 : 12.5;
    const lab = [[g.cat, { th: 'ขั้วบวก', en: 'Cathode' }], [g.sep, { th: 'แผ่นกั้น', en: 'Separator' }], [g.an, { th: 'ขั้วลบ (กราไฟต์)', en: 'Anode (graphite)' }]];
    for (const [gg, t] of lab) text(c, T(t), gg[0] + gg[1] / 2, bot + 20, { size: ls, weight: 600, color: C.ink2, align: 'center' });
    text(c, 'Al', g.al[0] + g.al[1] / 2, bot + 20, { size: ls, weight: 700, color: C.al, align: 'center' });
    text(c, 'Cu', g.cu[0] + g.cu[1] / 2, bot + 20, { size: ls, weight: 700, color: C.cu, align: 'center' });
    text(c, 'SEI', g.an[0] + 6, top + 14, { size: 10.5, weight: 700, color: C.na });
    // arrows
    const yA = yw - 26;
    if (!m) {
      arrow(c, dir > 0 ? ax + 20 : bx - 20, yA, dir > 0 ? ax + 90 : bx - 90, yA, { color: C.e });
      text(c, 'e⁻', dir > 0 ? ax + 100 : bx - 112, yA + 4, { size: 12, weight: 700, color: C.e });
    }
    // readouts
    const soc = li.filter((x) => x.side === 'a' && !x.mv).length / N + li.filter((x) => x.mv).reduce((a, x) => a + (x.dir > 0 ? x.k : 1 - x.k), 0) / N;
    ro.set('soc', `${fmt(soc * 100, 0)}<small>%</small>`);
    ro.set('v', `${fmt(CHEM.nmc.ocv(clamp(soc, 0, 1)) + (isCh ? 1 : -1) * 0.025 * state.c, 2)}<small>V</small>`);
    ro.set('dir', isCh ? T({ th: 'ขั้วบวก → ขั้วลบ', en: 'cathode → anode' }) : T({ th: 'ขั้วลบ → ขั้วบวก', en: 'anode → cathode' }));
  });
}

// ---------------------------------------------------------------- units
export function units(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7, ratioM: 1.05, minH: 260, maxH: 460 });
  const s = { v: 380, ah: 200, wh: 150, kw: 150 };
  const box = ctrls();
  slider(box, { label: { th: 'แรงดันแพ็ก', en: 'Pack voltage' }, min: 300, max: 900, step: 10, value: s.v, fmt: (v) => `${fmt(v)} V`, color: C.violet, onInput: (v) => { s.v = v; stage.request(); } });
  slider(box, { label: { th: 'ความจุ (ประจุ)', en: 'Capacity (charge)' }, min: 60, max: 300, step: 5, value: s.ah, fmt: (v) => `${fmt(v)} Ah`, color: C.ok, onInput: (v) => { s.ah = v; stage.request(); } });
  slider(box, { label: { th: 'อัตราสิ้นเปลือง', en: 'Consumption' }, min: 110, max: 230, step: 5, value: s.wh, fmt: (v) => `${fmt(v)} Wh/km`, color: C.heat, onInput: (v) => { s.wh = v; stage.request(); } });
  slider(box, { label: { th: 'กำลังที่ชาร์จ', en: 'Charger power' }, min: 7, max: 350, step: 1, value: s.kw, fmt: (v) => `${fmt(v)} kW`, color: C.e, onInput: (v) => { s.kw = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'e', label: { th: 'พลังงาน', en: 'Energy' } }, { key: 'r', label: { th: 'ระยะทางโดยประมาณ', en: 'Approx. range' } }, { key: 'c', label: { th: 'C-rate ของการชาร์จ', en: 'Charging C-rate' } }, { key: 't', label: { th: '10→80% ถ้ากำลังคงที่', en: '10→80% at constant power' } }]);
  stage.draw((c, W, H) => {
    const kwh = (s.v * s.ah) / 1000, range = (kwh * 1000) / s.wh, crate = s.kw / kwh, mins = (0.7 * kwh) / s.kw * 60;
    const m = stage.mobile;
    const ox = m ? 52 : 70, oy = H - (m ? 30 : 34), maxW = (m ? W - 70 : W * 0.58), maxH = H - (m ? 92 : 90);
    const wpx = (s.ah / 300) * maxW, hpx = (s.v / 900) * maxH;
    // axes
    c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath(); c.moveTo(ox, oy - maxH - 6); c.lineTo(ox, oy); c.lineTo(ox + maxW + 6, oy); c.stroke();
    text(c, `${fmt(s.v)} V`, ox - 8, oy - hpx + 4, { size: 11.5, color: C.violet, align: 'right', weight: 600 });
    text(c, `${fmt(s.ah)} Ah`, ox + wpx, oy + 18, { size: 11.5, color: C.ok, align: 'center', weight: 600 });
    // rectangle (energy)
    const grd = c.createLinearGradient(ox, oy - hpx, ox + wpx, oy);
    grd.addColorStop(0, 'rgba(155,140,255,.55)'); grd.addColorStop(1, 'rgba(47,208,176,.45)');
    c.fillStyle = grd; c.fillRect(ox, oy - hpx, wpx, hpx);
    c.strokeStyle = 'rgba(231,237,243,.6)'; c.lineWidth = 1.5; c.strokeRect(ox + 0.5, oy - hpx + 0.5, wpx, hpx);
    text(c, `${fmt(kwh, 1)} kWh`, ox + wpx / 2, oy - hpx / 2 + 8, { size: m ? 20 : 26, weight: 700, color: C.ink, align: 'center', disp: true });
    text(c, T({ th: 'พลังงาน = พื้นที่', en: 'energy = area' }), ox + wpx / 2, oy - hpx / 2 + 28, { size: 11.5, color: 'rgba(231,237,243,.8)', align: 'center' });
    // range bar (right side on desktop, top on mobile)
    if (!m) {
      const rx = W * 0.72, rw = W * 0.24, rmax = 900;
      text(c, T({ th: 'ระยะทาง', en: 'Range' }), rx, 58, { size: 12, color: C.ink2 });
      rr(c, rx, 68, rw, 14, 7); c.fillStyle = 'rgba(160,188,214,.15)'; c.fill();
      rr(c, rx, 68, Math.max(14, rw * Math.min(1, range / rmax)), 14, 7); c.fillStyle = C.heat; c.fill();
      text(c, `${fmt(range)} km`, rx, 106, { size: 20, weight: 700, color: C.ink, disp: true });
      text(c, T({ th: 'เวลาชาร์จ 10→80% (อุดมคติ)', en: 'Charging 10→80% (ideal)' }), rx, 146, { size: 12, color: C.ink2 });
      rr(c, rx, 156, rw, 14, 7); c.fillStyle = 'rgba(160,188,214,.15)'; c.fill();
      rr(c, rx, 156, Math.max(14, rw * Math.min(1, mins / 600)), 14, 7); c.fillStyle = C.e; c.fill();
      text(c, mins > 120 ? `${fmt(mins / 60, 1)} ${T({ th: 'ชม.', en: 'h' })}` : `${fmt(mins)} ${T({ th: 'นาที', en: 'min' })}`, rx, 194, { size: 20, weight: 700, color: C.ink, disp: true });
    }
    ro.set('e', `${fmt(kwh, 1)}<small>kWh</small>`);
    ro.set('r', `${fmt(range)}<small>km</small>`);
    ro.set('c', `${fmt(crate, 2)}<small>C</small>`, crate > 2.5 ? 'warn' : '');
    ro.set('t', mins > 120 ? `${fmt(mins / 60, 1)}<small>${T({ th: 'ชม.', en: 'h' })}</small>` : `${fmt(mins)}<small>${T({ th: 'นาที', en: 'min' })}</small>`);
  });
}

// ---------------------------------------------------------------- pack builder
const CELLS = {
  c2170: { th: 'ทรงกระบอก 2170 (NCA/NMC)', en: '2170 cylindrical (NCA/NMC)', v: 3.6, ah: 4.8, g: 68, shape: 'cyl', color: '#4ea2ff' },
  c4680: { th: 'ทรงกระบอก 4680 (NMC)', en: '4680 cylindrical (NMC)', v: 3.6, ah: 23, g: 355, shape: 'cyl', color: '#9b8cff' },
  lfpPri: { th: 'ปริซึม LFP 161 Ah', en: 'LFP prismatic 161 Ah', v: 3.2, ah: 161, g: 3000, shape: 'pri', color: '#2fd0b0' },
  blade: { th: 'ใบมีด LFP (Blade) 150 Ah', en: 'LFP Blade 150 Ah', v: 3.2, ah: 150, g: 2900, shape: 'blade', color: '#2fd0b0' },
  pouch: { th: 'เซลล์ซอง (pouch) NMC 60 Ah', en: 'NMC pouch 60 Ah', v: 3.65, ah: 60, g: 880, shape: 'pouch', color: '#ff9b2f' },
};
const PRESETS = [
  { v: 'm3lr', label: { th: 'แบบ Model 3 Long Range: 2170 · 96S46P', en: 'Model 3 Long Range style: 2170 · 96S46P' }, cell: 'c2170', s: 96, p: 46 },
  { v: 'm3rwd', label: { th: 'แบบ Model 3 RWD (LFP): 106S1P', en: 'Model 3 RWD (LFP) style: 106S1P' }, cell: 'lfpPri', s: 106, p: 1 },
  { v: 'eg800', label: { th: 'แพ็ก 800 V แบบเซลล์ซอง: 192S2P', en: '800 V pouch pack: 192S2P' }, cell: 'pouch', s: 192, p: 2 },
  { v: 'blade', label: { th: 'แพ็กแบบใบมีด 550 V: 172S1P', en: '550 V Blade pack: 172S1P' }, cell: 'blade', s: 172, p: 1 },
  { v: 'c4680', label: { th: 'แพ็ก 4680: 92S9P', en: '4680 pack: 92S9P' }, cell: 'c4680', s: 92, p: 9 },
];
export function pack(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 7.5, ratioM: 0.95, minH: 280, maxH: 520 });
  const s = { cell: 'c2170', S: 96, P: 46 };
  const box = ctrls();
  let sS, sP, sel;
  const pre = select(box, { label: { th: 'ตัวอย่างแพ็กจริง', en: 'Real-world example' }, options: PRESETS, value: 'm3lr', onChange: (v) => { const p = PRESETS.find((x) => x.v === v); s.cell = p.cell; s.S = p.s; s.P = p.p; sel.set(p.cell); sS.set(p.s); sP.set(p.p); stage.request(); } });
  sel = select(box, { label: { th: 'ชนิดเซลล์', en: 'Cell type' }, options: Object.entries(CELLS).map(([v, o]) => ({ v, label: o })), value: s.cell, onChange: (v) => { s.cell = v; stage.request(); } });
  sS = slider(box, { label: { th: 'ต่ออนุกรม (S)', en: 'In series (S)' }, min: 50, max: 300, step: 1, value: s.S, fmt: (v) => `${v}S`, color: C.violet, onInput: (v) => { s.S = v; stage.request(); } });
  sP = slider(box, { label: { th: 'ต่อขนาน (P)', en: 'In parallel (P)' }, min: 1, max: 60, step: 1, value: s.P, fmt: (v) => `${v}P`, color: C.ok, onInput: (v) => { s.P = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'v', label: { th: 'แรงดันระบุ', en: 'Nominal voltage' } }, { key: 'ah', label: { th: 'ความจุ', en: 'Capacity' } }, { key: 'e', label: { th: 'พลังงาน', en: 'Energy' } }, { key: 'n', label: { th: 'จำนวนเซลล์', en: 'Cells' } }, { key: 'm', label: { th: 'น้ำหนักเฉพาะเซลล์', en: 'Cell mass only' } }]);
  stage.draw((c, W, H) => {
    const ce = CELLS[s.cell];
    const top = 54, left = 20, right = W - 20, bottom = H - 40;
    const gw = right - left, gh = bottom - top;
    // grid: S along x, P along y. Wrap S into rows if very long to keep it legible.
    const wrap = s.S > 120 && stage.mobile ? 3 : s.S > 150 ? 2 : 1;
    const perRow = Math.ceil(s.S / wrap);
    const cellW = gw / perRow, rowH = gh / wrap, cellH = Math.min(rowH / Math.max(1, s.P), 40);
    for (let i = 0; i < s.S; i++) {
      const row = Math.floor(i / perRow), col = i % perRow;
      const x = left + col * cellW + cellW / 2;
      const yBase = top + row * rowH;
      const groupH = cellH * s.P;
      // parallel group outline
      if (cellW > 3) { c.fillStyle = i % 2 ? 'rgba(160,188,214,.05)' : 'rgba(160,188,214,.09)'; c.fillRect(x - cellW / 2 + 0.5, yBase, cellW - 1, groupH); }
      for (let j = 0; j < s.P; j++) {
        const y = yBase + j * cellH + cellH / 2;
        const rad = Math.max(0.6, Math.min(cellW, cellH) * 0.36);
        c.fillStyle = withAlpha(ce.color, 0.85);
        if (ce.shape === 'cyl') { c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); }
        else { const wv = Math.max(1, cellW * (ce.shape === 'blade' ? 0.35 : 0.7)), hv = Math.max(1, cellH * 0.8); c.fillRect(x - wv / 2, y - hv / 2, wv, hv); }
      }
    }
    // series arrow
    text(c, `${s.S} S → ${fmt(s.S * ce.v)} V`, left, top - 16, { size: 12, weight: 600, color: C.violet });
    text(c, `${s.P} P → ${fmt(s.P * ce.ah)} Ah`, right, top - 16, { size: 12, weight: 600, color: C.ok, align: 'right' });
    const kwh = (s.S * ce.v * s.P * ce.ah) / 1000;
    ro.set('v', `${fmt(s.S * ce.v)}<small>V</small>`);
    ro.set('ah', `${fmt(s.P * ce.ah)}<small>Ah</small>`);
    ro.set('e', `${fmt(kwh, 1)}<small>kWh</small>`);
    ro.set('n', `${fmt(s.S * s.P)}`);
    ro.set('m', `${fmt((s.S * s.P * ce.g) / 1000)}<small>kg</small>`);
  });
  pre.set('m3lr');
}

// ---------------------------------------------------------------- SOC / SOH / buffers
export function soc(inst) {
  const { stage, ctrls } = scaffold(inst, { ratio: 16 / 6.4, ratioM: 1.1, minH: 260, maxH: 420 });
  const s = { soh: 92, bb: 4, tb: 2, disp: 80, kwh: 75 };
  const box = ctrls();
  slider(box, { label: { th: '% บนหน้าจอ', en: 'Displayed %' }, min: 0, max: 100, step: 1, value: s.disp, fmt: (v) => `${v}%`, color: C.ok, onInput: (v) => { s.disp = v; stage.request(); } });
  slider(box, { label: { th: 'สุขภาพแบต (SOH)', en: 'Health (SOH)' }, min: 70, max: 100, step: 1, value: s.soh, fmt: (v) => `${v}%`, color: C.heat, onInput: (v) => { s.soh = v; stage.request(); } });
  slider(box, { label: { th: 'บัฟเฟอร์ล่าง (ตัวอย่าง)', en: 'Bottom buffer (example)' }, min: 0, max: 8, step: 0.5, value: s.bb, fmt: (v) => `${fmt(v, 1)}%`, color: C.violet, onInput: (v) => { s.bb = v; stage.request(); } });
  slider(box, { label: { th: 'บัฟเฟอร์บน (ตัวอย่าง)', en: 'Top buffer (example)' }, min: 0, max: 8, step: 0.5, value: s.tb, fmt: (v) => `${fmt(v, 1)}%`, color: C.violet, onInput: (v) => { s.tb = v; stage.request(); } });
  const ro = readouts(inst, [{ key: 'kwh', label: { th: 'พลังงานที่ใช้ได้ตอนนี้', en: 'Usable energy now' } }, { key: 'left', label: { th: 'เหลือในแบต (ใช้ได้)', en: 'Left (usable)' } }, { key: 'cell', label: { th: 'ระดับจริงของเซลล์', en: 'True cell level' } }]);
  stage.draw((c, W, H) => {
    const m = stage.mobile;
    const x0 = m ? 18 : 40, x1 = W - (m ? 30 : 60), y = m ? 110 : 96, hh = m ? 64 : 76;
    const full = x1 - x0; // new-battery capacity
    const cap = full * (s.soh / 100);
    // new capacity ghost
    rr(c, x0, y, full, hh, 12); c.strokeStyle = 'rgba(160,188,214,.25)'; c.setLineDash([5, 5]); c.stroke(); c.setLineDash([]);
    text(c, T({ th: `ความจุตอนใหม่ ${s.kwh} kWh`, en: `Capacity when new: ${s.kwh} kWh` }), x0 + full, y - 12, { size: 11.5, color: C.ink3, align: 'right' });
    // current capacity
    rr(c, x0, y, cap, hh, 12); c.fillStyle = 'rgba(160,188,214,.08)'; c.fill(); c.strokeStyle = 'rgba(231,237,243,.5)'; c.lineWidth = 1.5; c.stroke();
    // terminal
    rr(c, x0 + full + 4, y + hh * 0.3, 10, hh * 0.4, 3); c.fillStyle = 'rgba(160,188,214,.3)'; c.fill();
    const bbW = cap * (s.bb / 100), tbW = cap * (s.tb / 100), usable = cap - bbW - tbW;
    // buffers
    c.save(); rr(c, x0, y, cap, hh, 12); c.clip();
    c.fillStyle = 'rgba(155,140,255,.28)'; c.fillRect(x0, y, bbW, hh); c.fillRect(x0 + cap - tbW, y, tbW, hh);
    // fill to displayed level
    const fillW = bbW + usable * (s.disp / 100);
    const g = c.createLinearGradient(x0, 0, x0 + fillW, 0); g.addColorStop(0, 'rgba(47,208,176,.55)'); g.addColorStop(1, 'rgba(47,208,176,.95)');
    c.fillStyle = g; c.fillRect(x0 + bbW, y, Math.max(0, fillW - bbW), hh);
    c.restore();
    // ticks for displayed 0 and 100
    const tick = (x, lab, col) => { c.strokeStyle = col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x, y + hh + 6); c.stroke(); text(c, lab, x, y + hh + 22, { size: 11.5, weight: 600, color: col, align: 'center' }); };
    tick(x0 + bbW, T({ th: 'จอ 0%', en: 'screen 0%' }), C.ink2);
    tick(x0 + cap - tbW, T({ th: 'จอ 100%', en: 'screen 100%' }), C.ink2);
    if (s.soh < 100) { c.strokeStyle = C.heat; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x0 + cap, y - 4); c.lineTo(x0 + cap, y + hh + 4); c.stroke(); c.setLineDash([]); text(c, T({ th: 'สูญเสียจากการเสื่อม', en: 'lost to ageing' }), x0 + (cap + full) / 2, y + hh / 2 + 4, { size: 11, color: C.heat, align: 'center', maxW: full - cap - 6 }); }
    if (bbW > 18) text(c, T({ th: 'บัฟเฟอร์', en: 'buffer' }), x0 + bbW / 2, y - 10, { size: 10.5, color: C.violet, align: 'center' });
    const usableKwh = (s.kwh * s.soh / 100) * (1 - (s.bb + s.tb) / 100);
    ro.set('kwh', `${fmt(usableKwh, 1)}<small>kWh</small>`);
    ro.set('left', `${fmt(usableKwh * s.disp / 100, 1)}<small>kWh</small>`);
    ro.set('cell', `${fmt(s.bb + (100 - s.bb - s.tb) * s.disp / 100, 1)}<small>%</small>`);
  });
}
