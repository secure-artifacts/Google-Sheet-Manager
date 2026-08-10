// ─── Drive File ───────────────────────────────────────────────────────────────
export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  modifiedTime?: string
  type: 'spreadsheet' | 'document'
}

// ─── Library ──────────────────────────────────────────────────────────────────
export interface FileLibrary {
  id: string
  name: string
  description: string
  color: string
  files: LibraryFile[]
  createdAt: string
  updatedAt: string
}

export interface LibraryFile {
  driveId: string
  name: string
  url: string
  mimeType: string
  type: 'spreadsheet' | 'document'
  addedAt: string
}

// ─── Permission Group ──────────────────────────────────────────────────────────
export type Role = 'viewer' | 'commenter' | 'editor'

/** Each email can now have its own role */
export interface EmailEntry {
  email: string
  role: Role
}

export interface PermissionGroup {
  id: string
  name: string
  description: string
  color: string
  defaultRole: Role           // used as default when adding new emails
  emails: EmailEntry[]        // each entry has email + individual role
  createdAt: string
  updatedAt: string
}

// ─── Permission ────────────────────────────────────────────────────────────────
export interface FilePermission {
  id: string
  emailAddress: string
  role: string
  type: string
  displayName?: string
}

// ─── Log Entry ────────────────────────────────────────────────────────────────
export type OperationMode = 'sync' | 'grant' | 'add' | 'remove' | 'modify' | 'lock' | 'unlock' | 'transfer' | 'accept'

export interface LogEntry {
  id: string
  timestamp: string
  mode: OperationMode
  modeLabel: string
  fileId: string
  fileName: string
  fileUrl: string
  email: string
  role?: string
  action: 'added' | 'removed' | 'modified' | 'skipped' | 'failed'
  error?: string
}

// ─── Auth State ───────────────────────────────────────────────────────────────
export interface AuthStatus {
  isAuthenticated: boolean
  email: string | null
  name: string | null
  photo: string | null
}
