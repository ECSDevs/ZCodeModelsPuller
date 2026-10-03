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

// 清理与严格对齐 personalConfig 字段，符合 ZCode Zod Schema
function sanitizePersonalConfig(rawCfg) {
  const c = rawCfg || {};
  const props = c.properties || {};
  const opt = c.optionSpecs || {};
  const rawInput = props.inputFormat || {};

  const clean = {
    enabled: c.enabled !== undefined ? !!c.enabled : true,
    properties: {
      ...(props.contextWindow !== undefined ? { contextWindow: Number(props.contextWindow) } : {}),
      inputFormat: {
        supportsImage: !!rawInput.supportsImage,
        supportsVideo: !!rawInput.supportsVideo,
        supportsPdf: !!rawInput.supportsPdf,
      },
      supportsJsonSchemaOutput: !!props.supportsJsonSchemaOutput,
      supportsNativeWebSearch: !!props.supportsNativeWebSearch,
      supportsMidConversationSystem: !!props.supportsMidConversationSystem,
    },
    optionSpecs: {
      ...(opt.maxOutputTokens?.max !== undefined ? { maxOutputTokens: { max: Number(opt.maxOutputTokens.max) } } : {}),
      ...(opt.reasoningLevel?.values ? { reasoningLevel: { values: opt.reasoningLevel.values, map: opt.reasoningLevel.map } } : {}),
    },
  };
  return clean;
}

// 无感批量添加与覆盖更新：兼容新版 React Hook / onModelCommit / onAddModel
export async function addModelsToOfficialForm(ids) {
  if (!ids || !ids.length) return { ok: true, added: 0, overwritten: 0 };

  const findBtn = () =>
    document.querySelector('[data-testid="model-provider-add-model-button"]') ||
    Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );

  const btn = findBtn();
  if (!btn) return { ok: false, reason: "未找到「添加模型」按钮" };

  let onAdd = findPropUp(btn, "onAddModel");
  let onModelCommit = findPropUp(btn, "onModelCommit");
  let onDelete = findPropUp(btn, "onDeleteModel");
  let onAddPersonal = null;
  let onDeletePersonal = null;
  let currentProviderId = null;
  let settingsRevision = null;
  let currentModels = [];

  let f = getFiber(btn);
  while (f) {
    if (f.memoizedProps) {
      const p = f.memoizedProps;
      if (!onAdd && typeof p.onAddModel === "function") onAdd = p.onAddModel;
      if (!onModelCommit && typeof p.onModelCommit === "function") onModelCommit = p.onModelCommit;
      if (!onDelete && typeof p.onDeleteModel === "function") onDelete = p.onDeleteModel;
      if (!onAddPersonal && typeof p.onAddPersonalModel === "function") onAddPersonal = p.onAddPersonalModel;
      if (!onDeletePersonal && typeof p.onDeletePersonalModel === "function") onDeletePersonal = p.onDeletePersonalModel;
      if (!currentProviderId && p.providerId) currentProviderId = p.providerId;
      if (!currentProviderId && p.provider?.providerId) currentProviderId = p.provider.providerId;
      if (!settingsRevision && p.settingsRevision !== undefined) settingsRevision = p.settingsRevision;
      if (currentModels.length === 0 && Array.isArray(p.models)) currentModels = p.models;
    }
    f = f.return;
  }

  if (!onAdd && !onAddPersonal && !onModelCommit) {
    return { ok: false, reason: "未找到官方添加/保存模型回调" };
  }

  const kind = readApiKind();
  const kinds = [kind];
  let added = 0;
  let overwritten = 0;

  for (const id of ids) {
    const curBtn = findBtn();
    const curOnAdd = curBtn ? (findPropUp(curBtn, "onAddModel") || onAdd) : onAdd;
    const curOnCommit = curBtn ? (findPropUp(curBtn, "onModelCommit") || onModelCommit) : onModelCommit;
    const curOnDelete = curBtn ? (findPropUp(curBtn, "onDeleteModel") || onDelete) : onDelete;

    let realApiFormat = "openai-responses";
    if (curBtn) {
      let fCur = getFiber(curBtn);
      while (fCur) {
        if (fCur.memoizedProps) {
          if (typeof fCur.memoizedProps.apiFormat === "string") {
            realApiFormat = fCur.memoizedProps.apiFormat;
            break;
          }
          const prov = fCur.memoizedProps.provider;
          if (prov?.config?.api?.type) {
            realApiFormat = prov.config.api.type;
            break;
          }
        }
        fCur = fCur.return;
      }
    }

    // 动态从最新 fiber 节点刷新当前模型列表与 settingsRevision
    let modelsList = currentModels;
    if (curBtn) {
      let fCur = getFiber(curBtn);
      while (fCur) {
        if (fCur.memoizedProps?.models && Array.isArray(fCur.memoizedProps.models)) {
          modelsList = fCur.memoizedProps.models;
          if (fCur.memoizedProps.settingsRevision !== undefined) {
            settingsRevision = fCur.memoizedProps.settingsRevision;
          }
          break;
        }
        fCur = fCur.return;
      }
    }

    const existingModel = (modelsList || []).find(
      (m) => (m.modelId || m.id) === id
    );

    const me = (window.__zcodeMeta || {})[id] || {};
    const fullOfficialConfig = buildOfficialModelConfig(id, me, realApiFormat);
    const cleanPersonal = sanitizePersonalConfig(fullOfficialConfig);

    const modelObj = {
      modelId: id,
      providerId: currentProviderId || "custom",
      displayName: me.name || (existingModel && existingModel.displayName) || id,
      kind: "candidate",
      enabled: true,
      useRecommendedConfig: false,
      personalConfig: cleanPersonal,
      config: {
        ...cleanPersonal,
        enabled: true,
      },
      kinds,
      defaultKind: kind,
    };

    // 1. 若模型已存在：执行覆盖更新逻辑
    if (existingModel) {
      let overwriteSuccess = false;

      // 1.1 首选：调用官方原子 onModelCommit 直接覆盖写盘
      if (typeof curOnCommit === "function") {
        try {
          const nextModel = {
            ...structuredClone(existingModel),
            ...modelObj,
            personalConfig: sanitizePersonalConfig({
              ...structuredClone(existingModel.personalConfig || {}),
              ...cleanPersonal,
            }),
            config: sanitizePersonalConfig({
              ...structuredClone(existingModel.config || {}),
              ...cleanPersonal,
            }),
          };
          await curOnCommit(id, nextModel, undefined);
          overwritten++;
          overwriteSuccess = true;
        } catch (commitErr) {
          console.warn(`[ZCode-Model-Puller] onModelCommit 覆盖模型 ${id} 失败，尝试删除后重新添加:`, commitErr);
        }
      }

      // 1.2 备选：若 onModelCommit 不可用或失败，先删除旧模型再新增
      if (!overwriteSuccess) {
        try {
          if (typeof curOnDelete === "function") {
            await curOnDelete(id);
          } else if (typeof onDeletePersonal === "function" && currentProviderId) {
            await onDeletePersonal(currentProviderId, id);
          }
          await new Promise((r) => setTimeout(r, 60));

          if (typeof curOnAdd === "function") {
            await curOnAdd(modelObj);
            overwritten++;
            overwriteSuccess = true;
          } else if (typeof onAddPersonal === "function" && currentProviderId) {
            await onAddPersonal(currentProviderId, modelObj);
            overwritten++;
            overwriteSuccess = true;
          }
        } catch (delAddErr) {
          console.warn(`[ZCode-Model-Puller] 删除重加模型 ${id} 失败:`, delAddErr);
        }
      }

      if (overwriteSuccess) continue;
    }

    // 2. 若模型不存在：执行新增逻辑
    let addSuccess = false;
    if (typeof curOnAdd === "function") {
      try {
        await curOnAdd(modelObj);
        added++;
        addSuccess = true;
      } catch (e) {
        console.warn("[ZCode-Model-Puller] onAddModel 失败，尝试 onAddPersonalModel:", e);
      }
    }

    if (!addSuccess && typeof onAddPersonal === "function" && currentProviderId) {
      try {
        await onAddPersonal(currentProviderId, modelObj);
        added++;
        addSuccess = true;
      } catch (e2) {
        console.warn("[ZCode-Model-Puller] onAddPersonalModel 失败:", e2);
      }
    }
  }

  return { ok: added > 0 || overwritten > 0, added, overwritten };
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
