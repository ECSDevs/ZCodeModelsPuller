/**
 * 补全模型元数据逻辑
 */

import { getZCodeApi } from "../core/ipc.js";
import { showToast } from "../core/toast.js";

export async function enrichPending(p, attempts = 0) {
  try {
    const api = getZCodeApi();
    if (!api || !api.enrichModelsWithMetadata) return;
    const res = await api.enrichModelsWithMetadata({
      baseUrl: p.baseUrl,
      modelIds: p.modelIds,
    });
    if (res && res.success && (res.touched > 0 || attempts >= 5)) {
      showToast(`已填充 ${res.touched || 0} 个模型元数据`);
      return;
    }
    // 官方保存是异步写盘，未命中/未写完时按递增间隔重试
    if (attempts < 5) {
      const delay = Math.min(400 + attempts * 700, 3500);
      setTimeout(() => enrichPending(p, attempts + 1), delay);
    }
  } catch (e) {}
}
