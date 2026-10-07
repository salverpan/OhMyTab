/* Pyodide 沙箱页（无 chrome.*）。由侧栏 iframe 经 postMessage 驱动。 */
const INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
const ALLOWED_PACKAGES = {
  numpy: true,
  pandas: true,
  matplotlib: true,
  scipy: true,
  'scikit-learn': true,
  sklearn: true,
  pillow: true,
  micropip: true,
  openpyxl: true,
  pyyaml: true,
};

let pyodide = null;
let loading = null;

function reply(id, payload) {
  parent.postMessage({ source: 'citecat-pyodide', id, ...payload }, '*');
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (!loading) {
    loading = loadPyodide({ indexURL: INDEX_URL });
  }
  pyodide = await loading;
  return pyodide;
}

function mkdirp(FS, dir) {
  const parts = dir.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += '/' + part;
    try { FS.mkdir(cur); } catch (_) {}
  }
}

function writeTree(FS, files) {
  mkdirp(FS, '/workspace');
  for (const f of files || []) {
    const path = String(f.path || '').replace(/^\/+/, '');
    if (!path || path.includes('..')) continue;
    const full = '/workspace/' + path;
    const dir = full.slice(0, full.lastIndexOf('/'));
    if (dir) mkdirp(FS, dir);
    FS.writeFile(full, String(f.content ?? ''), { encoding: 'utf8' });
  }
}

function walkTextFiles(FS, dir, out) {
  let names;
  try { names = FS.readdir(dir); } catch (_) { return; }
  for (const name of names) {
    if (name === '.' || name === '..') continue;
    const full = dir + '/' + name;
    let st;
    try { st = FS.stat(full); } catch (_) { continue; }
    if (FS.isDir(st.mode)) walkTextFiles(FS, full, out);
    else {
      try {
        const content = FS.readFile(full, { encoding: 'utf8' });
        out.push({ path: full.replace(/^\/workspace\//, ''), content });
      } catch (_) {}
    }
  }
}

async function runJob(msg) {
  const py = await ensurePyodide();
  const wanted = [];
  for (const raw of msg.packages || []) {
    const name = String(raw || '').trim().toLowerCase();
    if (!name) continue;
    if (!ALLOWED_PACKAGES[name]) {
      throw new Error(`不允许安装包「${name}」。可用：${Object.keys(ALLOWED_PACKAGES).join(', ')}`);
    }
    wanted.push(name === 'sklearn' ? 'scikit-learn' : name);
  }
  if (wanted.length) await py.loadPackage(wanted);
  writeTree(py.FS, msg.files);
  const code = String(msg.code || '');
  const wrapped = [
    'import sys, io, os, traceback',
    'os.chdir("/workspace")',
    '_out, _err = io.StringIO(), io.StringIO()',
    'sys.stdout, sys.stderr = _out, _err',
    '_result = None',
    'try:',
    '    _g = {"__name__": "__main__"}',
    '    exec(compile(__user_code__, "<workspace>", "exec"), _g)',
    '    _result = _g.get("_", _g.get("result", None))',
    'except Exception:',
    '    traceback.print_exc()',
    '(_out.getvalue(), _err.getvalue(), repr(_result) if _result is not None else "")',
  ].join('\n');
  py.globals.set('__user_code__', code);
  const tuple = await py.runPythonAsync(wrapped);
  const stdout = String(tuple[0] || '');
  const stderr = String(tuple[1] || '');
  const result = String(tuple[2] || '');
  const files = [];
  walkTextFiles(py.FS, '/workspace', files);
  return { stdout, stderr, result, files };
}

window.addEventListener('message', async (ev) => {
  const msg = ev.data;
  if (!msg || msg.target !== 'citecat-pyodide') return;
  if (msg.type === 'ping') {
    reply(msg.id, { type: 'pong' });
    return;
  }
  if (msg.type === 'run') {
    try {
      const r = await runJob(msg);
      reply(msg.id, { type: 'ok', ...r });
    } catch (err) {
      reply(msg.id, { type: 'error', error: (err && err.message) || String(err) });
    }
  }
});

parent.postMessage({ source: 'citecat-pyodide', type: 'boot' }, '*');
