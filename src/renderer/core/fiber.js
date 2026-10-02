/**
 * React Fiber 链查找工具
 * 用于跨组件抓取 props、回调函数等 React 内部状态
 */

export function getFiber(el) {
  if (!el) return null;
  const key = Object.keys(el).find(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
  );
  return key ? el[key] : null;
}

export function findPropUp(el, prop) {
  let f = getFiber(el);
  for (let i = 0; f && i < 30; i++) {
    const p = f.memoizedProps;
    if (p && typeof p[prop] === "function") return p[prop];
    f = f.return;
  }
  return null;
}

export function findPropsUp(el, key) {
  let f = getFiber(el);
  for (let i = 0; f && i < 30; i++) {
    const p = f.memoizedProps;
    if (p && key in p && p[key] != null) return p[key];
    f = f.return;
  }
  return null;
}

/**
 * 向上查找带特定形参个数的回调函数
 * 例如官方 onModelCommit 为双参 (index, model)，而关闭回调 onCommit 为无参。
 */
export function findCallbackUp(el, prop, minArgs = 2) {
  let f = getFiber(el);
  for (let i = 0; f && i < 60; i++) {
    const p = f.memoizedProps;
    if (p && typeof p[prop] === "function" && p[prop].length >= minArgs) return p[prop];
    f = f.return;
  }
  return null;
}
