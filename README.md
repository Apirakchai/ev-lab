# EV Lab by Sukmart

Interactive, bilingual (Thai / English) website explaining electric-vehicle batteries — from cell chemistry to charging habits — with a Simple and a Deep (technical) reading level on every page.

Live: https://ev.sukmart.com (preview: https://apirakchai.github.io/ev-lab/)

## Structure
- `src/layout.html` — page shell (header, menu, footer)
- `src/pages/*.html` — page bodies. First line is `<!--meta {...}-->`
  - `[[ไทย|English]]` inline language pairs; `l-th` / `l-en` attributes for blocks
  - `m-s` (Simple only) / `m-d` (Deep only)
  - `<k>…</k>` inline math, `<kd>…</kd>` display math (pre-rendered with KaTeX)
  - citations: `<a class="cite" href="sources.html#id">[n]</a>` (numbers are assigned automatically from `sources.html`)
- `src/chapters.json` — chapter order, titles and descriptions
- `assets/js/core.js` — language / reading level / theme, menu, lazy figure loader
- `assets/js/lib.js` — canvas stage, controls, chart helpers
- `assets/js/models.js` — battery models (NREL BLAST-Lite ports, OCV curves, charging and road-load physics)
- `assets/js/figs/*.js` — interactive figures, loaded by `data-fig="module:function"`

## Build
```
npm install
node build/build.mjs
```
Writes the `*.html` pages to the repository root (served by GitHub Pages from `main`).

## Custom domain
Cloudflare DNS: `CNAME ev → apirakchai.github.io` (DNS only), then add a `CNAME` file containing `ev.sukmart.com` and enable "Enforce HTTPS" in Settings → Pages.
