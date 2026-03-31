import { CREDENTIALS_PATH, completeAuth, getAuthUrl } from '../services/gdriveService.js';
export const gdrive_get_auth_url_tool = {
    name: 'gdrive_get_auth_url',
    description: 'Google Drive の OAuth2 認証 URL を取得します。ブラウザでこの URL を開いて Google アカウントでログイン・許可し、' +
        'リダイレクト先の URL（または認証コード）を gdrive_complete_auth ツールに渡してください。' +
        `credentials.json のパス: ${CREDENTIALS_PATH}`,
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
};
export async function gdriveGetAuthUrl() {
    try {
        const url = getAuthUrl();
        return {
            content: [
                {
                    type: 'text',
                    text: `以下の URL をブラウザで開いて Google アカウントで認証してください:\n\n${url}\n\n` +
                        `認証後にリダイレクトされた URL（localhost:...）または認証コードを ` +
                        `gdrive_complete_auth ツールの code_or_redirect_url パラメータに渡してください。`,
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
export const gdrive_complete_auth_tool = {
    name: 'gdrive_complete_auth',
    description: '認証コードまたはリダイレクト URL を受け取り、Google Drive の token.json を保存します。' +
        '先に gdrive_get_auth_url ツールで認証 URL を取得し、ブラウザで認証を完了してください。',
    inputSchema: {
        type: 'object',
        properties: {
            code_or_redirect_url: {
                type: 'string',
                description: '認証後にリダイレクトされた URL（例: http://localhost:...?code=...）または認証コード文字列。',
            },
        },
        required: ['code_or_redirect_url'],
    },
};
export async function gdriveCompleteAuth(args) {
    try {
        const { code_or_redirect_url } = args;
        const savedPath = await completeAuth(code_or_redirect_url);
        return {
            content: [
                {
                    type: 'text',
                    text: `認証が完了しました。token.json を保存しました: ${savedPath}\n\n以後 gdrive_list / gdrive_file_download ツールが使用できます。`,
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
