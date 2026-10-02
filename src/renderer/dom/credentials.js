/**
 * 获取表单凭据与当前供应商信息
 */

export function getCurrentProviderName() {
  const nameInputs = document.querySelectorAll("input[value]");
  for (const inp of nameInputs) {
    const val = inp.value.trim();
    if (val && !val.startsWith("http") && !val.startsWith("sk-") && !val.includes("/")) {
      return val;
    }
  }
  return "";
}

export function getFormCredentials() {
  let baseUrl = "";
  let apiKey = "";

  // 1. 优先按官方权威 data-testid 查找
  const baseUrlInput = document.querySelector('input[data-testid="model-provider-base-url-input"]');
  if (baseUrlInput && baseUrlInput.value.trim()) {
    baseUrl = baseUrlInput.value.trim();
  }

  const apiKeyInput = document.querySelector('input[data-testid="model-provider-api-key-input"]');
  if (apiKeyInput && apiKeyInput.value.trim()) {
    apiKey = apiKeyInput.value.trim();
  }

  // 2. 启发式回退扫描（兼顾旧版本混淆属性与不同视图形态）
  const inputs = Array.from(document.querySelectorAll("input"));
  for (const input of inputs) {
    const val = input.value.trim();
    const placeholder = (input.placeholder || "").toLowerCase();
    const testid = input.getAttribute("data-testid") || "";

    if (
      !apiKey &&
      (input.type === "password" ||
        testid.includes("Pne") ||
        placeholder.includes("key") ||
        placeholder.includes("sk-"))
    ) {
      if (val) apiKey = val;
    }

    if (
      !baseUrl &&
      input.type === "text" &&
      (placeholder.includes("http") ||
        placeholder.includes("v1") ||
        placeholder.includes("api") ||
        val.startsWith("http"))
    ) {
      if (val) baseUrl = val;
    }
  }

  return { baseUrl, apiKey };
}
