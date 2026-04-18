import express from 'express';
import { Client } from '@notionhq/client';
import 'dotenv/config';
import { fetchPageData } from './src/fetcher.js';
import { renderPage } from './src/renderer.js';
import * as cache from './src/cache.js';

const app = express();
const port = process.env.PORT || 3000;

const notion = new Client({ auth: process.env.NOTION_API_KEY });

function normalizePageId(pageId) {
  const clean = pageId.replace(/[-\s]/g, '').toLowerCase();
  return /^[a-f0-9]{32}$/.test(clean) ? clean : null;
}

app.get('/page/:pageId', async (req, res) => {
  try {
    const pageId = normalizePageId(req.params.pageId);
    if (!pageId) return res.status(400).send('Invalid page ID.');

    const forceRefresh = req.query.refresh === '1';
    let pageData = forceRefresh ? null : await cache.get(pageId);

    if (!pageData) {
      pageData = await fetchPageData(notion, pageId);
      await cache.set(pageId, pageData);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPage(pageData));
  } catch (error) {
    console.error(error);
    if (error.code === 'object_not_found') return res.status(404).send('Page not found.');
    if (error.code === 'unauthorized')     return res.status(401).send('Unauthorized.');
    res.status(500).send('Server error.');
  }
});

// Invalidate a single page
app.delete('/cache/:pageId', async (req, res) => {
  const pageId = normalizePageId(req.params.pageId);
  if (!pageId) return res.status(400).json({ error: 'Invalid page ID.' });
  res.json({ invalidated: await cache.invalidate(pageId) });
});

// Invalidate all cached pages
app.post('/cache/invalidate', async (_req, res) => {
  const count = await cache.invalidateAll();
  res.json({ invalidated: count });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
