import { h } from "preact";
import { useState, useMemo, useCallback } from "preact/hooks";
import { ModelItem } from "./ModelItem.jsx";

export function PullModal({
  items, // array of { id, kind: "new" | "overwrite" | "delete" }
  onConfirm,
  onClose,
}) {
  const [keyword, setKeyword] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // "all" | "new" | "overwrite" | "delete"

  const newItems = useMemo(() => items.filter((it) => it.kind === "new"), [items]);
  const overwriteItems = useMemo(() => items.filter((it) => it.kind === "overwrite"), [items]);
  const deleteItems = useMemo(() => items.filter((it) => it.kind === "delete"), [items]);

  // 初始选中策略：
  // 1. 若存在新模型，默认选中全部新模型
  // 2. 若无新模型（全为已有模型），默认全选已有模型以便覆盖
  // 3. 减量模型默认不勾选（防误删），点击“全选（远程同步）”或“减量”可一键全选
  const [selectedIds, setSelectedIds] = useState(() => {
    const initial = new Set();
    if (newItems.length > 0) {
      newItems.forEach((it) => initial.add(it.id));
    } else {
      overwriteItems.forEach((it) => initial.add(it.id));
    }
    return initial;
  });

  const [submitting, setSubmitting] = useState(false);

  // 各分类当前被选中的数量统计
  const selNewCount = useMemo(() => {
    let count = 0;
    newItems.forEach((it) => { if (selectedIds.has(it.id)) count++; });
    return count;
  }, [newItems, selectedIds]);

  const selOverwriteCount = useMemo(() => {
    let count = 0;
    overwriteItems.forEach((it) => { if (selectedIds.has(it.id)) count++; });
    return count;
  }, [overwriteItems, selectedIds]);

  const selDeleteCount = useMemo(() => {
    let count = 0;
    deleteItems.forEach((it) => { if (selectedIds.has(it.id)) count++; });
    return count;
  }, [deleteItems, selectedIds]);

  // 列表筛选
  const filteredItems = useMemo(() => {
    let list = items;
    if (filterTab === "new") list = newItems;
    else if (filterTab === "overwrite") list = overwriteItems;
    else if (filterTab === "delete") list = deleteItems;

    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter((it) => it.id.toLowerCase().includes(kw));
  }, [items, newItems, overwriteItems, deleteItems, filterTab, keyword]);

  const toggleModel = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 1. 全选（与远程同步）：增量全选、重复全选、减量全选
  const selectAllSync = useCallback(() => {
    const s = new Set();
    items.forEach((it) => s.add(it.id));
    setSelectedIds(s);
  }, [items]);

  // 2. 增量全选 / 取消全选切换
  const toggleAllNew = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = newItems.length > 0 && newItems.every((it) => next.has(it.id));
      if (allSelected) {
        newItems.forEach((it) => next.delete(it.id));
      } else {
        newItems.forEach((it) => next.add(it.id));
      }
      return next;
    });
  }, [newItems]);

  // 3. 重复/覆盖全选 / 取消全选切换
  const toggleAllOverwrite = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = overwriteItems.length > 0 && overwriteItems.every((it) => next.has(it.id));
      if (allSelected) {
        overwriteItems.forEach((it) => next.delete(it.id));
      } else {
        overwriteItems.forEach((it) => next.add(it.id));
      }
      return next;
    });
  }, [overwriteItems]);

  // 4. 减量全选 / 取消全选切换
  const toggleAllDelete = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = deleteItems.length > 0 && deleteItems.every((it) => next.has(it.id));
      if (allSelected) {
        deleteItems.forEach((it) => next.delete(it.id));
      } else {
        deleteItems.forEach((it) => next.add(it.id));
      }
      return next;
    });
  }, [deleteItems]);

  // 5. 清空全部选择
  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleConfirm = async () => {
    const toAdd = newItems.filter((it) => selectedIds.has(it.id)).map((it) => it.id);
    const toOverwrite = overwriteItems.filter((it) => selectedIds.has(it.id)).map((it) => it.id);
    const toDelete = deleteItems.filter((it) => selectedIds.has(it.id)).map((it) => it.id);

    if (toAdd.length === 0 && toOverwrite.length === 0 && toDelete.length === 0) return;
    if (submitting) return;

    setSubmitting(true);
    try {
      await onConfirm({ toAdd, toOverwrite, toDelete });
    } finally {
      setSubmitting(false);
    }
  };

  const getConfirmText = () => {
    if (submitting) return "正在同步配置...";
    const total = selectedIds.size;
    if (total === 0) return "未选择任何模型";
    if (selDeleteCount > 0 && selNewCount === 0 && selOverwriteCount === 0) {
      return "确认下线移除 (" + selDeleteCount + ")";
    }
    if (selOverwriteCount > 0 && selNewCount === 0 && selDeleteCount === 0) {
      return "确认覆盖更新 (" + selOverwriteCount + ")";
    }
    if (selNewCount > 0 && selOverwriteCount === 0 && selDeleteCount === 0) {
      return "确认添加新模型 (" + selNewCount + ")";
    }
    return "确认同步变更 (" + total + ")";
  };

  return (
    <div
      class="zcode-pull-modal-overlay zcode-pull-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
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
            <span>
              同步模型 (共 {items.length} 个：增量 {newItems.length}，重复 {overwriteItems.length}，减量 {deleteItems.length})
            </span>
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
          {/* 分类标签切换栏 */}
          <div class="zcode-pull-tabs">
            <button
              type="button"
              class={`zcode-pull-tab ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              全部 ({items.length})
            </button>
            <button
              type="button"
              class={`zcode-pull-tab ${filterTab === "new" ? "active" : ""}`}
              onClick={() => setFilterTab("new")}
            >
              增量 ({newItems.length})
            </button>
            <button
              type="button"
              class={`zcode-pull-tab ${filterTab === "overwrite" ? "active" : ""}`}
              onClick={() => setFilterTab("overwrite")}
            >
              重复 ({overwriteItems.length})
            </button>
            {deleteItems.length > 0 && (
              <button
                type="button"
                class={`zcode-pull-tab zcode-pull-tab-delete ${filterTab === "delete" ? "active" : ""}`}
                onClick={() => setFilterTab("delete")}
              >
                减量 ({deleteItems.length})
              </button>
            )}
          </div>

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
                class="zcode-pull-mini-btn zcode-pull-mini-btn-sync"
                id="zcode-select-all"
                title="全选所有模型，使本地与远程完全镜像同步（添加增量、更新覆盖、移除减量）"
                onClick={selectAllSync}
              >
                全选 (远程同步)
              </button>
              {newItems.length > 0 && (
                <button
                  type="button"
                  class="zcode-pull-mini-btn"
                  id="zcode-toggle-new"
                  title="切换是否勾选所有增量新模型"
                  onClick={toggleAllNew}
                >
                  增量 ({selNewCount}/{newItems.length})
                </button>
              )}
              {overwriteItems.length > 0 && (
                <button
                  type="button"
                  class="zcode-pull-mini-btn"
                  id="zcode-toggle-overwrite"
                  title="切换是否勾选所有重复现有模型"
                  onClick={toggleAllOverwrite}
                >
                  重复 ({selOverwriteCount}/{overwriteItems.length})
                </button>
              )}
              {deleteItems.length > 0 && (
                <button
                  type="button"
                  class="zcode-pull-mini-btn zcode-pull-mini-btn-delete"
                  id="zcode-toggle-delete"
                  title="切换是否勾选所有远程已下线的减量模型"
                  onClick={toggleAllDelete}
                >
                  减量 ({selDeleteCount}/{deleteItems.length})
                </button>
              )}
              <button
                type="button"
                class="zcode-pull-mini-btn"
                id="zcode-select-none"
                onClick={selectNone}
              >
                清空
              </button>
            </div>
          </div>

          <div class="zcode-pull-list" id="zcode-modal-list">
            {filteredItems.map((it) => (
              <ModelItem
                key={it.id}
                id={it.id}
                kind={it.kind}
                selected={selectedIds.has(it.id)}
                onToggle={() => toggleModel(it.id)}
              />
            ))}
            {filteredItems.length === 0 && (
              <div class="zcode-pull-empty" style={{ padding: "24px 0", textAlign: "center", color: "var(--color-foreground-subtle, #71717a)" }}>
                无匹配模型
              </div>
            )}
          </div>

          <div class="zcode-pull-footer">
            <div class="zcode-pull-count-info zcode-pull-summary">
              已选择 <strong class="zcode-pull-num" id="zcode-selected-num">{selectedIds.size}</strong> / {items.length} 个模型
              <span class="zcode-pull-breakdown" style={{ marginLeft: "8px", fontSize: "12px", opacity: 0.9 }}>
                {selNewCount > 0 && (
                  <span style={{ color: "#10b981", marginRight: "6px" }}>+增量 {selNewCount}</span>
                )}
                {selOverwriteCount > 0 && (
                  <span style={{ color: "#f59e0b", marginRight: "6px" }}>↻重复 {selOverwriteCount}</span>
                )}
                {selDeleteCount > 0 && (
                  <span style={{ color: "#ef4444" }}>-减量 {selDeleteCount}</span>
                )}
              </span>
            </div>
            <div class="zcode-pull-footer-btns">
              <button
                type="button"
                class="zcode-pull-btn-cancel zcode-pull-btn-secondary"
                id="zcode-modal-cancel"
                onClick={onClose}
              >
                取消
              </button>
              <button
                type="button"
                class="zcode-pull-btn-submit zcode-pull-btn-primary"
                id="zcode-modal-confirm"
                disabled={selectedIds.size === 0 || submitting}
                onClick={handleConfirm}
              >
                <span>{getConfirmText()}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
