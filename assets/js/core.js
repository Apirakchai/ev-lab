// EV Lab — page chrome: language, reading level, theme, menu, lazy figures
const root = document.documentElement;
const store = {
  get(k) { try { return localStorage.getItem('evlab.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('evlab.' + k, v); } catch (e) { /* private mode */ } },
};

function prefs() { return { lang: root.dataset.lang || 'th', mode: root.dataset.mode || 'simple', theme: root.dataset.theme || '' }; }

function apply(change = {}, persist = true) {
  if (change.lang) { root.dataset.lang = change.lang; root.lang = change.lang; if (persist) store.set('lang', change.lang); }
  if (change.mode) { root.dataset.mode = change.mode; if (persist) store.set('mode', change.mode); }
  if ('theme' in change) {
    if (change.theme) root.dataset.theme = change.theme; else delete root.dataset.theme;
    if (persist) store.set('theme', change.theme || '');
  }
  const p = prefs();
  document.title = p.lang === 'en' ? root.dataset.titleEn : root.dataset.titleTh;
  const md = document.querySelector('meta[name="description"]');
  if (md) { if (!md.dataset.th) md.dataset.th = md.content; md.content = p.lang === 'en' ? (root.dataset.descEn || md.dataset.th) : md.dataset.th; }
  document.querySelectorAll('#langSel').forEach((s) => { s.value = p.lang; });
  document.querySelectorAll('[data-set-mode]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.setMode === p.mode)));
  // keep the URL shareable without clutter
  const u = new URL(location.href);
  if (u.searchParams.has('lang') || u.searchParams.has('mode')) { u.searchParams.delete('lang'); u.searchParams.delete('mode'); history.replaceState(null, '', u); }
  window.dispatchEvent(new CustomEvent('evlab:prefs', { detail: p }));
}

function effectiveTheme() {
  if (root.dataset.theme) return root.dataset.theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ---------- controls ----------
function initChrome() {
  // persist URL-provided prefs once
  const q = new URLSearchParams(location.search);
  if (q.get('lang')) store.set('lang', root.dataset.lang);
  if (q.get('mode')) store.set('mode', root.dataset.mode);

  // floating reading-level switch for phones / small tablets
  const hdrSeg = document.querySelector('.hdr-tools .seg');
  if (hdrSeg && !document.querySelector('.fab-mode')) {
    const fab = hdrSeg.cloneNode(true);
    fab.classList.add('fab-mode');
    document.body.appendChild(fab);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set-mode]');
    if (b) { apply({ mode: b.dataset.setMode }); }
  });
  document.querySelectorAll('#langSel').forEach((s) => s.addEventListener('change', () => apply({ lang: s.value })));

  const themeBtn = document.querySelector('.hdr-theme');
  if (themeBtn) themeBtn.addEventListener('click', () => apply({ theme: effectiveTheme() === 'dark' ? 'light' : 'dark' }));

  // theme switch inside the menu for small screens
  const mm = document.querySelector('.menu-mode');
  if (mm && !mm.querySelector('.menu-theme')) {
    const wrap = document.createElement('div');
    wrap.className = 'menu-theme';
    wrap.innerHTML = '<p><span data-l="th" lang="th">ธีม</span><span data-l="en" lang="en">Theme</span></p><div class="seg seg-wide" role="radiogroup" aria-label="Theme">' +
      '<button type="button" role="radio" data-set-theme="light"><span data-l="th" lang="th">สว่าง</span><span data-l="en" lang="en">Light</span></button>' +
      '<button type="button" role="radio" data-set-theme="dark"><span data-l="th" lang="th">มืด</span><span data-l="en" lang="en">Dark</span></button></div>';
    wrap.style.marginTop = '12px';
    mm.appendChild(wrap);
    const sync = () => wrap.querySelectorAll('[data-set-theme]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.setTheme === effectiveTheme())));
    wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-set-theme]'); if (b) { apply({ theme: b.dataset.setTheme }); sync(); } });
    window.addEventListener('evlab:prefs', sync); sync();
  }

  // menu
  const menu = document.getElementById('menu');
  const opener = document.querySelector('.hdr-menu');
  let lastFocus = null;
  const open = () => { lastFocus = document.activeElement; menu.hidden = false; opener.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden';
    const cur = menu.querySelector('[aria-current="page"]') || menu.querySelector('a'); if (cur) cur.focus({ preventScroll: true }); };
  const close = () => { menu.hidden = true; opener.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus({ preventScroll: true }); };
  if (menu && opener) {
    opener.addEventListener('click', () => (menu.hidden ? open() : close()));
    menu.addEventListener('click', (e) => { if (e.target.closest('[data-close-menu]')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) close(); });
  }

  // reading progress
  const bar = document.querySelector('.readbar');
  if (bar) {
    let ticking = false;
    const upd = () => { ticking = false; const h = document.documentElement.scrollHeight - innerHeight; bar.style.setProperty('--p', h > 0 ? Math.min(1, scrollY / h).toFixed(4) : 0); };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }
}

// ---------- lazy figure loader ----------
function initFigures() {
  const figs = [...document.querySelectorAll('[data-fig]')];
  if (!figs.length) return;
  const v = (document.querySelector('script[src*="core.js"]')?.src.split('?v=')[1]) || '';
  const boot = async (el) => {
    if (el.dataset.booted) return; el.dataset.booted = '1';
    const [mod, fn] = el.dataset.fig.split(':');
    try {
      const m = await import(`./figs/${mod}.js${v ? '?v=' + v : ''}`);
      const f = m[fn || 'default'];
      if (typeof f !== 'function') throw new Error('figure not found: ' + el.dataset.fig);
      await f(el);
    } catch (err) {
      console.error('[EV Lab]', err);
      el.insertAdjacentHTML('beforeend', '<div class="ph">⚠︎ ' + (root.dataset.lang === 'en' ? 'This figure could not load.' : 'โหลดภาพประกอบนี้ไม่สำเร็จ') + '</div>');
    }
  };
  if (!('IntersectionObserver' in window)) { figs.forEach(boot); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); boot(en.target); } }), { rootMargin: '600px 0px' });
  figs.forEach((f) => io.observe(f));
}

initChrome();
apply({}, false);
initFigures();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => apply({}, false));
