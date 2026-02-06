import * as vscode from 'vscode';
import { FeedbackResponse, FeedbackRequestData, ImageData } from './mcpServer';

export class FeedbackPanel {
    private static panels: Map<string, FeedbackPanel> = new Map();
    public static readonly viewType = 'aiFeedbackPanel';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _requestId: string;
    private _disposables: vscode.Disposable[] = [];
    private _responseCallback: ((response: FeedbackResponse) => void) | null = null;
    private _responded: boolean = false;

    public static create(
        extensionUri: vscode.Uri, 
        data: FeedbackRequestData, 
        requestId: string,
        onResponse: (response: FeedbackResponse) => void
    ): FeedbackPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果该请求已有面板，更新它
        if (FeedbackPanel.panels.has(requestId)) {
            const existingPanel = FeedbackPanel.panels.get(requestId)!;
            existingPanel._panel.reveal(column);
            existingPanel.updateContent(data);
            existingPanel._responseCallback = onResponse;
            return existingPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            FeedbackPanel.viewType,
            'AI 反馈',
            column || vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri]
            }
        );

        const feedbackPanel = new FeedbackPanel(panel, extensionUri, data, requestId, onResponse);
        FeedbackPanel.panels.set(requestId, feedbackPanel);
        return feedbackPanel;
    }

    public static disposeAll() {
        FeedbackPanel.panels.forEach(panel => panel.dispose());
        FeedbackPanel.panels.clear();
    }

    private constructor(
        panel: vscode.WebviewPanel, 
        extensionUri: vscode.Uri, 
        data: FeedbackRequestData,
        requestId: string,
        onResponse: (response: FeedbackResponse) => void
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._requestId = requestId;
        this._responseCallback = onResponse;

        this._update(data);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'continue':
                        if (this._responded) return; // 防止重复响应
                        this._responded = true;
                        if (this._responseCallback) {
                            this._responseCallback({
                                action: 'continue',
                                message: message.text || '用户选择继续',
                                images: message.images || []
                            });
                        }
                        this._panel.dispose();
                        break;
                    case 'end':
                        if (this._responded) return; // 防止重复响应
                        this._responded = true;
                        if (this._responseCallback) {
                            this._responseCallback({
                                action: 'end',
                                message: '用户选择结束对话'
                            });
                        }
                        this._panel.dispose();
                        break;
                    case 'openLink':
                        // 处理链接点击，在外部浏览器中打开
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

    public updateContent(data: FeedbackRequestData) {
        this._update(data);
    }

    public dispose() {
        FeedbackPanel.panels.delete(this._requestId);

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(data: FeedbackRequestData) {
        const webview = this._panel.webview;
        this._panel.title = 'AI 反馈';
        this._panel.webview.html = this._getHtmlForWebview(webview, data);
    }

    private _getHtmlForWebview(webview: vscode.Webview, data: FeedbackRequestData): string {
        const { summary, images } = data;
        const escapedSummary = summary
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');
        
        const imagesJson = JSON.stringify(images || []);

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI 反馈</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/11.1.1/marked.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: var(--vscode-editor-background, #1e1e1e);
            color: var(--vscode-editor-foreground, #d4d4d4);
            padding: 20px;
            line-height: 1.6;
        }
        
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border, #404040);
        }
        
        .header-title {
            font-size: 14px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }
        
        .header-hint {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .content {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 16px;
            max-height: 50vh;
            overflow-y: auto;
        }
        
        .content h1, .content h2, .content h3 {
            margin-top: 20px;
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground, #3794ff);
        }
        
        .content h1:first-child, .content h2:first-child {
            margin-top: 0;
        }
        
        .content p {
            margin-bottom: 12px;
        }
        
        .content ul, .content ol {
            margin-left: 20px;
            margin-bottom: 12px;
        }
        
        .content li {
            margin-bottom: 6px;
        }
        
        .content pre {
            background: var(--vscode-textBlockQuote-background, #1e1e1e);
            border-radius: 4px;
            padding: 12px;
            overflow-x: auto;
            margin: 12px 0;
            position: relative;
        }
        
        .content code {
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 13px;
        }
        
        .content p code {
            background: var(--vscode-textBlockQuote-background, #1e1e1e);
            padding: 2px 6px;
            border-radius: 4px;
        }
        
        .content img {
            max-width: 100%;
            border-radius: 4px;
            margin: 12px 0;
            cursor: pointer;
        }
        
        .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: var(--vscode-button-secondaryBackground, #3a3a3a);
            color: var(--vscode-button-secondaryForeground, #fff);
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .content pre:hover .copy-btn {
            opacity: 1;
        }
        
        .copy-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, #505050);
        }
        
        .content a {
            color: var(--vscode-textLink-foreground, #3794ff);
            text-decoration: none;
        }
        
        .content a:hover {
            text-decoration: underline;
        }
        
        .content table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
        }
        
        .content th, .content td {
            border: 1px solid var(--vscode-panel-border, #404040);
            padding: 10px;
            text-align: left;
        }
        
        .content th {
            background: var(--vscode-textBlockQuote-background, #1e1e1e);
        }
        
        .content blockquote {
            border-left: 4px solid var(--vscode-textLink-foreground, #3794ff);
            padding-left: 15px;
            margin: 12px 0;
            color: var(--vscode-descriptionForeground, #8a8a8a);
        }
        
        .images-section {
            margin-bottom: 16px;
        }
        
        .images-section h4 {
            margin-bottom: 8px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
        }
        
        .images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
        }
        
        .image-item {
            position: relative;
            border-radius: 2px;
            overflow: hidden;
            background: var(--vscode-input-background);
            aspect-ratio: 1;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .image-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            cursor: pointer;
        }
        
        .image-item .remove-btn {
            position: absolute;
            top: 2px;
            right: 2px;
            width: 20px;
            height: 20px;
            border-radius: 2px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            opacity: 0;
        }
        
        .image-item:hover .remove-btn {
            opacity: 1;
        }
        
        .upload-area {
            border: 1px dashed var(--vscode-panel-border);
            border-radius: 2px;
            padding: 12px;
            text-align: center;
            cursor: pointer;
            margin-bottom: 12px;
        }
        
        .upload-area:hover, .upload-area.dragover {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-hoverBackground);
        }
        
        .upload-area input {
            display: none;
        }
        
        .upload-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 2px;
            font-size: 13px;
            cursor: pointer;
        }
        
        .btn-continue {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-continue:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .btn-end {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-end:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        .input-section {
            margin-bottom: 16px;
        }
        
        .input-section label {
            display: block;
            margin-bottom: 6px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
        }
        
        .input-section textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 13px;
            font-family: var(--vscode-font-family);
            resize: vertical;
            min-height: 60px;
        }
        
        .input-section textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .lightbox {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        
        .lightbox.active {
            display: flex;
        }
        
        .lightbox img {
            max-width: 90%;
            max-height: 90%;
            object-fit: contain;
        }
        
        .lightbox-close {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 30px;
            color: white;
            cursor: pointer;
        }

        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        
        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background, #424242);
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground, #4f4f4f);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-title">任务反馈</div>
            <div class="header-hint">Ctrl+Enter 继续 | Esc 结束</div>
        </div>
        
        <div class="content" id="content"></div>
        
        <div id="receivedImages" class="images-section" style="display: none;">
            <h4>附带图片</h4>
            <div class="images-grid" id="receivedImagesGrid"></div>
        </div>
        
        <div class="input-section">
            <label>追加指令（可选）</label>
            <textarea id="userInput" placeholder="输入后按 Ctrl+Enter 继续..."></textarea>
        </div>
        
        <div class="images-section">
            <div class="upload-area" id="uploadArea">
                <div class="upload-text">点击上传图片 或 Ctrl+V 粘贴</div>
                <input type="file" id="fileInput" accept="image/*" multiple>
            </div>
            <div class="images-grid" id="uploadedImagesGrid"></div>
        </div>
        
        <div class="actions">
            <button class="btn btn-end" onclick="handleEnd()">结束</button>
            <button class="btn btn-continue" onclick="handleContinue()">继续</button>
        </div>
    </div>
    
    <div class="lightbox" id="lightbox" onclick="closeLightbox()">
        <span class="lightbox-close">&times;</span>
        <img id="lightboxImg" src="" alt="">
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const uploadedImages = [];
        const receivedImages = ${imagesJson};
        
        // 渲染 Markdown 内容
        const summary = \`${escapedSummary}\`;
        const contentEl = document.getElementById('content');
        
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true,
            gfm: true
        });
        
        contentEl.innerHTML = marked.parse(summary);
        
        // 播放提示音
        function playNotificationSound() {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                
                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.3);
            } catch (e) {}
        }
        playNotificationSound();
        
        // 显示 AI 发送的图片
        if (receivedImages && receivedImages.length > 0) {
            document.getElementById('receivedImages').style.display = 'block';
            const grid = document.getElementById('receivedImagesGrid');
            receivedImages.forEach((img, index) => {
                const item = document.createElement('div');
                item.className = 'image-item';
                const imgEl = document.createElement('img');
                if (img.type === 'base64') {
                    imgEl.src = 'data:' + (img.mimeType || 'image/png') + ';base64,' + img.data;
                } else {
                    imgEl.src = img.data;
                }
                imgEl.onclick = () => openLightbox(imgEl.src);
                item.appendChild(imgEl);
                grid.appendChild(item);
            });
        }
        
        // 为代码块添加复制按钮
        document.querySelectorAll('pre code').forEach((block, index) => {
            const pre = block.parentElement;
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.textContent = '复制';
            btn.onclick = () => {
                navigator.clipboard.writeText(block.textContent);
                btn.textContent = '已复制!';
                setTimeout(() => btn.textContent = '复制', 2000);
            };
            pre.appendChild(btn);
        });
        
        // 处理链接点击
        document.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href) {
                    vscode.postMessage({ command: 'openLink', url: href });
                }
            });
        });
        
        // 图片上传处理
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        uploadArea.onclick = () => fileInput.click();
        
        uploadArea.ondragover = (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        };
        
        uploadArea.ondragleave = () => {
            uploadArea.classList.remove('dragover');
        };
        
        uploadArea.ondrop = (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        };
        
        fileInput.onchange = () => handleFiles(fileInput.files);
        
        function handleFiles(files) {
            Array.from(files).forEach(file => {
                if (!file.type.startsWith('image/')) return;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64 = e.target.result.split(',')[1];
                    const imageData = {
                        type: 'base64',
                        data: base64,
                        mimeType: file.type,
                        name: file.name
                    };
                    uploadedImages.push(imageData);
                    renderUploadedImages();
                };
                reader.readAsDataURL(file);
            });
        }
        
        function renderUploadedImages() {
            const grid = document.getElementById('uploadedImagesGrid');
            grid.innerHTML = '';
            uploadedImages.forEach((img, index) => {
                const item = document.createElement('div');
                item.className = 'image-item';
                
                const imgEl = document.createElement('img');
                imgEl.src = 'data:' + img.mimeType + ';base64,' + img.data;
                imgEl.onclick = () => openLightbox(imgEl.src);
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.innerHTML = '×';
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    uploadedImages.splice(index, 1);
                    renderUploadedImages();
                };
                
                item.appendChild(imgEl);
                item.appendChild(removeBtn);
                grid.appendChild(item);
            });
        }
        
        function openLightbox(src) {
            document.getElementById('lightboxImg').src = src;
            document.getElementById('lightbox').classList.add('active');
        }
        
        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
        }
        
        // 支持粘贴图片
        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    handleFiles([file]);
                }
            }
        });
        
        function handleContinue() {
            const text = document.getElementById('userInput').value.trim();
            console.log('上传的图片数量:', uploadedImages.length);
            console.log('图片数据:', uploadedImages);
            vscode.postMessage({ 
                command: 'continue', 
                text,
                images: uploadedImages
            });
        }
        
        function handleEnd() {
            vscode.postMessage({ command: 'end' });
        }
        
        // 快捷键支持
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleContinue();
            }
            if (e.key === 'Escape') {
                if (document.getElementById('lightbox').classList.contains('active')) {
                    closeLightbox();
                } else {
                    handleEnd();
                }
            }
        });
    </script>
</body>
</html>`;
    }
}
