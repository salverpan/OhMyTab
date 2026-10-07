/* RSS 工具冒烟：刷新、count 穷尽/truncated、by_day。不碰 chrome.* / IndexedDB。 */

import assert from 'node:assert';
import {
  listFeedsHandler, queryFeedItemsHandler, refreshFeedsHandler,
} from '../src/sidepanel/rss-tools.js';

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}

const FEEDS = [
  { id: 'fa', title: 'Alpha News', url: 'https://a.example/rss', totalCount: 10, lastFetchedAt: Date.UTC(2026, 0, 1, 8), lastError: null },
  { id: 'fb', title: 'Beta Wire', url: 'https://b.example/rss', totalCount: 10, lastFetchedAt: Date.UTC(2026, 0, 2, 8), lastError: 'timeout' },
];

function makeItems(n) {
  const t0 = Date.UTC(2026, 0, 1);
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push({
      id: 'i' + i,
      feedId: i % 2 ? 'fa' : 'fb',
      publishedAt: t0 + i * 86400000,
      title: 't' + i,
      starred: false,
      collectedEntryId: i === 0 ? 'e1' : null,
      hasFullText: true,
      summary: 's' + i,
    });
  }
  items.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  return items;
}

function paginate(all, before, limit) {
  const filtered = before != null ? all.filter((it) => (it.publishedAt || 0) < before) : all;
  return filtered.slice(0, limit);
}

function makeTransport(allItems, refreshImpl) {
  return async function transport(msg) {
    if (msg.type === 'FEED_LIST') return { feeds: FEEDS };
    if (msg.type === 'FEED_ITEMS_LIST') {
      const { feedIds, beforePublishedAt, limit, metaOnly } = msg.data || {};
      let pool = allItems;
      if (Array.isArray(feedIds) && feedIds.length) {
        const allow = new Set(feedIds);
        pool = pool.filter((it) => allow.has(it.feedId));
      }
      const page = paginate(pool, beforePublishedAt, limit || 80);
      const items = metaOnly
        ? page.map((it) => ({
          id: it.id,
          feedId: it.feedId,
          publishedAt: it.publishedAt,
          title: it.title,
          starred: it.starred,
          collectedEntryId: it.collectedEntryId,
          hasFullText: it.hasFullText,
          summary: it.summary,
        }))
        : page;
      return { success: true, items };
    }
    if (msg.type === 'FEED_REFRESH_ALL') {
      if (refreshImpl) return refreshImpl(msg);
      const ids = (msg.data && msg.data.feedIds) || FEEDS.map((f) => f.id);
      return {
        success: true,
        inserted: ids.length,
        errors: 0,
        total: ids.length,
        results: ids.map((id) => ({ feedId: id, ok: true, inserted: 1, skipped: 0, notModified: false })),
      };
    }
    return { success: false, error: 'unknown ' + msg.type };
  };
}

const items20 = makeItems(20);
const t = makeTransport(items20);

const listed = JSON.parse(await listFeedsHandler({}, t));
ok(listed.feeds.length === 2 && listed.feeds[0].last_fetched_at, 'list_feeds 含 last_fetched_at');

const countAll = JSON.parse(await queryFeedItemsHandler({ mode: 'count' }, t, { maxScan: 100 }));
ok(countAll.mode === 'count' && countAll.total_matched === 20 && countAll.truncated === false, 'count 穷尽全库');
ok(/已穷尽/.test(countAll.hint) && countAll.next_cursor == null, 'count 穷尽 hint');

const countTrunc = JSON.parse(await queryFeedItemsHandler({ mode: 'count' }, t, { maxScan: 5 }));
ok(countTrunc.truncated === true && countTrunc.total_matched === 5 && countTrunc.next_cursor, 'count 触顶 truncated');
ok(/未穷尽/.test(countTrunc.hint), 'truncated 中文 hint');

const continued = JSON.parse(await queryFeedItemsHandler(
  { mode: 'count', cursor: countTrunc.next_cursor },
  t,
  { maxScan: 100 },
));
ok(continued.truncated === false && continued.total_matched === 15, 'truncated 后 cursor 续扫剩余');

const windowed = JSON.parse(await queryFeedItemsHandler({
  mode: 'count',
  date_from: '2026-01-10',
  date_to: '2026-01-12',
}, t, { maxScan: 100 }));
ok(windowed.total_matched === 3 && windowed.truncated === false, 'count 时间窗穷尽（不是扫描上限）');

const byDay = JSON.parse(await queryFeedItemsHandler({
  mode: 'by_day',
  date_from: '2026-01-10',
  date_to: '2026-01-12',
}, t, { maxScan: 100 }));
ok(byDay.mode === 'by_day' && byDay.series.length === 3, 'by_day 稀疏三日');
ok(byDay.series[0].date === '2026-01-10' && byDay.series[0].count === 1, 'by_day UTC 日期升序');

const byFeed = JSON.parse(await queryFeedItemsHandler({
  mode: 'by_day',
  split_by_feed: true,
  date_from: '2026-01-10',
  date_to: '2026-01-12',
}, t, { maxScan: 100 }));
ok(byFeed.series.every((r) => r.feed_title && r.date && r.count === 1), 'by_day split_by_feed');

const listedItems = JSON.parse(await queryFeedItemsHandler({
  mode: 'list',
  date_from: '2026-01-10',
  date_to: '2026-01-12',
  limit: 2,
}, t, { maxScan: 100 }));
ok(listedItems.returned === 2 && listedItems.has_more === true && listedItems.items[0].summary_preview, 'list 时间窗分页且有摘要');

const refreshed = JSON.parse(await refreshFeedsHandler({ feed_titles: ['Alpha'] }, t));
ok(refreshed.refreshed === 1 && refreshed.feeds[0].feed_id === 'fa' && refreshed.inserted === 1, 'refresh_feeds 按标题过滤');

const refreshAll = JSON.parse(await refreshFeedsHandler({}, t));
ok(refreshAll.refreshed === 2 && /query_feed_items/.test(refreshAll.hint), 'refresh_feeds 省略则刷全部');

console.log(`rss-tools-smoke: ${passed} passed`);
