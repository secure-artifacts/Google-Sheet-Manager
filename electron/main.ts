import { app, BrowserWindow, ipcMain, shell, protocol } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import * as http from 'http'
import * as https from 'https'
import * as url from 'url'

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1'

// ─── Data directory ──────────────────────────────────────────────────────────
const DATA_DIR = join(homedir(), '.google-sheet-manager')
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

function dataPath(filename: string) {
  return join(DATA_DIR, filename)
}

function readJson<T>(filename: string, defaultVal: T): T {
  const p = dataPath(filename)
  if (!existsSync(p)) return defaultVal
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return defaultVal }
}

function writeJson(filename: string, data: unknown) {
  writeFileSync(dataPath(filename), JSON.stringify(data, null, 2), 'utf8')
}

// ─── Auth state ──────────────────────────────────────────────────────────────
interface AuthData {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  userEmail: string | null
  userName: string | null
  userPhoto: string | null
}

let authData: AuthData = readJson<AuthData>('auth.json', {
  accessToken: null, refreshToken: null, expiresAt: null,
  userEmail: null, userName: null, userPhoto: null
})

function saveAuth() { writeJson('auth.json', authData) }

// ─── OAuth Config ────────────────────────────────────────────────────────────
// Users must create their own Google OAuth app in Google Cloud Console
// and set CLIENT_ID / CLIENT_SECRET here or via environment variables
const OAUTH_CONFIG = {
  clientId: readJson<{ clientId: string; clientSecret: string }>('oauth_config.json', { clientId: '', clientSecret: '' }).clientId || '',
  clientSecret: readJson<{ clientId: string; clientSecret: string }>('oauth_config.json', { clientId: '', clientSecret: '' }).clientSecret || '',
  redirectUri: 'http://localhost:42813/oauth/callback',
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]
}

// ─── OAuth local server ───────────────────────────────────────────────────────
let oauthServer: http.Server | null = null
let oauthResolve: ((code: string) => void) | null = null

function startOAuthServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    oauthResolve = resolve
    oauthServer = http.createServer((req, res) => {
      const parsed = url.parse(req.url || '', true)
      if (parsed.pathname === '/oauth/callback') {
        const code = parsed.query.code as string
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f13;color:#fff">
            <div style="text-align:center">
              <h2>✅ 授权成功！</h2>
              <p>请关闭此窗口，返回应用。</p>
            </div>
          </body></html>`)
          oauthServer?.close()
          oauthResolve?.(code)
        } else {
          res.writeHead(400); res.end('Missing code')
          reject(new Error('No code in callback'))
        }
      } else {
        res.writeHead(404); res.end()
      }
    })
    oauthServer.listen(42813)
    oauthServer.on('error', reject)
  })
}

async function exchangeCodeForTokens(code: string) {
  const cfg = readJson<{ clientId: string; clientSecret: string }>('oauth_config.json', { clientId: '', clientSecret: '' })
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    grant_type: 'authorization_code'
  }).toString()

  return new Promise<{ access_token: string; refresh_token: string; expires_in: number }>((resolve, reject) => {
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('Failed to parse token response')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function refreshAccessToken() {
  const cfg = readJson<{ clientId: string; clientSecret: string }>('oauth_config.json', { clientId: '', clientSecret: '' })
  if (!authData.refreshToken) throw new Error('No refresh token')
  const body = new URLSearchParams({
    refresh_token: authData.refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token'
  }).toString()

  return new Promise<{ access_token: string; expires_in: number }>((resolve, reject) => {
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error('Failed to parse refresh response')) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function getValidToken(): Promise<string> {
  if (!authData.accessToken) throw new Error('Not authenticated')
  const now = Date.now()
  if (authData.expiresAt && now < authData.expiresAt - 60000) {
    return authData.accessToken
  }
  // Refresh
  const tokens = await refreshAccessToken()
  authData.accessToken = tokens.access_token
  authData.expiresAt = Date.now() + tokens.expires_in * 1000
  saveAuth()
  return authData.accessToken
}

// ─── API Helper ───────────────────────────────────────────────────────────────
function apiGet(path: string, token: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { reject(new Error(data)) }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function apiRequest(method: string, path: string, token: string, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined
    const options = {
      hostname: 'www.googleapis.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`API Error ${res.statusCode}: ${data}`))
          return
        }
        try {
          resolve(data ? JSON.parse(data) : {})
        } catch { resolve({}) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ─── Main Window ─────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: join(__dirname, '../public/icon.ico'),
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────
// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

// ── Auth
ipcMain.handle('auth:get-status', () => ({
  isAuthenticated: !!authData.accessToken,
  email: authData.userEmail,
  name: authData.userName,
  photo: authData.userPhoto
}))

ipcMain.handle('auth:get-oauth-config', () => {
  const cfg = readJson<{ clientId: string; clientSecret: string }>('oauth_config.json', { clientId: '', clientSecret: '' })
  return { hasConfig: !!(cfg.clientId && cfg.clientSecret), clientId: cfg.clientId }
})

ipcMain.handle('auth:save-oauth-config', (_e, config: { clientId: string; clientSecret: string }) => {
  writeJson('oauth_config.json', config)
  return { success: true }
})

ipcMain.handle('auth:login', async () => {
  const cfg = readJson<{ clientId: string; clientSecret: string }>('oauth_config.json', { clientId: '', clientSecret: '' })
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('请先在设置中配置 Google OAuth Client ID 和 Secret')
  }

  const codePromise = startOAuthServer()
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: 'code',
    scope: OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  }).toString()}`

  shell.openExternal(authUrl)
  const code = await codePromise
  const tokens = await exchangeCodeForTokens(code)

  authData.accessToken = tokens.access_token
  authData.refreshToken = tokens.refresh_token
  authData.expiresAt = Date.now() + tokens.expires_in * 1000

  // Fetch user info
  const userInfo = await apiGet('/oauth2/v2/userinfo', authData.accessToken) as { email: string; name: string; picture: string }
  authData.userEmail = userInfo.email
  authData.userName = userInfo.name
  authData.userPhoto = userInfo.picture
  saveAuth()

  return { email: authData.userEmail, name: authData.userName, photo: authData.userPhoto }
})

ipcMain.handle('auth:logout', () => {
  authData = { accessToken: null, refreshToken: null, expiresAt: null, userEmail: null, userName: null, userPhoto: null }
  saveAuth()
  return { success: true }
})

// ── Libraries
ipcMain.handle('libraries:get', () => readJson('libraries.json', { libraries: [] }))
ipcMain.handle('libraries:save', (_e, data: unknown) => { writeJson('libraries.json', data); return { success: true } })

// ── Permission Groups
ipcMain.handle('groups:get', () => readJson('permissionGroups.json', { groups: [] }))
ipcMain.handle('groups:save', (_e, data: unknown) => { writeJson('permissionGroups.json', data); return { success: true } })

// ── Logs
ipcMain.handle('logs:get', () => readJson('logs.json', { logs: [] }))
ipcMain.handle('logs:save', (_e, data: unknown) => { writeJson('logs.json', data); return { success: true } })

// ── Drive: scan ALL files (paginated)
ipcMain.handle('drive:scan', async (event, query: string) => {
  const token = await getValidToken()
  const q = query || "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document') and trashed=false"
  let allFiles: unknown[] = []
  let pageToken: string | undefined = undefined
  let page = 0
  do {
    const url = `/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,writersCanShare)${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
    const result = await apiGet(url, token) as { files: unknown[]; nextPageToken?: string }
    allFiles = allFiles.concat(result.files || [])
    pageToken = result.nextPageToken
    page++
    // Send progress to renderer
    event.sender.send('drive:scan-progress', { count: allFiles.length, page, hasMore: !!pageToken })
  } while (pageToken)
  return allFiles
})

// ── Drive: get file permissions
ipcMain.handle('drive:get-permissions', async (_e, fileId: string) => {
  const token = await getValidToken()
  const result = await apiGet(
    `/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress,role,type,displayName)`,
    token
  ) as { permissions: unknown[] }
  return result.permissions || []
})

// ── Drive: add permission
ipcMain.handle('drive:add-permission', async (_e, { fileId, email, role }: { fileId: string; email: string; role: string }) => {
  const token = await getValidToken()
  const result = await apiRequest('POST', `/drive/v3/files/${fileId}/permissions`, token, {
    role,
    type: 'user',
    emailAddress: email
  })
  return result
})

// ── Drive: update permission
ipcMain.handle('drive:update-permission', async (_e, { fileId, permissionId, role }: { fileId: string; permissionId: string; role: string }) => {
  const token = await getValidToken()
  const result = await apiRequest('PATCH', `/drive/v3/files/${fileId}/permissions/${permissionId}`, token, { role })
  return result
})

// ── Drive: delete permission
ipcMain.handle('drive:delete-permission', async (_e, { fileId, permissionId }: { fileId: string; permissionId: string }) => {
  const token = await getValidToken()
  await apiRequest('DELETE', `/drive/v3/files/${fileId}/permissions/${permissionId}`, token)
  return { success: true }
})

// ── Drive: get file info (including writersCanShare)
ipcMain.handle('drive:get-file-info', async (_e, fileId: string) => {
  const token = await getValidToken()
  const result = await apiGet(
    `/drive/v3/files/${fileId}?fields=id,name,writersCanShare,capabilities`,
    token
  )
  return result
})

// ── Drive: set writersCanShare (高级锁表 / 解锁)
ipcMain.handle('drive:set-writers-can-share', async (_e, { fileId, writersCanShare }: { fileId: string; writersCanShare: boolean }) => {
  const token = await getValidToken()
  const result = await apiRequest('PATCH', `/drive/v3/files/${fileId}?fields=id,writersCanShare`, token, { writersCanShare })
  return result
})

// ── Open external link
ipcMain.handle('shell:open-external', (_e, url: string) => shell.openExternal(url))

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
