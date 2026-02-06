import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { MCPServer, FeedbackRequestData } from './mcpServer';
import { ConfigManager } from './configManager';
import { RuleInjector } from './ruleInjector';
import { FeedbackPanel } from './feedbackPanel';
import { SettingsPanel } from './settingsPanel';
import { SidebarProvider } from './sidebarProvider';
import { LogManager } from './logManager';
import { StatsManager } from './statsManager';

let mcpServer: MCPServer | null = null;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
    console.log('AI Infinite Dialog 插件正在激活...');

    // 创建状态栏项 - 点击打开设置面板
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(sync~spin) AI Dialog';
    statusBarItem.tooltip = '点击打开 AI Dialog 设置面板';
    statusBarItem.command = 'ai-infinite-dialog.openSettings';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    // 初始化各个模块
    const configManager = new ConfigManager();
    const ruleInjector = new RuleInjector();
    
    // 初始化统计管理器
    StatsManager.getInstance().initialize(context);

    // 注册侧边栏视图
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );

    // 注册命令
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-infinite-dialog.openSettings', () => {
            SettingsPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-infinite-dialog.startServer', async () => {
            await startServer(context, configManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-infinite-dialog.stopServer', async () => {
            await stopServer();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-infinite-dialog.configureIDE', async () => {
            await configManager.configureIDE();
            vscode.window.showInformationMessage('IDE 配置已更新！');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-infinite-dialog.injectRules', async () => {
            await ruleInjector.injectRules();
            vscode.window.showInformationMessage('全局规则已注入！');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-infinite-dialog.showStatus', () => {
            showStatus();
        })
    );

    // 编辑规则命令
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-infinite-dialog.editRules', async () => {
            const homeDir = os.homedir();
            const rulesPath = path.join(homeDir, '.codeium', 'windsurf', 'memories', 'user_global.md');
            
            try {
                const doc = await vscode.workspace.openTextDocument(rulesPath);
                await vscode.window.showTextDocument(doc);
            } catch (error) {
                vscode.window.showErrorMessage(`无法打开规则文件: ${rulesPath}`);
            }
        })
    );

    // 查看日志命令
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-infinite-dialog.viewLogs', () => {
            LogManager.getInstance().show();
        })
    );

    // 获取配置
    const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
    const autoStart = config.get<boolean>('autoStart', true);
    const autoConfigureIDE = config.get<boolean>('autoConfigureIDE', true);
    const autoInjectRules = config.get<boolean>('autoInjectRules', true);

    // 自动执行
    if (autoStart) {
        await startServer(context, configManager);
    }

    if (autoConfigureIDE) {
        await configManager.configureIDE();
    }

    if (autoInjectRules) {
        await ruleInjector.injectRules();
    }

    vscode.window.showInformationMessage('AI Infinite Dialog 插件已激活！');
}

async function startServer(context: vscode.ExtensionContext, configManager?: ConfigManager) {
    if (mcpServer) {
        vscode.window.showWarningMessage('HTTP 服务已在运行中');
        return;
    }

    const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
    const port = config.get<number>('serverPort', 3456);

    // 先检查是否已有服务在运行
    const existingPort = await checkExistingServer(port);
    if (existingPort) {
        // 已有服务运行，直接复用
        statusBarItem.text = `$(check) AI Dialog :${existingPort} (共享)`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
        vscode.window.showInformationMessage(`检测到已有 AI Dialog 服务运行在端口 ${existingPort}，将复用该服务`);
        return;
    }

    mcpServer = new MCPServer(port, (data: FeedbackRequestData) => {
        // 当 AI 调用反馈工具时，显示反馈面板
        FeedbackPanel.create(context.extensionUri, data, data.requestId, (response) => {
            // 用户响应后的回调
            if (mcpServer) {
                mcpServer.sendFeedbackResponse(data.requestId, response);
            }
        });
    });

    try {
        const actualPort = await mcpServer.start();
        statusBarItem.text = `$(check) AI Dialog :${actualPort}`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
        
        // 如果端口发生变化，自动更新 IDE 配置
        if (actualPort !== port && configManager) {
            await configManager.configureIDEWithPort(actualPort);
            vscode.window.showInformationMessage(`HTTP 服务已启动，端口 ${port} 被占用，使用端口: ${actualPort}，已自动更新配置`);
        } else if (actualPort !== port) {
            vscode.window.showInformationMessage(`HTTP 服务已启动，端口 ${port} 被占用，使用端口: ${actualPort}`);
        } else {
            vscode.window.showInformationMessage(`HTTP 服务已启动，端口: ${actualPort}`);
        }
    } catch (error) {
        mcpServer = null;
        statusBarItem.text = '$(error) AI Dialog';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        statusBarItem.show();
        vscode.window.showErrorMessage(`HTTP 服务启动失败: ${error}`);
    }
}

// 检查是否已有服务在运行
async function checkExistingServer(basePort: number): Promise<number | null> {
    const http = require('http');
    
    for (let i = 0; i < 10; i++) {
        const port = basePort + i;
        try {
            const result = await new Promise<boolean>((resolve) => {
                const req = http.request({
                    hostname: '127.0.0.1',
                    port: port,
                    path: '/health',
                    method: 'GET',
                    timeout: 1000
                }, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: any) => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve(json.status === 'ok' && json.service === 'ai-infinite-dialog');
                        } catch {
                            resolve(false);
                        }
                    });
                });
                req.on('error', () => resolve(false));
                req.on('timeout', () => { req.destroy(); resolve(false); });
                req.end();
            });
            
            if (result) {
                return port;
            }
        } catch {
            continue;
        }
    }
    return null;
}

async function stopServer() {
    if (!mcpServer) {
        vscode.window.showWarningMessage('HTTP 服务未运行');
        return;
    }

    await mcpServer.stop();
    mcpServer = null;
    statusBarItem.text = '$(circle-slash) AI Dialog';
    statusBarItem.show();
    vscode.window.showInformationMessage('HTTP 服务已停止');
}

function showStatus() {
    const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
    const configPort = config.get<number>('serverPort', 3456);
    const running = mcpServer !== null;
    const actualPort = mcpServer ? mcpServer.getActualPort() : configPort;

    vscode.window.showInformationMessage(
        `AI Infinite Dialog 状态:\n` +
        `- 服务状态: ${running ? '运行中' : '已停止'}\n` +
        `- 端口: ${actualPort}${actualPort !== configPort ? ` (配置: ${configPort})` : ''}`,
        '启动服务', '停止服务', '配置 IDE', '注入规则'
    ).then(selection => {
        switch (selection) {
            case '启动服务':
                vscode.commands.executeCommand('ai-infinite-dialog.startServer');
                break;
            case '停止服务':
                vscode.commands.executeCommand('ai-infinite-dialog.stopServer');
                break;
            case '配置 IDE':
                vscode.commands.executeCommand('ai-infinite-dialog.configureIDE');
                break;
            case '注入规则':
                vscode.commands.executeCommand('ai-infinite-dialog.injectRules');
                break;
        }
    });
}

export function deactivate() {
    // 关闭所有反馈面板
    FeedbackPanel.disposeAll();
    
    // 释放日志管理器资源
    LogManager.getInstance().dispose();
    
    if (mcpServer) {
        mcpServer.stop();
        mcpServer = null;
    }
}
