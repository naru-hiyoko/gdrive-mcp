import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gdriveList } from '../../tools/gdriveList.js'
import * as gdriveService from '../../services/gdriveService.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

const mockFiles = [
  {
    id: 'file001',
    name: 'report.pdf',
    mimeType: 'application/pdf',
    size: '20480',
    modifiedTime: '2024-03-01T12:00:00.000Z',
  },
  {
    id: 'folder001',
    name: 'images',
    mimeType: FOLDER_MIME,
    modifiedTime: '2024-02-15T08:00:00.000Z',
  },
]

const makeDriveMock = (files = mockFiles, folderName = 'TestFolder') => ({
  files: {
    list: vi.fn().mockResolvedValue({
      data: { files, nextPageToken: undefined },
    }),
    get: vi.fn().mockResolvedValue({
      data: { name: folderName },
    }),
  },
})

vi.mock('../../services/gdriveService.js', () => ({
  getDriveClient: vi.fn(),
}))

describe('gdriveList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(gdriveService.getDriveClient).mockReturnValue(makeDriveMock() as unknown as ReturnType<typeof gdriveService.getDriveClient>)
  })

  it('フォルダ名とファイル一覧を含むレスポンスを返す', async () => {
    const result = await gdriveList({ folder_id: 'folder_root' })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('TestFolder')
    expect(result.content[0].text).toContain('report.pdf')
    expect(result.content[0].text).toContain('images')
  })

  it('folder_id をフォルダ情報リクエストに使う', async () => {
    const drive = makeDriveMock()
    vi.mocked(gdriveService.getDriveClient).mockReturnValue(drive as unknown as ReturnType<typeof gdriveService.getDriveClient>)
    await gdriveList({ folder_id: 'specific_folder_id' })
    expect(drive.files.get).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'specific_folder_id' })
    )
  })

  it('JSON データブロックを含む', async () => {
    const result = await gdriveList({ folder_id: 'folder_root' })
    expect(result.content[0].text).toContain('--- JSON データ ---')
    expect(result.content[0].text).toContain('folder_root')
    expect(result.content[0].text).toContain('file001')
  })

  it('合計件数を表示する', async () => {
    const result = await gdriveList({ folder_id: 'folder_root' })
    expect(result.content[0].text).toContain(`合計: ${mockFiles.length} 件`)
  })

  it('空フォルダの場合も正常に動作する', async () => {
    vi.mocked(gdriveService.getDriveClient).mockReturnValue(
      makeDriveMock([], 'EmptyFolder') as unknown as ReturnType<typeof gdriveService.getDriveClient>
    )
    const result = await gdriveList({ folder_id: 'empty_folder' })
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('EmptyFolder')
    expect(result.content[0].text).toContain('合計: 0 件')
  })

  describe('recursive オプション', () => {
    it('recursive: false のとき subfolder の中は取得しない', async () => {
      const drive = makeDriveMock()
      vi.mocked(gdriveService.getDriveClient).mockReturnValue(drive as unknown as ReturnType<typeof gdriveService.getDriveClient>)
      await gdriveList({ folder_id: 'root', recursive: false })
      // files.list は 1 回だけ呼ばれる
      expect(drive.files.list).toHaveBeenCalledTimes(1)
    })

    it('recursive: true のときサブフォルダも再帰取得する', async () => {
      const drive = {
        files: {
          // 最初の呼び出し：ルートフォルダのファイル一覧（フォルダを含む）
          // 2回目以降の呼び出し：サブフォルダは空（無限再帰を防ぐ）
          list: vi.fn()
            .mockResolvedValueOnce({ data: { files: mockFiles, nextPageToken: undefined } })
            .mockResolvedValue({ data: { files: [], nextPageToken: undefined } }),
          get: vi.fn().mockResolvedValue({ data: { name: 'TestFolder' } }),
        },
      }
      vi.mocked(gdriveService.getDriveClient).mockReturnValue(drive as unknown as ReturnType<typeof gdriveService.getDriveClient>)
      await gdriveList({ folder_id: 'root', recursive: true })
      // folder001 の中を取得するため、list は 2 回呼ばれる（root + folder001）
      expect(drive.files.list).toHaveBeenCalledTimes(2)
    })
  })

  it('エラー時は isError: true を返す', async () => {
    vi.mocked(gdriveService.getDriveClient).mockImplementation(() => {
      throw new Error('authentication failed')
    })
    const result = await gdriveList({ folder_id: 'bad_folder' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('エラー')
    expect(result.content[0].text).toContain('authentication failed')
  })

  it('Drive API エラー時は isError: true を返す', async () => {
    const drive = makeDriveMock()
    drive.files.get = vi.fn().mockRejectedValue(new Error('403 Forbidden'))
    vi.mocked(gdriveService.getDriveClient).mockReturnValue(drive as unknown as ReturnType<typeof gdriveService.getDriveClient>)
    const result = await gdriveList({ folder_id: 'forbidden_folder' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('403 Forbidden')
  })
})
