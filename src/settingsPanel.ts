import * as vscode from 'vscode';
import { t, getHtmlLang } from './i18n';

export class SettingsPanel {
    private static currentPanel: SettingsPanel | undefined;
    public static readonly viewType = 'aiDialogSettings';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel._panel.reveal(column);
            SettingsPanel.currentPanel._update();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            SettingsPanel.viewType,
            t('settings.title'),
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
    }

    public static dispose() {
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.dispose();
        }
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'saveSettings':
                        await this._saveSettings(message.settings);
                        break;
                    case 'getSettings':
                        this._sendCurrentSettings();
                        break;
                    case 'startServer':
                        await vscode.commands.executeCommand('ai-infinite-dialog.startServer');
                        break;
                    case 'stopServer':
                        await vscode.commands.executeCommand('ai-infinite-dialog.stopServer');
                        break;
                    case 'configureIDE':
                        await vscode.commands.executeCommand('ai-infinite-dialog.configureIDE');
                        vscode.window.showInformationMessage(t('settings.ide.configured'));
                        break;
                    case 'injectRules':
                        await vscode.commands.executeCommand('ai-infinite-dialog.injectRules');
                        vscode.window.showInformationMessage(t('settings.rules.injected'));
                        break;
                    case 'openFile':
                        if (message.path) {
                            const uri = vscode.Uri.file(message.path);
                            await vscode.window.showTextDocument(uri);
                        }
                        break;
                    case 'openLink':
                        if (message.url) {
                            vscode.env.openExternal(vscode.Uri.parse(message.url));
                        }
                        break;
                }
            },
            null,
            this._disposables
        );
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
            if (settings.language !== undefined) {
                await config.update('language', settings.language, vscode.ConfigurationTarget.Global);
                // Reinitialize i18n with new language setting
                const { initI18n } = await import('./i18n');
                initI18n();
                // Refresh all webviews
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
            
            vscode.window.showInformationMessage(t('settings.saved'));
            this._sendCurrentSettings();
        } catch (error) {
            vscode.window.showErrorMessage(t('settings.saveFailed', String(error)));
        }
    }

    private _sendCurrentSettings() {
        const config = vscode.workspace.getConfiguration('ai-infinite-dialog');
        this._panel.webview.postMessage({
            command: 'settingsLoaded',
            settings: {
                autoStart: config.get('autoStart', true),
                autoConfigureIDE: config.get('autoConfigureIDE', true),
                autoInjectRules: config.get('autoInjectRules', true),
                serverPort: config.get('serverPort', 3456),
                targetIDE: config.get('targetIDE', 'windsurf'),
                language: config.get('language', 'auto')
            }
        });
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
        setTimeout(() => this._sendCurrentSettings(), 100);
    }

    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html lang="${getHtmlLang()}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('settings.html.title')}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-editor-foreground, #d4d4d4);
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border, #404040);
        }
        
        .header-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        
        .header-text h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        
        .header-text p {
            font-size: 14px;
            color: var(--vscode-descriptionForeground, #8a8a8a);
        }
        
        .section {
            background: var(--vscode-input-background, #2d2d2d);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .section-title span {
            font-size: 18px;
        }
        
        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid var(--vscode-panel-border, #404040);
        }
        
        .setting-item:last-child {
            border-bottom: none;
        }
        
        .setting-info {
            flex: 1;
        }
        
        .setting-label {
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .setting-desc {
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #8a8a8a);
        }
        
        .setting-control {
            margin-left: 20px;
        }
        
        /* Toggle Switch */
        .toggle {
            position: relative;
            width: 44px;
            height: 24px;
        }
        
        .toggle input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--vscode-input-background, #3c3c3c);
            border: 1px solid var(--vscode-input-border, #505050);
            transition: 0.3s;
            border-radius: 24px;
        }
        
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: 0.3s;
            border-radius: 50%;
        }
        
        .toggle input:checked + .toggle-slider {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-color: transparent;
        }
        
        .toggle input:checked + .toggle-slider:before {
            transform: translateX(20px);
        }
        
        /* Select */
        select {
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border, #505050);
            border-radius: 6px;
            background: var(--vscode-input-background, #3c3c3c);
            color: var(--vscode-input-foreground, #d4d4d4);
            font-size: 14px;
            cursor: pointer;
            min-width: 140px;
        }
        
        select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder, #667eea);
        }
        
        /* Input */
        input[type="number"] {
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border, #505050);
            border-radius: 6px;
            background: var(--vscode-input-background, #3c3c3c);
            color: var(--vscode-input-foreground, #d4d4d4);
            font-size: 14px;
            width: 100px;
        }
        
        input[type="number"]:focus {
            outline: none;
            border-color: var(--vscode-focusBorder, #667eea);
        }
        
        /* Buttons */
        .btn-group {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground, #3a3a3a);
            color: var(--vscode-button-secondaryForeground, #fff);
        }
        
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground, #505050);
        }
        
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        
        .btn-danger:hover {
            background: #c82333;
        }
        
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .status-running {
            background: rgba(40, 167, 69, 0.2);
            color: #28a745;
        }
        
        .status-stopped {
            background: rgba(220, 53, 69, 0.2);
            color: #dc3545;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border, #404040);
            text-align: center;
            color: var(--vscode-descriptionForeground, #8a8a8a);
            font-size: 12px;
        }
        
        .footer a {
            color: var(--vscode-textLink-foreground, #3794ff);
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }

        .actions-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }

        .action-card {
            background: var(--vscode-input-background, #2d2d2d);
            border-radius: 10px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
        }

        .action-card:hover {
            border-color: var(--vscode-focusBorder, #667eea);
            transform: translateY(-2px);
        }

        .action-card-icon {
            font-size: 24px;
            margin-bottom: 10px;
        }

        .action-card-title {
            font-weight: 500;
            margin-bottom: 4px;
        }

        .action-card-desc {
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #8a8a8a);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-icon">⚡</div>
            <div class="header-text">
                <h1>AI Infinite Dialog</h1>
                <p>${t('settings.html.subtitle')}</p>
            </div>
        </div>

        <!-- 快捷操作 -->
        <div class="section">
            <div class="section-title"><span>🚀</span> ${t('settings.html.quickActions')}</div>
            <div class="actions-section">
                <div class="action-card" onclick="startServer()">
                    <div class="action-card-icon">▶️</div>
                    <div class="action-card-title">${t('settings.html.startServer')}</div>
                    <div class="action-card-desc">${t('settings.html.startServerDesc')}</div>
                </div>
                <div class="action-card" onclick="stopServer()">
                    <div class="action-card-icon">⏹️</div>
                    <div class="action-card-title">${t('settings.html.stopServer')}</div>
                    <div class="action-card-desc">${t('settings.html.stopServerDesc')}</div>
                </div>
                <div class="action-card" onclick="configureIDE()">
                    <div class="action-card-icon">⚙️</div>
                    <div class="action-card-title">${t('settings.html.configureIDE')}</div>
                    <div class="action-card-desc">${t('settings.html.configureIDEDesc')}</div>
                </div>
                <div class="action-card" onclick="injectRules()">
                    <div class="action-card-icon">📝</div>
                    <div class="action-card-title">${t('settings.html.injectRules')}</div>
                    <div class="action-card-desc">${t('settings.html.injectRulesDesc')}</div>
                </div>
            </div>
        </div>

        <!-- 自动化设置 -->
        <div class="section">
            <div class="section-title"><span>🤖</span> ${t('settings.html.automationSettings')}</div>
            
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-label">${t('settings.html.autoStart')}</div>
                    <div class="setting-desc">${t('settings.html.autoStartDesc')}</div>
                </div>
                <div class="setting-control">
                    <label class="toggle">
                        <input type="checkbox" id="autoStart" onchange="settingChanged()">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
            
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-label">${t('settings.html.autoConfigureIDE')}</div>
                    <div class="setting-desc">${t('settings.html.autoConfigureIDEDesc')}</div>
                </div>
                <div class="setting-control">
                    <label class="toggle">
                        <input type="checkbox" id="autoConfigureIDE" onchange="settingChanged()">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
            
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-label">${t('settings.html.autoInjectRules')}</div>
                    <div class="setting-desc">${t('settings.html.autoInjectRulesDesc')}</div>
                </div>
                <div class="setting-control">
                    <label class="toggle">
                        <input type="checkbox" id="autoInjectRules" onchange="settingChanged()">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>

        <!-- 服务配置 -->
        <div class="section">
            <div class="section-title"><span>🔧</span> ${t('settings.html.serviceConfig')}</div>
            
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-label">${t('settings.html.serverPort')}</div>
                    <div class="setting-desc">${t('settings.html.serverPortDesc')}</div>
                </div>
                <div class="setting-control">
                    <input type="number" id="serverPort" min="1024" max="65535" onchange="settingChanged()">
                </div>
            </div>
            
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-label">${t('settings.html.targetIDE')}</div>
                    <div class="setting-desc">${t('settings.html.targetIDEDesc')}</div>
                </div>
                <div class="setting-control">
                    <select id="targetIDE" onchange="settingChanged()">
                        <option value="windsurf">Windsurf</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- 语言设置 -->
        <div class="section">
            <div class="section-title"><span>🌐</span> ${t('settings.html.language')}</div>
            <div class="form-group">
                <label>${t('settings.html.languageDesc')}</label>
                <select id="language">
                    <option value="auto">${t('settings.html.language.auto')}</option>
                    <option value="en">${t('settings.html.language.en')}</option>
                    <option value="zh">${t('settings.html.language.zh')}</option>
                    <option value="fr">${t('settings.html.language.fr')}</option>
                    <option value="es">${t('settings.html.language.es')}</option>
                </select>
            </div>
        </div>

        <!-- 保存按钮 -->
        <div class="btn-group" style="justify-content: center; margin-top: 20px;">
            <button class="btn btn-primary" onclick="saveSettings()">
                <span>💾</span> ${t('settings.html.saveSettings')}
            </button>
        </div>

        <div class="footer">
            <p>AI Infinite Dialog v1.0.0 | <a href="#" onclick="openGitHub()">GitHub</a></p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // 请求加载当前设置
        vscode.postMessage({ command: 'getSettings' });
        
        // 接收设置数据
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'settingsLoaded') {
                const s = message.settings;
                document.getElementById('autoStart').checked = s.autoStart;
                document.getElementById('autoConfigureIDE').checked = s.autoConfigureIDE;
                document.getElementById('autoInjectRules').checked = s.autoInjectRules;
                document.getElementById('serverPort').value = s.serverPort;
                document.getElementById('targetIDE').value = s.targetIDE;
                document.getElementById('language').value = s.language;
            }
        });
        
        function settingChanged() {
            // 可以添加实时保存或标记为未保存
        }
        
        function saveSettings() {
            vscode.postMessage({
                command: 'saveSettings',
                settings: {
                    autoStart: document.getElementById('autoStart').checked,
                    autoConfigureIDE: document.getElementById('autoConfigureIDE').checked,
                    autoInjectRules: document.getElementById('autoInjectRules').checked,
                    serverPort: parseInt(document.getElementById('serverPort').value),
                    targetIDE: document.getElementById('targetIDE').value,
                    language: document.getElementById('language').value
                }
            });
        }
        
        function startServer() {
            vscode.postMessage({ command: 'startServer' });
        }
        
        function stopServer() {
            vscode.postMessage({ command: 'stopServer' });
        }
        
        function configureIDE() {
            vscode.postMessage({ command: 'configureIDE' });
        }
        
        function injectRules() {
            vscode.postMessage({ command: 'injectRules' });
        }
        
        function openGitHub() {
            vscode.postMessage({ command: 'openLink', url: 'https://github.com/ova111/ai-infinite-dialog' });
        }
    </script>
</body>
</html>`;
    }
}
