/**
 * IPC 通信抽象与配置读写
 */

export function getZCodeApi() {
  return window.zcode;
}

export async function readZCodeConfig() {
  const api = getZCodeApi();
  if (api?.readConfigFile) {
    const res = await api.readConfigFile();
    return res.data;
  }
  return null;
}

export async function writeZCodeConfig(cfg) {
  const api = getZCodeApi();
  if (api?.writeConfigFile && cfg) {
    const res = await api.writeConfigFile(cfg);
    return !!(res && res.success);
  }
  return false;
}

export function getZCodeClick() {
  try {
    return window.zcode && window.zcode.simulateMouseClick;
  } catch (e) {
    return null;
  }
}

export function realClick(x, y) {
  const fn = getZCodeClick();
  if (!fn) return false;
  try {
    fn(Math.round(x), Math.round(y));
    return true;
  } catch (e) {
    return false;
  }
}
