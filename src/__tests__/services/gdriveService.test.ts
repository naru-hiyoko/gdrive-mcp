import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import {
  buildOAuth2Client,
  getAuthenticatedClient,
  getAuthUrl,
  completeAuth,
  CREDENTIALS_PATH,
  TOKEN_PATH,
} from '../../services/gdriveService.js'

vi.mock('node:fs')

// vi.hoisted で googleapis モックより先に初期化し、constructor 内から参照できるようにする
const mockOAuth2Client = vi.hoisted(() => ({
  generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1'),
  setCredentials: vi.fn(),
  on: vi.fn(),
  getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'tok', refresh_token: 'ref' } }),
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      // arrow function は constructor として使えないため通常の function を使用する
      OAuth2: vi.fn(function (this: Record<string, unknown>) {
        Object.assign(this, mockOAuth2Client)
      }),
    },
    drive: vi.fn().mockReturnValue({}),
    sheets: vi.fn().mockReturnValue({}),
  },
}))

const MOCK_CREDENTIALS = JSON.stringify({
  installed: {
    client_id: 'test_client_id',
    client_secret: 'test_client_secret',
    redirect_uris: ['http://localhost'],
  },
})

const MOCK_TOKEN = JSON.stringify({
  access_token: 'test_access_token',
  refresh_token: 'test_refresh_token',
})

describe('gdriveService', () => {
  beforeEach(() => {
    // モックの戻り値・実装もリセットし、各テストで明示的にセットアップする
    vi.resetAllMocks()    // googleapis モックのメソッドをリセット後に再設定
    mockOAuth2Client.generateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=1')
    mockOAuth2Client.getToken.mockResolvedValue({ tokens: { access_token: 'tok', refresh_token: 'ref' } })  })

  describe('buildOAuth2Client', () => {
    it('credentials.json が存在しない場合にエラーをスロー', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      expect(() => buildOAuth2Client()).toThrow('credentials.json が見つかりません')
      expect(() => buildOAuth2Client()).toThrow(CREDENTIALS_PATH)
    })

    it('credentials.json が存在する場合に OAuth2Client を返す', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(MOCK_CREDENTIALS)
      const client = buildOAuth2Client()
      expect(client).toBeDefined()
    })

    it('credentials.json から client_id と client_secret を読み込む', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(MOCK_CREDENTIALS)
      buildOAuth2Client()
      expect(fs.readFileSync).toHaveBeenCalledWith(CREDENTIALS_PATH, 'utf8')
    })
  })

  describe('getAuthenticatedClient', () => {
    it('credentials.json が存在しない場合にエラーをスロー', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)
      expect(() => getAuthenticatedClient()).toThrow('credentials.json が見つかりません')
    })

    it('token.json が存在しない場合にエラーをスロー', () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(true)  // credentials.json
        .mockReturnValueOnce(false) // token.json
      vi.mocked(fs.readFileSync).mockReturnValue(MOCK_CREDENTIALS)
      // エラーメッセージに TOKEN_PATH が含まれることを確認
      expect(() => getAuthenticatedClient()).toThrow('token.json が見つかりません')
    })

    it('credentials と token が揃っている場合に OAuth2Client を返す', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(MOCK_CREDENTIALS)
        .mockReturnValueOnce(MOCK_TOKEN)
      const client = getAuthenticatedClient()
      expect(client).toBeDefined()
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: 'test_access_token' })
      )
    })

    it('token refresh イベントハンドラを登録する', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(MOCK_CREDENTIALS)
        .mockReturnValueOnce(MOCK_TOKEN)
      getAuthenticatedClient()
      expect(mockOAuth2Client.on).toHaveBeenCalledWith('tokens', expect.any(Function))
    })
  })

  describe('getAuthUrl', () => {
    it('認証 URL 文字列を返す', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(MOCK_CREDENTIALS)
      const url = getAuthUrl()
      expect(typeof url).toBe('string')
      expect(url).toContain('https://accounts.google.com')
    })
  })

  describe('completeAuth', () => {
    it('認証コードから token.json を保存して TOKEN_PATH を返す', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(MOCK_CREDENTIALS)
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)
      const result = await completeAuth('auth_code_123')
      expect(result).toBe(TOKEN_PATH)
      expect(fs.writeFileSync).toHaveBeenCalledOnce()
      expect(fs.writeFileSync).toHaveBeenCalledWith(TOKEN_PATH, expect.any(String))
    })

    it('リダイレクト URL から code を抽出して処理する', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(MOCK_CREDENTIALS)
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)
      const result = await completeAuth('http://localhost?code=extracted_code')
      expect(result).toBe(TOKEN_PATH)
      // getToken が "extracted_code" で呼ばれることを確認
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith('extracted_code')
    })

    it('code がないリダイレクト URL はそのまま code として使う', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(MOCK_CREDENTIALS)
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)
      const redirectUrl = 'http://localhost?state=test'
      await completeAuth(redirectUrl)
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(redirectUrl)
    })
  })
})
