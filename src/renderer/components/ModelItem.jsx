import { h } from "preact";

export function ModelItem({ id, exists, selected, onToggle }) {
  return (
    <div
      class="zcode-pull-item"
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
      {exists ? (
        <span
          class="zcode-pull-badge zcode-pull-badge-exists"
          title="已存在于当前供应商中，勾选将使用最新元数据覆盖现有配置"
        >
          覆盖现有
        </span>
      ) : (
        <span class="zcode-pull-badge zcode-pull-badge-new">新模型</span>
      )}
    </div>
  );
}
