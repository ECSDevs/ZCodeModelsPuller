/**
 * 全局常量与状态键定义
 */

export const EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"];

export const FORMATS = ["anthropic-messages", "openai-chat-completions", "openai-responses"];

export const FORMAT_TO_KIND = {
  "anthropic-messages": "anthropic",
  "openai-chat-completions": "openai-compatible",
  "openai-responses": "openai",
};

export const STORAGE_KEYS = {
  LOADED_FLAG: "__ZCODE_MODEL_PULLER_LOADED_PRO__",
  EFFORTS_TOAST_SHOWN: "__zcodeEffortsToastShown",
  LAST_EFFORTS: "__zcodeLastEfforts",
  PENDING_ENRICH: "__zcodePendingEnrich",
  PENDING_SYNC: "__zcodePendingSync",
  META: "__zcodeMeta",
  CHAT_REFRESHED_FOR: "__chatRefreshedFor",
};
