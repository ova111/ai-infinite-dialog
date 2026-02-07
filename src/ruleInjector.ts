import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { t } from './i18n';

export class RuleInjector {
    private homeDir: string;

    constructor() {
        this.homeDir = os.homedir();
    }

    async injectRules(): Promise<void> {
        await this.injectWindsurfRules();
    }

    private getGlobalRules(): string {
        const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
        const port = config.get<number>('serverPort', 3456);
        const bt = '`';  // backtick
        const tbt = '```';  // triple backtick
        
        const lines = [
            '# AI Infinite Dialog 全局规则',
            '',
            '【最高优先级规则 - 必须严格遵守】',
            '',
            '⚠️⚠️⚠️ 无论任何情况，每次回复结束前必须调用反馈接口！没有任何例外！⚠️⚠️⚠️',
            '',
            '## 核心规则：',
            '1. 完整输出：输出完整代码和答案，禁止使用省略号或"代码过长不展示"',
            '2. 先询问再执行：修改代码前必须先说明问题、提供方案、等待用户选择',
            '3. 结束确认：当你想结束对话或任务时，必须先调用反馈接口询问用户是否继续',
            '4. 严格遵守用户选择：当用户选择"结束对话"时，必须立即停止所有操作',
            '',
            '## ⚠️ 修改代码前的询问流程（重要）：',
            '在修改任何代码之前，必须先通过反馈接口询问用户：',
            '1. **说明问题**：清晰描述发现的问题或需要修改的内容',
            '2. **提供方案**：给出 2-3 个解决方案供用户选择',
            '3. **等待确认**：用户选择方案后，再执行具体修改',
            '4. **禁止直接修改**：未经用户同意，不要直接修改代码',
            '',
            '## 🔧 编程规范（必须遵守）：',
            '',
            '### 代码质量要求：',
            '- **完整可运行**：输出的代码必须完整、可直接运行，包含所有必要的 import/require',
            '- **遵循现有风格**：严格遵循项目现有的代码风格、命名规范、缩进方式',
            '- **不写无用代码**：禁止输出冗余逻辑、死代码、无意义的注释',
            '- **不引入 bug**：修改前必须理解上下文，确保不破坏现有功能',
            '- **保留注释**：不要删除或修改现有的注释和文档，除非用户明确要求',
            '',
            '### 错误处理与调试：',
            '- **先分析后修复**：遇到错误先分析根本原因，不要盲目尝试修改',
            '- **最小化修改**：优先用最小改动解决问题，避免过度重构',
            '- **说明验证方法**：修改后必须说明如何验证修复是否成功',
            '',
            '### 禁止事项：',
            '- ❌ 禁止输出语法错误的代码',
            '- ❌ 禁止遗漏必要的 import 语句',
            '- ❌ 禁止使用未定义的变量或函数',
            '- ❌ 禁止破坏现有的类型定义',
            '- ❌ 禁止删除用户没有要求删除的代码',
            '',
            '### 安全编码实践：',
            '- **不硬编码敏感信息**：API Key、密码、Token 等必须使用环境变量或配置文件',
            '- **输入验证**：对用户输入进行校验，防止注入攻击',
            '- **错误信息安全**：不在错误信息中暴露敏感的系统信息',
            '',
            '### 可维护性要求：',
            '- **单一职责**：每个函数/方法只做一件事，保持简洁',
            '- **有意义命名**：变量、函数、类名必须清晰表达其用途',
            '- **必要注释**：复杂逻辑、算法、业务规则需添加注释说明',
            '- **避免魔法数字**：使用常量代替硬编码的数字和字符串',
            '',
            '### 大改动处理：',
            '- **拆分步骤**：大改动必须拆分为多个小步骤，逐步执行',
            '- **说明影响**：每次修改前说明对其他模块的潜在影响',
            '- **可回滚**：确保每个步骤都可以独立验证和回滚',
            '',
            '### 代码审查思维：',
            '- **先读后写**：修改前先阅读相关代码上下文，理解现有逻辑',
            '- **边界情况**：考虑空值、异常、边界条件的处理',
            '- **复用优先**：检查是否有现有代码可以复用，避免重复造轮子',
            '- **一致性**：新代码风格必须与现有代码保持一致',
            '',
            '### 项目理解：',
            '- **技术栈感知**：先了解项目使用的框架和库，再给出建议',
            '- **遵循设计模式**：遵循项目已有的架构和设计模式',
            '- **谨慎引入依赖**：不随意引入新的第三方库，如需引入必须说明理由',
            '- **版本兼容**：确保代码与项目依赖版本兼容',
            '',
            '### 沟通与表达：',
            '- **方案对比**：多个方案时用表格对比优缺点',
            '- **图示说明**：复杂逻辑用流程图、伪代码或示意图辅助说明',
            '- **风险评估**：给出修改的预估工作量和潜在风险等级',
            '- **分步指引**：复杂操作提供清晰的分步执行指引',
            '',
            '## ⚠️ 输出位置规则（极其重要）：',
            '- **原生对话框**：只显示思考过程，不输出任何实质性内容',
            '- **AI反馈对话框**：所有回复内容、代码、说明、表格等必须放在summary参数中',
            '- 禁止在原生对话框输出详细文本、代码块、表格等内容',
            '- 原生对话框只能写一句简短说明，如"正在处理..."或"调用反馈接口"',
            '',
            '## 调用方式（HTTP 请求）：',
            '每次回复结束前，必须发送以下 HTTP 请求：',
            '',
            tbt + 'bash',
            'curl -X POST http://127.0.0.1:' + port + '/mcp/call \\\\',
            '  -H "Content-Type: application/json" \\\\',
            '  -d \'{"tool": "infinite_dialog_feedback", "arguments": {"summary": "你的完整回复内容"}}\'',
            tbt,
            '',
            '## 调用时机：',
            '- 完成用户请求后',
            '- 任务告一段落时',
            '- 需要用户确认是否继续时',
            '- 每次回复结束前',
            '',
            '## ⚠️ 调用后等待规则（极其重要）：',
            '- 发送HTTP请求时必须设置 Blocking: true，阻塞等待用户响应',
            '- **禁止**使用 command_status 检测状态',
            '- 这不是结束对话！用户会在反馈面板中响应，然后对话继续',
            '- 用户响应后会返回 action: continue 或 action: end',
            '',
            '## ⚠️ 接口调用失败重试规则：',
            '- 如果 HTTP 请求失败（超时、连接错误等），必须自动重试',
            '- 最多重试 3 次，每次间隔 2 秒',
            '- 3 次都失败后，在原生对话框提示用户检查插件服务是否运行',
            '',
            '## 参数说明：',
            '- summary：AI的完整回复内容（必填，支持 Markdown 格式）',
            '',
            '## 回复格式要求：',
            '- summary参数支持Markdown格式，包括：标题、代码块、链接、表格、粗体、列表等',
            '- 代码块会自动添加复制按钮，链接可点击打开浏览器',
            '',
            '## 调用示例：',
            tbt + 'json',
            '{',
            '  "tool": "infinite_dialog_feedback",',
            '  "arguments": {',
            '    "summary": "## 任务完成\\\\n\\\\n已完成以下工作：\\\\n- 功能A\\\\n- 功能B"',
            '  }',
            '}',
            tbt,
            '',
            '---',
            '*此文件由 AI Infinite Dialog 插件自动生成和管理*'
        ];
        return lines.join('\n');
    }

    private async injectWindsurfRules(): Promise<void> {
        const windsurfDir = path.join(this.homeDir, '.codeium', 'windsurf');
        const memoriesDir = path.join(windsurfDir, 'memories');
        
        await this.ensureDir(memoriesDir);

        const rules = this.getGlobalRules();

        // 写入 user_global.md - 这是 Windsurf 的全局用户规则文件
        const userGlobalFile = path.join(memoriesDir, 'user_global.md');
        fs.writeFileSync(userGlobalFile, rules, 'utf-8');
        console.log(t('extension.rules.injected'), userGlobalFile);

        // 同时写入 global_rules.md 作为备份
        const globalMemoryFile = path.join(memoriesDir, 'global_rules.md');
        fs.writeFileSync(globalMemoryFile, rules, 'utf-8');
    }


    private async ensureDir(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}
