# AGENTS.md — 给 AI 代理的工作指南

本文件帮助 AI 编码代理快速理解本项目（ZCode「自动拉取模型」注入插件）的结构、约束与常见陷阱。改动代码前请先阅读。

## 项目是什么

向 ZCode（Electron 应用，Windows）注入三类代码，把「一键拉取模型 + 元数据补全 + 思考档位管理」能力做进官方界面：

1. `out/renderer/index.html` — 挂载前端脚本 `zcode-model-puller.js`
2. `out/preload/index.cjs` — 扩展 `window.zcode`（IPC 桥：读/写 config、拉模型、往返元数据、模拟鼠标点击）
3. `out/main/index.js` — 注册 IPC handler（config 读写、models.dev 元数据、`sendInputEvent` 模拟真实点击）

## 关键文件

| 路径 | 角色 |
|---|---|
| `src/` | 模块化前端源码（ESModule，包含 core/dom/styles/sync/ui） |
| `zcode-model-puller.js` | 打包生成的 renderer 注入脚本（IIFE，由 `pnpm run build` 生成） |
| `injector/` | Python 注入器模块（CLI/ASAR解包/各层patcher） |
| `inject_windows.py` | 注入 CLI 入口脚本（调用 `injector.cli`） |
| `omp_efforts.json` | 2898 个模型的 efforts 档位表（`gen_omp_efforts.py` 生成） |
| `install.ps1` / `uninstall.ps1` | 注入/还原封装脚本 |

## 硬性约束

- **改动 `zcode-model-puller.js` / preload / main 注入文本后**：`node --check` 通过后再注入；注入后必须重启 ZCode 才生效。
- **主进程文件 / preload / renderer 注入代码**都必须通过语法校验（`node --check` / `python -m py_compile`）。
- **minifier 变量名随 ZCode 版本漂移**：注入代码里引用的官方变量一律「运行时从现场捕获 + 正则」，绝不硬编码（见 `inject_windows.py` 的 `RE_*_ANCHOR`）。
- **幂等**：层已注入则跳过；跨版本升级后需 `--restore` 再注入。
- 新模型的 `kinds`、`defaultKind`、`reasoning.levels` 等必须用官方命名（`{low:{value:"low"}}` 对象形态），否则官方保存会剥掉。
- 注入沙箱限制：`inject_windows.py` 需要写 `Program Files\ZCode`，在默认沙箱内会 EPERM，需以非沙箱方式运行。

## 架构要点（离线逆向结论，改前必看）

- **ZCode 3.14+ 架构演进**：
  - 配置文件已迁移至 `~/.zcode/v2/provider_config.json`（包含 `providerRules` 与 `modelConfigRules`）。
  - 自定义供应商使用 `InlineEditableProviderCard`，模型增删为原子化写盘（直接调用 `onAddModel(model: ProviderSettingsFormModel)` 或 `onAddPersonalModel`），页面无全局保存按钮。
  - 模型对象必须符合 `ProviderSettingsFormModel` 规范（必须有 `modelId`、`personalConfig`、`kind: 'candidate'`），同时向下兼容旧版。
  - 官方编辑弹窗原生支持 `maxOutputTokens`、`inputFormat`（模态）、能力复选框与 `reasoningLevel`（带 CEL map 映射）。旧版在弹窗底部塞 checkbox 的方式已彻底废除，改为通过 React Fiber 的 `onDraftChange` 智能填充官方控件。
- **聊天侧思考档位列表是「选模型时的快照」**（`pQe` 组件），不随保存自动重建，且点击**当前已选中**模型项 Radix 会忽略（值未变）。自动刷新必须「先切到同组另一模型 → 再切回目标」。
- **注入环境无法生成 `isTrusted` 事件**：`dispatchEvent` 的合成事件打不开 Radix 浮层。可靠做法是主进程 `webContents.sendInputEvent` 派发真实事件，preload 暴露 `simulateMouseClick(x,y)`。
- **判断“聊天触发 trigger 可见需用 elementFromPoint 命中自身**，禁用 `body.textContent` 匹配（导航栏含静态「模型设置」文案会误判）。
- `findEditorModelId(body, cfg)`：优先 `input.font-mono` 值，其次命中 config 模型 id 的 input，最后任意非 URL/密钥的文本 input。

## 调试

- 注入后重启 ZCode 并用 `--remote-debugging-port=9333` 启动，通过 CDP（`http://localhost:9333/json`）连接 page target 做 `Runtime.evaluate`、`Input.dispatchMouseEvent`、`Page.captureScreenshot`。
- 临时调试脚本命名 `cdp_*.js`、截图 `.png`，已从 `.gitignore` 排除，用完即删，勿提交。
- config 文件：`C:\Users\deskt\.zcode\v2\config.json`；models.dev 缓存：`.models-dev-cache.json`。
- 触发链路自检：`python inject_windows.py --dry-run`。

## 常见坑

- 官方保存按钮文本匹配 `/保存|添加供应商|…/` 是捕获阶段 document 级 click 监听，注意 `ev.target.closest("button")` 为空时直接返回。
- efforts 轮询 `reapEffortsTight`：前 6 轮无条件重写覆盖官方写盘窗口，之后以读回一致为停止条件；toast“已确保思考档位保存正确”仅在轮询结束弹一次（`__zcodeEffortsToastShown` 去重，勾选时重置）。
- 备份 `app.asar.original.bak` 保留原版；安全软件占用导致无法原子替换时自动退化原地覆盖 + 读回校验。