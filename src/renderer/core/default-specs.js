/**
 * 模型规格推导规则（上下文、输出 Tokens、模态、基础能力）
 */

export function resolveContextWindow(id, me = {}) {
  if (typeof me.ctx === "number" && me.ctx > 0) {
    return Math.floor(me.ctx);
  }
  if (/gpt-5|gpt-6|sol/i.test(id)) {
    return 272000;
  }
  if (/claude-3/i.test(id)) {
    return 200000;
  }
  if (/gemini/i.test(id)) {
    return 1048576;
  }
  if (/deepseek/i.test(id)) {
    return 65536;
  }
  return 128000;
}

export function resolveMaxOutputTokens(id, me = {}) {
  if (typeof me.out === "number" && me.out > 0) {
    return Math.floor(me.out);
  }
  if (/gpt-5|gpt-6|sol/i.test(id)) {
    return 32000;
  }
  if (/o1|o3|o4/i.test(id)) {
    return 65536;
  }
  if (/claude-3-7/i.test(id)) {
    return 64000;
  }
  if (/claude/i.test(id)) {
    return 8192;
  }
  if (/deepseek/i.test(id)) {
    return 8192;
  }
  if (/gemini-3|gemini-2/i.test(id)) {
    return 65536;
  }
  if (/gemini/i.test(id)) {
    return 8192;
  }
  return 16384;
}

export function resolveInputFormat(id, me = {}) {
  const hasImage = me.in
    ? me.in.includes("image")
    : /gpt-4o|gpt-5|gpt-6|claude-3|gemini|omni|vision|vl|sol/i.test(id);
  const hasVideo = me.in
    ? me.in.includes("video")
    : /gemini/i.test(id);
  const hasAudio = me.in
    ? me.in.includes("audio")
    : /omni|audio|voice/i.test(id);
  const hasPdf = me.in
    ? me.in.includes("pdf")
    : /gpt-4o|gpt-5|gpt-6|claude-3|gemini|sol/i.test(id);

  return {
    supportsText: true,
    supportsImage: Boolean(hasImage),
    supportsVideo: Boolean(hasVideo),
    supportsAudio: Boolean(hasAudio),
    supportsPdf: Boolean(hasPdf),
  };
}

export function resolveAbilities(id, me = {}, apiFormat = "openai-responses") {
  const supportsToolCall = me.tool_call !== undefined ? Boolean(me.tool_call) : true;
  const supportsJsonSchemaOutput = me.structured_output !== undefined
    ? Boolean(me.structured_output)
    : /gpt-4o|gpt-4|gpt-5|gpt-6|claude-3|gemini|deepseek|qwen-2\.5|sol/i.test(id);
  const supportsNativeWebSearch = /sonar|search|online|browsing|web/i.test(id);
  const supportsMidConversationSystem = apiFormat !== "anthropic-messages";

  return {
    supportsToolCall,
    supportsJsonSchemaOutput,
    supportsNativeWebSearch,
    supportsMidConversationSystem,
  };
}
