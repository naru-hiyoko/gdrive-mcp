import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import { getAuthenticatedClient, getDriveClient, getSheetsClient } from '../services/gdriveService.js';
// Google Workspace ファイルのエクスポート形式
const EXPORT_MIME_MAP = {
    'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', ext: '.csv' },
    'application/vnd.google-apps.document': {
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext: '.docx',
    },
    'application/vnd.google-apps.presentation': {
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ext: '.pptx',
    },
};
export const gdrive_file_download_tool = {
    name: 'gdrive_file_download',
    description: 'Google Drive からファイルをダウンロードします。' +
        'Google スプレッドシート・ドキュメント・スライドは自動的に変換されます（CSV / DOCX / PPTX）。' +
        'スプレッドシートの特定シートを指定する場合は sheet_name を指定してください。',
    inputSchema: {
        type: 'object',
        properties: {
            file_id: {
                type: 'string',
                description: 'ダウンロードするファイルの ID。Google Drive の URL から取得できます: ' +
                    'https://docs.google.com/spreadsheets/d/<FILE_ID>/edit',
            },
            output_path: {
                type: 'string',
                description: '保存先のファイルパス（省略時はカレントディレクトリにファイル名で保存）。' +
                    '例: /tmp/output.csv',
            },
            sheet_name: {
                type: 'string',
                description: 'スプレッドシートの特定シートを指定する場合のシート名。省略時は先頭シートをエクスポートします。',
            },
        },
        required: ['file_id'],
    },
};
// 認証済みアクセストークン付きで URL からダウンロード（リダイレクト追跡）
function downloadUrl(url, accessToken, dest) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: { Authorization: `Bearer ${accessToken}` },
        };
        const req = https.get(options, (res) => {
            if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode)) {
                const location = res.headers.location;
                if (!location)
                    return reject(new Error('リダイレクト先 URL が見つかりません'));
                const redirectUrl = new URL(location, url);
                const sameHost = redirectUrl.hostname === parsedUrl.hostname;
                const next = sameHost ? downloadUrl(location, accessToken, dest) : downloadUrlNoAuth(location, dest);
                return next.then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const writeStream = fs.createWriteStream(dest);
            res.pipe(writeStream).on('finish', resolve).on('error', reject);
        });
        req.on('error', reject);
    });
}
// 認証なしでダウンロード（CDN リダイレクト先等）
function downloadUrlNoAuth(url, dest) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
            if (res.statusCode && [301, 302, 307, 308].includes(res.statusCode)) {
                const location = res.headers.location;
                if (!location)
                    return reject(new Error('リダイレクト先 URL が見つかりません'));
                return downloadUrlNoAuth(location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            const writeStream = fs.createWriteStream(dest);
            res.pipe(writeStream).on('finish', resolve).on('error', reject);
        })
            .on('error', reject);
    });
}
export async function gdriveFileDownload(args) {
    try {
        const { file_id, output_path, sheet_name } = args;
        const drive = getDriveClient();
        // ファイルのメタ情報取得
        const meta = await drive.files.get({
            fileId: file_id,
            fields: 'name, mimeType',
            supportsAllDrives: true,
        });
        const { name: rawName, mimeType: rawMimeType } = meta.data;
        const name = rawName ?? file_id;
        const mimeType = rawMimeType ?? '';
        const exportInfo = EXPORT_MIME_MAP[mimeType];
        const dest = output_path ?? (exportInfo ? name + exportInfo.ext : name);
        // 保存先ディレクトリが存在しない場合は作成
        const destDir = path.dirname(path.resolve(dest));
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        // スプレッドシートの特定シートを指定した場合
        if (sheet_name && mimeType === 'application/vnd.google-apps.spreadsheet') {
            const sheets = getSheetsClient();
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: file_id });
            const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === sheet_name);
            if (!sheet || sheet.properties?.sheetId === undefined) {
                throw new Error(`シート "${sheet_name}" が見つかりません`);
            }
            const gid = sheet.properties.sheetId;
            const exportUrl = `https://docs.google.com/spreadsheets/d/${file_id}/export?format=csv&gid=${gid}`;
            const auth = getAuthenticatedClient();
            const accessTokenResponse = await auth.getAccessToken();
            const accessToken = accessTokenResponse.token;
            if (!accessToken)
                throw new Error('アクセストークンが取得できませんでした');
            await downloadUrl(exportUrl, accessToken, dest);
        }
        else if (exportInfo) {
            // Google Workspace ファイルのエクスポート
            const res = await drive.files.export({ fileId: file_id, mimeType: exportInfo.mime }, { responseType: 'stream' });
            await new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(dest);
                res.data.pipe(writeStream).on('finish', resolve).on('error', reject);
            });
        }
        else {
            // バイナリファイルのダウンロード
            const res = await drive.files.get({ fileId: file_id, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
            await new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(dest);
                res.data.pipe(writeStream).on('finish', resolve).on('error', reject);
            });
        }
        const result = {
            fileId: file_id,
            fileName: name,
            mimeType,
            savedTo: path.resolve(dest),
        };
        return {
            content: [
                {
                    type: 'text',
                    text: `ダウンロード完了:\n` +
                        `  ファイル名: ${result.fileName}\n` +
                        `  MIMEタイプ: ${result.mimeType}\n` +
                        `  保存先: ${result.savedTo}\n\n` +
                        JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    catch (e) {
        const err = e;
        return {
            content: [{ type: 'text', text: `エラー: ${err.message}` }],
            isError: true,
        };
    }
}
