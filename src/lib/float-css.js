/**
 * 浮动 UI 样式（划词工具条 / 检视提示 / 多选框 / 标注浮层 / 聊天窗 / 轻提示）。
 * content script（shadow DOM 内）与文档阅读器（普通 DOM）共用同一份样式，
 * 保证两个宿主 UI 一致（功能平价）。新增浮动 UI 样式时改这里。
 */
export const FLOAT_UI_CSS = `
  .inspect-tip {
    position: fixed; z-index: 2147483646;
    display: none;
    background: #18181b; color: #fafafa;
    font-size: 11px;
    font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
    padding: 3px 10px; border-radius: 9999px;
    pointer-events: none; white-space: nowrap;
    box-shadow: 0 8px 28px rgba(16,24,40,0.12);
    /* 悬停显示时播放（display none->block 会重启动画）：聚焦模糊渐显
       （blur + saturate bloom，模拟镜头对焦"咔哒"合焦感） */
    animation: tip-in 240ms cubic-bezier(0.34,1.25,0.64,1) both;
    will-change: opacity, transform, filter;
  }
  .inspect-tip code { color: #aac0f7; }
  .inspect-tip .dim { color: #a1a1aa; }

  .sel-bar {
    position: fixed; z-index: 2147483646;
    display: flex; gap: 2px; align-items: center;
    background: #18181b; border-radius: 9999px;
    padding: 4px;
    box-shadow: 0 8px 28px rgba(16,24,40,0.16);
    animation: bar-in 280ms cubic-bezier(0.34,1.25,0.64,1) both;
    will-change: opacity, transform, filter;
  }
  .sel-btn {
    display: inline-flex; align-items: center; gap: 5px;
    border: none; background: transparent; color: #d4d4da;
    font-size: 12px; font-weight: 500;
    font-family: 'Inter', -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    padding: 5px 10px; border-radius: 9999px;
    cursor: pointer; white-space: nowrap;
    transition: background 120ms, color 120ms;
  }
  .sel-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
  .sel-btn.primary { color: #aac0f7; }
  .sel-btn.primary:hover { background: rgba(138,167,242,0.18); color: #cbdafc; }

  /* 标注浮层里的批注说明（note）：有内容时浮层从胶囊变圆角卡片，note 独占首行 */
  .sel-bar .ann-note {
    display: block;
    flex-basis: 100%;
    font-size: 12px;
    line-height: 1.55;
    color: #e4e4e7;
    text-align: left;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .sel-bar.has-note {
    flex-wrap: wrap;
    border-radius: 12px;
    max-width: 320px;
    padding: 8px 10px;
    gap: 4px;
  }
  .sel-bar.has-note .ann-note {
    padding: 0 2px 6px;
    border-bottom: 1px solid rgba(255,255,255,0.14);
    margin-bottom: 2px;
  }

  .mini-toast {
    position: fixed; bottom: 32px; left: 50%;
    transform: translateX(-50%) translateY(10px);
    z-index: 2147483646;
    background: #18181b; color: #fafafa;
    font-size: 12.5px;
    font-family: 'Inter', -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    padding: 8px 18px; border-radius: 9999px;
    opacity: 0; pointer-events: none;
    filter: blur(8px) saturate(1.2);
    transition: opacity 260ms cubic-bezier(0.16,1,0.3,1),
                transform 260ms cubic-bezier(0.34,1.25,0.64,1),
                filter 260ms cubic-bezier(0.16,1,0.3,1);
    will-change: opacity, transform, filter;
  }
  .mini-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); filter: none; }

  /* 检视模式多选框（Ctrl+点击 累计选中，随滚动/缩放重绘） */
  .multi-frame {
    position: fixed; z-index: 2147483645;
    border: 2px solid #4e75df; border-radius: 5px;
    pointer-events: none;
    box-shadow: 0 0 0 1px rgba(78,117,223,0.25);
  }
  /* 多选操作条（底部居中，元素级批量操作入口） */
  .multi-bar {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 2147483646;
    display: flex; align-items: center; gap: 4px;
    background: #18181b; border-radius: 9999px;
    padding: 5px 6px 5px 14px;
    box-shadow: 0 8px 28px rgba(16,24,40,0.18);
    animation: bar-in 280ms cubic-bezier(0.34,1.25,0.64,1) both;
    will-change: opacity, transform, filter;
  }
  .mb-count { color: #a1a1aa; font-size: 11.5px; font-weight: 500; margin-right: 4px; white-space: nowrap; }
  .mb-btn {
    display: inline-flex; align-items: center;
    border: none; background: transparent; color: #d4d4da;
    font-size: 12px; font-weight: 500;
    font-family: 'Inter', -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    padding: 5px 10px; border-radius: 9999px;
    cursor: pointer; white-space: nowrap;
    transition: background 120ms, color 120ms;
  }
  .mb-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
  .mb-btn.primary { color: #aac0f7; }
  .mb-btn.primary:hover { background: rgba(138,167,242,0.18); color: #cbdafc; }
  .mb-btn.danger { color: #fca5a5; }
  .mb-btn.danger:hover { background: rgba(248,113,113,0.15); color: #fecaca; }

  /* ---- 浮动 AI 聊天窗（元素/划词提问） ---- */
  .chat-win {
    position: fixed; z-index: 2147483646;
    width: 380px; max-height: 420px;
    display: none; flex-direction: column;
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 16px;
    box-shadow: 0 8px 28px rgba(16,24,40,0.12);
    font-family: 'Inter', -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 13px;
    overflow: hidden;
    transform-origin: top center; /* 缩放锚点：从选区位置向上长出 */
    transition: max-height 280ms cubic-bezier(0.34,1.25,0.64,1);
    will-change: opacity, transform, filter, max-height;
  }
  .chat-win.show {
    display: flex;
    /* 打开动画：spring 非线性（与侧栏/工具栏同款曲线）+ 聚焦模糊 */
    animation: chatWinIn 280ms cubic-bezier(0.34,1.25,0.64,1) both;
  }
  .chat-win.cw-min { max-height: 40px; }
  .chat-win.cw-min .cw-body, .chat-win.cw-min .cw-input { display: none; }
  @keyframes chatWinIn {
    from { opacity: 0; transform: translateY(10px) scale(0.96); filter: blur(12px) saturate(1.3); }
    to   { opacity: 1; transform: translateY(0) scale(1); filter: none; }
  }
  .cw-head {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px 8px 14px;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    cursor: grab; flex-shrink: 0;
    user-select: none;
  }
  .cw-dot { width: 8px; height: 8px; border-radius: 50%; background: #d97706; flex-shrink: 0; }
  .cw-label {
    flex: 1; min-width: 0;
    font-size: 11.5px; font-weight: 500; color: #6b6b73;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .cw-btn {
    width: 26px; height: 26px; border: none; background: transparent;
    color: #92929b; border-radius: 6px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 14px; line-height: 1;
    transition: background 120ms, color 120ms;
  }
  .cw-btn:hover { background: #f4f4f5; color: #18181b; }
  .cw-body {
    flex: 1; overflow-y: auto; padding: 12px 14px;
    display: flex; flex-direction: column; gap: 10px;
    min-height: 0; max-height: 300px;
  }
  /* 引用内容块：让用户确认 AI 正在看什么（安全感） */
  /* 引用内容块：辅助信息（确认 AI 在看什么），按设计准则弱化 ——
     无强调背景、徽章用中性灰、文本用 muted 色，不抢对话主体 */
  .cw-ctx {
    border-bottom: 1px solid rgba(0,0,0,0.06);
    padding: 6px 14px 8px;
    flex-shrink: 0;
  }
  .cw-ctx-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .cw-ctx-toggle {
    margin-left: auto; border: none; background: transparent;
    color: #92929b; font-size: 11px; cursor: pointer; font-family: inherit;
  }
  .cw-ctx-toggle:hover { color: #52525b; }
  .cw-ctx-body {
    font-size: 12px; line-height: 1.6; color: #6b6b73;
    border-left: 2px solid rgba(0,0,0,0.12);
    padding-left: 10px;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; word-break: break-word; white-space: pre-wrap;
  }
  .cw-ctx-body.expanded { -webkit-line-clamp: unset; display: block; }
  /* 引用内容 / 元素数据 切换 */
  .cw-tabs {
    display: flex; gap: 2px;
    padding: 6px 10px 0;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    flex-shrink: 0;
  }
  .cw-tab {
    border: none; background: transparent;
    font-size: 11.5px; font-weight: 500; font-family: inherit;
    color: #6b6b73; cursor: pointer;
    padding: 5px 10px; border-radius: 8px 8px 0 0;
    border-bottom: 2px solid transparent;
    transition: color 120ms, border-color 120ms;
  }
  .cw-tab:hover { color: #18181b; }
  .cw-tab.active { color: #4e75df; border-bottom-color: #4e75df; }
  /* 元素数据视图 */
  .cw-data {
    border-bottom: 1px solid rgba(0,0,0,0.08);
    padding: 8px 14px 10px;
    max-height: 200px; overflow-y: auto;
    flex-shrink: 0;
  }
  .cw-data-empty { font-size: 12px; color: #92929b; padding: 4px 0; }
  .cw-ds { margin-bottom: 8px; }
  .cw-ds:last-child { margin-bottom: 0; }
  .cw-ds-head { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
  .cw-ds-title { font-size: 11px; font-weight: 600; color: #3f3f46; }
  .cw-ds-badge {
    font-size: 10px; font-weight: 600;
    color: #4267c4; background: rgba(78,117,223,0.10);
    padding: 1px 8px; border-radius: 9999px;
  }
  .cw-ds-btn {
    margin-left: auto; border: 1px solid rgba(0,0,0,0.14);
    background: transparent; color: #3f3f46;
    font-size: 11px; font-family: inherit; font-weight: 500;
    padding: 2px 10px; border-radius: 9999px; cursor: pointer;
    transition: all 120ms;
  }
  .cw-ds-btn:hover { border-color: rgba(78,117,223,0.35); color: #4e75df; background: rgba(78,117,223,0.06); }
  .cw-ds-pre {
    margin: 0; padding: 6px 10px;
    background: rgba(0,0,0,0.04);
    border-radius: 6px;
    font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
    font-size: 11px; line-height: 1.6; color: #52525b;
    white-space: pre-wrap; word-break: break-word;
    max-height: 120px; overflow-y: auto;
  }
  .cw-ds-pre.collapsed { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .cw-ds-dom { font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace; font-size: 11px; color: #4267c4; word-break: break-all; }
  .cw-msg { max-width: 86%; padding: 8px 12px; border-radius: 12px; font-size: 13px; line-height: 1.6; animation: cwMsgIn 240ms cubic-bezier(0.34,1.25,0.64,1) both; }
  .cw-msg.user { align-self: flex-end; background: #4e75df; color: #fff; border-bottom-right-radius: 5px; }
  .cw-msg.ai { align-self: flex-start; background: #e9e9ec; color: #18181b; border-bottom-left-radius: 5px; }
  .cw-msg p { margin: 0; white-space: pre-wrap; word-break: break-word; }
  .cw-msg-label { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; margin-bottom: 2px; }
  @keyframes cwMsgIn {
    from { opacity: 0; transform: translateY(4px) scale(0.97); filter: blur(5px) saturate(1.2); }
    to   { opacity: 1; transform: translateY(0) scale(1); filter: none; }
  }
  .cw-stream { white-space: pre-wrap; }
  .cw-thinking { display: inline-flex; gap: 4px; padding: 4px 0; }
  .cw-thinking span { width: 5px; height: 5px; border-radius: 50%; background: #92929b; animation: cw-bounce 1.1s ease-in-out infinite; }
  .cw-thinking span:nth-child(2) { animation-delay: 0.15s; }
  .cw-thinking span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes cw-bounce { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-3px); opacity: 1; } }
  /* thinking-orbs 容器（与侧边栏同一套 AI 思考动画）+ 右侧 shimmer 文字行 */
  .cw-thinking-row { display: inline-flex; align-items: center; gap: 8px; padding: 2px 0; max-width: 100%; }
  .cw-thinking-orb { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; flex: none; }
  .cw-thinking-text {
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* 蓝底高光 shimmer（浅色主题，业界标准参数）：同色相浅蓝 tint 软渐变 */
    color: #4e75df;
    background: linear-gradient(90deg, #4e75df 0%, #4e75df 42%, #8ca5ea 46%, #afc1f1 50%, #8ca5ea 54%, #4e75df 58%, #4e75df 100%);
    background-size: 200% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: cw-shimmer 2.5s ease-in-out infinite;
  }
  .cw-thinking-text.error { color: #dc2626; background: none; -webkit-text-fill-color: #dc2626; animation: none; }
  .cw-subagents { display: flex; flex-direction: column; gap: 6px; margin: 6px 0 8px; }
  .cw-subagents:empty { display: none; margin: 0; }
  .cw-subagent { border: 1px solid rgba(0,0,0,.08); border-radius: 8px; background: rgba(255,255,255,.55); }
  .cw-subagent > summary { display: flex; align-items: center; gap: 6px; list-style: none; cursor: pointer; padding: 6px 8px; font-size: 12px; }
  .cw-subagent > summary::-webkit-details-marker { display: none; }
  .cw-subagent-type { font-weight: 700; color: #4e75df; flex: none; }
  .cw-subagent-desc { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cw-subagent-bg { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: #e8eefc; color: #4e75df; }
  .cw-subagent-state { flex: none; color: #71717a; font-size: 11px; }
  .cw-subagent[data-status="running"] .cw-subagent-state { color: #4e75df; }
  .cw-subagent[data-status="error"] .cw-subagent-state { color: #dc2626; }
  .cw-subagent-live { display: flex; align-items: center; gap: 8px; padding: 0 8px 8px; max-width: 100%; }
  .cw-subagent-live[hidden] { display: none; }
  .cw-subagent-shimmer {
    font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    color: #71717a;
    background: linear-gradient(90deg, #71717a 0%, #71717a 42%, #a1a1aa 46%, #e4e4e7 50%, #a1a1aa 54%, #71717a 58%, #71717a 100%);
    background-size: 200% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    animation: cw-shimmer 2.5s ease-in-out infinite;
  }
  .cw-subagent-shimmer.error { color: #dc2626; background: none; -webkit-text-fill-color: #dc2626; animation: none; }
  .cw-subagent-scroll {
    max-height: 220px; overflow-y: auto; overscroll-behavior: contain;
    border-top: 1px solid rgba(0,0,0,.08); padding: 6px 8px 4px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .cw-subagent-label { font-size: 10px; font-weight: 700; letter-spacing: .04em; color: #71717a; }
  .cw-subagent-prompt-text {
    font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; color: #52525b;
  }
  .cw-subagent-stream {
    margin: 0; padding: 0; font-size: 13px; line-height: 1.55;
    white-space: pre-wrap; word-break: break-word; color: #18181b;
  }
  .cw-subagent-empty { font-size: 12px; color: #a1a1aa; }
  .cw-subagent-error { padding: 0 8px 8px; font-size: 11px; color: #dc2626; }
  @keyframes cw-shimmer {
    0%   { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .cw-err { color: #dc2626; font-size: 12px; padding: 2px; }
  .chat-live-charts { display: flex; flex-direction: column; gap: 8px; margin: 8px 0 4px; width: 100%; }
  .chat-chart-card {
    background: #f7f4ee; border: 1px solid rgba(0,0,0,0.08);
    border-radius: 12px; padding: 8px 10px 6px; overflow: visible;
  }
  .chat-chart-card .chat-chart { overflow: hidden; border-radius: 8px; }
  .chat-chart-title { font-size: 12px; font-weight: 600; color: #18181b; margin-bottom: 6px; }
  .chat-chart { width: 100%; height: 300px; }
  /* 任务清单卡（单实例，随最新一条 AI 消息就地更新） */
  .cw-plan { border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; background: #fff; margin: 8px 0 4px; overflow: hidden; max-width: 100%; }
  .cw-plan.is-done { background: #f4f4f5; }
  .cw-plan > .cw-plan-head { display: flex; align-items: center; gap: 8px; list-style: none; cursor: pointer; padding: 7px 10px; font-size: 12px; }
  .cw-plan > .cw-plan-head::-webkit-details-marker { display: none; }
  .cw-plan-title { font-weight: 600; color: #18181b; flex: none; }
  .cw-plan-count { flex: none; color: #6b6b73; font-variant-numeric: tabular-nums; }
  .cw-plan-bar { flex: 1; min-width: 24px; height: 3px; border-radius: 999px; background: rgba(0,0,0,0.08); overflow: hidden; }
  .cw-plan-bar > i { display: block; height: 100%; background: #4e75df; border-radius: 999px; transition: width 320ms cubic-bezier(0.22,0.61,0.36,1); }
  .cw-plan.is-done .cw-plan-bar > i { background: #15803d; }
  .cw-plan-state { flex: none; font-size: 11px; color: #6b6b73; }
  .cw-plan.is-done .cw-plan-state { color: #15803d; }
  .cw-plan-list { list-style: none; margin: 0; padding: 0 10px 8px; display: flex; flex-direction: column; gap: 3px; }
  .cw-plan-item { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; line-height: 1.5; color: #52525b; padding-left: 6px; border-left: 2px solid transparent; }
  .cw-plan-dot { flex: none; width: 5px; height: 5px; margin-top: 6px; border-radius: 999px; background: #92929b; }
  .cw-plan-item.is-doing { border-left-color: #4e75df; color: #18181b; font-weight: 500; }
  .cw-plan-item.is-doing .cw-plan-dot { background: #4e75df; }
  .cw-plan-item.is-done { color: #6b6b73; }
  .cw-plan-item.is-done .cw-plan-text { text-decoration: line-through; }
  .cw-plan-item.is-done .cw-plan-dot { background: #15803d; }
  /* 文档修改卡（对话内 diff 窗口） */
  .cw-diffs { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 4px; max-width: 100%; }
  .cw-diffs:empty { display: none; margin: 0; }
  .cw-diff { border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; background: #fff; overflow: hidden; }
  .cw-diff > .cw-diff-head { display: flex; align-items: center; gap: 8px; list-style: none; cursor: pointer; padding: 7px 10px; font-size: 12px; }
  .cw-diff > .cw-diff-head::-webkit-details-marker { display: none; }
  .cw-diff-file { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #18181b; }
  .cw-diff-count { flex: none; color: #6b6b73; font-variant-numeric: tabular-nums; }
  .cw-diff-tag { flex: none; font-size: 10px; padding: 1px 6px; border-radius: 999px; background: rgba(78,117,223,0.08); color: #4e75df; }
  .cw-diff-body { max-height: 320px; overflow-y: auto; padding: 2px 10px 8px; display: flex; flex-direction: column; gap: 8px; }
  .cw-diff-item { border-left: 2px solid rgba(0,0,0,0.08); padding-left: 8px; }
  .cw-diff-item-head { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6b6b73; margin-bottom: 2px; }
  .cw-diff-op { flex: none; color: #3f3f46; font-weight: 600; }
  .cw-diff-note { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cw-diff-line { display: flex; gap: 6px; font-size: 12px; line-height: 1.55; padding: 2px 6px; border-radius: 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .cw-diff-line.is-del { background: rgba(220,38,38,0.08); color: #3f3f46; }
  .cw-diff-line.is-add { background: rgba(78,117,223,0.08); color: #18181b; }
  .cw-diff-line.is-same { color: #52525b; }
  .cw-diff-sign { flex: none; width: 10px; text-align: center; color: #6b6b73; user-select: none; }
  .cw-diff-line.is-del .cw-diff-sign { color: #dc2626; }
  .cw-diff-line.is-add .cw-diff-sign { color: #4e75df; }
  .cw-diff-text { flex: 1; min-width: 0; }
  .cw-diff-more { font-size: 11px; color: #6b6b73; padding-left: 8px; }
  .cw-diff-foot { padding: 0 10px 8px; font-size: 11px; color: #92929b; }
  /* 建议按钮（suggest_actions 工具生成） */
  .cw-suggests { display: flex; flex-wrap: wrap; gap: 6px; max-width: 86%; }
  .cw-suggest {
    border: 1px solid rgba(78,117,223,0.35);
    background: rgba(78,117,223,0.06);
    color: #4267c4;
    font-size: 12px; font-family: inherit; font-weight: 500;
    padding: 4px 12px; border-radius: 9999px; cursor: pointer;
    transition: border-color 120ms, background 120ms;
  }
  .cw-suggest:hover { border-color: rgba(78,117,223,0.5); background: rgba(78,117,223,0.12); }
  .suggestion-confirm {
    padding: 5px 14px; border: 1px solid #4e75df; border-radius: 9999px;
    background: #4e75df; color: #fff; font-family: inherit; font-size: 12px;
    font-weight: 600; cursor: pointer;
  }
  .suggestion-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
  .scope-quiz { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; max-width: 100%; }
  .scope-quiz-recap-row {
    display: flex; align-items: baseline; gap: 8px; width: 100%;
    border: 0; background: transparent; padding: 2px 0; cursor: pointer;
    text-align: left; font-family: inherit;
  }
  .scope-quiz-recap-h { font-size: 11px; color: #6b6b73; flex: none; min-width: 3.5em; }
  .scope-quiz-recap-v { font-size: 12px; color: #18181b; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scope-quiz-card {
    border: 1px solid rgba(0,0,0,0.08); border-radius: 8px;
    background: #f4f4f5; padding: 8px 10px 10px;
  }
  .scope-quiz-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  .scope-quiz-header { font-size: 12px; font-weight: 700; color: #4e75df; }
  .scope-quiz-progress { font-size: 11px; color: #6b6b73; }
  .scope-quiz-q { font-size: 13px; color: #18181b; line-height: 1.45; margin: 0 0 8px; font-weight: 500; }
  .scope-quiz-opts { display: flex; flex-direction: column; gap: 6px; }
  .scope-quiz-opt {
    display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
    width: 100%; text-align: left; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px;
    background: #fff; padding: 8px 10px; cursor: pointer; font-family: inherit; color: #18181b;
  }
  .scope-quiz-opt:hover, .scope-quiz-opt.selected { background: rgba(78,117,223,0.08); border-color: rgba(78,117,223,0.35); }
  .scope-quiz-opt-label { font-size: 13px; font-weight: 600; }
  .scope-quiz-opt.selected .scope-quiz-opt-label { color: #4e75df; }
  .scope-quiz-opt.multi { position: relative; padding-left: 28px; }
  .scope-quiz-opt.multi::before {
    content: ''; position: absolute; left: 10px; top: 12px; width: 10px; height: 10px;
    border: 1px solid #4e75df; border-radius: 3px; opacity: 0.55;
  }
  .scope-quiz-opt.multi.selected::before { background: #4e75df; opacity: 1; }
  .scope-quiz-opt.multi.selected::after {
    content: ''; position: absolute; left: 13px; top: 13px; width: 4px; height: 7px;
    border-right: 1.5px solid #fff; border-bottom: 1.5px solid #fff; transform: rotate(45deg);
  }
  .scope-quiz-other { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
  .scope-quiz-other-input {
    flex: 1; min-width: 0; border: 1px solid rgba(0,0,0,0.08); border-radius: 10px;
    background: #fff; color: #18181b; font: 12.5px/1.4 inherit; padding: 7px 10px; outline: none;
  }
  .scope-quiz-foot { display: flex; justify-content: flex-end; margin-top: 8px; }
  .scope-quiz-locked {
    font-size: 11px; color: #4e75df; font-weight: 600; padding: 6px 8px;
    border: 1px solid rgba(78,117,223,0.35); background: rgba(78,117,223,0.08); border-radius: 8px;
  }
  .scope-quiz-locked.skipped { color: #6b6b73; border-color: rgba(0,0,0,0.08); background: #f4f4f5; font-weight: 500; }
  .scope-quiz.compact .scope-quiz-opt-desc { display: none; }
  .cw-input {
    display: flex; align-items: center; gap: 6px;
    padding: 10px 12px; border-top: 1px solid rgba(0,0,0,0.08);
    flex-shrink: 0;
  }
  .cw-input .ci-wrap {
    flex: 1; display: flex; align-items: center;
    background: #f4f4f5; border: 1px solid transparent;
    border-radius: 9999px; padding: 0 14px; height: 34px;
  }
  .cw-input .ci-wrap:focus-within {
    background: #fff; border-color: rgba(78,117,223,0.35);
    box-shadow: 0 0 0 3px rgba(78,117,223,0.08);
  }
  .cw-input input {
    flex: 1; border: none; background: transparent; outline: none;
    font-family: inherit; font-size: 12.5px; color: #18181b;
  }
  .cw-input input::placeholder { color: #92929b; }
  .cw-send {
    width: 34px; height: 34px; border: none; border-radius: 50%;
    background: #4e75df; color: #fff; cursor: pointer; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 120ms;
  }
  .cw-send:hover { background: #4267c4; }
  .cw-send:disabled { opacity: 0.45; cursor: not-allowed; }
  .cw-send.stop { background: #dc2626; }
  .cw-send.stop:hover { background: #b91c1c; }

  @keyframes bar-in {
    from { opacity: 0; transform: translateY(6px) scale(0.94); filter: blur(10px) saturate(1.35); }
    to   { opacity: 1; transform: translateY(0) scale(1); filter: none; }
  }

  @keyframes tip-in {
    from { opacity: 0; transform: translateY(-2px) scale(0.96); filter: blur(8px) saturate(1.25); }
    to   { opacity: 1; transform: translateY(0) scale(1); filter: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .inspect-tip, .sel-bar, .multi-bar, .chat-win.show, .cw-msg { animation: none; }
    .mini-toast { filter: none; transition: none; }
  }

  
html[data-theme="dark"] .inspect-tip,
:host([data-theme="dark"]) .inspect-tip,
html[data-theme="dark"] .sel-bar,
:host([data-theme="dark"]) .sel-bar,
html[data-theme="dark"] .mini-toast,
:host([data-theme="dark"]) .mini-toast { background: #27272a; border: 1px solid rgba(255,255,255,0.10); }
html[data-theme="dark"] .inspect-tip code,
:host([data-theme="dark"]) .inspect-tip code { color: #aac0f7; }
html[data-theme="dark"] .chat-win,
:host([data-theme="dark"]) .chat-win { background: #1e1e22; border-color: rgba(255,255,255,0.10); box-shadow: 0 8px 28px rgba(0,0,0,0.55); }
html[data-theme="dark"] .cw-head,
:host([data-theme="dark"]) .cw-head { border-color: rgba(255,255,255,0.08); }
html[data-theme="dark"] .cw-label,
:host([data-theme="dark"]) .cw-label { color: #9d9da6; }
html[data-theme="dark"] .cw-btn,
:host([data-theme="dark"]) .cw-btn { color: #7c7c86; }
html[data-theme="dark"] .cw-btn:hover,
:host([data-theme="dark"]) .cw-btn:hover { background: #26262b; color: #f4f4f5; }
html[data-theme="dark"] .cw-msg.ai,
:host([data-theme="dark"]) .cw-msg.ai { background: #32323a; color: #f4f4f5; }
html[data-theme="dark"] .cw-thinking-text,
:host([data-theme="dark"]) .cw-thinking-text {
      /* 深色主题：亮变体 #8aa7f2 底 + 同色相浅蓝 tint 软渐变高光 */
      color: #8aa7f2;
      background: linear-gradient(90deg, #8aa7f2 0%, #8aa7f2 42%, #a7bdf5 46%, #b9caf7 50%, #a7bdf5 54%, #8aa7f2 58%, #8aa7f2 100%);
      background-size: 200% 100%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
html[data-theme="dark"] .cw-thinking-text.error,
:host([data-theme="dark"]) .cw-thinking-text.error { color: #f87171; background: none; -webkit-text-fill-color: #f87171; }
html[data-theme="dark"] .cw-subagent-shimmer,
:host([data-theme="dark"]) .cw-subagent-shimmer {
      color: #a1a1aa;
      background: linear-gradient(90deg, #a1a1aa 0%, #a1a1aa 42%, #d4d4d8 46%, #f4f4f5 50%, #d4d4d8 54%, #a1a1aa 58%, #a1a1aa 100%);
      background-size: 200% 100%;
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }
html[data-theme="dark"] .cw-subagent-stream,
:host([data-theme="dark"]) .cw-subagent-stream { color: #f4f4f5; }
html[data-theme="dark"] .cw-subagent-scroll,
:host([data-theme="dark"]) .cw-subagent-scroll { border-top-color: rgba(255,255,255,0.1); }
html[data-theme="dark"] .cw-subagent-prompt-text,
:host([data-theme="dark"]) .cw-subagent-prompt-text { color: #a1a1aa; }
html[data-theme="dark"] .cw-subagent-empty,
:host([data-theme="dark"]) .cw-subagent-empty { color: #71717a; }
html[data-theme="dark"] .cw-ctx,
:host([data-theme="dark"]) .cw-ctx { border-color: rgba(255,255,255,0.08); }
html[data-theme="dark"] .cw-ctx-toggle,
:host([data-theme="dark"]) .cw-ctx-toggle { color: #7c7c86; }
html[data-theme="dark"] .cw-ctx-toggle:hover,
:host([data-theme="dark"]) .cw-ctx-toggle:hover { color: #d4d4da; }
html[data-theme="dark"] .cw-ctx-body,
:host([data-theme="dark"]) .cw-ctx-body { color: #9d9da6; border-left-color: rgba(255,255,255,0.15); }
html[data-theme="dark"] .cw-tabs,
:host([data-theme="dark"]) .cw-tabs { border-color: rgba(255,255,255,0.08); }
html[data-theme="dark"] .cw-tab,
:host([data-theme="dark"]) .cw-tab { color: #9d9da6; }
html[data-theme="dark"] .cw-tab:hover,
:host([data-theme="dark"]) .cw-tab:hover { color: #f4f4f5; }
html[data-theme="dark"] .cw-tab.active,
:host([data-theme="dark"]) .cw-tab.active { color: #aac0f7; }
html[data-theme="dark"] .cw-data,
:host([data-theme="dark"]) .cw-data { border-color: rgba(255,255,255,0.08); }
html[data-theme="dark"] .cw-data-empty,
:host([data-theme="dark"]) .cw-data-empty { color: #7c7c86; }
html[data-theme="dark"] .cw-ds-title,
:host([data-theme="dark"]) .cw-ds-title { color: #d4d4da; }
html[data-theme="dark"] .cw-ds-badge,
:host([data-theme="dark"]) .cw-ds-badge { color: #aac0f7; background: rgba(138,167,242,0.14); }
html[data-theme="dark"] .cw-ds-btn,
:host([data-theme="dark"]) .cw-ds-btn { border-color: rgba(255,255,255,0.16); color: #d4d4da; }
html[data-theme="dark"] .cw-ds-btn:hover,
:host([data-theme="dark"]) .cw-ds-btn:hover { border-color: rgba(138,167,242,0.4); color: #aac0f7; background: rgba(138,167,242,0.10); }
html[data-theme="dark"] .cw-ds-pre,
:host([data-theme="dark"]) .cw-ds-pre { background: rgba(255,255,255,0.06); color: #c4c4cc; }
html[data-theme="dark"] .cw-ds-dom,
:host([data-theme="dark"]) .cw-ds-dom { color: #aac0f7; }
html[data-theme="dark"] .cw-input,
:host([data-theme="dark"]) .cw-input { border-color: rgba(255,255,255,0.08); }
html[data-theme="dark"] .cw-input .ci-wrap,
:host([data-theme="dark"]) .cw-input .ci-wrap { background: #26262b; }
html[data-theme="dark"] .cw-input .ci-wrap:focus-within,
:host([data-theme="dark"]) .cw-input .ci-wrap:focus-within { background: #1e1e22; }
html[data-theme="dark"] .cw-input input,
:host([data-theme="dark"]) .cw-input input { color: #f4f4f5; }
html[data-theme="dark"] .cw-input input::placeholder,
:host([data-theme="dark"]) .cw-input input::placeholder { color: #7c7c86; }
html[data-theme="dark"] .cw-tool,
:host([data-theme="dark"]) .cw-tool { color: #9d9da6; }
html[data-theme="dark"] .cw-suggest,
:host([data-theme="dark"]) .cw-suggest { border-color: rgba(138,167,242,0.4); background: rgba(138,167,242,0.12); color: #aac0f7; }
html[data-theme="dark"] .cw-suggest:hover,
:host([data-theme="dark"]) .cw-suggest:hover { background: rgba(138,167,242,0.2); }
html[data-theme="dark"] .suggestion-confirm,
:host([data-theme="dark"]) .suggestion-confirm { background: #8aa7f2; border-color: #8aa7f2; color: #0f0f1a; }
html[data-theme="dark"] .scope-quiz-card,
:host([data-theme="dark"]) .scope-quiz-card { background: #26262b; border-color: rgba(255,255,255,0.10); }
html[data-theme="dark"] .scope-quiz-header,
:host([data-theme="dark"]) .scope-quiz-header { color: #8aa7f2; }
html[data-theme="dark"] .scope-quiz-progress,
:host([data-theme="dark"]) .scope-quiz-progress,
html[data-theme="dark"] .scope-quiz-recap-h,
:host([data-theme="dark"]) .scope-quiz-recap-h { color: #9d9da6; }
html[data-theme="dark"] .scope-quiz-q,
:host([data-theme="dark"]) .scope-quiz-q,
html[data-theme="dark"] .scope-quiz-recap-v,
:host([data-theme="dark"]) .scope-quiz-recap-v,
html[data-theme="dark"] .scope-quiz-opt-label,
:host([data-theme="dark"]) .scope-quiz-opt-label { color: #f4f4f5; }
html[data-theme="dark"] .scope-quiz-opt,
:host([data-theme="dark"]) .scope-quiz-opt { background: #1e1e22; border-color: rgba(255,255,255,0.10); color: #f4f4f5; }
html[data-theme="dark"] .scope-quiz-opt:hover,
:host([data-theme="dark"]) .scope-quiz-opt:hover,
html[data-theme="dark"] .scope-quiz-opt.selected,
:host([data-theme="dark"]) .scope-quiz-opt.selected { background: rgba(138,167,242,0.14); border-color: rgba(138,167,242,0.40); }
html[data-theme="dark"] .scope-quiz-opt.selected .scope-quiz-opt-label,
:host([data-theme="dark"]) .scope-quiz-opt.selected .scope-quiz-opt-label { color: #8aa7f2; }
html[data-theme="dark"] .scope-quiz-other-input,
:host([data-theme="dark"]) .scope-quiz-other-input { background: #1e1e22; border-color: rgba(255,255,255,0.10); color: #f4f4f5; }
html[data-theme="dark"] .scope-quiz-locked,
:host([data-theme="dark"]) .scope-quiz-locked { color: #8aa7f2; border-color: rgba(138,167,242,0.40); background: rgba(138,167,242,0.14); }
html[data-theme="dark"] .scope-quiz-locked.skipped,
:host([data-theme="dark"]) .scope-quiz-locked.skipped { color: #9d9da6; border-color: rgba(255,255,255,0.10); background: #26262b; }
html[data-theme="dark"] .chat-chart-card,
:host([data-theme="dark"]) .chat-chart-card { background: #26262b; border-color: rgba(255,255,255,0.10); }
html[data-theme="dark"] .chat-chart-title,
:host([data-theme="dark"]) .chat-chart-title { color: #f4f4f5; }
  
`;
