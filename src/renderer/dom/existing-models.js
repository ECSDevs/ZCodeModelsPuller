/**
 * 精准识别当前供应商已存在的模型列表（严格按供应商隔离）
 */

import { readZCodeConfig } from "../core/ipc.js";
import { getFiber } from "../core/fiber.js";

/**
 * 提取当前处于激活状态的供应商 ID
 */
export function getCurrentProviderId() {
  const addBtn =
    document.querySelector('[data-testid="model-provider-add-model-button"]') ||
    Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );

  if (addBtn) {
    let f = getFiber(addBtn);
    while (f) {
      if (f.memoizedProps) {
        if (f.memoizedProps.providerId) return f.memoizedProps.providerId;
        if (f.memoizedProps.provider?.providerId) return f.memoizedProps.provider.providerId;
      }
      f = f.return;
    }
  }

  // 从左侧当前选中的导航条目获取 (data-testid="model-provider-nav-item-custom:<id>")
  const activeNav =
    document.querySelector('[data-testid^="model-provider-nav-item-"][data-state="active"]') ||
    document.querySelector('[data-testid^="model-provider-nav-item-"][aria-selected="true"]') ||
    document.querySelector('[data-testid^="model-provider-nav-item-"].bg-surface-hover');
  if (activeNav) {
    const testid = activeNav.getAttribute("data-testid") || "";
    const m = testid.match(/model-provider-nav-item-(?:custom:)?(.+)$/);
    if (m && m[1]) return m[1];
  }

  return null;
}

/**
 * 获取当前供应商下已存在的模型集合，绝不混淆其他同 Base URL 供应商的模型
 */
export async function getExistingModels(baseUrl, targetProviderId = null) {
  const existing = new Set();
  const providerId = targetProviderId || getCurrentProviderId();

  const addBtn =
    document.querySelector('[data-testid="model-provider-add-model-button"]') ||
    Array.from(document.querySelectorAll("button")).find(
      (b) => /添加模型|add model/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );

  // 1. 最精确（第一优先级）：从当前供应商卡片 / 添加模型按钮的 React Fiber memoizedProps.models 提取
  if (addBtn) {
    let f = getFiber(addBtn);
    while (f) {
      if (f.memoizedProps && Array.isArray(f.memoizedProps.models)) {
        for (const m of f.memoizedProps.models) {
          const mid = m && (m.modelId || m.id);
          if (mid && typeof mid === "string") existing.add(mid.trim());
        }
        console.log(`[ZCode-Model-Puller] 从 Fiber 成功提取当前供应商 (${providerId || "active"}) 的已存在模型 (${existing.size} 个):`, Array.from(existing));
        return existing; // 权威现场数据，严禁被其他供应商覆盖或混淆！
      }
      f = f.return;
    }
  }

  // 2. 第二优先级：限定在当前供应商详情面板的 DOM 作用域内扫描（禁止跨卡片或全局扫描）
  const container = addBtn ? (addBtn.closest("[data-model-provider-detail-scroll]") || addBtn.closest(".divide-y")?.parentElement || addBtn.parentElement?.parentElement) : null;
  if (container) {
    container.querySelectorAll("[data-model-provider-model-id]").forEach((el) => {
      const mid = el.getAttribute("data-model-provider-model-id");
      if (mid) existing.add(mid.trim());
    });
    if (existing.size > 0) {
      console.log(`[ZCode-Model-Puller] 从当前面板 DOM 提取当前供应商 (${providerId || "active"}) 的已存在模型 (${existing.size} 个):`, Array.from(existing));
      return existing;
    }
  }

  // 3. 第三优先级：从配置文件中仅按当前 providerId 精准匹配提取，严禁仅凭 baseUrl 跨供应商合并！
  try {
    const cfg = await readZCodeConfig();
    if (providerId) {
      // 3.1 v2 providerConfigRules
      if (cfg?.config?.providerConfigRules?.providerRules) {
        for (const rule of cfg.config.providerConfigRules.providerRules) {
          if (rule.providerId === providerId || rule.id === providerId) {
            (rule.config?.personalModelIds || []).forEach((m) => existing.add(m.trim()));
            console.log(`[ZCode-Model-Puller] 从 providerRules[${providerId}] 提取模型 (${existing.size} 个):`, Array.from(existing));
            return existing;
          }
        }
      }
      // 3.2 旧版 config.json provider 字典
      if (cfg?.provider && cfg.provider[providerId]) {
        const pdata = cfg.provider[providerId];
        if (pdata.models) {
          Object.keys(pdata.models).forEach((m) => existing.add(m.trim()));
          console.log(`[ZCode-Model-Puller] 从 provider[${providerId}] 提取模型 (${existing.size} 个):`, Array.from(existing));
          return existing;
        }
      }
    }
  } catch (e) {
    console.warn("[ZCode-Model-Puller] 读取配置辅助识别出错:", e);
  }

  console.log(`[ZCode-Model-Puller] 最终识别当前供应商 (${providerId || "未知"}) 已存在模型:`, Array.from(existing));
  return existing;
}
