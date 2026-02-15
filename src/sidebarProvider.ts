import * as vscode from 'vscode';
import * as http from 'http';
import { StatsManager } from './statsManager';
import { SkillManager } from './skillManager';
import { t, getHtmlLang } from './i18n';

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
            vscode.window.showInformationMessage(t('sidebar.config.exported'));
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
                    vscode.window.showInformationMessage(t('sidebar.config.imported'));
                    this._sendCurrentSettings();
                }
            } catch (error) {
                vscode.window.showErrorMessage(t('sidebar.config.importFailed'));
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
                    vscode.window.showInformationMessage(t('sidebar.ide.configured'));
                    break;
                case 'injectRules':
                    await vscode.commands.executeCommand('ai-infinite-dialog.injectRules');
                    vscode.window.showInformationMessage(t('sidebar.rules.injected'));
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
                    vscode.window.showInformationMessage(t('sidebar.stats.reset'));
                    break;
                case 'getSkills':
                    this._sendSkills();
                    break;
                case 'toggleSkill':
                    if (message.skillId) {
                        const sm = SkillManager.getInstance();
                        if (sm) {
                            await sm.toggleSkill(message.skillId);
                            this._sendSkills();
                            // 自动重新注入规则
                            await vscode.commands.executeCommand('ai-infinite-dialog.injectRules');
                        }
                    }
                    break;
                case 'importSkill':
                    {
                        const sm = SkillManager.getInstance();
                        if (sm) {
                            await sm.importSkill();
                            this._sendSkills();
                        }
                    }
                    break;
                case 'deleteSkill':
                    if (message.skillId) {
                        const sm = SkillManager.getInstance();
                        if (sm) {
                            const ok = await sm.deleteSkill(message.skillId);
                            if (ok) {
                                this._sendSkills();
                                await vscode.commands.executeCommand('ai-infinite-dialog.injectRules');
                            }
                        }
                    }
                    break;
                case 'editSkill':
                    if (message.filePath) {
                        try {
                            const doc = await vscode.workspace.openTextDocument(message.filePath);
                            await vscode.window.showTextDocument(doc);
                        } catch (e) {
                            vscode.window.showErrorMessage('Cannot open skill file');
                        }
                    }
                    break;
            }
        });

        // 初始化时发送设置和状态
        setTimeout(() => {
            this._sendCurrentSettings();
            this._sendStatus();
            this._sendStats();
            this._sendSkills();
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

    private _sendSkills() {
        if (this._view) {
            const sm = SkillManager.getInstance();
            if (sm) {
                this._view.webview.postMessage({
                    command: 'skillsUpdate',
                    skills: sm.getAllSkills()
                });
            }
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
            if (settings.language !== undefined) {
                const currentLang = config.get('language', 'auto');
                await config.update('language', settings.language, vscode.ConfigurationTarget.Global);
                if (settings.language !== currentLang) {
                    const { initI18n } = await import('./i18n');
                    initI18n();
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                    return;
                }
            }
            vscode.window.showInformationMessage(t('sidebar.settings.saved'));
            this._sendCurrentSettings();
        } catch (error) {
            vscode.window.showErrorMessage(t('sidebar.settings.saveFailed', String(error)));
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
                    targetIDE: config.get('targetIDE', 'windsurf'),
                    language: config.get('language', 'auto')
                }
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="${getHtmlLang()}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t('sidebar.html.title')}</title>
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
        
        .skill-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            margin-bottom: 4px;
            background: var(--vscode-editor-background);
        }
        .skill-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .skill-left {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
            min-width: 0;
        }
        .skill-left input[type="checkbox"] {
            width: 14px;
            height: 14px;
            accent-color: var(--vscode-button-background);
            flex-shrink: 0;
        }
        .skill-info {
            min-width: 0;
        }
        .skill-name {
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .skill-desc {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .skill-actions {
            display: flex;
            gap: 2px;
            flex-shrink: 0;
        }
        .skill-actions button {
            background: none;
            border: none;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
            padding: 2px 4px;
            font-size: 11px;
            border-radius: 2px;
        }
        .skill-actions button:hover {
            background: var(--vscode-toolbar-hoverBackground);
            color: var(--vscode-foreground);
        }
        .skill-badge {
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 2px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .skills-empty {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            padding: 8px;
        }
        
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
        <div class="section-title">${t('sidebar.html.status')}</div>
        <div class="status-card">
            <div class="status-info">
                <div class="status-dot" id="statusDot"></div>
                <span class="status-text" id="statusText">${t('sidebar.html.detecting')}</span>
            </div>
            <span class="status-port" id="statusPort"></span>
        </div>
        <div class="btn-row three">
            <button class="btn primary" onclick="startServer()">${t('sidebar.html.start')}</button>
            <button class="btn" onclick="stopServer()">${t('sidebar.html.stop')}</button>
            <button class="btn" onclick="restartServer()">${t('sidebar.html.restart')}</button>
        </div>
    </div>

    <div class="section">
        <div class="section-title">${t('sidebar.html.tools')}</div>
        <div class="btn-row">
            <button class="btn" onclick="configureIDE()">${t('sidebar.html.configureIDE')}</button>
            <button class="btn" onclick="injectRules()">${t('sidebar.html.injectRules')}</button>
        </div>
        <div class="btn-row">
            <button class="btn" onclick="editRules()">${t('sidebar.html.editRules')}</button>
            <button class="btn" onclick="viewLogs()">${t('sidebar.html.viewLogs')}</button>
        </div>
        <div class="btn-row">
            <button class="btn" onclick="exportConfig()">${t('sidebar.html.exportConfig')}</button>
            <button class="btn" onclick="importConfig()">${t('sidebar.html.importConfig')}</button>
        </div>
    </div>

    <div class="section">
        <div class="section-title">SKILLS</div>
        <div id="skillsList"></div>
        <div class="btn-row" style="margin-top:6px;">
            <button class="btn" onclick="importSkill()">Import</button>
        </div>
    </div>

    <div class="section">
        <div class="section-title">${t('sidebar.html.automation')}</div>
        <div class="setting-row">
            <span class="setting-label">${t('sidebar.html.autoStartService')}</span>
            <div class="checkbox-wrap">
                <input type="checkbox" id="autoStart">
            </div>
        </div>
        <div class="setting-row">
            <span class="setting-label">${t('sidebar.html.autoConfigureIDE')}</span>
            <div class="checkbox-wrap">
                <input type="checkbox" id="autoConfigureIDE">
            </div>
        </div>
        <div class="setting-row">
            <span class="setting-label">${t('sidebar.html.autoInjectRules')}</span>
            <div class="checkbox-wrap">
                <input type="checkbox" id="autoInjectRules">
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">${t('sidebar.html.configuration')}</div>
        <div class="setting-row">
            <span class="setting-label">${t('sidebar.html.port')}</span>
            <input type="number" id="serverPort" min="1024" max="65535">
        </div>
        <div class="setting-row">
            <span class="setting-label">${t('sidebar.html.target')}</span>
            <select id="targetIDE">
                <option value="windsurf">Windsurf</option>
            </select>
        </div>
        <div class="setting-row">
            <span class="setting-label">${t('settings.html.language')}</span>
            <select id="language">
                <option value="auto">${t('settings.html.language.auto')}</option>
                <option value="en">${t('settings.html.language.en')}</option>
                <option value="zh">${t('settings.html.language.zh')}</option>
                <option value="fr">${t('settings.html.language.fr')}</option>
                <option value="es">${t('settings.html.language.es')}</option>
            </select>
        </div>
    </div>

    <div class="section">
        <div class="section-title">${t('sidebar.html.statistics')}</div>
        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-value" id="totalCalls">0</span>
                <span class="stat-label">${t('sidebar.html.totalCalls')}</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" id="continueCount">0</span>
                <span class="stat-label">${t('sidebar.html.continue')}</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" id="endCount">0</span>
                <span class="stat-label">${t('sidebar.html.end')}</span>
            </div>
        </div>
        <button class="btn" style="width:100%;margin-top:8px;" onclick="resetStats()">${t('sidebar.html.resetStats')}</button>
    </div>

    <div class="save-section">
        <button class="save-btn" onclick="saveSettings()">${t('sidebar.html.save')}</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ command: 'getSettings' });
        vscode.postMessage({ command: 'getStatus' });
        vscode.postMessage({ command: 'getStats' });
        vscode.postMessage({ command: 'getSkills' });
        
        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'settingsLoaded') {
                document.getElementById('autoStart').checked = msg.settings.autoStart;
                document.getElementById('autoConfigureIDE').checked = msg.settings.autoConfigureIDE;
                document.getElementById('autoInjectRules').checked = msg.settings.autoInjectRules;
                document.getElementById('serverPort').value = msg.settings.serverPort;
                document.getElementById('targetIDE').value = msg.settings.targetIDE;
                if (msg.settings.language) {
                    document.getElementById('language').value = msg.settings.language;
                }
            }
            if (msg.command === 'statusUpdate') {
                const dot = document.getElementById('statusDot');
                const text = document.getElementById('statusText');
                const port = document.getElementById('statusPort');
                if (msg.status.running) {
                    dot.classList.add('running');
                    text.textContent = '${t('sidebar.html.running')}';
                    port.textContent = ':' + msg.status.port;
                } else {
                    dot.classList.remove('running');
                    text.textContent = '${t('sidebar.html.stopped')}';
                    port.textContent = '';
                }
            }
            if (msg.command === 'statsUpdate') {
                document.getElementById('totalCalls').textContent = msg.stats.totalCalls;
                document.getElementById('continueCount').textContent = msg.stats.continueCount;
                document.getElementById('endCount').textContent = msg.stats.endCount;
            }
            if (msg.command === 'skillsUpdate') {
                renderSkills(msg.skills);
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
                    targetIDE: document.getElementById('targetIDE').value,
                    language: document.getElementById('language').value
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
        function importSkill() { vscode.postMessage({ command: 'importSkill' }); }
        function toggleSkill(skillId) { vscode.postMessage({ command: 'toggleSkill', skillId }); }
        function deleteSkill(skillId) { vscode.postMessage({ command: 'deleteSkill', skillId }); }
        function editSkill(filePath) { vscode.postMessage({ command: 'editSkill', filePath }); }
        
        function renderSkills(skills) {
            const container = document.getElementById('skillsList');
            if (!skills || skills.length === 0) {
                container.innerHTML = '<div class="skills-empty">No skills available</div>';
                return;
            }
            container.innerHTML = skills.map(s => {
                const badge = s.isBuiltin ? '<span class="skill-badge">builtin</span>' : '';
                const deleteBtn = s.isBuiltin ? '' : '<button onclick="deleteSkill(\\''+s.id+'\\')">Del</button>';
                return '<div class="skill-item">' +
                    '<div class="skill-left">' +
                        '<input type="checkbox" ' + (s.active ? 'checked' : '') + ' onchange="toggleSkill(\\''+s.id+'\\')">' +
                        '<div class="skill-info">' +
                            '<div class="skill-name">' + s.name + ' ' + badge + '</div>' +
                            '<div class="skill-desc">' + s.description + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="skill-actions">' +
                        '<button onclick="editSkill(\\''+s.filePath.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'")+'\\')">Edit</button>' +
                        deleteBtn +
                    '</div>' +
                '</div>';
            }).join('');
        }
    </script>
</body>
</html>`;
    }
}
