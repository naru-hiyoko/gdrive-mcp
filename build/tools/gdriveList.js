import { getDriveClient } from '../services/gdriveService.js';
export const gdrive_list_tool = {
    name: 'gdrive_list',
    description: 'Google Drive のフォルダ配下のファイル・サブフォルダを一覧表示します。' +
        'recursive を true にするとサブフォルダも再帰的に取得します。' +
        '結果には各アイテムの id, name, mimeType, size, modifiedTime が含まれます。',
    inputSchema: {
        type: 'object',
        properties: {
            folder_id: {
                type: 'string',
                description: '一覧を取得したいフォルダの ID。Google Drive の URL から取得できます: ' +
                    'https://drive.google.com/drive/folders/<FOLDER_ID>',
            },
            recursive: {
                type: 'boolean',
                description: 'true にするとサブフォルダも再帰的に取得します。デフォルトは false。',
            },
        },
        required: ['folder_id'],
    },
};
async function listFilesRecursive(drive, folderId, recursive, prefix) {
    const results = [];
    let pageToken = undefined;
    const baseParams = {
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        orderBy: 'folder,name',
        pageSize: 1000,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
    };
    do {
        const res = await drive.files.list({ ...baseParams, pageToken });
        const files = res.data.files ?? [];
        for (const file of files) {
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
            const info = {
                id: file.id ?? '',
                name: file.name ?? '',
                mimeType: file.mimeType ?? '',
                size: file.size ?? undefined,
                modifiedTime: file.modifiedTime ?? undefined,
                isFolder,
                path: prefix + (file.name ?? ''),
            };
            results.push(info);
            if (recursive && isFolder && file.id) {
                const children = await listFilesRecursive(drive, file.id, true, prefix + (file.name ?? '') + '/');
                results.push(...children);
            }
        }
        pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
    return results;
}
export async function gdriveList(args) {
    try {
        const { folder_id, recursive = false } = args;
        const drive = getDriveClient();
        // フォルダのメタ情報取得
        const meta = await drive.files.get({
            fileId: folder_id,
            fields: 'name',
            supportsAllDrives: true,
        });
        const folderName = meta.data.name ?? folder_id;
        const files = await listFilesRecursive(drive, folder_id, recursive, '');
        const result = {
            folder: folderName,
            folderId: folder_id,
            files,
        };
        const lines = [
            `フォルダ: ${folderName}  (${folder_id})`,
            '─'.repeat(80),
        ];
        for (const f of files) {
            const typeLabel = f.isFolder ? '[DIR]' : '     ';
            const modified = f.modifiedTime ? f.modifiedTime.slice(0, 16).replace('T', ' ') : '                ';
            const size = f.isFolder ? '       -' : String(f.size ?? 0).padStart(8);
            lines.push(`${typeLabel}  ${modified}  ${size}  ${f.path}  (${f.id})`);
        }
        lines.push('');
        lines.push(`合計: ${files.length} 件`);
        lines.push('');
        lines.push('--- JSON データ ---');
        lines.push(JSON.stringify(result, null, 2));
        return {
            content: [{ type: 'text', text: lines.join('\n') }],
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
