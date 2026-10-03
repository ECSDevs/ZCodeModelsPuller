/**
 * 自动拉取模型选择弹窗控制器
 * 界面采用现代 Preact JSX 声明式组件构建
 */

import { h, render } from "preact";
import { PullModal } from "../components/PullModal.jsx";
import { getExistingModels } from "../dom/existing-models.js";
import { getZCodeApi } from "../core/ipc.js";
import { showToast } from "../core/toast.js";
import { triggerZCodeUIRefresh } from "../dom/refresh.js";
import { addModelsToOfficialForm, addModelsViaModal } from "../dom/form-injection.js";

export { triggerZCodeUIRefresh };

let modalContainer = null;

export async function openModelSelectModal(models, baseUrl, apiKey) {
  const existingModels = await getExistingModels(baseUrl);
  const existingSet = new Set(existingModels);

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

  const handleConfirm = async (toAdd) => {
    try {
      window.__zcodePendingEnrich = { baseUrl, modelIds: toAdd };
      window.__zcodePendingSync = null;

      window.__zcodeMeta = {};
      try {
        const gz = getZCodeApi();
        if (gz && gz.getModelMetadata) {
          const mr = await gz.getModelMetadata({ modelIds: toAdd });
          if (mr && mr.meta) {
            window.__zcodeMeta = mr.meta;
          }
          if (mr && mr.missingEfforts && mr.missingEfforts.length > 0) {
            console.warn("[ZCode-Model-Puller] 部分模型未收录 OMP efforts 思考档位:", mr.missingEfforts);
          }
        }
      } catch (e0) {
        console.error("[ZCode-Model-Puller] 查询元数据异常:", e0);
      }

      closeModal();
      showToast(`正在同步 ${toAdd.length} 个模型…`);
      const res = await addModelsToOfficialForm(toAdd);
      if (!res.ok) {
        showToast(`降级模式：逐个弹出官方「添加模型」弹窗（${res.reason || "未知原因"}）…`);
        await addModelsViaModal(toAdd);
      }

      const addedCount = res.added || 0;
      const overwrittenCount = res.overwritten || 0;
      let toastMsg = "";
      if (addedCount > 0 && overwrittenCount > 0) {
        toastMsg = `已成功添加 ${addedCount} 个新模型，并覆盖更新 ${overwrittenCount} 个现有模型！`;
      } else if (overwrittenCount > 0) {
        toastMsg = `已成功覆盖更新 ${overwrittenCount} 个现有模型！`;
      } else if (addedCount > 0) {
        toastMsg = `已成功添加 ${addedCount} 个新模型！`;
      } else {
        toastMsg = "模型同步完成！";
      }
      showToast(toastMsg);
      setTimeout(() => {
        triggerZCodeUIRefresh();
      }, 120);
    } catch (err) {
      console.error("[ZCode-Model-Puller] 保存失败:", err);
      showToast(`保存出错: ${err.message}`);
    }
  };

  render(
    <PullModal
      models={models}
      existingSet={existingSet}
      onClose={closeModal}
      onConfirm={handleConfirm}
    />,
    modalContainer
  );
}
