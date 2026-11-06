// Hover cards for people and thread previews. All outside text goes in as textContent, never as HTML.
(() => {
  if (window.__letBetterPop) return;
  window.__letBetterPop = true;

  const pop = document.createElement('div');
  pop.id = 'bl-pop';
  pop.setAttribute('role', 'tooltip');
  document.body.appendChild(pop);

  const USER_DELAY = 350;
  const THREAD_DELAY = 450;
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
    const panel = document.querySelector('#Panel, aside.Panel');
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
    const m = (a.getAttribute('href') || '').match(/^(?:https:\/\/(?:lowendtalk|lowendspirit)\.com)?\/profile\/([^/?#]+)$/);
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
          // Karma is on LowEndSpirit profiles only.
          specs: [['Joined', facts.Joined], ['Last active', facts['Last Active']], ['Threads', count('Discussions')], ['Comments', count('Comments')], ['Thanked', facts.Thanked], ['Karma', facts.Karma]],
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
    pop.classList.remove('bl-pop-wide');
    fill(skeleton());
    pop.classList.add('bl-open');
    try {
      const u = await fetchUser(slug);
      if (mine === token) fill(userCard(u));
    } catch {
      if (mine === token) fill(el('p', 'bl-pop-body bl-pop-note', 'Profile not available.'));
    }
  };

  // ---- threads: the first post, from page 1 ----
  // Only thread titles in lists, the rail, the dashboard and the offers panel. Links inside posts stay plain.
  const THREAD_LINKS = 'li.ItemDiscussion .Title, .bl-rail-list, #bl-dash, .LesOffersPanel-list';
  const threads = new Map();
  const threadFrom = (a) => {
    if (a.matches('.bl-when, .bl-go') || !a.closest(THREAD_LINKS)) return null;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return null;
    return (url.pathname.match(/^\/discussion\/(\d+)(?:\/|$)/) || [])[1] || null;
  };
  const agoText = (ms) => {
    const d = (Date.now() - ms) / 86400000;
    return d < 1 / 24 ? 'just now' : d < 1 ? `${Math.round(d * 24)}h ago` : d < 60 ? `${Math.round(d)}d ago` : d < 730 ? `${Math.round(d / 30)}mo ago` : `${Math.round(d / 365)}y ago`;
  };
  // Plain text of a post: quotes, spoilers and signatures out, one line per block.
  const linesOf = (msg) => {
    const copy = msg.cloneNode(true);
    copy.querySelectorAll('blockquote, .Quote, .UserQuote, .Spoiler, .UserSignature, .Signature, script, style').forEach((n) => n.remove());
    copy.querySelectorAll('br').forEach((n) => n.replaceWith('\n'));
    copy.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, pre, tr').forEach((n) => n.append('\n'));
    return copy.textContent.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  };
  const fetchThread = (id) => {
    if (!threads.has(id)) {
      threads.set(id, fetch(`/discussion/${id}/p1`, { credentials: 'include' }).then(async (res) => {
        if (!res.ok) throw new Error('missing');
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const op = doc.querySelector('div.ItemDiscussion');
        const msg = op?.querySelector('.Message');
        if (!msg) throw new Error('no post');
        return {
          title: doc.querySelector('.PageTitle h1')?.textContent.trim() || '',
          author: op.querySelector('.Author .Username, .Username')?.textContent.trim() || '',
          ms: Date.parse(op.querySelector('.DateCreated time')?.getAttribute('datetime') || '') || 0,
          lines: linesOf(msg),
          images: msg.querySelectorAll('img:not(.emoji)').length,
        };
      }).catch((err) => { threads.delete(id); throw err; }));
    }
    return threads.get(id);
  };
  const threadCard = (t) => {
    const box = el('div', 'bl-pop-body bl-pop-thread');
    if (t.title) box.appendChild(el('strong', 'bl-pop-title', t.title));
    const by = [t.author, t.ms ? agoText(t.ms) : ''].filter(Boolean).join(' · ');
    if (by) box.appendChild(el('span', 'bl-pop-by', by));
    const text = el('div', 'bl-pop-text');
    let room = 650;
    for (const line of t.lines) {
      if (room <= 0) break;
      const cut = line.length > room ? `${line.slice(0, room).replace(/\s+\S*$/, '')}…` : line;
      text.appendChild(el('p', '', cut));
      room -= cut.length;
    }
    if (!t.lines.length) text.appendChild(el('p', 'bl-pop-note', 'No text in the first post.'));
    box.appendChild(text);
    if (t.images) box.appendChild(el('p', 'bl-pop-note', t.images === 1 ? 'Has 1 image.' : `Has ${t.images} images.`));
    return box;
  };
  const showThread = async (a, id) => {
    const mine = ++token;
    pop.classList.add('bl-pop-wide');
    fill(skeleton());
    pop.classList.add('bl-open');
    try {
      const t = await fetchThread(id);
      if (mine === token) fill(threadCard(t));
    } catch {
      if (mine === token) fill(el('p', 'bl-pop-body bl-pop-note', 'Preview not available.'));
    }
  };

  // ---- triggers ----
  const arm = (a) => {
    const slug = nameFrom(a);
    const thread = slug ? null : threadFrom(a);
    if (!slug && !thread) return false;
    clearTimeout(closeTimer);
    if (a === anchor) return true;
    clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      anchor = a;
      if (slug) showUser(a, slug);
      else showThread(a, thread);
    }, slug ? USER_DELAY : THREAD_DELAY);
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
