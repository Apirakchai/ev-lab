// EV Lab — figure toolkit: stage (canvas), controls, plotting helpers
export const root = document.documentElement;
export const lang = () => (root.dataset.lang === 'en' ? 'en' : 'th');
export const mode = () => (root.dataset.mode === 'deep' ? 'deep' : 'simple');
export const isDeep = () => mode() === 'deep';
export const T = (o) => (o && typeof o === 'object' && ('th' in o || 'en' in o) ? (o[lang()] ?? o.th ?? o.en) : o);
export const onPrefs = (fn) => window.addEventListener('evlab:prefs', fn);
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// screen palette (mirrors --scr-* in site.css)
export const C = {
  bg: '#0a0e12', bg2: '#0f151b', bg3: '#151d25', grid: 'rgba(140,175,210,.075)', grid2: 'rgba(140,175,210,.14)',
  ink: '#e7edf3', ink2: '#9aa8b5', ink3: '#6c7a87', line: 'rgba(160,188,214,.22)',
  li: '#ff4d65', e: '#4ea2ff', cu: '#e48c5c', al: '#b9c4cf', heat: '#ff9b2f', ok: '#2fd0b0', warn: '#ffbf3c', bad: '#ff5b4f',
  violet: '#9b8cff', na: '#f5c518', lime: '#a3d95b',
  series: ['#3987e5', '#e0703c', '#1fb383', '#d6a21e', '#e0628f', '#3fb13f', '#9a8ff0', '#e66767'],
};
export const FONT_BODY = '"IBM Plex Sans Thai", "Noto Sans Thai", system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISP = '"Bai Jamjuree", "IBM Plex Sans Thai", system-ui, sans-serif';
export const font = (size, weight = 500, disp = false) => `${weight} ${size}px ${disp ? FONT_DISP : FONT_BODY}`;

// ---------- small utils ----------
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, v) => (v - a) / (b - a);
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
let _uid = 0; export const uid = (p = 'u') => `${p}${++_uid}`;
export function fmt(v, d = 0) {
  if (!Number.isFinite(v)) return '–';
  return v.toLocaleString(lang() === 'th' ? 'th-TH' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export const fmtSigned = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);
export function fmtDur(min) {
  if (!Number.isFinite(min)) return '–';
  const h = Math.floor(min / 60), m = Math.round(min - h * 60);
  if (lang() === 'th') return h ? `${h} ชม. ${m} นาที` : `${m} นาที`;
  return h ? `${h} h ${m} min` : `${m} min`;
}
export const bi = (o) => (typeof o === 'string' ? o : `<span data-l="th" lang="th">${o.th}</span><span data-l="en" lang="en">${o.en}</span>`);
export function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

// ---------- stage: responsive, DPR-aware canvas that only animates when visible ----------
export class Stage {
  constructor(host, opts = {}) {
    this.host = host;
    this.o = Object.assign({ ratio: 16 / 9, ratioM: 1, mBreak: 640, minH: 240, maxH: 640, maxVH: 0.8 }, opts);
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('role', 'img');
    if (opts.alt) this.canvas.setAttribute('aria-label', T(opts.alt));
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1; this.t = 0; this.visible = false; this.mobile = false;
    this.pointer = { x: -1, y: -1, inside: false, down: false };
    this._draw = null; this._loop = null; this._raf = 0; this._pending = false;
    new ResizeObserver(() => this.resize()).observe(host);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this._kick(); }, { rootMargin: '80px' }).observe(host);
    document.addEventListener('visibilitychange', () => this._kick());
    const pos = (e) => { const r = this.canvas.getBoundingClientRect(); this.pointer.x = e.clientX - r.left; this.pointer.y = e.clientY - r.top; };
    this.canvas.addEventListener('pointermove', (e) => { pos(e); this.pointer.inside = true; this.onPointer?.('move', this.pointer, e); this.request(); });
    this.canvas.addEventListener('pointerdown', (e) => { pos(e); this.pointer.inside = true; this.pointer.down = true; this.onPointer?.('down', this.pointer, e); this.request(); });
    window.addEventListener('pointerup', (e) => { if (this.pointer.down) { this.pointer.down = false; this.onPointer?.('up', this.pointer, e); this.request(); } });
    this.canvas.addEventListener('pointerleave', (e) => { this.pointer.inside = false; this.onPointer?.('leave', this.pointer, e); this.request(); });
    onPrefs(() => { if (opts.alt) this.canvas.setAttribute('aria-label', T(opts.alt)); this.request(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.request());
    this.resize();
  }
  resize() {
    const w = this.host.clientWidth; if (!w) return;
    this.mobile = w < this.o.mBreak;
    let h = this.o.height ? this.o.height(w, this.mobile) : w / (this.mobile ? this.o.ratioM : this.o.ratio);
    h = Math.round(clamp(h, this.o.minH, Math.min(this.o.maxH, Math.max(this.o.minH, innerHeight * this.o.maxVH))));
    if (h !== this.h || w !== this.w) {
      this.host.style.height = h + 'px';
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
      this.w = w; this.h = h;
      this.onResize?.(w, h);
    }
    this.request();
  }
  draw(fn) { this._draw = fn; this.request(); return this; }
  request() {
    if (this._raf || this._pending) return;
    this._pending = true;
    requestAnimationFrame(() => { this._pending = false; this._render(); });
  }
  loop(fn) { this._loop = fn; this._kick(); return this; }
  get animating() { return !!this._raf; }
  _kick() {
    if (!this._loop) return;
    const run = this.visible && !document.hidden && !reduced.matches;
    if (run && !this._raf) {
      this._last = performance.now();
      const tick = (ts) => {
        const dt = Math.min(0.05, Math.max(0, (ts - this._last) / 1000)); this._last = ts; this.t += dt;
        this._loop(dt, this.t); this._render();
        this._raf = (this.visible && !document.hidden && !reduced.matches) ? requestAnimationFrame(tick) : 0;
      };
      this._raf = requestAnimationFrame(tick);
    }
    if (!run) this.request();
  }
  _render() {
    if (!this.w || !this._draw) return;
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.w, this.h);
    c.save(); this._draw(c, this.w, this.h); c.restore();
  }
}

// ---------- instrument scaffold ----------
// <div class="inst" data-fig="mod:fn"> [<div class="inst-h">…</div>] </div>
export function scaffold(inst, opts = {}) {
  let stageEl = inst.querySelector('.stage');
  if (!stageEl) { stageEl = el('div', 'stage'); inst.insertBefore(stageEl, inst.querySelector('.ctrls, .ro-row, .legend, .inst-note')); }
  const stage = new Stage(stageEl, opts);
  const parts = {
    stage,
    ctrls: () => inst.querySelector('.ctrls') || inst.appendChild(el('div', 'ctrls')),
  };
  return parts;
}

// ---------- controls ----------
export function slider(parent, { label, min, max, step = 1, value, fmt: f = (v) => fmt(v), color, onInput }) {
  const w = el('div', 'ctl');
  const id = uid('s');
  w.innerHTML = `<div class="ctl-row"><label class="ctl-l" for="${id}">${bi(label)}</label><span class="ctl-v" aria-hidden="true"></span></div><input id="${id}" type="range">`;
  const inp = w.querySelector('input'), out = w.querySelector('.ctl-v');
  inp.min = min; inp.max = max; inp.step = step; inp.value = value;
  if (color) w.style.setProperty('--k', color);
  const upd = () => { const v = +inp.value; const s = f(v); out.textContent = s; inp.setAttribute('aria-valuetext', s); inp.style.setProperty('--p', ((v - min) / (max - min)) * 100); };
  inp.addEventListener('input', () => { upd(); onInput && onInput(+inp.value); });
  onPrefs(upd); upd();
  parent.appendChild(w);
  return { el: w, input: inp, get value() { return +inp.value; }, set(v, fire = false) { inp.value = v; upd(); if (fire && onInput) onInput(+inp.value); }, refresh: upd };
}

export function select(parent, { label, options, value, onChange }) {
  const w = el('div', 'ctl');
  const id = uid('sel');
  w.innerHTML = `<div class="ctl-row"><label class="ctl-l" for="${id}">${bi(label)}</label></div><select id="${id}"></select>`;
  const s = w.querySelector('select');
  const render = () => { const cur = s.value || value; s.innerHTML = options.map((o) => `<option value="${o.v}">${T(o.label)}</option>`).join(''); s.value = cur; };
  render(); s.value = value;
  s.addEventListener('change', () => onChange && onChange(s.value));
  onPrefs(render);
  parent.appendChild(w);
  return { el: w, select: s, get value() { return s.value; }, set(v, fire = false) { s.value = v; if (fire && onChange) onChange(v); } };
}

export function chips(parent, { label, options, value, multi = false, onChange }) {
  const w = el('div', 'ctl');
  if (label) w.innerHTML = `<div class="ctl-row"><span class="ctl-l">${bi(label)}</span></div>`;
  const box = el('div', 'chips');
  box.setAttribute('role', multi ? 'group' : 'radiogroup');
  let cur = multi ? new Set(value || []) : value;
  const btns = options.map((o) => {
    const b = el('button', 'chip', `${o.color ? '<span class="dot"></span>' : ''}${bi(o.label)}`);
    b.type = 'button'; b.dataset.v = o.v;
    if (o.color) b.style.setProperty('--k', o.color);
    b.addEventListener('click', () => {
      if (multi) { cur.has(o.v) ? cur.delete(o.v) : cur.add(o.v); if (!cur.size) cur.add(o.v); }
      else cur = o.v;
      sync(); onChange && onChange(multi ? [...cur] : cur);
    });
    box.appendChild(b); return b;
  });
  const sync = () => btns.forEach((b) => b.setAttribute('aria-pressed', String(multi ? cur.has(b.dataset.v) : cur === b.dataset.v)));
  sync(); w.appendChild(box); parent.appendChild(w);
  return { el: w, get value() { return multi ? [...cur] : cur; }, set(v, fire = false) { cur = multi ? new Set(v) : v; sync(); if (fire && onChange) onChange(multi ? [...cur] : cur); } };
}

export function button(parent, { label, icon = '', onClick }) {
  const b = el('button', 'btn-i', `${icon}${bi(label)}`); b.type = 'button';
  b.addEventListener('click', onClick); parent.appendChild(b); return b;
}

export function readouts(inst, defs, before = null) {
  const row = el('div', 'ro-row'); const map = {};
  for (const d of defs) {
    const r = el('div', 'ro', `<div class="ro-l">${bi(d.label)}</div><div class="ro-v" aria-live="polite"></div>`);
    map[d.key] = r.querySelector('.ro-v'); row.appendChild(r);
  }
  inst.insertBefore(row, before);
  return { row, set(k, html, cls = '') { if (map[k]) { map[k].innerHTML = html; map[k].className = 'ro-v ' + cls; } } };
}

export function legend(inst, items, before = null) {
  const lg = el('div', 'legend');
  lg.innerHTML = items.map((i) => `<span><i class="${i.dot ? 'dot' : ''}" style="--k:${i.color}"></i>${bi(i.label)}</span>`).join('');
  inst.insertBefore(lg, before); return lg;
}

export function note(inst, html) { const n = el('div', 'inst-note', html); inst.appendChild(n); return n; }

// ---------- drawing helpers ----------
export function scale(d0, d1, r0, r1) {
  const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
  f.d0 = d0; f.d1 = d1; f.r0 = r0; f.r1 = r1;
  return f;
}
export function ticks(min, max, n = 5) {
  const span = max - min; if (span <= 0) return [min];
  const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out = []; for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
export function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
export function text(c, s, x, y, { size = 12, weight = 500, color = C.ink2, align = 'left', base = 'alphabetic', disp = false, maxW } = {}) {
  c.font = font(size, weight, disp); c.fillStyle = color; c.textAlign = align; c.textBaseline = base;
  if (maxW) c.fillText(s, x, y, maxW); else c.fillText(s, x, y);
}
export function line(c, pts, { color = C.e, width = 2, dash = null, alpha = 1 } = {}) {
  if (pts.length < 2) return;
  c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round';
  if (dash) c.setLineDash(dash);
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); c.restore();
}
export function area(c, pts, y0, fill) {
  if (pts.length < 2) return;
  c.save(); c.fillStyle = fill; c.beginPath(); c.moveTo(pts[0][0], y0);
  for (const p of pts) c.lineTo(p[0], p[1]); c.lineTo(pts[pts.length - 1][0], y0); c.closePath(); c.fill(); c.restore();
}
export function arrow(c, x1, y1, x2, y2, { color = C.ink2, width = 1.6, head = 7 } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = width; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6); c.stroke();
  c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45)); c.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45)); c.closePath(); c.fill();
  c.restore();
}
export function dot(c, x, y, r, color, ring = null) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill();
  if (ring) { c.lineWidth = 2; c.strokeStyle = ring; c.stroke(); }
}
export function glowDot(c, x, y, r, color, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, color); g.addColorStop(0.33, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.globalAlpha = a * 0.35; c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, Math.PI * 2); c.fill(); c.restore();
  c.save(); c.globalAlpha = a; dot(c, x, y, r, color); c.restore();
}
export function withAlpha(hex, a) {
  const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mix(h1, h2, t) {
  const p = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const a = p(h1), b = p(h2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
}

// axes with grid; returns plot box
export function axes(c, box, sx, sy, o = {}) {
  const { x, y, w, h } = box;
  const xt = o.xt || ticks(sx.d0, sx.d1, o.nx || 6), yt = o.yt || ticks(sy.d0, sy.d1, o.ny || 5);
  c.save();
  c.lineWidth = 1;
  for (const v of yt) { const py = Math.round(sy(v)) + 0.5; c.strokeStyle = C.grid2; c.beginPath(); c.moveTo(x, py); c.lineTo(x + w, py); c.stroke();
    text(c, (o.fy || ((v) => fmt(v)))(v), x - 8, py + 4, { size: 11, color: C.ink3, align: 'right' }); }
  for (const v of xt) { const px = Math.round(sx(v)) + 0.5; if (o.xgrid !== false) { c.strokeStyle = C.grid; c.beginPath(); c.moveTo(px, y); c.lineTo(px, y + h); c.stroke(); }
    text(c, (o.fx || ((v) => fmt(v)))(v), px, y + h + 16, { size: 11, color: C.ink3, align: 'center' }); }
  c.strokeStyle = C.line; c.beginPath(); c.moveTo(x, y + h + 0.5); c.lineTo(x + w, y + h + 0.5); c.stroke();
  if (o.xl) text(c, T(o.xl), x + w, y + h + 34, { size: 11.5, color: C.ink2, align: 'right' });
  if (o.yl) text(c, T(o.yl), x, y - 12, { size: 11.5, color: C.ink2, align: 'left' });
  c.restore();
}

// find nearest index for hover
export function nearestIdx(xs, v) {
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] < v) lo = m; else hi = m; }
  return Math.abs(xs[lo] - v) <= Math.abs(xs[hi] - v) ? lo : hi;
}

// tooltip drawn on canvas
export function tip(c, x, y, lines, W, H) {
  const pad = 9, lh = 17;
  c.font = font(12, 500);
  const tw = Math.max(...lines.map((l) => c.measureText(typeof l === 'string' ? l : l.t).width)) + pad * 2 + 14;
  const th = lines.length * lh + pad * 2 - 3;
  let tx = x + 14, ty = y - th - 10;
  if (tx + tw > W - 6) tx = x - tw - 14;
  if (ty < 6) ty = y + 14;
  if (ty + th > H - 6) ty = H - th - 6;
  c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 16; rr(c, tx, ty, tw, th, 9); c.fillStyle = 'rgba(21,29,37,.96)'; c.fill(); c.restore();
  c.save(); rr(c, tx, ty, tw, th, 9); c.strokeStyle = C.line; c.stroke(); c.restore();
  lines.forEach((l, i) => {
    const o = typeof l === 'string' ? { t: l } : l;
    const yy = ty + pad + 12 + i * lh;
    if (o.k) { c.fillStyle = o.k; c.fillRect(tx + pad, yy - 8, 8, 8); }
    text(c, o.t, tx + pad + (o.k ? 14 : 0), yy, { size: 12, weight: o.b ? 600 : 500, color: o.b ? C.ink : C.ink2 });
  });
}

// simple tween
export function tween(from, to, dur, onUpdate, ease = easeInOut) {
  if (reduced.matches || dur <= 0) { onUpdate(to, 1); return Promise.resolve(); }
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (ts) => { const k = clamp((ts - t0) / dur, 0, 1); onUpdate(from + (to - from) * ease(k), k); if (k < 1) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
}
