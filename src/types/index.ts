export interface FileInfo {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  isFolder: boolean
  path: string
}

export interface GdriveListResult {
  folder: string
  folderId: string
  files: FileInfo[]
}

export interface GdriveDownloadResult {
  fileId: string
  fileName: string
  mimeType: string
  savedTo: string
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}
