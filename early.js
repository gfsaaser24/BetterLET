// Runs before the page paints, so the old theme does not flash.
(() => {
  const KEY = 'letBetter.theme';
  const DESIGN_KEY = 'letBetter.design';
  const FONT_URL = 'https://api.fontshare.com/css?f[]=general-sans@400,500,600,700&display=swap';
  const root = document.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const read = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
  const readDesign = () => { try { return localStorage.getItem(DESIGN_KEY) || 'v1'; } catch { return 'v1'; } };
  // V2 uses LowEndBox's font. It loads only when V2 is on.
  const loadFont = () => {
    if (document.getElementById('bl-font')) return;
    const link = document.createElement('link');
    link.id = 'bl-font';
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    (document.head || root).appendChild(link);
  };
  const apply = () => {
    const mode = read();
    const design = readDesign();
    root.classList.toggle('bl-v2', design === 'v2');
    root.dataset.blDesign = design;
    if (design === 'v2') loadFont();
    root.classList.add('bl-on');
    root.classList.toggle('bl-dark', mode === 'auto' ? media.matches : mode === 'dark');
    root.dataset.blTheme = mode;
  };
  apply();
  // The site has no viewport tag, so small screens would get a shrunken desktop page.
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1';
  (document.head || root).appendChild(viewport);
  // Backup for the CSS timer: the page must never stay hidden.
  setTimeout(() => root.classList.add('bl-ready'), 3000);
  media.addEventListener('change', apply);
  // One crossfade of the whole page. Fading each element on its own is what lagged.
  const swap = () => {
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply);
    else apply();
  };
  window.__letBetterTheme = {
    get: read,
    set(mode) {
      try { localStorage.setItem(KEY, mode); } catch {}
      swap();
    },
    getDesign: readDesign,
    setDesign(design) {
      try { localStorage.setItem(DESIGN_KEY, design); } catch {}
      swap();
    },
  };
})();
