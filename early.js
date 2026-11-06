// Runs before the page paints, so the old theme does not flash.
(() => {
  const KEY = 'letBetter.theme';
  const DESIGN_KEY = 'letBetter.design';
  const SIG_KEY = 'letBetter.signatures';
  const FONT_URL = 'https://api.fontshare.com/css?f[]=general-sans@400,500,600,700&display=swap';
  const root = document.documentElement;
  // Two forums: LowEndTalk and LowEndSpirit. They share the inside markup, not the page frame.
  const les = /(^|\.)lowendspirit\.com$/.test(location.hostname);
  root.classList.add(les ? 'bl-site-les' : 'bl-site-let');
  // LowEndSpirit dark theme: the site's own file. Members can also pick it in their account.
  const LES_THEME = /\/plugins\/ThemeChooser\/design\/(?!shared\.css)[^/?]+\.css/;
  const LES_DARK = '/plugins/ThemeChooser/design/dark.css';
  let lesWatch = null;
  const media = matchMedia('(prefers-color-scheme: dark)');
  const read = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
  const readSig = () => { try { return localStorage.getItem(SIG_KEY) || 'expanded'; } catch { return 'expanded'; } };
  // The old Ads setting is gone. Clear what it saved.
  try { localStorage.removeItem('letBetter.ads'); } catch {}
  // Ctrl+Shift+M sets this key. There is no menu item for it.
  const ADS_KEY = 'letBetter.adsHidden';
  const adsHidden = () => { try { return localStorage.getItem(ADS_KEY) === '1'; } catch { return false; } };
  root.classList.toggle('bl-ads-off', adsHidden());
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
  // LowEndSpirit: our theme setting wins over the member's saved site theme.
  const lesTheme = (dark) => {
    const strip = (node) => {
      if (node.tagName === 'LINK' && LES_THEME.test(node.getAttribute('href') || '') && node.id !== 'bl-les-dark') node.remove();
    };
    document.querySelectorAll('link[rel="stylesheet"]').forEach(strip);
    // Theme links that come later in the head are removed as they arrive.
    if (!lesWatch) {
      lesWatch = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach(strip)));
      lesWatch.observe(root, { childList: true, subtree: true });
      addEventListener('DOMContentLoaded', () => lesWatch.disconnect(), { once: true });
    }
    root.classList.toggle('les-karma-dark', dark);
    let link = document.getElementById('bl-les-dark');
    if (dark && !link) {
      link = document.createElement('link');
      link.id = 'bl-les-dark';
      link.rel = 'stylesheet';
      link.href = LES_DARK;
      (document.head || root).appendChild(link);
      // The site's light rules have the same weight, so the dark file must come last in the head.
      addEventListener('DOMContentLoaded', () => { if (link.isConnected) document.head.appendChild(link); }, { once: true });
    } else if (!dark) link?.remove();
  };
  const apply = () => {
    const mode = read();
    const design = readDesign();
    root.classList.toggle('bl-v2', design === 'v2');
    root.classList.toggle('bl-og', design === 'og');
    root.classList.toggle('bl-sig-closed', readSig() === 'collapsed');
    const dark = mode === 'auto' ? media.matches : mode === 'dark';
    // The site's own dark mode paints pale text over V1 and V2, so it stays off there. OG uses it.
    // This runs before the site's script reads the setting.
    if (les) lesTheme(design === 'og' && dark);
    else try { localStorage.setItem('theme', design === 'og' && dark ? 'dark' : 'light'); } catch {}
    root.dataset.blDesign = design;
    if (design === 'v2') loadFont();
    root.classList.toggle('bl-on', design !== 'og');
    root.classList.toggle('bl-dark', dark);
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
  // OG is the stock page, so it needs a reload to change theme or leave.
  media.addEventListener('change', () => {
    if (readDesign() === 'og' && read() === 'auto') location.reload();
    else apply();
  });
  // One crossfade of the whole page. Fading each element on its own is what lagged.
  const swap = () => {
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply);
    else apply();
  };
  window.__letBetterTheme = {
    get: read,
    set(mode) {
      try { localStorage.setItem(KEY, mode); } catch {}
      if (readDesign() === 'og') location.reload();
      else swap();
    },
    getSignatures: readSig,
    setSignatures(value) {
      try { localStorage.setItem(SIG_KEY, value); } catch {}
      apply();
    },
    toggleAds() {
      const hide = !adsHidden();
      try { localStorage.setItem(ADS_KEY, hide ? '1' : '0'); } catch {}
      root.classList.toggle('bl-ads-off', hide);
      return hide;
    },
    getDesign: readDesign,
    setDesign(design) {
      const from = readDesign();
      try { localStorage.setItem(DESIGN_KEY, design); } catch {}
      if (from === 'og' || design === 'og') location.reload();
      else swap();
    },
  };
})();
