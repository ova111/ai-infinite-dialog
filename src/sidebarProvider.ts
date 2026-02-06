import * as vscode from 'vscode';
import * as http from 'http';
import { StatsManager } from './statsManager';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'ai-dialog.settingsView';
    private _view?: vscode.WebviewView;
    private _statusCheckInterval?: NodeJS.Timeout;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    private async _exportConfig() {
        const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
        const exportData = {
            version: '1.0.0',
            settings: {
                autoStart: config.get('autoStart'),
                autoConfigureIDE: config.get('autoConfigureIDE'),
                autoInjectRules: config.get('autoInjectRules'),
                serverPort: config.get('serverPort'),
                targetIDE: config.get('targetIDE'),
                showNotifications: config.get('showNotifications', true)
            }
        };
        
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('ai-dialog-config.json'),
            filters: { 'JSON': ['json'] }
        });
        
        if (uri) {
            const fs = require('fs');
            fs.writeFileSync(uri.fsPath, JSON.stringify(exportData, null, 2));
            vscode.window.showInformationMessage('配置已导出');
        }
    }

    private async _importConfig() {
        const uri = await vscode.window.showOpenDialog({
            filters: { 'JSON': ['json'] },
            canSelectMany: false
        });
        
        if (uri && uri[0]) {
            try {
                const fs = require('fs');
                const content = fs.readFileSync(uri[0].fsPath, 'utf-8');
                const data = JSON.parse(content);
                
                if (data.settings) {
                    const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
                    for (const [key, value] of Object.entries(data.settings)) {
                        await config.update(key, value, vscode.ConfigurationTarget.Global);
                    }
                    vscode.window.showInformationMessage('配置已导入');
                    this._sendCurrentSettings();
                }
            } catch (error) {
                vscode.window.showErrorMessage('导入失败: 无效的配置文件');
            }
        }
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'saveSettings':
                    await this._saveSettings(message.settings);
                    break;
                case 'getSettings':
                    this._sendCurrentSettings();
                    break;
                case 'getStatus':
                    await this._sendStatus();
                    break;
                case 'startServer':
                    await vscode.commands.executeCommand('ai-infinite-dialog.startServer');
                    setTimeout(() => this._sendStatus(), 500);
                    break;
                case 'stopServer':
                    await vscode.commands.executeCommand('ai-infinite-dialog.stopServer');
                    setTimeout(() => this._sendStatus(), 500);
                    break;
                case 'restartServer':
                    await vscode.commands.executeCommand('ai-infinite-dialog.stopServer');
                    await new Promise(resolve => setTimeout(resolve, 300));
                    await vscode.commands.executeCommand('ai-infinite-dialog.startServer');
                    setTimeout(() => this._sendStatus(), 500);
                    break;
                case 'configureIDE':
                    await vscode.commands.executeCommand('ai-infinite-dialog.configureIDE');
                    vscode.window.showInformationMessage('IDE 配置已更新！');
                    break;
                case 'injectRules':
                    await vscode.commands.executeCommand('ai-infinite-dialog.injectRules');
                    vscode.window.showInformationMessage('全局规则已注入！');
                    break;
                case 'editRules':
                    await vscode.commands.executeCommand('ai-infinite-dialog.editRules');
                    break;
                case 'viewLogs':
                    await vscode.commands.executeCommand('ai-infinite-dialog.viewLogs');
                    break;
                case 'exportConfig':
                    await this._exportConfig();
                    break;
                case 'importConfig':
                    await this._importConfig();
                    break;
                case 'getStats':
                    this._sendStats();
                    break;
                case 'resetStats':
                    StatsManager.getInstance().resetStats();
                    this._sendStats();
                    vscode.window.showInformationMessage('统计数据已重置');
                    break;
            }
        });

        // 初始化时发送设置和状态
        setTimeout(() => {
            this._sendCurrentSettings();
            this._sendStatus();
            this._sendStats();
        }, 100);

        // 定期检查状态
        this._statusCheckInterval = setInterval(() => {
            this._sendStatus();
        }, 5000);

        // 清理定时器
        webviewView.onDidDispose(() => {
            if (this._statusCheckInterval) {
                clearInterval(this._statusCheckInterval);
            }
        });
    }

    private _sendStats() {
        if (this._view) {
            const stats = StatsManager.getInstance().getStats();
            this._view.webview.postMessage({
                command: 'statsUpdate',
                stats: stats
            });
        }
    }

    private async _checkServerStatus(): Promise<{running: boolean, port: number | null}> {
        const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
        const basePort = config.get<number>('serverPort', 3456);
        
        for (let i = 0; i < 10; i++) {
            const port = basePort + i;
            try {
                const isRunning = await new Promise<boolean>((resolve) => {
                    const req = http.request({
                        hostname: '127.0.0.1',
                        port: port,
                        path: '/health',
                        method: 'GET',
                        timeout: 1000
                    }, (res) => {
                        let data = '';
                        res.on('data', (chunk) => data += chunk);
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
                
                if (isRunning) {
                    return { running: true, port };
                }
            } catch {
                continue;
            }
        }
        return { running: false, port: null };
    }

    private async _sendStatus() {
        if (this._view) {
            const status = await this._checkServerStatus();
            this._view.webview.postMessage({
                command: 'statusUpdate',
                status: status
            });
        }
    }

    private async _saveSettings(settings: any) {
        const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
        try {
            if (settings.autoStart !== undefined) {
                await config.update('autoStart', settings.autoStart, vscode.ConfigurationTarget.Global);
            }
            if (settings.autoConfigureIDE !== undefined) {
                await config.update('autoConfigureIDE', settings.autoConfigureIDE, vscode.ConfigurationTarget.Global);
            }
            if (settings.autoInjectRules !== undefined) {
                await config.update('autoInjectRules', settings.autoInjectRules, vscode.ConfigurationTarget.Global);
            }
            if (settings.serverPort !== undefined) {
                await config.update('serverPort', settings.serverPort, vscode.ConfigurationTarget.Global);
            }
            if (settings.targetIDE !== undefined) {
                await config.update('targetIDE', settings.targetIDE, vscode.ConfigurationTarget.Global);
            }
            vscode.window.showInformationMessage('设置已保存！');
            this._sendCurrentSettings();
        } catch (error) {
            vscode.window.showErrorMessage(`保存设置失败: ${error}`);
        }
    }

    private _sendCurrentSettings() {
        if (this._view) {
            const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
            this._view.webview.postMessage({
                command: 'settingsLoaded',
                settings: {
                    autoStart: config.get('autoStart', true),
                    autoConfigureIDE: config.get('autoConfigureIDE', true),
                    autoInjectRules: config.get('autoInjectRules', true),
                    serverPort: config.get('serverPort', 3456),
                    targetIDE: config.get('targetIDE', 'both')
                }
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>设置</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family);
            font-size: 13px;
            color: var(--vscode-foreground);
            padding: 0;
        }
        
        .section {
            padding: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .section:last-child { border-bottom: none; }
        
        .section-title {
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 10px;
        }
        
        .status-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 10px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            margin-bottom: 10px;
        }
        .status-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-testing-iconFailed);
        }
        .status-dot.running {
            background: var(--vscode-testing-iconPassed);
        }
        .status-text {
            font-size: 12px;
        }
        .status-port {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .btn-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-bottom: 6px;
        }
        .btn-row.three { grid-template-columns: 1fr 1fr 1fr; }
        .btn-row:last-child { margin-bottom: 0; }
        
        .btn {
            padding: 6px 10px;
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 2px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 12px;
            text-align: center;
        }
        .btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .btn.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn.primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .setting-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
        }
        .setting-label { 
            font-size: 13px;
            color: var(--vscode-foreground);
        }
        
        .checkbox-wrap {
            display: flex;
            align-items: center;
        }
        .checkbox-wrap input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: var(--vscode-button-background);
        }
        
        select, input[type="number"] {
            padding: 3px 6px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 12px;
            outline: none;
        }
        select:focus, input:focus {
            border-color: var(--vscode-focusBorder);
        }
        select { width: 90px; }
        input[type="number"] { width: 60px; text-align: center; }
        
        .save-section {
            padding: 12px;
        }
        .save-btn {
            width: 100%;
            padding: 6px 12px;
            border: none;
            border-radius: 2px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-size: 12px;
            cursor: pointer;
        }
        .save-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }
        .stat-item {
            text-align: center;
            padding: 8px 4px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
        }
        .stat-value {
            display: block;
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        .stat-label {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">状态</div>
        <div class="status-card">
            <div class="status-info">
                <div class="status-dot" id="statusDot"></div>
                <span class="status-text" id="statusText">检测中...</span>
            </div>
            <span class="status-port" id="statusPort"></span>
        </div>
        <div class="btn-row three">
            <button class="btn primary" onclick="startServer()">启动</button>
            <button class="btn" onclick="stopServer()">停止</button>
            <button class="btn" onclick="restartServer()">重启</button>
        </div>
    </div>

    <div class="section">
        <div class="section-title">工具</div>
        <div class="btn-row">
            <button class="btn" onclick="configureIDE()">配置 IDE</button>
            <button class="btn" onclick="injectRules()">注入规则</button>
        </div>
        <div class="btn-row">
            <button class="btn" onclick="editRules()">编辑规则</button>
            <button class="btn" onclick="viewLogs()">查看日志</button>
        </div>
        <div class="btn-row">
            <button class="btn" onclick="exportConfig()">导出配置</button>
            <button class="btn" onclick="importConfig()">导入配置</button>
        </div>
    </div>

    <div class="section">
        <div class="section-title">自动化</div>
        <div class="setting-row">
            <span class="setting-label">启动时运行服务</span>
            <div class="checkbox-wrap">
                <input type="checkbox" id="autoStart">
            </div>
        </div>
        <div class="setting-row">
            <span class="setting-label">自动配置 IDE</span>
            <div class="checkbox-wrap">
                <input type="checkbox" id="autoConfigureIDE">
            </div>
        </div>
        <div class="setting-row">
            <span class="setting-label">自动注入规则</span>
            <div class="checkbox-wrap">
                <input type="checkbox" id="autoInjectRules">
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">配置</div>
        <div class="setting-row">
            <span class="setting-label">端口</span>
            <input type="number" id="serverPort" min="1024" max="65535">
        </div>
        <div class="setting-row">
            <span class="setting-label">目标</span>
            <select id="targetIDE">
                <option value="windsurf">Windsurf</option>
            </select>
        </div>
    </div>

    <div class="section">
        <div class="section-title">统计</div>
        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-value" id="totalCalls">0</span>
                <span class="stat-label">总调用</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" id="continueCount">0</span>
                <span class="stat-label">继续</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" id="endCount">0</span>
                <span class="stat-label">结束</span>
            </div>
        </div>
        <button class="btn" style="width:100%;margin-top:8px;" onclick="resetStats()">重置统计</button>
    </div>

    <div class="save-section">
        <button class="save-btn" onclick="saveSettings()">保存</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ command: 'getSettings' });
        vscode.postMessage({ command: 'getStatus' });
        vscode.postMessage({ command: 'getStats' });
        
        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'settingsLoaded') {
                document.getElementById('autoStart').checked = msg.settings.autoStart;
                document.getElementById('autoConfigureIDE').checked = msg.settings.autoConfigureIDE;
                document.getElementById('autoInjectRules').checked = msg.settings.autoInjectRules;
                document.getElementById('serverPort').value = msg.settings.serverPort;
                document.getElementById('targetIDE').value = msg.settings.targetIDE;
            }
            if (msg.command === 'statusUpdate') {
                const dot = document.getElementById('statusDot');
                const text = document.getElementById('statusText');
                const port = document.getElementById('statusPort');
                if (msg.status.running) {
                    dot.classList.add('running');
                    text.textContent = '运行中';
                    port.textContent = ':' + msg.status.port;
                } else {
                    dot.classList.remove('running');
                    text.textContent = '已停止';
                    port.textContent = '';
                }
            }
            if (msg.command === 'statsUpdate') {
                document.getElementById('totalCalls').textContent = msg.stats.totalCalls;
                document.getElementById('continueCount').textContent = msg.stats.continueCount;
                document.getElementById('endCount').textContent = msg.stats.endCount;
            }
        });
        
        function saveSettings() {
            vscode.postMessage({
                command: 'saveSettings',
                settings: {
                    autoStart: document.getElementById('autoStart').checked,
                    autoConfigureIDE: document.getElementById('autoConfigureIDE').checked,
                    autoInjectRules: document.getElementById('autoInjectRules').checked,
                    serverPort: parseInt(document.getElementById('serverPort').value),
                    targetIDE: document.getElementById('targetIDE').value
                }
            });
        }
        function startServer() { vscode.postMessage({ command: 'startServer' }); }
        function stopServer() { vscode.postMessage({ command: 'stopServer' }); }
        function restartServer() { vscode.postMessage({ command: 'restartServer' }); }
        function configureIDE() { vscode.postMessage({ command: 'configureIDE' }); }
        function injectRules() { vscode.postMessage({ command: 'injectRules' }); }
        function editRules() { vscode.postMessage({ command: 'editRules' }); }
        function viewLogs() { vscode.postMessage({ command: 'viewLogs' }); }
        function exportConfig() { vscode.postMessage({ command: 'exportConfig' }); }
        function importConfig() { vscode.postMessage({ command: 'importConfig' }); }
        function resetStats() { vscode.postMessage({ command: 'resetStats' }); }
    </script>
</body>
</html>`;
    }
}
