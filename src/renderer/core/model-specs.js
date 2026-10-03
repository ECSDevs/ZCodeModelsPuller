/**
 * 官方模型参数生成规则库
 * 覆盖：max output tokens, modalities (inputFormat), abilities, reasoning efforts & map
 */

import reasoningAnthropicCel from "./cel/reasoning-anthropic.cel";
import reasoningOpenaiChatCel from "./cel/reasoning-openai-chat.cel";
import reasoningOpenaiResponsesCel from "./cel/reasoning-openai-responses.cel";
import maxTokensAnthropicCel from "./cel/max-tokens-anthropic.cel";
import maxTokensOpenaiChatCel from "./cel/max-tokens-openai-chat.cel";
import maxTokensOpenaiResponsesCel from "./cel/max-tokens-openai-responses.cel";

import {
  resolveAbilities,
  resolveContextWindow,
  resolveInputFormat,
  resolveMaxOutputTokens,
} from "./default-specs.js";

export function resolveMaxOutputMap(apiFormat) {
  if (apiFormat === "anthropic-messages") {
    return maxTokensAnthropicCel.trim();
  }
  if (apiFormat === "openai-chat-completions") {
    return maxTokensOpenaiChatCel.trim();
  }
  return maxTokensOpenaiResponsesCel.trim();
}

export function resolveReasoningSpec(modelId, meta = {}, apiFormat = "openai-responses") {
  const me = meta || {};

  let map = "";
  if (apiFormat === "anthropic-messages") {
    map = reasoningAnthropicCel.trim();
  } else if (apiFormat === "openai-chat-completions") {
    map = reasoningOpenaiChatCel.trim();
  } else {
    map = reasoningOpenaiResponsesCel.trim();
  }

  // 取消内置家族表：思考档位必须严格来自 OMP efforts (me.r) 或明确标记 reasoning
  const hasEfforts = Array.isArray(me.r) && me.r.length > 0;
  if (!hasEfforts && !me.reasoning) {
    // 官方规范：即使模型未开启/未收录思考档位，仍需保留 values: ["disabled"] 满足 Zod 强校验
    return { values: ["disabled"], map };
  }

  let levels = [];
  if (hasEfforts) {
    levels = me.r.filter((v) => v !== "disabled");
  }

  // 官方规范：values 首位必须为 disabled
  const values = ["disabled", ...levels];

  return { values, map };
}

export function buildOfficialModelConfig(modelId, meta = {}, apiFormat = "openai-responses") {
  const id = (modelId || "").trim();
  const me = meta || {};

  const contextWindow = resolveContextWindow(id, me);
  const maxOut = resolveMaxOutputTokens(id, me);
  const rawInputFormat = resolveInputFormat(id, me);
  const abilities = resolveAbilities(id, me, apiFormat);
  const reasoningSpec = resolveReasoningSpec(id, me, apiFormat);

  // 严格对齐 ZCode Zod Schema for personalConfig:
  // inputFormat 仅允许 supportsImage, supportsVideo, supportsPdf（禁止 supportsText / supportsAudio）
  const cleanInputFormat = {
    supportsImage: !!rawInputFormat.supportsImage,
    supportsVideo: !!rawInputFormat.supportsVideo,
    supportsPdf: !!rawInputFormat.supportsPdf,
  };

  // properties 仅允许 contextWindow, inputFormat, supportsJsonSchemaOutput, supportsNativeWebSearch, supportsMidConversationSystem
  const properties = {
    contextWindow,
    inputFormat: cleanInputFormat,
    supportsJsonSchemaOutput: !!abilities.supportsJsonSchemaOutput,
    supportsNativeWebSearch: !!abilities.supportsNativeWebSearch,
    supportsMidConversationSystem: !!abilities.supportsMidConversationSystem,
  };

  // optionSpecs: maxOutputTokens 仅包含 max（map 仅用于官方内置映射）；reasoningLevel 包含 values 与 map
  const optionSpecs = {
    maxOutputTokens: {
      max: maxOut,
    },
  };

  if (reasoningSpec) {
    optionSpecs.reasoningLevel = reasoningSpec;
  }

  return {
    properties,
    optionSpecs,
  };
}

export function buildOfficialDraftPatch(modelId, meta = {}, apiFormat = "openai-responses") {
  const cfg = buildOfficialModelConfig(modelId, meta, apiFormat);
  const patch = {};
  const overridden = [];

  if (cfg.properties?.contextWindow) {
    patch.contextWindowValue = String(cfg.properties.contextWindow);
  }
  if (cfg.optionSpecs?.maxOutputTokens?.max) {
    patch.maxOutputTokensValue = String(cfg.optionSpecs.maxOutputTokens.max);
  }
  if (cfg.properties?.inputFormat) {
    patch.inputFormatValue = { ...cfg.properties.inputFormat };
    for (const k of ["supportsImage", "supportsVideo", "supportsPdf"]) {
      if (cfg.properties.inputFormat[k] !== undefined) {
        overridden.push(`inputFormatValue.${k}`);
      }
    }
  }
  if (cfg.properties?.supportsJsonSchemaOutput !== undefined) {
    patch.supportsJsonSchemaOutputValue = cfg.properties.supportsJsonSchemaOutput;
    overridden.push("supportsJsonSchemaOutputValue");
  }
  if (cfg.properties?.supportsNativeWebSearch !== undefined) {
    patch.supportsNativeWebSearchValue = cfg.properties.supportsNativeWebSearch;
    overridden.push("supportsNativeWebSearchValue");
  }
  if (cfg.properties?.supportsMidConversationSystem !== undefined) {
    patch.supportsMidConversationSystemValue = cfg.properties.supportsMidConversationSystem;
    overridden.push("supportsMidConversationSystemValue");
  }
  if (cfg.optionSpecs?.reasoningLevel) {
    patch.reasoningLevelValuesValue = [...cfg.optionSpecs.reasoningLevel.values];
    patch.reasoningLevelMapValue = cfg.optionSpecs.reasoningLevel.map;
    overridden.push("reasoningLevelValuesValue");
  }

  patch.overriddenFieldsValue = overridden;

  return patch;
}
