/**
 * DOM 辅助与异步等待工具
 */

export function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc.set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

export function waitFor(fn, timeout, interval = 80) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      let v = null;
      try {
        v = fn();
      } catch (e) {}
      if (v) return resolve(v);
      if (Date.now() - t0 > timeout) return resolve(null);
      setTimeout(tick, interval);
    };
    tick();
  });
}

export function waitTrue(fn, timeout, interval = 120) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      let v = false;
      try {
        v = fn();
      } catch (e) {}
      if (v) return resolve(true);
      if (Date.now() - t0 > timeout) return resolve(false);
      setTimeout(tick, interval);
    };
    tick();
  });
}

export function centerOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
