// Electron API type stub used in renderer pages
// The actual implementation is in electron/preload.ts and exposed via contextBridge
declare const electronAPI: {
  minimize: () => void
  maximize: () => void
  close: () => void
  auth: {
    getStatus: () => Promise<{ isAuthenticated: boolean; email: string | null; name: string | null; photo: string | null }>
    getOAuthConfig: () => Promise<{ hasConfig: boolean; clientId: string }>
    saveOAuthConfig: (config: { clientId: string; clientSecret: string }) => Promise<{ success: boolean }>
    login: () => Promise<{ email: string; name: string; photo: string }>
    logout: () => Promise<{ success: boolean }>
  }
  libraries: { get: () => Promise<unknown>; save: (d: unknown) => Promise<unknown> }
  groups: { get: () => Promise<unknown>; save: (d: unknown) => Promise<unknown> }
  logs: { get: () => Promise<unknown>; save: (d: unknown) => Promise<unknown> }
  drive: {
    scan: (query?: string) => Promise<unknown[]>
    getPermissions: (fileId: string) => Promise<unknown[]>
    addPermission: (args: { fileId: string; email: string; role: string }) => Promise<unknown>
    updatePermission: (args: { fileId: string; permissionId: string; role: string }) => Promise<unknown>
    deletePermission: (args: { fileId: string; permissionId: string }) => Promise<unknown>
  }
  shell: { openExternal: (url: string) => void }
}

export default typeof electronAPI
