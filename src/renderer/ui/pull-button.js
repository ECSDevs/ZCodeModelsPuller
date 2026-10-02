/**
 * 注入「⚡️ 自动拉取模型」触发按钮组件
 */

import { getFormCredentials } from "../dom/credentials.js";
import { getZCodeApi } from "../core/ipc.js";
import { showToast } from "../core/toast.js";
import { openModelSelectModal } from "./pull-modal.js";

export function checkAndInject() {
  let addModelBtn =
    document.querySelector('[data-testid="model-provider-add-model-button"]') ||
    document.querySelector('[data-testid="Goe"]');
  if (!addModelBtn) {
    const btns = Array.from(document.querySelectorAll("button"));
    addModelBtn = btns.find(
      (b) => b.textContent.includes("添加模型") && b.getAttribute("id") !== "zcode-auto-pull-models-btn"
    );
  }

  if (!addModelBtn) return;

  const parent = addModelBtn.parentElement;
  if (!parent || parent.querySelector("#zcode-auto-pull-models-btn")) return;

  parent.style.display = "flex";
  parent.style.flexWrap = "wrap";
  parent.style.alignItems = "center";
  parent.style.gap = "8px";

  const pullBtn = document.createElement("button");
  pullBtn.id = "zcode-auto-pull-models-btn";
  pullBtn.type = "button";
  pullBtn.setAttribute("title", "根据当前 Base URL 和 API Key 自动拉取所有可用模型");

  pullBtn.innerHTML = `
    <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    <span>拉取模型</span>
  `;

  pullBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const { baseUrl, apiKey } = getFormCredentials();
    console.log("[ZCode-Model-Puller] 点击拉取，凭据:", { baseUrl, hasKey: !!apiKey });

    if (!baseUrl) {
      showToast("⚠️ 请先在上方填写 Base URL");
      return;
    }

    pullBtn.classList.add("loading");
    pullBtn.innerHTML = `
      <svg class="zcode-spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
      </svg>
      <span>正在拉取模型...</span>
    `;

    try {
      let result = null;
      const api = getZCodeApi();
      if (api?.fetchModelsFromUrl) {
        result = await api.fetchModelsFromUrl(baseUrl, apiKey);
      } else {
        try {
          const cleanUrl = baseUrl.replace(/\/+$/, "");
          const candidates = [
            cleanUrl.endsWith("/v1") ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`,
            `${cleanUrl}/models`,
          ];
          if (cleanUrl.endsWith("/api")) candidates.unshift(`${cleanUrl}/v1/models`);

          for (const u of candidates) {
            try {
              const headers = { Accept: "application/json" };
              if (apiKey) {
                headers["Authorization"] = `Bearer ${apiKey}`;
                headers["x-api-key"] = apiKey;
              }
              const res = await fetch(u, { headers });
              if (res.ok) {
                const data = await res.json();
                const list = (data.data || data.models || data).map((m) =>
                  typeof m === "string" ? m : m.id || m.name
                );
                result = { success: true, models: list.filter(Boolean) };
                break;
              }
            } catch (e) {}
          }
        } catch (fetchErr) {
          result = { success: false, error: fetchErr.message };
        }
      }

      if (result?.success && result.models?.length > 0) {
        await openModelSelectModal(result.models, baseUrl, apiKey);
      } else {
        showToast(result?.error ? `拉取失败: ${result.error}` : "未获取到模型，请检查 Base URL 和 API Key");
      }
    } catch (err) {
      showToast(`请求异常: ${err.message}`);
    } finally {
      pullBtn.classList.remove("loading");
      pullBtn.innerHTML = `
        <svg class="zcode-pull-bolt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
        <span>拉取模型</span>
      `;
    }
  };

  addModelBtn.after(pullBtn);
}
