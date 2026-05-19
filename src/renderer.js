// Pure rendering — no API calls. Converts fetched page data to HTML.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import MarkdownIt from 'markdown-it';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateHtml = readFileSync(join(__dirname, 'template.html'), 'utf8');

const md = new MarkdownIt({ html: true });

const CHECKBOX_UNCHECKED = process.env.CHECKBOX_UNCHECKED || '☐';
const CHECKBOX_CHECKED   = process.env.CHECKBOX_CHECKED   || '☑';

const DB_COLS = ['Предлог решења', 'Опис проблема', 'Ниво ургентности (опсег проблема)', 'Статус', 'Број потписника'];

function extractTitle(page) {
  const titleProp = Object.values(page.properties).find(p => p.type === 'title');
  return titleProp?.title[0]?.plain_text || 'Untitled';
}

function richText(arr) {
  return arr.map(t => {
    let s = t.plain_text;
    if (t.annotations?.bold)          s = `**${s}**`;
    if (t.annotations?.italic)         s = `*${s}*`;
    if (t.annotations?.strikethrough)  s = `~~${s}~~`;
    if (t.annotations?.code)           s = `\`${s}\``;
    if (t.href)                        s = `[${s}](${t.href})`;
    return s;
  }).join('');
}

function extractCell(prop) {
  if (!prop) return '';
  switch (prop.type) {
    case 'title':        return prop.title.map(t => t.plain_text).join('');
    case 'rich_text':    return prop.rich_text.map(t => t.plain_text).join('');
    case 'select': {
      const s = prop.select;
      if (!s) return '';
      return `<span class="badge badge-${s.color || 'default'}">${s.name}</span>`;
    }
    case 'multi_select':
      return prop.multi_select.map(s => `<span class="badge badge-${s.color || 'default'}">${s.name}</span>`).join(' ');
    case 'status': {
      const s = prop.status;
      if (!s) return '';
      return `<span class="badge badge-${s.color || 'default'}">${s.name}</span>`;
    }
    case 'number':       return prop.number != null ? String(prop.number) : '';
    case 'checkbox':     return prop.checkbox ? '✓' : '';
    case 'date':         return prop.date?.start || '';
    case 'url':          return prop.url || '';
    default:             return '';
  }
}

function blocksToMarkdown(blocks) {
  let out = '';

  for (const block of blocks) {
    const type = block.type;
    const data = block[type];

    switch (type) {
      case 'heading_1':
        out += `# ${richText(data.rich_text)}\n\n`;
        break;
      case 'heading_2':
        out += `## ${richText(data.rich_text)}\n\n`;
        break;
      case 'heading_3':
        out += `### ${richText(data.rich_text)}\n\n`;
        break;
      case 'paragraph': {
        const text = richText(data.rich_text);
        out += text ? `${text}\n\n` : '\n';
        break;
      }
      case 'to_do': {
        const bullet = data.checked ? CHECKBOX_CHECKED : CHECKBOX_UNCHECKED;
        out += `${bullet} ${richText(data.rich_text)}\n`;
        break;
      }
      case 'bulleted_list_item':
        out += `- ${richText(data.rich_text)}\n`;
        break;
      case 'numbered_list_item':
        out += `1. ${richText(data.rich_text)}\n`;
        break;
      case 'quote':
        out += `> ${richText(data.rich_text)}\n\n`;
        break;
      case 'code':
        out += `\`\`\`${data.language || ''}\n${data.rich_text.map(t => t.plain_text).join('')}\n\`\`\`\n\n`;
        break;
      case 'divider':
        out += `---\n\n`;
        break;
      case 'child_page': {
        const pageId = block.id.replace(/-/g, '');
        out += `[${data.title || 'Untitled'}](/page/${pageId})\n\n`;
        break;
      }
      case 'link_to_page': {
        if (block._title && block._targetId) {
          out += `[${block._title}](/page/${block._targetId})\n\n`;
        }
        break;
      }
      case 'bookmark': {
        const caption = data.caption?.length ? richText(data.caption) : data.url;
        out += `[${caption}](${data.url})\n\n`;
        break;
      }
      case 'link_preview':
      case 'embed':
        out += `[${data.url}](${data.url})\n\n`;
        break;
      case 'table': {
        const rows = block._rows || [];
        if (!rows.length) break;
        const cell = (c) => c.map(t => t.plain_text).join('').replace(/\|/g, '\\|');
        out += `| ${rows[0].table_row.cells.map(cell).join(' | ')} |\n`;
        out += `| ${Array(data.table_width).fill('---').join(' | ')} |\n`;
        for (const row of rows.slice(1)) {
          out += `| ${row.table_row.cells.map(cell).join(' | ')} |\n`;
        }
        out += '\n';
        break;
      }
      case 'child_database': {
        const rows = block._dbRows;
        if (!rows?.length) break;
        out += `| ${DB_COLS.join(' | ')} |\n`;
        out += `| ${DB_COLS.map(() => '---').join(' | ')} |\n`;
        for (const page of rows) {
          const pageId = page.id.replace(/-/g, '');
          const cells = DB_COLS.map((col, i) => {
            let val = extractCell(page.properties[col]).replace(/\|/g, '\\|').replace(/\n/g, ' ');
            if (i === 0 && val) val = `[${val}](/page/${pageId})`;
            return val;
          });
          out += `| ${cells.join(' | ')} |\n`;
        }
        out += '\n';
        break;
      }
    }
  }

  return out;
}

function extractCoverUrl(page, localCoverUrl) {
  if (localCoverUrl) return localCoverUrl;
  if (page.cover?.type === 'external') return page.cover.external.url;
  return null;
}

function htmlTemplate(content, title, coverUrl) {
  const safeTitle = title || 'Notion Page';
  return templateHtml
    .replaceAll('{{title}}', safeTitle)
    .replace('{{ogImage}}', coverUrl ? `<meta property="og:image" content="${coverUrl}">` : '')
    .replace('{{cover}}', coverUrl ? `<img class="cover" src="${coverUrl}" alt="">` : '')
    .replace('{{content}}', content);
}

const adminStyles = `
    .page-wrap { padding: 2rem; }
    ul.pages { list-style: none; padding: 0; }
    ul.pages li { display: flex; align-items: center; gap: 1rem; padding: .6rem 0; border-bottom: 1px solid var(--pico-muted-border-color); }
    ul.pages li:last-child { border-bottom: none; }
    ul.pages li a { font-size: 1.05rem; text-decoration: none; flex: 1; }
    ul.pages li a:hover { text-decoration: underline; }
    ul.pages li small { color: var(--pico-muted-color); white-space: nowrap; }
    ul.pages li button { margin: 0; padding: .25rem .75rem; font-size: .85rem; }
    .empty { color: var(--pico-muted-color); font-style: italic; }
    .current-badge { font-size: .75rem; background: var(--pico-primary-background); color: var(--pico-primary); padding: .15rem .5rem; border-radius: 1rem; white-space: nowrap; }`;

function pageListItem(page, extraFn) {
  const titleProp = Object.values(page.properties).find(p => p.type === 'title');
  const title = titleProp?.title[0]?.plain_text || 'Untitled';
  const id = page.id.replace(/-/g, '');
  const edited = page.last_edited_time ? new Date(page.last_edited_time).toLocaleDateString('sr-RS') : '';
  return { id, title, edited, extra: extraFn ? extraFn(id, title) : '' };
}

function adminShell(title, body) {
  return `<!DOCTYPE html>
<html lang="sr" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>${adminStyles}
  </style>
</head>
<body>
  <div class="page-wrap">
    <main class="container">
      ${body}
    </main>
  </div>
</body>
</html>`;
}

export function renderAdminPages(pages) {
  const items = pages.map(page => {
    const { id, title, edited } = pageListItem(page);
    return `<li><a href="/page/${id}">${title}</a>${edited ? `<small>${edited}</small>` : ''}</li>`;
  }).join('\n');

  const body = `<h1>Странице</h1>
      ${pages.length ? `<ul class="pages">\n${items}\n</ul>` : '<p class="empty">Нема доступних страница.</p>'}`;
  return adminShell('Странице', body);
}

export function renderNewPage(pages, defaultPageId) {
  const items = pages.map(page => {
    const { id, title, edited } = pageListItem(page);
    const isCurrent = id === defaultPageId;
    const btn = isCurrent
      ? `<span class="current-badge">подразумевана</span>`
      : `<form method="POST" action="/new"><input type="hidden" name="pageId" value="${id}"><button type="submit">Постави</button></form>`;
    return `<li><a href="/page/${id}">${title}</a>${edited ? `<small>${edited}</small>` : ''}${btn}</li>`;
  }).join('\n');

  const body = `<h1>Избор подразумеване странице</h1>
      ${pages.length ? `<ul class="pages">\n${items}\n</ul>` : '<p class="empty">Нема доступних страница.</p>'}`;
  return adminShell('Избор подразумеване странице', body);
}

export function renderPage(pageData) {
  const title = extractTitle(pageData.page);
  const coverUrl = extractCoverUrl(pageData.page, pageData.coverUrl);
  const html = md.render(blocksToMarkdown(pageData.blocks));
  return htmlTemplate(html, title, coverUrl);
}
