// Fetches link previews for popovers.js. Pages from the web are data only:
// nothing here runs them, and the card shows them as plain text.

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[)/i;
const IP_HOST = /^(\d+\.){3}\d+$/;
const MAX_BYTES = 300 * 1024;
const TIMEOUT_MS = 6000;

const withTimeout = () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
};

// Cloudflare's security DNS answers 0.0.0.0 for known malware and phishing domains. No key needed.
async function checkSafety(host) {
  if (IP_HOST.test(host)) return 'unknown';
  const t = withTimeout();
  try {
    const res = await fetch(`https://security.cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`, {
      headers: { accept: 'application/dns-json' },
      signal: t.signal,
    });
    const data = await res.json();
    if (data.Status === 3) return 'missing';
    if (data.Status !== 0) return 'unknown';
    return (data.Answer || []).some((a) => a.data === '0.0.0.0') ? 'blocked' : 'ok';
  } catch {
    return 'unknown';
  } finally {
    t.done();
  }
}

const decode = (text) => text
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

function parseMeta(html, base) {
  const tags = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = (tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1]?.toLowerCase();
    const value = (tag.match(/content\s*=\s*"([^"]*)"/i) || tag.match(/content\s*=\s*'([^']*)'/i) || [])[1];
    if (key && value && !(key in tags)) tags[key] = decode(value);
  }
  const title = tags['og:title'] || tags['twitter:title'] || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = tags['og:description'] || tags.description || tags['twitter:description'] || '';
  let image = '';
  try {
    const url = new URL(tags['og:image'] || tags['twitter:image'] || '', base);
    if (url.protocol === 'https:' && (tags['og:image'] || tags['twitter:image'])) image = url.href;
  } catch {}
  return { title: title.slice(0, 160), description: description.slice(0, 280), image };
}

async function readStart(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    text += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return text;
}

async function preview(raw) {
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) return { safety: 'unknown' };
  if (PRIVATE_HOST.test(url.hostname)) return { safety: 'unknown' };
  const safety = await checkSafety(url.hostname);
  // Never touch a flagged or missing site.
  if (safety === 'blocked' || safety === 'missing') return { safety };
  const t = withTimeout();
  try {
    const res = await fetch(url.href, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      signal: t.signal,
      headers: { accept: 'text/html' },
    });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return { safety };
    return { safety, ...parseMeta(await readStart(res), res.url) };
  } catch {
    return { safety };
  } finally {
    t.done();
  }
}

if (globalThis.chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (sender.id !== chrome.runtime.id || msg?.type !== 'bl-preview') return false;
    preview(msg.url).then(reply, () => reply({ safety: 'unknown' }));
    return true;
  });
}

if (typeof module !== 'undefined') module.exports = { preview, parseMeta, checkSafety };
