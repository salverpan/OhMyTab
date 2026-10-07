/**
 * RSSHub instance fallback registry + URL rewriting.
 *
 * Public RSSHub instances are unreliable (Cloudflare challenges, rate limits,
 * region blocks). If a request to a known RSSHub host fails, try the same
 * route against the other instances in priority order, falling back through
 * the list until one works.
 *
 * The first hit becomes the "live" URL for that feed — we return it so
 * callers can update the stored feed.url, which avoids retrying the dead
 * instance on every refresh.
 */

// Ordered by historical reliability (community-maintained public mirrors).
// User's chosen instance from settings is prepended at runtime.
const PUBLIC_RSSHUB_INSTANCES = [
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
  'https://rsshub.feeded.xyz',
  'https://rss.shab.fun',
  'https://rsshub.pseudoyu.com',
  'https://rsshub.beda.ink',
];

/**
 * Is this URL pointing at a known RSSHub instance (public or user-set)?
 * A URL is considered "RSSHub" if its host matches one in the known list
 * OR if it matches the user's configured instance host.
 */
export function isRsshubUrl(url, userInstance = '') {
  if (!url) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  const host = u.host.toLowerCase();
  const allHosts = new Set();
  for (const inst of PUBLIC_RSSHUB_INSTANCES) {
    try { allHosts.add(new URL(inst).host.toLowerCase()); } catch (_) {}
  }
  if (userInstance) {
    try { allHosts.add(new URL(userInstance).host.toLowerCase()); } catch (_) {}
  }
  return allHosts.has(host);
}

/**
 * Build the fallback list of full URLs for a given RSSHub feed URL.
 * Strategy:
 *   1. User instance first (if any and not already the host)
 *   2. The URL's current instance (so first attempt = caller's intent)
 *   3. All other public instances in priority order
 * De-duplicated, preserves the route path.
 */
export function buildRsshubFallbacks(url, userInstance = '') {
  let parsed;
  try { parsed = new URL(url); } catch { return [url]; }
  const route = parsed.pathname + parsed.search + parsed.hash;
  const currentBase = `${parsed.protocol}//${parsed.host}`;

  const order = [];
  if (userInstance) {
    const norm = userInstance.replace(/\/+$/, '');
    if (norm && !order.includes(norm)) order.push(norm);
  }
  if (!order.includes(currentBase)) order.push(currentBase);
  for (const inst of PUBLIC_RSSHUB_INSTANCES) {
    if (!order.includes(inst)) order.push(inst);
  }

  return order.map((base) => base + route);
}
