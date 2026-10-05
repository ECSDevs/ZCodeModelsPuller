/**
 * 自动拉取模型选择弹窗控制器
 * 界面采用现代 Preact JSX 声明式组件构建
 */

import { h, render } from "preact";
import { PullModal } from "../components/PullModal.jsx";
import { getExistingModels, getCurrentProviderId } from "../dom/existing-models.js";
import { getZCodeApi } from "../core/ipc.js";
import { showToast } from "../core/toast.js";
import { triggerZCodeUIRefresh } from "../dom/refresh.js";
import {
  syncModelsToOfficialConfig,
  addModelsToOfficialForm,
  addModelsViaModal,
} from "../dom/form-injection.js";

export { triggerZCodeUIRefresh };

let modalContainer = null;

export async function openModelSelectModal(remoteModelIds, baseUrl, apiKey, providerId = null) {
  const currentProviderId = providerId || getCurrentProviderId();
  const existingModels = await getExistingModels(baseUrl, currentProviderId);

  const items = [];
  const remoteSet = new Set(remoteModelIds || []);

  // 1. 远端 probe 返回的模型（增量 或 重复覆盖）
  for (const id of (remoteModelIds || [])) {
    items.push({
      id,
      kind: existingModels.has(id) ? "overwrite" : "new",
    });
  }

  // 2. 当前供应商已配置但远端 probe 不存在的模型（减量）
  for (const id of existingModels) {
    if (!remoteSet.has(id)) {
      items.push({
        id,
        kind: "delete",
      });
    }
  }

  if (modalContainer) {
    render(null, modalContainer);
    modalContainer.remove();
  }

  modalContainer = document.createElement("div");
  modalContainer.id = "zcode-pull-modal-root";
  document.body.appendChild(modalContainer);

  const closeModal = () => {
    if (modalContainer) {
      render(null, modalContainer);
      modalContainer.remove();
      modalContainer = null;
    }
  };

  const handleConfirm = async ({ toAdd = [], toOverwrite = [], toDelete = [] }) => {
    try {
      const totalOps = toAdd.length + toOverwrite.length + toDelete.length;
      if (totalOps === 0) return;

      closeModal();
      showToast(`正在执行 ${totalOps} 项模型同步变更…`);

      // 预先查询需要新增与覆盖更新的模型元数据
      const toEnrich = [...toAdd, ...toOverwrite];
      if (toEnrich.length > 0) {
        window.__zcodePendingEnrich = { baseUrl, modelIds: toEnrich };
        window.__zcodePendingSync = null;
        try {
          const gz = getZCodeApi();
          if (gz && gz.getModelMetadata) {
            const mr = await gz.getModelMetadata({ modelIds: toEnrich });
            if (mr && mr.meta) {
              window.__zcodeMeta = { ...(window.__zcodeMeta || {}), ...mr.meta };
            }
          }
        } catch (e0) {
          console.error("[ZCode-Model-Puller] 查询元数据异常:", e0);
        }
      }

      // 执行同步：优先直写配置文件极速生效，跳过慢速逐个操作
      const res = await syncModelsToOfficialConfig({
        toAdd,
        toOverwrite,
        toDelete,
        currentProviderId,
        baseUrl,
      });

      let parts = [];
      if (res.added > 0) parts.push(`新增 ${res.added} 个`);
      if (res.overwritten > 0) parts.push(`覆盖 ${res.overwritten} 个`);
      if (res.deleted > 0) parts.push(`移除 ${res.deleted} 个`);

      const toastMsg = parts.length > 0
        ? `模型同步成功（${parts.join("，")}）！`
        : "模型同步完成！";
      showToast(toastMsg);
    } catch (err) {
      console.error("[ZCode-Model-Puller] 保存失败:", err);
      showToast(`保存出错: ${err.message}`);
    }
  };

  render(
    <PullModal
      items={items}
      onClose={closeModal}
      onConfirm={handleConfirm}
    />,
    modalContainer
  );
}
