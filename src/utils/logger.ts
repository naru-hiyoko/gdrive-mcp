// Stdio サーバーなので stdout は MCP プロトコルで使用される。
// すべてのログは stderr に出力する。

export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    process.stderr.write(`[INFO] ${msg} ${args.length ? JSON.stringify(args) : ''}\n`)
  },
  warn: (msg: string, ...args: unknown[]) => {
    process.stderr.write(`[WARN] ${msg} ${args.length ? JSON.stringify(args) : ''}\n`)
  },
  error: (msg: string, ...args: unknown[]) => {
    process.stderr.write(`[ERROR] ${msg} ${args.length ? JSON.stringify(args) : ''}\n`)
  },
}
