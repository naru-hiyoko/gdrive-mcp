import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gdriveGetAuthUrl, gdriveCompleteAuth } from '../../tools/gdriveAuth.js'
import * as gdriveService from '../../services/gdriveService.js'

vi.mock('../../services/gdriveService.js', () => ({
  CREDENTIALS_PATH: '/test/.agent/gdrive/credentials.json',
  getAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1'),
  completeAuth: vi.fn().mockResolvedValue('/test/.agent/gdrive/token.json'),
}))

describe('gdriveAuth tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(gdriveService.getAuthUrl).mockReturnValue(
      'https://accounts.google.com/o/oauth2/auth?test=1'
    )
    vi.mocked(gdriveService.completeAuth).mockResolvedValue('/test/.agent/gdrive/token.json')
  })

  describe('gdriveGetAuthUrl', () => {
    it('認証 URL を含むレスポンスを返す', async () => {
      const result = await gdriveGetAuthUrl()
      expect(result.isError).toBeUndefined()
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain('https://accounts.google.com')
    })

    it('gdrive_complete_auth へのガイダンスを含む', async () => {
      const result = await gdriveGetAuthUrl()
      expect(result.content[0].text).toContain('gdrive_complete_auth')
    })

    it('エラー時は isError: true を返す', async () => {
      vi.mocked(gdriveService.getAuthUrl).mockImplementation(() => {
        throw new Error('credentials.json が見つかりません')
      })
      const result = await gdriveGetAuthUrl()
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('エラー')
      expect(result.content[0].text).toContain('credentials.json が見つかりません')
    })
  })

  describe('gdriveCompleteAuth', () => {
    it('認証完了メッセージとトークンパスを返す', async () => {
      const result = await gdriveCompleteAuth({ code_or_redirect_url: 'auth_code_123' })
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain('認証が完了しました')
      expect(result.content[0].text).toContain('/test/.agent/gdrive/token.json')
    })

    it('completeAuth を正しい引数で呼ぶ', async () => {
      await gdriveCompleteAuth({ code_or_redirect_url: 'test_code' })
      expect(gdriveService.completeAuth).toHaveBeenCalledWith('test_code')
    })

    it('エラー時は isError: true を返す', async () => {
      vi.mocked(gdriveService.completeAuth).mockRejectedValueOnce(
        new Error('invalid_grant: Authorization code not found')
      )
      const result = await gdriveCompleteAuth({ code_or_redirect_url: 'bad_code' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('エラー')
      expect(result.content[0].text).toContain('invalid_grant')
    })

    it('リダイレクト URL を渡した場合も動作する', async () => {
      const redirectUrl = 'http://localhost?code=real_code'
      const result = await gdriveCompleteAuth({ code_or_redirect_url: redirectUrl })
      expect(result.isError).toBeUndefined()
      expect(gdriveService.completeAuth).toHaveBeenCalledWith(redirectUrl)
    })
  })
})
