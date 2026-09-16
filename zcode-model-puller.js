/**
 * ZCode 自定义模型供应商 - 自动拉取模型列表插件 (开源旗舰版)
 * 1. 极致现代视觉：精致高级渐变质感按钮（自适应深浅主题、悬停微光与物理动效）
 * 2. 100% 精准识别：外部已展示模型标注「已添加」并不勾选，未展示新模型标注「新模型」并默认勾选
 * 3. 完美交互：滚动位置丝毫不动，搜索就地过滤
 * 4. 自动原生刷新：保存后自动触发官方刷新与组件重新装载，新模型卡片秒级呈现
 * 5. 跨进程安全 IPC 桥梁：原生无 CORS 限制、极速安全持久化
 *
 * MIT License — Copyright (c) 2025 HHQ (upstream zcode-model-puller),
 * Copyright (c) 2026 zcode-model-puller contributors. 详见仓库 LICENSE。
 */
(() => {
  if (window.__ZCODE_MODEL_PULLER_LOADED_PRO__) return;
  window.__ZCODE_MODEL_PULLER_LOADED_PRO__ = true;

  console.log("[ZCode-Model-Puller] 开源旗舰版插件已装载");

  // 样式系统
  const style = document.createElement("style");
  style.id = "zcode-model-puller-style-pro";
  style.textContent = `
    :root {
      --zpull-bg: #ffffff;
      --zpull-fg: #18181b;
      --zpull-fg-muted: #71717a;
      --zpull-border: #e4e4e7;
      --zpull-border-subtle: #f4f4f5;
      --zpull-input-bg: #ffffff;
      --zpull-input-border: #d4d4d8;
      --zpull-list-bg: #fcfcfd;
      --zpull-item-hover: #f4f4f5;
      --zpull-header-bg: #fafafa;
      --zpull-footer-bg: #fafafa;
      --zpull-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
      --zpull-btn-cancel-bg: #f4f4f5;
      --zpull-btn-cancel-border: #e4e4e7;
      --zpull-btn-cancel-fg: #27272a;
      --zpull-btn-cancel-hover: #e4e4e7;
      --zpull-badge-exists-bg: #f4f4f5;
      --zpull-badge-exists-fg: #71717a;
      --zpull-badge-exists-border: #e4e4e7;
      --zpull-badge-new-bg: #ecfdf5;
      --zpull-badge-new-fg: #059669;
      --zpull-badge-new-border: #a7f3d0;

      /* 浅色模式按钮高级质感 */
      --zpull-trigger-bg: linear-gradient(135deg, #f0f7ff 0%, #e0effe 100%);
      --zpull-trigger-fg: #1d4ed8;
      --zpull-trigger-border: rgba(59, 130, 246, 0.32);
      --zpull-trigger-hover-bg: linear-gradient(135deg, #e0effe 0%, #bae6fd 100%);
      --zpull-trigger-hover-shadow: 0 4px 12px rgba(37, 99, 235, 0.18);
    }

    .dark, html.dark, body.dark {
      --zpull-bg: #1c1c1e;
      --zpull-fg: #f0f0f0;
      --zpull-fg-muted: #a1a1aa;
      --zpull-border: rgba(255, 255, 255, 0.14);
      --zpull-border-subtle: rgba(255, 255, 255, 0.06);
      --zpull-input-bg: #141416;
      --zpull-input-border: rgba(255, 255, 255, 0.15);
      --zpull-list-bg: #151517;
      --zpull-item-hover: rgba(255, 255, 255, 0.05);
      --zpull-header-bg: #19191b;
      --zpull-footer-bg: #19191b;
      --zpull-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
      --zpull-btn-cancel-bg: rgba(255, 255, 255, 0.08);
      --zpull-btn-cancel-border: rgba(255, 255, 255, 0.1);
      --zpull-btn-cancel-fg: #eee;
      --zpull-btn-cancel-hover: rgba(255, 255, 255, 0.14);
      --zpull-badge-exists-bg: rgba(107, 114, 128, 0.2);
      --zpull-badge-exists-fg: #9ca3af;
      --zpull-badge-exists-border: rgba(107, 114, 128, 0.25);
      --zpull-badge-new-bg: rgba(16, 185, 129, 0.15);
      --zpull-badge-new-fg: #10b981;
      --zpull-badge-new-border: rgba(16, 185, 129, 0.3);

      /* 暗黑模式按钮高级质感 */
      --zpull-trigger-bg: linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(30, 58, 138, 0.28) 100%);
      --zpull-trigger-fg: #60a5fa;
      --zpull-trigger-border: rgba(96, 165, 250, 0.38);
      --zpull-trigger-hover-bg: linear-gradient(135deg, rgba(37, 99, 235, 0.3) 0%, rgba(30, 58, 138, 0.42) 100%);
      --zpull-trigger-hover-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
    }

    /* 现代高级感触发按钮样式 */
    #zcode-auto-pull-models-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-left: 8px;
      margin-top: 4px;
      height: 36px;
      padding: 0 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      background: var(--zpull-trigger-bg);
      color: var(--zpull-trigger-fg);
      border: 1px solid var(--zpull-trigger-border);
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }
    #zcode-auto-pull-models-btn:hover {
      background: var(--zpull-trigger-hover-bg);
      box-shadow: var(--zpull-trigger-hover-shadow);
      transform: translateY(-1px);
    }
    #zcode-auto-pull-models-btn:active {
      transform: translateY(0);
    }
    #zcode-auto-pull-models-btn.loading {
      opacity: 0.75;
      cursor: wait;
      pointer-events: none;
    }
    .zcode-pull-bolt-icon {
      width: 15px;
      height: 15px;
      fill: currentColor;
      transition: transform 0.2s;
    }
    #zcode-auto-pull-models-btn:hover .zcode-pull-bolt-icon {
      transform: scale(1.15);
    }

    @keyframes zcodeSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .zcode-spin-icon {
      animation: zcodeSpin 1s linear infinite;
    }

    /* 弹窗遮罩 */
    .zcode-pull-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: zcodeFadeIn 0.15s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    @keyframes zcodeFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .zcode-pull-modal {
      width: 580px;
      max-width: 92vw;
      max-height: 85vh;
      background: var(--zpull-bg);
      color: var(--zpull-fg);
      border: 1px solid var(--zpull-border);
      border-radius: 14px;
      box-shadow: var(--zpull-shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: zcodeScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes zcodeScaleIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .zcode-pull-header {
      padding: 16px 20px;
      background: var(--zpull-header-bg);
      border-bottom: 1px solid var(--zpull-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .zcode-pull-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--zpull-fg);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .zcode-pull-close {
      background: transparent;
      border: none;
      color: var(--zpull-fg-muted);
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .zcode-pull-close:hover {
      background: var(--zpull-item-hover);
      color: var(--zpull-fg);
    }
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
    .zcode-pull-search {
      flex: 1;
      background: var(--zpull-input-bg);
      border: 1px solid var(--zpull-input-border);
      border-radius: 8px;
      padding: 7px 12px;
      color: var(--zpull-fg);
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    .zcode-pull-search:focus {
      border-color: #3b82f6;
    }
    .zcode-pull-btn-group {
      display: flex;
      gap: 6px;
    }
    .zcode-pull-mini-btn {
      background: var(--zpull-btn-cancel-bg);
      border: 1px solid var(--zpull-btn-cancel-border);
      color: var(--zpull-fg);
      font-size: 12px;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .zcode-pull-mini-btn:hover {
      background: var(--zpull-btn-cancel-hover);
    }
    .zcode-pull-list {
      flex: 1;
      max-height: 380px;
      overflow-y: auto;
      border: 1px solid var(--zpull-border);
      border-radius: 8px;
      background: var(--zpull-list-bg);
    }
    .zcode-pull-item {
      display: flex;
      align-items: center;
      padding: 9px 12px;
      cursor: pointer;
      user-select: none;
      transition: background 0.1s;
      border-bottom: 1px solid var(--zpull-border-subtle);
    }
    .zcode-pull-item:last-child {
      border-bottom: none;
    }
    .zcode-pull-item:hover {
      background: var(--zpull-item-hover);
    }
    .zcode-pull-item input[type="checkbox"] {
      margin-right: 12px;
      accent-color: #2563eb;
      width: 16px;
      height: 16px;
      cursor: pointer;
      pointer-events: none;
    }
    .zcode-pull-item-name {
      flex: 1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      color: var(--zpull-fg);
    }
    .zcode-pull-badge {
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 500;
    }
    .zcode-pull-badge-new {
      background: var(--zpull-badge-new-bg);
      color: var(--zpull-badge-new-fg);
      border: 1px solid var(--zpull-badge-new-border);
    }
    .zcode-pull-badge-exists {
      background: var(--zpull-badge-exists-bg);
      color: var(--zpull-badge-exists-fg);
      border: 1px solid var(--zpull-badge-exists-border);
    }
    .zcode-pull-footer {
      padding: 14px 20px;
      background: var(--zpull-footer-bg);
      border-top: 1px solid var(--zpull-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .zcode-pull-count-info {
      font-size: 13px;
      color: var(--zpull-fg-muted);
    }
    .zcode-pull-footer-btns {
      display: flex;
      gap: 10px;
    }
    .zcode-pull-btn-cancel {
      padding: 7px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      background: var(--zpull-btn-cancel-bg);
      border: 1px solid var(--zpull-btn-cancel-border);
      color: var(--zpull-btn-cancel-fg);
      cursor: pointer;
      transition: all 0.15s;
    }
    .zcode-pull-btn-cancel:hover {
      background: var(--zpull-btn-cancel-hover);
    }
    .zcode-pull-btn-submit {
      padding: 7px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      background: #2563eb;
      border: 1px solid rgba(59, 130, 246, 0.5);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .zcode-pull-btn-submit:hover {
      background: #1d4ed8;
    }
    .zcode-pull-btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .zcode-custom-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000000;
      background: var(--zpull-bg);
      color: var(--zpull-fg);
      padding: 10px 20px;
      border-radius: 10px;
      border: 1px solid var(--zpull-border);
      box-shadow: var(--zpull-shadow);
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: zcodeToastPop 0.25s ease-out;
    }
    @keyframes zcodeToastPop {
      from { opacity: 0; transform: translate(-50%, -10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }

    /* reasoning 档位范围选择 */
    .zcode-pull-range {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--zpull-fg-muted);
    }
    .zcode-pull-range-label {
      font-weight: 500;
      color: var(--zpull-fg);
      white-space: nowrap;
    }
    .zcode-pull-range-select {
      background: var(--zpull-input-bg);
      border: 1px solid var(--zpull-input-border);
      border-radius: 6px;
      padding: 4px 8px;
      color: var(--zpull-fg);
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }
    .zcode-pull-range-select:focus {
      border-color: #3b82f6;
    }
    .zcode-pull-range-hint {
      opacity: 0.75;
    }
    /* 编辑弹窗 efforts 多选列表 */
    .zcode-pull-efforts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      align-items: center;
    }
    .zcode-pull-effort {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--zpull-fg);
      cursor: pointer;
      user-select: none;
    }
    .zcode-pull-effort input {
      accent-color: #2563eb;
      margin: 0;
      width: 14px;
      height: 14px;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  function showToast(message, duration = 3000) {
    const existing = document.querySelector(".zcode-custom-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "zcode-custom-toast";
    toast.innerHTML = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = "opacity 0.2s, transform 0.2s";
      toast.style.opacity = "0";
      toast.style.transform = "translate(-50%, -10px)";
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function getZCodeApi() {
    return window.zcode;
  }

  async function readZCodeConfig() {
    const api = getZCodeApi();
    if (api?.readConfigFile) {
      const res = await api.readConfigFile();
      return res.data;
    }
    return null;
  }

  async function writeZCodeConfig(cfg) {
    const api = getZCodeApi();
    if (api?.writeConfigFile && cfg) {
      const res = await api.writeConfigFile(cfg);
      return !!(res && res.success);
    }
    return false;
  }

  function getCurrentProviderName() {
    const nameInputs = document.querySelectorAll("input[value]");
    for (const inp of nameInputs) {
      const val = inp.value.trim();
      if (val && !val.startsWith("http") && !val.startsWith("sk-") && !val.includes("/")) {
        return val;
      }
    }
    return "";
  }

  function getFormCredentials() {
    let baseUrl = "";
    let apiKey = "";

    const inputs = Array.from(document.querySelectorAll("input"));
    for (const input of inputs) {
      const val = input.value.trim();
      const placeholder = (input.placeholder || "").toLowerCase();
      const testid = input.getAttribute("data-testid") || "";

      if (
        !apiKey &&
        (input.type === "password" ||
          testid.includes("Pne") ||
          placeholder.includes("key") ||
          placeholder.includes("sk-"))
      ) {
        if (val) apiKey = val;
      }

      if (
        !baseUrl &&
        input.type === "text" &&
        (placeholder.includes("http") ||
          placeholder.includes("v1") ||
          placeholder.includes("api") ||
          val.startsWith("http"))
      ) {
        if (val) baseUrl = val;
      }
    }

    return { baseUrl, apiKey };
  }

  // 精准识别外部已存在的模型列表
  async function getExistingModels(baseUrl) {
    const existing = new Set();

    // 1. 扫描页面输入框中的模型 ID
    const inputs = document.querySelectorAll("input");
    for (const inp of inputs) {
      const val = (inp.value || "").trim();
      if (!val) continue;
      if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("sk-")) {
        continue;
      }

      const isFontMono = inp.classList.contains("font-mono");
      const isModelPlaceholder =
        (inp.placeholder || "").includes("模型") || (inp.placeholder || "").toLowerCase().includes("model");
      const isInsideModelList = inp.closest(".divide-y, .divide-input-border, [class*='divide-']");

      if (isFontMono || isModelPlaceholder || isInsideModelList) {
        existing.add(val);
      }
    }

    // 2. 结合 config.json 辅助校验
    try {
      const cfg = await readZCodeConfig();
      if (cfg?.provider) {
        const cleanBase = (baseUrl || "").replace(/\/+$/, "");
        for (const [pid, pdata] of Object.entries(cfg.provider)) {
          const pBase = (pdata.options?.baseURL || "").replace(/\/+$/, "");
          if (pBase === cleanBase && pdata.models) {
            Object.keys(pdata.models).forEach((m) => existing.add(m.trim()));
          }
        }
      }
    } catch (e) {
      console.warn("[ZCode-Model-Puller] 读取配置辅助识别出错:", e);
    }

    console.log("[ZCode-Model-Puller] 外部已展示模型列表:", Array.from(existing));
    return existing;
  }

  /**
   * 核心突破：百分之百自动触发官方原生刷新
   * 直接联动页面上部的原生刷新按钮与左侧导航，促使 React 立即重新加载模型
   */
  function triggerZCodeUIRefresh() {
    console.log("[ZCode-Model-Puller] 触发原生自动刷新...");

    // 1. 优先点击页面右上方的官方原生刷新按钮
    // 特征：位于“管理自定义模型供应商...”文案同一横向容器右侧
    let refreshClicked = false;
    const descParagraph = Array.from(document.querySelectorAll("p")).find(
      (p) => p.textContent.includes("管理自定义模型供应商") || p.textContent.includes("配置后可在聊天时选择使用")
    );
    if (descParagraph && descParagraph.parentElement) {
      const btn = descParagraph.parentElement.querySelector("button");
      if (btn) {
        console.log("[ZCode-Model-Puller] 点击官方主刷新按钮");
        btn.click();
        refreshClicked = true;
      }
    }

    // 2. 兜底尝试查找右上角带有刷新旋转图标的按钮
    if (!refreshClicked) {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const b of buttons) {
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        const title = (b.getAttribute("title") || "").toLowerCase();
        const rect = b.getBoundingClientRect();
        if (
          (aria.includes("刷新") || aria.includes("refresh") || title.includes("刷新") || title.includes("refresh")) ||
          (rect.top < 180 && rect.right > window.innerWidth - 200 && b.querySelector("svg"))
        ) {
          b.click();
          refreshClicked = true;
          break;
        }
      }
    }

    // 3. 伴随轻点当前选中的供应商项，触发组件重新渲染
    setTimeout(() => {
      const pName = getCurrentProviderName();
      if (pName) {
        const sideItems = Array.from(
          document.querySelectorAll("div[class*='rounded'], button, div[class*='cursor-pointer']")
        );
        for (const item of sideItems) {
          const rect = item.getBoundingClientRect();
          if (rect.left < 360 && item.textContent.includes(pName)) {
            item.click();
            break;
          }
        }
      }
    }, 150);
  }

  // 模型选择弹窗
  async function openModelSelectModal(models, baseUrl, apiKey) {
    const existingModels = await getExistingModels(baseUrl);

    const stateMap = new Map();
    let newCount = 0;
    for (const id of models) {
      const exists = existingModels.has(id);
      const selected = !exists; // 仅新模型默认勾选
      stateMap.set(id, { exists, selected });
      if (!exists) newCount++;
    }

    const overlay = document.createElement("div");
    overlay.className = "zcode-pull-modal-overlay";

    overlay.innerHTML = `
      <div class="zcode-pull-modal">
        <div class="zcode-pull-header">
          <div class="zcode-pull-title">
            <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24" style="color: #3b82f6;">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>选择要同步的模型 (共 ${models.length} 个，待添加新模型 ${newCount} 个)</span>
          </div>
          <button class="zcode-pull-close" id="zcode-modal-close-btn" title="关闭">✕</button>
        </div>
        <div class="zcode-pull-body">
          <div class="zcode-pull-toolbar">
            <input type="text" class="zcode-pull-search" id="zcode-modal-search" placeholder="搜索模型名称..." />
            <div class="zcode-pull-btn-group">
              <button class="zcode-pull-mini-btn" id="zcode-select-all">全选</button>
              <button class="zcode-pull-mini-btn" id="zcode-select-none">清空</button>
              <button class="zcode-pull-mini-btn" id="zcode-select-new">仅选新模型 (${newCount})</button>
            </div>
          </div>
          <div class="zcode-pull-list" id="zcode-modal-list">
            ${models
              .map((id) => {
                const info = stateMap.get(id);
                return `
              <div class="zcode-pull-item" data-id="${id}">
                <input type="checkbox" ${info.selected ? "checked" : ""} data-id="${id}" />
                <span class="zcode-pull-item-name">${id}</span>
                ${
                  info.exists
                    ? `<span class="zcode-pull-badge zcode-pull-badge-exists">已添加</span>`
                    : `<span class="zcode-pull-badge zcode-pull-badge-new">新模型</span>`
                }
              </div>
            `;
              })
              .join("")}
          </div>
        </div>
        <div class="zcode-pull-footer">
          <div class="zcode-pull-count-info" id="zcode-pull-count-info">
            已选中 <strong style="color: #2563eb;" id="zcode-selected-num">${newCount}</strong> / ${models.length} 个模型
          </div>
          <div class="zcode-pull-footer-btns">
            <button class="zcode-pull-btn-cancel" id="zcode-modal-cancel">取消</button>
            <button class="zcode-pull-btn-submit" id="zcode-modal-confirm" ${
              newCount === 0 ? "disabled" : ""
            }>
              <span>确认添加并保存 (<span id="zcode-btn-selected-num">${newCount}</span>)</span>
            </button>
          </div>
        </div>
      </div>
    `;

    function updateCountsOnly() {
      let selCount = 0;
      for (const [_, info] of stateMap) {
        if (info.selected) selCount++;
      }
      const numSpan = overlay.querySelector("#zcode-selected-num");
      const btnNumSpan = overlay.querySelector("#zcode-btn-selected-num");
      const confirmBtn = overlay.querySelector("#zcode-modal-confirm");

      if (numSpan) numSpan.textContent = selCount;
      if (btnNumSpan) btnNumSpan.textContent = selCount;
      if (confirmBtn) confirmBtn.disabled = selCount === 0;
    }

    const listContainer = overlay.querySelector("#zcode-modal-list");
    listContainer.addEventListener("click", (e) => {
      const itemEl = e.target.closest(".zcode-pull-item");
      if (!itemEl) return;
      const id = itemEl.getAttribute("data-id");
      const info = stateMap.get(id);
      if (info) {
        info.selected = !info.selected;
        const checkbox = itemEl.querySelector("input[type='checkbox']");
        if (checkbox) checkbox.checked = info.selected;
        updateCountsOnly();
      }
    });

    const searchInput = overlay.querySelector("#zcode-modal-search");
    searchInput.oninput = (e) => {
      const kw = e.target.value.toLowerCase().trim();
      const items = listContainer.querySelectorAll(".zcode-pull-item");
      items.forEach((it) => {
        const id = it.getAttribute("data-id").toLowerCase();
        it.style.display = id.includes(kw) ? "flex" : "none";
      });
    };

    overlay.querySelector("#zcode-select-all").onclick = () => {
      for (const [id, info] of stateMap) {
        info.selected = true;
      }
      listContainer.querySelectorAll("input[type='checkbox']").forEach((cb) => (cb.checked = true));
      updateCountsOnly();
    };

    overlay.querySelector("#zcode-select-none").onclick = () => {
      for (const [id, info] of stateMap) {
        info.selected = false;
      }
      listContainer.querySelectorAll("input[type='checkbox']").forEach((cb) => (cb.checked = false));
      updateCountsOnly();
    };

    overlay.querySelector("#zcode-select-new").onclick = () => {
      for (const [id, info] of stateMap) {
        info.selected = !info.exists;
      }
      listContainer.querySelectorAll(".zcode-pull-item").forEach((it) => {
        const id = it.getAttribute("data-id");
        const cb = it.querySelector("input[type='checkbox']");
        const info = stateMap.get(id);
        if (cb && info) cb.checked = info.selected;
      });
      updateCountsOnly();
    };

    const closeModal = () => overlay.remove();
    overlay.querySelector("#zcode-modal-close-btn").onclick = closeModal;
    overlay.querySelector("#zcode-modal-cancel").onclick = closeModal;

    const confirmBtn = overlay.querySelector("#zcode-modal-confirm");
    confirmBtn.onclick = async () => {
      const toAdd = [];
      for (const [id, info] of stateMap) {
        if (info.selected) toAdd.push(id);
      }
      if (toAdd.length === 0) return;

      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<span>⏳ 正在保存...</span>`;

      try {
        // 直接把模型填入官方「添加模型供应商」表单：逐个走官方添加模型弹窗，保存按钮解锁
        window.__zcodePendingEnrich = { baseUrl, modelIds: toAdd };
        window.__zcodePendingSync = null;
        // 先拉一次各模型元数据（models.dev + GPT 272K 封顶），填入表单时直接带上
        window.__zcodeMeta = {};
        try {
          const gz = getZCodeApi();
          if (gz && gz.getModelMetadata) {
            const mr = await gz.getModelMetadata({ modelIds: toAdd });
            if (mr && mr.success) window.__zcodeMeta = mr.meta || {};
          }
        } catch (e0) {}
        closeModal();
        showToast(`正在把 ${toAdd.length} 个模型填入表单…`);
        let res = await addModelsToOfficialForm(toAdd);
        if (!res.ok) {
          showToast(`降级模式：逐个弹出官方「添加模型」弹窗（${res.reason || "未知原因"}）…`);
          await addModelsViaModal(toAdd);
        }
        const told = res.ok ? res.added : toAdd.length;
        showToast(`已无感填入 ${told} 个模型，请点击官方「保存」完成添加`);
        // 触发官方原生刷新，让表单/模型列表立即呈现
        setTimeout(() => {
          triggerZCodeUIRefresh();
        }, 120);
      } catch (err) {
        console.error("[ZCode-Model-Puller] 保存失败:", err);
        showToast(`❌ 保存出错: ${err.message}`);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<span>确认添加并保存 (${toAdd.length})</span>`;
      }
    };

    document.body.appendChild(overlay);
  }

  // 注入高级质感按钮
  function checkAndInject() {
    let addModelBtn = document.querySelector('[data-testid="Goe"]');
    if (!addModelBtn) {
      const btns = Array.from(document.querySelectorAll("button"));
      addModelBtn = btns.find(
        (b) => b.textContent.includes("添加模型") && b.getAttribute("id") !== "zcode-auto-pull-models-btn"
      );
    }

    if (!addModelBtn) return;

    const parent = addModelBtn.parentElement;
    if (!parent || parent.querySelector("#zcode-auto-pull-models-btn")) return;

    parent.style.display = "flex";
    parent.style.flexWrap = "wrap";
    parent.style.alignItems = "center";
    parent.style.gap = "8px";

    const pullBtn = document.createElement("button");
    pullBtn.id = "zcode-auto-pull-models-btn";
    pullBtn.type = "button";
    pullBtn.setAttribute("title", "根据当前 Base URL 和 API Key 自动拉取所有可用模型");

    pullBtn.innerHTML = `
      <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span>自动拉取模型</span>
    `;

    pullBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const { baseUrl, apiKey } = getFormCredentials();
      console.log("[ZCode-Model-Puller] 点击拉取，凭据:", { baseUrl, hasKey: !!apiKey });

      if (!baseUrl) {
        showToast("⚠️ 请先在上方填写 Base URL");
        return;
      }

      pullBtn.classList.add("loading");
      pullBtn.innerHTML = `
        <svg class="zcode-spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span>正在拉取模型...</span>
      `;

      try {
        let result = null;
        const api = getZCodeApi();
        if (api?.fetchModelsFromUrl) {
          result = await api.fetchModelsFromUrl(baseUrl, apiKey);
        } else {
          try {
            const cleanUrl = baseUrl.replace(/\/+$/, "");
            const candidates = [
              cleanUrl.endsWith("/v1") ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`,
              `${cleanUrl}/models`,
            ];
            if (cleanUrl.endsWith("/api")) candidates.unshift(`${cleanUrl}/v1/models`);

            for (const u of candidates) {
              try {
                const headers = { Accept: "application/json" };
                if (apiKey) {
                  headers["Authorization"] = `Bearer ${apiKey}`;
                  headers["x-api-key"] = apiKey;
                }
                const res = await fetch(u, { headers });
                if (res.ok) {
                  const data = await res.json();
                  const list = (data.data || data.models || data).map((m) =>
                    typeof m === "string" ? m : m.id || m.name
                  );
                  result = { success: true, models: list.filter(Boolean) };
                  break;
                }
              } catch (e) {}
            }
          } catch (fetchErr) {
            result = { success: false, error: fetchErr.message };
          }
        }

        if (result?.success && result.models?.length > 0) {
          await openModelSelectModal(result.models, baseUrl, apiKey);
        } else {
          showToast(`❌ 拉取失败: ${result?.error || "未获取到模型，请检查地址和 Key"}`);
        }
      } catch (err) {
        showToast(`❌ 请求异常: ${err.message}`);
      } finally {
        pullBtn.classList.remove("loading");
        pullBtn.innerHTML = `
          <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span>自动拉取模型</span>
        `;
      }
    };

    addModelBtn.after(pullBtn);
  }

  // —— 官方「添加/编辑模型配置」弹窗注入：思考档位范围（仅此处生效）——
  const EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"];

  function findEditorModelId(body, cfg) {
    // 官方模型 ID 输入框带 font-mono 特征，优先级最高
    const mono = body.querySelector("input.font-mono");
    const mv = mono && (mono.value || "").trim();
    if (mv && !mv.startsWith("http") && !mv.startsWith("sk-")) return mv;
    const ids = new Set();
    for (const [, pd] of Object.entries(cfg?.provider || {})) {
      for (const k in pd.models || {}) ids.add(k.trim());
    }
    for (const inp of body.querySelectorAll("input")) {
      const v = (inp.value || "").trim();
      if (v && ids.has(v)) return v; // 优先：输入值命中配置中的模型 id
    }
    for (const inp of body.querySelectorAll("input")) {
      const v = (inp.value || "").trim();
      if (v && inp.type === "text" && !v.startsWith("http") && !v.startsWith("sk-")) return v;
    }
    return "";
  }

  function collectEfforts(row) {
    const ordered = [];
    row.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      if (cb.checked) ordered.push(cb.value);
    });
    return ordered.length ? ordered : null;
  }

  async function seedEditorEfforts(body, row) {
    try {
      const cfg = await readZCodeConfig();
      const mid = findEditorModelId(body, cfg);
      if (!mid || !row) return;
      let hit = null;
      for (const [, pd] of Object.entries(cfg.provider || {})) {
        const m = (pd.models || {})[mid];
        if (m && m.reasoning && Array.isArray(m.reasoning.variants) && m.reasoning.variants.length) {
          hit = [...m.reasoning.variants];
          break;
        }
      }
      if (!hit) {
        // 未保存在 config（新建供应商）：回退到拉取时缓存的 efforts；否则给普适默认，均可手动勾选
        const metaM = (window.__zcodeMeta || {})[mid] || {};
        if (metaM.r && metaM.r.length) hit = [...metaM.r];
        else hit = ["low", "medium", "high"];
      }
      row.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = hit.includes(cb.value);
      });
      window.__zcodeLastEfforts = { modelId: mid, variants: hit.slice() };
    } catch (e) {}
  }

  // 同步官方内存模型 state：官方保存用 customModels（内存）重建 config，
  // 直接把 reasoning 写进内存里的模型对象，官方保存自然带上正确 efforts。
  // 官方 onModelCommit 签名是 (index, model)，单参调用会把 model 当 index 用 → 失效。
  // 且编辑弹窗里 onCommit 是无参关闭回调，必须专找双参 onModelCommit（fiber 链较深）。
  function syncOfficialModelState(mid, reasoning) {
    try {
      const body = document.querySelector(".min-h-0.space-y-3.overflow-y-auto.pr-1");
      if (!body) return false;
      const onCommit = findCallbackUp(body, "onModelCommit"); // 官方 (index, model) 回调，双参
      if (!onCommit) return false;
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
      );
      const models = btn && findPropsUp(btn, "models");
      if (!Array.isArray(models)) return false;
      const idx = models.findIndex((m) => m && (m.id || m.modelId) === mid);
      if (idx < 0) return false;
      onCommit(idx, { ...models[idx], reasoning, id: (models[idx].id || models[idx].modelId) });
      return true;
    } catch (e) {
      return false;
    }
  }

  // 向上查找「带函数返回值位数的回调」：官方 onModelCommit 是双参 (index, model)，
  // 而同层附近的 onCommit 是无参关闭回调，按名匹配会误命中。这里要求形参个数 ≥ 2。
  function findCallbackUp(el, prop) {
    let f = getFiber(el);
    for (let i = 0; f && i < 60; i++) {
      const p = f.memoizedProps;
      if (p && typeof p[prop] === "function" && p[prop].length >= 2) return p[prop];
      f = f.return;
    }
    return null;
  }

  async function applyEditorEfforts(body) {
    try {
      const row = body.querySelector("#zcode-editor-efforts-row");
      const cfg = await readZCodeConfig();
      const mid = findEditorModelId(body, cfg);
      if (!row || !cfg || !mid) return;
      const ordered = collectEfforts(row);
      if (!ordered) return;
      // 新的勾选操作开始新一轮落盘：重置「已弹提示」标志，让本次保存结束时再弹一次
      window.__zcodeEffortsToastShown = false;
      const defaultVariant = ordered[ordered.length - 1];
      // 同步官方内存模型 state（官方保存用内存重建 config）
      const lvSync = {};
      ordered.forEach((v) => (lvSync[v] = { value: v }));
      syncOfficialModelState(mid, {
        enabled: true,
        variants: ordered.slice(),
        levels: lvSync,
        defaultVariant,
        defaultLevel: defaultVariant,
      });
      let touched = false;
      for (const [, pd] of Object.entries(cfg.provider || {})) {
        const m = (pd.models || {})[mid];
        if (!m || typeof m.reasoning !== "object") continue;
        m.reasoning.variants = ordered.slice();
        m.reasoning.defaultVariant = defaultVariant;
        const lv = {};
        ordered.forEach((v) => (lv[v] = { value: v }));
        m.reasoning.levels = lv;
        m.reasoning.defaultLevel = defaultVariant;
        touched = true;
      }
      window.__zcodeLastEfforts = { modelId: mid, variants: ordered.slice(), defaultVariant };
      if (!touched) {
        // 新建供应商（模型尚未落入 config）：先记录，保存供应商后由钩子写回
        showToast(`已记录 ${mid} 思考档位，保存供应商后生效`);
        return;
      }
      const ok = await writeZCodeConfig(cfg);
      showToast(ok ? `已更新 ${mid} 思考档位：${ordered.join("/")}` : "更新失败，请重试");
    } catch (e) {}
  }

  function injectEditorRange() {
    const body = document.querySelector(".min-h-0.space-y-3.overflow-y-auto.pr-1");
    if (!body || body.querySelector("#zcode-editor-efforts-row")) return;
    if (!/上下文窗口/.test(body.textContent || "")) return; // 官方模型编辑弹窗特征

    const row = document.createElement("div");
    row.id = "zcode-editor-efforts-row";
    row.className = "zcode-pull-range";
    row.innerHTML = ` <span class="zcode-pull-range-label">思考档位 (efforts)</span>
      <span class="zcode-pull-efforts">${EFFORTS.map((v) => `<label class="zcode-pull-effort"><input type="checkbox" value="${v}" />${v}</label>`).join("")}</span>
      <span class="zcode-pull-range-hint">（勾选即生效，点官方「保存」后自动重保）</span>`;
    row.addEventListener("change", () => applyEditorEfforts(body));
    body.appendChild(row);
    seedEditorEfforts(body, row);
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc.set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function waitFor(fn, timeout, interval = 80) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        let v = null;
        try {
          v = fn();
        } catch (e) {}
        if (v) return resolve(v);
        if (Date.now() - t0 > timeout) return resolve(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  // 从 DOM 元素取 React fiber，并向上查找持有指定 prop 的组件引用（官方回调函数）
  function getFiber(el) {
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
    return key ? el[key] : null;
  }

  function findPropUp(el, prop) {
    let f = getFiber(el);
    for (let i = 0; f && i < 30; i++) {
      const p = f.memoizedProps;
      if (p && typeof p[prop] === "function") return p[prop];
      f = f.return;
    }
    return null;
  }

  function findPropsUp(el, key) {
    let f = getFiber(el);
    for (let i = 0; f && i < 30; i++) {
      const p = f.memoizedProps;
      if (p && key in p && p[key] != null) return p[key];
      f = f.return;
    }
    return null;
  }

  // 读取添加供应商页「API 格式」下拉 → 映射为模型条目需要的 kind（官方 IPt 表）
  // anthropic-messages→anthropic / openai-chat-completions→openai-compatible / openai-responses→openai
  function readApiKind() {
    const FORMATS = ["anthropic-messages", "openai-chat-completions", "openai-responses"];
    const F2K = {
      "anthropic-messages": "anthropic",
      "openai-chat-completions": "openai-compatible",
      "openai-responses": "openai",
    };
    let fmt = null;
    for (const sel of Array.from(document.querySelectorAll("select"))) {
      const v = (sel.value || "").trim();
      if (FORMATS.includes(v)) { fmt = v; break; }
      const hit = Array.from(sel.options || []).find((o) => FORMATS.includes((o.value || "").trim()));
      if (hit) { fmt = (hit.value || "").trim(); break; }
    }
    if (!fmt) {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
      );
      const opts = btn && findPropsUp(btn, "apiFormatOptions");
      if (Array.isArray(opts) && opts.length && typeof opts[0] === "string" && FORMATS.includes(opts[0])) fmt = opts[0];
    }
    if (!fmt) fmt = "anthropic-messages"; // 表单默认
    return F2K[fmt] || "anthropic";
  }

  // 无感批量添加：读 API 格式下拉 → 复用官方 onAddModel 回调全量填入（保存按钮随即解锁）
  async function addModelsToOfficialForm(ids) {
    const findBtn = () =>
      Array.from(document.querySelectorAll("button")).find(
        (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
      );
    if (!ids || !ids.length) return { ok: true, added: 0 };
    const kind = readApiKind();
    const kinds = [kind];
    // onAddModel 是官方组件某次渲染时的闭包（捕获当时的 customModels 快照），
    // 批量调用同一份闭包会相互覆盖；每加一个模型后等 React 重渲染、重新取新闭包。
    const btn = findBtn();
    if (!btn || !findPropUp(btn, "onAddModel")) return { ok: false, reason: "add-btn-or-onAdd-not-found" };
    let added = 0;
    for (const id of ids) {
      const cur = findBtn();
      if (!cur) break;
      const onAdd = findPropUp(cur, "onAddModel"); // 取最新渲染闭包（customModels 已推进）
      if (!onAdd) break;
      const me = (window.__zcodeMeta || {})[id] || {};
      try {
        onAdd({
          id,
          name: id.split("/").pop() || id,
          contextWindow: me.ctx || undefined,
          maxOutputTokens: me.out || undefined,
          modalities: { input: me.in || ["text"], output: me.outM || ["text"] },
          // 与表单 API 格式一致，避免「至少选择一种 API 格式」
          kinds: kinds.slice(),
          defaultKind: kind,
          reasoning: me.r
            ? {
                enabled: true,
                levels: me.r.reduce((o, v) => { o[v] = { value: v }; return o; }, {}),
                defaultLevel: me.r[me.r.length - 1],
              }
            : { enabled: false, levels: [] },
        });
        added++;
      } catch (e) {}
      // 等待官方状态重渲染（新闭包捕获新 customModels）后再加下一个
      await new Promise((r) => setTimeout(r, 120));
    }
    return { ok: true, added };
  }

  // 降级方案：逐个驱动官方「添加模型」弹窗填表
  async function addModelsViaModal(ids) {
    const findAddBtn = () =>
      Array.from(document.querySelectorAll("button")).find(
        (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
      );
    for (const id of ids) {
      const btn = findAddBtn();
      if (!btn) break;
      btn.click();
      const body = await waitFor(() => {
        const el = document.querySelector(".min-h-0.space-y-3.overflow-y-auto.pr-1");
        return el && el.offsetParent !== null ? el : null;
      }, 3000);
      if (!body) break;
      const input = Array.from(body.querySelectorAll("input")).find(
        (i) => i.type === "text" && !i.readOnly && (!i.value || i.value.trim() === "")
      );
      if (input) setNativeValue(input, id);
      const save = await waitFor(
        () =>
          Array.from(body.querySelectorAll("button")).find(
            (b) => /(保存|添加|save|add)/i.test((b.textContent || "").trim()) && b.offsetParent !== null
          ),
        2500
      );
      if (!save) break;
      save.click();
      await waitFor(() => !body.isConnected, 3000); // 等官方弹窗关闭
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  async function enrichPending(p, attempts = 0) {
    try {
      const api = getZCodeApi();
      if (!api || !api.enrichModelsWithMetadata) return;
      const res = await api.enrichModelsWithMetadata({
        baseUrl: p.baseUrl,
        modelIds: p.modelIds,
      });
      if (res && res.success && (res.touched > 0 || attempts >= 5)) {
        showToast(`已填充 ${res.touched || 0} 个模型元数据`);
        return;
      }
      // 官方保存是异步写盘，未命中/未写完时按递增间隔重试
      if (attempts < 5) {
        const delay = Math.min(400 + attempts * 700, 3500);
        setTimeout(() => enrichPending(p, attempts + 1), delay);
      }
    } catch (e) {}
  }

  function effortsMatch(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // 校验式重写：写盘后读回验证 variants 与用户勾选完全一致才认为成功，
  // 官方保存（异步写盘）覆盖后由外部轮询再次调用本函数纠回，保证「即时生效」。
  async function reapplyEfforts(le) {
    try {
      const cfg = await readZCodeConfig();
      if (!cfg || !le || !le.modelId || !le.variants) return false;
      let touched = false;
      for (const [, pd] of Object.entries(cfg.provider || {})) {
        const m = (pd.models || {})[le.modelId];
        if (!m) continue;
        // 官方保存可能把 reasoning 删掉/重置成非对象：缺失时按用户勾选重建
        if (!m.reasoning || typeof m.reasoning !== "object") m.reasoning = {};
        m.reasoning.enabled = true;
        m.reasoning.variants = le.variants.slice();
        const lv = {};
        le.variants.forEach((v) => (lv[v] = { value: v }));
        m.reasoning.levels = lv;
        if (le.defaultVariant) {
          m.reasoning.defaultVariant = le.defaultVariant;
          m.reasoning.defaultLevel = le.defaultVariant;
        }
        touched = true;
      }
      if (!touched) return false;
      const ok = await writeZCodeConfig(cfg);
      if (ok) {
        // 读回验证：variants 与档位对象（levels）都必须与勾选一致才认为落盘成功；
        // 官方保存剥掉 levels 后这里会判定 failed，由外部轮询立即重写补回。
        // （toast 由 reapEffortsTight 在轮询结束时统一弹一次，避免每次重写都弹）
        const chk = await readZCodeConfig();
        let good = true;
        for (const [, pd] of Object.entries(chk?.provider || {})) {
          const m = (pd.models || {})[le.modelId];
          const r = m && m.reasoning;
          if (!r) continue;
          const lvKeys = r.levels && typeof r.levels === "object" ? Object.keys(r.levels) : null;
          if (!effortsMatch(r.variants, le.variants)) good = false;
          if (!lvKeys || !effortsMatch(lvKeys, le.variants)) good = false;
          if (le.defaultVariant && r.defaultVariant !== le.defaultVariant) good = false;
        }
        return good;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // 立即重写 + 轮询纠回：官方保存是异步写盘，写完会剥掉 levels / 覆盖档位。
  // 点击瞬间官方还没写盘，读回会「假一致」，所以前 6 轮无条件重写（覆盖官方写盘窗口），
  // 之后才以读回验证一致为停止条件；最多 18 轮（约 9s），确保最终稳定生效。
  function reapEffortsTight(le, round = 0) {
    const target = le || window.__zcodeLastEfforts;
    if (!target || !target.modelId || !target.variants) return;
    reapplyEfforts(target).then((done) => {
      // 官方保存/我们重写是异步的：首次 done=true 说明 config 已稳定落盘，
      // 之后自动重选聊天侧模型（轮询直到生效），确保读到最新档位。
      if (done && !window.__chatRefreshedFor) {
        window.__chatRefreshedFor = target.modelId;
        setTimeout(() => refreshChatSnapshot(target.modelId, target.variants), 800);
      }
      const keepGoing = !done || round < 6;
      // 轮询结束（稳定或被轮数上限截断）且最终落盘验证通过时，只弹最后一次提示；
      // 同一模型仅弹一次，避免前 6 轮无条件重写造成的连续弹窗。
      if (!keepGoing && done && !window.__zcodeEffortsToastShown) {
        window.__zcodeEffortsToastShown = true;
        setTimeout(() => showToast("已确保思考档位保存正确"), 300);
      }
      if (keepGoing && round < 18) setTimeout(() => reapEffortsTight(target, round + 1), 500);
    });
  }

  // 聊天侧思考档位 / 档位列表是「选模型时的快照」，官方保存后不会自动重建。
  // 且用户保存时可能正停留在模型设置页（聊天页浮层打不开），因此自动重选需要
  // 轮询重试：直到聊天侧档位集合与目标一致，或达到 ~30s 上限，尽量覆盖“回到聊天页”的时机。
  let __chatRefreshTimer = null;
  function sameLevelSet(a, b) {
    if (!a || !b) return false;
    const sa = String(a).split(",").map((s) => s.trim()).filter(Boolean);
    const sb = String(b).split(",").map((s) => s.trim()).filter(Boolean);
    if (sa.length !== sb.length) return false;
    return sa.every((v) => sb.includes(v));
  }
  function refreshChatSnapshot(modelId, expectedEmpty) {
    try {
      if (__chatRefreshTimer) return; // 防抖
      const span = document.querySelector('[data-testid="v4-model-config"]');
      if (!span) return;
      const cur = span.dataset || {};
      if (!cur.provider || !cur.model || cur.model !== modelId) return; // 仅当前正在使用的模型
      const expected = Array.isArray(expectedEmpty) ? expectedEmpty.join(",") : expectedEmpty;
      __chatRefreshTimer = setTimeout(() => {
        __chatRefreshTimer = null;
        autoReselectLoop(modelId, cur.provider, expected, 0);
      }, 1200);
    } catch (e) {}
  }

  // 自动重选聊天侧当前模型：官方「选模型时的快照」在保存后不会自动重建，且直接点击
  // 同模型项 Radix 会忽略（值未变不触发 onSelect），必须「先切到另一个模型再切回目标」。
  // 注入环境无法生成 isTrusted 事件（Radix 浮层打不开），因此经由主进程 sendInputEvent
  // 派发真实鼠标事件（window.zcode.simulateMouseClick）完成整套点击。
  // 注意：保存时用户可能仍在模型设置页（聊天 trigger 不可见），sendInputEvent 点击会落到
  // 设置页元素上；因此每步点击前都校验 trigger 可见，不可见则等待下一轮，直到回到聊天页。
  function triggerChatReselect(modelId, providerId) {
    try {
      const span = document.querySelector('[data-testid="v4-model-config"]');
      if (!span) return;
      const cur = span.dataset || {};
      const pid = providerId || cur.provider;
      const mid = modelId || cur.model;
      if (!pid || !mid) return;
      const thr = window.__zcodeLastEfforts;
      const exp = thr && thr.variants ? thr.variants.join(",") : null;
      autoReselectLoop(mid, pid, exp, 0);
    } catch (e) {}
  }

  function getZCodeClick() {
    try { return window.zcode && window.zcode.simulateMouseClick; } catch (e) { return null; }
  }

  function realClick(x, y) {
    const fn = getZCodeClick();
    if (!fn) return false;
    try { fn(Math.round(x), Math.round(y)); return true; } catch (e) { return false; }
  }

  function centerOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  // 聊天侧模型选择 trigger 是否真正可见（且不在设置页）
  function isChatTriggerVisible() {
    try {
      const t = document.querySelector('[data-testid="chat-model-select-trigger"]');
      if (!t) return false;
      const r = t.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (t.offsetParent === null) return false;
      // 用「点击坐标是否命中 trigger」判断真实可见：
      // 若当前处于模型设置页（聊天区被覆盖/隐藏），视图坐标点上不会命中 trigger。
      // 禁止用 body.textContent 匹配（导航栏含静态文案“模型设置”导致误判）。
      const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2);
      const top = document.elementFromPoint(cx, cy);
      if (!top) return false;
      return top === t || t.contains(top);
    } catch (e) { return false; }
  }

  // 同步等待某个条件（轮询式 sleep，供真实事件异步生效）
  function waitTrue(fn, timeout, interval = 120) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        let v = false; try { v = fn(); } catch (e) {}
        if (v) return resolve(true);
        if (Date.now() - t0 > timeout) return resolve(false);
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  // 打开模型浮层 → 展开当前供应商分组 → 点选指定模型项
  // modelId 传 "__OTHER__" 表示点同组第一个非当前模型（用于强制切换触发 onChange）
  async function openMenuAndPickAsync(modelId, providerId) {
    try {
      // 1) 确保 trigger 可见（不在设置页）
      const vis = await waitTrue(() => isChatTriggerVisible(), 8000, 200);
      if (!vis) return false;
      const t = document.querySelector('[data-testid="chat-model-select-trigger"]');
      const c = centerOf(t);
      if (!c) return false;
      realClick(c.x, c.y);
      // 2) 等待浮层出现并点击分组
      const grpOk = await waitTrue(() => {
        const groupSel = `[data-testid$="chat-model-select-group-provider:${providerId}"]`;
        const grp = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]')).find((p) => p.querySelector(groupSel));
        return !!grp;
      }, 3000, 120);
      if (!grpOk) return false;
      const groupSel = `[data-testid$="chat-model-select-group-provider:${providerId}"]`;
      const grp = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]')).find((p) => p.querySelector(groupSel));
      const gc = centerOf(grp.querySelector(groupSel));
      if (!gc) return false;
      realClick(gc.x, gc.y);
      // 3) 等待模型项渲染并点击
      const itemOk = await waitTrue(() => {
        for (const p of Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]'))) {
          if (modelId === "__OTHER__") {
            const items = Array.from(p.querySelectorAll(`[data-testid^="chat-model-select-item-custom:${providerId}:"]`));
            const cur = (document.querySelector('[data-testid="v4-model-config"]') || {}).dataset;
            const curModel = cur && cur.model;
            const hit = items.find((it) => {
              const tid = (it.dataset && it.dataset.testid) || "";
              const m = tid.split(":").pop();
              return m !== curModel && m !== "undefined" && m.length;
            });
            if (hit) return true;
          } else {
            const itemSel = `[data-testid$="chat-model-select-item-custom:${providerId}:${modelId}"]`;
            if (p.querySelector(itemSel)) return true;
          }
        }
        return false;
      }, 3000, 120);
      if (!itemOk) return false;
      for (const p of Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]'))) {
        let hit = null;
        if (modelId === "__OTHER__") {
          const items = Array.from(p.querySelectorAll(`[data-testid^="chat-model-select-item-custom:${providerId}:"]`));
          const cur = (document.querySelector('[data-testid="v4-model-config"]') || {}).dataset;
          const curModel = cur && cur.model;
          hit = items.find((it) => {
            const tid = (it.dataset && it.dataset.testid) || "";
            const m = tid.split(":").pop();
            return m !== curModel && m !== "undefined" && m.length;
          });
        } else {
          const itemSel = `[data-testid$="chat-model-select-item-custom:${providerId}:${modelId}"]`;
          hit = p.querySelector(itemSel);
        }
        if (hit) {
          const ic = centerOf(hit);
          if (!ic) return false;
          realClick(ic.x, ic.y);
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // 重选主流程（带循环与校验）：先切到同组另一个模型 → 再切回目标；
  // 若用户仍在模型设置页，等 trigger 可见后再执行；最多 8 轮，单轮相互间隔 ≥2s。
  function autoReselectLoop(mid, pid, exp, attempt) {
    try {
      const span = document.querySelector('[data-testid="v4-model-config"]');
      if (!span) return;
      (async () => {
        await openMenuAndPickAsync("__OTHER__", pid); // 切走（强制 onChange）
        await openMenuAndPickAsync(mid, pid);          // 切回（重建快照）
        await new Promise((r) => setTimeout(r, 600));
        const span2 = document.querySelector('[data-testid="v4-model-config"]');
        const now = span2 ? span2.getAttribute("data-thought-levels") : null;
        const done = !exp || (now && sameLevelSet(now, exp));
        if (!done && attempt < 8) {
          setTimeout(() => autoReselectLoop(mid, pid, exp, attempt + 1), 2000);
        }
      })();
    } catch (e) {}
  }

  // 兜底：旧路径（直接调 pQe onSelectModel，仅当 simulate 通道缺失时使用）
  function pickChatModel(modelId, providerId) {
    try {
      const span = document.querySelector('[data-testid="v4-model-config"]');
      if (!span) return false;
      const cb = findCallbackUp(span, "onSelectModel");
      if (!cb) return false;
      const pid = providerId || span.dataset.provider;
      cb(pid, modelId);
      return true;
    } catch (e) {}
    return false;
  }

  // 劫持官方保存按钮：新增场景触发排队模型落库；编辑场景兜底重写 efforts
  function hookOfficialSave() {
    document.addEventListener(
      "click",
      (ev) => {
        const btn = ev.target && ev.target.closest ? ev.target.closest("button") : null;
        if (!btn) return;
        const txt = (btn.textContent || "").trim();
        if (!/(保存|添加供应商|添加模型供应商|创建|save|add provider|create|确定)/i.test(txt)) return;
        const pending = window.__zcodePendingEnrich;
        if (pending && pending.modelIds && pending.modelIds.length) {
          window.__zcodePendingEnrich = null;
          enrichPending(pending);
          setTimeout(() => enrichPending(pending), 900); // 官方保存完成后兜底补全元数据/默认档位
          // 立即 + 高频读回重写：用户勾选的 efforts 覆盖 enrich 默认档位
          reapEffortsTight(window.__zcodeLastEfforts);
          return;
        }
        if (window.__zcodeLastEfforts) {
          // 官方保存是异步写盘：立即重写 + 400ms 读回验证，直到与勾选一致（即时生效）
          reapEffortsTight(window.__zcodeLastEfforts);
        }
      },
      true // 捕获阶段，先于官方处理
    );
  }

  const observer = new MutationObserver(() => {
    checkAndInject();
    injectEditorRange();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  hookOfficialSave();
  checkAndInject();
})();
