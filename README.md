# AI Infinite Dialog

> **AI 无限对话反馈系统** — 让 AI 在完成任务后主动询问用户是否继续，实现真正的人机协作循环。

专为 **Windsurf** IDE 打造。

---

## 功能特性

### 核心功能
- **无限对话循环**：AI 完成任务后自动弹出反馈面板，用户选择「继续」或「结束」
- **全局规则注入**：自动向 IDE 注入 AI 行为规则（编程规范、询问流程等）
- **HTTP 服务**：内置轻量 HTTP 服务，AI 通过 `curl` 调用反馈接口
- **Markdown 渲染**：反馈面板完整支持 Markdown、代码高亮、图片显示

### 管理功能
- 侧边栏控制面板（启动/停止/重启服务）
- 服务状态实时显示
- 使用统计（调用次数、继续/结束计数）
- 日志查看
- 配置导出/导入

### 高级功能
- 端口自动扫描（避免冲突）
- 自定义规则编辑
- 快捷键支持

## 工作原理

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    AI       │────▶│ HTTP Server │────▶│  反馈面板    │
│ (Cascade)   │     │ (Port 3456) │     │  (WebView)  │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │              用户反馈返回               │
       └───────────────────────────────────────┘
```

1. **AI 调用工具**：AI 完成任务后通过 HTTP 调用 `infinite_dialog_feedback`
2. **服务处理请求**：插件的 HTTP 服务接收请求并弹出反馈面板
3. **展示回复内容**：WebView 面板渲染 AI 的 Markdown 回复
4. **用户做出选择**：用户选择「继续」或「结束对话」
5. **反馈返回 AI**：用户的选择和追加指令通过 HTTP 响应返回给 AI

## 安装

### 方法 1：从 VSIX 安装（推荐）

在 [Releases](https://github.com/ova111/ai-infinite-dialog/releases) 页面下载最新的 `.vsix` 文件，然后：

```bash
code --install-extension ai-infinite-dialog-x.x.x.vsix
```

或者在 IDE 中：`Ctrl+Shift+P` → `Install from VSIX...` → 选择下载的文件。

### 方法 2：从源码构建

```bash
git clone https://github.com/ova111/ai-infinite-dialog.git
cd ai-infinite-dialog
npm install
npm run package
# 生成的 .vsix 文件在项目根目录
```

### 方法 3：开发模式

```bash
git clone https://github.com/ova111/ai-infinite-dialog.git
cd ai-infinite-dialog
npm install
npm run watch
# 按 F5 启动调试
```

## 使用方法

### 1. 启动插件

插件会在 IDE 启动时自动激活并：
- 启动 HTTP 服务（默认端口 3456）
- 注入全局 AI 规则
- 在状态栏显示服务状态

### 2. AI 自动调用

当 AI 完成任务后，会自动调用 `infinite_dialog_feedback` 工具，弹出反馈面板。

### 3. 用户交互

在反馈面板中：
- 查看 AI 的回复内容（Markdown 渲染 + 代码高亮）
- 输入追加指令（可选）
- 上传/粘贴图片（可选）
- 点击「继续」继续对话，或点击「结束对话」停止

## 命令列表

| 命令 | 说明 |
|------|------|
| `AI Dialog: 启动 MCP 服务` | 手动启动 HTTP 服务 |
| `AI Dialog: 停止 MCP 服务` | 停止 HTTP 服务 |
| `AI Dialog: 打开设置面板` | 打开设置面板 |
| `AI Dialog: 配置 IDE` | 重新配置 IDE |
| `AI Dialog: 注入全局规则` | 重新注入 AI 规则 |
| `AI Dialog: 编辑规则` | 编辑 AI 规则文件 |
| `AI Dialog: 查看日志` | 打开日志面板 |
| `AI Dialog: 查看状态` | 查看服务运行状态 |

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + Shift + D` | 打开设置面板 |
| `Cmd/Ctrl + Shift + S` | 启动服务（服务未运行时） |
| `Ctrl/Cmd + Enter` | 继续对话（反馈面板内） |
| `Escape` | 结束对话（反馈面板内） |

## 配置项

在 IDE 设置中搜索 `ai-infinite-dialog`：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `autoStart` | boolean | `true` | 启动时自动启动 HTTP 服务 |
| `autoConfigureIDE` | boolean | `true` | 自动配置 IDE |
| `autoInjectRules` | boolean | `true` | 自动注入全局 AI 规则 |
| `serverPort` | number | `3456` | HTTP 服务端口 |
| `targetIDE` | string | `"windsurf"` | 目标 IDE |
| `showNotifications` | boolean | `true` | 显示通知消息 |

## 项目结构

```
ai-infinite-dialog/
├── src/
│   ├── extension.ts        # 插件入口，激活/注销
│   ├── mcpServer.ts        # HTTP 服务，处理 AI 工具调用
│   ├── feedbackPanel.ts    # 反馈面板 WebView
│   ├── ruleInjector.ts     # AI 规则注入（Windsurf）
│   ├── configManager.ts    # IDE 配置管理
│   ├── sidebarProvider.ts  # 侧边栏设置面板
│   ├── settingsPanel.ts    # 独立设置面板
│   ├── logManager.ts       # 日志管理
│   └── statsManager.ts     # 使用统计
├── resources/
│   └── icon.svg            # 插件图标
├── package.json
├── tsconfig.json
├── LICENSE                 # MIT 许可证
├── CHANGELOG.md            # 版本更新日志
└── README.md
```

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式（自动编译）
npm run watch

# 代码检查
npm run lint

# 打包 VSIX
npm run package
```

## 注入的 AI 规则

插件会自动向 IDE 注入以下 AI 行为规则：

- **反馈接口调用**：AI 每次回复结束前必须调用反馈接口
- **先询问再执行**：修改代码前先说明问题、提供方案、等待用户选择
- **编程规范**：代码质量、错误处理、安全编码、可维护性等
- **失败重试**：接口调用失败自动重试 3 次

规则文件位置：`~/.codeium/windsurf/memories/user_global.md`

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 许可证

[MIT](LICENSE) © 2024-2026 AI Infinite Dialog
