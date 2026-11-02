// Installs a release into the folder the extension runs from.
// Files come only from the fixed repo below, at the release tag, and each must match its SHA-256.
// The update service can only point at a tag. It cannot supply code.
const BLUpdater = (() => {
  const REPO = 'gfsaaser24/BetterLET';
  const TAG = /^v\d+(\.\d+)*$/;
  const PATH = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
  const HASH = /^[0-9a-f]{64}$/;

  const newer = (a, b) => {
    const left = String(a).split('.').map(Number);
    const right = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      const diff = (left[i] || 0) - (right[i] || 0);
      if (diff) return diff > 0;
    }
    return false;
  };

  const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');

  const fileIn = async (dir, path, create = false) => {
    const parts = path.split('/');
    const name = parts.pop();
    let folder = dir;
    for (const part of parts) folder = await folder.getDirectoryHandle(part, { create });
    return folder.getFileHandle(name, { create });
  };

  const read = async (dir, path) => {
    try {
      return await (await (await fileIn(dir, path)).getFile()).arrayBuffer();
    } catch (err) {
      if (err.name === 'NotFoundError') return null;
      throw err;
    }
  };

  const write = async (dir, path, bytes) => {
    const stream = await (await fileIn(dir, path, true)).createWritable();
    await stream.write(bytes);
    await stream.close();
  };

  const remove = async (dir, path) => {
    const parts = path.split('/');
    const name = parts.pop();
    let folder = dir;
    for (const part of parts) folder = await folder.getDirectoryHandle(part);
    await folder.removeEntry(name);
  };

  const isGitClone = async (dir) => {
    try {
      await dir.getDirectoryHandle('.git');
      return true;
    } catch {
      return false;
    }
  };

  // Chrome never tells an extension where it is stored. So write a marker file to the chosen folder
  // and ask the running extension for it: it can only be found if this is the folder Chrome loaded.
  const isLoadedFolder = async (dir, urlOf) => {
    const name = `bl-check-${crypto.randomUUID()}.txt`;
    await write(dir, name, new TextEncoder().encode('BetterLET folder check'));
    try {
      const res = await fetch(urlOf(name), { cache: 'no-store' });
      return res.ok;
    } catch {
      return false;
    } finally {
      await remove(dir, name);
    }
  };

  const validRelease = (release, current) => {
    if (!release || !TAG.test(release.tag || '') || release.tag !== `v${release.version}`) return 'This release has a bad version.';
    if (!newer(release.version, current)) return 'You already have this version or a newer one.';
    if (!Array.isArray(release.files) || !release.files.length) return 'This release has no file list.';
    if (!release.files.every((file) => PATH.test(file.path || '') && HASH.test(file.sha256 || ''))) return 'This release has a bad file list.';
    if (!release.files.some((file) => file.path === 'manifest.json')) return 'This release has no manifest.';
    return '';
  };

  const download = async (release, onProgress) => {
    const files = [];
    for (const [index, file] of release.files.entries()) {
      onProgress?.(`Downloading ${index + 1} of ${release.files.length}`);
      const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${release.tag}/${file.path}`, { cache: 'no-store', credentials: 'omit' });
      if (!res.ok) throw new Error(`Could not download ${file.path}.`);
      const bytes = await res.arrayBuffer();
      if (await sha256(bytes) !== file.sha256) throw new Error(`${file.path} failed its check. Nothing was changed.`);
      files.push({ path: file.path, bytes });
    }
    const manifest = JSON.parse(new TextDecoder().decode(files.find((file) => file.path === 'manifest.json').bytes));
    if (manifest.name !== 'BetterLET' || manifest.version !== release.version) throw new Error('The manifest does not match this release. Nothing was changed.');
    return files;
  };

  // Everything is downloaded and checked first. manifest.json goes last, and any failure puts the old files back.
  const install = async (dir, release, current, onProgress) => {
    const problem = validRelease(release, current);
    if (problem) throw new Error(problem);
    const files = await download(release, onProgress);
    files.sort((a, b) => (a.path === 'manifest.json') - (b.path === 'manifest.json'));
    const backup = [];
    for (const file of files) backup.push({ path: file.path, bytes: await read(dir, file.path) });
    onProgress?.('Installing');
    try {
      for (const file of files) await write(dir, file.path, file.bytes);
    } catch (err) {
      for (const old of backup) {
        if (old.bytes) await write(dir, old.path, old.bytes);
        else await remove(dir, old.path).catch(() => {});
      }
      throw new Error(`Could not write the update, so the old version was restored. ${err.message}`);
    }
  };

  return { REPO, newer, read, isGitClone, isLoadedFolder, validRelease, install };
})();
