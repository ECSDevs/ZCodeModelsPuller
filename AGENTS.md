# AGENTS.md — 给 AI 代理的工作指南

本文件帮助 AI 编码代理快速理解本项目（ZCode「自动拉取模型」注入插件）的结构、约束与常见陷阱。改动代码前请先阅读。

## 项目是什么

向 ZCode（Electron 应用，Windows）注入三类代码，把「一键拉取模型 + 元数据补全 + 思考档位管理」能力做进官方界面：

1. `out/renderer/index.html` — 挂载前端脚本 `zcode-model-puller.js`
2. `out/preload/index.cjs` — 扩展 `window.zcode`（IPC 桥：读/写 config、拉模型、往返元数据、模拟鼠标点击）
3. `out/main/index.js` — 注册 IPC handler（config 读写、models.dev 元数据、`sendInputEvent` 模拟真实点击）

## 架构与模块化分层

本项目前端已采用现代前端组件化框架（Preact + JSX + Hooks）进行模块化解耦，大字符串字面量均已外部文件化（具备原生语法高亮与格式化支持）：

| 路径 | 角色与说明 |
|---|---|
| `src/renderer/components/` | 现代 UI 组件库（`PullModal.jsx`、`ModelItem.jsx` 等，基于 Preact 声明式构建） |
| `src/renderer/core/cel/` | 外部 CEL 映射规则表达式（Anthropic / OpenAI 等，方便语法高亮与维护） |
| `src/renderer/core/` | 核心推导算法（`model-specs.js`、`default-specs.js`、`ipc.js` 等） |
| `src/renderer/dom/` | DOM 嗅探与注入（`form-injection.js`、`credentials.js`、`refresh.js` 等） |
| `src/renderer/styles/theme.css` | 外部 CSS 样式源码（纯 CSS 高亮与编辑，由 esbuild 内联） |
| `src/renderer/ui/` | 官方交互入口挂载控制器（`pull-modal.js`、`editor-efforts.js`、`pull-button.js`） |
| `injector/main_handlers.js` | 主进程 IPC Handlers 原生 JavaScript 源码（独立高亮、可静态语法校验） |
| `injector/` | Python 注入器模块（CLI/ASAR解包/各层patcher） |
| `inject_windows.py` | 注入 CLI 入口脚本（调用 `injector.cli`） |
| `gen_omp_efforts.py` | 从上游自动拉取并生成精简档位表（支持有效期与自动更新） |
| `install.ps1` / `uninstall.ps1` | 注入/还原封装脚本 |

## 产物与生命周期规则

- **构建产物与临时数据不入库**：`zcode-model-puller.js` 与 `omp_efforts.json` 均为构建/网络产物，已从 Git 跟踪中剔除并由 `.gitignore` 忽略。
- **安装时自愈检测与自动生成**：`python inject_windows.py`（或 `install.ps1`）执行时：
  - 自动检测 `omp_efforts.json` 是否存在或过期（默认 7 天有效期），若无或过期则自动更新拉取；网络失败则自动优雅回退本地缓存；
  - 自动检测 `zcode-model-puller.js` 是否存在，若无则自动调用 `pnpm run build`（或 npm / npx esbuild）自动编译打包。
- **改动代码后的自检流程**：
  - 改动前端后：运行 `pnpm run build` 与 `node --check zcode-model-puller.js`；
  - 改动主进程 JS 后：运行 `python -m py_compile injector/patcher.py` 并在安装前演练验证；
  - 注入后必须重启 ZCode 才生效。
- **minifier 变量名随 ZCode 版本漂移**：注入代码里引用的官方变量一律「运行时从现场捕获 + 正则」，绝不硬编码（见 `patcher.py` 的 `RE_*_ANCHOR`）。
- **幂等**：层已注入则跳过；跨版本升级后需 `--restore` 再注入。
- **思考档位规则**：已取消内置家族表兜底，思考档位严格依赖 `omp_efforts.json`；若模型在 OMP 中不存在 efforts 则明确报错拒绝伪造档位；支持忽略前后缀匹配（自动剥离厂商前缀与日期/版本/思考档位修饰后缀）。

## 架构要点（离线逆向结论）

- **ZCode 3.14+ 架构演进**：
  - 配置文件已迁移至 `~/.zcode/v2/provider_config.json`（包含 `providerRules` 与 `modelConfigRules`）。
  - 自定义供应商使用 `InlineEditableProviderCard`，模型增删为原子化写盘（直接调用 `onAddModel(model: ProviderSettingsFormModel)` 或 `onAddPersonalModel`），页面无全局保存按钮。
  - 模型对象必须符合 `ProviderSettingsFormModel` 规范（必须有 `modelId`、`personalConfig`、`kind: 'candidate'`），同时向下兼容旧版。
  - 官方编辑弹窗原生支持 `maxOutputTokens`、`inputFormat`（模态）、能力复选框与 `reasoningLevel`（带 CEL map 映射）。通过 React Fiber 的 `onDraftChange` 并维护 `overriddenFieldsValue` 智能填充官方控件。
- **聊天侧思考档位列表是「选模型时的快照」**（`pQe` 组件），不随保存自动重建，且点击**当前已选中**模型项 Radix 会忽略（值未变）。自动刷新必须「先切到同组另一模型 → 再切回目标」。
- **注入环境无法生成 `isTrusted` 事件**：`dispatchEvent` 的合成事件打不开 Radix 浮层。可靠做法是主进程 `webContents.sendInputEvent` 派发真实事件，preload 暴露 `simulateMouseClick(x,y)`。

## 调试

- 注入后重启 ZCode 并用 `--remote-debugging-port=9333` 启动，通过 CDP（`http://localhost:9333/json`）连接 page target 做 `Runtime.evaluate`、`Input.dispatchMouseEvent`、`Page.captureScreenshot`。
- 临时调试脚本命名 `cdp_*.js`、截图 `.png`，已从 `.gitignore` 排除，用完即删，勿提交。
- 触发链路自检：`python inject_windows.py --dry-run`。
