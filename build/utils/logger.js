// Stdio サーバーなので stdout は MCP プロトコルで使用される。
// すべてのログは stderr に出力する。
export const logger = {
    info: (msg, ...args) => {
        process.stderr.write(`[INFO] ${msg} ${args.length ? JSON.stringify(args) : ''}\n`);
    },
    warn: (msg, ...args) => {
        process.stderr.write(`[WARN] ${msg} ${args.length ? JSON.stringify(args) : ''}\n`);
    },
    error: (msg, ...args) => {
        process.stderr.write(`[ERROR] ${msg} ${args.length ? JSON.stringify(args) : ''}\n`);
    },
};
