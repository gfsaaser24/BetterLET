// Checks for new releases and opens the update page. It holds no site data and sends none.
const API = 'https://betterlet-updates.emd437509.workers.dev/latest';
const ALARM = 'bl-check';

const newer = (a, b) => {
  const left = String(a).split('.').map(Number);
  const right = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff) return diff > 0;
  }
  return false;
};

const paintBadge = (latest) => {
  const waiting = latest && newer(latest.version, chrome.runtime.getManifest().version);
  chrome.action.setBadgeBackgroundColor({ color: '#1c6b3f' });
  chrome.action.setBadgeText({ text: waiting ? '1' : '' });
};

const check = async () => {
  try {
    const res = await fetch(API, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = await res.json();
    await chrome.storage.local.set({ latest, checkedAt: Date.now() });
    paintBadge(latest);
  } catch {
    // Offline or the service is down. The next alarm tries again.
  }
};

const openUpdate = (query = '') => chrome.tabs.create({ url: chrome.runtime.getURL(`update.html${query}`) });

// Set by the update page just before it reloads the extension.
const finishUpdate = async () => {
  const { updating } = await chrome.storage.local.get('updating');
  if (!updating) return;
  await chrome.storage.local.remove('updating');
  openUpdate('?done=1');
};

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  chrome.alarms.create(ALARM, { periodInMinutes: 360, delayInMinutes: 1 });
  check();
  if (reason === 'install') openUpdate('?welcome=1');
  await finishUpdate();
});

chrome.runtime.onStartup.addListener(check);
// A reload does not always fire onInstalled, so this also runs each time the worker wakes.
finishUpdate();
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM) check(); });

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'bl-open-update') openUpdate();
  if (message?.type === 'bl-check') {
    check().then(() => respond(true));
    return true;
  }
  return false;
});
