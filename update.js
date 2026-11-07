(async () => {
  const $ = (id) => document.getElementById(id);
  const current = chrome.runtime.getManifest().version;
  // Firefox has no folder picker. An installed .xpi updates itself through update_url; a temporary add-on updates by hand.
  const canPick = 'showDirectoryPicker' in window;
  const query = new URLSearchParams(location.search);
  const say = (text, bad = false) => {
    $('status').textContent = text;
    $('status').classList.toggle('bl-bad', bad);
  };

  // A folder handle cannot go in chrome.storage, so it lives in IndexedDB.
  const store = (mode, run) => new Promise((resolve, reject) => {
    const open = indexedDB.open('betterlet', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('handles');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = run(open.result.transaction('handles', mode).objectStore('handles'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    };
  });
  const savedFolder = () => store('readonly', (s) => s.get('folder'));
  const saveFolder = (dir) => store('readwrite', (s) => s.put(dir, 'folder'));

  const canWrite = async (dir) => {
    const mode = { mode: 'readwrite' };
    return (await dir.queryPermission(mode)) === 'granted' || (await dir.requestPermission(mode)) === 'granted';
  };

  const checkFolder = async (dir) => {
    if (await BLUpdater.isGitClone(dir)) throw new Error('This folder is a git clone. Run git pull there instead.');
    const bytes = await BLUpdater.read(dir, 'manifest.json');
    const manifest = bytes && JSON.parse(new TextDecoder().decode(bytes));
    if (manifest?.name !== 'BetterLET') throw new Error('That folder does not hold BetterLET. Pick the folder you loaded in Chrome.');
    if (!(await BLUpdater.isLoadedFolder(dir, (name) => chrome.runtime.getURL(name)))) {
      throw new Error('That is a copy of BetterLET, not the folder Chrome is running. Pick the folder shown under Load unpacked.');
    }
  };

  const pick = async () => {
    const dir = await window.showDirectoryPicker({ id: 'betterlet', mode: 'readwrite' });
    await checkFolder(dir);
    await saveFolder(dir);
    return dir;
  };

  const release = async () => {
    await chrome.runtime.sendMessage({ type: 'bl-check' });
    return (await chrome.storage.local.get('latest')).latest;
  };

  const paint = async () => {
    const latest = await release();
    const dir = await savedFolder();
    const waiting = latest && BLUpdater.newer(latest.version, current);
    $('title').textContent = `BetterLET ${current}`;
    $('folder').hidden = Boolean(dir) || !canPick;
    $('install').hidden = !canPick;
    $('manual').hidden = canPick;
    $('update').hidden = !waiting;
    if (query.has('done')) $('intro').textContent = 'Update installed. Refresh any open LowEndTalk or LowEndSpirit tabs to use it.';
    else if (query.has('welcome')) $('intro').textContent = canPick
      ? 'Welcome. Connect your folder once, and updates install with one click.'
      : 'Welcome. When a new version is out, BetterLET tells you here.';
    else if (!waiting) $('intro').textContent = latest ? 'You have the latest version.' : 'No release has been published yet.';
    else $('intro').textContent = '';
    if (waiting) {
      $('update-title').textContent = `Version ${latest.version} is ready`;
      $('update-source').textContent = canPick
        ? `From github.com/${BLUpdater.REPO}, tag ${latest.tag}. Every file is checked before it is installed.`
        : `From github.com/${BLUpdater.REPO}, tag ${latest.tag}.`;
      $('zip').hidden = false;
      $('zip').href = canPick
        ? `https://github.com/${BLUpdater.REPO}/archive/refs/tags/${latest.tag}.zip`
        : `https://github.com/${BLUpdater.REPO}/releases/download/${latest.tag}/betterlet-${latest.version}.xpi`;
    }
    return latest;
  };

  let latest = await paint();

  $('pick').addEventListener('click', async () => {
    say('');
    try {
      await pick();
      say('Folder connected.');
      latest = await paint();
    } catch (err) {
      if (err.name !== 'AbortError') say(err.message, true);
    }
  });

  $('install').addEventListener('click', async () => {
    say('');
    $('install').disabled = true;
    try {
      let dir = await savedFolder();
      if (!dir) dir = await pick();
      if (!(await canWrite(dir))) throw new Error('Chrome needs your OK to write to the folder. Click Update now and choose Allow.');
      try {
        await checkFolder(dir);
      } catch (err) {
        // The folder may have moved. Ask again rather than writing to the wrong place.
        if (err.name !== 'NotFoundError') throw err;
        dir = await pick();
      }
      await BLUpdater.install(dir, latest, current, say);
      await chrome.storage.local.set({ updating: true });
      say('Installed. Reloading BetterLET…');
      chrome.runtime.reload();
    } catch (err) {
      if (err.name !== 'AbortError') say(err.message, true);
      $('install').disabled = false;
    }
  });
})();
