import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { toolHandlers, tools } from './tools/index.js';
import { logger } from './utils/logger.js';
export function createServer() {
    const server = new Server({ name: 'gdrive-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });
    // ツール一覧を返す
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
    });
    // ツールを実行する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const handler = toolHandlers[name];
        if (!handler) {
            logger.error(`不明なツール: ${name}`);
            return {
                content: [{ type: 'text', text: `不明なツール: ${name}` }],
                isError: true,
            };
        }
        logger.info(`ツール実行: ${name}`);
        return handler(args);
    });
    return server;
}
