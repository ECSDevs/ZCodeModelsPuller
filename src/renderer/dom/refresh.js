/**
 * 官方界面与模型列表刷新触发器
 */

import { getCurrentProviderName } from "./credentials.js";

export function triggerZCodeUIRefresh() {
  console.log("[ZCode-Model-Puller] 触发原生自动刷新...");

  let refreshClicked = false;
  const descParagraph = Array.from(document.querySelectorAll("p")).find(
    (p) => p.textContent.includes("添加自定义模型供应商") || p.textContent.includes("配置后可在聊天时选择使用")
  );
  if (descParagraph && descParagraph.parentElement) {
    const btn = descParagraph.parentElement.querySelector("button");
    if (btn) {
      console.log("[ZCode-Model-Puller] 点击官方顶栏刷新按钮");
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
