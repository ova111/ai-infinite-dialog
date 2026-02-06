import * as vscode from 'vscode';

interface LogEntry {
    timestamp: Date;
    type: 'info' | 'request' | 'response' | 'error';
    message: string;
    data?: any;
}

export class LogManager {
    private static instance: LogManager;
    private logs: LogEntry[] = [];
    private maxLogs: number = 500;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AI Dialog');
    }

    public static getInstance(): LogManager {
        if (!LogManager.instance) {
            LogManager.instance = new LogManager();
        }
        return LogManager.instance;
    }

    public log(type: LogEntry['type'], message: string, data?: any) {
        const entry: LogEntry = {
            timestamp: new Date(),
            type,
            message,
            data
        };

        this.logs.push(entry);
        
        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // 输出到 Output Channel
        const timeStr = entry.timestamp.toLocaleTimeString();
        const typeStr = `[${type.toUpperCase()}]`;
        let logLine = `${timeStr} ${typeStr} ${message}`;
        if (data) {
            logLine += '\n' + JSON.stringify(data, null, 2);
        }
        this.outputChannel.appendLine(logLine);
    }

    public info(message: string, data?: any) {
        this.log('info', message, data);
    }

    public request(message: string, data?: any) {
        this.log('request', message, data);
    }

    public response(message: string, data?: any) {
        this.log('response', message, data);
    }

    public error(message: string, data?: any) {
        this.log('error', message, data);
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public clearLogs() {
        this.logs = [];
        this.outputChannel.clear();
    }

    public show() {
        this.outputChannel.show();
    }

    public dispose() {
        this.outputChannel.dispose();
    }
}
