/**
 * 损坏 PDF 的结构修复。
 *
 * pdf.js 读到坏的 xref / trailer 时抛 "Invalid PDF structure."，恢复模式
 * 会把流里面的字节也当成正文来扫 `endobj` / `trailer`。文字识别层（双层 PDF）
 * 的扫描图流里经常碰巧出现这些 ASCII，恢复就会指到一个不存在的 Root。
 *
 * 这里只在打开失败时走：按行首对象边界切分，流按 /Length 或 endstream 整段跳过，
 * 展开 Flate 的 ObjStm，再用这些对象写一张新的经典 xref。打不开的原错误原样抛回。
 */

const enc = new TextEncoder();
const latin1 = new TextDecoder('latin1');

function ascii(s) {
  return enc.encode(s);
}

function isWs(b) {
  return b === 0 || b === 9 || b === 10 || b === 12 || b === 13 || b === 32;
}

function isDelim(b) {
  return b === 40 || b === 41 || b === 60 || b === 62 || b === 91 || b === 93
    || b === 123 || b === 125 || b === 47 || b === 37;
}

function copyBytes(data) {
  if (data instanceof Uint8Array) return data.slice();
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  }
  return new Uint8Array(0);
}

export function isBrokenPdfStructure(err) {
  const msg = String(err?.message || '');
  const name = String(err?.name || '');
  return name === 'InvalidPDFException' || msg.includes('Invalid PDF structure');
}

function findPdfHeader(bytes) {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const limit = Math.min(bytes.length, 1024 * 1024);
  for (let i = 0; i + sig.length <= limit; i++) {
    let ok = true;
    for (let k = 0; k < sig.length; k++) {
      if (bytes[i + k] !== sig[k]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

function nextLine(bytes, i) {
  const start = i;
  while (i < bytes.length && bytes[i] !== 10 && bytes[i] !== 13) i++;
  if (i >= bytes.length) return i;
  i++;
  if (bytes[i - 1] === 13 && bytes[i] === 10) i++;
  return i === start ? i + 1 : i;
}

function skipWsComments(bytes, i) {
  while (i < bytes.length) {
    const b = bytes[i];
    if (isWs(b)) { i++; continue; }
    if (b === 0x25) {
      i++;
      while (i < bytes.length && bytes[i] !== 10 && bytes[i] !== 13) i++;
      continue;
    }
    break;
  }
  return i;
}

function matchKeywordAt(bytes, i, kw) {
  for (let k = 0; k < kw.length; k++) {
    if (bytes[i + k] !== kw.charCodeAt(k)) return false;
  }
  const n = bytes[i + kw.length];
  if (n == null) return true;
  return isWs(n) || isDelim(n);
}

function readInt(bytes, i) {
  if (i >= bytes.length || bytes[i] < 0x30 || bytes[i] > 0x39) return null;
  let j = i;
  let n = 0;
  while (j < bytes.length && bytes[j] >= 0x30 && bytes[j] <= 0x39) {
    n = n * 10 + (bytes[j] - 0x30);
    if (n > 20000000) return null;
    j++;
  }
  return { value: n, end: j };
}

function matchObjHeader(bytes, i) {
  const num = readInt(bytes, i);
  if (!num) return null;
  let j = skipWsComments(bytes, num.end);
  const gen = readInt(bytes, j);
  if (!gen) return null;
  j = skipWsComments(bytes, gen.end);
  if (!matchKeywordAt(bytes, j, 'obj')) return null;
  return { num: num.value, gen: gen.value, contentStart: j + 3 };
}

function skipLiteralString(bytes, i) {
  let depth = 1;
  let j = i + 1;
  while (j < bytes.length && depth > 0) {
    if (bytes[j] === 0x5c) { j += 2; continue; }
    if (bytes[j] === 0x28) depth++;
    else if (bytes[j] === 0x29) depth--;
    j++;
  }
  return j;
}

function readToken(bytes, i) {
  const start = skipWsComments(bytes, i);
  if (start >= bytes.length) return null;
  const b = bytes[start];
  if (b === 0x3c) { // <
    if (bytes[start + 1] === 0x3c) return { type: 'ltdict', start, end: start + 2 };
    let j = start + 1;
    while (j < bytes.length && bytes[j] !== 0x3e) j++;
    return { type: 'hex', start, end: Math.min(bytes.length, j + 1) };
  }
  if (b === 0x3e) { // >
    if (bytes[start + 1] === 0x3e) return { type: 'gtdict', start, end: start + 2 };
    return { type: 'gt', start, end: start + 1 };
  }
  if (b === 0x5b) return { type: 'lb', start, end: start + 1 };
  if (b === 0x5d) return { type: 'rb', start, end: start + 1 };
  if (b === 0x28) return { type: 'str', start, end: skipLiteralString(bytes, start) };
  if (b === 0x2f) {
    let j = start + 1;
    while (j < bytes.length && !isWs(bytes[j]) && !isDelim(bytes[j])) j++;
    return { type: 'name', value: latin1.decode(bytes.subarray(start + 1, j)), start, end: j };
  }
  if (b === 0x2b || b === 0x2d || b === 0x2e || (b >= 0x30 && b <= 0x39)) {
    const num = readNumber(bytes, start);
    if (num) return num;
  }
  if ((b >= 65 && b <= 90) || (b >= 97 && b <= 122)) {
    let j = start + 1;
    while (j < bytes.length && !isWs(bytes[j]) && !isDelim(bytes[j])) j++;
    return { type: 'kw', value: latin1.decode(bytes.subarray(start, j)), start, end: j };
  }
  return { type: 'unk', start, end: start + 1 };
}

function readNumber(bytes, i) {
  let j = i;
  if (bytes[j] === 0x2b || bytes[j] === 0x2d) j++;
  const digitStart = j;
  while (j < bytes.length && bytes[j] >= 0x30 && bytes[j] <= 0x39) j++;
  let dotted = false;
  if (bytes[j] === 0x2e) {
    dotted = true;
    j++;
    while (j < bytes.length && bytes[j] >= 0x30 && bytes[j] <= 0x39) j++;
  }
  if (j === digitStart) return null;
  const raw = latin1.decode(bytes.subarray(i, j));
  if (!/[0-9]/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return { type: 'num', value, integer: !dotted && Number.isInteger(value), start: i, end: j };
}

function directLength(dictBytes) {
  const s = latin1.decode(dictBytes);
  const re = /\/Length\s+(\d+)(?!\s+\d+\s+R)/g;
  let m;
  let last = null;
  while ((m = re.exec(s))) last = parseInt(m[1], 10);
  return last;
}

function consumeStream(bytes, afterKeyword, length) {
  let i = afterKeyword;
  if (bytes[i] === 13) {
    i++;
    if (bytes[i] === 10) i++;
  } else if (bytes[i] === 10) {
    i++;
  }
  const dataStart = i;
  if (Number.isInteger(length) && length >= 0 && dataStart + length <= bytes.length) {
    const at = dataStart + length;
    if (matchKeywordAt(bytes, at, 'endstream')) {
      return { dataStart, dataEnd: at, after: at + 9 };
    }
  }
  for (let j = dataStart; j + 9 <= bytes.length; j++) {
    const prev = j === 0 ? 10 : bytes[j - 1];
    if (prev !== 10 && prev !== 13 && j !== dataStart) continue;
    if (matchKeywordAt(bytes, j, 'endstream')) {
      return { dataStart, dataEnd: j, after: j + 9 };
    }
  }
  return null;
}

function parseObjectBody(bytes, contentStart) {
  let i = contentStart;
  let depth = 0;
  let stream = null;
  let guard = 0;
  while (i < bytes.length && guard++ < bytes.length + 8) {
    const tok = readToken(bytes, i);
    if (!tok || tok.end <= i) {
      i++;
      continue;
    }
    if (tok.type === 'kw' && tok.value === 'endobj' && depth === 0) {
      return { contentEnd: tok.start, end: tok.end, stream };
    }
    if (tok.type === 'kw' && tok.value === 'stream' && depth === 0) {
      const length = directLength(bytes.subarray(contentStart, tok.start));
      stream = consumeStream(bytes, tok.end, length);
      if (!stream) return null;
      i = stream.after;
      continue;
    }
    if (tok.type === 'ltdict') depth++;
    else if (tok.type === 'gtdict' && depth > 0) depth--;
    else if (tok.type === 'lb') depth++;
    else if (tok.type === 'rb' && depth > 0) depth--;
    i = tok.end;
  }
  return null;
}

function readTrailerDict(bytes, i) {
  if (!matchKeywordAt(bytes, i, 'trailer')) return null;
  let j = skipWsComments(bytes, i + 7);
  if (bytes[j] !== 0x3c || bytes[j + 1] !== 0x3c) return null;
  const innerStart = j + 2;
  let depth = 1;
  j += 2;
  while (j < bytes.length && depth > 0) {
    const b = bytes[j];
    if (b === 0x25) {
      while (j < bytes.length && bytes[j] !== 10 && bytes[j] !== 13) j++;
      continue;
    }
    if (b === 0x28) { j = skipLiteralString(bytes, j); continue; }
    if (b === 0x3c) {
      if (bytes[j + 1] === 0x3c) { depth++; j += 2; continue; }
      j++;
      while (j < bytes.length && bytes[j] !== 0x3e) j++;
      j++;
      continue;
    }
    if (b === 0x3e && bytes[j + 1] === 0x3e) { depth--; j += 2; continue; }
    j++;
  }
  if (depth !== 0) return null;
  return { innerStart, innerEnd: j - 2, end: j };
}

function indexFile(bytes) {
  const header = findPdfHeader(bytes);
  if (header < 0) return null;
  const objects = [];
  const trailers = [];
  let i = header;
  let spins = 0;
  while (i < bytes.length && spins++ < bytes.length + 8) {
    const line = i;
    let j = i;
    while (j < bytes.length && (bytes[j] === 32 || bytes[j] === 9)) j++;
    if (j < bytes.length && bytes[j] !== 10 && bytes[j] !== 13) {
      const obj = matchObjHeader(bytes, j);
      if (obj && obj.num > 0 && obj.num < 10000000) {
        const parsed = parseObjectBody(bytes, obj.contentStart);
        if (parsed && parsed.end > obj.contentStart) {
          objects.push({
            num: obj.num,
            gen: obj.gen,
            offset: j,
            content: bytes.subarray(obj.contentStart, parsed.contentEnd),
            stream: parsed.stream,
          });
          i = parsed.end;
          continue;
        }
      } else if (matchKeywordAt(bytes, j, 'trailer')) {
        const dict = readTrailerDict(bytes, j);
        if (dict) {
          trailers.push(dict);
          i = dict.end;
          continue;
        }
      }
    }
    const nxt = nextLine(bytes, line);
    if (nxt <= line) break;
    i = nxt;
  }
  return { header, objects, trailers };
}

function headOf(content) {
  const n = Math.min(content.length, 4096);
  const s = latin1.decode(content.subarray(0, n));
  const cut = s.search(/\bstream\b/);
  return cut === -1 ? s : s.slice(0, cut);
}

function looksLikeCatalog(content) {
  return /\/Type\s*\/Catalog\b/.test(headOf(content));
}

function dictMeta(content) {
  const s = headOf(content);
  const type = /\/Type\s*\/([A-Za-z0-9]+)/.exec(s);
  const filter = /\/Filter\s*\/([A-Za-z0-9]+)/.exec(s) || /\/Filter\s*\[\s*\/([A-Za-z0-9]+)/.exec(s);
  const n = /\/N\s+(\d+)/.exec(s);
  const first = /\/First\s+(\d+)/.exec(s);
  return {
    type: type ? type[1] : '',
    filter: filter ? filter[1] : '',
    n: n ? parseInt(n[1], 10) : null,
    first: first ? parseInt(first[1], 10) : null,
  };
}

async function inflatePdf(data) {
  const attempts = [data];
  let end = data.length;
  while (end > 0 && isWs(data[end - 1])) end--;
  if (end > 0 && end !== data.length) attempts.push(data.subarray(0, end));
  for (const chunk of attempts) {
    try {
      return await inflateFormat(chunk, 'deflate');
    } catch (_) { /* 试下一种 */ }
  }
  if (data.length > 6) {
    try {
      return await inflateFormat(data.subarray(2, Math.max(2, data.length - 4)), 'deflate-raw');
    } catch (_) { /* 放弃这段流 */ }
  }
  return null;
}

async function inflateFormat(data, format) {
  const ds = new DecompressionStream(format);
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readInts(bytes, count, limit) {
  const ints = [];
  let i = 0;
  const stop = Math.min(bytes.length, limit);
  while (ints.length < count && i < stop) {
    while (i < stop && isWs(bytes[i])) i++;
    if (i >= stop || bytes[i] < 0x30 || bytes[i] > 0x39) return null;
    let n = 0;
    while (i < stop && bytes[i] >= 0x30 && bytes[i] <= 0x39) {
      n = n * 10 + (bytes[i] - 0x30);
      i++;
    }
    ints.push(n);
  }
  return ints.length === count ? ints : null;
}

async function expandObjStm(obj) {
  if (!obj.stream) return null;
  const meta = dictMeta(obj.content);
  if (meta.type !== 'ObjStm') return null;
  if (meta.filter && meta.filter !== 'FlateDecode') return null;
  if (!Number.isInteger(meta.n) || meta.n <= 0 || meta.n > 100000) return null;
  if (!Number.isInteger(meta.first) || meta.first < 0) return null;
  // stream 下标是整个文件的绝对偏移，对象 content 是子视图。用 dataStart/dataEnd
  // 相对 content 的位置：调用前把 stream 改成相对 content 的范围。
  const data = obj.streamBytes;
  if (!data || meta.first > data.length) return null;
  let decoded = data;
  if (meta.filter === 'FlateDecode') {
    decoded = await inflatePdf(data);
    if (!decoded) return null;
  }
  if (meta.first > decoded.length) return null;
  const pairs = readInts(decoded, meta.n * 2, meta.first);
  if (!pairs) return null;
  const inners = [];
  for (let k = 0; k < meta.n; k++) {
    const num = pairs[k * 2];
    const off = pairs[k * 2 + 1];
    const start = meta.first + off;
    const nextOff = k + 1 < meta.n ? pairs[(k + 1) * 2 + 1] : decoded.length - meta.first;
    const end = meta.first + nextOff;
    if (num <= 0 || start < meta.first || end < start || end > decoded.length) return null;
    inners.push({ num, content: decoded.slice(start, end) });
  }
  return inners;
}

function rootFromTrailers(bytes, trailers) {
  for (let t = trailers.length - 1; t >= 0; t--) {
    const inner = latin1.decode(bytes.subarray(trailers[t].innerStart, trailers[t].innerEnd));
    const matches = [...inner.matchAll(/\/Root\s+(\d+)\s+(\d+)\s+R/g)];
    if (!matches.length) continue;
    const m = matches[matches.length - 1];
    return { num: parseInt(m[1], 10), gen: parseInt(m[2], 10), trailer: trailers[t], inner };
  }
  return null;
}

function trailerHasEncrypt(bytes, trailers) {
  for (const t of trailers) {
    const inner = latin1.decode(bytes.subarray(t.innerStart, t.innerEnd));
    if (/\/Encrypt\b/.test(inner)) return true;
  }
  return false;
}

function sanitizeTrailer(inner) {
  return inner
    .replace(/\/Prev\s+\d+/g, '')
    .replace(/\/XRefStm\s+\d+/g, '');
}

function pageTreeLooksReal(map, rootNum) {
  const cat = map.get(rootNum);
  if (!cat || !looksLikeCatalog(cat.content)) return false;
  const pagesRef = /\/Pages\s+(\d+)\s+\d+\s+R/.exec(headOf(cat.content));
  if (!pagesRef) return false;
  const pages = map.get(parseInt(pagesRef[1], 10));
  if (!pages) return false;
  const head = headOf(pages.content);
  return /\/Type\s*\/Pages\b/.test(head) || /\/Kids\b/.test(head);
}

function pad10(n) {
  return String(n).padStart(10, '0');
}

function pad5(n) {
  return String(Math.max(0, n | 0)).padStart(5, '0');
}

function xrefEntry(offset, gen, used) {
  return pad10(offset) + ' ' + pad5(gen) + (used ? ' n \n' : ' f \n');
}

function streamBytesOf(fileBytes, obj) {
  if (!obj.stream) return null;
  const base = fileBytes.byteOffset || 0;
  // obj.content 可能是 fileBytes 的视图，stream 下标是 fileBytes 的绝对位置
  const start = obj.stream.dataStart;
  const end = obj.stream.dataEnd;
  if (start < 0 || end < start || end > fileBytes.length) return null;
  return fileBytes.subarray(start, end);
}

/**
 * 重建 xref。修不好（没有 %PDF-、没有可用的 Catalog/Pages）时返回 null。
 * @param {ArrayBuffer | Uint8Array} input
 * @returns {Promise<Uint8Array | null>}
 */
export async function repairPdfStructure(input) {
  const bytes = copyBytes(input);
  const indexed = indexFile(bytes);
  if (!indexed || !indexed.objects.length) return null;

  const encrypted = trailerHasEncrypt(bytes, indexed.trailers);
  /** @type {Map<number, { gen: number, content: Uint8Array, offset: number }>} */
  const map = new Map();
  const upsert = (num, gen, content, offset) => {
    const prev = map.get(num);
    if (!prev || prev.offset <= offset) map.set(num, { gen, content, offset });
  };

  for (const obj of indexed.objects) {
    if (!encrypted && obj.stream) {
      const streamBytes = streamBytesOf(bytes, obj);
      const inners = streamBytes
        ? await expandObjStm({ ...obj, streamBytes })
        : null;
      if (inners && inners.length) {
        for (const inner of inners) upsert(inner.num, 0, inner.content, obj.offset);
        continue;
      }
    }
    upsert(obj.num, obj.gen, obj.content, obj.offset);
  }
  if (!map.size) return null;

  let root = rootFromTrailers(bytes, indexed.trailers);
  if (root && (!map.has(root.num) || !pageTreeLooksReal(map, root.num))) root = null;
  if (!root) {
    let best = -1;
    for (const [num, obj] of map) {
      if (obj.offset >= best && looksLikeCatalog(obj.content) && pageTreeLooksReal(map, num)) {
        best = obj.offset;
        root = { num, gen: obj.gen, trailer: null, inner: '' };
      }
    }
  }
  if (!root) return null;
  root.gen = map.get(root.num).gen;

  const max = Math.max(...map.keys());
  const parts = [];
  let pos = 0;
  const add = (chunk) => {
    parts.push(chunk);
    pos += chunk.length;
  };

  let headerEnd = indexed.header;
  while (headerEnd < bytes.length && bytes[headerEnd] !== 10 && bytes[headerEnd] !== 13) headerEnd++;
  if (headerEnd < bytes.length) {
    headerEnd++;
    if (bytes[headerEnd - 1] === 13 && bytes[headerEnd] === 10) headerEnd++;
  }
  add(bytes.subarray(indexed.header, headerEnd));
  if (parts[0][parts[0].length - 1] !== 10) add(ascii('\n'));
  add(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const offsets = new Array(max + 1).fill(-1);
  const gens = new Array(max + 1).fill(0);
  const nums = [...map.keys()].sort((a, b) => a - b);
  for (const num of nums) {
    const obj = map.get(num);
    offsets[num] = pos;
    gens[num] = obj.gen;
    add(ascii(`${num} ${obj.gen} obj\n`));
    add(obj.content);
    if (!obj.content.length || obj.content[obj.content.length - 1] !== 10) add(ascii('\n'));
    add(ascii('endobj\n'));
  }

  const xrefPos = pos;
  let xref = `xref\n0 ${max + 1}\n` + xrefEntry(0, 65535, false);
  for (let num = 1; num <= max; num++) {
    xref += offsets[num] < 0 ? xrefEntry(0, 0, false) : xrefEntry(offsets[num], gens[num], true);
  }
  add(ascii(xref));

  const inner = root.inner ? sanitizeTrailer(root.inner) : '';
  add(ascii(`trailer\n<<${inner} /Size ${max + 1} /Root ${root.num} ${root.gen} R >>\nstartxref\n${xrefPos}\n%%EOF\n`));

  const out = new Uint8Array(pos);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * 先用 pdf.js 打开；只有 "Invalid PDF structure" 才重建 xref 再试一次。
 * @returns {Promise<{ pdf: any, bytes: Uint8Array, repaired: boolean }>}
 */
export async function openPdfJsDocument(pdfjsLib, data, hooks) {
  const bytes = copyBytes(data);
  const extra = (hooks && hooks.documentParams) || {};
  const open = (buf) => pdfjsLib.getDocument({ ...extra, data: buf }).promise;
  try {
    const pdf = await open(bytes.slice());
    return { pdf, bytes, repaired: false };
  } catch (err) {
    if (!isBrokenPdfStructure(err)) throw err;
    if (hooks && typeof hooks.onRepair === 'function') hooks.onRepair();
    let repaired = null;
    try { repaired = await repairPdfStructure(bytes); } catch (_) { repaired = null; }
    if (!repaired) throw err;
    try {
      const pdf = await open(repaired.slice());
      return { pdf, bytes: repaired, repaired: true };
    } catch (_) {
      throw err;
    }
  }
}
