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
        <span class="zcode-pull-badge zcode-pull-badge-exists">已存在</span>
      ) : (
        <span class="zcode-pull-badge zcode-pull-badge-new">新模型</span>
      )}
    </div>
  );
}
