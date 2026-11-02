// BetterLET updates. GitHub tells this Worker when a release is published, and the extension reads from it.
// One way only: the public routes are read-only, and the webhook only triggers a re-read from GitHub.
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

// Always rebuilt from GitHub, so a missed or replayed webhook cannot leave bad data behind.
async function sync(env) {
  const res = await github(`https://api.github.com/repos/${REPO}/releases?per_page=${KEEP}`);
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const releases = (await res.json())
    .filter((r) => !r.draft && !r.prerelease)
    .map((r) => ({
      version: r.tag_name.replace(/^v/, ''),
      tag: r.tag_name,
      name: r.name || r.tag_name,
      notes: r.body || '',
      url: r.html_url,
      publishedAt: r.published_at,
    }));
  const latest = releases[0];
  if (!latest) return { version: null };
  const asset = await github(`https://github.com/${REPO}/releases/download/${latest.tag}/release.json`);
  if (!asset.ok) throw new Error(`release.json answered ${asset.status}`);
  const manifest = await asset.json();
  if (manifest.version !== latest.version || !validFiles(manifest.files)) throw new Error('release.json is not valid');
  await env.UPDATES.put('latest', JSON.stringify({ ...latest, repo: REPO, files: manifest.files }));
  await env.UPDATES.put('releases', JSON.stringify(releases));
  return { version: latest.version };
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
      try {
        return reply(await sync(env));
      } catch (err) {
        return reply({ error: err.message }, 502);
      }
    }
    return reply({ error: 'not found' }, 404);
  },
  // Backstop in case a webhook never arrives.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sync(env));
  },
};
