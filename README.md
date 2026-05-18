# Notion to HTML

A simple HTTP server that retrieves Notion pages by ID and renders them as styled HTML.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

The server supports two authentication modes. Pick one.

### Mode A — Internal integration (single workspace, no login)

Use this when the server is private and you want one fixed workspace.

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations), create an **internal** integration, and copy the secret.
2. In `.env`, set `NOTION_API_KEY` and leave `NOTION_CLIENT_ID` empty.
3. Share any Notion pages you want to expose with your integration (page `...` menu → Connections).

### Mode B — Public OAuth integration (multi-workspace, users log in)

Use this when others should be able to connect their own Notion workspaces.

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations), create a **public** integration.
2. Under **OAuth Domain & URIs**, add your redirect URI (e.g. `https://your-domain/auth/notion/callback`).
3. Copy the **Client ID** and **Client Secret**.
4. In `.env`:
   ```
   NOTION_CLIENT_ID=your_client_id
   NOTION_CLIENT_SECRET=your_client_secret
   NOTION_REDIRECT_URI=https://your-domain/auth/notion/callback
   SESSION_SECRET=a-long-random-string
   ```
5. Leave `NOTION_API_KEY` unset (it is ignored in OAuth mode).

When `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET` are both set, the server runs in OAuth mode. Users are redirected to Notion to authorize and are sent back to the page they requested. `/auth/logout` ends the session.

**Other `.env` options (both modes):**
- `NOTION_WEBHOOK_SECRET` — webhook signing secret (see Cache Invalidation)
- `CHECKBOX_UNCHECKED` / `CHECKBOX_CHECKED` — bullet characters for to-do items (defaults: `☐` / `☑`)

## Usage

**Start the server:**
```bash
npm start
```

The server will run at `http://localhost:3000`

**Homepage** — lists all pages shared with your integration:
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
- Supports headings, paragraphs, lists, checkboxes, quotes, code blocks, child pages, link to pages, bookmark and more
- Error handling for invalid or inaccessible pages

Doesn't support:

- indented blocks
- callouts

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
