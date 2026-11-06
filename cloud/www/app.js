// betterle.win: design switcher, scroll entrance, and the release log. Outside text goes in as textContent only.
(() => {
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // ---- entrance: each part rises once as it scrolls in ----
  const parts = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce.matches) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    parts.forEach((p) => io.observe(p));
  } else parts.forEach((p) => p.classList.add('is-in'));

  // ---- design switcher: the thumb glides from where it is to the pick ----
  const NOTES = {
    og: 'OG: the stock layout you know, with BetterLET’s features on top and a real dark mode.',
    v1: 'V1: a three-column layout that reads like a server rack. Status lights show what’s new.',
    v2: 'V2: an airy layout in the style of LowEndBox, with larger type and round avatars.',
  };
  const seg = document.querySelector('.segmented');
  const thumb = seg?.querySelector('.segmented-thumb');
  const shot = document.querySelector('.design-shot');
  const img = shot?.querySelector('img[data-light]');
  const dark = shot?.querySelector('source[data-dark]');
  const note = document.querySelector('[data-note]');
  const tabs = seg ? [...seg.querySelectorAll('button')] : [];
  const placeThumb = (btn) => {
    if (!thumb || !btn) return;
    thumb.style.width = `${btn.offsetWidth}px`;
    thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
  };
  // Preload so a switch never shows a blank frame.
  ['og', 'v1', 'v2'].forEach((d) => { new Image().src = `/media/${d}.webp`; new Image().src = `/media/${d}-dark.webp`; });
  const pick = (btn, focus) => {
    const d = btn.dataset.design;
    tabs.forEach((t) => { t.setAttribute('aria-selected', String(t === btn)); t.tabIndex = t === btn ? 0 : -1; });
    placeThumb(btn);
    if (focus) btn.focus();
    note.textContent = NOTES[d];
    const swap = () => {
      dark.srcset = `/media/${d}-dark.webp`;
      img.src = `/media/${d}.webp`;
      img.alt = `BetterLET's ${d.toUpperCase()} design on the LowEndTalk thread list`;
    };
    if (reduce.matches) { swap(); return; }
    shot.classList.add('is-swapping');
    setTimeout(() => { swap(); img.decode?.().catch(() => {}).finally(() => shot.classList.remove('is-swapping')) ?? shot.classList.remove('is-swapping'); }, 160);
  };
  tabs.forEach((t) => {
    // Press feedback on pointer-down; the pick commits on click.
    t.addEventListener('click', () => pick(t));
    t.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(t);
      const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
      if (next) { e.preventDefault(); pick(next, true); }
    });
  });
  const current = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
  tabs.forEach((t) => { t.tabIndex = t === current ? 0 : -1; });
  // Place once fonts settle, without animating the first placement.
  const firstPlace = () => { if (!thumb) return; thumb.style.transition = 'none'; placeThumb(current); thumb.getBoundingClientRect(); thumb.style.transition = ''; };
  (document.fonts?.ready || Promise.resolve()).then(firstPlace);
  addEventListener('resize', () => placeThumb(tabs.find((t) => t.getAttribute('aria-selected') === 'true')));

  // ---- release log: live from GitHub, with the copy saved at deploy as a fallback ----
  const log = document.querySelector('[data-log]');
  const latestLabel = document.querySelector('[data-latest]');
  const clean = (line) => line.trim();
  const keep = (line) => Boolean(line);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const render = (releases) => {
    log.replaceChildren();
    const list = releases.filter((r) => /^v\d/.test(r.tag)).slice(0, 20);
    if (!list.length) { log.appendChild(el('li', 'log-empty', 'No releases to show right now.')); return; }
    if (latestLabel) latestLabel.textContent = list[0].tag;
    list.forEach((r, i) => {
      const item = el('li');
      const tag = el('div', 'tag');
      tag.appendChild(el('b', '', r.tag));
      const when = el('time', '', new Date(r.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
      when.dateTime = r.date;
      tag.appendChild(when);
      if (i === 0) tag.appendChild(el('span', 'latest', 'Latest'));
      const ul = el('ul');
      (r.body || '').split(/\r?\n/).map((l) => l.replace(/^\s*[-*]\s*/, '')).map(clean).filter(keep).forEach((l) => ul.appendChild(el('li', '', l)));
      if (!ul.children.length) ul.appendChild(el('li', '', 'Fixes and improvements.'));
      item.append(tag, ul);
      log.appendChild(item);
    });
  };
  const fromSaved = () => fetch('/releases.json').then((r) => r.json()).then(render).catch(() => render([]));
  fetch('https://api.github.com/repos/gfsaaser24/BetterLET/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((rows) => render(rows.filter((r) => !r.draft && !r.prerelease).map((r) => ({ tag: r.tag_name, date: r.published_at, body: r.body }))))
    .catch(fromSaved);
})();
