import { readFile, writeFile, unlink, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache');

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
  } catch {
    return false;
  }
}

export async function invalidateAll() {
  const files = await readdir(CACHE_DIR);
  await Promise.all(files.map(f => unlink(join(CACHE_DIR, f))));
  return files.length;
}
