# Changelog

All notable changes to the **AI Infinite Dialog** extension will be documented in this file.

## [1.0.6] - 2026-02-07

### Added
- 国际化（i18n）支持：中文、英文、法文、西班牙文
- 新增 `src/i18n/` 模块：自动检测 VS Code 语言设置
- 新增翻译文件：`zh.ts`、`en.ts`、`fr.ts`、`es.ts`（137+ 翻译键）
- 新增 `package.nls.json`、`package.nls.zh.json`、`package.nls.fr.json`、`package.nls.es.json` 用于命令和配置描述本地化
- 新增多语言 README：`README.en.md`（英文）、`README.fr.md`（法文）、`README.es.md`（西班牙文）
- README 添加语言切换链接

### Changed
- 所有源文件中的硬编码中文 UI 文本替换为 `t()` 国际化调用
- `extension.ts`：所有用户消息国际化
- `sidebarProvider.ts`：TypeScript 代码和 HTML WebView 全部国际化
- `settingsPanel.ts`：TypeScript 代码和 HTML WebView 全部国际化
- `feedbackPanel.ts`：TypeScript 代码和 HTML WebView 全部国际化
- `mcpServer.ts`：工具描述、日志消息国际化
- `ruleInjector.ts`：添加 i18n 导入
- `package.json`：命令标题和配置描述使用 `%nls%` 本地化键
- 版本号更新至 1.0.6

## [1.0.5] - 2026-02-06

### Changed
- 仅保留 Windsurf IDE 支持，移除 Cursor 相关代码
- 简化 ruleInjector.ts，删除 injectCursorRules 方法
- 简化 extension.ts 编辑规则命令，移除 Cursor 路径分支
- 更新 targetIDE 配置默认值为 windsurf
- 更新侧边栏和设置面板 UI，移除 Cursor 选项
- 更新文档

## [1.0.4] - 2026-02-05

### Added
- 编程规范规则：代码质量、错误处理、禁止事项
- 安全编码实践规则：敏感信息保护、输入验证
- 可维护性规则：单一职责、有意义命名、避免魔法数字
- 代码审查思维规则：先读后写、边界情况、复用优先
- 项目理解规则：技术栈感知、遵循设计模式、谨慎引入依赖
- 沟通与表达规则：方案对比、风险评估、分步指引
- 接口调用失败自动重试 3 次

### Changed
- 核心规则从「持续执行」改为「先询问再执行」模式
- AI 修改代码前必须先说明问题、提供方案、等待用户选择

### Fixed
- 修复 settingsPanel.ts 中缺少的 openLink 处理（GitHub 链接无法打开）
- 修复 extension.ts 中 LogManager 未 dispose 导致的资源泄漏

### Removed
- 清理 configManager.ts 中未使用的死代码（MCP Bridge 相关）

## [1.0.0] - 2026-01-11

### Added
- 初始版本发布
- HTTP 服务（MCP Server）处理 AI 工具调用
- 反馈面板支持 Markdown 渲染、代码高亮、图片显示
- 全局 AI 规则注入（Windsurf）
- 侧边栏控制面板
- 使用统计和日志管理
- 配置导出/导入功能
- 快捷键支持
