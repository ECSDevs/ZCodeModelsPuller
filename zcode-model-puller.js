(() => {
  // src/renderer/core/constants.js
  var FORMATS = ["anthropic-messages", "openai-chat-completions", "openai-responses"];
  var FORMAT_TO_KIND = {
    "anthropic-messages": "anthropic",
    "openai-chat-completions": "openai-compatible",
    "openai-responses": "openai"
  };
  var STORAGE_KEYS = {
    LOADED_FLAG: "__ZCODE_MODEL_PULLER_LOADED_PRO__",
    EFFORTS_TOAST_SHOWN: "__zcodeEffortsToastShown",
    LAST_EFFORTS: "__zcodeLastEfforts",
    PENDING_ENRICH: "__zcodePendingEnrich",
    PENDING_SYNC: "__zcodePendingSync",
    META: "__zcodeMeta",
    CHAT_REFRESHED_FOR: "__chatRefreshedFor"
  };

  // src/renderer/styles/theme.js
  function injectStyles() {
    if (document.getElementById("zcode-model-puller-style-pro")) return;
    const style = document.createElement("style");
    style.id = "zcode-model-puller-style-pro";
    style.textContent = `
    /* \u89E6\u53D1\u6309\u94AE\uFF1A\u4E0E\u5B98\u65B9 <Button variant="secondary" size="default" className="rounded-lg"> \u5B8C\u5168\u4E00\u81F4 */
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

    /* \u5F39\u7A97\u906E\u7F69\uFF1A\u9075\u5FAA DialogOverlay (bg-black/60 backdrop-blur-xs) */
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

    /* \u5F39\u7A97\u4E3B\u4F53\uFF1A\u9075\u5FAA DialogContent (rounded-2xl border border-popover-border bg-popover shadow-md) */
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

    /* \u5F39\u7A97\u5934\u90E8 */
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

    /* \u5F39\u7A97\u5185\u5BB9 */
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
    /* \u641C\u7D22\u6846\uFF1A\u9075\u5FAA Input \u7EC4\u4EF6\u89C4\u8303 (bg-input border-input-border text-ui-base) */
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

    /* \u6A21\u578B\u5217\u8868\u5BB9\u5668\uFF1A\u9075\u5FAA border-input-border bg-input */
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

    /* \u5F39\u7A97\u5E95\u90E8\u64CD\u4F5C\u533A */
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

    /* Toast \u6D6E\u5C42\u63D0\u793A\uFF1A\u9075\u5FAA --color-toast \u4E0E\u7B80\u7EA6\u9634\u5F71 */
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

    /* \u7F16\u8F91\u5F39\u7A97\u4E2D\u7684\u601D\u8003\u6863\u4F4D (efforts) \u9009\u62E9\u884C */
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

  // src/renderer/core/ipc.js
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
  function getZCodeClick() {
    try {
      return window.zcode && window.zcode.simulateMouseClick;
    } catch (e) {
      return null;
    }
  }
  function realClick(x, y) {
    const fn = getZCodeClick();
    if (!fn) return false;
    try {
      fn(Math.round(x), Math.round(y));
      return true;
    } catch (e) {
      return false;
    }
  }

  // src/renderer/core/toast.js
  function showToast(message, duration = 3e3) {
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

  // src/renderer/core/dom-utils.js
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
        } catch (e) {
        }
        if (v) return resolve(v);
        if (Date.now() - t0 > timeout) return resolve(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  }
  function waitTrue(fn, timeout, interval = 120) {
    return new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        let v = false;
        try {
          v = fn();
        } catch (e) {
        }
        if (v) return resolve(true);
        if (Date.now() - t0 > timeout) return resolve(false);
        setTimeout(tick, interval);
      };
      tick();
    });
  }
  function centerOf(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  // src/renderer/core/fiber.js
  function getFiber(el) {
    if (!el) return null;
    const key = Object.keys(el).find(
      (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
    );
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

  // src/renderer/dom/radix-simulate.js
  var __chatRefreshTimer = null;
  function sameLevelSet(a, b) {
    if (!a || !b) return false;
    const sa = String(a).split(",").map((s) => s.trim()).filter(Boolean);
    const sb = String(b).split(",").map((s) => s.trim()).filter(Boolean);
    if (sa.length !== sb.length) return false;
    return sa.every((v) => sb.includes(v));
  }
  function isChatTriggerVisible() {
    try {
      const t = document.querySelector('[data-testid="chat-model-select-trigger"]');
      if (!t) return false;
      const r = t.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      if (t.offsetParent === null) return false;
      const cx = Math.round(r.x + r.width / 2);
      const cy = Math.round(r.y + r.height / 2);
      const top = document.elementFromPoint(cx, cy);
      if (!top) return false;
      return top === t || t.contains(top);
    } catch (e) {
      return false;
    }
  }
  async function openMenuAndPickAsync(modelId, providerId) {
    try {
      const vis = await waitTrue(() => isChatTriggerVisible(), 8e3, 200);
      if (!vis) return false;
      const t = document.querySelector('[data-testid="chat-model-select-trigger"]');
      const c = centerOf(t);
      if (!c) return false;
      realClick(c.x, c.y);
      const groupSel = `[data-testid$="chat-model-select-group-provider:${providerId}"]`;
      const grpOk = await waitTrue(() => {
        const grp2 = Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]")).find(
          (p) => p.querySelector(groupSel)
        );
        return !!grp2;
      }, 3e3, 120);
      if (!grpOk) return false;
      const grp = Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]")).find(
        (p) => p.querySelector(groupSel)
      );
      const gc = centerOf(grp.querySelector(groupSel));
      if (!gc) return false;
      realClick(gc.x, gc.y);
      const itemOk = await waitTrue(() => {
        for (const p of Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]"))) {
          if (modelId === "__OTHER__") {
            const items = Array.from(p.querySelectorAll(`[data-testid^="chat-model-select-item-custom:${providerId}:"]`));
            const cur = (document.querySelector('[data-testid="v4-model-config"]') || {}).dataset;
            const curModel = cur && cur.model;
            const hit = items.find((it) => {
              const tid = it.dataset && it.dataset.testid || "";
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
      }, 3e3, 120);
      if (!itemOk) return false;
      for (const p of Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]"))) {
        let hit = null;
        if (modelId === "__OTHER__") {
          const items = Array.from(p.querySelectorAll(`[data-testid^="chat-model-select-item-custom:${providerId}:"]`));
          const cur = (document.querySelector('[data-testid="v4-model-config"]') || {}).dataset;
          const curModel = cur && cur.model;
          hit = items.find((it) => {
            const tid = it.dataset && it.dataset.testid || "";
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
  function autoReselectLoop(mid, pid, exp, attempt = 0) {
    try {
      const span = document.querySelector('[data-testid="v4-model-config"]');
      if (!span) return;
      (async () => {
        await openMenuAndPickAsync("__OTHER__", pid);
        await openMenuAndPickAsync(mid, pid);
        await new Promise((r) => setTimeout(r, 600));
        const span2 = document.querySelector('[data-testid="v4-model-config"]');
        const now = span2 ? span2.getAttribute("data-thought-levels") : null;
        const done = !exp || now && sameLevelSet(now, exp);
        if (!done && attempt < 8) {
          setTimeout(() => autoReselectLoop(mid, pid, exp, attempt + 1), 2e3);
        }
      })();
    } catch (e) {
    }
  }
  function refreshChatSnapshot(modelId, expectedEmpty) {
    try {
      if (__chatRefreshTimer) return;
      const span = document.querySelector('[data-testid="v4-model-config"]');
      if (!span) return;
      const cur = span.dataset || {};
      if (!cur.provider || !cur.model || cur.model !== modelId) return;
      const expected = Array.isArray(expectedEmpty) ? expectedEmpty.join(",") : expectedEmpty;
      __chatRefreshTimer = setTimeout(() => {
        __chatRefreshTimer = null;
        autoReselectLoop(modelId, cur.provider, expected, 0);
      }, 1200);
    } catch (e) {
    }
  }

  // src/renderer/sync/rewrite-loop.js
  function effortsMatch(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  async function reapplyEfforts(le) {
    try {
      const cfg = await readZCodeConfig();
      if (!cfg || !le || !le.modelId || !le.variants) return false;
      let touched = false;
      for (const [, pd] of Object.entries(cfg.provider || {})) {
        const m = (pd.models || {})[le.modelId];
        if (!m) continue;
        if (!m.reasoning || typeof m.reasoning !== "object") m.reasoning = {};
        m.reasoning.enabled = true;
        m.reasoning.variants = le.variants.slice();
        const lv = {};
        le.variants.forEach((v) => lv[v] = { value: v });
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
  function reapEffortsTight(le, round = 0) {
    const target = le || window.__zcodeLastEfforts;
    if (!target || !target.modelId || !target.variants) return;
    reapplyEfforts(target).then((done) => {
      if (done && !window.__chatRefreshedFor) {
        window.__chatRefreshedFor = target.modelId;
        setTimeout(() => refreshChatSnapshot(target.modelId, target.variants), 800);
      }
      const keepGoing = !done || round < 6;
      if (!keepGoing && done && !window.__zcodeEffortsToastShown) {
        window.__zcodeEffortsToastShown = true;
        setTimeout(() => showToast("\u5DF2\u786E\u4FDD\u601D\u8003\u6863\u4F4D\u4FDD\u5B58\u6B63\u786E"), 300);
      }
      if (keepGoing && round < 18) {
        setTimeout(() => reapEffortsTight(target, round + 1), 500);
      }
    });
  }

  // src/renderer/sync/enrich.js
  async function enrichPending(p, attempts = 0) {
    try {
      const api = getZCodeApi();
      if (!api || !api.enrichModelsWithMetadata) return;
      const res = await api.enrichModelsWithMetadata({
        baseUrl: p.baseUrl,
        modelIds: p.modelIds
      });
      if (res && res.success && (res.touched > 0 || attempts >= 5)) {
        showToast(`\u5DF2\u586B\u5145 ${res.touched || 0} \u4E2A\u6A21\u578B\u5143\u6570\u636E`);
        return;
      }
      if (attempts < 5) {
        const delay = Math.min(400 + attempts * 700, 3500);
        setTimeout(() => enrichPending(p, attempts + 1), delay);
      }
    } catch (e) {
    }
  }

  // src/renderer/sync/save-hook.js
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
          setTimeout(() => enrichPending(pending), 900);
          reapEffortsTight(window.__zcodeLastEfforts);
          return;
        }
        if (window.__zcodeLastEfforts) {
          reapEffortsTight(window.__zcodeLastEfforts);
        }
      },
      true
      // 捕获阶段，先于官方处理
    );
  }

  // src/renderer/dom/credentials.js
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
    const baseUrlInput = document.querySelector('input[data-testid="model-provider-base-url-input"]');
    if (baseUrlInput && baseUrlInput.value.trim()) {
      baseUrl = baseUrlInput.value.trim();
    }
    const apiKeyInput = document.querySelector('input[data-testid="model-provider-api-key-input"]');
    if (apiKeyInput && apiKeyInput.value.trim()) {
      apiKey = apiKeyInput.value.trim();
    }
    const inputs = Array.from(document.querySelectorAll("input"));
    for (const input of inputs) {
      const val = input.value.trim();
      const placeholder = (input.placeholder || "").toLowerCase();
      const testid = input.getAttribute("data-testid") || "";
      if (!apiKey && (input.type === "password" || testid.includes("Pne") || placeholder.includes("key") || placeholder.includes("sk-"))) {
        if (val) apiKey = val;
      }
      if (!baseUrl && input.type === "text" && (placeholder.includes("http") || placeholder.includes("v1") || placeholder.includes("api") || val.startsWith("http"))) {
        if (val) baseUrl = val;
      }
    }
    return { baseUrl, apiKey };
  }

  // src/renderer/dom/existing-models.js
  async function getExistingModels(baseUrl) {
    const existing = /* @__PURE__ */ new Set();
    try {
      const addBtn = document.querySelector('[data-testid="model-provider-add-model-button"]') || Array.from(document.querySelectorAll("button")).find(
        (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
      );
      if (addBtn) {
        let f = getFiber(addBtn);
        while (f) {
          if (f.memoizedProps && Array.isArray(f.memoizedProps.models)) {
            for (const m of f.memoizedProps.models) {
              const mid = m && (m.modelId || m.id);
              if (mid && typeof mid === "string") existing.add(mid.trim());
            }
            break;
          }
          f = f.return;
        }
      }
    } catch (e) {
    }
    try {
      document.querySelectorAll("[data-model-provider-model-id]").forEach((el) => {
        const mid = el.getAttribute("data-model-provider-model-id");
        if (mid) existing.add(mid.trim());
      });
    } catch (e) {
    }
    const inputs = document.querySelectorAll("input");
    for (const inp of inputs) {
      const val = (inp.value || "").trim();
      if (!val) continue;
      if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("sk-")) {
        continue;
      }
      const isFontMono = inp.classList.contains("font-mono");
      const isModelPlaceholder = (inp.placeholder || "").includes("\u6A21\u578B") || (inp.placeholder || "").toLowerCase().includes("model");
      const isInsideModelList = inp.closest(".divide-y, .divide-input-border, [class*='divide-']");
      if (isFontMono || isModelPlaceholder || isInsideModelList) {
        existing.add(val);
      }
    }
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
      if (cfg?.config?.providerConfigRules?.providerRules) {
        const cleanBase = (baseUrl || "").replace(/\/+$/, "");
        for (const rule of cfg.config.providerConfigRules.providerRules) {
          const pBase = (rule.config?.api?.baseUrl || "").replace(/\/+$/, "");
          if (!cleanBase || pBase === cleanBase) {
            (rule.config?.personalModelIds || []).forEach((m) => existing.add(m.trim()));
          }
        }
      }
    } catch (e) {
      console.warn("[ZCode-Model-Puller] \u8BFB\u53D6\u914D\u7F6E\u8F85\u52A9\u8BC6\u522B\u51FA\u9519:", e);
    }
    console.log("[ZCode-Model-Puller] \u5916\u90E8\u5DF2\u5C55\u793A\u6A21\u578B\u5217\u8868:", Array.from(existing));
    return existing;
  }

  // src/renderer/core/model-specs.js
  function resolveMaxOutputMap(apiFormat) {
    if (apiFormat === "anthropic-messages") {
      return "{'max_tokens': maxOutputTokens}";
    }
    if (apiFormat === "openai-chat-completions") {
      return "{'max_completion_tokens': maxOutputTokens}";
    }
    return "{'max_output_tokens': maxOutputTokens}";
  }
  function resolveReasoningSpec(modelId, meta = {}, apiFormat = "openai-responses") {
    const id = (modelId || "").toLowerCase();
    const me = meta || {};
    const isReasoning = me.reasoning === true || Array.isArray(me.r) && me.r.length > 0 || /o1|o3|o4|gpt-5|gpt-6|sol|deepseek-r1|deepseek-reasoner|r1|reasoning|thinking|claude-3-7|qwq|gemini-2\.0-flash-thinking|gemini-3/i.test(id);
    if (!isReasoning) {
      return null;
    }
    let levels = [];
    if (Array.isArray(me.r) && me.r.length > 0) {
      levels = me.r.filter((v) => v !== "disabled");
      if (/gpt-5|gpt-6|sol/i.test(id)) {
        for (const extra of ["xhigh", "max"]) {
          if (!levels.includes(extra)) levels.push(extra);
        }
      }
    } else if (/gpt-5|gpt-6|sol|claude-3-7/i.test(id)) {
      levels = ["low", "medium", "high", "xhigh", "max"];
    } else if (/deepseek|r1|kimi|glm/i.test(id)) {
      levels = ["low", "medium", "high", "max"];
    } else if (/gemini/i.test(id)) {
      levels = ["low", "high"];
    } else {
      levels = ["low", "medium", "high"];
    }
    const values = ["disabled", ...levels];
    let map = "";
    if (apiFormat === "anthropic-messages") {
      map = `reasoningLevel == "disabled"
  ? {
      "thinking": {
        "type": "disabled"
      }
    }
  : {
      "thinking": {
        "type": "adaptive"
      },
      "output_config": {
        "effort": reasoningLevel == "enabled" ? "high" : reasoningLevel
      }
    }`;
    } else if (apiFormat === "openai-chat-completions") {
      map = `{
  "thinking": {
    "type": reasoningLevel == "disabled" || reasoningLevel == "none" ? "disabled" : "enabled"
  },
  "enable_thinking": reasoningLevel != "disabled" && reasoningLevel != "none",
  "reasoning_effort": reasoningLevel == "disabled" ? "none" : reasoningLevel == "enabled" ? "high" : reasoningLevel,
  "reasoning": {
    "effort": reasoningLevel == "disabled" ? "none" : reasoningLevel == "enabled" ? "high" : reasoningLevel
  }
}`;
    } else {
      map = `{
  "reasoning": {
    "effort": reasoningLevel == "disabled" ? "none" : reasoningLevel == "enabled" ? "high" : reasoningLevel
  }
}`;
    }
    return { values, map };
  }
  function buildOfficialModelConfig(modelId, meta = {}, apiFormat = "openai-responses") {
    const id = (modelId || "").trim();
    const me = meta || {};
    let contextWindow = 128e3;
    if (typeof me.ctx === "number" && me.ctx > 0) {
      contextWindow = Math.floor(me.ctx);
    } else if (/gpt-5|gpt-6|sol/i.test(id)) {
      contextWindow = 272e3;
    } else if (/claude-3/i.test(id)) {
      contextWindow = 2e5;
    } else if (/gemini/i.test(id)) {
      contextWindow = 1e6;
    } else if (/deepseek/i.test(id)) {
      contextWindow = 65536;
    }
    let maxOut = 16384;
    if (typeof me.out === "number" && me.out > 0) {
      maxOut = Math.floor(me.out);
    } else if (/gpt-5|gpt-6|sol/i.test(id)) {
      maxOut = 32e3;
    } else if (/o1|o3|o4/i.test(id)) {
      maxOut = 65536;
    } else if (/claude-3-7/i.test(id)) {
      maxOut = 64e3;
    } else if (/claude/i.test(id)) {
      maxOut = 8192;
    } else if (/deepseek/i.test(id)) {
      maxOut = 8192;
    } else if (/gemini/i.test(id)) {
      maxOut = 8192;
    }
    const maxOutputMap = resolveMaxOutputMap(apiFormat);
    const hasImage = me.in ? me.in.includes("image") : /gpt-4o|gpt-5|gpt-6|claude-3|gemini|omni|vision|vl|sol/i.test(id);
    const hasVideo = me.in ? me.in.includes("video") : /gemini-1\.5|gemini-2|gemini-3/i.test(id);
    const hasAudio = me.in ? me.in.includes("audio") : /omni|audio|voice/i.test(id);
    const hasPdf = me.in ? me.in.includes("pdf") : /gpt-4o|gpt-5|gpt-6|claude-3|gemini|sol/i.test(id);
    const inputFormat = {
      supportsText: true,
      supportsImage: Boolean(hasImage),
      supportsVideo: Boolean(hasVideo),
      supportsAudio: Boolean(hasAudio),
      supportsPdf: Boolean(hasPdf)
    };
    const supportsToolCall = me.tool_call !== void 0 ? Boolean(me.tool_call) : true;
    const supportsJsonSchemaOutput = me.structured_output !== void 0 ? Boolean(me.structured_output) : /gpt-4o|gpt-4|gpt-5|gpt-6|claude-3|gemini|deepseek|qwen-2\.5|sol/i.test(id);
    const supportsNativeWebSearch = /sonar|search|online|browsing|web/i.test(id);
    const supportsMidConversationSystem = apiFormat !== "anthropic-messages";
    const reasoningSpec = resolveReasoningSpec(id, me, apiFormat);
    const properties = {
      requiresMfjsToolSchema: false,
      contextWindow,
      inputFormat,
      outputFormat: {
        supportsText: true
      },
      supportsToolCall,
      supportsJsonSchemaOutput,
      supportsNativeWebSearch,
      supportsMidConversationSystem
    };
    const optionSpecs = {
      maxOutputTokens: {
        max: maxOut,
        map: maxOutputMap
      }
    };
    if (reasoningSpec) {
      optionSpecs.reasoningLevel = reasoningSpec;
    }
    return {
      properties,
      optionSpecs
    };
  }
  function buildOfficialDraftPatch(modelId, meta = {}, apiFormat = "openai-responses") {
    const cfg = buildOfficialModelConfig(modelId, meta, apiFormat);
    const patch = {};
    if (cfg.properties?.contextWindow) {
      patch.contextWindowValue = String(cfg.properties.contextWindow);
    }
    if (cfg.optionSpecs?.maxOutputTokens?.max) {
      patch.maxOutputTokensValue = String(cfg.optionSpecs.maxOutputTokens.max);
    }
    if (cfg.properties?.inputFormat) {
      patch.inputFormatValue = { ...cfg.properties.inputFormat };
    }
    if (cfg.properties?.supportsJsonSchemaOutput !== void 0) {
      patch.supportsJsonSchemaOutputValue = cfg.properties.supportsJsonSchemaOutput;
    }
    if (cfg.properties?.supportsNativeWebSearch !== void 0) {
      patch.supportsNativeWebSearchValue = cfg.properties.supportsNativeWebSearch;
    }
    if (cfg.properties?.supportsMidConversationSystem !== void 0) {
      patch.supportsMidConversationSystemValue = cfg.properties.supportsMidConversationSystem;
    }
    if (cfg.optionSpecs?.reasoningLevel) {
      patch.reasoningLevelValuesValue = [...cfg.optionSpecs.reasoningLevel.values];
      patch.reasoningLevelMapValue = cfg.optionSpecs.reasoningLevel.map;
    }
    return patch;
  }

  // src/renderer/ui/pull-modal.js
  function readApiKind() {
    const findBtn = () => document.querySelector('[data-testid="model-provider-add-model-button"]') || Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );
    const btn = findBtn();
    if (btn) {
      let f = getFiber(btn);
      while (f) {
        if (f.memoizedProps) {
          if (typeof f.memoizedProps.apiFormat === "string") {
            return FORMAT_TO_KIND[f.memoizedProps.apiFormat] || "openai-compatible";
          }
          const prov = f.memoizedProps.provider;
          if (prov && prov.config && prov.config.api && typeof prov.config.api.type === "string") {
            return FORMAT_TO_KIND[prov.config.api.type] || "openai-compatible";
          }
        }
        f = f.return;
      }
    }
    const trig = document.querySelector('[data-testid="model-provider-api-format-trigger"]');
    if (trig) {
      const txt = (trig.textContent || "").toLowerCase();
      if (txt.includes("response")) return FORMAT_TO_KIND["openai-responses"] || "openai";
      if (txt.includes("chat") || txt.includes("openai")) return FORMAT_TO_KIND["openai-chat-completions"] || "openai-compatible";
      if (txt.includes("message") || txt.includes("anthropic")) return FORMAT_TO_KIND["anthropic-messages"] || "anthropic";
    }
    for (const sel of Array.from(document.querySelectorAll("select"))) {
      const v = (sel.value || "").trim();
      if (FORMATS.includes(v)) return FORMAT_TO_KIND[v] || "anthropic";
      const hit = Array.from(sel.options || []).find((o) => FORMATS.includes((o.value || "").trim()));
      if (hit) return FORMAT_TO_KIND[(hit.value || "").trim()] || "anthropic";
    }
    return "openai-compatible";
  }
  async function addModelsToOfficialForm(ids) {
    if (!ids || !ids.length) return { ok: true, added: 0 };
    const findBtn = () => document.querySelector('[data-testid="model-provider-add-model-button"]') || Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );
    const btn = findBtn();
    if (!btn) return { ok: false, reason: "\u672A\u627E\u5230\u300C\u6DFB\u52A0\u6A21\u578B\u300D\u6309\u94AE" };
    let onAdd = findPropUp(btn, "onAddModel");
    let onAddPersonal = null;
    let currentProviderId = null;
    let f = getFiber(btn);
    while (f) {
      if (f.memoizedProps) {
        if (!onAdd && typeof f.memoizedProps.onAddModel === "function") {
          onAdd = f.memoizedProps.onAddModel;
        }
        if (!onAddPersonal && typeof f.memoizedProps.onAddPersonalModel === "function") {
          onAddPersonal = f.memoizedProps.onAddPersonalModel;
        }
        if (!currentProviderId && f.memoizedProps.provider && f.memoizedProps.provider.providerId) {
          currentProviderId = f.memoizedProps.provider.providerId;
        }
        if (!currentProviderId && typeof f.memoizedProps.providerId === "string") {
          currentProviderId = f.memoizedProps.providerId;
        }
      }
      f = f.return;
    }
    if (!onAdd && !onAddPersonal) return { ok: false, reason: "\u672A\u627E\u5230\u5B98\u65B9\u6DFB\u52A0\u6A21\u578B\u56DE\u8C03" };
    const kind = readApiKind();
    const kinds = [kind];
    let added = 0;
    for (const id of ids) {
      const curBtn = findBtn();
      const curOnAdd = curBtn ? findPropUp(curBtn, "onAddModel") : onAdd;
      const me = (window.__zcodeMeta || {})[id] || {};
      let realApiFormat = "openai-responses";
      if (curBtn) {
        let f2 = getFiber(curBtn);
        while (f2) {
          if (f2.memoizedProps) {
            if (typeof f2.memoizedProps.apiFormat === "string") {
              realApiFormat = f2.memoizedProps.apiFormat;
              break;
            }
            const prov = f2.memoizedProps.provider;
            if (prov?.config?.api?.type) {
              realApiFormat = prov.config.api.type;
              break;
            }
          }
          f2 = f2.return;
        }
      }
      const personalConfig = buildOfficialModelConfig(id, me, realApiFormat);
      const modelPayload = {
        // 新版 ZCode 3.14+ (ProviderSettingsFormModel 契约)
        kind: "candidate",
        modelId: id,
        builtin: false,
        personalConfig,
        config: {
          properties: { supportsToolCall: true }
        },
        hasPersonalConfig: Object.keys(personalConfig).length > 0,
        executable: true,
        selectable: true,
        useRecommendedConfig: true,
        // 旧版 ZCode 字段兼容
        id,
        name: id.split("/").pop() || id,
        contextWindow: me.ctx || void 0,
        maxOutputTokens: me.out || void 0,
        modalities: { input: me.in || ["text"], output: me.outM || ["text"] },
        kinds: kinds.slice(),
        defaultKind: kind,
        reasoning: me.r ? {
          enabled: true,
          levels: me.r.reduce((o, v) => {
            o[v] = { value: v };
            return o;
          }, {}),
          defaultLevel: me.r[me.r.length - 1]
        } : { enabled: false, levels: [] }
      };
      try {
        if (curOnAdd) {
          await curOnAdd(modelPayload);
          added++;
        } else if (onAddPersonal && currentProviderId) {
          await onAddPersonal(currentProviderId, id, structuredClone(personalConfig), true);
          added++;
        }
      } catch (e) {
        console.warn("[ZCode-Model-Puller] \u6DFB\u52A0\u5355\u4E2A\u6A21\u578B\u5931\u8D25:", id, e);
        if (e && e.message && e.message.includes("\u5DF2\u5B58\u5728")) {
          added++;
        }
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    return { ok: added > 0, added };
  }
  async function addModelsViaModal(ids) {
    const findAddBtn = () => document.querySelector('[data-testid="model-provider-add-model-button"]') || Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );
    for (const id of ids) {
      const btn = findAddBtn();
      if (!btn) break;
      btn.click();
      const dialog = await waitFor(() => {
        const el = document.querySelector('[role="dialog"]') || document.querySelector("[data-model-settings-scroll]") || document.querySelector(".min-h-0.space-y-4.overflow-y-auto") || document.querySelector(".min-h-0.space-y-3.overflow-y-auto.pr-1");
        return el && el.offsetParent !== null ? el : null;
      }, 3e3);
      if (!dialog) break;
      const input = Array.from(dialog.querySelectorAll("input")).find(
        (i) => i.type === "text" && !i.readOnly && (i.placeholder === "\u6A21\u578B ID" || i.classList.contains("font-mono") || (!i.value || i.value.trim() === ""))
      );
      if (input) setNativeValue(input, id);
      await new Promise((r) => setTimeout(r, 400));
      const save = await waitFor(
        () => Array.from(dialog.querySelectorAll("button")).find(
          (b) => /(保存|添加|save|add|确定)/i.test((b.textContent || "").trim()) && b.offsetParent !== null
        ),
        2500
      );
      if (!save) break;
      let saved = false;
      let f = getFiber(save);
      while (f) {
        if (f.memoizedProps && typeof f.memoizedProps.onSave === "function") {
          try {
            await f.memoizedProps.onSave();
            saved = true;
            break;
          } catch (e) {
          }
        }
        f = f.return;
      }
      if (!saved) {
        save.click();
      }
      await waitFor(() => !dialog.isConnected, 3e3);
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  function triggerZCodeUIRefresh() {
    console.log("[ZCode-Model-Puller] \u89E6\u53D1\u539F\u751F\u81EA\u52A8\u5237\u65B0...");
    let refreshClicked = false;
    const descParagraph = Array.from(document.querySelectorAll("p")).find(
      (p) => p.textContent.includes("\u7BA1\u7406\u81EA\u5B9A\u4E49\u6A21\u578B\u4F9B\u5E94\u5546") || p.textContent.includes("\u914D\u7F6E\u540E\u53EF\u5728\u804A\u5929\u65F6\u9009\u62E9\u4F7F\u7528")
    );
    if (descParagraph && descParagraph.parentElement) {
      const btn = descParagraph.parentElement.querySelector("button");
      if (btn) {
        console.log("[ZCode-Model-Puller] \u70B9\u51FB\u5B98\u65B9\u4E3B\u5237\u65B0\u6309\u94AE");
        btn.click();
        refreshClicked = true;
      }
    }
    if (!refreshClicked) {
      const buttons = Array.from(document.querySelectorAll("button"));
      for (const b of buttons) {
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        const title = (b.getAttribute("title") || "").toLowerCase();
        const rect = b.getBoundingClientRect();
        if (aria.includes("\u5237\u65B0") || aria.includes("refresh") || title.includes("\u5237\u65B0") || title.includes("refresh") || rect.top < 180 && rect.right > window.innerWidth - 200 && b.querySelector("svg")) {
          b.click();
          refreshClicked = true;
          break;
        }
      }
    }
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
  async function openModelSelectModal(models, baseUrl, apiKey) {
    const existingModels = await getExistingModels(baseUrl);
    const stateMap = /* @__PURE__ */ new Map();
    let newCount = 0;
    for (const id of models) {
      const exists = existingModels.has(id);
      const selected = !exists;
      stateMap.set(id, { exists, selected });
      if (!exists) newCount++;
    }
    const overlay = document.createElement("div");
    overlay.id = "zcode-pull-modal-overlay";
    overlay.className = "zcode-pull-modal-overlay";
    overlay.innerHTML = `
    <div class="zcode-pull-modal">
      <div class="zcode-pull-header">
        <div class="zcode-pull-title">
          <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
          <span>\u540C\u6B65\u6A21\u578B (\u5171 ${models.length} \u4E2A\uFF0C\u5F85\u6DFB\u52A0\u65B0\u6A21\u578B ${newCount} \u4E2A)</span>
        </div>
        <button class="zcode-pull-close" id="zcode-modal-close-btn" title="\u5173\u95ED">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="zcode-pull-body">
        <div class="zcode-pull-toolbar">
          <input type="text" class="zcode-pull-search" id="zcode-modal-search" placeholder="\u641C\u7D22\u6A21\u578B\u540D\u79F0..." />
          <div class="zcode-pull-btn-group">
            <button class="zcode-pull-mini-btn" id="zcode-select-all">\u5168\u9009</button>
            <button class="zcode-pull-mini-btn" id="zcode-select-none">\u6E05\u7A7A</button>
            <button class="zcode-pull-mini-btn" id="zcode-select-new">\u4EC5\u9009\u65B0\u6A21\u578B (${newCount})</button>
          </div>
        </div>
        <div class="zcode-pull-list" id="zcode-modal-list">
          ${models.map((id) => {
      const info = stateMap.get(id);
      return `
            <div class="zcode-pull-item" data-id="${id}">
              <input type="checkbox" ${info.selected ? "checked" : ""} data-id="${id}" />
              <span class="zcode-pull-item-name">${id}</span>
              ${info.exists ? `<span class="zcode-pull-badge zcode-pull-badge-exists">\u5DF2\u6DFB\u52A0</span>` : `<span class="zcode-pull-badge zcode-pull-badge-new">\u65B0\u6A21\u578B</span>`}
            </div>
          `;
    }).join("")}
        </div>
      </div>
      <div class="zcode-pull-footer">
        <div class="zcode-pull-count-info" id="zcode-pull-count-info">
          \u5DF2\u9009\u4E2D <strong id="zcode-selected-num">${newCount}</strong> / ${models.length} \u4E2A\u6A21\u578B
        </div>
        <div class="zcode-pull-footer-btns">
          <button class="zcode-pull-btn-cancel" id="zcode-modal-cancel">\u53D6\u6D88</button>
          <button class="zcode-pull-btn-submit" id="zcode-modal-confirm" ${newCount === 0 ? "disabled" : ""}>
            <span>\u786E\u8BA4\u6DFB\u52A0 (<span id="zcode-btn-selected-num">${newCount}</span>)</span>
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
      const confirmBtn2 = overlay.querySelector("#zcode-modal-confirm");
      if (numSpan) numSpan.textContent = selCount;
      if (btnNumSpan) btnNumSpan.textContent = selCount;
      if (confirmBtn2) confirmBtn2.disabled = selCount === 0;
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
      for (const [, info] of stateMap) {
        info.selected = true;
      }
      listContainer.querySelectorAll("input[type='checkbox']").forEach((cb) => cb.checked = true);
      updateCountsOnly();
    };
    overlay.querySelector("#zcode-select-none").onclick = () => {
      for (const [, info] of stateMap) {
        info.selected = false;
      }
      listContainer.querySelectorAll("input[type='checkbox']").forEach((cb) => cb.checked = false);
      updateCountsOnly();
    };
    overlay.querySelector("#zcode-select-new").onclick = () => {
      for (const [, info] of stateMap) {
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
      confirmBtn.innerHTML = `<span>\u6B63\u5728\u6DFB\u52A0...</span>`;
      try {
        window.__zcodePendingEnrich = { baseUrl, modelIds: toAdd };
        window.__zcodePendingSync = null;
        window.__zcodeMeta = {};
        try {
          const gz = getZCodeApi();
          if (gz && gz.getModelMetadata) {
            const mr = await gz.getModelMetadata({ modelIds: toAdd });
            if (mr && mr.success) window.__zcodeMeta = mr.meta || {};
          }
        } catch (e0) {
        }
        closeModal();
        showToast(`\u6B63\u5728\u628A ${toAdd.length} \u4E2A\u6A21\u578B\u586B\u5165\u8868\u5355\u2026`);
        const res = await addModelsToOfficialForm(toAdd);
        if (!res.ok) {
          showToast(`\u964D\u7EA7\u6A21\u5F0F\uFF1A\u9010\u4E2A\u5F39\u51FA\u5B98\u65B9\u300C\u6DFB\u52A0\u6A21\u578B\u300D\u5F39\u7A97\uFF08${res.reason || "\u672A\u77E5\u539F\u56E0"}\uFF09\u2026`);
          await addModelsViaModal(toAdd);
        }
        const told = res.ok ? res.added : toAdd.length;
        const saveBtn = Array.from(document.querySelectorAll("button")).find(
          (b) => /(保存|添加供应商|创建|save|add provider|create)/i.test((b.textContent || "").trim()) && b.offsetParent !== null && b.id !== "zcode-auto-pull-models-btn"
        );
        if (saveBtn) {
          showToast(`\u5DF2\u586B\u5165 ${told} \u4E2A\u6A21\u578B\uFF0C\u8BF7\u70B9\u51FB\u5B98\u65B9\u300C\u4FDD\u5B58\u300D\u5B8C\u6210\u6DFB\u52A0`);
        } else {
          showToast(`\u5DF2\u6210\u529F\u6DFB\u52A0 ${told} \u4E2A\u6A21\u578B\uFF01`);
        }
        setTimeout(() => {
          triggerZCodeUIRefresh();
        }, 120);
      } catch (err) {
        console.error("[ZCode-Model-Puller] \u4FDD\u5B58\u5931\u8D25:", err);
        showToast(`\u4FDD\u5B58\u51FA\u9519: ${err.message}`);
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<span>\u786E\u8BA4\u6DFB\u52A0 (${toAdd.length})</span>`;
      }
    };
    document.body.appendChild(overlay);
  }

  // src/renderer/ui/pull-button.js
  function checkAndInject() {
    let addModelBtn = document.querySelector('[data-testid="model-provider-add-model-button"]') || document.querySelector('[data-testid="Goe"]');
    if (!addModelBtn) {
      const btns = Array.from(document.querySelectorAll("button"));
      addModelBtn = btns.find(
        (b) => b.textContent.includes("\u6DFB\u52A0\u6A21\u578B") && b.getAttribute("id") !== "zcode-auto-pull-models-btn"
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
    pullBtn.setAttribute("title", "\u6839\u636E\u5F53\u524D Base URL \u548C API Key \u81EA\u52A8\u62C9\u53D6\u6240\u6709\u53EF\u7528\u6A21\u578B");
    pullBtn.innerHTML = `
    <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    <span>\u62C9\u53D6\u6A21\u578B</span>
  `;
    pullBtn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const { baseUrl, apiKey } = getFormCredentials();
      console.log("[ZCode-Model-Puller] \u70B9\u51FB\u62C9\u53D6\uFF0C\u51ED\u636E:", { baseUrl, hasKey: !!apiKey });
      if (!baseUrl) {
        showToast("\u26A0\uFE0F \u8BF7\u5148\u5728\u4E0A\u65B9\u586B\u5199 Base URL");
        return;
      }
      pullBtn.classList.add("loading");
      pullBtn.innerHTML = `
      <svg class="zcode-spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      <span>\u6B63\u5728\u62C9\u53D6\u6A21\u578B...</span>
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
              `${cleanUrl}/models`
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
                  const list = (data.data || data.models || data).map(
                    (m) => typeof m === "string" ? m : m.id || m.name
                  );
                  result = { success: true, models: list.filter(Boolean) };
                  break;
                }
              } catch (e2) {
              }
            }
          } catch (fetchErr) {
            result = { success: false, error: fetchErr.message };
          }
        }
        if (result?.success && result.models?.length > 0) {
          await openModelSelectModal(result.models, baseUrl, apiKey);
        } else {
          showToast(result?.error ? `\u62C9\u53D6\u5931\u8D25: ${result.error}` : "\u672A\u83B7\u53D6\u5230\u6A21\u578B\uFF0C\u8BF7\u68C0\u67E5 Base URL \u548C API Key");
        }
      } catch (err) {
        showToast(`\u8BF7\u6C42\u5F02\u5E38: ${err.message}`);
      } finally {
        pullBtn.classList.remove("loading");
        pullBtn.innerHTML = `
        <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
        <span>\u62C9\u53D6\u6A21\u578B</span>
      `;
      }
    };
    addModelBtn.after(pullBtn);
  }

  // src/renderer/ui/editor-efforts.js
  function detectDialogApiFormat(dialog) {
    const trig = document.querySelector('[data-testid="model-provider-api-format-trigger"]');
    if (trig) {
      const txt = (trig.textContent || "").toLowerCase();
      if (txt.includes("response")) return "openai-responses";
      if (txt.includes("chat") || txt.includes("openai")) return "openai-chat-completions";
      if (txt.includes("message") || txt.includes("anthropic")) return "anthropic-messages";
    }
    const addBtn = document.querySelector('[data-testid="model-provider-add-model-button"]');
    if (addBtn) {
      let f = getFiber(addBtn);
      while (f) {
        if (f.memoizedProps) {
          if (typeof f.memoizedProps.apiFormat === "string") return f.memoizedProps.apiFormat;
          const prov = f.memoizedProps.provider;
          if (prov?.config?.api?.type) return prov.config.api.type;
        }
        f = f.return;
      }
    }
    return "openai-responses";
  }
  function getDialogEditorProps(dialog) {
    let f = getFiber(dialog);
    while (f) {
      if (f.memoizedProps) {
        if (typeof f.memoizedProps.onDraftChange === "function" && f.memoizedProps.draft) {
          return {
            draft: f.memoizedProps.draft,
            onDraftChange: f.memoizedProps.onDraftChange
          };
        }
      }
      f = f.return;
    }
    return null;
  }
  function cleanLegacyEffortsRows() {
    const legacyRows = document.querySelectorAll("#zcode-editor-efforts-row");
    legacyRows.forEach((r) => r.remove());
  }
  async function applyOfficialDialogAutofill(dialog, force = false) {
    const editorProps = getDialogEditorProps(dialog);
    if (!editorProps) return false;
    const { draft, onDraftChange } = editorProps;
    const modelId = (draft.idValue || "").trim();
    if (!modelId) return false;
    const lastFilled = dialog.getAttribute("data-zcode-autofilled");
    if (!force && lastFilled === modelId) return false;
    const needsFill = force || !draft.maxOutputTokensValue || draft.maxOutputTokensValue.trim() === "" || !draft.overriddenFieldsValue || draft.overriddenFieldsValue.length === 0 || draft.reasoningLevelValuesValue.length <= 2;
    if (!needsFill) {
      dialog.setAttribute("data-zcode-autofilled", modelId);
      return false;
    }
    const apiFormat = detectDialogApiFormat(dialog);
    let meta = (window.__zcodeMeta || {})[modelId];
    if (!meta) {
      try {
        const api = getZCodeApi();
        if (api?.getModelMetadata) {
          const res = await api.getModelMetadata({ modelIds: [modelId] });
          if (res && res.success && res.meta) {
            window.__zcodeMeta = { ...window.__zcodeMeta || {}, ...res.meta };
            meta = res.meta[modelId];
          }
        }
      } catch (e) {
      }
    }
    const patch = buildOfficialDraftPatch(modelId, meta, apiFormat);
    onDraftChange(patch);
    dialog.setAttribute("data-zcode-autofilled", modelId);
    showToast(`\u26A1\uFE0F \u5DF2\u81EA\u52A8\u586B\u5145 ${modelId} \u5B98\u65B9\u53C2\u6570\u4E0E\u601D\u8003\u6863\u4F4D`);
    return true;
  }
  function injectEditorRange() {
    cleanLegacyEffortsRows();
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog || !dialog.isConnected) return;
    const rect = dialog.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const isModelDialog = dialog.querySelector('input[placeholder="\u6A21\u578B ID"]') || /模型 ID|编辑模型配置|添加模型|Context Window/i.test(dialog.textContent || "");
    if (!isModelDialog) return;
    const targetContainer = dialog.querySelector("[data-model-recommended-config]") || dialog.querySelector('[data-slot="dialog-header"]') || dialog.querySelector("h2")?.parentElement;
    if (targetContainer && !targetContainer.querySelector("#zcode-dialog-autofill-btn")) {
      const btn = document.createElement("button");
      btn.id = "zcode-dialog-autofill-btn";
      btn.type = "button";
      btn.title = "\u6839\u636E\u6A21\u578B\u5143\u6570\u636E\u4E00\u952E\u81EA\u52A8\u586B\u5145\u5B98\u65B9 Max Output\u3001\u8F93\u5165\u7C7B\u578B\u3001\u6A21\u578B\u80FD\u529B\u53CA\u601D\u8003\u6863\u4F4D";
      btn.style.cssText = "margin-left: 12px; padding: 2px 10px; font-size: 12px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.4); background: rgba(59, 130, 246, 0.12); color: #60a5fa; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;";
      btn.innerHTML = `<span>\u26A1\uFE0F \u667A\u80FD\u8865\u5168\u5B98\u65B9\u53C2\u6570</span>`;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyOfficialDialogAutofill(dialog, true);
      };
      targetContainer.appendChild(btn);
    }
    applyOfficialDialogAutofill(dialog, false);
  }

  // src/renderer/index.js
  (() => {
    if (window[STORAGE_KEYS.LOADED_FLAG]) return;
    window[STORAGE_KEYS.LOADED_FLAG] = true;
    console.log("[ZCode-Model-Puller] \u5F00\u6E90\u65D7\u8230\u7248\u63D2\u4EF6\u5DF2\u88C5\u8F7D");
    injectStyles();
    hookOfficialSave();
    checkAndInject();
    injectEditorRange();
    const observer = new MutationObserver(() => {
      checkAndInject();
      injectEditorRange();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  })();
})();
