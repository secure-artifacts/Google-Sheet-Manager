"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const fs_1 = require("fs");
const os_1 = require("os");
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url = __importStar(require("url"));
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1';
// ─── Data directory ──────────────────────────────────────────────────────────
const DATA_DIR = (0, path_1.join)((0, os_1.homedir)(), '.google-sheet-manager');
if (!(0, fs_1.existsSync)(DATA_DIR))
    (0, fs_1.mkdirSync)(DATA_DIR, { recursive: true });
function dataPath(filename) {
    return (0, path_1.join)(DATA_DIR, filename);
}
function readJson(filename, defaultVal) {
    const p = dataPath(filename);
    if (!(0, fs_1.existsSync)(p))
        return defaultVal;
    try {
        return JSON.parse((0, fs_1.readFileSync)(p, 'utf8'));
    }
    catch {
        return defaultVal;
    }
}
function writeJson(filename, data) {
    (0, fs_1.writeFileSync)(dataPath(filename), JSON.stringify(data, null, 2), 'utf8');
}
let authData = readJson('auth.json', {
    accessToken: null, refreshToken: null, expiresAt: null,
    userEmail: null, userName: null, userPhoto: null
});
function saveAuth() { writeJson('auth.json', authData); }
// ─── OAuth Config ────────────────────────────────────────────────────────────
// Users must create their own Google OAuth app in Google Cloud Console
// and set CLIENT_ID / CLIENT_SECRET here or via environment variables
const OAUTH_CONFIG = {
    clientId: readJson('oauth_config.json', { clientId: '', clientSecret: '' }).clientId || '',
    clientSecret: readJson('oauth_config.json', { clientId: '', clientSecret: '' }).clientSecret || '',
    redirectUri: 'http://localhost:42813/oauth/callback',
    scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ]
};
// ─── OAuth local server ───────────────────────────────────────────────────────
let oauthServer = null;
let oauthResolve = null;
function startOAuthServer() {
    return new Promise((resolve, reject) => {
        oauthResolve = resolve;
        oauthServer = http.createServer((req, res) => {
            const parsed = url.parse(req.url || '', true);
            if (parsed.pathname === '/oauth/callback') {
                const code = parsed.query.code;
                if (code) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0f13;color:#fff">
            <div style="text-align:center">
              <h2>✅ 授权成功！</h2>
              <p>请关闭此窗口，返回应用。</p>
            </div>
          </body></html>`);
                    oauthServer?.close();
                    oauthResolve?.(code);
                }
                else {
                    res.writeHead(400);
                    res.end('Missing code');
                    reject(new Error('No code in callback'));
                }
            }
            else {
                res.writeHead(404);
                res.end();
            }
        });
        oauthServer.listen(42813);
        oauthServer.on('error', reject);
    });
}
async function exchangeCodeForTokens(code) {
    const cfg = readJson('oauth_config.json', { clientId: '', clientSecret: '' });
    const body = new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: OAUTH_CONFIG.redirectUri,
        grant_type: 'authorization_code'
    }).toString();
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error('Failed to parse token response'));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
async function refreshAccessToken() {
    const cfg = readJson('oauth_config.json', { clientId: '', clientSecret: '' });
    if (!authData.refreshToken)
        throw new Error('No refresh token');
    const body = new URLSearchParams({
        refresh_token: authData.refreshToken,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: 'refresh_token'
    }).toString();
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error('Failed to parse refresh response'));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
async function getValidToken() {
    if (!authData.accessToken)
        throw new Error('Not authenticated');
    const now = Date.now();
    if (authData.expiresAt && now < authData.expiresAt - 60000) {
        return authData.accessToken;
    }
    // Refresh
    const tokens = await refreshAccessToken();
    authData.accessToken = tokens.access_token;
    authData.expiresAt = Date.now() + tokens.expires_in * 1000;
    saveAuth();
    return authData.accessToken;
}
// ─── API Helper ───────────────────────────────────────────────────────────────
function apiGet(path, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.googleapis.com',
            path,
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    // Extract meaningful error message from Google API response
                    try {
                        const errObj = JSON.parse(data);
                        const msg = errObj?.error?.message || errObj?.error?.status || data;
                        reject(new Error(`API ${res.statusCode}: ${msg}`));
                    }
                    catch {
                        reject(new Error(`API ${res.statusCode}: ${data}`));
                    }
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error(data));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}
function apiRequest(method, path, token, body) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : undefined;
        const options = {
            hostname: 'www.googleapis.com',
            path,
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
            }
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`API Error ${res.statusCode}: ${data}`));
                    return;
                }
                try {
                    resolve(data ? JSON.parse(data) : {});
                }
                catch {
                    resolve({});
                }
            });
        });
        req.on('error', reject);
        if (bodyStr)
            req.write(bodyStr);
        req.end();
    });
}
// ─── Main Window ─────────────────────────────────────────────────────────────
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 960,
        minHeight: 600,
        frame: false,
        backgroundColor: '#0f0f13',
        webPreferences: {
            preload: (0, path_1.join)(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        icon: (0, path_1.join)(__dirname, '../public/icon.ico'),
        show: false
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    }
    else {
        mainWindow.loadFile((0, path_1.join)(__dirname, '../dist/index.html'));
    }
    mainWindow.once('ready-to-show', () => mainWindow?.show());
}
// ─── IPC Handlers ────────────────────────────────────────────────────────────
// Window controls
electron_1.ipcMain.on('window-minimize', () => mainWindow?.minimize());
electron_1.ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized())
        mainWindow.unmaximize();
    else
        mainWindow?.maximize();
});
electron_1.ipcMain.on('window-close', () => mainWindow?.close());
// ── Auth
electron_1.ipcMain.handle('auth:get-status', () => ({
    isAuthenticated: !!authData.accessToken,
    email: authData.userEmail,
    name: authData.userName,
    photo: authData.userPhoto
}));
electron_1.ipcMain.handle('auth:get-oauth-config', () => {
    const cfg = readJson('oauth_config.json', { clientId: '', clientSecret: '' });
    return { hasConfig: !!(cfg.clientId && cfg.clientSecret), clientId: cfg.clientId };
});
electron_1.ipcMain.handle('auth:save-oauth-config', (_e, config) => {
    writeJson('oauth_config.json', config);
    return { success: true };
});
electron_1.ipcMain.handle('auth:login', async () => {
    const cfg = readJson('oauth_config.json', { clientId: '', clientSecret: '' });
    if (!cfg.clientId || !cfg.clientSecret) {
        throw new Error('请先在设置中配置 Google OAuth Client ID 和 Secret');
    }
    const codePromise = startOAuthServer();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: OAUTH_CONFIG.redirectUri,
        response_type: 'code',
        scope: OAUTH_CONFIG.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent'
    }).toString()}`;
    electron_1.shell.openExternal(authUrl);
    const code = await codePromise;
    const tokens = await exchangeCodeForTokens(code);
    authData.accessToken = tokens.access_token;
    authData.refreshToken = tokens.refresh_token;
    authData.expiresAt = Date.now() + tokens.expires_in * 1000;
    // Fetch user info
    const userInfo = await apiGet('/oauth2/v2/userinfo', authData.accessToken);
    authData.userEmail = userInfo.email;
    authData.userName = userInfo.name;
    authData.userPhoto = userInfo.picture;
    saveAuth();
    return { email: authData.userEmail, name: authData.userName, photo: authData.userPhoto };
});
electron_1.ipcMain.handle('auth:logout', () => {
    authData = { accessToken: null, refreshToken: null, expiresAt: null, userEmail: null, userName: null, userPhoto: null };
    saveAuth();
    return { success: true };
});
// ── Libraries
electron_1.ipcMain.handle('libraries:get', () => readJson('libraries.json', { libraries: [] }));
electron_1.ipcMain.handle('libraries:save', (_e, data) => { writeJson('libraries.json', data); return { success: true }; });
// ── Permission Groups
electron_1.ipcMain.handle('groups:get', () => readJson('permissionGroups.json', { groups: [] }));
electron_1.ipcMain.handle('groups:save', (_e, data) => { writeJson('permissionGroups.json', data); return { success: true }; });
// ── Logs
electron_1.ipcMain.handle('logs:get', () => readJson('logs.json', { logs: [] }));
electron_1.ipcMain.handle('logs:save', (_e, data) => { writeJson('logs.json', data); return { success: true }; });
// ── Drive: scan files (paginated) — supports My Drive + Shared Drives
electron_1.ipcMain.handle('drive:scan', async (event, query) => {
    const token = await getValidToken();
    const q = query || "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document') and trashed=false";
    let allFiles = [];
    let pageToken = undefined;
    let page = 0;
    do {
        const url = `/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,writersCanShare,owners)${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const result = await apiGet(url, token);
        allFiles = allFiles.concat(result.files || []);
        pageToken = result.nextPageToken;
        page++;
        event.sender.send('drive:scan-progress', { count: allFiles.length, page, hasMore: !!pageToken });
    } while (pageToken);
    return allFiles;
});
// ── Drive: recursively scan folder(s) using BFS — supports all subfolders + owner filter
electron_1.ipcMain.handle('drive:scan-folder-recursive', async (event, { folderIds, mimeTypes, ownerOnly }) => {
    const token = await getValidToken();
    const allFiles = [];
    const visitedFolders = new Set();
    const collectedIds = new Set();
    const FOLDER_MIME = 'application/vnd.google-apps.folder';
    // BFS queue starts with the root folders
    const queue = [...folderIds];
    while (queue.length > 0) {
        const folderId = queue.shift();
        if (visitedFolders.has(folderId))
            continue;
        visitedFolders.add(folderId);
        let pageToken = undefined;
        do {
            // Get ALL items (files + subfolders) in this folder — no mime filter here so we catch subfolders
            const q = `'${folderId}' in parents and trashed=false`;
            const url = `/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,owners)${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
            const result = await apiGet(url, token);
            for (const file of (result.files || [])) {
                if (file.mimeType === FOLDER_MIME) {
                    // Found a subfolder → add to BFS queue for recursive scan
                    if (!visitedFolders.has(file.id))
                        queue.push(file.id);
                    continue;
                }
                // Apply mime type filter
                if (mimeTypes.length > 0 && !mimeTypes.includes(file.mimeType))
                    continue;
                // Apply owner filter
                if (ownerOnly && !file.owners?.some(o => o.me))
                    continue;
                // Deduplicate
                if (collectedIds.has(file.id))
                    continue;
                allFiles.push(file);
                collectedIds.add(file.id);
            }
            pageToken = result.nextPageToken;
        } while (pageToken);
        // Report progress: files collected so far + how many folders visited
        event.sender.send('drive:scan-progress', {
            count: allFiles.length,
            page: visitedFolders.size,
            hasMore: queue.length > 0
        });
    }
    return allFiles;
});
// ── Role mapping: our internal names → Google Drive API names
// Google Drive API uses 'reader'/'writer' but our UI uses 'viewer'/'editor'
function toApiRole(role) {
    if (role === 'viewer')
        return 'reader';
    if (role === 'editor')
        return 'writer';
    return role; // 'commenter', 'reader', 'writer' pass through unchanged
}
// ── Drive: get file permissions
electron_1.ipcMain.handle('drive:get-permissions', async (_e, fileId) => {
    const token = await getValidToken();
    const result = await apiGet(`/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress,role,type,displayName,permissionDetails)&supportsAllDrives=true`, token);
    // Map API roles back to our internal names for the UI
    const perms = (result.permissions || []);
    return perms.map(p => ({
        ...p,
        role: p.role === 'reader' ? 'viewer' : p.role === 'writer' ? 'editor' : p.role
    }));
});
// ── Drive: add permission
electron_1.ipcMain.handle('drive:add-permission', async (_e, { fileId, email, role }) => {
    const token = await getValidToken();
    const result = await apiRequest('POST', `/drive/v3/files/${fileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, token, {
        role: toApiRole(role),
        type: 'user',
        emailAddress: email
    });
    return result;
});
// ── Drive: update permission
electron_1.ipcMain.handle('drive:update-permission', async (_e, { fileId, permissionId, role }) => {
    const token = await getValidToken();
    const result = await apiRequest('PATCH', `/drive/v3/files/${fileId}/permissions/${permissionId}?supportsAllDrives=true`, token, { role: toApiRole(role) });
    return result;
});
// ── Drive: delete permission
electron_1.ipcMain.handle('drive:delete-permission', async (_e, { fileId, permissionId }) => {
    const token = await getValidToken();
    await apiRequest('DELETE', `/drive/v3/files/${fileId}/permissions/${permissionId}?supportsAllDrives=true`, token);
    return { success: true };
});
// ── Drive: get file info (including writersCanShare)
electron_1.ipcMain.handle('drive:get-file-info', async (_e, fileId) => {
    const token = await getValidToken();
    const result = await apiGet(`/drive/v3/files/${fileId}?fields=id,name,writersCanShare,capabilities`, token);
    return result;
});
// ── Drive: set writersCanShare (高级锁表 / 解锁)
electron_1.ipcMain.handle('drive:set-writers-can-share', async (_e, { fileId, writersCanShare }) => {
    const token = await getValidToken();
    const result = await apiRequest('PATCH', `/drive/v3/files/${fileId}?fields=id,writersCanShare&supportsAllDrives=true`, token, { writersCanShare });
    return result;
});
// ── Drive: set general access (anyone / anyoneWithLink)
electron_1.ipcMain.handle('drive:set-general-access', async (_e, { fileId, access }) => {
    const token = await getValidToken();
    if (access === 'restricted') {
        const perms = await apiGet(`/drive/v3/files/${fileId}/permissions?fields=permissions(id,type)&supportsAllDrives=true`, token);
        const anyonePerm = (perms.permissions || []).find(p => p.type === 'anyone');
        if (anyonePerm) {
            await apiRequest('DELETE', `/drive/v3/files/${fileId}/permissions/${anyonePerm.id}?supportsAllDrives=true`, token);
            return { success: true, action: 'removed' };
        }
        return { success: true, action: 'already_restricted' };
    }
    else {
        const perms = await apiGet(`/drive/v3/files/${fileId}/permissions?fields=permissions(id,type,role)&supportsAllDrives=true`, token);
        const anyonePerm = (perms.permissions || []).find(p => p.type === 'anyone');
        const apiRole = toApiRole(access); // 'viewer'→'reader', 'editor'→'writer'
        if (anyonePerm) {
            const result = await apiRequest('PATCH', `/drive/v3/files/${fileId}/permissions/${anyonePerm.id}?supportsAllDrives=true`, token, { role: apiRole });
            return Object.assign({}, result, { action: 'updated' });
        }
        else {
            const result = await apiRequest('POST', `/drive/v3/files/${fileId}/permissions?supportsAllDrives=true`, token, {
                role: apiRole,
                type: 'anyone'
            });
            return Object.assign({}, result, { action: 'created' });
        }
    }
});
// ── Open external link
electron_1.ipcMain.handle('shell:open-external', (_e, url) => electron_1.shell.openExternal(url));
// ── Drive: Transfer Ownership (2-step: ensure editor → set owner) ─────────────
electron_1.ipcMain.handle('drive:transfer-ownership', async (_e, { fileId, targetEmail }) => {
    const token = await getValidToken();
    // ── Pre-check: Shared Drive files cannot have ownership transferred ──────────
    const fileInfo = await apiGet(`/drive/v3/files/${fileId}?fields=id,name,driveId,ownedByMe`, token);
    if (fileInfo.driveId) {
        // File is in a Shared Drive — ownership transfer not supported by Google
        throw new Error('共享云盘（Shared Drive）中的文件不支持所有权转让。请先将文件移至「我的云盘」后再操作。');
    }
    if (fileInfo.ownedByMe === false) {
        throw new Error('当前账号不是该文件的所有者，无法发起所有权转让。');
    }
    // ── Fetch current permissions ────────────────────────────────────────────────
    const permsResult = await apiGet(`/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress,role,type)&supportsAllDrives=true`, token);
    const perms = permsResult.permissions || [];
    const existing = perms.find(p => p.emailAddress?.toLowerCase() === targetEmail.toLowerCase());
    // Already owner → skip
    if (existing?.role === 'owner')
        return { status: 'already_owner' };
    // ── Step 1: Remove existing (non-owner) permission if it exists ──────────────
    // We'll recreate it as 'owner' in one request to avoid the PATCH consent error
    if (existing && existing.role !== 'owner') {
        try {
            await apiRequest('DELETE', `/drive/v3/files/${fileId}/permissions/${existing.id}?supportsAllDrives=true`, token, null);
        }
        catch {
            // Non-fatal if delete fails — we'll still try to create
        }
    }
    // ── Step 2: POST a new permission with role='owner' directly ─────────────────
    // Using permissions.create (POST) with transferOwnership=true avoids the
    // consentRequiredForOwnershipTransfer error that occurs when PATCHing.
    // moveToNewOwnerRoot=true: move file to new owner's My Drive root
    // sendNotificationEmail=true: recipient gets email to accept (required for Gmail)
    await apiRequest('POST', `/drive/v3/files/${fileId}/permissions?transferOwnership=true&moveToNewOwnerRoot=true&sendNotificationEmail=true&supportsAllDrives=true`, token, { role: 'owner', type: 'user', emailAddress: targetEmail });
    return { status: 'transferred' };
});
// ── Drive: Accept Ownership (current user accepts a pending ownership transfer) ─
electron_1.ipcMain.handle('drive:accept-ownership', async (_e, { fileId, userEmail }) => {
    const token = await getValidToken();
    // Find current user's permission on this file
    const permsResult = await apiGet(`/drive/v3/files/${fileId}/permissions?fields=permissions(id,emailAddress,role,type)&supportsAllDrives=true`, token);
    const perms = permsResult.permissions || [];
    const myPerm = perms.find(p => p.emailAddress?.toLowerCase() === userEmail.toLowerCase());
    if (!myPerm)
        throw new Error('当前账号在该文件上没有权限记录，无法接收所有权');
    if (myPerm.role === 'owner')
        return { status: 'already_owner' };
    // Accept the pending ownership: POST a new owner permission for ourselves
    await apiRequest('POST', `/drive/v3/files/${fileId}/permissions?transferOwnership=true&moveToNewOwnerRoot=true&sendNotificationEmail=false&supportsAllDrives=true`, token, { role: 'owner', type: 'user', emailAddress: userEmail });
    return { status: 'accepted' };
});
// ── Sheets: export library files to a Google Sheet ───────────────────────────
electron_1.ipcMain.handle('sheets:export-library', async (event, { files, spreadsheetId, sheetName, includeHeader }) => {
    const token = await getValidToken();
    // Role display map
    const roleLabel = (role) => ({ reader: '查看者', commenter: '评论者', writer: '编辑者', owner: '所有者' }[role] || role);
    const rows = [];
    if (includeHeader)
        rows.push(['文件名称', '文件链接', '所有者', '常规访问权限']);
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        event.sender.send('sheets:export-progress', { current: i + 1, total: files.length, name: file.name });
        let ownerEmail = '未知';
        let generalAccess = '受限（仅指定人员）';
        try {
            const permsResult = await apiGet(`/drive/v3/files/${file.driveId}/permissions?fields=permissions(id,emailAddress,role,type,displayName)&supportsAllDrives=true`, token);
            const perms = permsResult.permissions || [];
            // Owner is the user with role='owner'
            const ownerPerm = perms.find(p => p.role === 'owner');
            if (ownerPerm)
                ownerEmail = ownerPerm.emailAddress || ownerPerm.displayName || '未知';
            // General access = 'anyone' type permission
            const anyonePerm = perms.find(p => p.type === 'anyone');
            if (anyonePerm)
                generalAccess = `任何知道链接的人（${roleLabel(anyonePerm.role)}）`;
        }
        catch {
            // Per-file errors are non-fatal
        }
        rows.push([file.name, file.url, ownerEmail, generalAccess]);
    }
    // ── Append rows to Google Sheet below existing content ──
    // Using Sheets API v4 append — automatically finds first empty row in the range
    const range = encodeURIComponent(`${sheetName}!A1`);
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const res = await fetch(appendUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Sheets API error ${res.status}: ${err?.error?.message || res.statusText}`);
    }
    const result = await res.json();
    return { success: true, rowsWritten: rows.length, updatedRows: result.updates?.updatedRows };
});
// ─── App lifecycle ────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createWindow(); });
