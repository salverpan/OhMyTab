import { build } from 'vite';
import { copyFileSync, writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';

const root = import.meta.dirname;
const dist = resolve(root, 'dist');

if (existsSync(dist)) {
  try {
    rmSync(dist, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'EBUSY') throw err;
    console.warn('  [build] dist is busy; overwriting files without clearing it first');
  }
}

/* ---- SW browser-code stripping ---- */

/**
 * Remove Vite-injected browser-only code from the Service Worker bundle.
 *
 * Vite injects __vitePreload (module preload polyfill) and detectScriptRel
 * which reference window/document — both unavailable in a Service Worker.
 * We replace __vitePreload with a trivial no-op and remove detectScriptRel.
 *
 * IMPORTANT: match by the exact injected identifier and consume the whole
 * statement via brace-balancing — never with a loose `const \w+ = (…) => {…}`
 * regex. Vite 6.4.2 with modulePreload.polyfill:false does NOT inject these
 * helpers at all; a broad pattern then matched business code instead. It
 * already did: Readability 0.6.0 ships `const shouldRemoveNode = () => { … };`,
 * which the old regex replaced with the preload no-op, breaking article
 * extraction at runtime with a ReferenceError.
 */
function findBalancedEnd(code, openBraceIdx) {
  let depth = 0;
  for (let i = openBraceIdx; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function removeStatement(code, stmtStart, stmtEnd) {
  let end = stmtEnd;
  if (code[end] === ';') end++;
  return code.slice(0, stmtStart) + code.slice(end);
}

function fixServiceWorker() {
  const swPath = resolve(dist, 'background/service-worker.js');
  let code = readFileSync(swPath, 'utf-8');
  let modified = false;

  // 1. Replace __vitePreload — ONLY the exact identifier `__vitePreload`.
  //    If Vite didn't inject it, do nothing (don't scan for look-alikes).
  const preloadDecl = /(?:const|let|var)\s+__vitePreload\s*=\s*/;
  const preloadIdx = code.search(preloadDecl);
  if (preloadIdx !== -1) {
    const eqIdx = code.indexOf('=', preloadIdx);
    const bodyStart = code.indexOf('{', eqIdx);
    if (bodyStart !== -1) {
      const end = findBalancedEnd(code, bodyStart);
      if (end !== -1) {
        code = code.slice(0, preloadIdx) + 'const __vitePreload=function(fn){return Promise.resolve().then(function(){return typeof fn===\'function\'?fn():fn})};' + code.slice(end);
        modified = true;
      }
    }
  }

  // 2. Remove detectScriptRel IIFE — exact function name + brace-balanced.
  const relIdx = code.indexOf('function detectScriptRel');
  if (relIdx !== -1) {
    // Walk back to the start of the declaration statement (nearest ; or newline).
    let stmtStart = relIdx;
    while (stmtStart > 0) {
      const prev = code[stmtStart - 1];
      if (prev === ';' || prev === '\n' || prev === '\r') break;
      stmtStart--;
    }
    // Find the opening brace of the function body, then its balanced end.
    const bodyStart = code.indexOf('{', relIdx);
    if (bodyStart !== -1) {
      const end = findBalancedEnd(code, bodyStart);
      if (end !== -1) {
        // Vite wraps it as: const scriptRel = /* @__PURE__ */ (function detectScriptRel(){...})();
        // 只删函数体的话会留下孤立 `)();`，SW 启动直接 SyntaxError。
        let stmtEnd = end;
        if (/^\)\(\);/.test(code.slice(end)) && code.slice(stmtStart, relIdx).includes('(')) {
          stmtEnd = end + 4;
        }
        code = removeStatement(code, stmtStart, stmtEnd);
        modified = true;
      }
    }
  }

  // 3. Remove standalone `assetsURL` / `seen` consts — only if the preload
  //    helper actually existed (they are its companions), and only the exact
  //    identifiers. Absence is fine; never touch other code.
  if (preloadIdx !== -1) {
    const assetsURLIdx = code.indexOf('const assetsURL =');
    if (assetsURLIdx !== -1) {
      const bodyStart = code.indexOf('{', assetsURLIdx);
      if (bodyStart !== -1) {
        const end = findBalancedEnd(code, bodyStart);
        if (end !== -1) code = removeStatement(code, assetsURLIdx, end);
      }
    }
    const seenIdx = code.indexOf('const seen = {}');
    if (seenIdx !== -1) {
      code = removeStatement(code, seenIdx, seenIdx + 'const seen = {}'.length);
    }
  }

  writeFileSync(swPath, code);
  if (modified) {
    console.log('  [SW] Stripped browser preload code');
  }
}

/* ---- Post-build validation ---- */

/**
 * Check that the built SW bundle does not contain unsupported API references.
 * Service Workers have no `window`, `document`, or `localStorage`.
 * Any such reference (outside of comments or safe string literals) would crash
 * the SW on startup. This catches Vite upgrades that change the injection format.
 *
 * Uses a two-pass approach:
 * 1. Strip comments and string contents (replace with markers)
 * 2. Scan the remaining code for forbidden identifiers used as property access
 */
/* 把 chrome.scripting.executeScript 的 func 参数（页面 world 代码）整体剔除，
   避免校验器把页面环境合法的 window/document 误判为 SW 顶层环境引用。
   支持块形态（平衡花括号）与单表达式形态（括号平衡 / 行尾截断）。 */
function stripScriptingFuncs(src) {
  const out = src.split('');
  const blank = (a, b) => {
    for (let j = a; j < b; j++) if (out[j] !== '\n' && out[j] !== '\r') out[j] = ' ';
  };

  // 块形态：func: (args) => { ... }
  const blockRe = /func:\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    let depth = 0;
    let i = m.index + m[0].length - 1; // 指向 '{'
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    if (i < src.length) { blank(m.index, i + 1); blockRe.lastIndex = i + 1; }
  }

  // 单表达式形态：func: (args) => EXPR（圆括号平衡；否则到行尾）
  const exprRe = /func:\s*(?:async\s*)?\([^)]*\)\s*=>\s*(?!\{)/g;
  while ((m = exprRe.exec(src)) !== null) {
    let i = m.index + m[0].length - 1;
    let end = i;
    if (src[i] === '(') {
      let depth = 0;
      for (; i < src.length; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
    } else {
      const nl = src.indexOf('\n', i);
      end = nl === -1 ? src.length - 1 : nl - 1;
    }
    blank(m.index, end + 1);
    exprRe.lastIndex = end + 1;
  }
  return out.join('');
}

function validateSwBundle() {
  const swPath = resolve(dist, 'background/service-worker.js');
  const code = readFileSync(swPath, 'utf-8');

  // Strip comments, then replace string/template contents with whitespace
  // (preserving structure so line numbers in error messages are accurate)
  let stripped = code
    .replace(/(?<!:)\/\/.*$/gm, (m) => ' '.repeat(m.length))     // 单行注释；避开 http://
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))  // multi-line comments
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => ' '.repeat(m.length))  // template literals（单行）
    .replace(/'(?:[^'\n\\]|\\.)*'/g, (m) => ' '.repeat(m.length))  // 单引号字符串不跨行
    .replace(/"(?:[^"\n\\]|\\.)*"/g, (m) => ' '.repeat(m.length)); // 双引号字符串不跨行

  // chrome.scripting.executeScript 的 func 参数在页面 world 运行，其中
  // window/document 是合法的；它们不属于 SW 顶层环境，整体剔除后再做
  // 禁用引用校验（支持箭头函数块 / 单表达式 / async 三种形态）。
  stripped = stripScriptingFuncs(stripped);

  // In the remaining code, look for forbidden references used as property access.
  // These must be followed by a valid JS identifier (not just a substring match).
  const forbidden = [
    { ref: 'window.',  pattern: /\bwindow\.(\w+)/g },
    { ref: 'document.', pattern: /\bdocument\.(\w+)/g },
    { ref: 'localStorage.',  pattern: /\blocalStorage\.(\w+)/g },
    { ref: 'sessionStorage.', pattern: /\bsessionStorage\.(\w+)/g },
  ];

  const issues = [];
  for (const { ref, pattern } of forbidden) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(stripped)) !== null) {
      // OOXML 部件名 document.xml 不是 DOM；xmldom 的 window.parseInt 兜底在 SW 里走不到
      if (ref === 'document.' && match[1] === 'xml') continue;
      if (ref === 'window.' && (match[1] === 'parseInt' || match[1] === 'parseFloat')) continue;
      // Find the corresponding line in the original code for a helpful message
      const lineNum = code.slice(0, match.index).split('\n').length;
      const snippet = code.split('\n')[lineNum - 1]?.trim()?.slice(0, 120);
      issues.push(`  Line ${lineNum}: ${ref} — ${snippet || '(not found)'}`);
    }
  }

  if (issues.length > 0) {
    console.error('\n  [SW] ⚠️  Post-build validation FAILED:');
    console.error('  The Service Worker bundle contains browser-only API references that');
    console.error('  will crash the extension. This usually means Vite changed its injection');
    console.error('  format and fixServiceWorker() needs to be updated.\n');
    issues.forEach((l) => console.error(l));
    console.error('');
    throw new Error('SW bundle validation: found forbidden references to window/document');
  }

  // Regression guard: the __vitePreload no-op must replace Vite's helper, not
  // a business function.
  const noopNeedle = 'const __vitePreload=function';
  const noopIdx = code.indexOf(noopNeedle);
  if (noopIdx !== -1 && /const __vitePreload=function\(fn\)/.test(code) === false
      && /const __vitePreload=function\(\)/.test(code)) {
    const noopLine = code.slice(0, noopIdx).split('\n').length;
    if (noopLine > 25) {
      const prefix = code.slice(Math.max(0, noopIdx - 8), noopIdx);
      const atBoundary = /\)\(\);\s*$/.test(prefix);
      if (!atBoundary) {
        console.error(`\n  [SW] ⚠️  __vitePreload no-op found at line ${noopLine} without a module boundary.`);
        console.error('  Expected after `)();` (Vite helper) or near the top. This means');
        console.error('  fixServiceWorker() replaced business code — check the matcher.\n');
        throw new Error('SW bundle validation: __vitePreload no-op injected into business code');
      }
    }
  }

  // detectScriptRel 剥离不完整时会留下行首 `)();`，Chrome 报 Unexpected token ')'
  const strayClose = code.split('\n').findIndex((line) => /^\s*\)\(\);/.test(line));
  if (strayClose !== -1) {
    console.error(`\n  [SW] ⚠️  Line ${strayClose + 1}: leftover \`)();\` from Vite preload stripping.`);
    console.error('  Service Worker would fail to parse (Unexpected token \')\').\n');
    throw new Error('SW bundle validation: leftover )(); from preload helper strip');
  }

  // Regression guard: Readability's _cleanConditionally defines
  // `const shouldRemoveNode = () => { … };` then calls it. The old preload regex
  // replaced that definition with the no-op, making every extraction throw a
  // ReferenceError. Verify the definition still exists if the call site does.
  if (code.includes('shouldRemoveNode()') && !code.includes('const shouldRemoveNode')) {
    console.error('\n  [SW] ⚠️  Readability `shouldRemoveNode` definition was swallowed by');
    console.error('  fixServiceWorker() — extraction will throw ReferenceError.\n');
    throw new Error('SW bundle validation: Readability shouldRemoveNode definition missing');
  }

  console.log('  [SW] Post-build validation passed');
}

/**
 * Chrome 扩展页面没有 Node 的 process。echarts/zrender 调试分支读
 * process.env.NODE_ENV；即使 Vite define 漏掉，也把残留替换掉。
 */
function fixPlotRuntime() {
  const file = resolve(dist, 'lib/plot-runtime.js');
  if (!existsSync(file)) throw new Error('plot-runtime bundle missing: ' + file);
  let code = readFileSync(file, 'utf8');
  code = code.replace(/\bprocess\.env\.NODE_ENV\b/g, '"production"');
  if (/\bprocess\.env\b/.test(code)) {
    throw new Error('plot-runtime still references process.env (Chrome has no Node process)');
  }
  if (!/\bexport\s*\{[^}]*renderEChart/.test(code)) {
    throw new Error('plot-runtime missing named export renderEChart');
  }
  writeFileSync(file, code);
  console.log('  [plot] process.env stripped; renderEChart export present');
}

/* ---- Build ---- */

// Build background SW
await build({
  root,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'background/service-worker': resolve(root, 'src/background/service-worker.js'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
    modulePreload: { polyfill: false },
    target: 'esnext',
    minify: false,
  },
});

// Build content script - single file.
// XML/RSS 页 createElement('div').style 为 undefined，react-dom 会抛
// "Cannot use 'in' operator to search for 'animation' in undefined"。
// banner 必须在任何依赖求值之前跑。
const contentXmlStyleShim =
  'try{var _ce=document.createElement("div");if(_ce&&_ce.style==null){var _pr=Object.getPrototypeOf(_ce);_pr&&Object.defineProperty(_pr,"style",{configurable:true,get:function(){return this.__citecatStyle||(this.__citecatStyle={})}})}}catch(_e){}';
await build({
  root,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'content/global': resolve(root, 'src/content/global.js'),
      },
      output: {
        entryFileNames: '[name].js',
        inlineDynamicImports: true,
        banner: contentXmlStyleShim,
      },
    },
    modulePreload: { polyfill: false },
  },
});

// Build side panel (browser target)
await build({
  root,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        'sidepanel/panel': resolve(root, 'src/sidepanel/panel.js'),
        'reader/reader': resolve(root, 'src/reader/reader.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    modulePreload: { polyfill: false },
  },
});

// Fix SW: remove Vite's browser-specific preload code, then validate
fixServiceWorker();
validateSwBundle();

// ECharts 运行时独立入口：按需动态 import，不进 SW / content 常驻包。
// 浮动窗 content script 经 chrome.runtime.getURL 加载，故需 web_accessible_resources。
// Vite lib 模式不会注入 Node 的 process；echarts/zrender 仍读 process.env.NODE_ENV，
// 在扩展页面会变成 ReferenceError: process is not defined。
await build({
  root,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  esbuild: {
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(root, 'src/lib/plot-runtime.js'),
      formats: ['es'],
      fileName: () => 'lib/plot-runtime.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    modulePreload: { polyfill: false },
    target: 'esnext',
    minify: true,
  },
});
fixPlotRuntime();

// Copy manifest
copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));

// Copy HTML files and generate with correct script references
function copyHtml(src, dest, scripts) {
  const dir = dirname(dest);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let html = readFileSync(src, 'utf-8');
  html = html.replace(/<script type="module" src="[^"]*"><\/script>/g, '');
  const scriptTags = scripts.map(s => `<script type="module" src="${s}"></script>`).join('\n  ');
  html = html.replace('</body>', `  ${scriptTags}\n</body>`);
  writeFileSync(dest, html);
}

copyHtml(
  resolve(root, 'src/sidepanel/index.html'),
  resolve(dist, 'src/sidepanel/index.html'),
  ['../../sidepanel/panel.js']
);

// 文档阅读器（PDF / DOCX / XLSX / CSV 划词、标注、收藏、AI）
copyHtml(
  resolve(root, 'src/reader/index.html'),
  resolve(dist, 'src/reader/index.html'),
  ['../../reader/reader.js']
);

// Copy CSS files
function copyCss(src, dest) {
  const dir = dirname(dest);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  copyFileSync(src, dest);
}

copyCss(resolve(root, 'src/sidepanel/style.css'), resolve(dist, 'src/sidepanel/style.css'));
const themeBootDir = resolve(dist, 'src/lib');
if (!existsSync(themeBootDir)) mkdirSync(themeBootDir, { recursive: true });
copyFileSync(resolve(root, 'src/lib/theme-boot.js'), resolve(themeBootDir, 'theme-boot.js'));
copyCss(resolve(root, 'src/reader/reader.css'), resolve(dist, 'src/reader/reader.css'));

// Copy icon
const iconDir = resolve(dist, 'icon');
if (!existsSync(iconDir)) mkdirSync(iconDir, { recursive: true });
copyFileSync(resolve(root, 'icon/logo.png'), resolve(iconDir, 'logo.png'));

console.log('Build complete!');
