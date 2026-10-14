/**
 * RSS-related tool handlers.
 *
 * Each handler takes (args) and returns a string result to be fed back to
 * the LLM as tool output. Structured responses use JSON.stringify so the
 * model can parse them robustly.
 *
 * transport(msg)：默认走 chrome.runtime.sendMessage（侧栏 → SW）。
 * SW 侧（浮动聊天执行器）注入直调自身 handler 的 transport，
 * 因为 SW 自发消息不会送达自己的 onMessage 监听器。
 */
import { putArtifact } from '../lib/artifact-store.js';
import { RSS_SCAN_PAGE, RSS_SCAN_MAX } from '../lib/limits.js';

async function defaultTransport(msg) {
  return await chrome.runtime.sendMessage(msg);
}

export async function listFeedsHandler(args, transport = defaultTransport) {
  const nameFilter = (args.name_contains || '').trim().toLowerCase();
  const sort = args.sort || 'default';
  const limit = Math.max(1, Math.min(Number(args.limit) || 100, 500));

  const feedResp = await transport({ type: 'FEED_LIST', data: {} });
  let feeds = (feedResp && feedResp.feeds) || [];
  if (nameFilter) {
    feeds = feeds.filter((f) => (f.title || '').toLowerCase().includes(nameFilter));
  }
  if (sort === 'title_asc') {
    feeds = [...feeds].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh'));
  }
  const total = feeds.length;
  feeds = feeds.slice(0, limit);

  return JSON.stringify({
    total_matched: total,
    returned: feeds.length,
    feeds: feeds.map((f) => ({
      id: f.id,
      title: f.title || '(no title)',
      url: f.url || '',
      total_count: f.totalCount || 0,
      last_fetched_at: f.lastFetchedAt ? new Date(f.lastFetchedAt).toISOString() : null,
      last_error: f.lastError || null,
    })),
  });
}

function parseYmd(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function resolveTargetFeeds(allFeeds, feedIdsArg, feedTitles) {
  if (feedIdsArg.length > 0) {
    const validIds = new Set(allFeeds.map((f) => f.id));
    const targetFeedIds = feedIdsArg.filter((id) => validIds.has(id));
    if (targetFeedIds.length === 0) {
      return { error: JSON.stringify({ error: 'all feed_ids unmatched', feed_ids_given: feedIdsArg }) };
    }
    return { targetFeedIds };
  }
  if (feedTitles.length > 0) {
    const lower = feedTitles.map((t) => t.trim().toLowerCase()).filter(Boolean);
    const matched = allFeeds.filter((f) => lower.some((needle) => (f.title || '').toLowerCase().includes(needle)));
    if (matched.length === 0) {
      return {
        error: JSON.stringify({
          error: 'no feed matched: ' + feedTitles.join(' / '),
          available_feed_count: allFeeds.length,
        }),
      };
    }
    return { targetFeedIds: matched.map((f) => f.id) };
  }
  return { targetFeedIds: null };
}

function utcDay(ts) {
  if (!ts) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

function postFilterVerdict(it, fromTs, toTs, collectedFilter) {
  const ts = it.publishedAt || 0;
  if (toTs !== null && ts > toTs) return 'skip';
  if (fromTs !== null && ts < fromTs) return 'before-window';
  if (collectedFilter === 'yes' && !it.collectedEntryId) return 'skip';
  if (collectedFilter === 'no' && it.collectedEntryId) return 'skip';
  return 'keep';
}

function truncationHint({ truncated, scanned, maxScan, totalMatched }) {
  if (truncated) {
    return `未穷尽：本次扫描 ${scanned} 条已达上限 ${maxScan}。total_matched=${totalMatched} 是下限，不是库总量。把 next_cursor 传入 cursor 继续扫，或收窄 date_from/date_to、feed_titles、关键词。`;
  }
  return `已穷尽当前过滤窗（扫描 ${scanned} 条）。`;
}

/**
 * Newest-first cursor scan. Stops when the date window's older bound is
 * crossed, the IDB page runs out, collectLimit is filled, or maxScan hits.
 */
async function scanFeedItems({
  transport,
  targetFeedIds,
  onlyStarred,
  searchQuery,
  searchAny,
  searchInFullText,
  fromTs,
  toTs,
  collectedFilter,
  startCursor,
  maxScan,
  pageSize,
  metaOnly,
  collectLimit,
  onKeep,
}) {
  let scanned = 0;
  let matched = 0;
  let beforePublishedAt = startCursor;
  let truncated = false;
  let windowExhausted = false;
  let nextCursor = null;
  let lastOldest = null;
  let filledCollect = false;

  while (scanned < maxScan) {
    const pageLimit = Math.min(pageSize, maxScan - scanned);
    const resp = await transport({
      type: 'FEED_ITEMS_LIST',
      data: {
        feedIds: targetFeedIds || undefined,
        limit: pageLimit,
        onlyStarred,
        searchQuery,
        searchAny,
        searchInFullText,
        beforePublishedAt,
        metaOnly: !!metaOnly,
      },
    });
    if (!resp || !resp.success) {
      return { error: resp?.error || 'query failed', scanned, matched, truncated: false, nextCursor: null, windowExhausted: false };
    }
    const page = resp.items || [];
    if (page.length === 0) {
      windowExhausted = true;
      break;
    }
    scanned += page.length;
    lastOldest = page[page.length - 1].publishedAt || 0;
    let stopPage = false;
    for (const it of page) {
      const verdict = postFilterVerdict(it, fromTs, toTs, collectedFilter);
      if (verdict === 'before-window') {
        windowExhausted = true;
        stopPage = true;
        break;
      }
      if (verdict !== 'keep') continue;
      matched += 1;
      if (onKeep) onKeep(it);
      if (collectLimit && matched >= collectLimit) {
        nextCursor = String(it.publishedAt || '');
        filledCollect = true;
        stopPage = true;
        break;
      }
    }
    if (stopPage) break;
    if (page.length < pageLimit) {
      windowExhausted = true;
      break;
    }
    if (beforePublishedAt != null && lastOldest >= beforePublishedAt) {
      truncated = true;
      nextCursor = String(lastOldest);
      break;
    }
    beforePublishedAt = lastOldest;
  }

  if (!windowExhausted && !filledCollect && scanned >= maxScan) {
    truncated = true;
    nextCursor = String(lastOldest || '');
  }
  return { scanned, matched, truncated, windowExhausted, nextCursor, filledCollect };
}

export async function queryFeedItemsHandler(args, transport = defaultTransport, scanOpts = {}) {
  const mode = args.mode || 'list';
  const queryAll = Array.isArray(args.query_all)
    ? args.query_all.filter(Boolean)
    : (args.query ? [args.query] : []);
  const queryAny = Array.isArray(args.query_any) ? args.query_any.filter(Boolean) : [];
  const feedTitles = Array.isArray(args.feed_titles)
    ? args.feed_titles.filter(Boolean)
    : (args.feed_title ? [args.feed_title] : []);
  const feedIdsArg = Array.isArray(args.feed_ids) ? args.feed_ids.filter(Boolean) : [];
  const onlyStarred = !!args.only_starred;
  const searchInFullText = !!args.search_in_fulltext;
  const collectedFilter = (args.collected || '').toLowerCase();
  const sinceDays = Number(args.since_days) || 0;
  const dateFrom = (args.date_from || '').trim();
  const dateTo = (args.date_to || '').trim();
  const sort = args.sort === 'oldest' ? 'oldest' : 'newest';
  const previewChars = Math.max(0, Math.min(Number(args.preview_chars ?? 500), 2000));
  const splitByFeed = !!args.split_by_feed;
  const modeLimitMax = mode === 'group_by_feed' ? 30 : 50;
  const limit = Math.max(1, Math.min(Number(args.limit) || 20, modeLimitMax));
  const maxScan = Number(scanOpts.maxScan) > 0
    ? Math.min(Number(scanOpts.maxScan), RSS_SCAN_MAX)
    : RSS_SCAN_MAX;

  const feedListResp = await transport({ type: 'FEED_LIST', data: {} });
  const allFeeds = (feedListResp && feedListResp.feeds) || [];
  const feedMap = new Map(allFeeds.map((f) => [f.id, f.title || '']));

  const resolved = resolveTargetFeeds(allFeeds, feedIdsArg, feedTitles);
  if (resolved.error) return resolved.error;
  const targetFeedIds = resolved.targetFeedIds;

  let fromTs = null;
  let toTs = null;
  if (dateFrom || dateTo) {
    if (dateFrom) fromTs = parseYmd(dateFrom);
    if (dateTo) {
      const t = parseYmd(dateTo);
      if (t !== null) toTs = t + 86400000 - 1;
    }
  } else if (sinceDays > 0) {
    fromTs = Date.now() - sinceDays * 86400000;
  }

  const backendQuery = queryAll.join(' ').trim();
  const backendAny = queryAny.join(' ').trim();
  const cursor = (args.cursor || '').trim();
  const startCursor = cursor ? (Number(cursor) || undefined) : undefined;
  const aggregate = mode === 'count' || mode === 'group_by_feed' || mode === 'by_day';

  const perFeed = {};
  const groups = new Map();
  const dayCounts = new Map();
  const listBuf = [];

  const onKeep = (it) => {
    if (mode === 'list') {
      listBuf.push(it);
      return;
    }
    const fid = it.feedId;
    const title = feedMap.get(fid) || '';
    if (!perFeed[fid]) perFeed[fid] = { feed_id: fid, feed_title: title, count: 0 };
    perFeed[fid].count += 1;
    if (mode === 'group_by_feed') {
      if (!groups.has(fid)) {
        groups.set(fid, { feed_id: fid, feed_title: title, count: 0, sample_titles: [] });
      }
      const g = groups.get(fid);
      g.count += 1;
      if (g.sample_titles.length < 5) g.sample_titles.push(it.title || '(no title)');
    }
    if (mode === 'by_day') {
      const day = utcDay(it.publishedAt) || 'unknown';
      const key = splitByFeed ? `${day}\t${fid}` : day;
      const rec = dayCounts.get(key) || (splitByFeed
        ? { date: day, feed_id: fid, feed_title: title, count: 0 }
        : { date: day, count: 0 });
      rec.count += 1;
      dayCounts.set(key, rec);
    }
  };

  const scan = await scanFeedItems({
    transport,
    targetFeedIds,
    onlyStarred,
    searchQuery: backendQuery,
    searchAny: backendAny,
    searchInFullText,
    fromTs,
    toTs,
    collectedFilter,
    startCursor,
    maxScan,
    pageSize: RSS_SCAN_PAGE,
    metaOnly: true,
    collectLimit: mode === 'list' ? limit : 0,
    onKeep,
  });
  if (scan.error) return JSON.stringify({ error: scan.error });

  const hint = truncationHint({
    truncated: scan.truncated,
    scanned: scan.scanned,
    maxScan,
    totalMatched: scan.matched,
  });

  if (mode === 'count') {
    return JSON.stringify({
      mode: 'count',
      total_matched: scan.matched,
      scanned: scan.scanned,
      truncated: scan.truncated,
      next_cursor: scan.truncated ? scan.nextCursor : null,
      per_feed: Object.values(perFeed).sort((a, b) => b.count - a.count),
      hint,
    });
  }

  if (mode === 'group_by_feed') {
    const groupsArr = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, limit);
    return JSON.stringify({
      mode: 'group_by_feed',
      total_matched: scan.matched,
      scanned: scan.scanned,
      truncated: scan.truncated,
      next_cursor: scan.truncated ? scan.nextCursor : null,
      returned_groups: groupsArr.length,
      groups: groupsArr,
      hint,
    });
  }

  if (mode === 'by_day') {
    const series = [...dayCounts.values()].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (b.count || 0) - (a.count || 0);
    });
    return JSON.stringify({
      mode: 'by_day',
      total_matched: scan.matched,
      scanned: scan.scanned,
      truncated: scan.truncated,
      next_cursor: scan.truncated ? scan.nextCursor : null,
      split_by_feed: splitByFeed,
      series,
      hint,
    });
  }

  let items = listBuf;
  if (sort === 'oldest') items = [...items].sort((a, b) => (a.publishedAt || 0) - (b.publishedAt || 0));
  const returned = items.slice(0, limit);
  const hasMore = scan.filledCollect || scan.truncated || (sort === 'oldest' && items.length > limit);
  const nextCursor = hasMore && returned.length > 0
    ? String(returned[returned.length - 1].publishedAt || '')
    : null;

  return JSON.stringify({
    mode: 'list',
    total_matched: scan.matched,
    returned: returned.length,
    has_more: hasMore,
    next_cursor: nextCursor,
    scanned: scan.scanned,
    truncated: scan.truncated,
    hint: scan.truncated ? hint : undefined,
    items: returned.map((it) => {
      const obj = {
        id: it.id,
        title: it.title || '(no title)',
        feed_id: it.feedId,
        feed_title: feedMap.get(it.feedId) || '',
        link: it.link || '',
        published_at: it.publishedAt ? new Date(it.publishedAt).toISOString() : null,
        starred: !!it.starred,
        in_library: !!it.collectedEntryId,
        has_full_text: !!it.hasFullText,
      };
      if (previewChars > 0 && it.summary) {
        obj.summary_preview = it.summary.replace(/\s+/g, ' ').slice(0, previewChars);
        if (it.summary.length > previewChars) obj.summary_truncated = true;
      }
      return obj;
    }),
  });
}

// __FETCH_HANDLERS_HERE__
export async function fetchFeedItemHandler(args, transport = defaultTransport) {
  const itemId = (args.item_id || '').trim();
  if (!itemId) return 'error: missing item_id';
  let getResp = await transport({ type: 'FEED_ITEM_GET', data: { itemId } });
  let item = getResp && getResp.item;
  if (!item) return 'not found: ' + itemId.slice(0, 8) + '...';
  if (!item.hasFullText || !item.fullText) {
    const fullResp = await transport({
      type: 'FEED_ITEM_FETCH_FULL',
      data: { itemId, force: false },
    });
    if (fullResp && fullResp.item) item = fullResp.item;
  }
  const text = item.fullText || item.originalSummary || item.summary || '(no content)';
  return '[' + (item.title || '(no title)') + ']\nlink=' + (item.link || '') + '\n' + text;
}

export async function fetchFeedItemsHandler(args, transport = defaultTransport, ctx = {}) {
  const ids = Array.isArray(args.item_ids) ? args.item_ids.filter(Boolean).slice(0, 15) : [];
  if (ids.length === 0) return JSON.stringify({ error: 'missing item_ids' });

  const feedListResp = await transport({ type: 'FEED_LIST', data: {} });
  const feedMap = new Map(((feedListResp && feedListResp.feeds) || []).map((f) => [f.id, f.title || '']));

  const items = [];
  const errors = [];
  for (const itemId of ids) {
    try {
      let getResp = await transport({ type: 'FEED_ITEM_GET', data: { itemId } });
      let item = getResp && getResp.item;
      if (!item) { errors.push({ item_id: itemId, error: 'not found' }); continue; }
      if (!item.hasFullText || !item.fullText) {
        const fullResp = await transport({
          type: 'FEED_ITEM_FETCH_FULL',
          data: { itemId, force: false },
        });
        if (fullResp && fullResp.item) item = fullResp.item;
      }
      // 写入工作区的是证据：优先原文，翻译后的 summary 只作最后兜底。
      const rawText = item.fullText || item.originalSummary || item.summary || '';
      const rec = {
        id: item.id,
        title: item.title || '(no title)',
        link: item.link || '',
        feed_title: feedMap.get(item.feedId) || '',
        published_at: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
        chars: rawText.length,
        has_full_text: !!item.hasFullText,
      };
      if (rawText) {
        try {
          const res = await putArtifact({
            kind: 'page',
            url: item.link || `feed-item://${item.id}`,
            title: item.title || '',
            text: rawText,
            meta: {
              via: 'ingest',
              origin: (ctx && ctx.subagentKind) || 'main',
              projectId: (ctx && ctx.projectId) || '',
              provenanceType: 'rss',
              trustClass: 'source',
              capturedAt: Number(item.publishedAt) || Date.now(),
            },
          });
          if (res && res.docId) {
            rec.doc_id = res.docId;
            rec.chunks = res.chunks;
            rec.reused = !!res.reused;
          } else if (res && res.error) {
            rec.error = res.error;
          }
        } catch (err) {
          rec.error = err.message || String(err);
        }
      }
      items.push(rec);
    } catch (err) {
      errors.push({ item_id: itemId, error: err.message || String(err) });
    }
  }
  return JSON.stringify({
    items,
    errors,
    hint: '正文已写入工作区。用 read_section(doc_id) 按需回读，不要把未读全文凭空补全。',
  });
}

export async function refreshFeedsHandler(args, transport = defaultTransport) {
  const feedTitles = Array.isArray(args.feed_titles)
    ? args.feed_titles.filter(Boolean)
    : (args.feed_title ? [args.feed_title] : []);
  const feedIdsArg = Array.isArray(args.feed_ids) ? args.feed_ids.filter(Boolean) : [];

  const feedListResp = await transport({ type: 'FEED_LIST', data: {} });
  const allFeeds = (feedListResp && feedListResp.feeds) || [];
  const feedMap = new Map(allFeeds.map((f) => [f.id, f.title || '']));

  let data = { scope: 'current' };
  if (feedIdsArg.length > 0 || feedTitles.length > 0) {
    const resolved = resolveTargetFeeds(allFeeds, feedIdsArg, feedTitles);
    if (resolved.error) return resolved.error;
    data = { feedIds: resolved.targetFeedIds };
  }

  const resp = await transport({ type: 'FEED_REFRESH_ALL', data });
  if (!resp || !resp.success) {
    return JSON.stringify({ error: (resp && resp.error) || 'refresh failed' });
  }
  const results = (resp.results || []).map((r) => ({
    feed_id: r.feedId,
    feed_title: feedMap.get(r.feedId) || '',
    ok: !!r.ok,
    inserted: r.inserted || 0,
    skipped: r.skipped || 0,
    not_modified: !!r.notModified,
    error: r.error || null,
  }));
  const failed = results.filter((r) => !r.ok);
  return JSON.stringify({
    refreshed: results.length,
    inserted: resp.inserted || results.reduce((s, r) => s + r.inserted, 0),
    errors: resp.errors ?? failed.length,
    feeds: results,
    hint: failed.length
      ? '部分源刷新失败，见 feeds[].error。成功插入的条目已进订阅库，用 query_feed_items 检索。'
      : '刷新完成。新条目已进订阅库，用 query_feed_items 检索；不要把「刚刷新」当成已经读过正文。',
  });
}
