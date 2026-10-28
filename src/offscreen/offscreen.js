/**
 * Offscreen DOM parser for webpage feeds. It receives already-fetched HTML,
 * parses it into an inert document and runs the same selector extractor used
 * by the visual picker. No network access or page scripts happen here.
 */

import { extractWebFeedItems } from '../lib/webfeed.js';
import { htmlWithoutInlineHandlers } from './sanitize-html.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'WEBFEED_PARSE_HTML') return false;
  try {
    // Strip on* attributes first. The offscreen document's CSP (script-src
    // 'self') blocks inline handlers while DOMParser is building the tree.
    const doc = new DOMParser().parseFromString(htmlWithoutInlineHandlers(msg.html), 'text/html');
    const result = extractWebFeedItems(msg.recipe, doc, {
      maxItems: msg.maxItems || 200,
      includeHidden: true,
    });
    sendResponse(result);
  } catch (err) {
    sendResponse({
      ok: false,
      error: (err && err.message) || String(err),
      items: [],
      matched: 0,
      warnings: [],
    });
  }
  return false;
});
