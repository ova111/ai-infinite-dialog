import * as http from 'http';
import * as vscode from 'vscode';
import { LogManager } from './logManager';
import { StatsManager } from './statsManager';
import { t } from './i18n';

interface FeedbackRequest {
    id: string;
    summary: string;
    images: ImageData[];
    resolve: (response: FeedbackResponse) => void;
    timeoutId?: NodeJS.Timeout;
}

export interface ImageData {
    type: 'base64' | 'url';
    data: string;
    mimeType?: string;
    name?: string;
}

export interface FeedbackResponse {
    action: 'continue' | 'end';
    message?: string;
    images?: ImageData[];
}

export interface FeedbackRequestData {
    summary: string;
    images: ImageData[];
    requestId: string;
}

type FeedbackCallback = (data: FeedbackRequestData) => void;

export class MCPServer {
    private server: http.Server | null = null;
    private port: number;
    private actualPort: number = 0;
    private maxPortRetries: number = 10;
    private onFeedbackRequest: FeedbackCallback;
    private pendingRequests: Map<string, FeedbackRequest> = new Map();

    constructor(port: number, onFeedbackRequest: FeedbackCallback) {
        this.port = port;
        this.onFeedbackRequest = onFeedbackRequest;
    }

    /**
     * 获取实际使用的端口
     */
    getActualPort(): number {
        return this.actualPort;
    }

    async start(): Promise<number> {
        return this.tryStartOnPort(this.port, 0);
    }

    private async tryStartOnPort(port: number, attempt: number): Promise<number> {
        return new Promise((resolve, reject) => {
            if (attempt >= this.maxPortRetries) {
                reject(new Error(t('mcp.portNotFound', this.port, this.port + this.maxPortRetries - 1)));
                return;
            }

            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    // 端口被占用，尝试下一个端口
                    console.log(t('mcp.portInUse', port, port + 1));
                    this.server = null;
                    this.tryStartOnPort(port + 1, attempt + 1)
                        .then(resolve)
                        .catch(reject);
                } else {
                    reject(error);
                }
            });

            this.server.listen(port, '127.0.0.1', () => {
                this.actualPort = port;
                LogManager.getInstance().info(t('mcp.serverStarted', port));
                resolve(port);
            });
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        // 设置 CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);

        if (req.method === 'GET' && url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', service: 'ai-infinite-dialog' }));
            return;
        }

        if (req.method === 'GET' && url.pathname === '/mcp/tools') {
            // 返回可用工具列表
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                tools: [
                    {
                        name: 'infinite_dialog_feedback',
                        description: t('mcp.tool.description'),
                        inputSchema: {
                            type: 'object',
                            properties: {
                                summary: {
                                    type: 'string',
                                    description: t('mcp.tool.summaryDesc')
                                },
                                images: {
                                    type: 'array',
                                    description: t('mcp.tool.imagesDesc'),
                                    items: {
                                        type: 'object',
                                        properties: {
                                            type: {
                                                type: 'string',
                                                enum: ['base64', 'url'],
                                                description: t('mcp.tool.imageTypeDesc')
                                            },
                                            data: {
                                                type: 'string',
                                                description: t('mcp.tool.imageDataDesc')
                                            },
                                            mimeType: {
                                                type: 'string',
                                                description: t('mcp.tool.imageMimeDesc')
                                            },
                                            name: {
                                                type: 'string',
                                                description: t('mcp.tool.imageNameDesc')
                                            }
                                        },
                                        required: ['type', 'data']
                                    }
                                }
                            },
                            required: ['summary']
                        }
                    }
                ]
            }));
            return;
        }

        if (req.method === 'POST' && url.pathname === '/mcp/call') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    this.handleToolCall(data, res);
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }

        // 注：已移除 MCP JSON-RPC 端点，只保留简单的 HTTP 调用接口

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }

    private handleToolCall(data: any, res: http.ServerResponse) {
        const { tool, arguments: args } = data;
        const log = LogManager.getInstance();
        
        log.request(t('mcp.toolCall', tool), { args });

        if (tool === 'infinite_dialog_feedback') {
            const summary = args?.summary || t('mcp.defaultSummary');
            const images: ImageData[] = args?.images || [];
            const requestId = Date.now().toString();

            // 创建 Promise 等待用户响应
            const responsePromise = new Promise<FeedbackResponse>((resolve) => {
                // 设置超时定时器
                const timeoutId = setTimeout(() => {
                    if (this.pendingRequests.has(requestId)) {
                        this.pendingRequests.delete(requestId);
                        resolve({
                            action: 'continue',
                            message: t('mcp.timeout')
                        });
                    }
                }, 300000); // 5分钟超时

                this.pendingRequests.set(requestId, {
                    id: requestId,
                    summary,
                    images,
                    resolve,
                    timeoutId
                });

                // 触发反馈面板显示
                this.onFeedbackRequest({ summary, images, requestId });
            });

            // 等待用户响应
            responsePromise.then((response) => {
                // 清理超时定时器
                const request = this.pendingRequests.get(requestId);
                if (request?.timeoutId) {
                    clearTimeout(request.timeoutId);
                }
                this.pendingRequests.delete(requestId);

                const result: any = {
                    action: response.action,
                    message: response.action === 'continue' 
                        ? (response.message || t('mcp.userContinue'))
                        : t('mcp.userEnd')
                };
                
                // 添加用户上传的图片
                log.info(t('mcp.userImages', response.images?.length || 0));
                if (response.images && response.images.length > 0) {
                    result.images = response.images;
                    log.info(t('mcp.imagesAdded', response.images.length));
                }
                
                // 记录统计
                StatsManager.getInstance().recordCall(response.action as 'continue' | 'end');
                
                log.response(t('mcp.userResponse', response.action), result);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, result }));
            });

        } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unknown tool: ${tool}` }));
        }
    }

    sendFeedbackResponse(requestId: string, response: FeedbackResponse) {
        if (this.pendingRequests.has(requestId)) {
            const request = this.pendingRequests.get(requestId)!;
            request.resolve(response);
        }
    }

}
