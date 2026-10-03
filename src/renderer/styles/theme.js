/**
 * 完整样式注入
 * 样式源码已分离至 theme.css，享受完整的 CSS 语法高亮与格式化支持
 */

import stylesCss from "./theme.css";

export function injectStyles() {
  if (document.getElementById("zcode-model-puller-style-pro")) return;

  const style = document.createElement("style");
  style.id = "zcode-model-puller-style-pro";
  style.textContent = stylesCss;
  document.head.appendChild(style);
}
