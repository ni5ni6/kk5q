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
