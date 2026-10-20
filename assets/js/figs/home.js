// Home hero: a continuous zoom from the battery pack to the graphite lattice
import { Stage, C, T, clamp, lerp, smooth, rr, text, glowDot, withAlpha, lang, reduced } from '../lib.js';

const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

export function hero(section) {
  const sticky = section.querySelector('.hero-sticky');
  const host = section.querySelector('.hero-stage');
  const copy = section.querySelector('.hero-copy');
  const steps = [...section.querySelectorAll('.hero-steps li')];
  const scaleT = section.querySelector('.hs-t');
  const cue = section.querySelector('.hero-cue');
  const st = new Stage(host, { height: () => sticky.clientHeight, minH: 300, maxH: 4000, maxVH: 2 });

  let p = 0, pTarget = 0;
  const readScroll = () => {
    const r = section.getBoundingClientRect();
    const span = section.offsetHeight - sticky.offsetHeight;
    pTarget = clamp(-r.top / Math.max(1, span), 0, 1);
    if (reduced.matches) { p = pTarget; st.request(); }
  };
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', readScroll);
  readScroll(); p = pTarget;

  // stable pseudo-random per cell
  const hash = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };

  // ions for the cross-section scene
  const ions = Array.from({ length: 46 }, (_, i) => ({ ph: hash(i + 1), lane: hash(i + 7), sp: 0.6 + hash(i + 3) * 0.6 }));
  const elec = Array.from({ length: 14 }, (_, i) => ({ ph: i / 14 }));

  st.loop((dt) => { p += (pTarget - p) * Math.min(1, dt * 7); });

  st.draw((c, W, H) => {
    const t = st.t;
    const mobile = W < 900;
    const cx = mobile ? W * 0.5 : W * 0.68, cy = mobile ? H * 0.64 : H * 0.52;
    const base = Math.min(W * (mobile ? 0.062 : 0.036), H * (mobile ? 0.05 : 0.064));

    // DOM sync (cheap)
    copy.classList.toggle('gone', p > 0.05);
    sticky.style.setProperty('--copy-a', p > 0.05 ? 0 : 1);
    if (cue) cue.style.opacity = p > 0.02 ? 0 : 1;
    const si = p < 0.22 ? 0 : p < 0.47 ? 1 : p < 0.72 ? 2 : 3;
    steps.forEach((li, i) => li.classList.toggle('on', i === si && p > 0.04));
    if (scaleT) scaleT.textContent = ['1 m', '10 cm', '100 µm', '1 nm'][si];

    // background vignette
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(40,80,120,0.20)'); g.addColorStop(1, 'rgba(10,14,18,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    const aPack = 1 - seg(p, 0.41, 0.465);
    const aCell = seg(p, 0.465, 0.52) * (1 - seg(p, 0.69, 0.735));
    const aAtom = seg(p, 0.735, 0.79);

    if (aPack > 0.001) drawPack(c, W, H, cx, cy, base, t, aPack);
    if (aCell > 0.001) drawCell(c, W, H, cx, cy, t, aCell, seg(p, 0.45, 0.72));
    if (aAtom > 0.001) drawAtom(c, W, H, cx, cy, t, aAtom, seg(p, 0.72, 1));
  });

  // ---------------- pack & modules (isometric) ----------------
  function drawPack(c, W, H, cx, cy, base, t, alpha) {
    const lift = smooth(seg(p, 0.05, 0.2));
    const zoom1 = smooth(seg(p, 0.22, 0.4));      // to one module
    const zoom2 = smooth(seg(p, 0.38, 0.48));     // to one cell
    let u = base * lerp(1, 4.2, zoom1) * lerp(1, 7, zoom2);
    // focus point: pack centre → a module → a cell top
    const fm = [1.16, -1.42, 0.86], fc = [1.43, -1.51, 0.92];
    const fx = lerp(lerp(0, fm[0], zoom1), fc[0], zoom2), fy = lerp(lerp(0, fm[1], zoom1), fc[1], zoom2), fz = lerp(lerp(0.4, fm[2], zoom1), fc[2], zoom2);
    const ox = cx - (fx - fy) * u * 0.866, oy = cy - (fx + fy) * u * 0.5 + fz * u;
    const P = (x, y, z) => [ox + (x - y) * u * 0.866, oy + (x + y) * u * 0.5 - z * u];
    c.save(); c.globalAlpha = alpha;

    const poly = (pts, fill, stroke, lw = 1) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } };
    const box = (x, y, z, dx, dy, dz, col) => {
      poly([P(x, y + dy, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)], col.f, col.e);
      poly([P(x + dx, y, z), P(x + dx, y + dy, z), P(x + dx, y + dy, z + dz), P(x + dx, y, z + dz)], col.r, col.e);
      poly([P(x, y, z + dz), P(x + dx, y, z + dz), P(x + dx, y + dy, z + dz), P(x, y + dy, z + dz)], col.t, col.e);
    };
    const wheel = (x, y, z, R, w) => {
      const ring = (yy) => { const pts = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push(P(x + R * Math.cos(a), yy, z + R * Math.sin(a))); } return pts; };
      poly(ring(y - w), '#0d1116', 'rgba(160,188,214,.25)'); poly(ring(y), '#161d24', 'rgba(160,188,214,.35)');
      const hub = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; hub.push(P(x + R * 0.55 * Math.cos(a), y + 0.01, z + R * 0.55 * Math.sin(a))); }
      poly(hub, '#26313b', 'rgba(185,196,207,.4)');
    };

    // ground shadow
    const sh = P(0, 0, 0);
    c.save(); c.globalAlpha = alpha * 0.55 * (1 - zoom1); c.fillStyle = '#000'; c.beginPath(); c.ellipse(sh[0], sh[1] + u * 0.4, u * 7.2, u * 3.0, 0, 0, Math.PI * 2); c.filter = 'blur(18px)'; c.fill(); c.restore();

    const wa = 1 - zoom1;
    if (wa > 0.01) { c.save(); c.globalAlpha = alpha * wa; wheel(-4.1, -3.1, 0.55, 1.05, 0.7); wheel(4.1, -3.1, 0.55, 1.05, 0.7); c.restore(); }
    // tray
    const tray = { t: '#1a222b', r: '#121920', f: '#0f141a', e: 'rgba(160,188,214,.28)' };
    box(-5, -3, 0, 10, 6, 0.35, tray);
    // walls (back + left drawn first, front later)
    box(-5, -3, 0.35, 10, 0.15, 0.55, tray); box(-5, -3, 0.35, 0.15, 6, 0.55, tray);

    // modules 4×2 with cells on top
    const mods = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) mods.push([-4.7 + i * 2.38, -2.7 + j * 2.75]);
    mods.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    const showCells = u > base * 1.4;
    for (const [mx, my] of mods) {
      box(mx, my, 0.35, 2.2, 2.55, 0.5, { t: '#1d2731', r: '#141b22', f: '#10161c', e: 'rgba(160,188,214,.32)' });
      // cells (top view ellipses)
      const nx = 6, ny = 7, r = 0.165;
      for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
        const x = mx + 0.2 + a * 0.36 + (b % 2) * 0.09, y = my + 0.2 + b * 0.33, z = 0.855;
        const wave = 0.5 + 0.5 * Math.sin(t * 1.8 - (x + y) * 0.55);
        const k = 0.35 + 0.65 * wave;
        if (!showCells) {
          const q = P(x, y, z); c.fillStyle = withAlpha(C.ok, 0.12 + 0.45 * k); c.fillRect(q[0] - 0.8, q[1] - 0.8, 1.6, 1.6);
          continue;
        }
        const rx = 1.2247 * r * u, ry = 0.7071 * r * u, hh = 0.14;
        const bt = P(x, y, z), tp = P(x, y, z + hh);
        // can: bottom ellipse, side, top
        c.beginPath(); c.ellipse(bt[0], bt[1], rx, ry, 0, 0, Math.PI * 2); c.fillStyle = '#0d1318'; c.fill();
        const sg = c.createLinearGradient(tp[0] - rx, 0, tp[0] + rx, 0); sg.addColorStop(0, '#1c2731'); sg.addColorStop(0.45, '#3a4a58'); sg.addColorStop(1, '#141c23');
        c.fillStyle = sg; c.fillRect(tp[0] - rx, tp[1], rx * 2, bt[1] - tp[1]);
        c.beginPath(); c.ellipse(tp[0], tp[1], rx, ry, 0, 0, Math.PI * 2);
        c.fillStyle = `rgba(${Math.round(40 + 30 * k)},${Math.round(150 + 70 * k)},${Math.round(140 + 50 * k)},${0.35 + 0.55 * k})`; c.fill();
        c.strokeStyle = 'rgba(200,220,235,.35)'; c.lineWidth = 0.8; c.stroke();
        if (u > base * 3) { c.beginPath(); c.ellipse(tp[0], tp[1], rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(205,215,225,.55)'; c.fill(); }
      }
      // nickel busbar strips
      if (showCells) {
        c.save(); c.globalAlpha = alpha * 0.55;
        for (let b = 0; b < 7; b += 2) { const a1 = P(mx + 0.1, my + 0.2 + b * 0.33, 1.0), a2 = P(mx + 2.1, my + 0.2 + b * 0.33, 1.0); c.strokeStyle = 'rgba(185,196,207,.45)'; c.lineWidth = Math.max(1, u * 0.05); c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(a2[0], a2[1]); c.stroke(); }
        c.restore();
      }
    }
    // front & right walls
    box(-5, 2.85, 0.35, 10, 0.15, 0.55, tray); box(4.85, -3, 0.35, 0.15, 6, 0.55, tray);
    // lid
    if (lift < 0.999) {
      c.save(); c.globalAlpha = alpha * (1 - lift);
      box(-5.05, -3.05, 0.9 + lift * 3.5, 10.1, 6.1, 0.12, { t: 'rgba(38,50,62,.96)', r: 'rgba(25,33,41,.96)', f: 'rgba(20,27,34,.96)', e: 'rgba(185,205,225,.4)' });
      const a = P(-3.5, 0, 1.02 + lift * 3.5), b = P(3.5, 0, 1.02 + lift * 3.5);
      c.strokeStyle = withAlpha(C.ok, 0.5); c.lineWidth = 2; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      c.restore();
    }
    if (wa > 0.01) { c.save(); c.globalAlpha = alpha * wa; wheel(-4.1, 3.8, 0.55, 1.05, 0.7); wheel(4.1, 3.8, 0.55, 1.05, 0.7); c.restore(); }
    c.restore();
  }

  // ---------------- cross-section of one cell ----------------
  function drawCell(c, W, H, cx, cy, t, alpha, prog) {
    const mobile = W < 900;
    const zoom = lerp(0.82, 1, smooth(seg(prog, 0, 0.25)));
    const sw = Math.min(mobile ? W * 0.92 : W * 0.54, 740) * zoom, sh = Math.min(mobile ? H * 0.36 : H * 0.46, 400) * zoom;
    const x0 = cx - sw / 2, y0 = (mobile ? H * 0.5 : H * 0.45) - sh / 2 + 30;
    c.save(); c.globalAlpha = alpha;
    // layers left→right: Al | cathode | separator | anode | Cu
    const L = [
      { k: 'al', w: 0.05, col: '#8d99a6', th: 'ฟอยล์อะลูมิเนียม', en: 'Al foil' },
      { k: 'cat', w: 0.32, col: '#2a2440', th: 'ขั้วบวก (แคโทด)', en: 'Cathode' },
      { k: 'sep', w: 0.1, col: '#20303c', th: 'แผ่นกั้น', en: 'Separator' },
      { k: 'an', w: 0.48, col: '#1d2228', th: 'ขั้วลบ (แอโนด)', en: 'Anode' },
      { k: 'cu', w: 0.05, col: '#b4693d', th: 'ฟอยล์ทองแดง', en: 'Cu foil' },
    ];
    let x = x0; const geo = {};
    for (const l of L) { const w = l.w * sw; geo[l.k] = [x, w]; c.fillStyle = l.col; c.fillRect(x, y0, w, sh); x += w; }
    // electrolyte tint
    c.fillStyle = 'rgba(78,162,255,.05)'; c.fillRect(geo.cat[0], y0, geo.cat[1] + geo.sep[1] + geo.an[1], sh);
    // cathode particles
    for (let i = 0; i < 26; i++) { const px = geo.cat[0] + 8 + hash(i + 40) * (geo.cat[1] - 16), py = y0 + 10 + hash(i + 90) * (sh - 20), r = 6 + hash(i + 11) * 9;
      c.beginPath(); c.arc(px, py, r * zoom, 0, Math.PI * 2); c.fillStyle = '#3b3160'; c.fill(); c.strokeStyle = 'rgba(155,140,255,.35)'; c.lineWidth = 1; c.stroke(); }
    // separator pores
    c.strokeStyle = 'rgba(200,220,240,.12)'; c.lineWidth = 1;
    for (let yy = y0 + 6; yy < y0 + sh; yy += 9) { c.beginPath(); c.moveTo(geo.sep[0] + 3, yy); c.lineTo(geo.sep[0] + geo.sep[1] - 3, yy + 4); c.stroke(); }
    // anode graphite flakes
    for (let i = 0; i < 30; i++) { const px = geo.an[0] + 10 + hash(i + 200) * (geo.an[1] - 30), py = y0 + 8 + hash(i + 300) * (sh - 16), w = 26 + hash(i + 7) * 30;
      c.save(); c.translate(px, py); c.rotate((hash(i + 5) - 0.5) * 0.5); rr(c, 0, 0, w * zoom, 9 * zoom, 3); c.fillStyle = '#2b333c'; c.fill();
      c.strokeStyle = 'rgba(185,196,207,.18)'; c.stroke(); c.restore(); }
    // ions travelling cathode → anode (charging)
    const xa = geo.cat[0] + 10, xb = geo.an[0] + geo.an[1] - 20;
    for (const io of ions) {
      const k = (io.ph + t * 0.09 * io.sp) % 1;
      const xx = lerp(xa, xb, k), yy = y0 + 12 + io.lane * (sh - 24) + Math.sin(k * 12 + io.lane * 9) * 5;
      glowDot(c, xx, yy, 3.4 * zoom, C.li, 0.9 * Math.sin(Math.PI * clamp(k * 1.15, 0, 1)) + 0.1);
    }
    // external circuit (electrons through the charger, from Al side to Cu side)
    const top = y0 - Math.min(60, sh * 0.16), ax = geo.al[0] + geo.al[1] / 2, bx = geo.cu[0] + geo.cu[1] / 2;
    c.strokeStyle = 'rgba(78,162,255,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(ax, y0); c.lineTo(ax, top); c.lineTo(bx, top); c.lineTo(bx, y0); c.stroke();
    // charger box
    const mid = (ax + bx) / 2; rr(c, mid - 46, top - 17, 92, 34, 9); c.fillStyle = '#121a22'; c.fill(); c.strokeStyle = 'rgba(78,162,255,.6)'; c.stroke();
    text(c, lang() === 'th' ? 'ที่ชาร์จ' : 'Charger', mid, top + 5, { size: 13, weight: 600, color: C.ink, align: 'center' });
    const plen = (top < y0 ? (y0 - top) * 2 : 0) + (bx - ax);
    for (const e of elec) {
      let d = ((e.ph + t * 0.12) % 1) * plen, ex, ey;
      const v = y0 - top;
      if (d < v) { ex = ax; ey = y0 - d; } else if (d < v + (bx - ax)) { ex = ax + (d - v); ey = top; } else { ex = bx; ey = top + (d - v - (bx - ax)); }
      if (Math.abs(ex - mid) < 50 && Math.abs(ey - top) < 20) continue;
      glowDot(c, ex, ey, 2.8, C.e, 0.95);
    }
    // labels under the layers
    const ly = y0 + sh + 22;
    for (const l of L) { const [lx, lw] = geo[l.k]; if (lw < 30 && mobile) continue;
      text(c, T(l), lx + lw / 2, ly, { size: mobile ? 11 : 12.5, weight: 600, color: l.k === 'cu' ? C.cu : l.k === 'al' ? C.al : C.ink2, align: 'center' }); }
    // legend
    const lgx = x0, lgy = top - 52;
    glowDot(c, lgx + 6, lgy, 4, C.li); text(c, lang() === 'th' ? 'ลิเทียมไอออน (Li⁺) วิ่งผ่านอิเล็กโทรไลต์' : 'Lithium ions (Li⁺) cross the electrolyte', lgx + 18, lgy + 4, { size: 12.5, color: C.ink2 });
    glowDot(c, lgx + 6, lgy + 22, 3, C.e); text(c, lang() === 'th' ? 'อิเล็กตรอน (e⁻) วิ่งผ่านสายไฟภายนอก' : 'Electrons (e⁻) take the outside wire', lgx + 18, lgy + 26, { size: 12.5, color: C.ink2 });
    c.restore();
  }

  // ---------------- graphite lattice with intercalating Li ----------------
  function drawAtom(c, W, H, cx, cy, t, alpha, prog) {
    const mobile = W < 900;
    c.save(); c.globalAlpha = alpha;
    const zoom = lerp(0.85, 1, smooth(seg(prog, 0, 0.3)));
    // phones: keep room on the left for the SEI film and on the right for the spacing marker
    const gw = (mobile ? W - 96 : Math.min(W * 0.46, 700)) * zoom, rows = 5;
    const gap = Math.min(mobile ? 58 : 74, (H * 0.6) / rows) * zoom;
    const x0 = mobile ? 60 + (W - 96 - gw) / 2 : cx - gw / 2, y0 = cy - (gap * (rows - 1)) / 2;
    const fill = clamp(prog * 1.35, 0, 1); // how far lithium has slid in
    const a = gap * 0.42; // atom spacing
    // SEI film on the left edge
    c.save(); rr(c, x0 - 34, y0 - gap * 0.6, 30, gap * (rows - 1) + gap * 1.2, 8); c.fillStyle = 'rgba(245,197,24,.12)'; c.fill(); c.strokeStyle = 'rgba(245,197,24,.45)'; c.setLineDash([4, 4]); c.stroke(); c.restore();
    text(c, 'SEI', x0 - 19, y0 - gap * 0.6 - 8, { size: 12, weight: 700, color: C.na, align: 'center' });
    for (let r = 0; r < rows; r++) {
      const yy = y0 + r * gap;
      // graphene sheet seen edge-on: zig-zag of carbon atoms
      c.strokeStyle = 'rgba(185,196,207,.38)'; c.lineWidth = 1.4; c.beginPath();
      for (let x = 0, i = 0; x <= gw; x += a, i++) { const py = yy + (i % 2 ? -a * 0.18 : a * 0.18); if (i === 0) c.moveTo(x0 + x, py); else c.lineTo(x0 + x, py); }
      c.stroke();
      for (let x = 0, i = 0; x <= gw; x += a, i++) { const py = yy + (i % 2 ? -a * 0.18 : a * 0.18); c.beginPath(); c.arc(x0 + x, py, Math.max(2.2, a * 0.13), 0, Math.PI * 2); c.fillStyle = '#7f8b97'; c.fill(); }
      // Li between this sheet and the next
      if (r < rows - 1) {
        const ly = yy + gap / 2;
        const n = Math.floor(gw / (a * 3));
        for (let k = 0; k < n; k++) {
          const target = x0 + gw - (k + 0.5) * a * 3;
          const front = x0 + gw - fill * gw;
          if (target < front) continue;
          const jig = Math.sin(t * 3 + k * 1.7 + r) * 1.5;
          glowDot(c, target + jig, ly, Math.max(3.4, a * 0.22), C.li, 0.95);
        }
        // incoming ion
        const kin = (t * 0.35 + r * 0.27) % 1;
        if (fill < 1) glowDot(c, x0 + gw + 40 - kin * 50, ly, Math.max(3.4, a * 0.22), C.li, 1 - kin * 0.5);
      }
    }
    // dimension marker
    const mx = x0 + gw + (mobile ? 12 : 26), m1 = y0 + gap * (rows - 2), m2 = y0 + gap * (rows - 1);
    c.strokeStyle = C.ink2; c.lineWidth = 1.2; c.beginPath(); c.moveTo(mx, m1); c.lineTo(mx, m2); c.moveTo(mx - 5, m1); c.lineTo(mx + 5, m1); c.moveTo(mx - 5, m2); c.lineTo(mx + 5, m2); c.stroke();
    const d = lerp(0.335, 0.37, fill);
    text(c, `${d.toFixed(3)} nm`, mx + (mobile ? -8 : 10), (m1 + m2) / 2 + (mobile ? -gap * 0.62 : 4), { size: 12.5, weight: 600, color: C.ink, align: mobile ? 'right' : 'left' });
    const lab = lang() === 'th' ? (fill > 0.9 ? 'LiC₆ ชาร์จเต็ม · ชั้นขยายราว 10%' : 'กราไฟต์ (แผ่นคาร์บอน)') : (fill > 0.9 ? 'LiC₆, fully charged · sheets ~10% further apart' : 'Graphite (carbon sheets)');
    text(c, lab, x0, y0 - gap * 0.75 - 14, { size: 13, weight: 600, color: C.ink, align: 'left' });
    c.restore();
  }
}
