// All Notion API calls. Returns plain serialisable data — no rendering logic here.

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
  }));

  return { page, blocks };
}
