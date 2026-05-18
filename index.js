import express from 'express';
import session from 'express-session';
import { createHmac, timingSafeEqual } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@notionhq/client';
import 'dotenv/config';
import { fetchPageData, fetchSharedPages } from './src/fetcher.js';
import { renderPage, renderHomepage } from './src/renderer.js';
import * as cache from './src/cache.js';
import { requireAuth, notionTokenForReq, workspaceIdForReq, registerAuthRoutes } from './src/auth.js';

const app = express();
const port = process.env.PORT || 3000;
const __dirname = dirname(fileURLToPath(import.meta.url));

// OAuth mode when NOTION_CLIENT_ID is set; internal API key mode otherwise.
const oauthMode = !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);

// In internal mode, a single global client is used.
const internalNotion = oauthMode ? null : new Client({ auth: process.env.NOTION_API_KEY });

app.use('/covers', express.static(join(__dirname, 'public', 'covers')));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

if (oauthMode) registerAuthRoutes(app);

function normalizePageId(pageId) {
  const clean = pageId.replace(/[-\s]/g, '').toLowerCase();
  return /^[a-f0-9]{32}$/.test(clean) ? clean : null;
}

function getNotion(req) {
  if (oauthMode) return new Client({ auth: notionTokenForReq(req) });
  return internalNotion;
}

function cacheKey(req, pageId) {
  return oauthMode ? `${workspaceIdForReq(req)}_${pageId}` : pageId;
}

const pageMiddleware = oauthMode ? [requireAuth] : [];

app.get('/', ...pageMiddleware, async (req, res) => {
  try {
    const pages = await fetchSharedPages(getNotion(req));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderHomepage(pages));
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error.');
  }
});

app.get('/page/:pageId', ...pageMiddleware, async (req, res) => {
  try {
    const pageId = normalizePageId(req.params.pageId);
    if (!pageId) return res.status(400).send('Invalid page ID.');

    const key = cacheKey(req, pageId);
    const forceRefresh = req.query.refresh === '1';
    let pageData = forceRefresh ? null : await cache.get(key);

    if (!pageData) {
      pageData = await fetchPageData(getNotion(req), pageId);
      await cache.set(key, pageData);
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
app.post('/cache/invalidate/:pageId', async (req, res) => {
  const pageId = normalizePageId(req.params.pageId);
  if (!pageId) return res.status(400).json({ error: 'Invalid page ID.' });
  const key = cacheKey(req, pageId);
  res.json({ invalidated: await cache.invalidate(key) });
});

// Invalidate all cached pages
app.post('/cache/invalidate', async (_req, res) => {
  const count = await cache.invalidateAll();
  res.json({ invalidated: count });
});

// Notion webhook — auto-invalidates a page's cache when it's updated in Notion
app.post('/webhook/notion', express.raw({ type: 'application/json' }), (req, res) => {
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers['x-notion-signature'];
    const expected = 'v0=' + createHmac('sha256', secret).update(req.body).digest('hex');
    try {
      if (!sig || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return res.status(401).json({ error: 'Invalid signature.' });
      }
    } catch {
      return res.status(401).json({ error: 'Invalid signature.' });
    }
  }

  let event;
  try { event = JSON.parse(req.body); } catch { return res.status(400).json({ error: 'Bad JSON.' }); }

  if (event?.verification_token) {
    console.log(`\n*** Notion verification token: ${event.verification_token} ***\n`);
    return res.json({ ok: true });
  }

  const pageId = event?.entity?.id?.replace(/-/g, '');
  if (pageId) {
    // Webhook doesn't carry workspace info — invalidate all matching page entries.
    cache.invalidateByPageId(pageId).then(count => {
      console.log(`Webhook: invalidated ${count} cache entries for ${pageId}`);
    });
  }
  res.json({ ok: true, pageId: pageId || null });
});

app.get('/health', (_req, res) => res.json({ status: 'ok', mode: oauthMode ? 'oauth' : 'internal' }));

app.listen(port, () => console.log(`Server running at http://localhost:${port} (${oauthMode ? 'OAuth' : 'internal API key'} mode)`));
