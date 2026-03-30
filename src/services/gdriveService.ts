import type { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { logger } from '../utils/logger.js'

// 認証ファイルのデフォルトディレクトリ（既存スクリプトと同じ場所）
// 環境変数 CREDENTIALS_DIR が設定されている場合はそちらを優先する
export const CREDENTIALS_DIR = process.env.CREDENTIALS_DIR ?? path.join(os.homedir(), '.agent', 'gdrive')
export const CREDENTIALS_PATH = path.join(CREDENTIALS_DIR, 'credentials.json')
export const TOKEN_PATH = path.join(CREDENTIALS_DIR, 'token.json')

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

interface InstalledCredentials {
  client_id: string
  client_secret: string
  redirect_uris: string[]
}

interface CredentialsJson {
  installed: InstalledCredentials
}

interface Token {
  access_token?: string
  refresh_token?: string
  scope?: string
  token_type?: string
  expiry_date?: number
}

/**
 * credentials.json を読み込んで OAuth2Client を返す（トークン未設定）
 */
export function buildOAuth2Client(): OAuth2Client {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`credentials.json が見つかりません: ${CREDENTIALS_PATH}\n先に Google Cloud Console で OAuth2 クライアントを作成してください。`)
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')) as CredentialsJson
  const { client_id, client_secret, redirect_uris } = credentials.installed

  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
}

/**
 * 認証済みの OAuth2Client を返す。token.json が必要。
 * トークンが更新された場合は自動的に token.json を上書きする。
 */
export function getAuthenticatedClient(): OAuth2Client {
  const oAuth2Client = buildOAuth2Client()

  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(
      `token.json が見つかりません: ${TOKEN_PATH}\n` +
        `gdrive_get_auth_url ツールで認証 URL を取得し、gdrive_complete_auth ツールでトークンを保存してください。`
    )
  }

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) as Token
  oAuth2Client.setCredentials(token)

  // トークンがリフレッシュされたら token.json を更新
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oAuth2Client.on('tokens', (newTokens: any) => {
    const updated: Token = { ...token, ...newTokens }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2))
    logger.info('token.json を更新しました。')
  })

  return oAuth2Client
}

/**
 * 認証済みの Google Drive v3 クライアントを返す
 */
export function getDriveClient() {
  const auth = getAuthenticatedClient()
  return google.drive({ version: 'v3', auth })
}

/**
 * 認証済みの Google Sheets v4 クライアントを返す
 */
export function getSheetsClient() {
  const auth = getAuthenticatedClient()
  return google.sheets({ version: 'v4', auth })
}

/**
 * OAuth2 認証 URL を生成して返す
 */
export function getAuthUrl(): string {
  const oAuth2Client = buildOAuth2Client()
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  })
}

/**
 * リダイレクト URL またはコードを受け取り、token.json を保存する
 */
export async function completeAuth(codeOrRedirectUrl: string): Promise<string> {
  const oAuth2Client = buildOAuth2Client()

  let code = codeOrRedirectUrl
  if (codeOrRedirectUrl.startsWith('http')) {
    const url = new URL(codeOrRedirectUrl)
    code = url.searchParams.get('code') ?? codeOrRedirectUrl
  }

  const { tokens } = await oAuth2Client.getToken(code)
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2))
  logger.info(`token.json を保存しました: ${TOKEN_PATH}`)

  return TOKEN_PATH
}
