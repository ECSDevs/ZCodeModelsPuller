/**
 * 校验式写盘与高频轮询纠回
 * 覆盖官方异步保存写盘窗口，确保 reasoning 档位不被剥掉
 */

import { readZCodeConfig, writeZCodeConfig } from "../core/ipc.js";
import { showToast } from "../core/toast.js";
import { refreshChatSnapshot } from "../dom/radix-simulate.js";

export function effortsMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// 校验式重写：写盘后读回验证 variants 与用户勾选完全一致才认为成功
export async function reapplyEfforts(le) {
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
      // 读回验证：variants 与档位对象（levels）都必须与勾选一致才认为落盘成功
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

// 立即重写 + 轮询纠回：前 6 轮无条件重写（覆盖官方写盘窗口），之后以读回验证一致为停止条件
export function reapEffortsTight(le, round = 0) {
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
      setTimeout(() => showToast("已确保思考档位保存正确"), 300);
    }
    if (keepGoing && round < 18) {
      setTimeout(() => reapEffortsTight(target, round + 1), 500);
    }
  });
}
