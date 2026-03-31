#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';
async function main() {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('gdrive-mcp サーバーが起動しました (Stdio トランスポート)');
}
main().catch((err) => {
    process.stderr.write(`[FATAL] ${err.message}\n`);
    process.exit(1);
});
