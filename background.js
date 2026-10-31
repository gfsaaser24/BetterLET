// Fetches link previews for popovers.js. Pages from the web are data only:
// nothing here runs them, and the card shows them as plain text.
//
// Network rule: a request goes out only after its host passes checkTarget(). Redirects are
// refused, because extension fetches cannot read a redirect target to check it first.
// Known limit: DNS can change between the check and the fetch, so this reduces private
// network reach but cannot fully prevent it.

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|\[)/i;
const IP_HOST = /^(\d+\.){3}\d+$/;
const MAX_PAGE_BYTES = 300 * 1024;
const MAX_IMAGE_BYTES = 1500 * 1024;
const TIMEOUT_MS = 6000;
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;

const withTimeout = () => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
};

function isPrivateIp(ip) {
  const value = ip.toLowerCase();
  if (value.includes(':')) {
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return value === '::' || value === '::1' || /^(f[cd]|fe[89ab]|ff)/.test(value) || value.startsWith('::ffff:');
  }
  const [a, b] = value.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19));
}

async function lookup(host, type) {
  const t = withTimeout();
  try {
    const res = await fetch(`https://security.cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { accept: 'application/dns-json' },
      signal: t.signal,
    });
    return await res.json();
  } finally {
    t.done();
  }
}

// Cloudflare's security DNS answers 0.0.0.0 for known malware and phishing domains. No key needed.
async function checkSafety(host) {
  if (PRIVATE_HOST.test(host)) return 'private';
  if (IP_HOST.test(host)) return isPrivateIp(host) ? 'private' : 'unknown';
  try {
    const [a, aaaa] = await Promise.all([lookup(host, 'A'), lookup(host, 'AAAA')]);
    if (a.Status === 3) return 'missing';
    if (a.Status !== 0) return 'unknown';
    const records = [...(a.Answer || []), ...(aaaa.Answer || [])].filter((r) => r.type === 1 || r.type === 28);
    if (records.some((r) => r.data === '0.0.0.0' || r.data === '::')) return 'blocked';
    if (!records.length) return 'unknown';
    return records.some((r) => isPrivateIp(r.data)) ? 'private' : 'ok';
  } catch {
    return 'unknown';
  }
}

// Only plain web ports, so a hover cannot poke other services.
const allowedUrl = (url) => /^https?:$/.test(url.protocol) && !url.port && !url.username && !url.password;

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

const plainFetch = (url, accept, signal) => fetch(url, {
  credentials: 'omit',
  referrerPolicy: 'no-referrer',
  redirect: 'error',
  signal,
  headers: { accept },
});

async function readChunks(res, limit) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    chunks.push(value);
  }
  reader.cancel().catch(() => {});
  return { chunks, size };
}

// The card shows a data URL, so the page never requests the image itself.
async function fetchImage(raw) {
  let url;
  try { url = new URL(raw); } catch { return ''; }
  if (url.protocol !== 'https:' || !allowedUrl(url) || await checkSafety(url.hostname) !== 'ok') return '';
  const t = withTimeout();
  try {
    const res = await plainFetch(url.href, 'image/*', t.signal);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !IMAGE_TYPES.test(type)) return '';
    const { chunks, size } = await readChunks(res, MAX_IMAGE_BYTES + 1);
    if (size > MAX_IMAGE_BYTES) return '';
    let binary = '';
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i += 8192) binary += String.fromCharCode(...chunk.subarray(i, i + 8192));
    }
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return '';
  } finally {
    t.done();
  }
}

async function preview(raw) {
  const url = new URL(raw);
  if (!allowedUrl(url)) return { safety: 'unknown' };
  const safety = await checkSafety(url.hostname);
  // Fetch only what passed. Everything else shows the domain and the verdict.
  if (safety !== 'ok') return { safety };
  // Most http links redirect to https, and redirects are refused.
  url.protocol = 'https:';
  const t = withTimeout();
  try {
    const res = await plainFetch(url.href, 'text/html', t.signal);
    if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return { safety };
    const { chunks } = await readChunks(res, MAX_PAGE_BYTES);
    const decoder = new TextDecoder();
    const html = chunks.map((c) => decoder.decode(c, { stream: true })).join('');
    const meta = parseMeta(html, url.href);
    t.done();
    return { safety, ...meta, image: meta.image ? await fetchImage(meta.image) : '' };
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

if (typeof module !== 'undefined') module.exports = { preview, parseMeta, checkSafety, isPrivateIp, fetchImage };
