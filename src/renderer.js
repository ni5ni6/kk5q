// Pure rendering — no API calls. Converts fetched page data to HTML.
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();

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
    case 'select':       return prop.select?.name || '';
    case 'multi_select': return prop.multi_select.map(s => s.name).join(', ');
    case 'status':       return prop.status?.name || '';
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

const htmlTemplate = (content, title, coverUrl) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Notion Page'}</title>
  <meta property="og:title" content="${title || 'Notion Page'}">
  <meta property="og:type" content="website">
  ${coverUrl ? `<meta property="og:image" content="${coverUrl}">` : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #fafaf8;
      color: #333;
      line-height: 1.6;
    }
    .cover { width: 100%; height: 280px; object-fit: cover; object-position: center 40%; display: block; }
    .page-wrap { padding: 2rem; }
    .container { max-width: 800px; margin: 0 auto; background-color: #fff; padding: 3rem; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5rem; margin-bottom: .75rem; font-weight: 600; color: #222; }
    h1 { font-size: 2rem; border-bottom: 2px solid #f0f0f0; padding-bottom: .5rem; }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.25rem; }
    p { margin-bottom: 1rem; }
    a { color: #666; text-decoration: underline; transition: color .2s; }
    a:hover { color: #333; }
    ul, ol { margin-left: 2rem; margin-bottom: 1rem; }
    li { margin-bottom: .5rem; }
    blockquote { border-left: 4px solid #e0e0e0; padding-left: 1rem; margin: 0 0 1rem; color: #666; font-style: italic; }
    code { background-color: #f5f5f5; padding: .2rem .5rem; border-radius: 3px; font-family: 'Monaco','Menlo','Ubuntu Mono',monospace; font-size: .9em; color: #555; }
    pre { background-color: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; margin-bottom: 1rem; }
    pre code { background: transparent; padding: 0; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    table th, table td { border: 1px solid #e0e0e0; padding: .75rem; text-align: left; }
    table th { background-color: #f9f9f9; font-weight: 600; color: #222; }
    hr { border: none; border-top: 1px solid #e0e0e0; margin: 2rem 0; }
    .back-nav { max-width: 800px; margin: 0 auto 1rem; }
    .back-nav a { color: #888; text-decoration: none; font-size: .9rem; }
    .back-nav a:hover { color: #333; }
  </style>
</head>
<body>
  ${coverUrl ? `<img class="cover" src="${coverUrl}" alt="">` : ''}
  <div class="page-wrap">
    <div class="back-nav"><a href="/">ПОЧЕТНА СТРАНА</a></div>
    <div class="container">${content}</div>
  </div>
</body>
</html>`;

export function renderPage(pageData) {
  const title = extractTitle(pageData.page);
  const coverUrl = extractCoverUrl(pageData.page, pageData.coverUrl);
  const html = md.render(blocksToMarkdown(pageData.blocks));
  return htmlTemplate(html, title, coverUrl);
}
