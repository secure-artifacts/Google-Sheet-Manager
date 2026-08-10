"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // Window controls
    minimize: () => electron_1.ipcRenderer.send('window-minimize'),
    maximize: () => electron_1.ipcRenderer.send('window-maximize'),
    close: () => electron_1.ipcRenderer.send('window-close'),
    // Auth
    auth: {
        getStatus: () => electron_1.ipcRenderer.invoke('auth:get-status'),
        getOAuthConfig: () => electron_1.ipcRenderer.invoke('auth:get-oauth-config'),
        saveOAuthConfig: (config) => electron_1.ipcRenderer.invoke('auth:save-oauth-config', config),
        login: () => electron_1.ipcRenderer.invoke('auth:login'),
        logout: () => electron_1.ipcRenderer.invoke('auth:logout')
    },
    // Libraries
    libraries: {
        get: () => electron_1.ipcRenderer.invoke('libraries:get'),
        save: (data) => electron_1.ipcRenderer.invoke('libraries:save', data)
    },
    // Permission groups
    groups: {
        get: () => electron_1.ipcRenderer.invoke('groups:get'),
        save: (data) => electron_1.ipcRenderer.invoke('groups:save', data)
    },
    // Logs
    logs: {
        get: () => electron_1.ipcRenderer.invoke('logs:get'),
        save: (data) => electron_1.ipcRenderer.invoke('logs:save', data)
    },
    // Drive API
    drive: {
        scan: (query) => electron_1.ipcRenderer.invoke('drive:scan', query),
        scanFolderRecursive: (args) => electron_1.ipcRenderer.invoke('drive:scan-folder-recursive', args),
        getPermissions: (fileId) => electron_1.ipcRenderer.invoke('drive:get-permissions', fileId),
        getFileInfo: (fileId) => electron_1.ipcRenderer.invoke('drive:get-file-info', fileId),
        setWritersCanShare: (args) => electron_1.ipcRenderer.invoke('drive:set-writers-can-share', args),
        addPermission: (args) => electron_1.ipcRenderer.invoke('drive:add-permission', args),
        updatePermission: (args) => electron_1.ipcRenderer.invoke('drive:update-permission', args),
        deletePermission: (args) => electron_1.ipcRenderer.invoke('drive:delete-permission', args),
        setGeneralAccess: (args) => electron_1.ipcRenderer.invoke('drive:set-general-access', args),
        onScanProgress: (cb) => {
            electron_1.ipcRenderer.on('drive:scan-progress', (_e, data) => cb(data));
            return () => electron_1.ipcRenderer.removeAllListeners('drive:scan-progress');
        }
    },
    // Sheets export
    sheets: {
        exportLibrary: (args) => electron_1.ipcRenderer.invoke('sheets:export-library', args),
        onExportProgress: (cb) => {
            electron_1.ipcRenderer.on('sheets:export-progress', (_e, data) => cb(data));
            return () => electron_1.ipcRenderer.removeAllListeners('sheets:export-progress');
        }
    },
    // Shell
    shell: {
        openExternal: (url) => electron_1.ipcRenderer.invoke('shell:open-external', url)
    }
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
