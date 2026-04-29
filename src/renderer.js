// Pure rendering — no API calls. Converts fetched page data to HTML.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import MarkdownIt from 'markdown-it';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateHtml = readFileSync(join(__dirname, 'template.html'), 'utf8');

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

function htmlTemplate(content, title, coverUrl) {
  const safeTitle = title || 'Notion Page';
  return templateHtml
    .replaceAll('{{title}}', safeTitle)
    .replace('{{ogImage}}', coverUrl ? `<meta property="og:image" content="${coverUrl}">` : '')
    .replace('{{cover}}', coverUrl ? `<img class="cover" src="${coverUrl}" alt="">` : '')
    .replace('{{content}}', content);
}

export function renderPage(pageData) {
  const title = extractTitle(pageData.page);
  const coverUrl = extractCoverUrl(pageData.page, pageData.coverUrl);
  const html = md.render(blocksToMarkdown(pageData.blocks));
  return htmlTemplate(html, title, coverUrl);
}
