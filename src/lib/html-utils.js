/* Shared HTML-to-text utility. Replaces 4 duplicate implementations:
   - translator.js#stripHtml
   - extractor.js#htmlToText
   - feed-parser.js#stripHtmlText
   - service-worker.js#stripHtmlForSW

   Works in SW, content-script, and sidepanel contexts (pure string ops). */

/**
 * Convert HTML to plain text.
 * @param {string} html
 * @param {object} opts
 * @param {boolean} opts.preserveNewlines - true (default): block tags + <br> -> \n,
 *   collapse only tabs/spaces, limit consecutive newlines to 2.
 *   false: collapse ALL whitespace to single space (single-line output).
 * @returns {string}
 */
export function htmlToText(html, opts = {}) {
  if (!html) return '';
  const preserveNewlines = opts.preserveNewlines !== false;
  let s = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '');

  if (preserveNewlines) {
    s = s
      .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
  } else {
    s = s.replace(/<[^>]+>/g, ' ');
  }

  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));

  if (preserveNewlines) {
    s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  } else {
    s = s.replace(/\s+/g, ' ').trim();
  }

  return s;
}
