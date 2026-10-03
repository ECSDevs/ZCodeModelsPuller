/**
 * 官方「添加/编辑模型配置」弹窗原生参数智能填充
 * 覆盖：max output、modalities、abilities、reasoning efforts，并移除旧版注入的 efforts 选单
 */

import { getZCodeApi } from "../core/ipc.js";
import { showToast } from "../core/toast.js";
import { getFiber } from "../core/fiber.js";
import { buildOfficialDraftPatch } from "../core/model-specs.js";

// 获取当前编辑弹窗所属供应商的真实 API 格式
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

// 获取弹窗 Fiber 中的 draft 与 onDraftChange
export function getDialogEditorProps(dialog) {
  let f = getFiber(dialog);
  while (f) {
    if (f.memoizedProps) {
      if (typeof f.memoizedProps.onDraftChange === "function" && f.memoizedProps.draft) {
        return {
          draft: f.memoizedProps.draft,
          onDraftChange: f.memoizedProps.onDraftChange,
        };
      }
    }
    f = f.return;
  }
  return null;
}

// 移除旧版注入的 efforts 选单（避免重复与冲突）
export function cleanLegacyEffortsRows() {
  const legacyRows = document.querySelectorAll("#zcode-editor-efforts-row");
  legacyRows.forEach((r) => r.remove());
}

// 执行官方弹窗字段智能补全
export async function applyOfficialDialogAutofill(dialog, force = false) {
  const editorProps = getDialogEditorProps(dialog);
  if (!editorProps) return false;

  const { draft, onDraftChange } = editorProps;
  const modelId = (draft.idValue || "").trim();
  if (!modelId) return false;

  // 检查是否已经自动填充过
  const lastFilled = dialog.getAttribute("data-zcode-autofilled");
  if (!force && lastFilled === modelId) return false;

  // 检查是否需要填充
  const needsFill =
    force ||
    !draft.maxOutputTokensValue ||
    draft.maxOutputTokensValue.trim() === "" ||
    !draft.overriddenFieldsValue ||
    draft.overriddenFieldsValue.length === 0 ||
    draft.reasoningLevelValuesValue.length <= 2;

  if (!needsFill) {
    dialog.setAttribute("data-zcode-autofilled", modelId);
    return false;
  }

  const apiFormat = detectDialogApiFormat(dialog);

  // 获取元数据缓存或实时查询
  let meta = (window.__zcodeMeta || {})[modelId];
  let metaError = null;
  if (!meta) {
    try {
      const api = getZCodeApi();
      if (api?.getModelMetadata) {
        const res = await api.getModelMetadata({ modelIds: [modelId] });
        if (res && res.meta && res.meta[modelId]) {
          window.__zcodeMeta = { ...(window.__zcodeMeta || {}), ...res.meta };
          meta = res.meta[modelId];
        }
        if (res && !res.success) {
          metaError = res.error || `未找到模型 ${modelId} 的 OMP efforts 思考档位配置（omp efforts 不存在）`;
        }
      }
    } catch (e) {
      metaError = e.message || String(e);
    }
  }

  // 检查 omp efforts 是否存在：取消内置家族表，不存在时报错
  const hasEfforts = meta && ((Array.isArray(meta.r) && meta.r.length > 0) || meta.reasoning === true);
  if (!hasEfforts) {
    const errMsg = metaError || `未找到模型 ${modelId} 的 OMP efforts 思考档位配置（omp efforts 不存在）`;
    console.error("[ZCode-Model-Puller]", errMsg);
    if (force) {
      showToast(`❌ 错误：${errMsg}`);
    }
  }

  const patch = buildOfficialDraftPatch(modelId, meta, apiFormat);
  onDraftChange(patch);
  dialog.setAttribute("data-zcode-autofilled", modelId);
  if (hasEfforts) {
    showToast(`⚡️ 已自动填充 ${modelId} 官方参数与思考档位`);
  } else {
    showToast(`⚡️ 已填充 ${modelId} 参数（OMP efforts 思考档位未收录）`);
  }
  return true;
}

// 注入「⚡️ 智能填充」辅助按钮并执行无感填充
export function injectEditorRange() {
  // 1. 彻底清除旧版注入的 efforts 选单
  cleanLegacyEffortsRows();

  // 2. 查找官方弹窗（兼容 position: fixed 容器）
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog || !dialog.isConnected) return;
  const rect = dialog.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  // 验证是否是模型配置弹窗
  const isModelDialog =
    dialog.querySelector('input[placeholder="模型 ID"]') ||
    /模型 ID|编辑模型配置|添加模型|Context Window/i.test(dialog.textContent || "");
  if (!isModelDialog) return;

  // 3. 在弹窗标题/操作区挂载智能填充按钮
  const targetContainer =
    dialog.querySelector('[data-model-recommended-config]') ||
    dialog.querySelector('[data-slot="dialog-header"]') ||
    dialog.querySelector('h2')?.parentElement;

  if (targetContainer && !targetContainer.querySelector("#zcode-dialog-autofill-btn")) {
    const btn = document.createElement("button");
    btn.id = "zcode-dialog-autofill-btn";
    btn.type = "button";
    btn.title = "根据模型元数据一键自动填充官方 Max Output、输入类型、模型能力及思考档位";
    btn.style.cssText =
      "margin-left: 12px; padding: 2px 10px; font-size: 12px; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.4); background: rgba(59, 130, 246, 0.12); color: #60a5fa; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 500;";
    btn.innerHTML = `<span>⚡️ 智能补全官方参数</span>`;
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyOfficialDialogAutofill(dialog, true);
    };

    targetContainer.appendChild(btn);
  }

  // 4. 首次打开时自动无感填充一次
  applyOfficialDialogAutofill(dialog, false);
}
