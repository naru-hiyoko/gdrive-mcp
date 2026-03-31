import { gdrive_complete_auth_tool, gdrive_get_auth_url_tool, gdriveCompleteAuth, gdriveGetAuthUrl } from './gdriveAuth.js';
import { gdrive_file_download_tool, gdriveFileDownload } from './gdriveFileDownload.js';
import { gdrive_list_tool, gdriveList } from './gdriveList.js';
export const tools = [
    gdrive_get_auth_url_tool,
    gdrive_complete_auth_tool,
    gdrive_list_tool,
    gdrive_file_download_tool,
];
export const toolHandlers = {
    gdrive_get_auth_url: gdriveGetAuthUrl,
    gdrive_complete_auth: gdriveCompleteAuth,
    gdrive_list: gdriveList,
    gdrive_file_download: gdriveFileDownload,
};
