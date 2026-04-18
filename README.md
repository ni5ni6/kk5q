# Notion to HTML

A simple HTTP server that retrieves Notion pages by ID and renders them as styled HTML.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create a Notion integration:**
   - Go to https://www.notion.so/my-integrations
   - Click "Create new integration"
   - Give it a name (e.g., "notion-to-html")
   - Accept the defaults and create
   - Copy the API key

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   - Edit `.env` and paste your Notion API key as `NOTION_API_KEY`
   - Optionally set `ROOT_PAGE_ID` to a Notion page ID — the server will redirect `/` to that page
   - Optionally set `NOTION_WEBHOOK_SECRET` to your Notion webhook signing secret (see Cache Invalidation below)

4. **Share a page with your integration:**
   - Open a Notion page
   - Click the share button
   - Select your integration from the "Invite" dropdown
   - Click "Invite"

## Usage

**Start the server:**
```bash
npm start
```

The server will run at `http://localhost:3000`

**Access the root page** (if `ROOT_PAGE_ID` is set):
```
http://localhost:3000/
```

**Access a specific page:**
```
http://localhost:3000/page/:pageId
```

Replace `:pageId` with your Notion page ID (you can find it in the page URL).

Example:
```
http://localhost:3000/page/e1d4a5c3b2f1a9c8d3e4f5a6b7c8d9e0
```

## Features

- Fetches Notion pages via the official API
- Converts Notion blocks to markdown
- Renders markdown as clean HTML
- Simple, minimalist whitish styling
- Supports headings, paragraphs, lists, quotes, code blocks, and more
- Error handling for invalid or inaccessible pages

## Cache Invalidation

Pages are cached on first load. To force a refresh:

**Force-refresh a single page** (re-fetches and updates cache):
```
http://localhost:3000/page/:pageId?refresh=1
```

**Notion webhook** (automatic — invalidates the page whenever you edit it in Notion):

1. Deploy the server to a public HTTPS URL (e.g. `https://kk51.rs`)
2. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) → your integration → **Webhooks** → **Add webhook**
3. Set the URL to `https://your-domain/webhook/notion`
4. Select event types: **Page** only (uncheck Database, Data source, View, Comment)
5. Click **Create subscription** — Notion will POST a verification token to your server
6. Check your server logs for a line like:
   ```
   *** Notion verification token: secret_xxxxxxxxx ***
   ```
7. Paste that token into the Notion "Verify subscription" dialog

Once active, the webhook fires automatically for every page the integration has access to — no per-page configuration needed. `NOTION_WEBHOOK_SECRET` is optional (signature verification); the server works without it.

**Manual invalidation via API:**
```bash
# Invalidate one page
curl -X DELETE http://localhost:3000/cache/:pageId

# Invalidate all pages
curl -X POST http://localhost:3000/cache/invalidate
```

## Development

For auto-reload during development:
```bash
npm run dev
```

## Styling

The HTML includes inline CSS with:
- Clean typography
- Whitish color scheme (#fafaf8, #ffffff, #333)
- Proper spacing and readability
- Styled code blocks, quotes, tables, and links
- Minimal, elegant design
