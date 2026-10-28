/**
 * Extension pages (including the offscreen document) ship with
 * script-src 'self'. DOMParser still compiles on* attributes from fetched
 * markup, and Chrome then reports:
 *   "Executing inline event handler violates the following Content Security
 *    Policy directive 'script-src 'self''".
 * Webpage-feed extraction only needs structure, text, and URLs, so drop those
 * attributes before parsing. Quoted values are left intact, including URLs
 * that merely contain the letters "onerror=".
 */

function endOfTag(src, lt) {
  let quote = '';
  for (let j = lt + 1; j < src.length; j += 1) {
    const ch = src[j];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '>') return j + 1;
  }
  return src.length;
}

function stripHandlers(tag) {
  const second = tag.charCodeAt(1);
  if (second === 33 || second === 63) return tag; // <! ...> or <? ...>
  const handler = /^(?:[\s/]+)on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s"'=<>`]+)/i;
  let out = '';
  let i = 0;
  while (i < tag.length) {
    const ch = tag[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = tag.indexOf(ch, i + 1);
      const stop = end < 0 ? tag.length : end + 1;
      out += tag.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '/') {
      const match = handler.exec(tag.slice(i));
      if (match) {
        i += match[0].length;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

export function htmlWithoutInlineHandlers(html) {
  const src = String(html || '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, lt);
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      const stop = end < 0 ? src.length : end + 3;
      out += src.slice(lt, stop);
      i = stop;
      continue;
    }
    const stop = endOfTag(src, lt);
    out += stripHandlers(src.slice(lt, stop));
    i = stop;
  }
  return out;
}
