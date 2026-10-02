/**
 * 精准识别外部已存在的模型列表
 */

import { readZCodeConfig } from "../core/ipc.js";
import { getFiber } from "../core/fiber.js";

export async function getExistingModels(baseUrl) {
  const existing = new Set();

  // 1. 新版：从「添加模型」按钮的 React Fiber memoizedProps.models 提取
  try {
    const addBtn =
      document.querySelector('[data-testid="model-provider-add-model-button"]') ||
      Array.from(document.querySelectorAll("button")).find(
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
  } catch (e) {}

  // 2. 新版：扫描 DOM 属性 [data-model-provider-model-id]
  try {
    document.querySelectorAll("[data-model-provider-model-id]").forEach((el) => {
      const mid = el.getAttribute("data-model-provider-model-id");
      if (mid) existing.add(mid.trim());
    });
  } catch (e) {}

  // 3. 扫描页面输入框中的模型 ID（兼容老版视图）
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

  // 4. 结合 config.json / provider_config.json 辅助校验
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
    console.warn("[ZCode-Model-Puller] 读取配置辅助识别出错:", e);
  }

  console.log("[ZCode-Model-Puller] 外部已展示模型列表:", Array.from(existing));
  return existing;
}
