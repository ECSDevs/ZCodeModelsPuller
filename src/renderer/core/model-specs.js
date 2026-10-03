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

  // 取消内置家族表：思考档位必须严格来自 OMP efforts (me.r) 或明确标记 reasoning
  const hasEfforts = Array.isArray(me.r) && me.r.length > 0;
  if (!hasEfforts && !me.reasoning) {
    return null;
  }

  let levels = [];
  if (hasEfforts) {
    levels = me.r.filter((v) => v !== "disabled");
  }

  // 官方规范：values 首位必须为 disabled
  const values = ["disabled", ...levels];

  let map = "";
  if (apiFormat === "anthropic-messages") {
    map = reasoningAnthropicCel.trim();
  } else if (apiFormat === "openai-chat-completions") {
    map = reasoningOpenaiChatCel.trim();
  } else {
    map = reasoningOpenaiResponsesCel.trim();
  }

  return { values, map };
}

export function buildOfficialModelConfig(modelId, meta = {}, apiFormat = "openai-responses") {
  const id = (modelId || "").trim();
  const me = meta || {};

  const contextWindow = resolveContextWindow(id, me);
  const maxOut = resolveMaxOutputTokens(id, me);
  const maxOutputMap = resolveMaxOutputMap(apiFormat);
  const inputFormat = resolveInputFormat(id, me);
  const abilities = resolveAbilities(id, me, apiFormat);
  const reasoningSpec = resolveReasoningSpec(id, me, apiFormat);

  const properties = {
    requiresMfjsToolSchema: false,
    contextWindow,
    inputFormat,
    outputFormat: {
      supportsText: true,
    },
    supportsToolCall: abilities.supportsToolCall,
    supportsJsonSchemaOutput: abilities.supportsJsonSchemaOutput,
    supportsNativeWebSearch: abilities.supportsNativeWebSearch,
    supportsMidConversationSystem: abilities.supportsMidConversationSystem,
  };

  const optionSpecs = {
    maxOutputTokens: {
      max: maxOut,
      map: maxOutputMap,
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
