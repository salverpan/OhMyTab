/* 原生 <select> 皮肤 ——
 * 问题：<select> 展开的列表由浏览器进程渲染，CSS 完全够不着（方角白底、无法跟主题）。
 * 做法：保留原生 select 在 DOM 里（a11y / 既有 change 监听 / 表单读写全部不变），
 *       套一个按钮 + 复用项目既有的 .export-dropdown 弹层；选中后写回 select.value
 *       并派发 change，调用方一行都不用改。
 * 动态增删 option 的 select（如渠道列表）由 MutationObserver 自动跟进。
 * 用法：document.querySelectorAll('select').forEach(skinNativeSelect); */

function optionText(opt) {
  return String(opt?.textContent || '').trim();
}

export function skinNativeSelect(select) {
  if (!select || select.dataset.nsSkinned === '1' || select.multiple) return;
  if (!select.parentNode) return;
  select.dataset.nsSkinned = '1';

  const wrap = document.createElement('div');
  wrap.className = 'ns-select';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'ns-select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  label.className = 'ns-select-label';

  const caret = document.createElement('span');
  caret.className = 'ns-select-caret';
  caret.setAttribute('aria-hidden', 'true');
  caret.textContent = '▾';

  trigger.append(label, caret);
  select.parentNode.insertBefore(wrap, select);
  wrap.append(select, trigger);
  select.classList.add('ns-select-native');

  let menu = null;
  let items = [];
  let active = -1;

  function syncLabel() {
    const opt = select.options[select.selectedIndex];
    label.textContent = opt ? optionText(opt) : '';
    trigger.disabled = !!select.disabled;
  }

  function close() {
    if (menu) {
      menu.remove();
      menu = null;
    }
    items = [];
    active = -1;
    trigger.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
  }

  function commit(value) {
    if (select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    syncLabel();
    close();
    trigger.focus();
  }

  function paint() {
    items.forEach((el, i) => el.classList.toggle('is-active', i === active));
    if (active >= 0) items[active]?.scrollIntoView({ block: 'nearest' });
  }

  function openMenu() {
    menu = document.createElement('div');
    menu.className = 'export-dropdown ns-select-menu';
    menu.setAttribute('role', 'listbox');
    items = [];
    Array.from(select.options).forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'export-dropdown-item';
      btn.setAttribute('role', 'option');
      btn.textContent = optionText(opt);
      btn.disabled = !!opt.disabled || !!select.disabled;
      if (opt.index === select.selectedIndex) btn.setAttribute('aria-selected', 'true');
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        commit(opt.value);
      });
      items.push(btn);
      menu.appendChild(btn);
    });
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'preset-catalog-empty';
      empty.textContent = '暂无选项';
      menu.appendChild(empty);
    }
    wrap.appendChild(menu);
    trigger.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    active = select.selectedIndex;
    paint();
  }

  trigger.addEventListener('mousedown', (e) => e.preventDefault());
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    if (select.disabled) return;
    if (menu) close();
    else openMenu();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (menu) {
        e.preventDefault();
        close();
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!menu) {
        openMenu();
        return;
      }
      if (active >= 0 && select.options[active]) commit(select.options[active].value);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!menu) {
        openMenu();
        return;
      }
      if (!items.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + items.length) % items.length;
      paint();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!menu) return;
    if (!wrap.contains(e.target)) close();
  });

  select.addEventListener('change', syncLabel);

  const mo = new MutationObserver(() => {
    syncLabel();
    if (menu) close();
  });
  mo.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });

  /* 兜底：业务代码常直接 el.value = x 而不派发 change（如恢复设置时），
   * 这里拦截实例的 value / selectedIndex setter，保证显示与实际值永远一致。 */
  try {
    if (typeof HTMLSelectElement !== 'undefined') {
      const vd = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
      if (vd && vd.get && vd.set) {
        Object.defineProperty(select, 'value', {
          configurable: true,
          get() { return vd.get.call(this); },
          set(v) { vd.set.call(this, v); syncLabel(); },
        });
      }
      const id = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
      if (id && id.get && id.set) {
        Object.defineProperty(select, 'selectedIndex', {
          configurable: true,
          get() { return id.get.call(this); },
          set(v) { id.set.call(this, v); syncLabel(); },
        });
      }
    }
  } catch (_) { /* 拦截失败就退回事件同步 */ }

  syncLabel();
}

/** 批量套皮；root 默认整个文档 */
export function skinAllNativeSelects(root = document) {
  root.querySelectorAll('select').forEach(skinNativeSelect);
}
