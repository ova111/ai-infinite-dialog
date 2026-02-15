import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface SkillMeta {
    id: string;
    name: string;
    description: string;
    icon: string;
    author: string;
    filePath: string;
    isBuiltin: boolean;
    active: boolean;
}

export class SkillManager {
    private static instance: SkillManager;
    private extensionPath: string;
    private customSkillsDir: string;
    private builtinSkillsDir: string;
    private activeSkillIds: Set<string>;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.extensionPath = context.extensionPath;
        this.builtinSkillsDir = path.join(this.extensionPath, 'skills', 'builtin');
        this.customSkillsDir = path.join(this.extensionPath, 'skills', 'custom');
        
        // 从全局状态恢复已激活的 Skills
        const saved = context.globalState.get<string[]>('activeSkills', []);
        this.activeSkillIds = new Set(saved);

        this.ensureDir(this.customSkillsDir);
    }

    static getInstance(context?: vscode.ExtensionContext): SkillManager {
        if (!SkillManager.instance && context) {
            SkillManager.instance = new SkillManager(context);
        }
        return SkillManager.instance;
    }

    /**
     * 获取所有 Skills（内置 + 自定义）
     */
    getAllSkills(): SkillMeta[] {
        const builtins = this.loadSkillsFromDir(this.builtinSkillsDir, true);
        const customs = this.loadSkillsFromDir(this.customSkillsDir, false);
        return [...builtins, ...customs];
    }

    /**
     * 获取当前激活的 Skills
     */
    getActiveSkills(): SkillMeta[] {
        return this.getAllSkills().filter(s => s.active);
    }

    /**
     * 切换 Skill 激活状态
     */
    async toggleSkill(skillId: string): Promise<void> {
        if (this.activeSkillIds.has(skillId)) {
            this.activeSkillIds.delete(skillId);
        } else {
            this.activeSkillIds.add(skillId);
        }
        await this.context.globalState.update('activeSkills', Array.from(this.activeSkillIds));
    }

    /**
     * 设置 Skill 激活状态
     */
    async setSkillActive(skillId: string, active: boolean): Promise<void> {
        if (active) {
            this.activeSkillIds.add(skillId);
        } else {
            this.activeSkillIds.delete(skillId);
        }
        await this.context.globalState.update('activeSkills', Array.from(this.activeSkillIds));
    }

    /**
     * 获取所有激活 Skills 的规则内容（用于注入 AI 规则）
     */
    getActiveSkillsContent(): string {
        const activeSkills = this.getActiveSkills();
        if (activeSkills.length === 0) {
            return '';
        }

        const sections: string[] = [
            '',
            '# Active Skills',
            ''
        ];

        for (const skill of activeSkills) {
            const content = this.readSkillContent(skill.filePath);
            if (content) {
                sections.push(`## Skill: ${skill.name}`);
                sections.push('');
                sections.push(content);
                sections.push('');
            }
        }

        return sections.join('\n');
    }

    /**
     * 创建自定义 Skill
     */
    async createSkill(name: string, description: string, content: string): Promise<SkillMeta | null> {
        const fileName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
        const filePath = path.join(this.customSkillsDir, fileName);

        if (fs.existsSync(filePath)) {
            vscode.window.showErrorMessage(`Skill file already exists: ${fileName}`);
            return null;
        }

        const fileContent = [
            '---',
            `name: ${name}`,
            `description: ${description}`,
            'icon: star',
            'author: custom',
            '---',
            '',
            content
        ].join('\n');

        fs.writeFileSync(filePath, fileContent, 'utf-8');

        return this.parseSkillFile(filePath, false);
    }

    /**
     * 删除自定义 Skill
     */
    async deleteSkill(skillId: string): Promise<boolean> {
        const skill = this.getAllSkills().find(s => s.id === skillId);
        if (!skill || skill.isBuiltin) {
            return false;
        }

        if (fs.existsSync(skill.filePath)) {
            fs.unlinkSync(skill.filePath);
            this.activeSkillIds.delete(skillId);
            await this.context.globalState.update('activeSkills', Array.from(this.activeSkillIds));
            return true;
        }
        return false;
    }

    /**
     * 导入 Skill 文件
     */
    async importSkill(): Promise<SkillMeta | null> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Markdown': ['md'] },
            title: 'Import Skill'
        });

        if (!uris || uris.length === 0) {
            return null;
        }

        const sourcePath = uris[0].fsPath;
        const fileName = path.basename(sourcePath);
        const destPath = path.join(this.customSkillsDir, fileName);

        if (fs.existsSync(destPath)) {
            const overwrite = await vscode.window.showWarningMessage(
                `Skill "${fileName}" already exists. Overwrite?`,
                'Yes', 'No'
            );
            if (overwrite !== 'Yes') {
                return null;
            }
        }

        fs.copyFileSync(sourcePath, destPath);
        return this.parseSkillFile(destPath, false);
    }

    /**
     * 导出 Skill 文件
     */
    async exportSkill(skillId: string): Promise<void> {
        const skill = this.getAllSkills().find(s => s.id === skillId);
        if (!skill) { return; }

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.basename(skill.filePath)),
            filters: { 'Markdown': ['md'] }
        });

        if (uri) {
            fs.copyFileSync(skill.filePath, uri.fsPath);
            vscode.window.showInformationMessage(`Skill exported to ${uri.fsPath}`);
        }
    }

    // ---- private helpers ----

    private loadSkillsFromDir(dir: string, isBuiltin: boolean): SkillMeta[] {
        if (!fs.existsSync(dir)) { return []; }

        const skills: SkillMeta[] = [];
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

        for (const file of files) {
            const filePath = path.join(dir, file);
            const skill = this.parseSkillFile(filePath, isBuiltin);
            if (skill) {
                skills.push(skill);
            }
        }

        return skills;
    }

    private parseSkillFile(filePath: string, isBuiltin: boolean): SkillMeta | null {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const frontMatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);

            if (!frontMatterMatch) { return null; }

            const meta: Record<string, string> = {};
            for (const line of frontMatterMatch[1].split('\n')) {
                const idx = line.indexOf(':');
                if (idx > 0) {
                    const key = line.slice(0, idx).trim();
                    const value = line.slice(idx + 1).trim();
                    meta[key] = value;
                }
            }

            const id = path.basename(filePath, '.md');

            return {
                id,
                name: meta['name'] || id,
                description: meta['description'] || '',
                icon: meta['icon'] || 'file',
                author: meta['author'] || 'unknown',
                filePath,
                isBuiltin,
                active: this.activeSkillIds.has(id)
            };
        } catch {
            return null;
        }
    }

    private readSkillContent(filePath: string): string | null {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            // 移除 front matter，只取内容部分
            const content = raw.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
            return content || null;
        } catch {
            return null;
        }
    }

    private ensureDir(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
