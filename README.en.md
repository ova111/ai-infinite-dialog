# AI Infinite Dialog

> **AI Infinite Dialog Feedback System** — Let AI proactively ask users whether to continue after completing a task, enabling true human-AI collaboration loops.

Built for **Windsurf** IDE.

🌐 **Language**: [中文](README.md) | **English** | [Français](README.fr.md) | [Español](README.es.md)

---

## Features

### Core Features
- **Infinite Dialog Loop**: AI automatically shows a feedback panel after completing a task, user chooses "Continue" or "End"
- **Global Rules Injection**: Automatically injects AI behavior rules into the IDE (coding standards, inquiry workflow, etc.)
- **HTTP Service**: Built-in lightweight HTTP service, AI calls the feedback interface via `curl`
- **Markdown Rendering**: Feedback panel fully supports Markdown, code highlighting, and image display

### Management Features
- Sidebar control panel (start/stop/restart service)
- Real-time service status display
- Usage statistics (call count, continue/end counts)
- Log viewer
- Configuration export/import

### Advanced Features
- Automatic port scanning (avoid conflicts)
- Custom rules editing
- Keyboard shortcuts

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    AI        │────▶│ HTTP Server │────▶│  Feedback    │
│ (Cascade)    │     │ (Port 3456) │     │  Panel       │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │           User feedback returns       │
       └───────────────────────────────────────┘
```

1. **AI calls tool**: After completing a task, AI calls `infinite_dialog_feedback` via HTTP
2. **Service handles request**: The extension's HTTP service receives the request and shows the feedback panel
3. **Display response**: WebView panel renders AI's Markdown response
4. **User makes choice**: User chooses "Continue" or "End conversation"
5. **Feedback returns to AI**: User's choice and additional instructions return to AI via HTTP response

## Installation

### Method 1: Install from VSIX (Recommended)

Download the latest `.vsix` file from the [Releases](https://github.com/ova111/ai-infinite-dialog/releases) page, then:

```bash
code --install-extension ai-infinite-dialog-x.x.x.vsix
```

Or in the IDE: `Ctrl+Shift+P` → `Install from VSIX...` → select the downloaded file.

### Method 2: Build from Source

```bash
git clone https://github.com/ova111/ai-infinite-dialog.git
cd ai-infinite-dialog
npm install
npm run package
# The .vsix file will be in the project root
```

### Method 3: Development Mode

```bash
git clone https://github.com/ova111/ai-infinite-dialog.git
cd ai-infinite-dialog
npm install
npm run watch
# Press F5 to start debugging
```

## Usage

### 1. Start the Extension

The extension automatically activates when the IDE starts and:
- Starts the HTTP service (default port 3456)
- Injects global AI rules
- Shows service status in the status bar

### 2. AI Auto-Call

When AI completes a task, it automatically calls the `infinite_dialog_feedback` tool, showing the feedback panel.

### 3. User Interaction

In the feedback panel:
- View AI's response (Markdown rendering + code highlighting)
- Enter additional instructions (optional)
- Upload/paste images (optional)
- Click "Continue" to continue the conversation, or "End" to stop

## Commands

| Command | Description |
|---------|-------------|
| `AI Dialog: Start MCP Server` | Manually start the HTTP service |
| `AI Dialog: Stop MCP Server` | Stop the HTTP service |
| `AI Dialog: Open Settings Panel` | Open settings panel |
| `AI Dialog: Configure IDE` | Reconfigure IDE |
| `AI Dialog: Inject Global Rules` | Re-inject AI rules |
| `AI Dialog: Edit Rules` | Edit AI rules file |
| `AI Dialog: View Logs` | Open log panel |
| `AI Dialog: Show Status` | View service status |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + D` | Open settings panel |
| `Cmd/Ctrl + Shift + S` | Start service (when not running) |
| `Ctrl/Cmd + Enter` | Continue conversation (in feedback panel) |
| `Escape` | End conversation (in feedback panel) |

## Configuration

Search for `ai-infinite-dialog` in IDE settings:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `autoStart` | boolean | `true` | Auto-start HTTP service on launch |
| `autoConfigureIDE` | boolean | `true` | Auto-configure IDE |
| `autoInjectRules` | boolean | `true` | Auto-inject global AI rules |
| `serverPort` | number | `3456` | HTTP service port |
| `targetIDE` | string | `"windsurf"` | Target IDE |
| `showNotifications` | boolean | `true` | Show notification messages |

## Project Structure

```
ai-infinite-dialog/
├── src/
│   ├── extension.ts        # Extension entry, activation/deactivation
│   ├── mcpServer.ts        # HTTP service, handles AI tool calls
│   ├── feedbackPanel.ts    # Feedback panel WebView
│   ├── ruleInjector.ts     # AI rules injection (Windsurf)
│   ├── configManager.ts    # IDE configuration management
│   ├── sidebarProvider.ts  # Sidebar settings panel
│   ├── settingsPanel.ts    # Standalone settings panel
│   ├── logManager.ts       # Log management
│   ├── statsManager.ts     # Usage statistics
│   └── i18n/               # Internationalization (zh, en, fr, es)
├── resources/
│   └── icon.svg            # Extension icon
├── package.json
├── tsconfig.json
├── LICENSE                 # MIT License
├── CHANGELOG.md
└── README.md
```

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode (auto-compile)
npm run watch

# Lint
npm run lint

# Package VSIX
npm run package
```

## Injected AI Rules

The extension automatically injects the following AI behavior rules:

- **Feedback interface call**: AI must call the feedback interface before each response ends
- **Ask before executing**: Explain the problem, provide solutions, and wait for user choice before modifying code
- **Coding standards**: Code quality, error handling, secure coding, maintainability, etc.
- **Failure retry**: Automatic retry 3 times on interface call failure

Rules file location: `~/.codeium/windsurf/memories/user_global.md`

## Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push branch: `git push origin feature/your-feature`
5. Submit a Pull Request

## License

[MIT](LICENSE) © 2024-2026 AI Infinite Dialog
