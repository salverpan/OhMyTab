/**
 * IndexedDB layer for RSS/Atom subscriptions.
 *
 * Two object stores:
 *   feeds — one record per subscribed source
 *   items — one record per feed entry (article)
 *
 * Item id = sha1(feedId + (guid || link)) so re-fetches dedupe naturally.
 *
 * All public functions return Promises; callers should not need to know
 * about IDB transaction internals.
 */

const DB_NAME = 'citecat-feeds';
const DB_VERSION = 3;
const STORE_FEEDS = 'feeds';
const STORE_ITEMS = 'items';
const STORE_TOKENS = 'itemTokens'; // 2-gram 倒排索引：{token, seq, publishedAt}
const STORE_SEQPUB = 'seqPub';     // 紧凑排序表：{seq, publishedAt, itemId}
const INDEX_BUILT_KEY = 'feedIndexBuilt'; // chrome.storage.local 标志：索引是否构建完成

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onblocked = () => {
      // versionchange 被其他连接阻塞：重置 promise 允许下次重试，
      // 避免永久卡在旧版本导致 itemTokens/seqPub 不存在、构建全失败。
      dbPromise = null;
      reject(new Error('IndexedDB blocked by another connection'));
    };
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (event.oldVersion < 1) {
        const feeds = db.createObjectStore(STORE_FEEDS, { keyPath: 'id' });
        feeds.createIndex('url', 'url', { unique: true });
        feeds.createIndex('scope', 'scope', { unique: false });
        feeds.createIndex('sortOrder', 'sortOrder', { unique: false });

        const items = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        items.createIndex('feedId', 'feedId', { unique: false });
        items.createIndex('feedId_publishedAt', ['feedId', 'publishedAt'], { unique: false });
        items.createIndex('read', 'read', { unique: false });
        items.createIndex('starred', 'starred', { unique: false });
      }
      if (event.oldVersion < 2) {
        // v2: add publishedAt single-field index for fast "All feeds" timeline queries.
        // IDB skips records whose indexed key is undefined/null, so first
        // backfill missing publishedAt from createdAt/Date.now() to make sure
        // every item is reachable from the "All" view.
        const itemsStore = req.transaction.objectStore(STORE_ITEMS);
        if (!itemsStore.indexNames.contains('publishedAt')) {
          itemsStore.createIndex('publishedAt', 'publishedAt', { unique: false });
        }
        const cursorReq = itemsStore.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const v = cursor.value;
          if (typeof v.publishedAt !== 'number' || !isFinite(v.publishedAt) || v.publishedAt <= 0) {
            v.publishedAt = (typeof v.createdAt === 'number' && v.createdAt > 0) ? v.createdAt : Date.now();
            cursor.update(v);
          }
          cursor.continue();
        };
      }
      if (event.oldVersion < 3) {
        // v3: 2-gram 倒排索引结构。items 表新增自增 seq 字段（紧凑 docId），
        // 新建 itemTokens（倒排）+ seqPub（seq->publishedAt 紧凑排序表）。
        // 索引数据不在迁移里构建（十万/百万级会阻塞升级），只建结构 +
        // 回填 seq，由 SW 启动后异步 buildTokenIndex 分批构建。
        const itemsStore = req.transaction.objectStore(STORE_ITEMS);
        if (!db.objectStoreNames.contains(STORE_TOKENS)) {
          const tokens = db.createObjectStore(STORE_TOKENS, { keyPath: ['token', 'seq'] });
          tokens.createIndex('token', 'token', { unique: false });
          tokens.createIndex('seq', 'seq', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SEQPUB)) {
          const seqPub = db.createObjectStore(STORE_SEQPUB, { keyPath: 'seq' });
          seqPub.createIndex('publishedAt', 'publishedAt', { unique: false });
        }
        // 回填 items.seq：自增整数，按游标顺序赋值（0,1,2...）
        let seqCounter = 0;
        const seqCursorReq = itemsStore.openCursor();
        seqCursorReq.onsuccess = () => {
          const cursor = seqCursorReq.result;
          if (!cursor) return;
          const v = cursor.value;
          if (typeof v.seq !== 'number') {
            v.seq = seqCounter++;
            cursor.update(v);
          } else {
            seqCounter = v.seq + 1;
          }
          cursor.continue();
        };
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
  });
  return dbPromise;
}

function tx(storeNames, mode = 'readonly') {
  return openDB().then((db) => {
    const transaction = db.transaction(storeNames, mode);
    return {
      transaction,
      stores: Array.isArray(storeNames)
        ? Object.fromEntries(storeNames.map((n) => [n, transaction.objectStore(n)]))
        : { [storeNames]: transaction.objectStore(storeNames) },
      done: new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('transaction aborted'));
      }),
    };
  });
}

function req2promise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- Hash (sha1) for stable item ids ---------- */

const sha1Hex = async (str) => {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export async function makeItemId(feedId, guid, link) {
  const key = `${feedId}::${guid || link || ''}`;
  return sha1Hex(key);
}

/* ======== 2-gram 倒排索引：分词 + 读写 ======== */

/**
 * 字符级 2-gram 分词。中文每 2 字一个 token，英文单词内 2-gram，
 * 天然支持子串匹配（搜"经济"命中"经济学人"）。
 * 单字符字段直接用该字符作 token。返回去重后的 token 数组。
 */
export function tokenize2gram(text) {
  if (!text) return [];
  const s = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const tokens = new Set();
  if (s.length === 1) {
    tokens.add(s);
    return [...tokens];
  }
  for (let i = 0; i < s.length - 1; i++) {
    // 跳过跨空格的 2-gram（空格边界处不切，避免 "a b" 产生 "a "）
    if (s[i] === ' ' || s[i + 1] === ' ') continue;
    tokens.add(s.slice(i, i + 2));
  }
  return [...tokens];
}

/** 搜索字段的 2-gram 合集（与 buildHay 的 5 字段一致） */
function tokensOfItem(item) {
  const fields = [item.title, item.summary, item.author, item.originalTitle, item.originalSummary];
  const all = new Set();
  for (const f of fields) {
    if (!f) continue;
    for (const t of tokenize2gram(f)) all.add(t);
  }
  return all;
}

/** 索引构建状态：读取 indexBuilt 标志（chrome.storage.local） */
export async function isIndexBuilt() {
  try {
    const { [INDEX_BUILT_KEY]: v } = await chrome.storage.local.get(INDEX_BUILT_KEY);
    return v === true;
  } catch (_) {
    return false;
  }
}

async function setIndexBuilt(v) {
  try { await chrome.storage.local.set({ [INDEX_BUILT_KEY]: v }); } catch (_) {}
}

/**
 * 写入单个 item 的倒排索引（itemTokens + seqPub）。
 * @param {IDBObjectStore} tokensStore  itemTokens store（事务内引用）
 * @param {IDBObjectStore} seqPubStore  seqPub store（事务内引用）
 * @param {object} item  含 seq/publishedAt/id + 5 搜索字段
 */
function indexItemTokens(tokensStore, seqPubStore, item) {
  const seq = item.seq;
  if (typeof seq !== 'number') return;
  const tokens = tokensOfItem(item);
  for (const token of tokens) {
    tokensStore.put({ token, seq, publishedAt: item.publishedAt || 0 });
  }
  seqPubStore.put({ seq, publishedAt: item.publishedAt || 0, itemId: item.id });
}

/**
 * 删除某个 seq 对应的所有 token 记录（更新/删除 item 前清理）。
 * 用 seq 索引游标删除。
 */
function deleteItemTokensBySeq(tokensStore, seq) {
  return new Promise((resolve, reject) => {
    const idx = tokensStore.index('seq');
    const req = idx.openCursor(IDBKeyRange.only(seq));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(); return; }
      cursor.delete();
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 重新索引单个 item：先删旧 token，再写新 token + seqPub。
 * 在调用方的事务里执行（传入 stores）。
 */
async function reindexItemInTx(tokensStore, seqPubStore, item) {
  if (typeof item.seq !== 'number') return;
  await deleteItemTokensBySeq(tokensStore, item.seq);
  indexItemTokens(tokensStore, seqPubStore, item);
}

/** 判断 item 的 5 搜索字段是否与旧值不同（决定 merge 项是否需要重建索引） */
function searchFieldsChanged(prev, next) {
  return prev.title !== next.title || prev.summary !== next.summary ||
    prev.author !== next.author || prev.originalTitle !== next.originalTitle ||
    prev.originalSummary !== next.originalSummary;
}

/* ======== Feeds ======== */

export async function listFeeds() {
  const { stores, done } = await tx(STORE_FEEDS);
  const all = await req2promise(stores[STORE_FEEDS].getAll());
  await done;
  return all.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.title.localeCompare(b.title));
}

export async function listFeedsForProject(projectId) {
  const all = await listFeeds();
  return all.filter((f) => f.scope === 'global' || f.scope === projectId);
}

export async function getFeed(id) {
  const { stores, done } = await tx(STORE_FEEDS);
  const feed = await req2promise(stores[STORE_FEEDS].get(id));
  await done;
  return feed || null;
}

export async function getFeedByUrl(url) {
  const { stores, done } = await tx(STORE_FEEDS);
  const feed = await req2promise(stores[STORE_FEEDS].index('url').get(url));
  await done;
  return feed || null;
}

export async function addFeed(partial) {
  const existing = await getFeedByUrl(partial.url);
  if (existing) {
    throw new Error('该订阅源已存在');
  }
  const now = Date.now();
  const feed = {
    id: crypto.randomUUID(),
    url: partial.url,
    kind: partial.kind === 'webpage' ? 'webpage' : 'rss',
    recipe: partial.recipe || null,
    refreshMode: partial.kind === 'webpage' && ['auto', 'http', 'tab'].includes(partial.refreshMode)
      ? partial.refreshMode
      : (partial.kind === 'webpage' ? 'auto' : ''),
    lastTransport: '',
    title: partial.title || partial.url,
    siteUrl: partial.siteUrl || '',
    faviconUrl: partial.faviconUrl || '',
    description: partial.description || '',
    scope: partial.scope || 'global',
    intervalMin: partial.intervalMin || 0,
    maxItems: partial.maxItems ?? null,     // null = use global default
    fetchFrom: partial.fetchFrom ?? null,   // YYYY-MM-DD or null
    fetchTo: partial.fetchTo ?? null,
    autoTranslate: partial.autoTranslate ?? null, // null = use global default; true/false override
    lastFetchedAt: 0,
    lastSuccessAt: 0,
    lastError: '',
    etag: '',
    lastModified: '',
    totalCount: 0,
    sortOrder: partial.sortOrder ?? now,
    createdAt: now,
  };
  const { stores, done } = await tx(STORE_FEEDS, 'readwrite');
  await req2promise(stores[STORE_FEEDS].add(feed));
  await done;
  return feed;
}

export async function updateFeed(id, updates) {
  const { stores, done } = await tx(STORE_FEEDS, 'readwrite');
  const current = await req2promise(stores[STORE_FEEDS].get(id));
  if (!current) { await done; return null; }
  const next = { ...current, ...updates };
  await req2promise(stores[STORE_FEEDS].put(next));
  await done;
  return next;
}

export async function deleteFeed(id) {
  const { stores, done } = await tx([STORE_FEEDS, STORE_ITEMS, STORE_TOKENS, STORE_SEQPUB], 'readwrite');
  await req2promise(stores[STORE_FEEDS].delete(id));

  const itemsStore = stores[STORE_ITEMS];
  const tokensStore = stores[STORE_TOKENS];
  const seqPubStore = stores[STORE_SEQPUB];
  const idx = itemsStore.index('feedId');
  await new Promise((resolve, reject) => {
    const cursorReq = idx.openCursor(IDBKeyRange.only(id));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        const item = cursor.value;
        // 级联删除该 item 的倒排索引 + seqPub
        if (typeof item.seq === 'number') {
          deleteItemTokensBySeq(tokensStore, item.seq).catch(() => {});
          seqPubStore.delete(item.seq).onerror = () => {};
        }
        cursor.delete();
        cursor.continue();
      } else { resolve(); }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });

  await done;
}

/**
 * Bulk delete every item belonging to any of `feedIds`. Feed records
 * themselves are kept. Also zeroes out the feed's totalCount.
 * Returns total number of items deleted.
 */
export async function deleteAllItemsForFeeds(feedIds) {
  if (!Array.isArray(feedIds) || feedIds.length === 0) return 0;
  const { stores, done } = await tx([STORE_FEEDS, STORE_ITEMS, STORE_TOKENS, STORE_SEQPUB], 'readwrite');
  const itemsStore = stores[STORE_ITEMS];
  const feedsStore = stores[STORE_FEEDS];
  const tokensStore = stores[STORE_TOKENS];
  const seqPubStore = stores[STORE_SEQPUB];
  const idx = itemsStore.index('feedId');
  let deleted = 0;
  for (const fid of feedIds) {
    await new Promise((resolve, reject) => {
      const req = idx.openCursor(IDBKeyRange.only(fid));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) { resolve(); return; }
        const item = cursor.value;
        // 级联删除倒排索引 + seqPub
        if (typeof item.seq === 'number') {
          deleteItemTokensBySeq(tokensStore, item.seq).catch(() => {});
          seqPubStore.delete(item.seq).onerror = () => {};
        }
        cursor.delete();
        deleted++;
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
    // Zero out counts on the feed record
    const feed = await req2promise(feedsStore.get(fid));
    if (feed) {
      feed.totalCount = 0;
      await req2promise(feedsStore.put(feed));
    }
  }
  await done;
  return deleted;
}

/**
 * Persist a new sortOrder for each provided feed id. Order is dictated by the
 * order of the `feedIds` array (0 → top).
 */
export async function reorderFeeds(feedIds) {
  if (!Array.isArray(feedIds) || feedIds.length === 0) return 0;
  const { stores, done } = await tx(STORE_FEEDS, 'readwrite');
  const store = stores[STORE_FEEDS];
  let updated = 0;
  await Promise.all(feedIds.map((id, idx) => new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const feed = getReq.result;
      if (!feed) { resolve(); return; }
      feed.sortOrder = idx;
      const putReq = store.put(feed);
      putReq.onerror = () => reject(putReq.error);
      putReq.onsuccess = () => { updated++; resolve(); };
    };
  })));
  await done;
  return updated;
}

/* ======== Items ======== */

export async function upsertItems(items) {
  if (!items || items.length === 0) return { inserted: 0, skipped: 0 };

  // seq 分配在事务外完成：IDB 事务内 await 非 IDB 操作（chrome.storage）会让
  // 事务在没有 pending 请求时自动提交 → 后续 put 抛 TransactionInactiveError。
  // 先读计数器到内存，事务内同步递增，事务后一次性回写。
  const { [SEQ_COUNTER_KEY]: curSeq } = await chrome.storage.local.get(SEQ_COUNTER_KEY);
  let seqCounter = (typeof curSeq === 'number' ? curSeq : -1) + 1;

  // 三个 store 同事务：items 写入 + 倒排索引同步
  const { stores, done } = await tx([STORE_ITEMS, STORE_TOKENS, STORE_SEQPUB], 'readwrite');
  const store = stores[STORE_ITEMS];
  const tokensStore = stores[STORE_TOKENS];
  const seqPubStore = stores[STORE_SEQPUB];
  let inserted = 0, skipped = 0;

  // Queue every (get -> put) chain on the same transaction without awaiting
  // between requests. IDB will pipeline them and the transaction stays open
  // until all chained requests settle.
  await Promise.all(items.map((item) => new Promise(async (resolve, reject) => {
    try {
      const getReq = store.get(item.id);
      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = async () => {
        const existing = getReq.result;
        let putReq;
        if (existing) {
          skipped++;
          // Preserve translation state on re-fetch: don't overwrite translated
          // title/summary back to source-language version.
          const merged = {
            ...existing,
            author: item.author || existing.author,
            // Webpage recipes without a timestamp keep their first-seen time
            // stable; otherwise every refresh would make old cards look new.
            publishedAt: item.preservePublishedAt
              ? existing.publishedAt
              : (item.publishedAt || existing.publishedAt),
            contentHtml: item.contentHtml || existing.contentHtml,
            coverUrl: item.coverUrl || existing.coverUrl,
            link: item.link || existing.link,
          };
          if (!existing.translated) {
            merged.title = item.title || existing.title;
            merged.summary = item.summary || existing.summary;
          }
          putReq = store.put(merged);
          putReq.onerror = () => reject(putReq.error);
          putReq.onsuccess = async () => {
            // 索引已构建且搜索字段变化：重建该 item 的索引
            try {
              if (typeof existing.seq === 'number' && searchFieldsChanged(existing, merged)) {
                await reindexItemInTx(tokensStore, seqPubStore, merged);
              }
            } catch (_) { /* 索引同步失败不阻塞主写入 */ }
            resolve();
          };
        } else {
          inserted++;
          // 新增项分配 seq（内存递增，事务内不 await 外部操作）
          const seq = seqCounter++;
          item.seq = seq;
          putReq = store.put(item);
          putReq.onerror = () => reject(putReq.error);
          putReq.onsuccess = async () => {
            // 索引已构建：写入新 item 的倒排索引
            try {
              indexItemTokens(tokensStore, seqPubStore, item);
            } catch (_) { /* 索引同步失败不阻塞主写入 */ }
            resolve();
          };
        }
      };
    } catch (err) { reject(err); }
  })));
  await done;
  // 事务结束后回写自增计数器
  await chrome.storage.local.set({ [SEQ_COUNTER_KEY]: seqCounter - 1 });
  return { inserted, skipped };
}

/**
 * 倒排索引搜索：2-gram 分词 -> 查 token 索引 -> 交集/并集 -> publishedAt 排序 -> 回表。
 * 仅当索引已构建（isIndexBuilt）时调用；失败返回 null，调用方兜底全表扫。
 * @returns {Promise<Array|null>} 命中 item 数组，或 null 表示不可用需兜底
 */
async function searchByIndex(tokensAll, tokensAny, feedIdSet, beforePublishedAt, onlyStarred, limit) {
  // 查询词 2-gram：AND 词全部 2-gram、OR 词各自 2-gram
  // 每个 token 查 itemTokens 拿命中的 seq 集合，多 token 取交集/并集
  const { stores, done } = await tx([STORE_TOKENS, STORE_SEQPUB, STORE_ITEMS]);

  // 把查询词转成 2-gram token 列表（每个词一组）
  const allGrams = (tokensAll || []).map(tokenize2gram).filter((g) => g.length > 0);
  const anyGrams = (tokensAny || []).map(tokenize2gram).filter((g) => g.length > 0);

  // 单字符查询（如搜"美"）：建索引时单字不产生 token（2-gram 只覆盖 2 字符），
  // 索引查不到。返回 null 让调用方走全表扫兜底 —— includes 对单字有效，能搜到，
  // 只是慢（全表扫）。多字查询不受影响，仍走索引。
  const hasSingleCharToken =
    allGrams.some((g) => g.some((t) => t.length === 1)) ||
    anyGrams.some((g) => g.some((t) => t.length === 1));
  if (hasSingleCharToken) { await done; return null; }

  // 无任何 token（查询词全是单字符且 tokenize 返回空？理论上单字符也有 token）
  if (allGrams.length === 0 && anyGrams.length === 0) { await done; return null; }

  // 取某个 token 在倒排索引中命中的 seq 集合
  const seqsForToken = (token) => new Promise((resolve, reject) => {
    const idx = stores[STORE_TOKENS].index('token');
    const req = idx.openCursor(IDBKeyRange.only(token));
    const seqs = new Set();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(seqs); return; }
      // feedId 过滤：若指定了 feed 范围，需回 seqPub 查 itemId 再回 items 查 feedId
      // 但 seqPub 不存 feedId，这里先收集全部 seq，后续回表时再按 feedId 过滤
      seqs.add(cursor.value.seq);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });

  // 一组 gram 的交集（同一查询词的所有 2-gram 都命中的 seq）
  const seqsForGramGroup = async (grams) => {
    if (grams.length === 0) return null; // null 表示无约束
    const sets = await Promise.all(grams.map(seqsForToken));
    // 取所有 set 的交集
    let result = sets[0];
    for (let i = 1; i < sets.length; i++) {
      const next = new Set();
      for (const s of result) if (sets[i].has(s)) next.add(s);
      result = next;
    }
    return result;
  };

  // AND: 所有词的 seq 集合取交集
  let candidateSeqs = null;
  if (allGrams.length > 0) {
    const andSets = await Promise.all(allGrams.map(seqsForGramGroup));
    candidateSeqs = andSets[0];
    for (let i = 1; i < andSets.length; i++) {
      const next = new Set();
      for (const s of candidateSeqs) if (andSets[i].has(s)) next.add(s);
      candidateSeqs = next;
    }
  }

  // OR: 任一词命中的 seq 并入候选
  if (anyGrams.length > 0) {
    const orSets = await Promise.all(anyGrams.map(seqsForGramGroup));
    if (candidateSeqs === null) {
      // 纯 OR：取并集
      candidateSeqs = new Set();
      for (const s of orSets) if (s) for (const x of s) candidateSeqs.add(x);
    } else {
      // AND + OR：候选必须是 AND 交集 且 在 OR 并集中（OR 进一步收紧）
      const orUnion = new Set();
      for (const s of orSets) if (s) for (const x of s) orUnion.add(x);
      const next = new Set();
      for (const s of candidateSeqs) if (orUnion.has(s)) next.add(s);
      candidateSeqs = next;
    }
  }

  if (!candidateSeqs || candidateSeqs.size === 0) { await done; return []; }

  // 从 seqPub 取 publishedAt，排序 + 过滤 + 截断
  const seqPubStore = stores[STORE_SEQPUB];
  const itemsStore = stores[STORE_ITEMS];
  const entries = [];
  for (const seq of candidateSeqs) {
    const sp = await req2promise(seqPubStore.get(seq));
    if (!sp) continue;
    if (beforePublishedAt != null && sp.publishedAt >= beforePublishedAt) continue;
    entries.push(sp);
  }
  // publishedAt DESC
  entries.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

  // 回表 items 取完整记录，应用 starred/feedId 过滤，截断到 limit
  const out = [];
  for (const sp of entries) {
    if (out.length >= limit) break;
    const item = await req2promise(itemsStore.get(sp.itemId));
    if (!item) continue;
    if (feedIdSet && !feedIdSet.has(item.feedId)) continue;
    if (onlyStarred && !item.starred) continue;
    out.push(item);
  }
  await done;
  return out;
}

function slimItemMeta(it) {
  if (!it) return it;
  return {
    id: it.id,
    feedId: it.feedId,
    publishedAt: it.publishedAt || 0,
    title: it.title || '',
    starred: !!it.starred,
    collectedEntryId: it.collectedEntryId || null,
    hasFullText: !!it.hasFullText,
    summary: it.summary || '',
    coverUrl: it.coverUrl || '',
  };
}

function slimListResult(res, metaOnly) {
  if (!metaOnly || res == null) return res;
  if (Array.isArray(res)) return res.map(slimItemMeta);
  if (Array.isArray(res.items)) return { ...res, items: res.items.map(slimItemMeta) };
  return res;
}

export async function listItems(opts = {}) {
  return slimListResult(await listItemsFull(opts), !!opts.metaOnly);
}

async function listItemsFull(opts = {}) {
  const {
    feedId = null,
    feedIds = null,
    limit = 50,
    beforePublishedAt = null,
    onlyStarred = false,
    searchQuery = '',
    searchAny = '',
    searchInFullText = false,
    indexOnly = false,
    skipIds = null,
  } = opts;

  const qAll = (searchQuery || '').trim().toLowerCase();
  const tokensAll = qAll ? qAll.split(/\s+/).filter(Boolean) : null;
  const qAny = (searchAny || '').trim().toLowerCase();
  const tokensAny = qAny ? qAny.split(/\s+/).filter(Boolean) : null;

  // 默认只搜元数据 5 字段；searchInFullText=true 时额外搜全文（含译文备份），
  // 但全文不进倒排索引（体积会膨胀一个量级），只能走全表扫。
  const buildHay = (item) => {
    const fields = [item.title, item.summary, item.author, item.originalTitle, item.originalSummary];
    if (searchInFullText) fields.push(item.fullText, item.originalFullText);
    return fields.filter(Boolean).join(' ').toLowerCase();
  };

  const matchSearch = (tokensAll || tokensAny)
    ? (item) => {
        const hay = buildHay(item);
        if (tokensAll && !tokensAll.every((t) => hay.includes(t))) return false;
        if (tokensAny && !tokensAny.some((t) => hay.includes(t))) return false;
        return true;
      }
    : null;

  // 有搜索词时优先走倒排索引（百万级下从全表扫描降到毫秒级）。
  // 双段式：indexOnly=true 时只跑索引立即返回（complete 标志告知是否已满）；
  // 否则索引不足 limit 时继续全表扫兜底补差（跳过索引命中 + skipIds）。
  // searchInFullText 时索引不覆盖全文，跳过索引直接全表扫。
  let indexedHits = null; // 索引命中（null = 索引不可用）
  if (matchSearch && !searchInFullText) {
    try {
      const built = await isIndexBuilt();
      if (built) {
        const targetFeedIds = feedId ? [feedId] : (feedIds || null);
        const feedIdSet = targetFeedIds ? new Set(targetFeedIds) : null;
        indexedHits = await searchByIndex(
          tokensAll, tokensAny, feedIdSet, beforePublishedAt, onlyStarred, limit
        );
      }
    } catch (_) { indexedHits = null; }
  }

  // 索引不可用（未构建/单字查询）：indexOnly 时无结果可返回，直接空
  // complete 恒为 false：有搜索词时始终让调用方走补差循环，直到全表扫拉完
  // 所有匹配（索引命中 >limit 的部分也由补差循环继续拉，不漏消息）。
  if (indexOnly) {
    return { items: indexedHits || [], complete: false };
  }

  // 索引命中且已满 limit：直接返回（快路径，不扫全表）
  if (indexedHits !== null && indexedHits.length >= limit) return indexedHits;

  // 索引未满 / 不可用：全表扫兜底补差
  const { stores, done } = await tx(STORE_ITEMS);
  const store = stores[STORE_ITEMS];
  const idx = store.index('feedId_publishedAt');

  const results = [];
  const targetFeedIds = feedId ? [feedId] : (feedIds || null);
  const indexedIds = indexedHits ? new Set(indexedHits.map((i) => i.id)) : null;
  // skipIds（第二段请求传来已展示的 id）与索引命中合并去重
  const skipSet = indexedIds || (skipIds && skipIds.length ? new Set(skipIds) : null);

  if (targetFeedIds) {
    if (matchSearch) {
      // Search path: scan items from each feed. 补差模式（skipSet）每批按 limit
      // 收集（游标推进后新批天然不重复），普通场景同样按 limit。
      const hardLimit = limit;
      const buckets = await Promise.all(
        targetFeedIds.map((fid) =>
          collectFromFeedIndex(idx, fid, beforePublishedAt, Number.MAX_SAFE_INTEGER, onlyStarred, matchSearch, hardLimit)
        )
      );
      for (const b of buckets) results.push(...b);
      results.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
      await done;
      // 合并：索引命中优先，全表扫补差（跳过 skipSet：索引命中 + 已展示的）
      if (indexedHits) {
        const seen = new Set(indexedHits.map((i) => i.id));
        const merged = [...indexedHits];
        for (const r of results) {
          if (merged.length >= limit) break;
          if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
        }
        return merged;
      }
      // 第二段请求：全表扫补差（跳过 skipIds 已展示的）
      // 返回 { items, hasMore }：hasMore = 全表扫原始匹配是否达批上限
      // （即使过滤后 out 很少，只要 results 匹配多就还有更多，防提前终止漏数据）
      if (skipSet) {
        const out = [];
        for (const r of results) {
          if (out.length >= limit) break;
          if (skipSet.has(r.id)) continue;
          out.push(r);
        }
        return { items: out, hasMore: results.length >= limit };
      }
      return results.slice(0, limit);
    }
    const buckets = await Promise.all(
      targetFeedIds.map((fid) =>
        collectFromFeedIndex(idx, fid, beforePublishedAt, limit, onlyStarred)
      )
    );
    for (const b of buckets) results.push(...b);
    results.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    await done;
    return results.slice(0, limit);
  }

  // No feedId filter: use single-field 'publishedAt' index with reverse cursor.
  // Avoids loading the entire items table into memory.
  const pubIdx = store.index('publishedAt');
  const upper = beforePublishedAt != null ? beforePublishedAt : Number.MAX_SAFE_INTEGER;
  const range = IDBKeyRange.upperBound(upper, true);
  const out = await new Promise((resolve, reject) => {
    const collected = [];
    const req = pubIdx.openCursor(range, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || collected.length >= limit) { resolve(collected); return; }
      const v = cursor.value;
      const passStar = !onlyStarred || v.starred;
      const passSearch = !matchSearch || matchSearch(v);
      if (passStar && passSearch) collected.push(v);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await done;
  // 合并：索引命中优先，全表扫补差（跳过 skipSet：索引命中 + 已展示的）
  if (indexedHits) {
    const seen = new Set(indexedHits.map((i) => i.id));
    const merged = [...indexedHits];
    for (const r of out) {
      if (merged.length >= limit) break;
      if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
    }
    return merged;
  }
  // 第二段请求：全表扫补差（跳过 skipIds 已展示的）
  // hasMore = 原始匹配是否达批上限（即使过滤后很少，还有更多就继续拉）
  if (skipSet) {
    const filled = [];
    for (const r of out) {
      if (filled.length >= limit) break;
      if (skipSet.has(r.id)) continue;
      filled.push(r);
    }
    return { items: filled, hasMore: out.length >= limit };
  }
  return out;
}

function collectFromFeedIndex(idx, feedId, beforePublishedAt, limit, onlyStarred, matchSearch = null, hardLimit = limit) {
  return new Promise((resolve, reject) => {
    const upper = beforePublishedAt != null ? beforePublishedAt : Number.MAX_SAFE_INTEGER;
    const range = IDBKeyRange.bound([feedId, -Infinity], [feedId, upper], false, true);
    const out = [];
    const req = idx.openCursor(range, 'prev');
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || out.length >= hardLimit) { resolve(out); return; }
      const v = cursor.value;
      const passStar = !onlyStarred || v.starred;
      const passSearch = !matchSearch || matchSearch(v);
      if (passStar && passSearch) out.push(v);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * 异步构建倒排索引：遍历所有 items，分批写入 itemTokens + seqPub。
 * 可恢复：进度（已处理到哪个 itemId）存 chrome.storage.local，SW 重启后续跑。
 * 完成后置 indexBuilt=true。构建期间搜索走全表扫兜底。
 * @param {function} [onProgress] 进度回调（已处理数）
 * @returns {Promise<boolean>} 是否构建完成（true=完成，false=被中断）
 */
const INDEX_PROGRESS_KEY = 'feedIndexProgress';
const INDEX_DONE_KEY = 'feedIndexDone'; // 已处理条数（进度显示用）
const SEQ_COUNTER_KEY = 'feedSeqCounter'; // 自增 seq 计数器（chrome.storage.local，单调递增）
// 每批 500 条：单子事务内 ~5 万 put，几秒内完成；每批后立即保存进度断点，
// 避免 MV3 SW 30 秒空闲 kill 在进度保存前中断（否则断点不更新、重复处理同一批）。
const INDEX_BATCH = 500;

// 防重入：同一时刻只允许一个构建批次在跑（SW alarm / 消息 / 启动循环并发时）
let indexBuilding = false;
// 构建完成校验重跑保护：游标提前结束时最多重跑一次，防止死循环
let indexRestartGuard = false;

/**
 * 分配下一个自增 seq。依赖 seqPubStore.count() 不可靠：reset 清空 seqPub 后
 * count 归零，与迁移回填的 seq 冲突（seqPub.put 互相覆盖）。改用持久化计数器，
 * 单调递增，跨 reset/构建期保持一致。
 */
async function nextSeqInTx() {
  const { [SEQ_COUNTER_KEY]: cur } = await chrome.storage.local.get(SEQ_COUNTER_KEY);
  const next = (typeof cur === 'number' ? cur : -1) + 1;
  await chrome.storage.local.set({ [SEQ_COUNTER_KEY]: next });
  return next;
}

/** 查询索引构建状态：{ built, done, total } built=是否完成，done=已处理条数，total=总条数 */
export async function getIndexBuildStatus() {
  try {
    const built = await isIndexBuilt();
    const { [INDEX_DONE_KEY]: done } = await chrome.storage.local.get(INDEX_DONE_KEY);
    // 总数：items store count（开销小，IDB 元数据）
    let total = 0;
    try {
      const { stores, done: d } = await tx(STORE_ITEMS);
      total = await req2promise(stores[STORE_ITEMS].count());
      await d;
    } catch (_) {}
    return { built, done: done || 0, total };
  } catch (_) {
    return { built: false, done: 0, total: 0 };
  }
}

/**
 * 重置倒排索引：清空 itemTokens + seqPub，删除构建进度/完成标志 + 重置 seq 计数器。
 * 用于中断后重建（put 覆盖幂等，但中断可能留下不完整数据，重置最干净）。
 */
export async function resetTokenIndex() {
  try {
    const { stores, done } = await tx([STORE_TOKENS, STORE_SEQPUB], 'readwrite');
    await Promise.all([
      req2promise(stores[STORE_TOKENS].clear()),
      req2promise(stores[STORE_SEQPUB].clear()),
    ]);
    await done;
  } catch (_) { /* store 可能不存在（未迁移）：忽略 */ }
  // seq 计数器重置为 items 最大 seq（迁移回填 seq = 0~count-1，一一对应）
  let maxSeq = -1;
  try {
    const { stores, done } = await tx(STORE_ITEMS);
    maxSeq = await req2promise(stores[STORE_ITEMS].count()) - 1;
    await done;
  } catch (_) {}
  await chrome.storage.local.remove([INDEX_BUILT_KEY, INDEX_PROGRESS_KEY, INDEX_DONE_KEY]);
  await chrome.storage.local.set({ [SEQ_COUNTER_KEY]: maxSeq });
  return true;
}

/**
 * 异步构建倒排索引：遍历所有 items，分批写入 itemTokens + seqPub。
 * 可恢复：进度（已处理到哪个 itemId + 已处理条数）存 chrome.storage.local。
 * 每批处理完后返回（不自行循环），由调用方用 chrome.alarms 保活续跑，
 * 避免 MV3 SW 在 setTimeout 让出后被 kill 导致构建停滞。
 * @returns {Promise<boolean>} true=本轮处理完且全部构建完成，false=还有更多批次
 */
export async function buildTokenIndexBatch() {
  if (await isIndexBuilt()) return true;
  if (indexBuilding) return false; // 已有批次在跑，跳过本轮（防并发事务争用）
  indexBuilding = true;
  try {
    const { [INDEX_PROGRESS_KEY]: lastItemId, [INDEX_DONE_KEY]: doneCount } =
      await chrome.storage.local.get([INDEX_PROGRESS_KEY, INDEX_DONE_KEY]);
    const afterItemId = lastItemId || null;

    // 游标收集用独立只读事务（避免与写入争用同一长事务）
    const { stores, done } = await tx(STORE_ITEMS, 'readonly');
    const itemsStore = stores[STORE_ITEMS];

    const batch = await new Promise((resolve, reject) => {
      const collected = [];
      const req = itemsStore.openCursor(afterItemId ? IDBKeyRange.lowerBound(afterItemId, true) : null);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || collected.length >= INDEX_BATCH) { resolve(collected); return; }
        collected.push(cursor.value);
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
    await done; // 只读游标事务收尾

    if (batch.length === 0) {
      // 游标取空不代表真完成：构建期间 upsertItems 并发插入/断点残留错误 id
      // 都可能导致游标提前到末尾。校验已处理数 vs items 总数，不等则重置断点
      // 从头补跑（put 覆盖幂等，无副作用）。连续重试保护防死循环。
      let totalItems = 0;
      try {
        totalItems = await req2promise(itemsStore.count());
        await done;
      } catch (_) {}
      const realDone = (doneCount || 0);
      if (totalItems > 0 && realDone < totalItems && !indexRestartGuard) {
        // 有遗漏：清断点重跑（从头开始，覆盖写），最多重试一次
        indexRestartGuard = true;
        await chrome.storage.local.remove([INDEX_PROGRESS_KEY]);
        try { console.log(`[SW] token index mismatch: done ${realDone} < total ${totalItems}, restarting`); } catch (_) {}
        return false;
      }
      indexRestartGuard = false;
      await setIndexBuilt(true);
      await chrome.storage.local.remove([INDEX_PROGRESS_KEY, INDEX_DONE_KEY]);
      return true;
    }
    indexRestartGuard = false;

    // 写入索引：单事务（每批仅 500 条 × ~100 token ≈ 5 万 put，几秒内提交），
    // 写完后立即保存进度断点——即使 SW 随后被杀，下次从断点续跑不重复。
    const subTx = await tx([STORE_TOKENS, STORE_SEQPUB], 'readwrite');
    for (const item of batch) {
      if (typeof item.seq !== 'number') continue;
      indexItemTokens(subTx.stores[STORE_TOKENS], subTx.stores[STORE_SEQPUB], item);
    }
    await subTx.done; // 提交事务

    const newDone = (doneCount || 0) + batch.length;
    await chrome.storage.local.set({
      [INDEX_PROGRESS_KEY]: batch[batch.length - 1].id,
      [INDEX_DONE_KEY]: newDone,
    });
    try { console.log(`[SW] token index batch: done ${newDone}`); } catch (_) {}
    return false; // 还有更多批次
  } finally {
    indexBuilding = false;
  }
}

/** 兼容旧调用名：循环跑到完成（仅适用于非 SW 环境或调试） */
export async function buildTokenIndex(onProgress) {
  while (!(await buildTokenIndexBatch())) {
    if (typeof onProgress === 'function') { try { onProgress(); } catch (_) {} }
    await new Promise((r) => setTimeout(r, 0));
  }
  return true;
}

export async function getItem(id) {
  const { stores, done } = await tx(STORE_ITEMS);
  const item = await req2promise(stores[STORE_ITEMS].get(id));
  await done;
  return item || null;
}

export async function getItemsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const { stores, done } = await tx(STORE_ITEMS);
  const store = stores[STORE_ITEMS];
  const items = await Promise.all(ids.map((id) => req2promise(store.get(id))));
  await done;
  return items.filter(Boolean);
}

export async function toggleStar(itemId) {
  const { stores, done } = await tx(STORE_ITEMS, 'readwrite');
  const store = stores[STORE_ITEMS];
  const item = await req2promise(store.get(itemId));
  if (item) {
    item.starred = !item.starred;
    await req2promise(store.put(item));
  }
  await done;
}

export async function setCollectedEntryId(itemId, entryId) {
  const { stores, done } = await tx(STORE_ITEMS, 'readwrite');
  const store = stores[STORE_ITEMS];
  const item = await req2promise(store.get(itemId));
  if (item) {
    item.collectedEntryId = entryId;
    item.fullText = item.fullText || '';
    item.hasFullText = true;
    await req2promise(store.put(item));
  }
  await done;
}

export async function updateItemFullText(itemId, fullText, hasFullText) {
  const { stores, done } = await tx(STORE_ITEMS, 'readwrite');
  const store = stores[STORE_ITEMS];
  const item = await req2promise(store.get(itemId));
  if (item) {
    item.fullText = fullText;
    item.hasFullText = hasFullText;
    // Invalidate translation state so backfill re-runs against the new fullText
    item.translatedTo = '';
    item.translated = false;
    item.translateAttempts = 0;
    item.translateError = '';
    if (item.originalFullText != null) delete item.originalFullText;
    await req2promise(store.put(item));
  }
  await done;
}

/* ======== Stats helpers ======== */

/**
 * 单个 feed 的条目总数（O(log n) 走 feedId 索引 count，不做游标全扫）。
 * 已读/未读状态已废弃，仅保留 totalCount 供展示/桥接导出。
 */
export async function countFeedItems(feedId) {
  const { stores, done } = await tx(STORE_ITEMS);
  const idx = stores[STORE_ITEMS].index('feedId');
  const total = await req2promise(idx.count(IDBKeyRange.only(feedId)));
  await done;
  return total;
}

/* ======== Translation backfill helpers ======== */

/**
 * Items that still need translation given a target language.
 * Criteria: translatedTo !== targetLang AND attempts under cap AND has text.
 */
export async function listItemsNeedingTranslation({ targetLang, attemptCap = 3, limit = 50 } = {}) {
  const { stores, done } = await tx(STORE_ITEMS);
  const store = stores[STORE_ITEMS];
  const out = await new Promise((resolve, reject) => {
    const collected = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || collected.length >= limit) { resolve(collected); return; }
      const it = cursor.value;
      if ((it.translatedTo || '') !== targetLang
          && (it.translateAttempts || 0) < attemptCap
          && (it.title || it.summary || it.fullText)) {
        collected.push(it);
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await done;
  return out;
}

export async function countItemsNeedingTranslation({ targetLang, attemptCap = 3 } = {}) {
  const { stores, done } = await tx(STORE_ITEMS);
  const store = stores[STORE_ITEMS];
  const n = await new Promise((resolve, reject) => {
    let count = 0;
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(count); return; }
      const it = cursor.value;
      if ((it.translatedTo || '') !== targetLang
          && (it.translateAttempts || 0) < attemptCap
          && (it.title || it.summary || it.fullText)) {
        count++;
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await done;
  return n;
}

/** Patch an item with translation fields (preserves originals on first translation). */
export async function applyItemTranslation(itemId, patch) {
  const { stores, done } = await tx([STORE_ITEMS, STORE_TOKENS, STORE_SEQPUB], 'readwrite');
  const store = stores[STORE_ITEMS];
  const item = await req2promise(store.get(itemId));
  if (!item) { await done; return null; }
  const next = { ...item, ...patch };
  await req2promise(store.put(next));
  // 翻译回填改写 title/summary/original*：重建该 item 索引
  try {
    if (typeof next.seq === 'number' && searchFieldsChanged(item, next)) {
      await reindexItemInTx(stores[STORE_TOKENS], stores[STORE_SEQPUB], next);
    }
  } catch (_) { /* 索引同步失败不阻塞主写入 */ }
  await done;
  return next;
}

/**
 * Reset the per-item translation state for every item that hasn't actually
 * been translated yet (or was translated to a different target). Clears the
 * attempt counter, error, AND translatedTo so the backfill will pick the item
 * up again on the next pass. Used when switching translation provider.
 * Returns number of records reset.
 */
export async function resetTranslateFailures(targetLang) {
  const { stores, done } = await tx(STORE_ITEMS, 'readwrite');
  const store = stores[STORE_ITEMS];
  const n = await new Promise((resolve, reject) => {
    let count = 0;
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(count); return; }
      const it = cursor.value;
      // Skip rows that were genuinely translated (have translated:true).
      // Reset everything else - including rows previously marked
      // translatedTo=target without actually being translated (the historical
      // bug we are fixing).
      const reallyTranslated = it.translated === true;
      if (!reallyTranslated && (
            (it.translateAttempts || 0) > 0 ||
            it.translateError ||
            it.translatedTo
          )) {
        it.translateAttempts = 0;
        it.translateError = '';
        it.translatedTo = '';
        cursor.update(it);
        count++;
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  await done;
  return n;
}
