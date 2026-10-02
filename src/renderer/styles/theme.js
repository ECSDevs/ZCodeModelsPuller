/**
 * 完整样式注入
 * 完全遵循 ZCode Design System (DESIGN.md) 语义规范与设计规范：
 * - 字体与尺寸采用 text-ui-* 系统：text-ui-base, text-ui-sm, text-ui-xs
 * - 颜色系统统一使用 ZCode 语义变量：
 *   --color-primary, --color-secondary, --color-popover, --color-surface,
 *   --color-input, --color-border, --color-foreground, --color-foreground-subtle 等
 * - 弹窗外框采用 rounded-2xl，阴影 shadow-md，按钮统一遵循官方 Button 规范
 * - 去除违规的高饱和渐变，自适应 Light / Dark / Zai 主题
 */

export function injectStyles() {
  if (document.getElementById("zcode-model-puller-style-pro")) return;

  const style = document.createElement("style");
  style.id = "zcode-model-puller-style-pro";
  style.textContent = `
    /* 触发按钮：与官方 <Button variant="secondary" size="default" className="rounded-lg"> 完全一致 */
    #zcode-auto-pull-models-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 28px; /* h-7 */
      padding: 0 10px;
      border-radius: 8px; /* rounded-lg */
      font-size: var(--ui-font-size, 14px); /* text-ui-base */
      line-height: normal;
      font-family: inherit;
      font-weight: 500;
      white-space: nowrap;
      user-select: none;
      outline: none;
      cursor: pointer;
      border: 1px solid transparent;
      background-color: var(--color-secondary, #f4f4f5);
      color: var(--color-foreground, #18181b);
      transition: background-color 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
    }
    #zcode-auto-pull-models-btn:hover {
      background-color: color-mix(in srgb, var(--color-secondary, #f4f4f5) 80%, black 20%);
    }
    .dark #zcode-auto-pull-models-btn:hover,
    body.dark #zcode-auto-pull-models-btn:hover,
    [data-theme="dark"] #zcode-auto-pull-models-btn:hover {
      background-color: color-mix(in srgb, var(--color-secondary, #27272a) 80%, white 20%);
    }
    #zcode-auto-pull-models-btn:active {
      opacity: 0.85;
    }
    #zcode-auto-pull-models-btn.loading {
      opacity: 0.6;
      cursor: wait;
      pointer-events: none;
    }
    .zcode-pull-bolt-icon {
      width: 14px;
      height: 14px;
      color: var(--color-foreground-subtle, #71717a);
      flex-shrink: 0;
    }

    @keyframes zcodeSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .zcode-spin-icon {
      animation: zcodeSpin 1s linear infinite;
    }

    /* 弹窗遮罩：遵循 DialogOverlay (bg-black/60 backdrop-blur-xs) */
    .zcode-pull-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: zcodeFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: inherit;
      padding: 16px;
      box-sizing: border-box;
    }
    @keyframes zcodeFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* 弹窗主体：遵循 DialogContent (rounded-2xl border border-popover-border bg-popover shadow-md) */
    .zcode-pull-modal {
      width: 600px;
      max-width: 100%;
      max-height: min(48rem, calc(100vh - 4rem));
      background-color: var(--color-popover, #ffffff);
      color: var(--color-foreground, #18181b);
      border: 1px solid var(--color-popover-border, var(--color-border, #e4e4e7));
      border-radius: 16px; /* rounded-2xl */
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: zcodeScaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      outline: none;
    }
    @keyframes zcodeScaleIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }

    /* 弹窗头部 */
    .zcode-pull-header {
      padding: 16px 20px 12px 20px;
      border-bottom: 1px solid var(--color-border, #e4e4e7);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .zcode-pull-title {
      font-size: var(--ui-font-size, 14px);
      font-weight: 600;
      color: var(--color-foreground, #18181b);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .zcode-pull-close {
      background: transparent;
      border: none;
      color: var(--color-foreground-subtle, #71717a);
      cursor: pointer;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s ease, color 0.15s ease;
      padding: 0;
    }
    .zcode-pull-close:hover {
      background-color: var(--color-hover, rgba(0, 0, 0, 0.05));
      color: var(--color-foreground, #18181b);
    }

    /* 弹窗内容 */
    .zcode-pull-body {
      padding: 16px 20px;
      overflow-y: hidden;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .zcode-pull-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    /* 搜索框：遵循 Input 组件规范 (bg-input border-input-border text-ui-base) */
    .zcode-pull-search {
      flex: 1;
      height: 32px;
      background-color: var(--color-input, #ffffff);
      border: 1px solid var(--color-input-border, #d4d4d8);
      border-radius: 6px;
      padding: 0 10px;
      color: var(--color-foreground, #18181b);
      font-size: calc(var(--ui-font-size, 14px) - 1px); /* text-ui-caption */
      outline: none;
      transition: border-color 0.15s ease, background-color 0.15s ease;
      box-sizing: border-box;
    }
    .zcode-pull-search::placeholder {
      color: var(--color-foreground-subtlest, #a1a1aa);
    }
    .zcode-pull-search:hover {
      border-color: var(--color-input-border-hover, #a1a1aa);
    }
    .zcode-pull-search:focus {
      border-color: var(--color-input-border-focused, var(--color-primary, #18181b));
      background-color: var(--color-input-focused, var(--color-input, #ffffff));
    }

    .zcode-pull-btn-group {
      display: flex;
      gap: 6px;
    }
    .zcode-pull-mini-btn {
      height: 28px;
      background-color: var(--color-surface, #f4f4f5);
      border: 1px solid var(--color-border, #e4e4e7);
      color: var(--color-foreground, #18181b);
      font-size: calc(var(--ui-font-size, 14px) - 2px); /* text-ui-sm */
      padding: 0 10px;
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.15s ease, border-color 0.15s ease;
      user-select: none;
    }
    .zcode-pull-mini-btn:hover {
      background-color: var(--color-hover, rgba(0, 0, 0, 0.06));
    }

    /* 模型列表容器：遵循 border-input-border bg-input */
    .zcode-pull-list {
      flex: 1;
      max-height: 360px;
      overflow-y: auto;
      border: 1px solid var(--color-input-border, #e4e4e7);
      border-radius: 8px;
      background-color: var(--color-input, #ffffff);
    }
    .zcode-pull-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.1s ease;
      border-bottom: 1px solid var(--color-border, #f4f4f5);
    }
    .zcode-pull-item:last-child {
      border-bottom: none;
    }
    .zcode-pull-item:hover {
      background-color: var(--color-hover, rgba(0, 0, 0, 0.04));
    }
    .zcode-pull-item input[type="checkbox"] {
      margin-right: 10px;
      accent-color: var(--color-primary, #18181b);
      width: 15px;
      height: 15px;
      cursor: pointer;
      pointer-events: none;
    }
    .zcode-pull-item-name {
      flex: 1;
      font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
      font-size: calc(var(--ui-font-size, 14px) - 1px);
      color: var(--color-foreground, #18181b);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .zcode-pull-badge {
      font-size: calc(var(--ui-font-size, 14px) - 3px); /* text-ui-xs */
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 500;
      white-space: nowrap;
    }
    .zcode-pull-badge-new {
      background-color: color-mix(in srgb, var(--color-success, #10b981) 12%, transparent);
      color: var(--color-success, #059669);
      border: 1px solid color-mix(in srgb, var(--color-success, #10b981) 30%, transparent);
    }
    .zcode-pull-badge-exists {
      background-color: var(--color-surface, #f4f4f5);
      color: var(--color-foreground-subtle, #71717a);
      border: 1px solid var(--color-border, #e4e4e7);
    }

    /* 弹窗底部操作区 */
    .zcode-pull-footer {
      padding: 12px 20px;
      background-color: var(--color-surface, #fafafa);
      border-top: 1px solid var(--color-border, #e4e4e7);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .zcode-pull-count-info {
      font-size: calc(var(--ui-font-size, 14px) - 1px); /* text-ui-caption */
      color: var(--color-foreground-subtle, #71717a);
    }
    .zcode-pull-count-info strong {
      color: var(--color-foreground, #18181b);
    }
    .zcode-pull-footer-btns {
      display: flex;
      gap: 8px;
    }
    .zcode-pull-btn-cancel {
      height: 32px;
      padding: 0 14px;
      border-radius: 6px;
      font-size: calc(var(--ui-font-size, 14px) - 1px);
      font-weight: 500;
      background-color: var(--color-secondary, #f4f4f5);
      border: 1px solid var(--color-border, #e4e4e7);
      color: var(--color-foreground, #18181b);
      cursor: pointer;
      transition: background-color 0.15s ease;
      user-select: none;
    }
    .zcode-pull-btn-cancel:hover {
      background-color: var(--color-hover, rgba(0, 0, 0, 0.08));
    }
    .zcode-pull-btn-submit {
      height: 32px;
      padding: 0 16px;
      border-radius: 6px;
      font-size: calc(var(--ui-font-size, 14px) - 1px);
      font-weight: 500;
      background-color: var(--color-primary, #18181b);
      color: var(--color-primary-foreground, #ffffff);
      border: 1px solid transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.15s ease, background-color 0.15s ease;
      user-select: none;
    }
    .zcode-pull-btn-submit:hover:not(:disabled) {
      opacity: 0.9;
    }
    .zcode-pull-btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Toast 浮层提示：遵循 --color-toast 与简约阴影 */
    .zcode-custom-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2000;
      background-color: var(--color-popover, #18181b);
      color: var(--color-foreground, #f4f4f5);
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--color-popover-border, var(--color-border, rgba(255, 255, 255, 0.12)));
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      font-size: calc(var(--ui-font-size, 14px) - 1px);
      display: flex;
      align-items: center;
      gap: 8px;
      animation: zcodeToastPop 0.2s ease-out;
      pointer-events: none;
    }
    @keyframes zcodeToastPop {
      from { opacity: 0; transform: translate(-50%, -8px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }

    /* 编辑弹窗中的思考档位 (efforts) 选择行 */
    .zcode-pull-range {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 4px;
      font-size: calc(var(--ui-font-size, 14px) - 1px);
    }
    .zcode-pull-range-label {
      font-weight: 500;
      color: var(--color-foreground-subtle, #71717a);
      font-size: var(--ui-font-size, 14px);
    }
    .zcode-pull-efforts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      align-items: center;
    }
    .zcode-pull-effort {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: calc(var(--ui-font-size, 14px) - 1px);
      color: var(--color-foreground, #18181b);
      cursor: pointer;
      user-select: none;
    }
    .zcode-pull-effort input {
      accent-color: var(--color-primary, #18181b);
      margin: 0;
      width: 15px;
      height: 15px;
      cursor: pointer;
    }
    .zcode-pull-range-hint {
      color: var(--color-foreground-subtlest, #a1a1aa);
      font-size: calc(var(--ui-font-size, 14px) - 2px);
    }
  `;

  document.head.appendChild(style);
}
