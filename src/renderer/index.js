/**
 * ZCode 自定义模型供应商 - 自动拉取模型列表插件 (开源旗舰版)
 *
 * 模块化总入口：挂载样式、初始化 DOM 监听及官方保存 hook
 */

import { STORAGE_KEYS } from "./core/constants.js";
import { injectStyles } from "./styles/theme.js";
import { hookOfficialSave } from "./sync/save-hook.js";
import { checkAndInject } from "./ui/pull-button.js";
import { injectEditorRange } from "./ui/editor-efforts.js";

(() => {
  if (window[STORAGE_KEYS.LOADED_FLAG]) return;
  window[STORAGE_KEYS.LOADED_FLAG] = true;

  console.log("[ZCode-Model-Puller] 开源旗舰版插件已装载");

  // 1. 注入现代质感样式系统
  injectStyles();

  // 2. 挂载官方保存事件劫持
  hookOfficialSave();

  // 3. 初始注入检查
  checkAndInject();
  injectEditorRange();

  // 4. 监听 DOM 树变化，响应页面路由切换与弹窗弹出
  const observer = new MutationObserver(() => {
    checkAndInject();
    injectEditorRange();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
