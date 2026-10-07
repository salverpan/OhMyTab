// 临时冒烟：与 panel.js pdfTextToMarkdown 完全一致的逻辑副本
function pdfTextToMarkdown(raw) {
  const CJK = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/;
  const paras = [];
  let cur = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) { if (cur.length) { paras.push(cur); cur = []; } continue; }
    cur.push(t);
  }
  if (cur.length) paras.push(cur);
  return paras.map((lines) => {
    let s = lines[0];
    for (let i = 1; i < lines.length; i++) {
      s += (CJK.test(s[s.length - 1]) && CJK.test(lines[i][0]) ? '' : ' ') + lines[i];
    }
    return s.replace(/([\\`*_{}\[\]()#+.!|>~-])/g, '\\$1');
  }).join('\n\n');
}

const md = pdfTextToMarkdown([
  '第一行结尾中文',
  '第二行开头中文',
  '',
  'Chapter ends english',
  'starts english here',
  '',
  '- 列表符号应转义 #1 (括号) *星* _下_ [方]',
  '',
  '价格 3.14 与 50% 和 a_b',
].join('\n'));

console.log(md);
console.log('---');
// 断言
const assert = (cond, msg) => { if (!cond) { console.error('FAIL: ' + msg); process.exitCode = 1; } else console.log('ok: ' + msg); };
const BS = String.fromCharCode(92); // backslash
const paras3 = md.split('\n\n');
assert(paras3[0].includes('第一行结尾中文第二行开头中文'), 'CJK 断行直接相连');
assert(paras3[1].includes('english starts english'), '英文断行补空格');
assert(paras3[2] === BS + '- 列表符号应转义 ' + BS + '#1 ' + BS + '(括号' + BS + ') ' + BS + '*星' + BS + '* ' + BS + '_下' + BS + '_ ' + BS + '[方' + BS + ']', '行首结构字符被转义');
assert(paras3[3].includes('价格 3' + BS + '.14 与 50% 和 a' + BS + '_b'), '正文中特殊字符按字面转义');
