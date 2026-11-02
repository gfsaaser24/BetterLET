// All release text goes in as textContent, so nothing from a release can run here.
(async () => {
  const API = 'https://betterlet-updates.emd437509.workers.dev/releases';
  const query = new URLSearchParams(location.search);
  const theme = query.get('theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  document.body.classList.toggle('embed', query.has('embed'));
  const list = document.getElementById('list');
  const el = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const addNotes = (box, notes) => {
    let ul = null;
    notes.split(/\r?\n/).forEach((line) => {
      const text = line.trim().replace(/\*\*/g, '');
      if (!text || text.startsWith('<!--')) { ul = null; return; }
      const bullet = text.match(/^[-*]\s+(.*)/);
      if (bullet) {
        if (!ul) { ul = el('ul'); box.appendChild(ul); }
        ul.appendChild(el('li', bullet[1]));
        return;
      }
      ul = null;
      const heading = text.match(/^#{1,6}\s+(.*)/);
      box.appendChild(heading ? el('h3', heading[1]) : el('p', text));
    });
  };
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(res.status);
    const releases = await res.json();
    list.textContent = '';
    if (!releases.length) list.appendChild(el('p', 'No releases yet.'));
    releases.forEach((release) => {
      const box = el('article');
      box.appendChild(el('h2', `Version ${release.version}`));
      const when = el('time', new Date(release.publishedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }));
      when.dateTime = release.publishedAt;
      box.appendChild(when);
      addNotes(box, release.notes);
      list.appendChild(box);
    });
  } catch {
    list.textContent = '';
    list.appendChild(el('p', 'Could not load the changelog.'));
  }
})();
