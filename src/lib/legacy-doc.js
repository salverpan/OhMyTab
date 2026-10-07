/**
 * Word 97-2003 (.doc) 纯文本提取。无 DOM、无第三方依赖。
 *
 * 优先走 OLE2/CFB + MS-DOC 字块表（piece table）；失败则 UTF-16LE / GBK 启发式扫描。
 * 也处理「扩展名是 .doc、内容其实是 RTF」的文件。
 */

const ENDOFCHAIN = 0xFFFFFFFE;
const FATSECT = 0xFFFFFFFD;

function u16(view, off) { return view.getUint16(off, true); }
function u32(view, off) { return view.getUint32(off, true); }
function i32(view, off) { return view.getInt32(off, true); }

function decodeUtf16z(bytes, maxChars) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const n = Math.min(u8.length, (maxChars || 32) * 2);
  let s = '';
  for (let i = 0; i + 1 < n; i += 2) {
    const c = u8[i] | (u8[i + 1] << 8);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function readHeader(ab) {
  const view = new DataView(ab instanceof ArrayBuffer ? ab : ab.buffer, ab.byteOffset || 0, ab.byteLength || ab.length);
  const sig0 = view.getUint32(0, true);
  const sig1 = view.getUint32(4, true);
  if (sig0 !== 0xE011CFD0 || sig1 !== 0xE11AB1A1) return null;
  const sectorShift = u16(view, 0x1E);
  const miniShift = u16(view, 0x20);
  if (sectorShift < 6 || sectorShift > 16) return null;
  return {
    view,
    ab: view.buffer,
    sectorSize: 1 << sectorShift,
    miniSize: 1 << miniShift,
    miniCutoff: u32(view, 0x38) || 4096,
    dirStart: u32(view, 0x30),
    miniFatStart: u32(view, 0x3C),
    difatStart: u32(view, 0x44),
    difatCount: u32(view, 0x48),
    fatCount: u32(view, 0x2C),
  };
}

function sectorOffset(h, sect) {
  return (sect + 1) * h.sectorSize;
}

function readFat(h) {
  const fatSects = [];
  for (let i = 0; i < 109; i++) {
    const s = u32(h.view, 0x4C + i * 4);
    if (s < 0xFFFFFFA0) fatSects.push(s);
  }
  let difat = h.difatStart;
  for (let d = 0; d < h.difatCount && difat < 0xFFFFFFA0; d++) {
    const off = sectorOffset(h, difat);
    const count = (h.sectorSize / 4) - 1;
    for (let i = 0; i < count; i++) {
      const s = u32(h.view, off + i * 4);
      if (s < 0xFFFFFFA0) fatSects.push(s);
    }
    difat = u32(h.view, off + count * 4);
  }
  const fat = [];
  for (const sect of fatSects) {
    const off = sectorOffset(h, sect);
    const n = h.sectorSize / 4;
    for (let i = 0; i < n; i++) fat.push(u32(h.view, off + i * 4));
  }
  return fat;
}

function followChain(fat, start, maxSects) {
  const out = [];
  let s = start;
  const seen = new Set();
  const cap = Math.max(4, maxSects || 1e6);
  while (s < 0xFFFFFFA0 && out.length < cap) {
    if (seen.has(s)) break;
    seen.add(s);
    out.push(s);
    s = fat[s];
    if (s === undefined || s === ENDOFCHAIN || s === FATSECT) break;
  }
  return out;
}

function concatSectors(h, fat, start, size) {
  const sects = followChain(fat, start, Math.ceil((size || 0) / h.sectorSize) + 8);
  const buf = new Uint8Array(sects.length * h.sectorSize);
  for (let i = 0; i < sects.length; i++) {
    const off = sectorOffset(h, sects[i]);
    buf.set(new Uint8Array(h.ab, off, h.sectorSize), i * h.sectorSize);
  }
  return size != null ? buf.subarray(0, Math.min(size, buf.length)) : buf;
}

function readMiniFat(h, fat) {
  if (h.miniFatStart >= 0xFFFFFFA0) return [];
  const raw = concatSectors(h, fat, h.miniFatStart);
  const n = raw.length / 4;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const out = [];
  for (let i = 0; i < n; i++) out.push(view.getUint32(i * 4, true));
  return out;
}

function readEntries(h, fat) {
  const raw = concatSectors(h, fat, h.dirStart);
  const n = Math.floor(raw.length / 128);
  const entries = [];
  for (let i = 0; i < n; i++) {
    const off = i * 128;
    const type = raw[off + 0x42];
    if (!type) continue;
    const nameLen = raw[off + 0x40] | (raw[off + 0x41] << 8);
    const name = decodeUtf16z(raw.subarray(off, off + Math.min(64, nameLen || 64)));
    const start = new DataView(raw.buffer, raw.byteOffset + off + 0x74, 4).getUint32(0, true);
    const sizeLo = new DataView(raw.buffer, raw.byteOffset + off + 0x78, 4).getUint32(0, true);
    entries.push({ name, type, start, size: sizeLo });
  }
  return entries;
}

function readStream(h, fat, miniFat, root, entry) {
  if (!entry) return new Uint8Array(0);
  if (entry.size < h.miniCutoff && miniFat.length && root) {
    const miniData = concatSectors(h, fat, root.start, root.size);
    const sects = followChain(miniFat, entry.start, Math.ceil(entry.size / h.miniSize) + 8);
    const buf = new Uint8Array(sects.length * h.miniSize);
    for (let i = 0; i < sects.length; i++) {
      const off = sects[i] * h.miniSize;
      buf.set(miniData.subarray(off, off + h.miniSize), i * h.miniSize);
    }
    return buf.subarray(0, Math.min(entry.size, buf.length));
  }
  return concatSectors(h, fat, entry.start, entry.size);
}

function findEntry(entries, name) {
  const want = name.toLowerCase();
  return entries.find((e) => (e.name || '').replace(/\u0000/g, '').toLowerCase() === want) || null;
}

function stripWordControls(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0007/g, '\t') // 单元格结束
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeAnsiPiece(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let high = 0;
  for (let i = 0; i < u8.length; i++) if (u8[i] >= 0x80) high++;
  const label = high > u8.length * 0.08 ? 'gbk' : 'windows-1252';
  try {
    return new TextDecoder(label).decode(u8);
  } catch (_) {
    try { return new TextDecoder('gbk').decode(u8); }
    catch (e) {
      let s = '';
      for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      return s;
    }
  }
}

function extractViaPieceTable(word, table) {
  if (!word || word.length < 0x1AA || !table || table.length < 8) return '';
  const wv = new DataView(word.buffer, word.byteOffset, word.byteLength);
  const ident = u16(wv, 0);
  if (ident !== 0xA5EC && ident !== 0xA5DC) return '';
  const flags = u16(wv, 0x0A);
  const whichTable = (flags & 0x0200) !== 0;
  void whichTable;
  const fcClx = i32(wv, 0x1A2);
  const lcbClx = u32(wv, 0x1A6);
  if (lcbClx < 4 || fcClx < 0 || fcClx + lcbClx > table.length) return '';
  const clx = table.subarray(fcClx, fcClx + lcbClx);
  let i = 0;
  while (i < clx.length) {
    const tag = clx[i];
    if (tag === 0x01) {
      if (i + 3 > clx.length) break;
      const cb = clx[i + 1] | (clx[i + 2] << 8);
      i += 3 + cb;
      continue;
    }
    if (tag === 0x02) break;
    i += 1;
  }
  if (i >= clx.length || clx[i] !== 0x02) return '';
  i += 1;
  if (i + 4 > clx.length) return '';
  const lcb = clx[i] | (clx[i + 1] << 8) | (clx[i + 2] << 16) | (clx[i + 3] << 24);
  i += 4;
  if (lcb <= 0 || i + lcb > clx.length) return '';
  const plc = clx.subarray(i, i + lcb);
  // PlcPcd: (n+1)*4 cps + n*8 pcds  =>  lcb = 4*(n+1) + 8*n  => n = (lcb - 4) / 12
  if ((lcb - 4) % 12 !== 0) return '';
  const n = (lcb - 4) / 12;
  if (n <= 0 || n > 20000) return '';
  const pcdOff = (n + 1) * 4;
  const parts = [];
  const pv = new DataView(plc.buffer, plc.byteOffset, plc.byteLength);
  for (let p = 0; p < n; p++) {
    const cp0 = pv.getInt32(p * 4, true);
    const cp1 = pv.getInt32((p + 1) * 4, true);
    const chars = cp1 - cp0;
    if (chars <= 0) continue;
    const fcCompressed = pv.getInt32(pcdOff + p * 8 + 2, true);
    const compressed = (fcCompressed & 0x40000000) !== 0;
    const fc = fcCompressed & 0x3FFFFFFF;
    if (compressed) {
      const start = Math.floor(fc / 2);
      const slice = word.subarray(start, start + chars);
      parts.push(decodeAnsiPiece(slice));
    } else {
      const start = fc;
      const slice = word.subarray(start, start + chars * 2);
      parts.push(new TextDecoder('utf-16le').decode(slice));
    }
  }
  return stripWordControls(parts.join(''));
}

function heuristicUtf16(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const chunks = [];
  let run = [];
  const pushRun = () => {
    if (run.length >= 8) chunks.push(run.join(''));
    run = [];
  };
  for (let i = 0; i + 1 < u8.length; i += 2) {
    const c = u8[i] | (u8[i + 1] << 8);
    const ok = c === 0x0A || c === 0x0D || c === 0x09 || c === 0x07
      || (c >= 0x20 && c <= 0xFFFD && c !== 0xFEFF);
    if (ok) run.push(String.fromCharCode(c === 0x07 ? 9 : c));
    else pushRun();
  }
  pushRun();
  chunks.sort((a, b) => b.length - a.length);
  return stripWordControls((chunks[0] || '').replace(/\u0000/g, ''));
}

export function extractRtfText(input) {
  const str = typeof input === 'string' ? input : new TextDecoder('latin1').decode(input);
  const out = [];
  let i = 0;
  let hexSkip = 0;
  while (i < str.length) {
    const ch = str[i];
    if (ch === '\\') {
      if (str[i + 1] === "'") {
        const hex = str.slice(i + 2, i + 4);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out.push(String.fromCharCode(parseInt(hex, 16)));
          i += 4;
          continue;
        }
      }
      if (str[i + 1] === 'u') {
        const m = str.slice(i).match(/^\\u(-?\d+)\??/);
        if (m) {
          out.push(String.fromCharCode(Number(m[1]) & 0xFFFF));
          i += m[0].length;
          hexSkip = 1;
          continue;
        }
      }
      if (str[i + 1] === '\\' || str[i + 1] === '{' || str[i + 1] === '}') {
        out.push(str[i + 1]);
        i += 2;
        continue;
      }
      i += 1;
      while (i < str.length && /[a-zA-Z]/.test(str[i])) i += 1;
      while (i < str.length && /[-0-9]/.test(str[i])) i += 1;
      if (str[i] === ' ') i += 1;
      continue;
    }
    if (ch === '{' || ch === '}') { i += 1; continue; }
    if (hexSkip) { hexSkip -= 1; i += 1; continue; }
    out.push(ch);
    i += 1;
  }
  return stripWordControls(out.join('').replace(/\s+/g, ' ').replace(/ *\n */g, '\n'));
}

export function extractLegacyDocText(ab) {
  const buf = ab instanceof ArrayBuffer ? ab : (ab && ab.buffer ? ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength) : null);
  if (!buf) return '';
  const u8 = new Uint8Array(buf);
  const head = new TextDecoder('latin1').decode(u8.subarray(0, Math.min(8, u8.length)));
  if (head.startsWith('{\\rtf')) return extractRtfText(u8);

  const h = readHeader(buf);
  if (!h) {
    const heur = heuristicUtf16(u8);
    return heur.length >= 20 ? heur : '';
  }
  try {
    const fat = readFat(h);
    const entries = readEntries(h, fat);
    const root = entries.find((e) => e.type === 5) || entries[0];
    const miniFat = readMiniFat(h, fat);
    const wordEnt = findEntry(entries, 'WordDocument');
    if (!wordEnt) {
      const heur = heuristicUtf16(u8);
      return heur.length >= 20 ? heur : '';
    }
    const word = readStream(h, fat, miniFat, root, wordEnt);
    const flags = word.length >= 12 ? (word[0x0A] | (word[0x0B] << 8)) : 0;
    const tableName = (flags & 0x0200) ? '1Table' : '0Table';
    const tableEnt = findEntry(entries, tableName) || findEntry(entries, '1Table') || findEntry(entries, '0Table');
    const table = tableEnt ? readStream(h, fat, miniFat, root, tableEnt) : new Uint8Array(0);
    const viaTable = extractViaPieceTable(word, table);
    if (viaTable && viaTable.replace(/\s/g, '').length >= 8) return viaTable;
    const heur = heuristicUtf16(word.length > 0 ? word : u8);
    return heur;
  } catch (_) {
    return heuristicUtf16(u8);
  }
}
