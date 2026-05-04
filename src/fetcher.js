// All Notion API calls. Returns plain serialisable data — no rendering logic here.
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const COVERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'covers');
await mkdir(COVERS_DIR, { recursive: true });

async function downloadCover(pageId, url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    const ext = ct.includes('png') ? '.png' : ct.includes('gif') ? '.gif' : ct.includes('webp') ? '.webp' : '.jpg';
    const filename = `${pageId}${ext}`;
    await writeFile(join(COVERS_DIR, filename), Buffer.from(await resp.arrayBuffer()));
    return `/covers/${filename}`;
  } catch {
    return null;
  }
}

const DB_COLS = ['Предлог решења', 'Опис проблема', 'Ниво ургентности (опсег проблема)', 'Статус', 'Број потписника'];

async function fetchAllBlocks(notion, blockId) {
  const blocks = [];
  let cursor;
  let hasMore = true;
  while (hasMore) {
    const resp = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor });
    blocks.push(...resp.results);
    cursor = resp.next_cursor;
    hasMore = resp.has_more;
  }
  return blocks;
}

async function resolveLinkedDatabase(notion, block) {
  try {
    await notion.databases.retrieve({ database_id: block.id });
    return block.id;
  } catch {
    // Linked database views don't expose their source ID via the block.
    // Search by title first, then fall back to matching by expected property names.
    const queries = block.child_database?.title
      ? [{ query: block.child_database.title }, {}]
      : [{}];

    for (const params of queries) {
      const result = await notion.search({ ...params, filter: { value: 'database', property: 'object' } });
      const match = result.results.find(db => DB_COLS.some(col => db.properties?.[col]));
      if (match) return match.id;
    }
    return null;
  }
}

export async function fetchPageData(notion, pageId) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const blocks = await fetchAllBlocks(notion, pageId);

  await Promise.all(blocks.map(async (block) => {
    if (block.type === 'table') {
      block._rows = await fetchAllBlocks(notion, block.id);
    }
    if (block.type === 'child_database') {
      try {
        const dbId = await resolveLinkedDatabase(notion, block);
        if (dbId) {
          const resp = await notion.databases.query({ database_id: dbId, page_size: 100 });
          block._dbRows = resp.results;
        }
      } catch {
        block._dbRows = null;
      }
    }
    if (block.type === 'link_to_page') {
      try {
        const ref = block.link_to_page;
        if (ref.type === 'page_id') {
          const p = await notion.pages.retrieve({ page_id: ref.page_id });
          const titleProp = Object.values(p.properties).find(pr => pr.type === 'title');
          block._title = titleProp?.title[0]?.plain_text || 'Untitled';
          block._targetId = ref.page_id.replace(/-/g, '');
        } else if (ref.type === 'database_id') {
          const db = await notion.databases.retrieve({ database_id: ref.database_id });
          block._title = db.title[0]?.plain_text || 'Untitled';
          block._targetId = ref.database_id.replace(/-/g, '');
        }
      } catch {
        block._title = null;
      }
    }
  }));

  const coverUrl = page.cover?.type === 'file'
    ? await downloadCover(pageId, page.cover.file.url)
    : null;

  return { page, blocks, coverUrl };
}
