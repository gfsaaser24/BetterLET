// ==UserScript==
// @name         BetterLET
// @namespace    better-let
// @version      1.18
// @description  A cleaner LowEndTalk: wide layout, compact rows, sorting, hide what you've seen.
// @match        https://lowendtalk.com/*
// @grant        none
// ==/UserScript==

(() => {
  if (window.__letBetter) return;
  window.__letBetter = true;
  // Reveals the page once this script is done, even if it stops early or fails.
  queueMicrotask(() => document.documentElement.classList.add('bl-ready'));

  // ---- shared: date formatting + thread start-date cache ----
  const full = (ms) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const ago = (ms) => {
    if (!ms) return '?';
    const s = (Date.now() - ms) / 1000;
    return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago`
      : s < 86400 ? `${Math.round(s / 3600)}h ago`
      : s < 86400 * 60 ? `${Math.round(s / 86400)}d ago`
      : s < 86400 * 730 ? `${Math.round(s / 86400 / 30)}mo ago`
      : `${Math.round(s / 86400 / 365)}y ago`;
  };
  const fmt = (ms) => (ms ? `${full(ms)} (${ago(ms)})` : '?');
  const stamp = (ms) => {
    const d = new Date(ms);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  const DKEY = 'letBetter.started';
  const started = (() => { try { return JSON.parse(localStorage.getItem(DKEY)) || {}; } catch { return {}; } })();
  const saveStarted = () => { try { localStorage.setItem(DKEY, JSON.stringify(started)); } catch {} };
  const firstPostTime = (doc) => Date.parse(doc.querySelector('.DateCreated time')?.getAttribute('datetime') || '') || 0;

  // OG keeps the stock page: no rail, no rebuilt pages, only the small features.
  const og = document.documentElement.classList.contains('bl-og');

  // ---- left rail: move the useful sidebar blocks away from the ads ----
  const row = document.querySelector('#Body > .Row');
  const panel = document.querySelector('#Panel');
  if (row && panel && !og) {
    const rail = document.createElement('div');
    rail.id = 'bl-rail';
    const scroll = document.createElement('div');
    scroll.id = 'bl-rail-scroll';
    // MeBox sits outside the scroll area, or its flyouts get clipped.
    const me = panel.querySelector(':scope > .MeBox');
    if (me) rail.appendChild(me);
    rail.appendChild(scroll);
    ['.GuestBox', '.BoxNewDiscussion', 'a.NewConversation', 'a.Button.Danger', '.UserBox', '.BoxProfileFilter', '.SideMenu',
      '.BoxDiscussionFilter', '.BoxCategories', '.BoxInThisDiscussion', '.InThisConversation', '.AddPeople']
      .forEach((sel) => panel.querySelectorAll(`:scope > ${sel}`).forEach((el) => scroll.appendChild(el)));
    row.prepend(rail);
    const hasMore = [...panel.children].some((el) => !['SCRIPT', 'STYLE', 'BR'].includes(el.tagName));
    if (!hasMore) row.classList.add('bl-no-panel');

    const foot = document.querySelector('#Foot');
    if (foot) {
      const fit = () => row.style.setProperty('--bl-foot-h', `${foot.offsetHeight + 24}px`);
      fit();
      new ResizeObserver(fit).observe(foot);
    }
  }

  // ---- settings: one gear beside the search box, with design and theme inside ----
  const headRow = document.querySelector('#Head .Row');
  if (headRow && window.__letBetterTheme) {
    const theme = window.__letBetterTheme;
    const box = document.createElement('div');
    box.id = 'bl-settings';
    const option = (key, value, label) => `<button type="button" role="menuitemradio" data-${key}="${value}">${label}</button>`;
    box.innerHTML = `
      <button type="button" class="bl-gear" title="BetterLET settings" aria-label="BetterLET settings" aria-haspopup="menu" aria-expanded="false"><span class="bl-gear-icon" aria-hidden="true"></span></button>
      <div class="bl-menu" role="menu" hidden>
        <div class="bl-menu-label">Design</div>
        ${option('design', 'og', 'OG')}${option('design', 'v1', 'V1')}${option('design', 'v2', 'V2')}
        <div class="bl-menu-label">Theme</div>
        ${option('mode', 'auto', 'Auto')}${option('mode', 'light', 'Light')}${option('mode', 'dark', 'Dark')}
      </div>`;
    const gear = box.querySelector('.bl-gear');
    const menu = box.querySelector('.bl-menu');
    const mark = () => menu.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.design ? b.dataset.design === theme.getDesign() : b.dataset.mode === theme.get();
      b.setAttribute('aria-checked', String(on));
    });
    const toggle = (open) => {
      menu.hidden = !open;
      gear.setAttribute('aria-expanded', String(open));
    };
    gear.addEventListener('click', () => toggle(menu.hidden));
    menu.addEventListener('click', (e) => {
      const { design, mode } = e.target.dataset;
      if (design) theme.setDesign(design);
      if (mode) theme.set(mode);
      mark();
    });
    document.addEventListener('click', (e) => { if (!box.contains(e.target)) toggle(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
    mark();
    // The search box floats right on the stock page, so a float placed after it lands to its left.
    if (og) headRow.querySelector('.SiteSearch')?.after(box);
    else headRow.appendChild(box);
  }

  // ---- clicks that work on every page ----
  document.addEventListener('click', (e) => {
    // Runs in capture, before the site's own handler.
    if (e.target.closest?.('a[href*="/discussions/markallviewed"]') && !confirm('Mark ALL threads as viewed? You cannot undo this.')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // Ctrl+Enter (Cmd+Enter on Mac) sends a comment or message reply. Event delegation also covers inline edit boxes.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.repeat || e.isComposing) return;
    const box = e.target.closest?.('textarea');
    if (!box?.value.trim()) return;
    const send = box.closest('form')?.querySelector('input.CommentButton, input#Form_SendMessage');
    if (!send || send.disabled) return;
    e.preventDefault();
    send.click();
  });

  document.addEventListener('click', (e) => {
    const thanked = e.target.closest?.('.ThankedBy');
    if (thanked) thanked.closest('.ThankedByBox')?.classList.toggle('bl-open');
    const sig = e.target.closest?.('.bl-sig-toggle');
    if (sig) {
      const open = sig.closest('.ItemComment, .ItemDiscussion').classList.toggle('bl-sig-open');
      sig.textContent = open ? 'Hide signature' : 'Show signature';
    }
  });

  // ---- saved state ----
  const KEY = 'letBetter.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const saveState = (data) => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} };

  // ---- thread page: show started + last comment, collapse signatures ----
  const threadId = +(location.pathname.match(/^\/discussion\/(\d+)/) || [])[1];
  if (threadId) {
    // Any way of reaching a thread counts as opening it.
    const saved = load();
    saveState({ ...saved, opened: { ...saved.opened, [threadId]: Date.now() } });
    const onPage1 = !/\/p\d+/.test(location.pathname) || /\/p1$/.test(location.pathname);
    const allTimes = [...document.querySelectorAll('time[datetime]')].map((t) => Date.parse(t.getAttribute('datetime')) || 0);
    const last = Math.max(0, ...allTimes);
    const box = document.createElement('div');
    box.id = 'lb-thread-dates';
    const paint = () => { box.innerHTML = `<b>Started:</b> ${fmt(started[threadId])} &nbsp;·&nbsp; <b>Last comment:</b> ${fmt(last)}`; };
    if (onPage1 && firstPostTime(document)) { started[threadId] = firstPostTime(document); saveStarted(); }
    paint();
    const anchor = document.querySelector('.MessageList, .DataList.Comments, #Content h1');
    anchor?.parentNode.insertBefore(box, anchor);
    if (!started[threadId]) {
      fetch(`/discussion/${threadId}`, { credentials: 'include' }).then((r) => r.text()).then((html) => {
        const t = firstPostTime(new DOMParser().parseFromString(html, 'text/html'));
        if (t) { started[threadId] = t; saveStarted(); paint(); }
      }).catch(() => {});
    }
    // Land on the whole last comment card, clear of the sticky header (scroll-margin in styles.css).
    if (location.hash === '#latest') {
      const cards = document.querySelectorAll('li.ItemComment');
      const card = cards[cards.length - 1];
      if (card) {
        let held = true;
        const jump = () => { if (held) card.scrollIntoView({ block: 'start' }); };
        ['wheel', 'keydown', 'pointerdown', 'touchstart'].forEach((type) => addEventListener(type, () => { held = false; }, { once: true, passive: true }));
        // Run again after load: images above the card push it down, and the site scrolls too.
        requestAnimationFrame(jump);
        if (document.readyState === 'complete') setTimeout(jump, 120);
        else addEventListener('load', () => setTimeout(jump, 120), { once: true });
      }
    }
    // The site puts Thanks in the small date line. Move it beside Quote. Moving keeps the site's click handler.
    document.querySelectorAll('.ItemComment, .ItemDiscussion').forEach((item) => {
      const thank = item.querySelector('span.Thank, span.UnThank');
      const row = item.querySelector('.Reactions');
      if (thank && row) row.append(thank);
    });
    document.querySelectorAll('.Signature').forEach((sig) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bl-sig-toggle';
      btn.textContent = 'Show signature';
      sig.before(btn);
    });
  }

  // ---- profile page: one header card with a spec plate ----
  const user = document.querySelector('.Profile .User');
  if (document.body.classList.contains('Profile') && user && !og) {
    const card = document.createElement('div');
    card.id = 'bl-profile-head';
    const photo = document.querySelector('.PhotoWrapLarge');
    if (photo) card.appendChild(photo);
    const name = user.querySelector('h1');
    if (name) card.appendChild(name);
    const options = document.querySelector('.ProfileOptions');
    if (options) card.appendChild(options);
    user.prepend(card);
    const dl = user.querySelector('dl.About');
    if (dl) {
      [...dl.querySelectorAll(':scope > dt')].forEach((dt) => {
        const pair = document.createElement('div');
        pair.className = `bl-spec ${dt.className}`;
        const dd = dt.nextElementSibling;
        dt.before(pair);
        pair.appendChild(dt);
        if (dd?.tagName === 'DD') pair.appendChild(dd);
      });
      user.appendChild(dl);
    }
    // No warnings is one fact on the plate, not a section.
    const warnings = document.querySelector('.Warnings');
    if (warnings?.querySelector('.NoWarning') && dl) {
      const pair = document.createElement('div');
      pair.className = 'bl-spec';
      pair.innerHTML = '<dt>Warnings</dt><dd>None</dd>';
      dl.appendChild(pair);
      warnings.classList.add('bl-quiet');
    }
  }

  // ---- categories page: same rack as the thread list ----
  const catRows = [...document.querySelectorAll('li[id^="Category_"]')];
  if (catRows.length && !og) {
    const rack = catRows[0].closest('ul');
    rack.classList.add('bl-rack', 'bl-cats');
    const head = document.createElement('div');
    head.id = 'bl-cat-head';
    head.innerHTML = '<span>Category</span><span>Threads</span><span>Replies</span><span>Latest</span>';
    rack.parentNode.insertBefore(head, rack);
    catRows.forEach((li) => {
      const content = li.querySelector('.ItemContent');
      const title = li.querySelector('.TitleWrap');
      const about = li.querySelector('.CategoryDescription');
      if (!content || !title) return;
      const led = document.createElement('span');
      led.className = 'bl-led';
      led.setAttribute('aria-hidden', 'true');
      content.prepend(led);
      const main = document.createElement('div');
      main.className = 'bl-main';
      title.before(main);
      main.appendChild(title);
      if (about) main.appendChild(about);
      const count = (cls, sel) => {
        const el = document.createElement('div');
        el.className = `bl-cell ${cls}`;
        const n = li.querySelector(`${sel} .Number`);
        el.innerHTML = '<b></b>';
        el.firstChild.textContent = n?.textContent.trim() || '0';
        if (n) el.title = n.title;
        return el;
      };
      const latest = document.createElement('div');
      latest.className = 'bl-latest';
      const post = li.querySelector('.LatestPostTitle');
      if (post) {
        latest.appendChild(post.cloneNode(true));
        const by = document.createElement('span');
        const who = li.querySelector('.MostRecentBy a');
        if (who) by.appendChild(who.cloneNode(true));
        const when = Date.parse(li.querySelector('.MostRecentOn time')?.getAttribute('datetime') || '') || 0;
        if (when) {
          by.append(` ${ago(when)}`);
          by.title = full(when);
        }
        latest.appendChild(by);
      }
      content.append(count('bl-threads', '.DiscussionCount'), count('bl-replies', '.CommentCount'), latest);
    });
  }

  // ---- dashboard: your numbers and threads on one page, at /discussions#dashboard ----
  const signedIn = document.querySelector('.MeBox .Username, .MeBox a[href^="/profile/"]');
  const discussionsLink = document.querySelector('#Head .SiteMenu a[href="/discussions"]');
  if (signedIn && discussionsLink) {
    const li = document.createElement('li');
    li.innerHTML = '<a href="/discussions#dashboard">Dashboard</a>';
    discussionsLink.closest('li').after(li);
  }
  addEventListener('hashchange', () => { if (location.pathname === '/discussions') location.reload(); });
  const content = document.querySelector('.ContentColumn');
  if (location.pathname === '/discussions' && location.hash === '#dashboard' && content) {
    document.documentElement.classList.add('bl-dash-on');
    document.title = 'Dashboard — LowEndTalk';
    const dash = document.createElement('div');
    dash.id = 'bl-dash';
    content.prepend(dash);
    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    dash.appendChild(el('h1', '', 'Dashboard'));
    if (!signedIn) {
      dash.appendChild(el('p', 'bl-dash-empty', 'Sign in to see your dashboard.'));
      return;
    }
    const stats = el('div', 'bl-dash-stats');
    dash.appendChild(stats);
    const stat = (label, value, href) => {
      const card = el('a', 'bl-dash-stat');
      card.href = href;
      card.append(el('b', '', value), el('span', '', label));
      stats.appendChild(card);
      return card;
    };
    const countOf = (href) => document.querySelector(`a[href="${href}"] .Count, a[href="${href}"] .Aside`)?.textContent.trim() || '0';
    const profile = signedIn.getAttribute('href');
    const bell = [...document.querySelectorAll('.MeBox a')].find((link) => link.textContent.includes('Notifications'));
    stat('Notifications', bell?.querySelector('.Alert')?.textContent.trim() || '0', '/profile/notifications');
    stat('Bookmarks', countOf('/discussions/bookmarked'), '/discussions/bookmarked');
    stat('My threads', countOf('/discussions/mine'), '/discussions/mine');
    stat('Drafts', countOf('/drafts'), '/drafts');
    const thanks = stat('Thanks received', '…', '/profile');
    const pageOf = (url) => fetch(url, { credentials: 'include' }).then((r) => r.text()).then((html) => new DOMParser().parseFromString(html, 'text/html'));
    if (profile) {
      pageOf(profile).then((doc) => {
        thanks.firstChild.textContent = doc.querySelector('dd.ReceivedThankCount')?.textContent.trim() || '0';
      }).catch(() => { thanks.firstChild.textContent = '?'; });
    }
    const threads = (title, url) => {
      const section = el('section', 'bl-dash-box');
      section.appendChild(el('h2', '', title));
      const rows = el('ul');
      section.appendChild(rows);
      dash.appendChild(section);
      pageOf(url).then((doc) => {
        const items = [...doc.querySelectorAll('li.ItemDiscussion')].map((li) => ({
          link: li.querySelector('.Title a'),
          fresh: li.querySelector('.HasNew')?.textContent.trim() || '',
          by: li.querySelector('.LastCommentBy a')?.textContent.trim() || '',
          ms: Date.parse(li.querySelector('.LastCommentDate time')?.getAttribute('datetime') || '') || 0,
        })).filter((t) => t.link);
        items.sort((a, b) => Boolean(b.fresh) - Boolean(a.fresh) || b.ms - a.ms);
        if (!items.length) section.appendChild(el('p', 'bl-dash-empty', 'Nothing here yet.'));
        items.slice(0, 10).forEach((t) => {
          const href = t.link.getAttribute('href') || '';
          const row = el('li', t.fresh ? 'bl-dash-new' : '');
          const name = el('a', 'bl-dash-title', t.link.textContent.trim());
          name.href = href.replace(/(\/p\d+)?(#.*)?$/, '/p1');
          row.appendChild(name);
          const meta = el('div', 'bl-dash-meta');
          if (t.fresh) meta.appendChild(el('span', 'bl-dash-badge', t.fresh));
          if (t.ms) {
            meta.append(t.by ? `Last comment by ${t.by} on ` : 'Last comment on ');
            const when = el('a', 'bl-when', stamp(t.ms));
            when.href = href.includes('#') ? href : `${href}#latest`;
            meta.appendChild(when);
          }
          row.appendChild(meta);
          rows.appendChild(row);
        });
      }).catch(() => section.appendChild(el('p', 'bl-dash-empty', 'Could not load this list.')));
    };
    threads('My threads', '/discussions/mine');
    threads('Bookmarks', '/discussions/bookmarked');
    return;
  }

  const list = document.querySelector('ul.Discussions');
  if (!list) return;
  if (!og) list.classList.add('bl-rack');

  const state = Object.assign({ sort: 'reply', hideSeen: false, hidePinned: false, seen: {}, opened: {} }, load());
  const save = () => {
    state.opened = { ...load().opened, ...state.opened };
    saveState(state);
  };

  const idOf = (li) => +(li.id.match(/\d+/) || [0])[0];
  const replyTime = (li) => Date.parse(li.querySelector('.LastCommentDate time')?.getAttribute('datetime') || '') || 0;
  const comments = (li) => {
    const t = (li.querySelector('.CommentCount .Number')?.textContent || '0').trim().toUpperCase();
    const n = parseFloat(t);
    return t.endsWith('K') ? Math.round(n * 1000) : n || 0;
  };
  const isPinned = (li) => li.classList.contains('Announcement');

  const isMine = (li) => li.classList.contains('Mine');

  // Seen = you opened it (or marked it) and no new replies since. The forum's read flag does not count.
  const isSeen = (li) => {
    const id = idOf(li);
    if (state.opened[id] >= replyTime(li)) return true;
    const rec = state.seen[id];
    return rec !== undefined && comments(li) <= rec;
  };
  const markSeen = (li) => { state.opened[idOf(li)] = Date.now(); save(); };

  // ---- toolbar ----
  const bar = document.createElement('div');
  bar.id = 'let-better-bar';
  bar.innerHTML = `
    <label>Sort
      <select data-k="sort">
        <option value="reply">Newest reply</option>
        <option value="created">Newest thread</option>
        <option value="oldest">Oldest thread</option>
        <option value="comments">Most replies</option>
      </select>
    </label>
    <label><input type="checkbox" data-k="hideSeen"> Hide seen</label>
    <label><input type="checkbox" data-k="hidePinned"> Hide pinned</label>
    <button data-a="more">Load next page</button>
    <button data-a="markall">Mark all seen</button>
    <span class="lb-count"></span>`;
  list.parentNode.insertBefore(bar, list);

  const head = document.createElement('div');
  head.id = 'bl-list-head';
  head.innerHTML = '<span>Thread</span><span>Replies</span><span>Views</span><span>Started</span>';
  if (!og) list.parentNode.insertBefore(head, list);

  bar.querySelector('[data-k="sort"]').value = state.sort;
  bar.querySelector('[data-k="hideSeen"]').checked = state.hideSeen;
  bar.querySelector('[data-k="hidePinned"]').checked = state.hidePinned;

  bar.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    state[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    save();
    glide(render);
  });

  // Logged-in rows link to the last comment. Guest rows link to the first post, so work out the last page.
  const PER_PAGE = 30;
  const lastCommentUrl = (li, href) => {
    if (href.includes('#')) return href;
    const exact = +(li.querySelector('.CommentCount .Number')?.title.match(/[\d,]+/)?.[0].replace(/,/g, '') || 0) || comments(li);
    return `${href.replace(/\/p\d+$/, '')}/p${Math.ceil(exact / PER_PAGE) || 1}#latest`;
  };

  // ---- compact row: rebuild the meta line as columns ----
  const cell = (cls) => { const el = document.createElement('div'); el.className = `bl-cell ${cls}`; return el; };

  const compact = (li) => {
    const content = li.querySelector('.ItemContent');
    const title = li.querySelector('.Title');
    if (!content || !title) return;
    const led = document.createElement('span');
    led.className = 'bl-led';
    led.setAttribute('aria-hidden', 'true');
    li.prepend(led);
    const main = document.createElement('div');
    main.className = 'bl-main';
    title.before(main);
    main.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'bl-sub';
    const cat = li.querySelector('.Meta-Discussion .Category a');
    if (cat) {
      const name = cat.cloneNode(true);
      name.className = 'bl-cat';
      sub.appendChild(name);
    }
    const author = li.querySelector('.DiscussionAuthor a');
    if (author) sub.appendChild(author.cloneNode(true));
    if (isPinned(li)) {
      const pin = document.createElement('span');
      pin.textContent = 'Pinned';
      sub.appendChild(pin);
    }
    const fresh = li.querySelector('.Meta-Discussion .HasNew');
    if (fresh) {
      const n = document.createElement('span');
      n.className = 'bl-new';
      n.textContent = fresh.textContent.trim();
      sub.appendChild(n);
    }
    main.appendChild(sub);

    // Third line, like the old vBulletin boards: last comment by, when, and a jump to it.
    const link = title.querySelector('a');
    const line = document.createElement('div');
    line.className = 'bl-lastline';
    const ms = replyTime(li);
    if (comments(li) > 0 && ms) {
      const latest = lastCommentUrl(li, link?.getAttribute('href') || '');
      line.append('Last comment by ');
      const by = li.querySelector('.LastCommentBy a');
      if (by) line.appendChild(by.cloneNode(true));
      line.append(' on ');
      const when = document.createElement('a');
      when.className = 'bl-when';
      when.href = latest;
      when.textContent = stamp(ms);
      when.title = 'Go to the last comment';
      const go = document.createElement('a');
      go.className = 'bl-go';
      go.href = latest;
      go.title = 'Go to the last comment';
      go.setAttribute('aria-label', 'Go to the last comment');
      line.append(when, go);
    } else {
      line.textContent = 'No replies yet';
    }
    main.appendChild(line);
    // The title opens the first post. Without /p1 the site can resume at the last page you read.
    if (link) link.setAttribute('href', (link.getAttribute('href') || '').replace(/(\/p\d+)?(#.*)?$/, '/p1'));

    const replies = cell('bl-replies');
    replies.innerHTML = '<b></b>';
    replies.firstChild.textContent = li.querySelector('.CommentCount .Number')?.textContent.trim() || '0';
    const views = cell('bl-views');
    views.textContent = li.querySelector('.ViewCount .Number')?.textContent.trim() || '0';
    const start = cell('bl-started');
    content.append(replies, views, start);
  };

  // OG keeps the stock row. The title opens the first post, and the date and arrow jump to the last comment.
  const ogRow = (li) => {
    const link = li.querySelector('.Title a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    const time = li.querySelector('.LastCommentDate time');
    if (time && comments(li) > 0) {
      const latest = lastCommentUrl(li, href);
      const when = document.createElement('a');
      when.className = 'bl-when';
      when.href = latest;
      when.title = 'Go to the last comment';
      time.before(when);
      when.appendChild(time);
      const go = document.createElement('a');
      go.className = 'bl-go';
      go.href = latest;
      go.title = 'Go to the last comment';
      go.setAttribute('aria-label', 'Go to the last comment');
      when.after(go);
    }
    link.setAttribute('href', href.replace(/(\/p\d+)?(#.*)?$/, '/p1'));
  };

  // ---- per-row "mark seen" button + click tracking ----
  const decorate = (li) => {
    if (li.dataset.lb) return;
    li.dataset.lb = '1';
    if (og) {
      ogRow(li);
      li.querySelectorAll('.Title a, .bl-when, .bl-go').forEach((a) => a.addEventListener('mousedown', () => markSeen(li)));
      return;
    }
    compact(li);
    const x = document.createElement('button');
    x.className = 'lb-x';
    x.title = 'Mark seen';
    x.textContent = '✕';
    x.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); markSeen(li); render(); });
    li.querySelector('.Options')?.appendChild(x);
    li.querySelectorAll('.Title a, .bl-when, .bl-go').forEach((a) => a.addEventListener('mousedown', () => markSeen(li)));
    paintDates(li);
    watcher.observe(li);
  };

  const paintDates = (li) => {
    const el = li.querySelector('.bl-started');
    if (!el) return;
    const ms = started[idOf(li)];
    el.textContent = ms ? ago(ms) : '…';
    el.title = ms ? full(ms) : '';
  };

  // Start dates aren't in the list, so fetch page 1 of threads you scroll past.
  // Two at a time, slow, cached forever, so the site doesn't rate-limit you.
  const queue = [];
  let running = 0;
  const pump = () => {
    while (running < 2 && queue.length) {
      const li = queue.shift();
      const id = idOf(li);
      if (started[id]) { paintDates(li); continue; }
      running++;
      fetch(`/discussion/${id}`, { credentials: 'include' })
        .then((r) => r.text())
        .then((html) => {
          const t = firstPostTime(new DOMParser().parseFromString(html, 'text/html'));
          if (t) { started[id] = t; saveStarted(); }
        })
        .catch(() => {})
        .finally(() => { paintDates(li); setTimeout(() => { running--; pump(); }, 400); });
    }
  };
  const watcher = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      watcher.unobserve(e.target);
      if (!started[idOf(e.target)]) { queue.push(e.target); pump(); }
    });
  }, { rootMargin: '300px' });

  // Rows glide to their new place. Off-screen rows just jump, to save work.
  const glide = (change) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { change(); return; }
    const near = (top) => top > -innerHeight && top < innerHeight * 2;
    const rows = [...list.querySelectorAll('li.ItemDiscussion')];
    const before = new Map(rows.map((li) => [li, li.offsetParent ? li.getBoundingClientRect().top : null]));
    change();
    rows.forEach((li) => {
      const from = before.get(li);
      if (from === null || !li.offsetParent) return;
      const to = li.getBoundingClientRect().top;
      if (from !== to && near(to)) {
        li.animate([{ transform: `translateY(${from - to}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    });
  };

  const render = () => {
    const items = [...list.querySelectorAll('li.ItemDiscussion')];
    items.forEach(decorate);
    const cmp = {
      reply: (a, b) => replyTime(b) - replyTime(a),
      created: (a, b) => idOf(b) - idOf(a),
      oldest: (a, b) => idOf(a) - idOf(b),
      comments: (a, b) => comments(b) - comments(a),
    }[state.sort];
    items.sort(cmp).forEach((li) => list.appendChild(li));
    let shown = 0;
    items.forEach((li) => {
      const seen = isSeen(li);
      li.classList.toggle('lb-seen', seen);
      li.classList.toggle('bl-unread', !seen && comments(li) > 0);
      // Your own threads never hide with Hide seen.
      const hide = (state.hideSeen && seen && !isMine(li)) || (state.hidePinned && isPinned(li));
      li.classList.toggle('lb-hide', hide);
      if (!hide) shown++;
    });
    bar.querySelector('.lb-count').textContent = `${shown} of ${items.length} shown`;
  };

  // ---- load more pages ----
  const nextOf = (doc) => { const h = doc.querySelector('.Pager a.Next')?.getAttribute('href'); return h ? new URL(h, location.href).href : null; };
  let nextUrl = nextOf(document);
  const moreBtn = bar.querySelector('[data-a="more"]');
  if (!nextUrl) moreBtn.disabled = true;
  moreBtn.addEventListener('click', async () => {
    if (!nextUrl) return;
    moreBtn.disabled = true;
    moreBtn.textContent = 'Loading…';
    try {
      const html = await (await fetch(nextUrl, { credentials: 'include' })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const have = new Set([...list.children].map((li) => li.id));
      doc.querySelectorAll('ul.Discussions li.ItemDiscussion').forEach((li) => {
        if (!have.has(li.id)) list.appendChild(document.importNode(li, true));
      });
      nextUrl = nextOf(doc);
    } catch (err) {
      console.error('BetterLET:', err);
    }
    moreBtn.textContent = 'Load next page';
    moreBtn.disabled = !nextUrl;
    render();
  });

  // A thread opened in another tab updates this list too.
  addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    state.opened = { ...state.opened, ...load().opened };
    render();
  });

  bar.querySelector('[data-a="markall"]').addEventListener('click', () => {
    list.querySelectorAll('li.ItemDiscussion:not(.lb-hide)').forEach(markSeen);
    glide(render);
  });

  render();
})();
