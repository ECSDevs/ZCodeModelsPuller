/**
 * 自动拉取模型选择弹窗 UI
 */

import { getExistingModels } from "../dom/existing-models.js";
import { getCurrentProviderName } from "../dom/credentials.js";
import { getZCodeApi } from "../core/ipc.js";
import { showToast } from "../core/toast.js";
import { FORMATS, FORMAT_TO_KIND } from "../core/constants.js";
import { findPropUp, findPropsUp, getFiber } from "../core/fiber.js";
import { buildOfficialModelConfig } from "../core/model-specs.js";
import { setNativeValue, waitFor } from "../core/dom-utils.js";

// 读取添加供应商页「API 格式」下拉 → 映射为模型条目需要的 kind
export function readApiKind() {
  const findBtn = () =>
    document.querySelector('[data-testid="model-provider-add-model-button"]') ||
    Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );

  // 1. 尝试从添加模型按钮或其祖先 fiber 树读取实际 apiFormat
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

  // 2. 从官方下拉触发器 (model-provider-api-format-trigger) 文本匹配
  const trig = document.querySelector('[data-testid="model-provider-api-format-trigger"]');
  if (trig) {
    const txt = (trig.textContent || "").toLowerCase();
    if (txt.includes("response")) return FORMAT_TO_KIND["openai-responses"] || "openai";
    if (txt.includes("chat") || txt.includes("openai")) return FORMAT_TO_KIND["openai-chat-completions"] || "openai-compatible";
    if (txt.includes("message") || txt.includes("anthropic")) return FORMAT_TO_KIND["anthropic-messages"] || "anthropic";
  }

  // 3. 扫描原生 select（旧版兼容）
  for (const sel of Array.from(document.querySelectorAll("select"))) {
    const v = (sel.value || "").trim();
    if (FORMATS.includes(v)) return FORMAT_TO_KIND[v] || "anthropic";
    const hit = Array.from(sel.options || []).find((o) => FORMATS.includes((o.value || "").trim()));
    if (hit) return FORMAT_TO_KIND[(hit.value || "").trim()] || "anthropic";
  }

  return "openai-compatible";
}

// 无感批量添加：兼容新版 React Hook / ProviderSettingsFormModel 与旧版 onAddModel
export async function addModelsToOfficialForm(ids) {
  if (!ids || !ids.length) return { ok: true, added: 0 };

  const findBtn = () =>
    document.querySelector('[data-testid="model-provider-add-model-button"]') ||
    Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );

  const btn = findBtn();
  if (!btn) return { ok: false, reason: "未找到「添加模型」按钮" };

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

  if (!onAdd && !onAddPersonal) return { ok: false, reason: "未找到官方添加模型回调" };

  const kind = readApiKind();
  const kinds = [kind];
  let added = 0;

  for (const id of ids) {
    const curBtn = findBtn();
    const curOnAdd = curBtn ? findPropUp(curBtn, "onAddModel") : onAdd;

    const me = (window.__zcodeMeta || {})[id] || {};
    // 构造涵盖 max output、modalities、abilities、reasoning efforts 的完整官方配置
    let realApiFormat = "openai-responses";
    if (curBtn) {
      let f = getFiber(curBtn);
      while (f) {
        if (f.memoizedProps) {
          if (typeof f.memoizedProps.apiFormat === "string") { realApiFormat = f.memoizedProps.apiFormat; break; }
          const prov = f.memoizedProps.provider;
          if (prov?.config?.api?.type) { realApiFormat = prov.config.api.type; break; }
        }
        f = f.return;
      }
    }
    const personalConfig = buildOfficialModelConfig(id, me, realApiFormat);

    const modelPayload = {
      // 新版 ZCode 3.14+ (ProviderSettingsFormModel 契约)
      kind: "candidate",
      modelId: id,
      builtin: false,
      personalConfig: personalConfig,
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
      contextWindow: me.ctx || undefined,
      maxOutputTokens: me.out || undefined,
      modalities: { input: me.in || ["text"], output: me.outM || ["text"] },
      kinds: kinds.slice(),
      defaultKind: kind,
      reasoning: me.r
        ? {
            enabled: true,
            levels: me.r.reduce((o, v) => {
              o[v] = { value: v };
              return o;
            }, {}),
            defaultLevel: me.r[me.r.length - 1],
          }
        : { enabled: false, levels: [] },
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
      console.warn("[ZCode-Model-Puller] 添加单个模型失败:", id, e);
      if (e && e.message && e.message.includes("已存在")) {
        added++;
      }
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  return { ok: added > 0, added };
}

// 降级方案：逐个驱动官方「添加模型」弹窗填表
export async function addModelsViaModal(ids) {
  const findAddBtn = () =>
    document.querySelector('[data-testid="model-provider-add-model-button"]') ||
    Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );

  for (const id of ids) {
    const btn = findAddBtn();
    if (!btn) break;
    btn.click();
    const dialog = await waitFor(() => {
      const el =
        document.querySelector('[role="dialog"]') ||
        document.querySelector("[data-model-settings-scroll]") ||
        document.querySelector(".min-h-0.space-y-4.overflow-y-auto") ||
        document.querySelector(".min-h-0.space-y-3.overflow-y-auto.pr-1");
      return el && el.offsetParent !== null ? el : null;
    }, 3000);
    if (!dialog) break;

    const input = Array.from(dialog.querySelectorAll("input")).find(
      (i) => i.type === "text" && !i.readOnly && (i.placeholder === "模型 ID" || i.classList.contains("font-mono") || (!i.value || i.value.trim() === ""))
    );
    if (input) setNativeValue(input, id);

    await new Promise((r) => setTimeout(r, 400));

    const save = await waitFor(
      () =>
        Array.from(dialog.querySelectorAll("button")).find(
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
        } catch (e) {}
      }
      f = f.return;
    }
    if (!saved) {
      save.click();
    }

    await waitFor(() => !dialog.isConnected, 3000); // 等官方弹窗关闭
    await new Promise((r) => setTimeout(r, 200));
  }
}

// 自动触发官方原生刷新
export function triggerZCodeUIRefresh() {
  console.log("[ZCode-Model-Puller] 触发原生自动刷新...");

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

  if (!refreshClicked) {
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const b of buttons) {
      const aria = (b.getAttribute("aria-label") || "").toLowerCase();
      const title = (b.getAttribute("title") || "").toLowerCase();
      const rect = b.getBoundingClientRect();
      if (
        aria.includes("刷新") ||
        aria.includes("refresh") ||
        title.includes("刷新") ||
        title.includes("refresh") ||
        (rect.top < 180 && rect.right > window.innerWidth - 200 && b.querySelector("svg"))
      ) {
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

// 模型选择弹窗主组件
export async function openModelSelectModal(models, baseUrl, apiKey) {
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
  overlay.id = "zcode-pull-modal-overlay";
  overlay.className = "zcode-pull-modal-overlay";

  overlay.innerHTML = `
    <div class="zcode-pull-modal">
      <div class="zcode-pull-header">
        <div class="zcode-pull-title">
          <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
          <span>同步模型 (共 ${models.length} 个，待添加新模型 ${newCount} 个)</span>
        </div>
        <button class="zcode-pull-close" id="zcode-modal-close-btn" title="关闭">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
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
          已选中 <strong id="zcode-selected-num">${newCount}</strong> / ${models.length} 个模型
        </div>
        <div class="zcode-pull-footer-btns">
          <button class="zcode-pull-btn-cancel" id="zcode-modal-cancel">取消</button>
          <button class="zcode-pull-btn-submit" id="zcode-modal-confirm" ${newCount === 0 ? "disabled" : ""}>
            <span>确认添加 (<span id="zcode-btn-selected-num">${newCount}</span>)</span>
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
    for (const [, info] of stateMap) {
      info.selected = true;
    }
    listContainer.querySelectorAll("input[type='checkbox']").forEach((cb) => (cb.checked = true));
    updateCountsOnly();
  };

  overlay.querySelector("#zcode-select-none").onclick = () => {
    for (const [, info] of stateMap) {
      info.selected = false;
    }
    listContainer.querySelectorAll("input[type='checkbox']").forEach((cb) => (cb.checked = false));
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
    confirmBtn.innerHTML = `<span>正在添加...</span>`;

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
      } catch (e0) {}

      closeModal();
      showToast(`正在把 ${toAdd.length} 个模型填入表单…`);
      const res = await addModelsToOfficialForm(toAdd);
      if (!res.ok) {
        showToast(`降级模式：逐个弹出官方「添加模型」弹窗（${res.reason || "未知原因"}）…`);
        await addModelsViaModal(toAdd);
      }
      const told = res.ok ? res.added : toAdd.length;

      // 检查页面是否存在官方全局保存按钮（旧版才有）
      const saveBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => /(保存|添加供应商|创建|save|add provider|create)/i.test((b.textContent || "").trim()) &&
               b.offsetParent !== null &&
               b.id !== "zcode-auto-pull-models-btn"
      );

      if (saveBtn) {
        showToast(`已填入 ${told} 个模型，请点击官方「保存」完成添加`);
      } else {
        showToast(`已成功添加 ${told} 个模型！`);
      }
      setTimeout(() => {
        triggerZCodeUIRefresh();
      }, 120);
    } catch (err) {
      console.error("[ZCode-Model-Puller] 保存失败:", err);
      showToast(`保存出错: ${err.message}`);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<span>确认添加 (${toAdd.length})</span>`;
    }
  };

  document.body.appendChild(overlay);
}
