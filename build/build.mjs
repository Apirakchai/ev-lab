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

function renderMath(html) {
  const opts = (display) => ({ displayMode: display, throwOnError: false, output: 'html', strict: 'ignore', trust: false });
  html = html.replace(/<kd>([\s\S]*?)<\/kd>/g, (_, tex) =>
    `<div class="math-d" role="math">${katex.renderToString(unescapeHtml(tex.trim()), opts(true))}</div>`);
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
  const groups = [
    { key: 'learn', th: 'บทเรียน', en: 'Chapters' },
    { key: 'tools', th: 'เครื่องมือและข้อมูล', en: 'Tools & reference' },
  ];
  return groups.map((g) => {
    const items = CHAPTERS.filter((c) => c.group === g.key).map((c) => {
      const num = c.num ? `<span class="mi-num" aria-hidden="true">${String(c.num).padStart(2, '0')}</span>` : `<span class="mi-num mi-ico" aria-hidden="true">${c.icon || '•'}</span>`;
      const cur = c.slug === activeSlug ? ' aria-current="page"' : '';
      return `<li><a class="mi" href="${c.file}"${cur}>${num}<span class="mi-t">${bi(c.th, c.en)}</span><span class="mi-d">${bi(c.dth, c.den)}</span></a></li>`;
    }).join('');
    return `<div class="menu-group"><p class="menu-h">${bi(g.th, g.en)}</p><ul class="menu-list">${items}</ul></div>`;
  }).join('');
}

function pathHtml() {
  const learn = CHAPTERS.filter((c) => c.group === 'learn');
  const tools = CHAPTERS.filter((c) => c.group === 'tools');
  const n = learn.length;
  const items = learn.map((c) => `<li><a class="path-i" href="${c.file}"><span class="cbadge" style="--lvl:${(c.num / n).toFixed(3)}">${String(c.num).padStart(2, '0')}</span><span class="path-t">${bi(c.th, c.en)}</span><span class="path-d">${bi(c.dth, c.den)}</span></a></li>`).join('');
  const t = tools.map((c) => `<li><a class="tool-i" href="${c.file}"><span class="tool-ico" aria-hidden="true">${c.icon}</span><span class="path-t">${bi(c.th, c.en)}</span><span class="path-d">${bi(c.dth, c.den)}</span></a></li>`).join('');
  return `<ol class="path">${items}</ol><ul class="tools">${t}</ul>`;
}

function pagerHtml(slug) {
  const seq = CHAPTERS.filter((c) => c.group === 'learn' || c.slug === 'index');
  const i = seq.findIndex((c) => c.slug === slug);
  if (i < 0) return '';
  const prev = seq[i - 1], next = seq[i + 1];
  const card = (c, dir) => c ? `<a class="pager-a pager-${dir}" href="${c.file}"><span class="pager-k">${dir === 'prev' ? bi('ก่อนหน้า', 'Previous') : bi('บทถัดไป', 'Next chapter')}</span><span class="pager-t">${bi(c.th, c.en)}</span></a>` : '<span></span>';
  return `<nav class="pager" aria-label="Chapters">${card(prev, 'prev')}${card(next, 'next')}</nav>`;
}

// ---------- build ----------
const layout = expand(read(path.join(SRC, 'layout.html')));
const assetFiles = walk(path.join(ROOT, 'assets')).filter((f) => /\.(css|js)$/.test(f));
const V = hashOf(assetFiles);
const pages = fs.readdirSync(path.join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const built = [];

for (const file of pages) {
  const raw = read(path.join(SRC, 'pages', file));
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error(`missing meta in ${file}`);
  const meta = JSON.parse(m[1]);
  const body = expand(raw.slice(m[0].length).replace('{{CHAPTER_PATH}}', pathHtml()));
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
  fs.writeFileSync(path.join(ROOT, outName), out);
  built.push(outName);
}

// sitemap
const base = 'https://ev.sukmart.com/';
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${built.map((f) => `  <url><loc>${base}${f === 'index.html' ? '' : f}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`built ${built.length} pages (v=${V}):`, built.join(', '));
