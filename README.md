# gdrive-download mcp tools

AI エージェント向けに gdrive 上のファイル一覧を取得・ファイルダウンロードする mcp tool を提供する。

## Tools

以下の4つの MCP ツールを提供する。

| ツール名 | 説明 |
|---|---|
| `gdrive_get_auth_url` | Google Drive の OAuth2 認証 URL を取得する |
| `gdrive_complete_auth` | 認証コードまたはリダイレクト URL を受け取り `token.json` を保存する |
| `gdrive_list` | 指定フォルダのファイル・サブフォルダを一覧表示する |
| `gdrive_file_download` | Google Drive からファイルをダウンロードする |

### gdrive_get_auth_url

`~/.copilot/scripts/gdrive/credentials.json` を読み込み、OAuth2 認証 URL を返す。
ブラウザで URL を開いてログイン・許可し、リダイレクト先 URL を `gdrive_complete_auth` に渡す。

### gdrive_complete_auth

引数:
- `code_or_redirect_url`: 認証後のリダイレクト URL（`http://localhost:...?code=...`）または認証コード

`~/.copilot/scripts/gdrive/token.json` にトークンを保存する。

### gdrive_list

引数:
- `folder_id`: フォルダ ID（Google Drive URL の末尾部分）
- `recursive` (省略可): `true` にするとサブフォルダを再帰的に取得する

### gdrive_file_download

引数:
- `file_id`: ファイル ID
- `output_path` (省略可): 保存先パス（省略時はカレントディレクトリにファイル名で保存）
- `sheet_name` (省略可): スプレッドシートの特定シート名

Google スプレッドシート → CSV、ドキュメント → DOCX、スライド → PPTX に自動変換する。

## 事前準備

1. [Google Cloud Console](https://console.cloud.google.com/) で OAuth2 クライアント（デスクトップアプリ）を作成する
2. `credentials.json` を `~/.copilot/scripts/gdrive/` に配置する
3. `gdrive_get_auth_url` → `gdrive_complete_auth` の順にツールを実行して認証する

## ファイルレイアウト

```
src/
├── index.ts                    # エントリポイント
├── server.ts                   # MCP サーバー生成・起動
├── types/
│   └── index.ts                # 型定義
├── utils/
│   └── logger.ts               # ロガー（stderr 出力）
├── services/
│   └── gdriveService.ts        # Google Drive 認証・クライアント管理
└── tools/
    ├── index.ts                # ツール定義・ハンドラのエクスポート
    ├── gdriveAuth.ts           # gdrive_get_auth_url / gdrive_complete_auth
    ├── gdriveList.ts           # gdrive_list
    └── gdriveFileDownload.ts   # gdrive_file_download
```

## ビルド・実行

```bash
npm install
npm run build

# Stdio で起動（MCP クライアントから使用）
node build/index.js

# MCP Inspector で動作確認
npm run inspector
```

## MCP 設定例（VS Code）

```json
{
  "mcp": {
    "servers": {
      "gdrive": {
        "type": "stdio",
        "command": "node",
        "args": ["/path/to/gdrive_download/build/index.js"]
      }
    }
  }
}
```
