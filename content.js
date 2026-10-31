// ==UserScript==
// @name         LET Better
// @namespace    let-better
// @version      1.0
// @description  Sort LowEndTalk threads by newest created / newest reply, hide what you've seen, load more pages.
// @match        https://lowendtalk.com/*
// @grant        none
// ==/UserScript==

(() => {
  if (window.__letBetter) return;
  window.__letBetter = true;

  // ---- shared: date formatting + thread start-date cache ----
  const fmt = (ms) => {
    if (!ms) return '?';
    const d = new Date(ms);
    const abs = d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const s = (Date.now() - ms) / 1000;
    const rel = s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago`
      : s < 86400 ? `${Math.round(s / 3600)}h ago`
      : s < 86400 * 60 ? `${Math.round(s / 86400)}d ago`
      : `${Math.round(s / 86400 / 30)}mo ago`;
    return `${abs} (${rel})`;
  };
  const DKEY = 'letBetter.started';
  const started = (() => { try { return JSON.parse(localStorage.getItem(DKEY)) || {}; } catch { return {}; } })();
  const saveStarted = () => { try { localStorage.setItem(DKEY, JSON.stringify(started)); } catch {} };
  const firstPostTime = (doc) => Date.parse(doc.querySelector('.DateCreated time')?.getAttribute('datetime') || '') || 0;

  const dateCss = document.createElement('style');
  dateCss.textContent = `
    .lb-dates{display:block;font-size:12px;opacity:.75;margin-top:3px}
    .lb-dates b{font-weight:600}
    #lb-thread-dates{padding:6px 10px;margin:0 0 10px;background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.35);border-radius:6px;font-size:13px}`;
  document.head.appendChild(dateCss);

  // ---- thread page: show started + last comment ----
  const threadId = +(location.pathname.match(/^\/discussion\/(\d+)/) || [])[1];
  if (threadId) {
    const onPage1 = !/\/p\d+/.test(location.pathname);
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
  }

  const list = document.querySelector('ul.Discussions');
  if (!list) return;

  const KEY = 'letBetter.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
  const state = Object.assign({ sort: 'reply', hideSeen: false, hidePinned: false, seen: {} }, load());

  const idOf = (li) => +(li.id.match(/\d+/) || [0])[0];
  const replyTime = (li) => Date.parse(li.querySelector('.LastCommentDate time')?.getAttribute('datetime') || '') || 0;
  const comments = (li) => {
    const t = (li.querySelector('.CommentCount .Number')?.textContent || '0').trim().toUpperCase();
    const n = parseFloat(t);
    return t.endsWith('K') ? Math.round(n * 1000) : n || 0;
  };
  const isPinned = (li) => li.classList.contains('Announcement');

  // Seen = you opened it (or marked it) and no new replies since, or the forum itself says it's read.
  const isSeen = (li) => {
    const rec = state.seen[idOf(li)];
    if (rec !== undefined && comments(li) <= rec) return true;
    return !li.classList.contains('Unread') && !li.querySelector('.HasNew');
  };
  const markSeen = (li) => { state.seen[idOf(li)] = comments(li); save(state); };

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

  const css = document.createElement('style');
  css.textContent = `
    #let-better-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:8px 10px;margin:0 0 8px;
      background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.35);border-radius:6px;font-size:13px;color:inherit;position:sticky;top:0;z-index:50;backdrop-filter:blur(6px)}
    #let-better-bar select,#let-better-bar button{font-size:13px;padding:3px 8px;border:1px solid rgba(127,127,127,.5);border-radius:4px;background:transparent;color:inherit;cursor:pointer}
    #let-better-bar option{color:#000}
    #let-better-bar button:disabled{opacity:.4;cursor:default}
    #let-better-bar label{display:flex;align-items:center;gap:5px;margin:0;cursor:pointer}
    #let-better-bar .lb-count{margin-left:auto;opacity:.7}
    li.ItemDiscussion.lb-seen{opacity:.45}
    li.ItemDiscussion.lb-hide{display:none!important}
    .lb-x{float:right;margin-left:8px;font-size:12px;color:inherit;opacity:.5;cursor:pointer;border:0;background:none}
    .lb-x:hover{opacity:1;color:#e55}`;
  document.head.appendChild(css);

  bar.querySelector('[data-k="sort"]').value = state.sort;
  bar.querySelector('[data-k="hideSeen"]').checked = state.hideSeen;
  bar.querySelector('[data-k="hidePinned"]').checked = state.hidePinned;

  bar.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    state[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    save(state);
    render();
  });

  // ---- per-row "mark seen" button + click tracking ----
  const decorate = (li) => {
    if (li.dataset.lb) return;
    li.dataset.lb = '1';
    const x = document.createElement('button');
    x.className = 'lb-x';
    x.title = 'Mark seen';
    x.textContent = '✕ seen';
    x.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); markSeen(li); render(); });
    li.querySelector('.Options')?.appendChild(x);
    li.querySelectorAll('.Title a').forEach((a) => a.addEventListener('mousedown', () => markSeen(li)));
    const dates = document.createElement('span');
    dates.className = 'lb-dates';
    li.querySelector('.Meta-Discussion')?.after(dates);
    paintDates(li);
    watcher.observe(li);
  };

  const paintDates = (li) => {
    const el = li.querySelector('.lb-dates');
    if (el) el.innerHTML = `<b>Started:</b> ${started[idOf(li)] ? fmt(started[idOf(li)]) : '…'} &nbsp;·&nbsp; <b>Last comment:</b> ${fmt(replyTime(li))}`;
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
      const hide = (state.hideSeen && seen) || (state.hidePinned && isPinned(li));
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
      console.error('LET Better:', err);
    }
    moreBtn.textContent = 'Load next page';
    moreBtn.disabled = !nextUrl;
    render();
  });

  bar.querySelector('[data-a="markall"]').addEventListener('click', () => {
    list.querySelectorAll('li.ItemDiscussion:not(.lb-hide)').forEach(markSeen);
    render();
  });

  render();
})();
