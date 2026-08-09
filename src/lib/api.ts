// Shared helper to access the Electron API exposed by the preload script
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const eAPI = () => (window as any).electronAPI as {
  minimize: () => void
  maximize: () => void
  close: () => void
  auth: {
    getStatus: () => Promise<{ isAuthenticated: boolean; email: string | null; name: string | null; photo: string | null }>
    getOAuthConfig: () => Promise<{ hasConfig: boolean; clientId: string }>
    saveOAuthConfig: (c: { clientId: string; clientSecret: string }) => Promise<{ success: boolean }>
    login: () => Promise<{ email: string; name: string; photo: string }>
    logout: () => Promise<{ success: boolean }>
  }
  libraries: { get: () => Promise<unknown>; save: (d: unknown) => Promise<unknown> }
  groups: { get: () => Promise<unknown>; save: (d: unknown) => Promise<unknown> }
  logs: { get: () => Promise<unknown>; save: (d: unknown) => Promise<unknown> }
  drive: {
    scan: (query?: string) => Promise<unknown[]>
    getPermissions: (fileId: string) => Promise<unknown[]>
    getFileInfo: (fileId: string) => Promise<{ id: string; name: string; writersCanShare: boolean }>
    setWritersCanShare: (a: { fileId: string; writersCanShare: boolean }) => Promise<unknown>
    addPermission: (a: { fileId: string; email: string; role: string }) => Promise<unknown>
    updatePermission: (a: { fileId: string; permissionId: string; role: string }) => Promise<unknown>
    deletePermission: (a: { fileId: string; permissionId: string }) => Promise<unknown>
    onScanProgress: (cb: (data: { count: number; page: number; hasMore: boolean }) => void) => () => void
  }
  shell: { openExternal: (url: string) => void }
}
