/**
 * 官方内存模型 state 同步 (React fiber onModelCommit 查找与调用)
 */

import { findCallbackUp, findPropsUp } from "../core/fiber.js";

// 同步官方内存模型 state
export function syncOfficialModelState(mid, reasoning) {
  try {
    const body =
      document.querySelector('[role="dialog"]') ||
      document.querySelector("[data-model-settings-scroll]") ||
      document.querySelector(".min-h-0.space-y-4.overflow-y-auto") ||
      document.querySelector(".min-h-0.space-y-3.overflow-y-auto.pr-1");
    if (!body) return false;

    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) =>
        (b.getAttribute("data-testid") === "model-provider-add-model-button" ||
          /添加模型|add model/i.test((b.textContent || "").trim())) &&
        b.offsetParent !== null
    );
    const models = btn && findPropsUp(btn, "models");
    if (!Array.isArray(models)) return false;
    const idx = models.findIndex((m) => m && (m.id || m.modelId) === mid);
    if (idx < 0) return false;

    // 1. 新版：三参 onModelCommit (originalModelId, model, revision)
    const onCommit3 = findCallbackUp(body, "onModelCommit", 3);
    if (onCommit3) {
      onCommit3(mid, { ...models[idx], reasoning, modelId: mid, id: mid }, 0);
      return true;
    }

    // 2. 旧版：双参 onModelCommit (index, model)
    const onCommit2 = findCallbackUp(body, "onModelCommit", 2);
    if (onCommit2) {
      onCommit2(idx, { ...models[idx], reasoning, id: models[idx].id || models[idx].modelId });
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}
