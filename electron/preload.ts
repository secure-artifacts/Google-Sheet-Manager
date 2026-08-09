import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Auth
  auth: {
    getStatus: () => ipcRenderer.invoke('auth:get-status'),
    getOAuthConfig: () => ipcRenderer.invoke('auth:get-oauth-config'),
    saveOAuthConfig: (config: { clientId: string; clientSecret: string }) =>
      ipcRenderer.invoke('auth:save-oauth-config', config),
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout')
  },

  // Libraries
  libraries: {
    get: () => ipcRenderer.invoke('libraries:get'),
    save: (data: unknown) => ipcRenderer.invoke('libraries:save', data)
  },

  // Permission groups
  groups: {
    get: () => ipcRenderer.invoke('groups:get'),
    save: (data: unknown) => ipcRenderer.invoke('groups:save', data)
  },

  // Logs
  logs: {
    get: () => ipcRenderer.invoke('logs:get'),
    save: (data: unknown) => ipcRenderer.invoke('logs:save', data)
  },

  // Drive API
  drive: {
    scan: (query?: string) => ipcRenderer.invoke('drive:scan', query),
    getPermissions: (fileId: string) => ipcRenderer.invoke('drive:get-permissions', fileId),
    getFileInfo: (fileId: string) => ipcRenderer.invoke('drive:get-file-info', fileId),
    setWritersCanShare: (args: { fileId: string; writersCanShare: boolean }) =>
      ipcRenderer.invoke('drive:set-writers-can-share', args),
    addPermission: (args: { fileId: string; email: string; role: string }) =>
      ipcRenderer.invoke('drive:add-permission', args),
    updatePermission: (args: { fileId: string; permissionId: string; role: string }) =>
      ipcRenderer.invoke('drive:update-permission', args),
    deletePermission: (args: { fileId: string; permissionId: string }) =>
      ipcRenderer.invoke('drive:delete-permission', args),
    onScanProgress: (cb: (data: { count: number; page: number; hasMore: boolean }) => void) => {
      ipcRenderer.on('drive:scan-progress', (_e, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('drive:scan-progress')
    }
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
