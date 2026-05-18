import { readFile, writeFile, unlink, readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache');

await mkdir(CACHE_DIR, { recursive: true });

export async function get(pageId) {
  try {
    const raw = await readFile(join(CACHE_DIR, `${pageId}.json`), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function set(pageId, data) {
  const entry = { cachedAt: new Date().toISOString(), ...data };
  await writeFile(join(CACHE_DIR, `${pageId}.json`), JSON.stringify(entry));
}

export async function invalidate(pageId) {
  try {
    await unlink(join(CACHE_DIR, `${pageId}.json`));
    return true;
  } catch (err) {
    if (err.code !== 'ENOENT') {
     console.error(`[cache] Failed to invalidate page ${pageId}:`, err.message);
    }
    return false;
  }
}

// Invalidates all cache entries whose filename contains the given pageId.
// Used by webhooks in OAuth mode where the workspace prefix isn't known.
export async function invalidateByPageId(pageId) {
  try {
    const files = await readdir(CACHE_DIR);
    const matches = files.filter(f => f.includes(pageId));
    await Promise.all(matches.map(f => unlink(join(CACHE_DIR, f))));
    return matches.length;
  } catch (err) {
    console.error(`[cache] Failed to invalidate by pageId ${pageId}:`, err.message);
    return 0;
  }
}

export async function invalidateAll() {
  try {
    const files = await readdir(CACHE_DIR);
    await Promise.all(files.map(f => unlink(join(CACHE_DIR, f))));
    return files.length;
  } catch (err) {
    console.error(`[cache] Failed to invalidate all:`, err.message);
    return 0;
  }
}
