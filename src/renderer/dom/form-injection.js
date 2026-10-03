/**
 * 官方添加供应商 / 编辑模型表单注入逻辑
 * 涵盖：API 格式嗅探、React Fiber onAddModel 批量无感填入与官方弹窗降级模式
 */

import { FORMATS, FORMAT_TO_KIND } from "../core/constants.js";
import { findPropUp, findPropsUp, getFiber } from "../core/fiber.js";
import { buildOfficialModelConfig } from "../core/model-specs.js";
import { setNativeValue, waitFor } from "../core/dom-utils.js";
import { showToast } from "../core/toast.js";

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

    const fullOfficialConfig = buildOfficialModelConfig(id, me, realApiFormat);

    const modelObj = {
      modelId: id,
      providerId: currentProviderId || "custom",
      displayName: me.name || id,
      kind: "candidate",
      enabled: true,
      useRecommendedConfig: false,
      personalConfig: {
        ...fullOfficialConfig,
      },
      config: {
        ...fullOfficialConfig,
        enabled: true,
      },
      kinds,
      defaultKind: kind,
    };

    if (typeof curOnAdd === "function") {
      try {
        curOnAdd(modelObj);
        added++;
        continue;
      } catch (e) {
        console.warn("[ZCode-Model-Puller] onAddModel 失败，尝试 onAddPersonalModel:", e);
      }
    }

    if (typeof onAddPersonal === "function" && currentProviderId) {
      try {
        onAddPersonal(currentProviderId, modelObj);
        added++;
        continue;
      } catch (e2) {
        console.warn("[ZCode-Model-Puller] onAddPersonalModel 失败:", e2);
      }
    }
  }

  return { ok: added > 0, added };
}

// 降级模式：逐个驱动官方「添加模型」弹窗
export async function addModelsViaModal(ids) {
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const addBtn =
      document.querySelector('[data-testid="model-provider-add-model-button"]') ||
      Array.from(document.querySelectorAll("button")).find(
        (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
      );
    if (!addBtn) {
      showToast(`未找到「添加模型」按钮，已停止添加剩余模型 (${i}/${ids.length})`);
      break;
    }
    addBtn.click();

    const idInput = await waitFor(() => {
      const el =
        document.querySelector('[data-testid="model-provider-model-id-input"]') ||
        document.querySelector('input[placeholder="模型 ID"]');
      return el && el.offsetParent !== null ? el : null;
    }, 1500);

    if (!idInput) {
      showToast(`等待模型 ID 输入框超时，已跳过 ${id}`);
      continue;
    }

    setNativeValue(idInput, id);

    const nameInput = document.querySelector('input[placeholder="显示名称"]');
    if (nameInput) {
      const me = (window.__zcodeMeta || {})[id];
      if (me && me.name) setNativeValue(nameInput, me.name);
    }

    await new Promise((r) => setTimeout(r, 60));

    const confirmBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => /确定|添加|保存|confirm|add/i.test((b.textContent || "").trim()) &&
             b.offsetParent !== null &&
             !b.disabled &&
             !b.classList.contains("zcode-pull-btn")
    );
    if (confirmBtn) {
      confirmBtn.click();
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
