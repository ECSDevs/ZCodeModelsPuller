# zcode-model-puller (Windows 移植版) — 为 ZCode 注入「⚡️ 自动拉取模型」

把「自动拉取模型」能力直接注入 ZCode 客户端界面：解包 `app.asar` → 注入主进程 IPC + preload API + renderer 按钮脚本 → 重新打包。

在 ZCode 设置 → 模型设置 → 自定义供应商里，点「⚡️ 自动拉取模型」即可一键获取该供应商线上全部模型并批量添加；保存时**自动填充 models.dev 元数据**（context/output 上限、模态、reasoning、tool call），无需重启软件，列表秒级刷新。

## 元数据填充规则

优先级（写入每个新模型的字段）：

| 数据 | 来源 |
|---|---|
| `limit.context` / `limit.output` | models.dev `limit`（`context`/`input`/`output`） |
| `modalities` | models.dev `modalities`（缺省 `text→text`） |
| `supportsTools` / `supportsStructuredOutput` | models.dev `tool_call` / `structured_output` |
| `reasoning` | models.dev `reasoning` + 内置 efforts 表（见下） |
| `name` | models.dev `name` |

规则细节：

- **GPT 系 context 封顶**：`min(原值, 272000)`——超过 272k 计费双倍，无论来自目录还是兜底；目录查不到 GPT 模型时 context 默认 `272000`、output 缺失时默认 `128000`。
- models.dev 目录缓存在 `~\.zcode\v2\.models-dev-cache.json`（3 天有效，下载失败自动回退过期缓存）。
- 模型匹配：目录全键 → 末段（去 vendor 前缀）精确 → 唯一模糊命中；未命中时用内置表兜底，不中断。
- **思考档位（官方编辑弹窗）**：在 ZCode 官方「编辑模型配置」弹窗中注入「思考档位 (efforts)」**多选列表**，打开时回填该模型当前 `reasoning.variants`，勾选即写回 `variants` / `defaultVariant`（取勾选最高档）；并**劫持官方保存按钮**，保存完成后兜底重写 efforts，防止官方保存覆盖。该注入依赖官方弹窗 DOM 结构（`上下文窗口` 字段容器类），ZCode 大版本更新后需重新适配。
- 配置写入：`%USERPROFILE%\.zcode\v2\config.json`。
- **新增供应商时拉取**：在官方「添加供应商」表单填好 Base URL / 名称 / API Key 后点「⚡️ 自动拉取模型」，勾选确认后**无感填入**：通过 React fiber 直接 hook 官方 `onAddModel` 回调，把模型批量注入官方表单的模型列表（不弹逐窗），保存按钮随即解锁；hook 不可用时自动降级为逐个驱动官方「添加模型」弹窗。随后点官方「保存」，保存时/保存后劫持兜底，自动补全 `limit` / `modalities` / `reasoning`（efforts 按 OMP 表）等元数据。

### reasoning efforts 档位（OMP 表为主 + 家族表兜底）

models.dev 只给出是否支持 reasoning（`true/false`）。具体档位按顺序取：

1. **[oh-my-pi/pi-catalog](https://github.com/can1357/oh-my-pi) 模型级档位表**（[omp_efforts.json](omp_efforts.json)，由 [gen_omp_efforts.py](gen_omp_efforts.py) 从 OMP 内置目录直接生成，当前收录 **2898** 个模型的 `reasoning`/`efforts`）——按短模型 id 精确匹配，`variants = 该模型实际档位`，`defaultVariant = 最高档`；`gpt-5.6*` 额外并入 `ultra`。
2. OMP 未收录时回退到**内置家族表**：

| 模型 | variants | default |
|---|---|---|
| `gpt-5.6*`（sol / terra / luna） | low, medium, high, xhigh, max, ultra | medium |
| `gpt-5.x`（5.1–5.5 等，非 5.6） | low, medium, high, xhigh | medium |
| 其余 `gpt-*`（含 4.x、gpt-oss） | low, medium, high | medium |
| `o1` / `o3` / `o4` | low, medium, high | medium |
| `glm*` | low, max, high | max |
| `kimi*` / `moonshot*` | low, high, max | max |
| `gemini-3*` | low, high | high |
| `deepseek*`（V3/V4 等） | low, high, max | high |
| `deepseek-r1/reasoner`、`gemini-2.5`、`qwen*`、`grok*`、`claude*` | 无档位，仅 `{enabled: true}` | — |

> 生成方式：`python gen_omp_efforts.py`（拉取 OMP `packages/catalog/src/models.json` 并精简为 `omp_efforts.json`，可随时重跑以跟随上游更新）。

## 前置要求

- Python 3.8+
- Node.js 16+（含 `npx`；仅装 pnpm 的环境会回退 `pnpm dlx`）。脚本运行期间调用 `@electron/asar`，不代为安装任何运行时。

## 使用

```powershell
python inject_windows.py --check     # 只读检查注入状态
python inject_windows.py --dry-run   # 解包演练：验证本版本三层锚点可命中（不写回、不替换）
python inject_windows.py             # 注入（请先完全退出 ZCode，含系统托盘）
python inject_windows.py --restore   # 还原官方原版（无备份则拒绝；备份保留可再次注入）
```

或直接运行 `install.ps1`（注入）/ `uninstall.ps1`（还原）。

### 人工验证

1. 完全退出 ZCode → 运行注入命令 → 重新打开 ZCode；
2. 设置 → 模型设置 → 自定义供应商 → 添加供应商；
3. 填 Base URL（免密钥示例：Ollama `http://localhost:11434/v1`），API Key 留空，或任意 OpenAI 兼容 `{base}/v1/models` 端点；
4. 点「⚡️ 自动拉取模型」→ 弹窗列出线上模型，未添加的标「新模型」并默认勾选；
5. 确认添加并保存 → 提示成功、列表自动刷新；
6. 打开 `%USERPROFILE%\.zcode\v2\config.json`，新模型条目应带 `limit` / `modalities` / `reasoning`（GPT-5.6 为 six 档）等元数据。

## 安装机制 / 安全设计

1. 首次注入自动完整备份 `app.asar` → `app.asar.original.bak`（哈希校验，ZCode 升级后自动刷新为最新原版）；
2. `@electron/asar extract` 解包到临时目录 → 三层补丁（`index.html` 挂载脚本、`preload` 扩展 `window.zcode`、`main` 注册 6 个 IPC handler）→ **注入后 `node --check` 语法自检** → 重新打包 → 替换前标记自检（缺标记拒绝替换）→ 原子替换；
3. 若 `app.asar` 被安全软件实时防护（如火绒）以「拒绝删除」方式占用、无法重命名，自动退化为**原地覆盖 + 读回校验**（非原子路径，但原版备份始终保留，可随时 `--restore` 恢复）；
4. 幂等：已注入的层自动跳过；`puller`（renderer 脚本）每次注入强制覆盖，preload / main 按缺失通道幂等补丁（不会重复注册）；minifier 变量名运行时捕获（不做硬编码），锚点不命中时报「版本不兼容」并中止，绝不产出坏包。

## 额外能力：保存后自动刷新思考档位

官方聊天侧思考档位列表是「选模型时的快照」，保存后不会自动重建。本插件在保存后自动重选当前模型（先切到同组另一模型、再切回目标），让档位列表即时反映新勾选，无需手动重选或重启：

- 依赖主进程额外 IPC：`zcode:simulate-mouse-click` / `zcode:simulate-mouse-move`（经 `webContents.sendInputEvent` 派发**真实**鼠标事件；注入的 JS 构造的合成事件 `isTrusted=false`，Radix 浮层不响应）。
- 自动重选在**用户回到聊天页**（模型选择 trigger 真实可见）后执行，等待上限约 30s、最多重试数轮。

## 注意事项

- **ZCode 升级后需重新注入**：升级用官方新 `app.asar` 覆盖注入版；升级后重跑 `inject_windows.py`，备份会自动刷为最新原版。
- **更新注入内容后**：`puller`（renderer）每次注入强制覆盖、preload/main 幂等补丁，一般无需 `--restore` 即可生效；若改动量大或想从零验证，仍建议先 `--restore` 再全新注入。
- 每次操作前可先跑 `--check`；`--dry-run` 可安全验证当前 ZCode 版本兼容性。

## 借鉴来源（MIT）

本注入模块为 [HHQ-666/zcode-model-puller](https://github.com/HHQ-666/zcode-model-puller)（MIT License, Copyright (c) 2025 HHQ）的 **Windows 移植**：`zcode-model-puller.js` 前端脚本沿用其实现，注入流程（asar 解包 / 主进程 + preload IPC / renderer 挂载 / 还原）按其方案适配 Windows 与当前 ZCode 版本，补丁锚点改为运行时宽容匹配。模型元数据目录：[models.dev](https://models.dev)。详见上游仓库与 LICENSE。