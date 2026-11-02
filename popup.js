(async () => {
  const current = chrome.runtime.getManifest().version;
  document.getElementById('version').textContent = `BetterLET ${current}`;
  document.getElementById('open').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'bl-open-update' });
    window.close();
  });
  const paint = (latest) => {
    const waiting = latest && latest.version.localeCompare(current, undefined, { numeric: true }) > 0;
    document.getElementById('notice').hidden = !waiting;
    if (waiting) document.getElementById('notice-text').textContent = `Version ${latest.version} is ready.`;
  };
  paint((await chrome.storage.local.get('latest')).latest);
  await chrome.runtime.sendMessage({ type: 'bl-check' });
  paint((await chrome.storage.local.get('latest')).latest);
})();
