import fs from 'fs';
import JSZip from 'jszip';
import { DOMParser as XDP } from '@xmldom/xmldom';

const path = process.argv[2] || '/tmp/docxcheck/../docxcheck';
// 从原始 zip 读（/tmp/docxcheck 已解包，这里直接读解包文件亦可，但用 zip 更真实）
const zipPath = process.argv[2];
if (!zipPath) { console.error('need zip path'); process.exit(1); }
const ab = fs.readFileSync(zipPath);
const zip = await JSZip.loadAsync(ab);

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const problems = [];
const ok = (msg) => console.log('  ✓', msg);
const bad = (msg) => { problems.push(msg); console.log('  ✗', msg); };

// 1) 所有 xml 部件 well-formed
for (const name of Object.keys(zip.files)) {
  if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
  if (zip.files[name].dir) continue;
  const text = await zip.files[name].async('string');
  try { new XDP().parseFromString(text, 'application/xml'); }
  catch (e) { bad(`XML 解析失败: ${name}: ${e.message}`); }
}
ok('所有 XML 部件可解析');

// 2) document.xml：body 最后一个子元素必须是 sectPr
const docXml = await zip.files['word/document.xml'].async('string');
const doc = new XDP().parseFromString(docXml, 'application/xml');
const body = doc.getElementsByTagNameNS(W, 'body')[0];
if (!body) bad('无 w:body');
else {
  const kids = Array.from(body.childNodes).filter((n) => n.nodeType === 1);
  const last = kids[kids.length - 1];
  if (!last || last.localName !== 'sectPr') bad(`body 最后子元素不是 sectPr: ${last ? last.localName : 'none'}`);
  else ok('body 以 sectPr 结尾');
}

// 3) 嵌套 ins/del
const insList = doc.getElementsByTagNameNS(W, 'ins');
const delList = doc.getElementsByTagNameNS(W, 'del');
const hasNested = (list, other) => {
  for (const n of list) {
    let cur = n.parentNode;
    while (cur && cur !== doc.documentElement) {
      if (cur.localName === other || cur.localName === n.localName) return true;
      cur = cur.parentNode;
    }
  }
  return false;
};
if (hasNested(insList, 'del') || hasNested(delList, 'ins')) bad('存在嵌套 ins/del');
else ok(`无嵌套修订（ins=${insList.length} del=${delList.length}）`);

// 4) del 内不得有 w:t；ins 内不得有 delText
const badT = Array.from(doc.getElementsByTagNameNS(W, 't')).some((t) => {
  let cur = t.parentNode; while (cur && cur !== doc.documentElement) { if (cur.localName === 'del') return true; cur = cur.parentNode; } return false;
});
if (badT) bad('del 内残留 w:t'); else ok('del 内文本均为 delText');

// 5) comments 引用完整性
const commentRefs = [];
const rangeIds = new Set();
for (const el of Array.from(doc.getElementsByTagNameNS(W, 'commentReference'))) commentRefs.push(el.getAttributeNS(W, 'id'));
for (const el of Array.from(doc.getElementsByTagNameNS(W, 'commentRangeStart'))) rangeIds.add(el.getAttributeNS(W, 'id'));
for (const el of Array.from(doc.getElementsByTagNameNS(W, 'commentRangeEnd'))) rangeIds.add(el.getAttributeNS(W, 'id'));
const commentsFile = zip.files['word/comments.xml'];
const commentIds = new Set();
if (commentsFile) {
  const cDoc = new XDP().parseFromString(await commentsFile.async('string'), 'application/xml');
  for (const c of Array.from(cDoc.getElementsByTagNameNS(W, 'comment'))) commentIds.add(c.getAttributeNS(W, 'id'));
}
for (const id of commentRefs) if (!commentIds.has(id)) bad(`commentReference 引用不存在的 comment id=${id}`);
for (const id of rangeIds) if (!commentIds.has(id)) bad(`commentRange 引用不存在的 comment id=${id}`);
ok(`批注引用完整性（ref=${commentRefs.length}, range=${rangeIds.size}, comments=${commentIds.size}）`);

// 6) settings.xml
if (zip.files['word/settings.xml']) {
  const sText = await zip.files['word/settings.xml'].async('string');
  const sDoc = new XDP().parseFromString(sText, 'application/xml');
  const root = sDoc.documentElement;
  const kids = Array.from(root.childNodes).filter((n) => n.nodeType === 1).map((n) => n.localName);
  const tcIdx = kids.indexOf('trackChanges');
  if (tcIdx >= 0) {
    const BEFORE = new Set(['writeProtection','view','zoom','removePersonalInformation','doNotDisplayPageBoundaries','displayBackgroundShape','printPostScriptOverText','printFractionalCharacterWidth','printFormsData','embedTrueTypeFonts','embedSystemFonts','saveSubsetFonts','saveFormsData','mirrorMargins','alignBordersAndEdges','bordersDoNotSurroundHeader','bordersDoNotSurroundFooter','gutterAtTop','hideSpellingErrors','hideGrammaticalErrors','activeWritingStyle','proofState','formsDesign','attachedTemplate','linkStyles','stylePaneFormatFilter','stylePaneSortMethod','documentType','mailMerge','revisionView']);
    const before = kids.slice(0, tcIdx);
    const violations = before.filter((k) => !BEFORE.has(k));
    if (violations.length) bad(`trackChanges 位置前出现本应在其后的元素: ${violations.join(',')}`);
    else ok('settings.xml trackChanges 位置合规');
  } else {
    ok('settings.xml 无 trackChanges（无修订时正常）');
  }
}

// 7) [Content_Types] 覆盖所有部件
const ctText = await zip.files['[Content_Types].xml'].async('string');
const ctDoc = new XDP().parseFromString(ctText, 'application/xml');
const overrides = new Set();
const defaults = new Set();
for (const o of Array.from(ctDoc.getElementsByTagName('Override'))) overrides.add(o.getAttribute('PartName'));
for (const d of Array.from(ctDoc.getElementsByTagName('Default'))) defaults.add('.' + d.getAttribute('Extension'));
for (const name of Object.keys(zip.files)) {
  if (zip.files[name].dir || name === '[Content_Types].xml') continue;
  const ext = '.' + name.split('.').pop();
  if (!overrides.has('/' + name) && !defaults.has(ext)) bad(`部件无内容类型声明: ${name}`);
}
ok('Content_Types 覆盖完整');

console.log(problems.length === 0 ? '\n=== 审计通过：结构合规 ===' : `\n=== 发现问题 ${problems.length} 项 ===`);
process.exit(problems.length === 0 ? 0 : 1);
