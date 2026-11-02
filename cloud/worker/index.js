// BetterLET updates. GitHub tells this Worker when a release is published, and the extension reads from it.
// One way only: the public routes are read-only, and the webhook is signed, and files are only ever listed from the release itself.
const REPO = 'gfsaaser24/BetterLET';
const KEEP = 30;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=60',
  'x-content-type-options': 'nosniff',
};

const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const github = (url) => fetch(url, {
  headers: { accept: 'application/vnd.github+json', 'user-agent': 'betterlet-updates' },
  redirect: 'follow',
});

const hex = (text) => new Uint8Array(text.match(/../g).map((byte) => parseInt(byte, 16)));

async function validSignature(secret, body, header) {
  if (!secret || !/^sha256=[0-9a-f]{64}$/.test(header || '')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  // verify() compares in constant time.
  return crypto.subtle.verify('HMAC', key, hex(header.slice(7)), body);
}

const validFiles = (list) => Array.isArray(list) && list.length > 0 && list.every((file) => (
  typeof file?.path === 'string'
  && /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/.test(file.path)
  && /^[0-9a-f]{64}$/.test(file.sha256 || '')
));

const asset = async (url) => {
  const res = await github(url);
  if (!res.ok) throw new Error(`release.json answered ${res.status}`);
  const manifest = await res.json();
  if (!/^\d+(\.\d+)*$/.test(manifest.version || '') || !validFiles(manifest.files)) throw new Error('release.json is not valid');
  return manifest;
};

const older = (a, b) => String(a.version).localeCompare(String(b.version), undefined, { numeric: true });

// The release text comes from the signed webhook, and the file list from the release itself.
// GitHub's public API is not used: it rate limits Cloudflare's shared addresses.
async function saveRelease(env, release) {
  const entry = {
    version: release.tag_name.replace(/^v/, ''),
    tag: release.tag_name,
    name: release.name || release.tag_name,
    notes: release.body || '',
    url: release.html_url,
    publishedAt: release.published_at,
  };
  const manifest = await asset(`https://github.com/${REPO}/releases/download/${entry.tag}/release.json`);
  if (manifest.version !== entry.version) throw new Error('release.json does not match this release');
  const saved = (await env.UPDATES.get('releases', 'json')) || [];
  const releases = [entry, ...saved.filter((r) => r.tag !== entry.tag)].sort((a, b) => older(b, a)).slice(0, KEEP);
  await env.UPDATES.put('releases', JSON.stringify(releases));
  if (releases[0].tag === entry.tag) await env.UPDATES.put('latest', JSON.stringify({ ...entry, repo: REPO, files: manifest.files }));
  return { version: entry.version };
}

// Backstop for a missed webhook. Notes are unknown here, so the changelog fills in from the next webhook.
async function checkLatest(env) {
  const manifest = await asset(`https://github.com/${REPO}/releases/latest/download/release.json`);
  const latest = await env.UPDATES.get('latest', 'json');
  if (latest?.version === manifest.version) return;
  const tag = `v${manifest.version}`;
  const url = `https://github.com/${REPO}/releases/tag/${tag}`;
  await env.UPDATES.put('latest', JSON.stringify({ version: manifest.version, tag, name: tag, notes: '', url, publishedAt: new Date().toISOString(), repo: REPO, files: manifest.files }));
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET' } });
    }
    if (request.method === 'GET' && pathname === '/latest') {
      const latest = await env.UPDATES.get('latest', 'json');
      return latest ? reply(latest) : reply({ error: 'no release yet' }, 404);
    }
    if (request.method === 'GET' && pathname === '/releases') {
      return reply((await env.UPDATES.get('releases', 'json')) || []);
    }
    if (request.method === 'POST' && pathname === '/webhook/github') {
      const body = await request.arrayBuffer();
      if (!(await validSignature(env.GITHUB_WEBHOOK_SECRET, body, request.headers.get('x-hub-signature-256')))) {
        return reply({ error: 'bad signature' }, 401);
      }
      const event = request.headers.get('x-github-event');
      if (event === 'ping') return reply({ ok: true });
      if (event !== 'release') return reply({ ignored: event });
      const { action, release } = JSON.parse(new TextDecoder().decode(body));
      if (!['published', 'released', 'edited'].includes(action) || release?.draft || release?.prerelease) return reply({ ignored: action });
      try {
        return reply(await saveRelease(env, release));
      } catch (err) {
        return reply({ error: err.message }, 502);
      }
    }
    return reply({ error: 'not found' }, 404);
  },
  // Backstop in case a webhook never arrives.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkLatest(env));
  },
};
