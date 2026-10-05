import { h } from "preact";

export function ModelItem({ id, kind, selected, onToggle }) {
  // kind: "new" (增量) | "overwrite" (重复) | "delete" (减量)
  return (
    <div
      class={`zcode-pull-item ${kind === "delete" ? "zcode-pull-item-delete" : ""}`}
      data-id={id}
      onClick={onToggle}
      style={{ cursor: "pointer" }}
    >
      <input
        type="checkbox"
        checked={selected}
        data-id={id}
        onChange={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      />
      <span class="zcode-pull-item-name">{id}</span>
      {kind === "new" && (
        <span class="zcode-pull-badge zcode-pull-badge-new" title="远程新增模型，勾选将添加到当前供应商">
          增量 (新模型)
        </span>
      )}
      {kind === "overwrite" && (
        <span
          class="zcode-pull-badge zcode-pull-badge-exists"
          title="已存在于当前供应商中，勾选将使用最新元数据覆盖现有配置"
        >
          重复 (覆盖现有)
        </span>
      )}
      {kind === "delete" && (
        <span
          class="zcode-pull-badge zcode-pull-badge-delete"
          title="当前供应商已配置但远程 probe 不存在，勾选将从供应商中下线/移除"
        >
          减量 (远端不存在)
        </span>
      )}
    </div>
  );
}
