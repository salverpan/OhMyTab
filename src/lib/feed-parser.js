/**
 * Feed format parser - RSS 2.0 / Atom 1.0 / RDF / OPML.
 * Uses fast-xml-parser; works in both window and service-worker contexts.
 */

import { XMLParser } from 'fast-xml-parser';
import { htmlToText } from './html-utils.js';

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  cdataPropName: '__cdata',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: false,
  isArray: (name) => ['item', 'entry', 'outline', 'link'].includes(name),
};

const parser = new XMLParser(PARSER_OPTIONS);

/* ---------- XML pre-cleaning ---------- */

function normalizeXml(text) {
  if (typeof text !== 'string') return '';
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  text = text.replace(/^\s+/, '');
  const firstLt = text.indexOf('<');
  if (firstLt > 0) text = text.slice(firstLt);
  text = text.replace(/<[^>]*>/g, (tag) =>
    tag
      .replace(/[\u201C\u201D\u2033]/g, '"')
      .replace(/[\u2018\u2019\u2032]/g, "'")
      .replace(/\uFF1A/g, ':')
      .replace(/\uFF01/g, '!')
      .replace(/\uFF1D/g, '=')
      .replace(/\uFF1C/g, '<')
      .replace(/\uFF1E/g, '>')
      .replace(/\uFF0F/g, '/')
  );
  return text;
}

/* ---------- Node helpers ---------- */

function nodeText(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).filter(Boolean).join(' ').trim();
  if (typeof node === 'object') {
    if (node.__cdata != null) {
      if (Array.isArray(node.__cdata)) return node.__cdata.join('').trim();
      return String(node.__cdata).trim();
    }
    if (node['#text'] != null) return String(node['#text']).trim();
  }
  return '';
}

function nodeAttr(node, attr) {
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node)) {
    for (const n of node) {
      const v = nodeAttr(n, attr);
      if (v) return v;
    }
    return '';
  }
  return node['@_' + attr] || '';
}

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/* ---------- Date parsing ---------- */

const MONTHS = {
  jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
  jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
};

function parseDate(str) {
  if (!str) return NaN;
  const s = String(str).trim();

  // V8's Date() correctly parses RFC 2822 (RSS pubDate, e.g.
  // "Tue, 23 Jun 2026 23:42:04 +0800") and ISO 8601 (Atom), including the
  // timezone offset. Try it first so the timezone math is handled by the
  // engine and we don't get the sign wrong.
  const native = new Date(s);
  if (!isNaN(native.getTime())) return native.getTime();

  // Fallback: manual RFC 822 regex for malformed inputs Date() rejects.
  let m = s.match(/^(?:\w{3},\s+)?(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:([+-]\d{4}|GMT|UTC|EST|EDT|CST|CDT|MST|MDT|PST|PDT))?/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo !== undefined) {
      // Build the instant in UTC, then subtract the offset to convert local
      // time to UTC. ("+0800" means local is 8h ahead of UTC, so the UTC
      // instant is 8h earlier.)
      const d = new Date(Date.UTC(+m[3], mo, +m[1], +m[4], +m[5], +m[6] || 0));
      if (m[7] && /^[+-]\d{4}$/.test(m[7])) {
        const sign = m[7][0] === '-' ? -1 : 1;
        const hrs = +m[7].slice(1, 3);
        const min = +m[7].slice(3);
        d.setMinutes(d.getMinutes() - sign * (hrs * 60 + min));
      }
      if (!isNaN(d.getTime())) return d.getTime();
    }
  }

  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  m = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  return NaN;
}

/* ---------- RSS 2.0 ---------- */

function parseRSS(rss) {
  const channel = rss.channel;
  if (!channel) throw new Error('RSS: missing <channel>');
  const imageNode = channel.image;
  const image = imageNode
    ? (typeof imageNode === 'string' ? imageNode : nodeText(imageNode.url) || nodeText(imageNode))
    : '';
  const feed = {
    title: nodeText(channel.title),
    description: nodeText(channel.description),
    link: nodeText(channel.link),
    siteUrl: nodeText(channel.link),
    language: nodeText(channel.language),
    image,
    items: [],
  };
  for (const item of asArray(channel.item)) {
    feed.items.push({
      guid: nodeText(item.guid) || nodeText(item.link),
      link: nodeText(item.link),
      title: nodeText(item.title),
      author: nodeText(item.author) || nodeText(item['dc:creator']),
      publishedAt: parseDate(nodeText(item.pubDate) || nodeText(item['dc:date'])),
      summary: htmlToText(nodeText(item.description), { preserveNewlines: false }),
      contentHtml: nodeText(item['content:encoded']) || nodeText(item.description) || '',
    });
  }
  return feed;
}

/* ---------- Atom 1.0 ---------- */

function parseAtom(atom) {
  const feed = {
    title: nodeText(atom.title),
    description: nodeText(atom.subtitle) || nodeText(atom.tagline) || '',
    link: '',
    siteUrl: '',
    language: nodeAttr(atom, 'xml:lang'),
    image: nodeText(atom.logo) || nodeText(atom.icon) || '',
    items: [],
  };
  for (const linkNode of asArray(atom.link)) {
    const rel = nodeAttr(linkNode, 'rel') || 'alternate';
    const href = nodeAttr(linkNode, 'href');
    if (rel === 'alternate' && !feed.link) feed.link = href;
    if (!feed.siteUrl && href) feed.siteUrl = href;
  }
  for (const entry of asArray(atom.entry)) {
    const guid = nodeText(entry.id);
    let link = '';
    for (const linkNode of asArray(entry.link)) {
      const rel = nodeAttr(linkNode, 'rel') || 'alternate';
      const href = nodeAttr(linkNode, 'href');
      if (rel === 'alternate' && href) { link = href; break; }
    }
    const published = parseDate(nodeText(entry.published) || nodeText(entry.issued));
    const updated = parseDate(nodeText(entry.updated));
    const contentHtml = nodeText(entry.content) || '';
    const summaryRaw = nodeText(entry.summary) || '';
    const summary = htmlToText(summaryRaw || contentHtml, { preserveNewlines: false });
    let author = '';
    if (entry.author) {
      const a = Array.isArray(entry.author) ? entry.author[0] : entry.author;
      if (typeof a === 'string') author = a.trim();
      else if (a && typeof a === 'object') author = nodeText(a.name) || nodeText(a);
    }
    feed.items.push({
      guid,
      link: link || guid,
      title: nodeText(entry.title),
      author,
      publishedAt: isNaN(published) ? (isNaN(updated) ? NaN : updated) : published,
      summary,
      contentHtml: contentHtml || summaryRaw || '',
    });
  }
  return feed;
}

/* ---------- RDF / RSS 1.0 ---------- */

function parseRDF(rdf) {
  const channel = rdf.channel || {};
  const feed = {
    title: nodeText(channel.title),
    description: nodeText(channel.description),
    link: nodeText(channel.link),
    siteUrl: nodeText(channel.link),
    language: '',
    image: '',
    items: [],
  };
  for (const item of asArray(rdf.item)) {
    const link = nodeText(item.link);
    feed.items.push({
      guid: link,
      link,
      title: nodeText(item.title),
      author: nodeText(item['dc:creator']) || '',
      publishedAt: parseDate(nodeText(item['dc:date'])),
      summary: htmlToText(nodeText(item.description), { preserveNewlines: false }),
      contentHtml: nodeText(item['content:encoded']) || nodeText(item.description) || '',
    });
  }
  return feed;
}

/* ---------- Public API ---------- */

export function parseFeed(xmlText) {
  const parsed = parser.parse(normalizeXml(xmlText));
  if (!parsed) throw new Error('Empty XML');
  const root = parsed.rss || parsed.feed || parsed['rdf:RDF'] || parsed['rdf:Rdf'] || parsed.rdf;
  if (!root) {
    if (parsed['?xml']) throw new Error('XML declaration found but no recognized feed root element');
    throw new Error('Unrecognized feed format');
  }
  if (parsed.rss) return parseRSS(root);
  if (parsed.feed) return parseAtom(root);
  return parseRDF(root);
}

export function parseOPML(xmlText) {
  const parsed = parser.parse(normalizeXml(xmlText));
  if (!parsed || !parsed.opml) throw new Error('Not OPML');
  const body = parsed.opml.body || {};
  const feeds = [];
  walkOPML(body, '', feeds);
  return feeds;
}

function walkOPML(parent, cat, out) {
  if (!parent) return;
  for (const child of asArray(parent.outline)) {
    if (typeof child === 'string') continue;
    const xmlUrl = nodeAttr(child, 'xmlUrl');
    const title = nodeAttr(child, 'title') || nodeAttr(child, 'text');
    const htmlUrl = nodeAttr(child, 'htmlUrl');
    if (xmlUrl) {
      out.push({ title: title || xmlUrl, url: xmlUrl, siteUrl: htmlUrl, category: cat });
    } else {
      walkOPML(child, title || cat, out);
    }
  }
}
