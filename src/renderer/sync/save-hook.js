/**
 * 拦截官方保存按钮点击事件
 */

import { reapEffortsTight } from "./rewrite-loop.js";
import { enrichPending } from "./enrich.js";

export function hookOfficialSave() {
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
        // 官方保存是异步写盘：立即重写 + 读回验证
        reapEffortsTight(window.__zcodeLastEfforts);
      }
    },
    true // 捕获阶段，先于官方处理
  );
}
