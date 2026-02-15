import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { t } from './i18n';
import { SkillManager } from './skillManager';

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
            '# AI Infinite Dialog Global Rules',
            '',
            '【HIGHEST PRIORITY RULES - MUST BE STRICTLY FOLLOWED】',
            '',
            '⚠️⚠️⚠️ IN ANY CASE, EVERY RESPONSE MUST CALL THE FEEDBACK INTERFACE BEFORE ENDING! NO EXCEPTIONS! ⚠️⚠️⚠️',
            '',
            '## Core Rules:',
            '1. Complete Output: Output complete code and answers, do not use ellipsis or "code too long to display"',
            '2. Ask Before Execute: Before modifying code, must first explain the problem, provide solutions, wait for user choice',
            '3. End Confirmation: When you want to end the conversation or task, must first call feedback interface to ask user if they want to continue',
            '4. Strictly Follow User Choice: When user chooses "end conversation", must immediately stop all operations',
            '',
            '## ⚠️ Pre-modification Query Process (Important):',
            'Before modifying any code, must first ask user through feedback interface:',
            '1. **Explain Problem**: Clearly describe the discovered problem or content to be modified',
            '2. **Provide Solutions**: Give 2-3 solutions for user to choose from',
            '3. **Wait for Confirmation**: After user selects a solution, execute the specific modification',
            '4. **Prohibit Direct Modification**: Without user consent, do not directly modify code',
            '',
            '## 🔧 Programming Standards (Must Follow):',
            '',
            '### Code Quality Requirements:',
            '- **Complete and Runnable**: Output code must be complete and directly runnable, containing all necessary imports/requires',
            '- **Follow Existing Style**: Strictly follow existing code style, naming conventions, indentation methods',
            '- **Don\'t Write Useless Code**: Prohibit outputting redundant logic, dead code, meaningless comments',
            '- **Don\'t Introduce Bugs**: Before modifying, understand context, ensure not breaking existing functionality',
            '- **Keep Comments**: Do not delete or modify existing comments and documentation unless explicitly requested by user',
            '',
            '### Error Handling and Debugging:',
            '- **Analyze Before Fix**: When encountering errors, first analyze the root cause, don\'t blindly try to modify',
            '- **Minimal Modification**: Prioritize minimal changes to solve problems, avoid over-engineering',
            '- **Explain Verification Method**: After modification, explain how to verify the fix is successful',
            '',
            '### Prohibitions:',
            '- ❌ Prohibit outputting code with syntax errors',
            '- ❌ Prohibit omitting necessary import statements',
            '- ❌ Prohibit using undefined variables or functions',
            '- ❌ Prohibit breaking existing type definitions',
            '- ❌ Prohibit deleting code that user did not request to delete',
            '',
            '### Secure Coding Practices:',
            '- **Don\'t Hardcode Sensitive Information**: API Keys, passwords, tokens must use environment variables or configuration files',
            '- **Input Validation**: Validate user input to prevent injection attacks',
            '- **Error Message Security**: Do not expose sensitive system information in error messages',
            '',
            '### Maintainability Requirements:',
            '- **Single Responsibility**: Each function/method should do one thing, stay concise',
            '- **Meaningful Naming**: Variable, function, class names must clearly express their purpose',
            '- **Necessary Comments**: Complex logic, algorithms, business rules need explanatory comments',
            '- **Avoid Magic Numbers**: Use constants instead of hardcoded numbers and strings',
            '',
            '### Major Change Handling:',
            '- **Break into Steps**: Major changes must be broken into multiple small steps, executed progressively',
            '- **Explain Impact**: Before each modification, explain potential impact on other modules',
            '- **Rollbackable**: Ensure each step can be independently verified and rolled back',
            '',
            '### Code Review Mindset:',
            '- **Read Before Write**: Before modifying, first read relevant code context, understand existing logic',
            '- **Edge Cases**: Consider handling of null values, exceptions, boundary conditions',
            '- **Reuse Priority**: Check if existing code can be reused, avoid reinventing the wheel',
            '- **Consistency**: New code style must remain consistent with existing code',
            '',
            '### Project Understanding:',
            '- **Tech Stack Awareness**: First understand the frameworks and libraries used by the project, then give suggestions',
            '- **Follow Design Patterns**: Follow existing project architecture and design patterns',
            '- **Introduce Dependencies Carefully**: Do not casually introduce new third-party libraries, if needed, explain reasons',
            '- **Version Compatibility**: Ensure code is compatible with project dependency versions',
            '',
            '### Communication and Expression:',
            '- **Solution Comparison**: For multiple solutions, use tables to compare pros and cons',
            '- **Graphical Explanation**: For complex logic, use flowcharts, pseudocode, or diagrams to aid explanation',
            '- **Risk Assessment**: Provide work estimation and potential risk level for modifications',
            '- **Step-by-Step Instructions**: For complex operations, provide clear step-by-step instructions',
            '',
            '## ⚠️ Output Location Rules (Very Important):',
            '- **Native Dialog**: Only show thinking process, no substantive content',
            '- **AI Feedback Dialog**: All response content, code, explanations, tables must be placed in summary parameter',
            '- Prohibit outputting detailed text, code blocks, tables in native dialog',
            '- Native dialog can only write brief explanation, like "Processing..." or "Calling feedback interface"',
            '',
            '## Call Method (HTTP Request):',
            'Before ending each response, must send the following HTTP request:',
            '',
            tbt + 'bash',
            'curl -X POST http://127.0.0.1:' + port + '/mcp/call \\\\',
            '  -H "Content-Type: application/json" \\\\',
            '  -d \'{"tool": "infinite_dialog_feedback", "arguments": {"summary": "Your complete response content"}}\'',
            tbt,
            '',
            '## Call Timing:',
            '- After completing user request',
            '- When task reaches a milestone',
            '- When need to confirm if user wants to continue',
            '- Before ending each response',
            '',
            '## ⚠️ Post-Call Waiting Rules (Very Important):',
            '- When sending HTTP request, set Blocking: true, block waiting for user response',
            '- **Prohibit** using command_status to check status',
            '- This is not conversation end! User will respond in feedback panel, then conversation continues',
            '- After user response, will return action: continue or action: end',
            '',
            '## ⚠️ Interface Call Failure Retry Rules:',
            '- If HTTP request fails (timeout, connection error, etc.), automatically retry',
            '- Maximum 3 attempts, 2 seconds interval between each',
            '- After 3 failures, in native dialog, ask user to check if plugin service is running',
            '',
            '## ⚠️ Image Handling Rules (Important):',
            '- If the HTTP response contains "image_paths", user has uploaded images',
            '- You MUST use the read_file tool to view each image path to understand what the user is showing you',
            '- Example response with images: {"action":"continue","message":"...","image_paths":["/tmp/ai-dialog-images/img_xxx.png"],"image_hint":"..."}',
            '- After viewing images, incorporate the visual information into your response',
            '',
            '## Parameter Description:',
            '- summary: AI complete response content (required, supports Markdown format)',
            '',
            '## Response Format Requirements:',
            '- summary parameter supports Markdown format, including: headings, code blocks, links, tables, bold, lists, etc.',
            '- Code blocks will automatically add copy button, links are clickable to open browser',
            '',
            '## Call Example:',
            tbt + 'json',
            '{',
            '  "tool": "infinite_dialog_feedback",',
            '  "arguments": {',
            '    "summary": "## Task Completed\\\\n\\\\nCompleted the following work:\\\\n- Feature A\\\\n- Feature B"',
            '  }',
            '}',
            tbt,
            '',
            '---',
            '*This file is automatically generated and managed by AI Infinite Dialog plugin*'
        ];
        return lines.join('\n');
    }

    private async injectWindsurfRules(): Promise<void> {
        const windsurfDir = path.join(this.homeDir, '.codeium', 'windsurf');
        const memoriesDir = path.join(windsurfDir, 'memories');
        
        await this.ensureDir(memoriesDir);

        const rules = this.getGlobalRules();

        // 拼接激活的 Skills 内容
        const skillManager = SkillManager.getInstance();
        const skillsContent = skillManager ? skillManager.getActiveSkillsContent() : '';
        const fullRules = skillsContent ? rules + '\n' + skillsContent : rules;

        // 写入 user_global.md - 这是 Windsurf 的全局用户规则文件
        const userGlobalFile = path.join(memoriesDir, 'user_global.md');
        fs.writeFileSync(userGlobalFile, fullRules, 'utf-8');
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
