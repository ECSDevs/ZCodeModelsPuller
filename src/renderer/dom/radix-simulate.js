/**
 * Radix 菜单真实鼠标事件模拟与聊天侧思考档位重选
 * 解决 Radix 下拉事件忽略非真实合成事件及同模型不触发 onChange 的问题
 */

import { realClick } from "../core/ipc.js";
import { centerOf, waitTrue } from "../core/dom-utils.js";
import { findCallbackUp } from "../core/fiber.js";

let __chatRefreshTimer = null;

export function sameLevelSet(a, b) {
  if (!a || !b) return false;
  const sa = String(a).split(",").map((s) => s.trim()).filter(Boolean);
  const sb = String(b).split(",").map((s) => s.trim()).filter(Boolean);
  if (sa.length !== sb.length) return false;
  return sa.every((v) => sb.includes(v));
}

// 聊天侧模型选择 trigger 是否真正可见（且不在设置页）
export function isChatTriggerVisible() {
  try {
    const t = document.querySelector('[data-testid="chat-model-select-trigger"]');
    if (!t) return false;
    const r = t.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (t.offsetParent === null) return false;
    // 用「点击坐标是否命中 trigger」判断真实可见
    const cx = Math.round(r.x + r.width / 2);
    const cy = Math.round(r.y + r.height / 2);
    const top = document.elementFromPoint(cx, cy);
    if (!top) return false;
    return top === t || t.contains(top);
  } catch (e) {
    return false;
  }
}

// 打开模型浮层 → 展开当前供应商分组 → 点选指定模型项
export async function openMenuAndPickAsync(modelId, providerId) {
  try {
    // 1) 确保 trigger 可见（不在设置页）
    const vis = await waitTrue(() => isChatTriggerVisible(), 8000, 200);
    if (!vis) return false;
    const t = document.querySelector('[data-testid="chat-model-select-trigger"]');
    const c = centerOf(t);
    if (!c) return false;
    realClick(c.x, c.y);

    // 2) 等待浮层出现并点击分组
    const groupSel = `[data-testid$="chat-model-select-group-provider:${providerId}"]`;
    const grpOk = await waitTrue(() => {
      const grp = Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]")).find((p) =>
        p.querySelector(groupSel)
      );
      return !!grp;
    }, 3000, 120);
    if (!grpOk) return false;

    const grp = Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]")).find((p) =>
      p.querySelector(groupSel)
    );
    const gc = centerOf(grp.querySelector(groupSel));
    if (!gc) return false;
    realClick(gc.x, gc.y);

    // 3) 等待模型项渲染并点击
    const itemOk = await waitTrue(() => {
      for (const p of Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]"))) {
        if (modelId === "__OTHER__") {
          const items = Array.from(p.querySelectorAll(`[data-testid^="chat-model-select-item-custom:${providerId}:"]`));
          const cur = (document.querySelector('[data-testid="v4-model-config"]') || {}).dataset;
          const curModel = cur && cur.model;
          const hit = items.find((it) => {
            const tid = (it.dataset && it.dataset.testid) || "";
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
    }, 3000, 120);
    if (!itemOk) return false;

    for (const p of Array.from(document.querySelectorAll("[data-radix-popper-content-wrapper]"))) {
      let hit = null;
      if (modelId === "__OTHER__") {
        const items = Array.from(p.querySelectorAll(`[data-testid^="chat-model-select-item-custom:${providerId}:"]`));
        const cur = (document.querySelector('[data-testid="v4-model-config"]') || {}).dataset;
        const curModel = cur && cur.model;
        hit = items.find((it) => {
          const tid = (it.dataset && it.dataset.testid) || "";
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

// 重选主流程：先切到同组另一个模型 → 再切回目标
export function autoReselectLoop(mid, pid, exp, attempt = 0) {
  try {
    const span = document.querySelector('[data-testid="v4-model-config"]');
    if (!span) return;
    (async () => {
      await openMenuAndPickAsync("__OTHER__", pid); // 切走（强制 onChange）
      await openMenuAndPickAsync(mid, pid);          // 切回（重建快照）
      await new Promise((r) => setTimeout(r, 600));
      const span2 = document.querySelector('[data-testid="v4-model-config"]');
      const now = span2 ? span2.getAttribute("data-thought-levels") : null;
      const done = !exp || (now && sameLevelSet(now, exp));
      if (!done && attempt < 8) {
        setTimeout(() => autoReselectLoop(mid, pid, exp, attempt + 1), 2000);
      }
    })();
  } catch (e) {}
}

export function refreshChatSnapshot(modelId, expectedEmpty) {
  try {
    if (__chatRefreshTimer) return; // 防抖
    const span = document.querySelector('[data-testid="v4-model-config"]');
    if (!span) return;
    const cur = span.dataset || {};
    if (!cur.provider || !cur.model || cur.model !== modelId) return; // 仅当前正在使用的模型
    const expected = Array.isArray(expectedEmpty) ? expectedEmpty.join(",") : expectedEmpty;
    __chatRefreshTimer = setTimeout(() => {
      __chatRefreshTimer = null;
      autoReselectLoop(modelId, cur.provider, expected, 0);
    }, 1200);
  } catch (e) {}
}

// 兜底：旧路径（直接调 pQe onSelectModel，仅当 simulate 通道缺失时使用）
export function pickChatModel(modelId, providerId) {
  try {
    const span = document.querySelector('[data-testid="v4-model-config"]');
    if (!span) return false;
    const cb = findCallbackUp(span, "onSelectModel", 1);
    if (!cb) return false;
    const pid = providerId || span.dataset.provider;
    cb(pid, modelId);
    return true;
  } catch (e) {}
  return false;
}
