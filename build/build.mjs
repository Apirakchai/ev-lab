// EV Lab static site builder
// - wraps src/pages/*.html bodies in src/layout.html
// - expands bilingual / mode shorthands
// - pre-renders KaTeX math so pages ship no math JS
// Usage: node build/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import katex from 'katex';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const read = (p) => fs.readFileSync(p, 'utf8');

// ---------- chapter registry (order = learning path) ----------
export const CHAPTERS = JSON.parse(read(path.join(SRC, 'chapters.json')));

// ---------- helpers ----------
const hashOf = (files) => {
  const h = crypto.createHash('sha1');
  for (const f of files) if (fs.existsSync(f)) h.update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 8);
};
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const unescapeHtml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const bi = (th, en, tag = 'span', cls = '') =>
  `<${tag}${cls ? ` class="${cls}"` : ''} data-l="th" lang="th">${th}</${tag}><${tag}${cls ? ` class="${cls}"` : ''} data-l="en" lang="en">${en}</${tag}>`;

// ---------- Thai line breaking ----------
// Browsers break Thai with a dictionary that doesn't know words like "แบต", so short display text
// (headings, menu, titles) can split mid-word. Wrap each space-separated Thai phrase in an
// inline-block so lines only break between phrases (a phrase wider than the line still wraps).
const THAI = /[฀-๿]/;
const NUMTOK = /^[(]?[\d][\d.,]*(?:[–\-→/][\d.,]+)*(?:%|°C|x|×)?[)]?$/;
function wrapPhrases(inner) {
  if (!THAI.test(inner) || inner.includes('class="katex')) return inner;
  return inner.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<') || !THAI.test(part)) return part;
    // numbers stay with the Thai word that follows them ("10 องศา", "100% แบต…")
    const toks = part.split(/([ \t\n\r]+)/);
    for (let i = 0; i + 2 < toks.length; i += 2) {
      if (NUMTOK.test(toks[i]) && THAI.test(toks[i + 2])) { toks[i + 2] = toks[i] + '\u00a0' + toks[i + 2]; toks[i] = ''; toks[i + 1] = ''; }
    }
    return toks.map((tok) => (THAI.test(tok) ? `<span class="ph">${tok}</span>` : tok)).join('');
  }).join('');
}
const wp = (s) => wrapPhrases(String(s));
function wrapDisplayText(html) {
  // headings and summaries
  html = html.replace(/<(h[1-4]|summary)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (_, tag, attrs = '', inner) => `<${tag}${attrs}>${wrapPhrases(inner)}</${tag}>`);
  // short display classes
  html = html.replace(/<(p|div|span|b|strong|li)(\s[^>]*class="[^"]*\b(?:hero-k|key-h|box-h|lv-k|ph-wrap)\b[^"]*"[^>]*)>([\s\S]*?)<\/\1>/g,
    (_, tag, attrs, inner) => `<${tag}${attrs}>${wrapPhrases(inner)}</${tag}>`);
  return html;
}

// ---------- Thai word breaks in running text ----------
// Browsers find Thai line breaks with a dictionary that doesn't know loanwords such as "แบต" or
// "กราไฟต์", and an unknown word also throws off its neighbours ("แบ|ตอ|ยู่", "อุณห|ภู|มิ").
// For each word in src/thai-words.json we add a break opportunity on both sides (<wbr> also makes the
// browser segment the neighbours on their own) and keep the word itself on one line.
const THAI_WORDS = JSON.parse(read(path.join(SRC, 'thai-words.json'))).sort((a, b) => b.length - a.length);
const TW_RE = new RegExp(THAI_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
const LEAD = /[เ-ไ]/, FOLLOW = /[ะ-ฺๅ-๎]/;
function breakThaiRun(run) {
  let out = '', last = 0;
  for (const m of run.matchAll(TW_RE)) {
    const a = m.index, b = a + m[0].length;
    // never cut inside a syllable: a leading vowel before, or a vowel / tone mark after the match
    if ((a > 0 && LEAD.test(run[a - 1])) || (b < run.length && FOLLOW.test(run[b]))) continue;
    if (a < last) continue;
    out += run.slice(last, a) + (a > 0 ? '<wbr>' : '') + `<span class="nw">${m[0]}</span>` + (b < run.length ? '<wbr>' : '');
    last = b;
  }
  return out + run.slice(last);
}
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const SKIP = new Set(['head', 'script', 'style', 'title', 'option', 'select', 'textarea', 'svg', 'code', 'pre']);
function thaiBreaks(html) {
  const parts = html.split(/(<[^>]+>)/);
  let skip = null; // { tag, depth }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (p[0] === '<') {
      const m = p.match(/^<(\/?)([a-zA-Z][\w-]*)/);
      if (!m) continue;
      const close = m[1] === '/', tag = m[2].toLowerCase();
      if (skip) {
        if (tag === skip.tag && !VOID.has(tag) && !p.endsWith('/>')) skip.depth += close ? -1 : 1;
        if (skip.depth === 0) skip = null;
      } else if (!close && (SKIP.has(tag) || (tag === 'span' && /class="[^"]*\bkatex\b/.test(p)))) {
        if (!VOID.has(tag) && !p.endsWith('/>')) skip = { tag, depth: 1 };
      }
      continue;
    }
    if (!skip) parts[i] = p.replace(/[฀-๿]+/g, breakThaiRun);
  }
  return parts.join('');
}

// ---------- tables: label every cell with its column header (phones show rows as cards) ----------
function labelTables(html) {
  const strip = (h, drop) => h.replace(new RegExp(`<span[^>]*data-l="${drop}"[^>]*>[\\s\\S]*?<\\/span>`, 'g'), '')
    .replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().replace(/"/g, '&quot;');
  return html.replace(/<table class="tbl([^"]*)"([^>]*)>([\s\S]*?)<\/table>/g, (whole, cls, attrs, inner) => {
    const thead = inner.match(/<thead>([\s\S]*?)<\/thead>/);
    if (!thead) return whole;
    const labs = [...thead[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => ({ th: strip(m[1], 'en'), en: strip(m[1], 'th') }));
    const body = inner.replace(/<tbody>([\s\S]*?)<\/tbody>/, (_, rows) => '<tbody>' + rows.replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/g, (__, ta, cells) => {
      let i = 0;
      return `<tr${ta}>` + cells.replace(/<td([^>]*)>/g, (___, a) => { const L = labs[i++] || { th: '', en: '' }; return `<td${a} data-th="${L.th}" data-en="${L.en}">`; }) + '</tr>';
    }) + '</tbody>');
    return `<table class="tbl${cls}"${attrs}>${body}</table>`;
  });
}

// ---------- icons for the menu and tool cards ----------
const ICON = {
  index: '<path d="M3.4 9.3 10 3.7l6.6 5.6v6.9a.9.9 0 0 1-.9.9h-3.5v-4.8H7.8v4.8H4.3a.9.9 0 0 1-.9-.9z"/>',
  myths: '<path d="M4.2 4.2h11.6c.9 0 1.6.7 1.6 1.6v6.4c0 .9-.7 1.6-1.6 1.6H9.4l-3.7 2.9v-2.9H4.2c-.9 0-1.6-.7-1.6-1.6V5.8c0-.9.7-1.6 1.6-1.6z"/><path d="M10 6.9v3.2M10 12.1v.1"/>',
  lab: '<path d="M7.4 2.9h5.2M8.3 2.9v4.7l-4.2 7.6a1.4 1.4 0 0 0 1.2 2.1h9.4a1.4 1.4 0 0 0 1.2-2.1l-4.2-7.6V2.9"/><path d="M5.9 12.3h8.2"/>',
  glossary: '<path d="M10 5.3C8.4 4.1 6.2 3.7 3.1 3.9v11.5c3.1-.2 5.3.2 6.9 1.4 1.6-1.2 3.8-1.6 6.9-1.4V3.9c-3.1-.2-5.3.2-6.9 1.4zM10 5.3v11.5"/>',
  sources: '<path d="M5.6 2.9h6l3.6 3.6v10.2c0 .3-.2.5-.5.5H5.6c-.3 0-.5-.2-.5-.5V3.4c0-.3.2-.5.5-.5z"/><path d="M11.4 2.9v3.8h3.8M7.7 10.2h4.8M7.7 13.1h4.8"/>',
  chev: '<path d="M7.5 4.5 13 10l-5.5 5.5"/>',
};
const icon = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ''}</svg>`;

function renderMath(html) {
  const opts = (display) => ({ displayMode: display, throwOnError: false, output: 'html', strict: 'ignore', trust: false });
  html = html.replace(/<kd([^>]*)>([\s\S]*?)<\/kd>/g, (_, attrs, tex) =>
    `<div class="math-d" role="math"${attrs}>${katex.renderToString(unescapeHtml(tex.trim()), opts(true))}</div>`);
  html = html.replace(/<k>([\s\S]*?)<\/k>/g, (_, tex) => katex.renderToString(unescapeHtml(tex.trim()), opts(false)));
  return html;
}

function expand(html) {
  // [[ไทย|English]] inline pairs
  html = html.replace(/\[\[([\s\S]*?)\|([\s\S]*?)\]\]/g, (_, th, en) => bi(th, en));
  // attribute shorthands
  html = html.replace(/\sl-th(?=[\s>\/])/g, ' data-l="th" lang="th"')
             .replace(/\sl-en(?=[\s>\/])/g, ' data-l="en" lang="en"')
             .replace(/\sm-s(?=[\s>\/])/g, ' data-m="s"')
             .replace(/\sm-d(?=[\s>\/])/g, ' data-m="d"');
  return renderMath(html);
}

function navHtml(activeSlug) {
  const home = CHAPTERS.find((c) => c.slug === 'index');
  const learn = CHAPTERS.filter((c) => c.group === 'learn');
  const tools = CHAPTERS.filter((c) => c.group === 'tools');
  const cur = (c) => (c.slug === activeSlug ? ' aria-current="page"' : '');
  const rows = learn.map((c) => `<li><a class="mi" href="${c.file}"${cur(c)}><span class="mi-num">${String(c.num).padStart(2, '0')}</span><span class="mi-b"><span class="mi-t">${bi(wp(c.th), c.en)}</span><span class="mi-d">${bi(wp(c.dth), c.den)}</span></span>${icon('chev', 'mi-go')}</a></li>`).join('');
  const tiles = tools.map((c) => `<li><a class="mt" href="${c.file}"${cur(c)}><span class="mt-ico">${icon(c.slug)}</span><span class="mt-t">${bi(wp(c.th), c.en)}</span><span class="mt-d">${bi(wp(c.dth), c.den)}</span></a></li>`).join('');
  return `<div class="menu-group"><p class="menu-h"><span>${bi('บทเรียน', 'Chapters')}</span><span class="menu-c">${bi(`${learn.length} บท`, `${learn.length} chapters`)}</span></p><ol class="menu-list">${rows}</ol></div>
<div class="menu-group"><p class="menu-h"><span>${bi('เครื่องมือและข้อมูล', 'Tools & reference')}</span></p><ul class="menu-tools">${tiles}</ul></div>`;
}

function pathHtml() {
  const learn = CHAPTERS.filter((c) => c.group === 'learn');
  const tools = CHAPTERS.filter((c) => c.group === 'tools');
  const n = learn.length;
  const items = learn.map((c) => `<li><a class="path-i" href="${c.file}"><span class="cbadge" style="--lvl:${(c.num / n).toFixed(3)}">${String(c.num).padStart(2, '0')}</span><span class="path-t">${bi(wp(c.th), c.en)}</span><span class="path-d">${bi(wp(c.dth), c.den)}</span></a></li>`).join('');
  const t = tools.map((c) => `<li><a class="tool-i" href="${c.file}"><span class="tool-ico">${icon(c.slug)}</span><span class="path-t">${bi(wp(c.th), c.en)}</span><span class="path-d">${bi(wp(c.dth), c.den)}</span></a></li>`).join('');
  // an odd number of chapters leaves an empty cell in the two-column grid: fill it with a start card
  const first = learn[0];
  const cta = n % 2 ? `<li class="path-cta" aria-hidden="true"><a class="path-start" href="${first.file}" tabindex="-1"><span class="path-start-k">${bi('ไม่รู้จะเริ่มตรงไหน', 'Not sure where to start?')}</span><span class="path-start-t">${bi(wp('เริ่มจากบทที่ 1 แล้วอ่านตามลำดับ'), 'Begin with chapter 1 and read in order')}</span></a></li>` : '';
  return `<ol class="path">${items}${cta}</ol><ul class="tools">${t}</ul>`;
}

function pagerHtml(slug) {
  const seq = CHAPTERS.filter((c) => c.group === 'learn' || c.slug === 'index');
  const i = seq.findIndex((c) => c.slug === slug);
  if (i < 0) return '';
  const prev = seq[i - 1], next = seq[i + 1] || (slug !== 'index' ? CHAPTERS.find((c) => c.group === 'tools') : null);
  const card = (c, dir) => c ? `<a class="pager-a pager-${dir}" href="${c.file}"><span class="pager-k">${dir === 'prev' ? bi('ก่อนหน้า', 'Previous') : c.group === 'learn' ? bi('บทถัดไป', 'Next chapter') : bi('อ่านต่อ', 'Up next')}</span><span class="pager-t">${bi(wp(c.th), c.en)}</span></a>` : '<span></span>';
  return `<nav class="pager" aria-label="Chapters">${card(prev, 'prev')}${card(next, 'next')}</nav>`;
}

// ---------- build ----------
const layout = expand(read(path.join(SRC, 'layout.html')));
const assetFiles = walk(path.join(ROOT, 'assets')).filter((f) => /\.(css|js)$/.test(f));
const V = hashOf(assetFiles);
const pages = fs.readdirSync(path.join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
// citation numbers follow the order of <li id="…"> in the sources page
const REF_IDS = [...read(path.join(SRC, 'pages', 'sources.html')).matchAll(/<li id="([\w-]+)"/g)].map((m) => m[1]);
const refNum = (id) => { const i = REF_IDS.indexOf(id); if (i < 0) { console.warn('unknown citation id:', id); return '?'; } return i + 1; };
const numberCites = (html) => html.replace(/<a class="cite" href="sources\.html#([\w-]+)">\[[^\]]*\]<\/a>/g, (_, id) => `<a class="cite" href="sources.html#${id}">[${refNum(id)}]</a>`);
const built = [];

for (const file of pages) {
  const raw = read(path.join(SRC, 'pages', file));
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error(`missing meta in ${file}`);
  const meta = JSON.parse(m[1]);
  const body = wrapDisplayText(labelTables(numberCites(expand(raw.slice(m[0].length).replace('{{CHAPTER_PATH}}', pathHtml())))));
  const ch = CHAPTERS.find((c) => c.slug === meta.slug) || {};
  const titleTh = meta.title_th || ch.th, titleEn = meta.title_en || ch.en;
  const descTh = meta.desc_th || ch.dth || '', descEn = meta.desc_en || ch.den || '';
  const fullTitleTh = meta.slug === 'index' ? 'EV Lab — ทุกเรื่องของแบตเตอรี่รถยนต์ไฟฟ้า' : `${titleTh} — EV Lab`;
  const fullTitleEn = meta.slug === 'index' ? 'EV Lab — Everything about EV batteries' : `${titleEn} — EV Lab`;
  const scripts = (meta.scripts || []).map((s) => `<script type="module" src="assets/js/${s}?v=${V}"></script>`).join('\n');
  const out = layout
    .replaceAll('{{V}}', V)
    .replaceAll('{{TITLE}}', esc(fullTitleTh))
    .replaceAll('{{TITLE_TH}}', esc(fullTitleTh))
    .replaceAll('{{TITLE_EN}}', esc(fullTitleEn))
    .replaceAll('{{DESC}}', esc(descTh))
    .replaceAll('{{DESC_TH}}', esc(descTh))
    .replaceAll('{{DESC_EN}}', esc(descEn))
    .replaceAll('{{SLUG}}', meta.slug)
    .replaceAll('{{FILE}}', ch.file || `${meta.slug}.html`)
    .replace('{{MENU}}', navHtml(meta.slug))
    .replace('{{PAGER}}', meta.pager === false ? '' : pagerHtml(meta.slug))
    .replace('{{SCRIPTS}}', scripts)
    .replace('{{BODY}}', body);
  const outName = meta.slug === 'index' ? 'index.html' : `${meta.slug}.html`;
  fs.writeFileSync(path.join(ROOT, outName), thaiBreaks(out));
  built.push(outName);
}

// sitemap
const base = 'https://ev.sukmart.com/';
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${built.map((f) => `  <url><loc>${base}${f === 'index.html' ? '' : f}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`built ${built.length} pages (v=${V}):`, built.join(', '));
