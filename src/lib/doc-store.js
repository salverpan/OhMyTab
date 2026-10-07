/**
 * 文档原件库 —— IndexedDB 存取上传的 PDF/Word/Excel/CSV 原始二进制。
 *
 * 文库条目（entries_*）只存元数据 + 提取全文（搜索 / AI 上下文用）；
 * 原始文件在这里按 docId（= 条目 id）存取，用于精确预览、编辑回写与下载。
 *
 * 删除条目时**不删**原件：删除有撤销（undo 恢复条目时原件必须还在），
 * 孤儿文件由"同一 docId 不再被引用"自然闲置，量级可接受。
 * 所有函数返回 Promise；panel 与 reader 两端共用。
 */

const DB_NAME = 'citecat-docs';
const DB_VERSION = 1;
const STORE_FILES = 'files';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES); // 显式 key（docId），无 keyPath
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

function req2promise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

/** 存入/更新原件（docId = 条目 id）。返回存储字节数。 */
export async function saveDocFile(docId, arrayBuffer) {
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readwrite');
  tx.objectStore(STORE_FILES).put(arrayBuffer, docId);
  await txDone(tx);
  return arrayBuffer.byteLength;
}

/** 读取原件；不存在返回 null。 */
export async function getDocFile(docId) {
  if (!docId) return null;
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readonly');
  const value = await req2promise(tx.objectStore(STORE_FILES).get(docId));
  await txDone(tx);
  return value || null;
}

/** 删除指定原件。 */
export async function deleteDocFile(docId) {
  if (!docId) return;
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readwrite');
  tx.objectStore(STORE_FILES).delete(docId);
  await txDone(tx);
}

/** 列出全部 docId（清点/调试用）。 */
export async function listDocIds() {
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readonly');
  const ids = await req2promise(tx.objectStore(STORE_FILES).getAllKeys());
  await txDone(tx);
  return ids;
}
