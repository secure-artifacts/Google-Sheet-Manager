import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthStatus, FileLibrary, PermissionGroup, LogEntry } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AppContextValue {
  auth: AuthStatus
  libraries: FileLibrary[]
  groups: PermissionGroup[]
  logs: LogEntry[]
  loading: boolean
  refreshLibraries: () => Promise<void>
  saveLibraries: (libs: FileLibrary[]) => Promise<void>
  refreshGroups: () => Promise<void>
  saveGroups: (groups: PermissionGroup[]) => Promise<void>
  addLog: (entry: LogEntry) => Promise<void>
  checkAuth: () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthStatus>({
    isAuthenticated: false, email: null, name: null, photo: null
  })
  const [libraries, setLibraries] = useState<FileLibrary[]>([])
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (window as any).electronAPI

  const checkAuth = async () => {
    const status = await api.auth.getStatus()
    setAuth(status)
  }

  const refreshLibraries = async () => {
    const data = await api.libraries.get() as { libraries: FileLibrary[] }
    setLibraries(data.libraries || [])
  }

  const saveLibraries = async (libs: FileLibrary[]) => {
    await api.libraries.save({ libraries: libs })
    setLibraries(libs)
  }

  const refreshGroups = async () => {
    const data = await api.groups.get() as { groups: PermissionGroup[] }
    const raw = data.groups || []
    // Migration: convert old string[] emails to EmailEntry[]
    const migrated = raw.map(g => ({
      ...g,
      emails: (g.emails || []).map((e: unknown) =>
        typeof e === 'string'
          ? { email: e, role: g.defaultRole || 'viewer' }
          : e
      )
    })) as PermissionGroup[]
    setGroups(migrated)
  }

  const saveGroups = async (grps: PermissionGroup[]) => {
    await api.groups.save({ groups: grps })
    setGroups(grps)
  }

  const addLog = async (entry: LogEntry) => {
    const data = await api.logs.get() as { logs: LogEntry[] }
    const updated = [entry, ...(data.logs || [])].slice(0, 2000)
    await api.logs.save({ logs: updated })
    setLogs(updated)
  }

  const refreshLogs = async () => {
    const data = await api.logs.get() as { logs: LogEntry[] }
    setLogs(data.logs || [])
  }

  useEffect(() => {
    Promise.all([checkAuth(), refreshLibraries(), refreshGroups(), refreshLogs()])
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppContext.Provider value={{
      auth, libraries, groups, logs, loading,
      refreshLibraries, saveLibraries,
      refreshGroups, saveGroups,
      addLog, checkAuth
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
