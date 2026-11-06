// Your own block list. Blocked people's threads, comments, and quotes of them are hidden on this forum.
// Saved per forum in this browser (`letBetter.blocked`). All outside text goes in as textContent, never as HTML.
(() => {
  if (window.__letBetterBlock) return;
  const KEY = 'letBetter.blocked';
  const site = /(^|\.)lowendspirit\.com$/.test(location.hostname) ? 'LowEndSpirit' : 'LowEndTalk';
  const RESERVED = /^(edit|notifications|preferences|password|picture|signature|quotes|connections|invitations|tokens|activity|comments|discussions|receivedthanks|removepicture|ignore)$/i;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };
  const keyOf = (name) => { try { return decodeURIComponent(String(name)).trim().toLowerCase(); } catch { return String(name).trim().toLowerCase(); } };

  // "/profile/Name" or "/profile/123/Name" → "Name". Profile sub-pages are not people.
  const slugFrom = (href) => {
    let path = '';
    try { path = new URL(href, location.href).pathname; } catch { return ''; }
    const parts = path.split('/').filter(Boolean);
    if (parts[0] !== 'profile' || parts.length < 2) return '';
    if (parts.length === 2) return RESERVED.test(parts[1]) ? '' : parts[1];
    if (/^\d+$/.test(parts[1])) return parts[2] || '';
    return '';
  };
  const me = (() => {
    for (const a of document.querySelectorAll('.MeBox a[href*="/profile/"]')) {
      const slug = slugFrom(a.href);
      if (slug) return keyOf(slug);
    }
    return '';
  })();

  let list = read();
  const has = (name) => Boolean(name) && Object.prototype.hasOwnProperty.call(list, keyOf(name));

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  // ---- hiding ----
  const authorOfPost = (item) => {
    const a = item.querySelector(':scope .Author a.Username, :scope .Item-Header .Username');
    return a ? slugFrom(a.href) || a.textContent.trim() : '';
  };
  // Quotes carry no author field. The attribution is the first link: "@name said:".
  const authorOfQuote = (q) => {
    const text = q.querySelector('.QuoteText')?.firstElementChild;
    const link = q.querySelector('.QuoteText a');
    const line = (link?.textContent || text?.textContent || '').trim();
    const m = line.match(/^@?(.+?)\s+said:?$/i) || (q.querySelector('.QuoteText')?.textContent || '').trim().match(/^@?(\S+)\s+said:/i);
    return m ? m[1] : '';
  };
  const rowAuthor = (li) => {
    const a = li.querySelector('.DiscussionAuthor a, .Meta-Discussion .DiscussionAuthor a');
    return a ? slugFrom(a.href) || a.textContent.trim() : '';
  };
  const hidesRow = (li) => has(rowAuthor(li));

  const apply = (root = document) => {
    // Threads in lists. content.js also counts these as hidden.
    root.querySelectorAll('li.ItemDiscussion').forEach((li) => li.classList.toggle('bl-blocked', hidesRow(li)));
    // Their comments.
    root.querySelectorAll('.ItemComment').forEach((item) => item.classList.toggle('bl-blocked', has(authorOfPost(item))));
    // Their posts quoted by others, nested quotes included.
    root.querySelectorAll('blockquote.UserQuote, blockquote.Quote').forEach((q) => q.classList.toggle('bl-blocked', has(authorOfQuote(q))));
    // "In this Discussion" in the sidebar (and the rail, where V1/V2 move it).
    document.querySelectorAll('.InThisDiscussion li, .BoxInThisDiscussion li').forEach((li) => {
      const a = li.querySelector('a[href*="/profile/"]');
      li.classList.toggle('bl-blocked', Boolean(a) && has(slugFrom(a.href) || a.textContent));
    });
    // "Last comment by" them: the name goes, the date stays (V1/V2 line and the stock OG meta).
    root.querySelectorAll('.bl-lastline, li.ItemDiscussion .LastCommentBy').forEach((line) => {
      const by = line.querySelector('a[href*="/profile/"]');
      line.classList.toggle('bl-blocked-by', Boolean(by) && has(slugFrom(by.href) || by.textContent));
    });
    // A thread they started, opened directly: the first post becomes a one-line notice.
    const op = document.querySelector('div.ItemDiscussion');
    const opBlocked = op && has(authorOfPost(op));
    op?.classList.toggle('bl-blocked', Boolean(opBlocked));
    let note = document.getElementById('bl-blocked-op');
    if (opBlocked && !note) {
      const name = op.querySelector('.Username')?.textContent.trim() || '';
      note = el('div', 'bl-blocked-note');
      note.id = 'bl-blocked-op';
      note.append(el('span', '', `You blocked ${name}, who started this thread. Their post is hidden.`));
      const undo = el('button', 'bl-btn', 'Unblock');
      undo.type = 'button';
      undo.addEventListener('click', () => confirmDialog(name, true));
      note.appendChild(undo);
      op.before(note);
    } else if (!opBlocked) note?.remove();
    applyMessages(root);
    paintButtons();
  };

  // ---- direct messages ----
  // A conversation is hidden only when every other person in it is blocked. In a group chat that also has
  // someone you did not block, only the blocked person's messages go.
  const MSG_LINK = /\/messages\/(\d+)/;
  const convoUrl = (item) => [...item.querySelectorAll('a[href*="/messages/"]')].map((a) => a.getAttribute('href')).find((h) => MSG_LINK.test(h)) || '';
  const convoPeople = (item) => {
    const names = new Set();
    item.querySelectorAll('a[href*="/profile/"]').forEach((a) => { const s = slugFrom(a.href); if (s) names.add(keyOf(s)); });
    // The title lists names: "alice", "alice, bob and carl". Anything that is not a name keeps the chat visible.
    const title = item.querySelector('.Users, .Title, .Subject');
    (title?.textContent || '').split(/,|\s+and\s+|\s+&\s+/).map((s) => s.trim()).filter((s) => s && !/^\d+\s+others?$/i.test(s)).forEach((n) => names.add(keyOf(n)));
    names.delete(me);
    return [...names];
  };
  const blockedConvo = (item) => { const people = convoPeople(item); return people.length > 0 && people.every((p) => has(p)); };
  const convoItems = (root = document) => [...root.querySelectorAll('ul.Conversations > li.Item, .Flyout .PopList li.Item, .Flyout li.Item')].filter((li) => convoUrl(li));
  const isUnread = (li) => /\b(New|Unread)\b/.test(li.className) || Boolean(li.querySelector('.HasNew, .NewCommentCount, strong'));

  const applyMessages = (root = document) => {
    convoItems(root).forEach((li) => li.classList.toggle('bl-blocked', blockedConvo(li)));
    // Inside a conversation: their messages go.
    root.querySelectorAll('li[id^="Message_"], ul.Conversation > li.Item').forEach((item) => item.classList.toggle('bl-blocked', has(authorOfPost(item))));
    // A conversation page where everyone else is blocked: a one-line notice instead.
    const onConvo = /^\/messages\/\d+/.test(location.pathname);
    const people = onConvo ? [...document.querySelectorAll('.InThisConversation a[href*="/profile/"], .BoxInThisConversation a[href*="/profile/"]')].map((a) => keyOf(slugFrom(a.href))).filter((n) => n && n !== me) : [];
    const allBlocked = people.length > 0 && people.every((p) => has(p));
    let note = document.getElementById('bl-blocked-convo');
    const thread = document.querySelector('ul.Conversation, ul.MessageList.Conversation, .DataList.Conversation');
    thread?.classList.toggle('bl-blocked', allBlocked);
    if (allBlocked && !note && thread) {
      note = el('div', 'bl-blocked-note');
      note.id = 'bl-blocked-convo';
      note.appendChild(el('span', '', 'You blocked everyone else in this conversation. It is hidden.'));
      thread.before(note);
    } else if (!allBlocked) note?.remove();
  };

  // Unread messages from blocked people are opened in the background, which marks them read on the forum,
  // and the inbox badge drops right away. Only when the badge shows unread; at most every 10 minutes.
  const DM_KEY = 'letBetter.dmCheck';
  const backingOff = () => { try { return Date.now() < +(localStorage.getItem('letBetter.backoff') || 0); } catch { return false; } };
  const inboxBadge = () => document.querySelector('.MeBox a[href*="/messages/"] .Alert, #MainHeader a[href*="/messages/"] .Alert, .MeBox a[href*="/messages/"] .Count');
  const lowerBadge = (by) => {
    document.querySelectorAll('.MeBox a[href*="/messages/"] :is(.Alert, .Count), #MainHeader a[href*="/messages/"] :is(.Alert, .Count)').forEach((badge) => {
      const left = (parseInt(badge.textContent, 10) || 0) - by;
      if (left > 0) badge.textContent = String(left);
      else badge.remove();
    });
  };
  const quietRead = async (items) => {
    let done = 0;
    for (const li of items) {
      if (backingOff()) break;
      try {
        const res = await fetch(new URL(convoUrl(li), location.href).href, { credentials: 'include' });
        if (res.status === 429 || res.status === 503) { try { localStorage.setItem('letBetter.backoff', String(Date.now() + 600000)); } catch {} break; }
        if (res.ok) done++;
      } catch {}
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (done) lowerBadge(done);
  };
  const sweepInbox = async () => {
    if (!Object.keys(list).length || !me || backingOff()) return;
    const badge = inboxBadge();
    if (!badge || !(parseInt(badge.textContent, 10) > 0)) return;
    // On the inbox page the rows are already here.
    if (document.querySelector('ul.Conversations')) {
      await quietRead(convoItems().filter((li) => blockedConvo(li) && isUnread(li)));
      return;
    }
    let last = 0;
    try { last = +(localStorage.getItem(DM_KEY) || 0); } catch {}
    if (Date.now() - last < 600000) return;
    try { localStorage.setItem(DM_KEY, String(Date.now())); } catch {}
    try {
      const res = await fetch('/messages/inbox', { credentials: 'include' });
      if (res.status === 429 || res.status === 503) { try { localStorage.setItem('letBetter.backoff', String(Date.now() + 600000)); } catch {} return; }
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      await quietRead(convoItems(doc).filter((li) => blockedConvo(li) && isUnread(li)));
    } catch {}
  };

  // ---- buttons ----
  const BLOCK_ICON = 'bl-block-icon';
  const iconButton = (name) => {
    const b = el('button', 'bl-block-btn');
    b.type = 'button';
    b.dataset.blockName = name;
    b.appendChild(el('span', BLOCK_ICON));
    return b;
  };
  const paintButtons = () => {
    document.querySelectorAll('.bl-block-btn').forEach((b) => {
      const blocked = has(b.dataset.blockName);
      const label = `${blocked ? 'Unblock' : 'Block'} ${b.dataset.blockName}`;
      b.title = label;
      b.setAttribute('aria-label', label);
      b.classList.toggle('bl-on-list', blocked);
    });
    // Write only on change: a text change is a DOM change, and the watcher below would run again.
    document.querySelectorAll('.bl-profile-block').forEach((b) => {
      const label = has(b.dataset.blockName) ? 'Unblock' : 'Block';
      if (b.textContent !== label) b.textContent = label;
    });
  };
  // Beside the name on every post, never on your own.
  const addPostButtons = (root = document) => {
    root.querySelectorAll('.ItemComment, div.ItemDiscussion').forEach((item) => {
      const a = item.querySelector('.Author a.Username');
      if (!a || item.querySelector('.bl-block-btn')) return;
      const name = slugFrom(a.href) || a.textContent.trim();
      if (!name || keyOf(name) === me) return;
      a.after(iconButton(name));
    });
  };
  // On a profile page, beside the name.
  const addProfileButton = () => {
    if (!document.body.classList.contains('Section-Profile')) return;
    const parts = location.pathname.split('/').filter(Boolean);
    const name = parts.length === 2 ? decodeURIComponent(parts[1]) : parts.length === 3 && !/^\d+$/.test(parts[1]) ? decodeURIComponent(parts[2]) : '';
    if (!name || RESERVED.test(name) || keyOf(name) === me || document.querySelector('.bl-profile-block')) return;
    const h1 = document.querySelector('.Profile .User h1, .User h1, .ProfileHead h1');
    if (!h1) return;
    const b = el('button', 'bl-btn bl-profile-block');
    b.type = 'button';
    b.dataset.blockName = name;
    b.addEventListener('click', () => confirmDialog(name, has(name)));
    h1.after(b);
  };

  // ---- dialogs ----
  let dialog = null;
  const getDialog = () => {
    if (dialog) return dialog;
    dialog = el('dialog', '');
    dialog.id = 'bl-dialog';
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    document.body.appendChild(dialog);
    return dialog;
  };
  const actions = (...buttons) => { const row = el('div', 'bl-dialog-actions'); row.append(...buttons); return row; };
  const button = (text, cls, onClick) => { const b = el('button', `bl-btn ${cls || ''}`.trim(), text); b.type = 'button'; b.addEventListener('click', onClick); return b; };

  const setBlocked = (name, blocked) => {
    list = read();
    if (blocked) list[keyOf(name)] = { name, at: Date.now() };
    else delete list[keyOf(name)];
    write(list);
    apply();
    window.dispatchEvent(new CustomEvent('bl-blocklist-change'));
  };

  const confirmDialog = (name, unblock = false) => {
    if (!name || keyOf(name) === me) return;
    const d = getDialog();
    const title = el('h2', '', unblock ? `Unblock ${name}?` : `Block ${name}?`);
    title.id = 'bl-dialog-title';
    d.setAttribute('aria-labelledby', 'bl-dialog-title');
    const text = el('p', '', unblock
      ? `Their threads, comments, messages, and quotes of their posts show again on ${site}.`
      : `You won't see their threads, comments, or messages, or posts that quote them, on ${site}. Messages from them are marked read so they never alert you. Only you see the difference, in this browser. Undo it any time from the gear menu.`);
    const cancel = button('Cancel', '', () => d.close());
    const ok = button(unblock ? 'Unblock' : 'Block', unblock ? 'bl-btn-primary' : 'bl-btn-danger', () => { setBlocked(name, !unblock); d.close(); });
    d.replaceChildren(title, text, actions(cancel, ok));
    d.showModal();
    ok.focus();
  };

  const manage = () => {
    const d = getDialog();
    const draw = () => {
      list = read();
      const title = el('h2', '', 'Blocked people');
      title.id = 'bl-dialog-title';
      d.setAttribute('aria-labelledby', 'bl-dialog-title');
      const people = Object.values(list).sort((a, b) => b.at - a.at);
      const body = el('div', 'bl-dialog-list');
      if (!people.length) body.appendChild(el('p', 'bl-dialog-empty', `Nobody yet. Use Block on a profile, a hover card, or beside a name on a post.`));
      people.forEach((p) => {
        const row = el('div', 'bl-dialog-row');
        const who = el('a', '', p.name);
        who.href = `/profile/${encodeURIComponent(p.name)}`;
        row.append(who, button('Unblock', '', () => { setBlocked(p.name, false); draw(); }));
        body.appendChild(row);
      });
      d.replaceChildren(title, el('p', '', `Hidden on ${site} in this browser.`), body, actions(button('Done', 'bl-btn-primary', () => d.close())));
    };
    draw();
    d.showModal();
  };

  // ---- wiring ----
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('.bl-block-btn');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    confirmDialog(b.dataset.blockName, has(b.dataset.blockName));
  }, true);
  // Another tab changed the list.
  addEventListener('storage', (e) => { if (e.key === KEY) { list = read(); apply(); } });

  window.__letBetterBlock = { has, hidesRow, apply, open: (name) => confirmDialog(name, has(name)), manage, count: () => Object.keys(read()).length, me: () => me };

  const run = () => {
    addPostButtons();
    addProfileButton();
    apply();
    // Comments or rows added later (Load next page, new replies) get the same treatment.
    const target = document.querySelector('.MessageList, .DataList.Comments, ul.Discussions, .CommentsWrap, main, #Content') || document.body;
    new MutationObserver((records) => {
      if (records.some((r) => r.addedNodes.length)) { addPostButtons(); apply(); }
    }).observe(target, { childList: true, subtree: true });
    // The inbox dropdown loads its rows when opened.
    document.querySelectorAll('.MeBox').forEach((box) => new MutationObserver(() => applyMessages(box)).observe(box, { childList: true, subtree: true }));
    sweepInbox();
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
