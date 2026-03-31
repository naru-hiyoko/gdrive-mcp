import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gdriveFileDownload } from '../../tools/gdriveFileDownload.js'
import * as gdriveService from '../../services/gdriveService.js'

vi.mock('node:fs')
vi.mock('node:https')
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path')
  return {
    ...actual,
    dirname: vi.fn().mockReturnValue('/mock/dir'),
    resolve: vi.fn().mockImplementation((...args: string[]) => '/resolved/' + args.join('/')),
  }
})

vi.mock('../../services/gdriveService.js', () => ({
  getDriveClient: vi.fn(),
  getSheetsClient: vi.fn(),
  getAuthenticatedClient: vi.fn(),
}))

// finish イベントを即時発行するモック WriteStream を生成する
const createMockWriteStream = () => {
  const stream = new EventEmitter()
  const mockStream = Object.assign(stream, {
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'finish') setImmediate(handler)
      return mockStream
    }),
  })
  return mockStream
}

// pipe が WriteStream を返すモック ReadableStream を生成する
const createMockReadStream = (writeStream: ReturnType<typeof createMockWriteStream>) => ({
  pipe: vi.fn().mockReturnValue(writeStream),
})

describe('gdriveFileDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
  })

  describe('エラーハンドリング', () => {
    it('getDriveClient がエラーをスローした場合 isError: true を返す', async () => {
      vi.mocked(gdriveService.getDriveClient).mockImplementation(() => {
        throw new Error('認証が必要です')
      })
      const result = await gdriveFileDownload({ file_id: 'file123' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('エラー')
      expect(result.content[0].text).toContain('認証が必要です')
    })

    it('files.get がエラーをスローした場合 isError: true を返す', async () => {
      vi.mocked(gdriveService.getDriveClient).mockReturnValue({
        files: {
          get: vi.fn().mockRejectedValue(new Error('404 Not Found')),
          export: vi.fn(),
        },
      } as ReturnType<typeof gdriveService.getDriveClient>)
      const result = await gdriveFileDownload({ file_id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('404 Not Found')
    })

    it('シート名が見つからない場合 isError: true を返す', async () => {
      vi.mocked(gdriveService.getDriveClient).mockReturnValue({
        files: {
          get: vi.fn().mockResolvedValue({
            data: { name: 'Budget.xlsx', mimeType: 'application/vnd.google-apps.spreadsheet' },
          }),
          export: vi.fn(),
        },
      } as ReturnType<typeof gdriveService.getDriveClient>)
      vi.mocked(gdriveService.getSheetsClient).mockReturnValue({
        spreadsheets: {
          get: vi.fn().mockResolvedValue({
            data: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] },
          }),
        },
      } as ReturnType<typeof gdriveService.getSheetsClient>)
      const result = await gdriveFileDownload({
        file_id: 'sheet123',
        sheet_name: 'NonExistentSheet',
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('NonExistentSheet')
    })
  })

  describe('バイナリファイルダウンロード', () => {
    it('バイナリファイルをダウンロードして結果を返す', async () => {
      const writeStream = createMockWriteStream()
      const readStream = createMockReadStream(writeStream)

      vi.mocked(fs.createWriteStream).mockReturnValue(writeStream as unknown as fs.WriteStream)
      vi.mocked(gdriveService.getDriveClient).mockReturnValue({
        files: {
          get: vi.fn()
            .mockResolvedValueOnce({ data: { name: 'photo.png', mimeType: 'image/png' } })
            .mockResolvedValueOnce({ data: readStream }),
          export: vi.fn(),
        },
      } as ReturnType<typeof gdriveService.getDriveClient>)

      const result = await gdriveFileDownload({ file_id: 'img001', output_path: '/tmp/photo.png' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('ダウンロード完了')
      expect(result.content[0].text).toContain('photo.png')
    })
  })

  describe('Google Workspace ファイルエクスポート', () => {
    it('スプレッドシートを CSV にエクスポートする', async () => {
      const writeStream = createMockWriteStream()
      const readStream = createMockReadStream(writeStream)

      vi.mocked(fs.createWriteStream).mockReturnValue(writeStream as unknown as fs.WriteStream)
      vi.mocked(gdriveService.getDriveClient).mockReturnValue({
        files: {
          get: vi.fn().mockResolvedValue({
            data: {
              name: 'Budget',
              mimeType: 'application/vnd.google-apps.spreadsheet',
            },
          }),
          export: vi.fn().mockResolvedValue({ data: readStream }),
        },
      } as ReturnType<typeof gdriveService.getDriveClient>)

      const result = await gdriveFileDownload({ file_id: 'sheet001' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('ダウンロード完了')
      expect(result.content[0].text).toContain('.csv')
    })

    it('ドキュメントを DOCX にエクスポートする', async () => {
      const writeStream = createMockWriteStream()
      const readStream = createMockReadStream(writeStream)

      vi.mocked(fs.createWriteStream).mockReturnValue(writeStream as unknown as fs.WriteStream)
      vi.mocked(gdriveService.getDriveClient).mockReturnValue({
        files: {
          get: vi.fn().mockResolvedValue({
            data: {
              name: 'Proposal',
              mimeType: 'application/vnd.google-apps.document',
            },
          }),
          export: vi.fn().mockResolvedValue({ data: readStream }),
        },
      } as ReturnType<typeof gdriveService.getDriveClient>)

      const result = await gdriveFileDownload({ file_id: 'doc001' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('ダウンロード完了')
      expect(result.content[0].text).toContain('.docx')
    })

    it('スライドを PPTX にエクスポートする', async () => {
      const writeStream = createMockWriteStream()
      const readStream = createMockReadStream(writeStream)

      vi.mocked(fs.createWriteStream).mockReturnValue(writeStream as unknown as fs.WriteStream)
      vi.mocked(gdriveService.getDriveClient).mockReturnValue({
        files: {
          get: vi.fn().mockResolvedValue({
            data: {
              name: 'Slides',
              mimeType: 'application/vnd.google-apps.presentation',
            },
          }),
          export: vi.fn().mockResolvedValue({ data: readStream }),
        },
      } as ReturnType<typeof gdriveService.getDriveClient>)

      const result = await gdriveFileDownload({ file_id: 'ppt001' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('.pptx')
    })

    it('export 時に適切な MIME タイプを指定する', async () => {
      const writeStream = createMockWriteStream()
      const readStream = createMockReadStream(writeStream)
      const exportMock = vi.fn().mockResolvedValue({ data: readStream })

      vi.mocked(fs.createWriteStream).mockReturnValue(writeStream as unknown as fs.WriteStream)
      vi.mocked(gdriveService.getDriveClient).mockReturnValue({
        files: {
          get: vi.fn().mockResolvedValue({
            data: { name: 'Budget', mimeType: 'application/vnd.google-apps.spreadsheet' },
          }),
          export: exportMock,
        },
      } as ReturnType<typeof gdriveService.getDriveClient>)

      await gdriveFileDownload({ file_id: 'sheet002' })
      expect(exportMock).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: 'text/csv' }),
        expect.any(Object)
      )
    })
  })

  describe('output_path オプション', () => {
    it('output_path を指定した場合はそのパスに保存する', async () => {
      const writeStream = createMockWriteStream()
      const readStream = createMockReadStream(writeStream)
      const createWriteStreamSpy = vi.mocked(fs.createWriteStream).mockReturnValue(
        writeStream as unknown as fs.WriteStream
      )

      vi.mocked(gdriveService.getDriveClient).mockReturnValue({
        files: {
          get: vi.fn()
            .mockResolvedValueOnce({ data: { name: 'file.bin', mimeType: 'application/octet-stream' } })
            .mockResolvedValueOnce({ data: readStream }),
          export: vi.fn(),
        },
      } as ReturnType<typeof gdriveService.getDriveClient>)

      await gdriveFileDownload({ file_id: 'bin001', output_path: '/custom/output.bin' })
      expect(createWriteStreamSpy).toHaveBeenCalledWith('/custom/output.bin')
    })
  })
})
