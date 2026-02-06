import * as vscode from 'vscode';

export class ConfigManager {
    constructor() {}

    async configureIDE(): Promise<void> {
        const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
        const port = config.get<number>('serverPort', 3456);
        await this.configureIDEWithPort(port);
    }

    async configureIDEWithPort(port: number): Promise<void> {
        // 当前使用 HTTP 服务模式，用户通过规则文件中的 curl 命令直接调用
        // 此方法保留用于未来扩展（如自动配置 MCP 等）
        console.log('HTTP 服务端口:', port);
    }
}
