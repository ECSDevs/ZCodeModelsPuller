/**
 * 轻量全局通知 Toast 组件
 */

export function showToast(message, duration = 3000) {
  const existing = document.querySelector(".zcode-custom-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "zcode-custom-toast";
  toast.innerHTML = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.2s, transform 0.2s";
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, -10px)";
    setTimeout(() => toast.remove(), 200);
  }, duration);
}
