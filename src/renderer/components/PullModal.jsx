import { h } from "preact";
import { useState, useMemo, useCallback } from "preact/hooks";
import { ModelItem } from "./ModelItem.jsx";

export function PullModal({
  models,
  existingSet,
  onConfirm,
  onClose,
}) {
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => {
    const initial = new Set();
    models.forEach((id) => {
      if (!existingSet.has(id)) {
        initial.add(id);
      }
    });
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);

  const filteredModels = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return models;
    return models.filter((id) => id.toLowerCase().includes(kw));
  }, [models, keyword]);

  const newModelsCount = useMemo(() => {
    return models.filter((id) => !existingSet.has(id)).length;
  }, [models, existingSet]);

  const toggleModel = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(models));
  }, [models]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectNewOnly = useCallback(() => {
    const s = new Set();
    models.forEach((id) => {
      if (!existingSet.has(id)) s.add(id);
    });
    setSelectedIds(s);
  }, [models, existingSet]);

  const handleConfirm = async () => {
    const toAdd = models.filter((id) => selectedIds.has(id));
    if (toAdd.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(toAdd);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="zcode-pull-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div class="zcode-pull-modal">
        <div class="zcode-pull-header">
          <div class="zcode-pull-title">
            <svg
              class="zcode-pull-bolt-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            <span>同步模型 (共 {models.length} 个，可新增新模型 {newModelsCount} 个)</span>
          </div>
          <button
            type="button"
            class="zcode-pull-close"
            id="zcode-modal-close-btn"
            title="关闭"
            onClick={onClose}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="zcode-pull-body">
          <div class="zcode-pull-toolbar">
            <input
              type="text"
              class="zcode-pull-search"
              id="zcode-modal-search"
              placeholder="搜索模型名称..."
              value={keyword}
              onInput={(e) => setKeyword(e.target.value)}
            />
            <div class="zcode-pull-btn-group">
              <button
                type="button"
                class="zcode-pull-mini-btn"
                id="zcode-select-all"
                onClick={selectAll}
              >
                全选
              </button>
              <button
                type="button"
                class="zcode-pull-mini-btn"
                id="zcode-select-none"
                onClick={selectNone}
              >
                清空
              </button>
              <button
                type="button"
                class="zcode-pull-mini-btn"
                id="zcode-select-new"
                onClick={selectNewOnly}
              >
                仅选新模型 ({newModelsCount})
              </button>
            </div>
          </div>

          <div class="zcode-pull-list" id="zcode-modal-list">
            {filteredModels.map((id) => (
              <ModelItem
                key={id}
                id={id}
                exists={existingSet.has(id)}
                selected={selectedIds.has(id)}
                onToggle={() => toggleModel(id)}
              />
            ))}
          </div>

          <div class="zcode-pull-footer">
            <div class="zcode-pull-summary">
              已选择{" "}
              <span class="zcode-pull-num" id="zcode-selected-num">
                {selectedIds.size}
              </span>{" "}
              / {models.length} 个模型
            </div>
            <div class="zcode-pull-footer-btns">
              <button
                type="button"
                class="zcode-pull-btn-secondary"
                id="zcode-modal-cancel"
                onClick={onClose}
              >
                取消
              </button>
              <button
                type="button"
                class="zcode-pull-btn-primary"
                id="zcode-modal-confirm"
                disabled={selectedIds.size === 0 || submitting}
                onClick={handleConfirm}
              >
                <span>
                  {submitting ? "正在添加..." : `确认添加 (${selectedIds.size})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
