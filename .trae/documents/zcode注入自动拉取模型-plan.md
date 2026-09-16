# 计划：为 ZCode 注入「自动拉取模型」能力（Windows 移植）

## Context 背景

本地 zcode 项目目前只有 `zprovider.py`（CLI：读写 `%USERPROFILE%\.zcode\v2\config.json`，管理 OpenAI 兼容供应商与模型元数据）。

用户要求参照 GitHub 仓库 [HHQ-666/zcode-model-puller](https://github.com/HHQ-666/zcode-model-puller)（macOS 专属），把「将自动拉取模型能力**注入到 ZCode 客户端界面**」的能力加到本地项目，适配 Windows。

参考仓库机制（已 clone 到 `C:\Users\deskt\AppData\Local\Temp\zcode-model-puller-ref` 供对照）：
1. 备份 `app.asar` → `npx @electron/asar extract` 解包到临时目录；
2. renderer：复制 `zcode-model-puller.js` 到 `out/renderer/`，在 `out/renderer/index.html` 的 `</body>` 前插 `<script type="module" src="./zcode-model-puller.js">`；
3. preload：在 `contextBridge.exposeInMainWorld("zcode",{` 处扩展 `readConfigFile / writeConfigFile / fetchModelsFromUrl` 三个 IPC；
4. main：在 `he.handle(I.SaveMcpToUserDirectory` 前插入三个 `he.handle(...)`（node:fs 读写 config、node:http(s) 探测 `{baseURL}/models`）；
5. `@electron/asar pack` 回包并原子替换。前端 JS 用 MutationObserver 在“添加模型”按钮旁挂「⚡️自动拉取模型」按钮，弹窗多选新模型、写回 config、模拟点击官方刷新按钮。

**官方原版注入目标已实地确认**：Windows 版 ZCode 位于 `C:\Users\deskt\AppData\Local\Programs\ZCode\resources\app.asar`（约 307MB，2026-09-04 版）；二进制扫描显示 `SaveMcpToUserDirectory`×8、`exposeInMainWorld`×10（锚点字符串存在），`read-model-config`×0（当前未注入过）。

## 默认决策（澄清问题被跳过，按推荐值执行）

- **范围**：新增注入模块，**不改 `zprovider.py`**。
- **前端脚本**：`zcode-model-puller.js` 从参考仓库**原样复制**（MIT，保留文件头版权注释）。
- **元数据策略**：新模型由注入脚本按参考仓库固定模板写入（`context:1000000 / output:128000`）；需要精确元数据时用现有 `python zprovider.py refresh <pid>` 补全（README 中提示二者互补、写入同一 config 不冲突）。
- **参考文献**：README 增加「借鉴来源/致谢」段，标注 MIT 出处与上游仓库链接（同时满足引用语义，且符合 MIT 许可要求）。

## 新增 / 修改文件

| 文件 | 说明 |
|---|---|
| `zcode-model-puller.js` | 自参考仓库原样复制，renderer 注入 UI + IPC 调用。 |
| `inject_windows.py` | 核心工具（仅 Python3 标准库）：`install` / `--restore` / `--check` / `--dry-run`。 |
| `install.ps1` / `uninstall.ps1` | 薄封装：`python .\inject_windows.py` / `python .\inject_windows.py --restore`。 |
| `README.md` | 末尾新增「界面注入（Windows）」章节 + MIT 致谢。 |

## inject_windows.py 设计要点

### 路径常量
- `ASAR = %LOCALAPPDATA%\Programs\ZCode\resources\app.asar`（`--asar` 可覆盖）
- `ASAR_BAK = 同目录\app.asar.original.bak`
- `WORK_ROOT = tempfile.gettempdir()\zcode_inject_build_<pid>`（带 pid，防并发/残留）
- 主进程 handler 内写死配置路径 `~/.zcode/v2/config.json`（与 zprovider.py 默认一致）

### 流程与健壮性
1. **`ensure_zcode_not_running()`**：`tasklist /FI "IMAGENAME eq ZCode.exe"` 探测；运行中则提示“请完全退出 ZCode”并中止。替换时 `PermissionError` 双保险。
2. **`backup_asar()`（只备份一次 + 处理升级）**：无备份 → copy2 创建；有备份但哈希不同且当前 asar 无注入 marker → 判定为新版原包，刷新备份；已有 marker → 保留旧备份并提示。
3. **`extract_and_patch(work_dir)`**：npx 解包 → 三层补丁（见下）→ 每层返回 `matched/applied/skipped` 状态。
4. **`pack_and_replace()`**：pack 到同盘临时文件 → **自检**（临时 asar 中 `zcode:read-model-config`≥2 且 `./zcode-model-puller.js`≥1，任一缺失拒绝替换）→ `os.replace` 原子替换 → 清理 WORK_ROOT。
5. **`--dry-run`**：仅 extract + 内存内正则演算并打印每层结论，不写回不 repack（验证正则兼容性，不碰真实 asar）。
6. **`--check`**：对真实 asar 做二进制子串扫描，输出各 marker 命中数，判定 `未注入/已注入/疑似部分注入`。
7. **`restore()`**：无备份拒绝；`ensure_zcode_not_running()`；`copy2(BAK, ASAR)`（保留备份，允许再次注入）。
8. **npx 调用**：`shutil.which("npx")` 或 `"npx.cmd"` 定位；找不到则提示“未检测到 Node/npx，请自装”（不代为安装）。`subprocess.run(shell=True, capture_output=True, text=True)`，非 0 返回码打印 stderr 并中止。

### 三层补丁的宽容锚点（关键：minifier 变量名会变，一律运行时捕获）
- **幂等 marker**（各层出现即跳过）：html `./zcode-model-puller.js`；preload/main `zcode:read-model-config`。
- **层一 index.html**：锚点 `</body>`，其前插入 `<script type="module" src="./zcode-model-puller.js"></script>`。
- **层二 preload/index.cjs**：锚点正则 `[\w$]+\.exposeInMainWorld\s*\(\s*["']zcode["']\s*,`；捕获首个 `(?P<H>[\w$]+)\.ipcRenderer\.invoke` 的 `H`；锚点后插入三行（IPC 通道名与前端 zcode-model-puller.js 的调用签名一一对应）：
  ```js
  readConfigFile:()=>H.ipcRenderer.invoke("zcode:read-model-config"),
  writeConfigFile:(data)=>H.ipcRenderer.invoke("zcode:write-model-config",data),
  fetchModelsFromUrl:(baseUrl,apiKey)=>H.ipcRenderer.invoke("zcode:fetch-models-from-url",{baseUrl,apiKey}),
  ```
  兜底：找不到 `H` 时退回 `(require("electron").ipcRenderer)` 并告警。
- **层三 main/index.js**：锚点正则 `(?P<HE>[\w$]+)\s*\.\s*[\w$]+\s*\.\s*SaveMcpToUserDirectory`（捕获 handler 载体 `HE`）；在命中点前插入三个 `HE.handle("zcode:...", ...)` — `read-model-config`（读 config.json 返回 `{success,data|error}`）、`write-model-config`（写回）、`fetch-models-from-url`（按 `/v1`→`/models` 候选顺序 http/https 请求，2xx 且解析出 id 数组才成功，返回 `{success,models}|{success:false,error}`）；内部全部 `await import("node:fs"/"node:path"/"node:os"/"node:http"/"node:https")` 局部加载。
  锚点不中 → **中止安装**（不产出半成品包），`--dry-run` 只报告。

## 实施步骤

1. 复制 `zcode-model-puller.js` 到本地项目（保留 MIT 头）。
2. 编写 `inject_windows.py`：先 `run_npx` / `ensure_zcode_not_running` / `--check` / `backup_asar`，再 `--dry-run`（三层正则演算），最后 `extract_and_patch` / `pack_and_replace` / `restore`。
3. 先跑 `--check`（只读）确认当前未注入；再跑 `--dry-run` 确认本版本 asar 三层锚点均命中（需要 Node/npx；若无则提示用户装 Node 后再验证）。
4. 真实安装：确认 ZCode 已退出 → `python inject_windows.py`。
5. 可选：`install.ps1` / `uninstall.ps1`。
6. 更新 `README.md`（新增章节 + MIT 致谢）。
7. 收尾：`--check` 确认已注入；核对真实 asar 自检通过、WORK_ROOT 已清理；确认 zprovider.py 未被改动。

## 验证方式

- **只读验证**：`python inject_windows.py --check`（基线：未注入）；`--dry-run`（三层锚点全命中、`HE`/`H` 捕获正确、幂等判定正确）。
- **真注入端到端**（需重启 ZCode，由用户执行确认）：
  1. 完全退出 ZCode → 运行 `python inject_windows.py` → 重新打开 ZCode；
  2. 设置 → 模型设置 → 自定义供应商 → 添加供应商；
  3. 填 Base URL（建议先测本地免密钥：Ollama `http://localhost:11434/v1`，或任意 OpenAI 兼容 `{base}/v1/models`），API Key 留空；
  4. 点「⚡️自动拉取模型」→ 弹窗列出线上模型、未添加标「新模型」默认勾选；
  5. 确认保存 → toast 成功、列表自动刷新出现新模型卡片；核对 `~/.zcode/v2/config.json` 中该供应商 `models` 已新增条目；
  6. 无 CORS：私有/中转端点无 CORS 头时也能拉取（走主进程 IPC）。
- **还原验证**：`python inject_windows.py --restore` → 重启 ZCode → 按钮消失。
- **回归**：`python zprovider.py list` 仍正常读取同一 config。
- **升级提示**（README）：ZCode 升级会用官方新 asar 覆盖注入版 → 升级后需重跑安装；备份刷新逻辑已在 `backup_asar()` 处理。

## 明确不做

- 不改 `zprovider.py`、不引入第三方 pip 依赖、不改 config JSON 结构约定。
- 不代为安装 Node/npx 等运行时（脚本仅做前置检查并在缺少时给出明确提示）。