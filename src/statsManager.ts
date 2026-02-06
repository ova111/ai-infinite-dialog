import * as vscode from 'vscode';

interface Stats {
    totalCalls: number;
    continueCount: number;
    endCount: number;
    timeoutCount: number;
    firstUse: string;
    lastUse: string;
}

export class StatsManager {
    private static instance: StatsManager;
    private context: vscode.ExtensionContext | null = null;
    private stats: Stats = {
        totalCalls: 0,
        continueCount: 0,
        endCount: 0,
        timeoutCount: 0,
        firstUse: '',
        lastUse: ''
    };

    private constructor() {}

    public static getInstance(): StatsManager {
        if (!StatsManager.instance) {
            StatsManager.instance = new StatsManager();
        }
        return StatsManager.instance;
    }

    public initialize(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadStats();
    }

    private loadStats() {
        if (this.context) {
            const saved = this.context.globalState.get<Stats>('ai-dialog-stats');
            if (saved) {
                this.stats = saved;
            }
        }
    }

    private saveStats() {
        if (this.context) {
            this.context.globalState.update('ai-dialog-stats', this.stats);
        }
    }

    public recordCall(action: 'continue' | 'end' | 'timeout') {
        const now = new Date().toISOString();
        
        this.stats.totalCalls++;
        this.stats.lastUse = now;
        
        if (!this.stats.firstUse) {
            this.stats.firstUse = now;
        }

        switch (action) {
            case 'continue':
                this.stats.continueCount++;
                break;
            case 'end':
                this.stats.endCount++;
                break;
            case 'timeout':
                this.stats.timeoutCount++;
                break;
        }

        this.saveStats();
    }

    public getStats(): Stats {
        return { ...this.stats };
    }

    public resetStats() {
        this.stats = {
            totalCalls: 0,
            continueCount: 0,
            endCount: 0,
            timeoutCount: 0,
            firstUse: '',
            lastUse: ''
        };
        this.saveStats();
    }
}
