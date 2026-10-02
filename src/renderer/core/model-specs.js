/**
 * 官方模型参数生成规则库
 * 覆盖：max output tokens, modalities (inputFormat), abilities, reasoning efforts & map
 */

export function resolveMaxOutputMap(apiFormat) {
  if (apiFormat === "anthropic-messages") {
    return "{'max_tokens': maxOutputTokens}";
  }
  if (apiFormat === "openai-chat-completions") {
    return "{'max_completion_tokens': maxOutputTokens}";
  }
  // 默认 openai-responses
  return "{'max_output_tokens': maxOutputTokens}";
}

export function resolveReasoningSpec(modelId, meta = {}, apiFormat = "openai-responses") {
  const id = (modelId || "").toLowerCase();
  const me = meta || {};

  const isReasoning =
    me.reasoning === true ||
    (Array.isArray(me.r) && me.r.length > 0) ||
    /o1|o3|o4|gpt-5|gpt-6|sol|deepseek-r1|deepseek-reasoner|r1|reasoning|thinking|claude-3-7|qwq|gemini-2\.0-flash-thinking|gemini-3/i.test(id);

  if (!isReasoning) {
    return null;
  }

  let levels = [];
  if (Array.isArray(me.r) && me.r.length > 0) {
    levels = me.r.filter((v) => v !== "disabled");
    if (/gpt-5|gpt-6|sol/i.test(id)) {
      for (const extra of ["xhigh", "max"]) {
        if (!levels.includes(extra)) levels.push(extra);
      }
    }
  } else if (/gpt-5|gpt-6|sol|claude-3-7/i.test(id)) {
    levels = ["low", "medium", "high", "xhigh", "max"];
  } else if (/deepseek|r1|kimi|glm/i.test(id)) {
    levels = ["low", "medium", "high", "max"];
  } else if (/gemini/i.test(id)) {
    levels = ["low", "high"];
  } else {
    levels = ["low", "medium", "high"];
  }

  // 官方规范：values 首位必须为 disabled
  const values = ["disabled", ...levels];

  let map = "";
  if (apiFormat === "anthropic-messages") {
    map = `reasoningLevel == "disabled"\n  ? {\n      "thinking": {\n        "type": "disabled"\n      }\n    }\n  : {\n      "thinking": {\n        "type": "adaptive"\n      },\n      "output_config": {\n        "effort": reasoningLevel == "enabled" ? "high" : reasoningLevel\n      }\n    }`;
  } else if (apiFormat === "openai-chat-completions") {
    map = `{\n  "thinking": {\n    "type": reasoningLevel == "disabled" || reasoningLevel == "none" ? "disabled" : "enabled"\n  },\n  "enable_thinking": reasoningLevel != "disabled" && reasoningLevel != "none",\n  "reasoning_effort": reasoningLevel == "disabled" ? "none" : reasoningLevel == "enabled" ? "high" : reasoningLevel,\n  "reasoning": {\n    "effort": reasoningLevel == "disabled" ? "none" : reasoningLevel == "enabled" ? "high" : reasoningLevel\n  }\n}`;
  } else {
    // openai-responses
    map = `{\n  "reasoning": {\n    "effort": reasoningLevel == "disabled" ? "none" : reasoningLevel == "enabled" ? "high" : reasoningLevel\n  }\n}`;
  }

  return { values, map };
}

export function buildOfficialModelConfig(modelId, meta = {}, apiFormat = "openai-responses") {
  const id = (modelId || "").trim();
  const me = meta || {};

  // 1. 上下文窗口
  let contextWindow = 128000;
  if (typeof me.ctx === "number" && me.ctx > 0) {
    contextWindow = Math.floor(me.ctx);
  } else if (/gpt-5|gpt-6|sol/i.test(id)) {
    contextWindow = 272000;
  } else if (/claude-3/i.test(id)) {
    contextWindow = 200000;
  } else if (/gemini/i.test(id)) {
    contextWindow = 1000000;
  } else if (/deepseek/i.test(id)) {
    contextWindow = 65536;
  }

  // 2. 最大输出 Token
  let maxOut = 16384;
  if (typeof me.out === "number" && me.out > 0) {
    maxOut = Math.floor(me.out);
  } else if (/gpt-5|gpt-6|sol/i.test(id)) {
    maxOut = 32000;
  } else if (/o1|o3|o4/i.test(id)) {
    maxOut = 65536;
  } else if (/claude-3-7/i.test(id)) {
    maxOut = 64000;
  } else if (/claude/i.test(id)) {
    maxOut = 8192;
  } else if (/deepseek/i.test(id)) {
    maxOut = 8192;
  } else if (/gemini/i.test(id)) {
    maxOut = 8192;
  }

  const maxOutputMap = resolveMaxOutputMap(apiFormat);

  // 3. 输入类型 (modalities)
  const hasImage = me.in
    ? me.in.includes("image")
    : /gpt-4o|gpt-5|gpt-6|claude-3|gemini|omni|vision|vl|sol/i.test(id);
  const hasVideo = me.in
    ? me.in.includes("video")
    : /gemini-1\.5|gemini-2|gemini-3/i.test(id);
  const hasAudio = me.in
    ? me.in.includes("audio")
    : /omni|audio|voice/i.test(id);
  const hasPdf = me.in
    ? me.in.includes("pdf")
    : /gpt-4o|gpt-5|gpt-6|claude-3|gemini|sol/i.test(id);

  const inputFormat = {
    supportsText: true,
    supportsImage: Boolean(hasImage),
    supportsVideo: Boolean(hasVideo),
    supportsAudio: Boolean(hasAudio),
    supportsPdf: Boolean(hasPdf),
  };

  // 4. 模型能力 (abilities)
  const supportsToolCall = me.tool_call !== undefined ? Boolean(me.tool_call) : true;
  const supportsJsonSchemaOutput = me.structured_output !== undefined
    ? Boolean(me.structured_output)
    : /gpt-4o|gpt-4|gpt-5|gpt-6|claude-3|gemini|deepseek|qwen-2\.5|sol/i.test(id);
  const supportsNativeWebSearch = /sonar|search|online|browsing|web/i.test(id);
  const supportsMidConversationSystem = apiFormat !== "anthropic-messages";

  // 5. 推理等级与映射 (reasoningLevel)
  const reasoningSpec = resolveReasoningSpec(id, me, apiFormat);

  const properties = {
    requiresMfjsToolSchema: false,
    contextWindow,
    inputFormat,
    outputFormat: {
      supportsText: true,
    },
    supportsToolCall,
    supportsJsonSchemaOutput,
    supportsNativeWebSearch,
    supportsMidConversationSystem,
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

  if (cfg.properties?.contextWindow) {
    patch.contextWindowValue = String(cfg.properties.contextWindow);
  }
  if (cfg.optionSpecs?.maxOutputTokens?.max) {
    patch.maxOutputTokensValue = String(cfg.optionSpecs.maxOutputTokens.max);
  }
  if (cfg.properties?.inputFormat) {
    patch.inputFormatValue = { ...cfg.properties.inputFormat };
  }
  if (cfg.properties?.supportsJsonSchemaOutput !== undefined) {
    patch.supportsJsonSchemaOutputValue = cfg.properties.supportsJsonSchemaOutput;
  }
  if (cfg.properties?.supportsNativeWebSearch !== undefined) {
    patch.supportsNativeWebSearchValue = cfg.properties.supportsNativeWebSearch;
  }
  if (cfg.properties?.supportsMidConversationSystem !== undefined) {
    patch.supportsMidConversationSystemValue = cfg.properties.supportsMidConversationSystem;
  }
  if (cfg.optionSpecs?.reasoningLevel) {
    patch.reasoningLevelValuesValue = [...cfg.optionSpecs.reasoningLevel.values];
    patch.reasoningLevelMapValue = cfg.optionSpecs.reasoningLevel.map;
  }

  return patch;
}
