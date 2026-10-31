// Hover cards for people and links. All outside text goes in as textContent, never as HTML.
(() => {
  if (window.__letBetterPop) return;
  window.__letBetterPop = true;

  const pop = document.createElement('div');
  pop.id = 'bl-pop';
  pop.setAttribute('role', 'tooltip');
  document.body.appendChild(pop);

  const USER_DELAY = 350;
  const LINK_DELAY = 450;
  const CLOSE_DELAY = 160;
  const RESERVED = new Set(['edit', 'notifications', 'preferences', 'password', 'picture', 'signature', 'quotes', 'connections',
    'invitations', 'tokens', 'activity', 'comments', 'discussions', 'receivedthanks', 'removepicture', 'ignore']);

  let anchor = null;
  let openTimer = 0;
  let closeTimer = 0;
  let token = 0;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // Never over the ad column: the card stops at its left edge.
  const place = () => {
    if (!anchor) return;
    const r = anchor.getClientRects()[0] || anchor.getBoundingClientRect();
    const panel = document.querySelector('#Panel');
    const limit = panel?.offsetWidth && panel.getBoundingClientRect().left > innerWidth / 2 ? panel.getBoundingClientRect().left - 12 : innerWidth - 12;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = Math.max(12, Math.min(r.left, limit - w));
    const below = r.bottom + 8 + h <= innerHeight - 12;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(below ? r.bottom + 8 : Math.max(12, r.top - h - 8))}px`;
    pop.classList.toggle('bl-above', !below);
  };

  const close = () => {
    clearTimeout(openTimer);
    anchor = null;
    token++;
    pop.classList.remove('bl-open');
  };
  const closeSoon = () => { clearTimeout(closeTimer); closeTimer = setTimeout(close, CLOSE_DELAY); };

  const fill = (...nodes) => { pop.replaceChildren(...nodes); place(); };
  const skeleton = () => {
    const box = el('div', 'bl-pop-body');
    box.append(el('div', 'bl-skel'), el('div', 'bl-skel bl-skel-short'));
    return box;
  };

  // ---- people ----
  const users = new Map();
  const nameFrom = (a) => {
    if (a.closest('#bl-pop, .MeBox, .BoxProfileFilter, .SideMenu, #bl-profile-head')) return null;
    const m = (a.getAttribute('href') || '').match(/^(?:https:\/\/lowendtalk\.com)?\/profile\/([^/?#]+)$/);
    return m && !RESERVED.has(m[1].toLowerCase()) ? m[1] : null;
  };

  const fetchUser = (slug) => {
    if (!users.has(slug)) {
      users.set(slug, fetch(`/profile/${slug}`, { credentials: 'include' }).then(async (res) => {
        if (!res.ok) throw new Error('missing');
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const facts = {};
        doc.querySelectorAll('dl.About dt').forEach((dt) => {
          const dd = dt.nextElementSibling;
          if (dd?.tagName === 'DD') facts[dt.textContent.trim()] = dd.textContent.trim();
        });
        const count = (cls) => doc.querySelector(`.BoxProfileFilter .${cls} .Count, .BoxProfileFilter a[href*="/profile/${cls.toLowerCase()}/"] .Count`)?.textContent.trim() || '0';
        const provider = Object.keys(facts).find((k) => k.startsWith('If Yes'));
        return {
          name: doc.querySelector('.User h1')?.textContent.trim() || decodeURIComponent(slug),
          photo: doc.querySelector('.PhotoWrapLarge img')?.getAttribute('src') || '',
          roles: facts.Roles || '',
          provider: provider ? facts[provider] : '',
          specs: [['Joined', facts.Joined], ['Last active', facts['Last Active']], ['Threads', count('Discussions')], ['Comments', count('Comments')], ['Thanked', facts.Thanked]],
        };
      }).catch((err) => { users.delete(slug); throw err; }));
    }
    return users.get(slug);
  };

  const userCard = (u) => {
    const head = el('div', 'bl-pop-user');
    if (u.photo) {
      const img = el('img');
      img.src = u.photo;
      img.alt = '';
      head.appendChild(img);
    }
    const who = el('div');
    who.appendChild(el('strong', '', u.name));
    if (u.roles) who.appendChild(el('span', '', u.roles));
    head.appendChild(who);
    const specs = el('dl', 'bl-pop-specs');
    u.specs.filter(([, value]) => value).forEach(([label, value]) => {
      const pair = el('div');
      pair.append(el('dt', '', label), el('dd', '', value));
      specs.appendChild(pair);
    });
    const box = el('div', 'bl-pop-body');
    box.append(head, specs);
    if (u.provider) box.appendChild(el('p', 'bl-pop-note', `Hosting provider: ${u.provider}`));
    return box;
  };

  const showUser = async (a, slug) => {
    const mine = ++token;
    fill(skeleton());
    pop.classList.add('bl-open');
    try {
      const u = await fetchUser(slug);
      if (mine === token) fill(userCard(u));
    } catch {
      if (mine === token) fill(el('p', 'bl-pop-body bl-pop-note', 'Profile not available.'));
    }
  };

  // ---- links ----
  const previews = new Map();
  const externalUrl = (a) => {
    if (!a.closest('.userContent, .Message') || a.closest('#bl-pop')) return null;
    try {
      const url = new URL(a.href);
      return /^https?:$/.test(url.protocol) && url.hostname !== location.hostname ? url : null;
    } catch { return null; }
  };

  const SAFETY = {
    ok: ['No known threats', ''],
    blocked: ['Flagged as unsafe by Cloudflare', 'bl-danger'],
    missing: ['This domain does not exist', 'bl-danger'],
    private: ['Private address, preview skipped', 'bl-danger'],
    unknown: ['Safety check not available', ''],
  };

  // Link text that names another site is a common trick.
  const textMismatch = (a, url) => {
    const m = a.textContent.trim().match(/^(?:https?:\/\/)?((?:[\w-]+\.)+[a-z]{2,})(?:[/?#]\S*)?$/i);
    if (!m) return false;
    const strip = (h) => h.toLowerCase().replace(/^www\./, '');
    const shown = strip(m[1]);
    const real = strip(url.hostname);
    return shown !== real && !real.endsWith(`.${shown}`) && !shown.endsWith(`.${real}`);
  };

  const linkCard = (a, url, data) => {
    const nodes = [];
    // Only local image data. A remote URL here would send the forum's cookies.
    if (/^data:image\/(jpeg|png|webp|gif|avif);base64,/.test(data.image || '')) {
      const img = el('img', 'bl-pop-image');
      img.alt = '';
      img.addEventListener('error', () => { img.remove(); place(); });
      img.src = data.image;
      nodes.push(img);
    }
    const box = el('div', 'bl-pop-body');
    if (data.title) box.appendChild(el('strong', 'bl-pop-title', data.title));
    if (data.description) box.appendChild(el('p', 'bl-pop-desc', data.description));
    box.appendChild(el('p', 'bl-pop-host', url.hostname.replace(/^www\./, '')));
    const [label, cls] = SAFETY[data.safety] || SAFETY.unknown;
    box.appendChild(el('p', `bl-pop-safety ${cls}`, label));
    if (textMismatch(a, url)) box.appendChild(el('p', 'bl-pop-safety bl-danger', 'Link text shows a different site'));
    nodes.push(box);
    return nodes;
  };

  const fetchPreview = (url) => {
    if (!previews.has(url.href)) {
      previews.set(url.href, chrome.runtime.sendMessage({ type: 'bl-preview', url: url.href }).catch((err) => {
        previews.delete(url.href);
        return { safety: 'unknown', err };
      }));
    }
    return previews.get(url.href);
  };

  const showLink = async (a, url) => {
    const mine = ++token;
    const wait = skeleton();
    wait.appendChild(el('p', 'bl-pop-host', url.hostname.replace(/^www\./, '')));
    fill(wait);
    pop.classList.add('bl-open');
    const data = await fetchPreview(url);
    if (mine === token) fill(...linkCard(a, url, data));
  };

  // ---- triggers ----
  const arm = (a) => {
    const slug = nameFrom(a);
    const url = slug ? null : externalUrl(a);
    if (!slug && !url) return false;
    clearTimeout(closeTimer);
    if (a === anchor) return true;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      anchor = a;
      if (slug) showUser(a, slug);
      else showLink(a, url);
    }, slug ? USER_DELAY : LINK_DELAY);
    return true;
  };

  const leave = () => { clearTimeout(openTimer); closeSoon(); };

  document.addEventListener('mouseover', (e) => {
    if (e.target.closest?.('#bl-pop')) { clearTimeout(closeTimer); return; }
    const a = e.target.closest?.('a[href]');
    if (!a || !arm(a)) leave();
  });
  document.addEventListener('focusin', (e) => {
    if (e.target.matches?.('a[href]')) arm(e.target);
  });
  document.addEventListener('focusout', leave);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', close, true);
  addEventListener('scroll', close, { passive: true, capture: true });
})();
