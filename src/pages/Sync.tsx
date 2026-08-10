import { useState, useRef } from 'react'
import { eAPI } from '../lib/api'
import { useApp } from '../context/AppContext'
import { FileLibrary, PermissionGroup, EmailEntry, LogEntry, OperationMode } from '../types'
import { Spinner, FileTypeIcon, showToast } from '../components/ui'

// eAPI from ../lib/api

const ROLES = ['viewer', 'commenter', 'editor'] as const
const ROLE_LABELS: Record<string, string> = { viewer: '查看者', commenter: '评论者', editor: '编辑者' }

function genLogId() { return `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

type ProgressItem = {
  email: string
  fileName: string
  action: 'added' | 'removed' | 'modified' | 'skipped' | 'failed'
  error?: string
}

// ─── Operation Modes ──────────────────────────────────────────────────────────
const OP_MODES = [
  { key: 'sync'     as OperationMode, icon: '⚡', title: '一键同步',   desc: '授权权限库成员，自动移除其他人（owner除外）',              color: '#7b6fff' },
  { key: 'grant'    as OperationMode, icon: '✅', title: '批量授权',   desc: '仅将权限库邮箱授权，不移除已有成员',                      color: '#22d3a0' },
  { key: 'add'      as OperationMode, icon: '➕', title: '添加指定邮箱', desc: '为选定文件添加单个或多个邮箱权限',                        color: '#60a5fa' },
  { key: 'remove'   as OperationMode, icon: '🗑', title: '移除指定邮箱', desc: '从选定文件中移除指定邮箱的权限',                          color: '#f87171' },
  { key: 'modify'   as OperationMode, icon: '✏️', title: '修改权限角色', desc: '修改指定邮箱在选定文件上的权限角色',                      color: '#fbbf24' },
  { key: 'transfer' as OperationMode, icon: '👑', title: '转让所有权',  desc: '将文件所有权转让给指定邮箱（先添加编辑者，再转让所有权）', color: '#f97316' },
  { key: 'accept'   as OperationMode, icon: '🤝', title: '接收所有权',  desc: '当前账号接收他人发起的所有权转让邀请（批量）',             color: '#14b8a6' },
  { key: 'lock'     as OperationMode, icon: '🔒', title: '高级锁表',   desc: '仅表格所有者可添加/移除成员，编辑者无法分享',             color: '#f472b6' },
  { key: 'unlock'   as OperationMode, icon: '🔓', title: '解除锁表',   desc: '恢复默认状态，编辑者也可以分享文件',                      color: '#a78bfa' },
]

// ─── Library Selector (multi-select at library level) ────────────────────────
function LibrarySelector({ libraries, selected, onToggle }: {
  libraries: FileLibrary[]
  selected: Set<string>  // library IDs
  onToggle: (id: string) => void
}) {
  const allSelected = libraries.length > 0 && libraries.every(l => selected.has(l.id))
  const totalFiles = libraries.filter(l => selected.has(l.id)).flatMap(l => l.files).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="form-label">
          选择表格库
          {totalFiles > 0 && <span style={{ color: 'var(--accent-2)', marginLeft: 8, fontWeight: 400 }}>（共 {totalFiles} 个文件）</span>}
        </div>
        <button className="btn btn--ghost btn--sm"
          onClick={() => libraries.forEach(l => {
            if (allSelected !== selected.has(l.id)) onToggle(l.id)
            else if (!allSelected) onToggle(l.id)
          })}
          style={{ fontSize: 12 }}>
          {allSelected ? '取消全选' : '全选'}
        </button>
      </div>
      {libraries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
          请先在「表格库」中创建并添加文件
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {libraries.map(lib => {
            const isSelected = selected.has(lib.id)
            return (
              <div key={lib.id} onClick={() => onToggle(lib.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'all 0.15s',
                  background: isSelected ? 'rgba(123,111,255,0.10)' : 'var(--bg-elevated)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                <div className={`checkbox${isSelected ? ' checked' : ''}`} style={{ flexShrink: 0 }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: lib.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lib.name}</div>
                  {lib.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{lib.description}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {lib.files.length} 个文件
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Show file list preview when libraries selected */}
      {totalFiles > 0 && (
        <div style={{ marginTop: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '8px 4px', maxHeight: 140, overflowY: 'auto' }}>
          {libraries.filter(l => selected.has(l.id)).flatMap(l =>
            l.files.map(f => (
              <div key={f.driveId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', fontSize: 12 }}>
                <FileTypeIcon mimeType={f.mimeType} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{f.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Group Multi-Selector ──────────────────────────────────────────────────────
function GroupMultiSelector({ groups, selected, onToggle }: {
  groups: PermissionGroup[]
  selected: Set<string>  // group IDs
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <div className="form-label" style={{ marginBottom: 10 }}>
        选择权限库（可多选，邮箱自动合并）
      </div>
      {groups.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>暂无权限组，请先在「权限库」中创建</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {groups.map(g => {
            const isSelected = selected.has(g.id)
            const roleCount = g.emails.reduce<Record<string,number>>((acc, e) => { acc[e.role]=(acc[e.role]||0)+1; return acc }, {})
            return (
              <div key={g.id} onClick={() => onToggle(g.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'all 0.15s',
                  background: isSelected ? 'rgba(123,111,255,0.10)' : 'var(--bg-elevated)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                <div className={`checkbox${isSelected ? ' checked' : ''}`} style={{ flexShrink: 0 }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                    {Object.entries(roleCount).map(([role, cnt]) => (
                      <span key={role} className={`badge badge--${role==='editor'?'accent':role==='commenter'?'yellow':'green'}`} style={{ fontSize: 10 }}>
                        {role==='viewer'?'查看':role==='commenter'?'评论':'编辑'} {cnt}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{g.emails.length} 个邮箱</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Progress Panel ───────────────────────────────────────────────────────────
function ProgressPanel({ items, total, done }: { items: ProgressItem[]; total: number; done: boolean }) {
  const actionColors: Record<string, string> = { added: 'green', removed: 'red', modified: 'blue', skipped: 'gray', failed: 'red' }
  const actionIcons: Record<string, string> = { added: '✅', removed: '🗑', modified: '✏️', skipped: '⏭', failed: '❌' }
  const counts = {
    added:    items.filter(i => i.action === 'added').length,
    removed:  items.filter(i => i.action === 'removed').length,
    modified: items.filter(i => i.action === 'modified').length,
    failed:   items.filter(i => i.action === 'failed').length,
    skipped:  items.filter(i => i.action === 'skipped').length,
  }
  const pct = total > 0 ? Math.round((items.length / total) * 100) : 0

  return (
    <div className="op-result">
      <div className="op-result__header">
        <div className="op-result__title">{done ? '✅ 操作完成' : `⏳ 执行中... ${pct}%`}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{items.length} / {total}</div>
      </div>
      <div className="progress-bar" style={{ marginBottom: 12 }}>
        <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="op-result__stats">
        {counts.added   > 0 && <div className="op-stat"><span className="badge badge--green">+{counts.added} 添加</span></div>}
        {counts.removed > 0 && <div className="op-stat"><span className="badge badge--red">-{counts.removed} 移除</span></div>}
        {counts.modified> 0 && <div className="op-stat"><span className="badge badge--blue">✏ {counts.modified} 修改</span></div>}
        {counts.skipped > 0 && <div className="op-stat"><span className="badge badge--gray">⏭ {counts.skipped} 跳过</span></div>}
        {counts.failed  > 0 && <div className="op-stat"><span className="badge badge--red">❌ {counts.failed} 失败</span></div>}
      </div>
      {items.length > 0 && (
        <div style={{ maxHeight: 220, overflowY: 'auto', background: 'var(--bg-base)', borderRadius: 'var(--r-md)', padding: '4px', marginTop: 8 }}>
          {[...items].reverse().map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
              <span>{actionIcons[item.action]}</span>
              <span className={`badge badge--${actionColors[item.action]}`} style={{ fontSize: 10 }}>{item.action}</span>
              <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
              <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{item.fileName}</span>
              {item.error && <span title={item.error} style={{ color: 'var(--red)', fontSize: 10, cursor: 'help' }}>⚠</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Merge email entries from multiple groups (deduplicate, keep highest role) ─
function mergeGroupEmails(groups: PermissionGroup[]): EmailEntry[] {
  const ROLE_PRIORITY: Record<string, number> = { viewer: 0, commenter: 1, editor: 2 }
  const map = new Map<string, EmailEntry>()
  for (const group of groups) {
    for (const entry of group.emails) {
      const existing = map.get(entry.email)
      if (!existing || ROLE_PRIORITY[entry.role] > ROLE_PRIORITY[existing.role]) {
        map.set(entry.email, entry)
      }
    }
  }
  return Array.from(map.values())
}

// ─── Main Sync Page ───────────────────────────────────────────────────────────
export default function Sync() {
  const { libraries, groups, addLog } = useApp()
  const api = eAPI()

  const [mode, setMode] = useState<OperationMode>('sync')

  // Library multi-selection (by library ID)
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set())
  // Group multi-selection (by group ID)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())

  const [customEmails, setCustomEmails] = useState('')
  const [targetRole, setTargetRole] = useState<'viewer' | 'commenter' | 'editor'>('editor')
  // General access: 'restricted' = no link sharing; others = anyone with link
  const [generalAccess, setGeneralAccess] = useState<'restricted' | 'viewer' | 'commenter' | 'editor'>('restricted')

  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressItem[]>([])
  const [totalOps, setTotalOps] = useState(0)
  const [done, setDone] = useState(false)
  const abortRef = useRef(false)

  // Derived: files from selected libraries
  const targetFiles = libraries
    .filter(l => selectedLibraryIds.has(l.id))
    .flatMap(l => l.files)

  // Derived: merged email entries from selected groups
  const selectedGroups = groups.filter(g => selectedGroupIds.has(g.id))
  const mergedEmails = mergeGroupEmails(selectedGroups)

  const toggleLibrary = (id: string) => {
    setSelectedLibraryIds(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  const toggleGroup = (id: string) => {
    setSelectedGroupIds(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  const pushProgress = (item: ProgressItem) => setProgress(prev => [...prev, item])

  const parseCustomEmails = () =>
    customEmails.split(/[\n,;，；\s]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

  const canRun = () => {
    if (targetFiles.length === 0) return false
    if (mode === 'sync' || mode === 'grant') return mergedEmails.length > 0 || generalAccess !== 'restricted'
    if (mode === 'add' || mode === 'remove' || mode === 'modify') return parseCustomEmails().length > 0
    if (mode === 'lock' || mode === 'unlock') return true
    if (mode === 'transfer') return parseCustomEmails().length === 1  // exactly 1 target email
    if (mode === 'accept') return true  // uses current user email
    return false
  }

  const addLogEntry = async (fileId: string, fileName: string, fileUrl: string, email: string, action: LogEntry['action'], role?: string, error?: string) => {
    const modeInfo = OP_MODES.find(m => m.key === mode)
    await addLog({
      id: genLogId(),
      timestamp: new Date().toISOString(),
      mode,
      modeLabel: modeInfo?.title || mode,
      fileId, fileName, fileUrl, email, role,
      action, error
    })
  }

  const run = async () => {
    if (!canRun() || running) return
    setRunning(true); setDone(false); setProgress([]); abortRef.current = false

    const groupEmailEntries = mergedEmails
    const customEmailList = parseCustomEmails()

    try {
      if (mode === 'sync' || mode === 'grant') {
        // totalOps = per-file email operations + generalAccess ops per file
        setTotalOps(targetFiles.length * (groupEmailEntries.length + 1))

        for (const file of targetFiles) {
          if (abortRef.current) break
          let currentPerms: { id: string; emailAddress: string; role: string; type: string }[] = []
          let getPermsError = ''
          try {
            currentPerms = await api.drive.getPermissions(file.driveId) as typeof currentPerms
          } catch (e: unknown) {
            getPermsError = (e as Error).message
          }

          if (getPermsError) {
            // Cannot proceed with this file — report all emails as failed with the real error
            for (const entry of groupEmailEntries) {
              pushProgress({ email: entry.email, fileName: file.name, action: 'failed', error: `获取权限失败: ${getPermsError}` })
              await addLogEntry(file.driveId, file.name, file.url, entry.email, 'failed', undefined, getPermsError)
            }
            continue
          }

          // currentPerms now includes permissionDetails for inherited check
          const currentMap = new Map(currentPerms.map(p => [p.emailAddress?.toLowerCase(), p]))
          const groupEmailSet = new Set(groupEmailEntries.map(e => e.email.toLowerCase()))

          if (mode === 'sync') {
            for (const perm of currentPerms) {
              if (perm.role === 'owner' || !perm.emailAddress) continue
              // Skip inherited permissions — they cannot be deleted at file level
              const isInherited = (perm as { permissionDetails?: { inherited?: boolean }[] }).permissionDetails?.some(d => d.inherited)
              if (isInherited) continue
              if (!groupEmailSet.has(perm.emailAddress.toLowerCase())) {
                try {
                  await api.drive.deletePermission({ fileId: file.driveId, permissionId: perm.id })
                  pushProgress({ email: perm.emailAddress, fileName: file.name, action: 'removed' })
                  await addLogEntry(file.driveId, file.name, file.url, perm.emailAddress, 'removed')
                } catch (e: unknown) {
                  pushProgress({ email: perm.emailAddress, fileName: file.name, action: 'failed', error: (e as Error).message })
                  await addLogEntry(file.driveId, file.name, file.url, perm.emailAddress, 'failed', undefined, (e as Error).message)
                }
              }
            }
          }

          for (const entry of groupEmailEntries) {
            if (abortRef.current) break
            const { email, role: entryRole } = entry
            const existing = currentMap.get(email.toLowerCase())
            if (existing) {
              if (existing.role === entryRole) {
                pushProgress({ email, fileName: file.name, action: 'skipped' })
                await addLogEntry(file.driveId, file.name, file.url, email, 'skipped', entryRole)
              } else {
                try {
                  await api.drive.updatePermission({ fileId: file.driveId, permissionId: existing.id, role: entryRole })
                  pushProgress({ email, fileName: file.name, action: 'modified' })
                  await addLogEntry(file.driveId, file.name, file.url, email, 'modified', entryRole)
                } catch (e: unknown) {
                  pushProgress({ email, fileName: file.name, action: 'failed', error: (e as Error).message })
                  await addLogEntry(file.driveId, file.name, file.url, email, 'failed', undefined, (e as Error).message)
                }
              }
            } else {
              try {
                await api.drive.addPermission({ fileId: file.driveId, email, role: entryRole })
                pushProgress({ email, fileName: file.name, action: 'added' })
                await addLogEntry(file.driveId, file.name, file.url, email, 'added', entryRole)
              } catch (e: unknown) {
                pushProgress({ email, fileName: file.name, action: 'failed', error: (e as Error).message })
                await addLogEntry(file.driveId, file.name, file.url, email, 'failed', undefined, (e as Error).message)
              }
            }
          }

          // Set general access (link sharing) for this file
          try {
            await api.drive.setGeneralAccess({ fileId: file.driveId, access: generalAccess })
            const label = generalAccess === 'restricted'
              ? '🔒 受限（链接分享已关闭）'
              : `🌐 任何知道链接的人（${ROLE_LABELS[generalAccess]}）`
            pushProgress({ email: label, fileName: file.name, action: generalAccess === 'restricted' ? 'removed' : 'modified' })
          } catch (e: unknown) {
            pushProgress({ email: '🌐 通用访问', fileName: file.name, action: 'failed', error: (e as Error).message })
          }
        }

      } else if (mode === 'add') {
        setTotalOps(targetFiles.length * customEmailList.length)
        for (const file of targetFiles) {
          if (abortRef.current) break
          for (const email of customEmailList) {
            try {
              await api.drive.addPermission({ fileId: file.driveId, email, role: targetRole })
              pushProgress({ email, fileName: file.name, action: 'added' })
              await addLogEntry(file.driveId, file.name, file.url, email, 'added', targetRole)
            } catch (e: unknown) {
              pushProgress({ email, fileName: file.name, action: 'failed', error: (e as Error).message })
              await addLogEntry(file.driveId, file.name, file.url, email, 'failed', undefined, (e as Error).message)
            }
          }
        }

      } else if (mode === 'remove') {
        setTotalOps(targetFiles.length * customEmailList.length)
        for (const file of targetFiles) {
          if (abortRef.current) break
          let perms: { id: string; emailAddress: string; role: string }[] = []
          try { perms = await api.drive.getPermissions(file.driveId) as typeof perms } catch { /**/ }
          for (const email of customEmailList) {
            const perm = perms.find(p => p.emailAddress?.toLowerCase() === email)
            if (!perm) {
              pushProgress({ email, fileName: file.name, action: 'skipped' })
              await addLogEntry(file.driveId, file.name, file.url, email, 'skipped')
              continue
            }
            // Skip inherited permissions
            const isInherited = (perm as { permissionDetails?: { inherited?: boolean }[] }).permissionDetails?.some(d => d.inherited)
            if (isInherited) {
              pushProgress({ email, fileName: file.name, action: 'skipped', error: '继承权限，无法在文件层面删除' })
              continue
            }
            try {
              await api.drive.deletePermission({ fileId: file.driveId, permissionId: perm.id })
              pushProgress({ email, fileName: file.name, action: 'removed' })
              await addLogEntry(file.driveId, file.name, file.url, email, 'removed')
            } catch (e: unknown) {
              pushProgress({ email, fileName: file.name, action: 'failed', error: (e as Error).message })
              await addLogEntry(file.driveId, file.name, file.url, email, 'failed', undefined, (e as Error).message)
            }
          }
        }

      } else if (mode === 'modify') {
        setTotalOps(targetFiles.length * customEmailList.length)
        for (const file of targetFiles) {
          if (abortRef.current) break
          let perms: { id: string; emailAddress: string; role: string }[] = []
          try { perms = await api.drive.getPermissions(file.driveId) as typeof perms } catch { /**/ }
          for (const email of customEmailList) {
            const perm = perms.find(p => p.emailAddress?.toLowerCase() === email)
            if (!perm) {
              pushProgress({ email, fileName: file.name, action: 'skipped' })
              await addLogEntry(file.driveId, file.name, file.url, email, 'skipped', targetRole)
              continue
            }
            try {
              await api.drive.updatePermission({ fileId: file.driveId, permissionId: perm.id, role: targetRole })
              pushProgress({ email, fileName: file.name, action: 'modified' })
              await addLogEntry(file.driveId, file.name, file.url, email, 'modified', targetRole)
            } catch (e: unknown) {
              pushProgress({ email, fileName: file.name, action: 'failed', error: (e as Error).message })
              await addLogEntry(file.driveId, file.name, file.url, email, 'failed', undefined, (e as Error).message)
            }
          }
        }

      } else if (mode === 'lock' || mode === 'unlock') {
        setTotalOps(targetFiles.length)
        const writersCanShare = mode === 'unlock'
        for (const file of targetFiles) {
          if (abortRef.current) break
          try {
            await api.drive.setWritersCanShare({ fileId: file.driveId, writersCanShare })
            pushProgress({ email: '(文件设置)', fileName: file.name, action: 'modified' })
            await addLogEntry(file.driveId, file.name, file.url, '(文件设置)', 'modified')
          } catch (e: unknown) {
            pushProgress({ email: '(文件设置)', fileName: file.name, action: 'failed', error: (e as Error).message })
            await addLogEntry(file.driveId, file.name, file.url, '(文件设置)', 'failed', undefined, (e as Error).message)
          }
        }

      } else if (mode === 'transfer') {
        // Transfer ownership: ensure editor first, then set owner
        const targetEmail = parseCustomEmails()[0]
        setTotalOps(targetFiles.length)
        for (const file of targetFiles) {
          if (abortRef.current) break
          try {
            const res = await (api.drive as unknown as {
              transferOwnership: (a: { fileId: string; targetEmail: string }) => Promise<{ status: string }>
            }).transferOwnership({ fileId: file.driveId, targetEmail })
            if (res.status === 'already_owner') {
              pushProgress({ email: targetEmail, fileName: file.name, action: 'skipped' })
              await addLogEntry(file.driveId, file.name, file.url, targetEmail, 'skipped', 'owner')
            } else {
              pushProgress({ email: targetEmail, fileName: file.name, action: 'modified' })
              await addLogEntry(file.driveId, file.name, file.url, targetEmail, 'modified', 'owner')
            }
          } catch (e: unknown) {
            pushProgress({ email: targetEmail, fileName: file.name, action: 'failed', error: (e as Error).message })
            await addLogEntry(file.driveId, file.name, file.url, targetEmail, 'failed', undefined, (e as Error).message)
          }
        }

      } else if (mode === 'accept') {
        // Accept ownership: current user accepts pending ownership transfer
        const authStatus = await api.auth.getStatus() as { email: string }
        const userEmail = authStatus.email
        setTotalOps(targetFiles.length)
        for (const file of targetFiles) {
          if (abortRef.current) break
          try {
            const res = await (api.drive as unknown as {
              acceptOwnership: (a: { fileId: string; userEmail: string }) => Promise<{ status: string }>
            }).acceptOwnership({ fileId: file.driveId, userEmail })
            if (res.status === 'already_owner') {
              pushProgress({ email: userEmail, fileName: file.name, action: 'skipped' })
              await addLogEntry(file.driveId, file.name, file.url, userEmail, 'skipped', 'owner')
            } else {
              pushProgress({ email: userEmail, fileName: file.name, action: 'added' })
              await addLogEntry(file.driveId, file.name, file.url, userEmail, 'added', 'owner')
            }
          } catch (e: unknown) {
            pushProgress({ email: userEmail, fileName: file.name, action: 'failed', error: (e as Error).message })
            await addLogEntry(file.driveId, file.name, file.url, userEmail, 'failed', undefined, (e as Error).message)
          }
        }
      }

      setDone(true)
      showToast('操作完成！', 'success')
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    } finally {
      setRunning(false)
    }
  }

  const needsGroup      = mode === 'sync' || mode === 'grant'
  const needsEmails     = mode === 'add' || mode === 'remove' || mode === 'modify'
  const needsRole       = mode === 'add' || mode === 'modify'
  const isLockMode      = mode === 'lock' || mode === 'unlock'
  const isTransferMode  = mode === 'transfer'
  const isAcceptMode    = mode === 'accept'
  const currentMode     = OP_MODES.find(m => m.key === mode)!

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">⚡ 权限操作中心</h1>
          <p className="page-subtitle">选择操作模式，批量管理文件权限</p>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ marginBottom: 24 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>操作模式</div>
        <div className="op-mode-grid">
          {OP_MODES.map(m => (
            <div key={m.key} className={`op-mode-card${mode === m.key ? ' selected' : ''}`}
              onClick={() => setMode(m.key)}>
              <div className="op-mode-card__icon">{m.icon}</div>
              <div className="op-mode-card__title" style={{ color: mode === m.key ? m.color : undefined }}>{m.title}</div>
              <div className="op-mode-card__desc">{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>
        {/* Left: config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Library multi-selector */}
          <div className="card card-body">
            <LibrarySelector
              libraries={libraries}
              selected={selectedLibraryIds}
              onToggle={toggleLibrary}
            />
          </div>

          {/* Group multi-selector (sync/grant) */}
          {needsGroup && (
            <div className="card card-body">
              <GroupMultiSelector
                groups={groups}
                selected={selectedGroupIds}
                onToggle={toggleGroup}
              />
              {/* Merged email preview */}
              {mergedEmails.length > 0 && (
                <div style={{ marginTop: 12, background: 'var(--bg-base)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    合并后共 <strong style={{ color: 'var(--accent-2)' }}>{mergedEmails.length}</strong> 个邮箱
                    {selectedGroupIds.size > 1 && <span style={{ marginLeft: 4 }}>（来自 {selectedGroupIds.size} 个权限库，同邮箱保留最高权限）</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 100, overflowY: 'auto' }}>
                    {mergedEmails.slice(0, 12).map(e => (
                      <div key={e.email} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{e.email}</span>
                        <span className={`badge badge--${e.role === 'editor' ? 'accent' : e.role === 'commenter' ? 'yellow' : 'green'}`} style={{ fontSize: 10, flexShrink: 0 }}>
                          {e.role === 'viewer' ? '查看' : e.role === 'commenter' ? '评论' : '编辑'}
                        </span>
                      </div>
                    ))}
                    {mergedEmails.length > 12 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>...还有 {mergedEmails.length - 12} 个</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* General Access / Link Sharing (sync/grant) */}
          {needsGroup && (
            <div className="card card-body">
              <div className="form-label" style={{ marginBottom: 10 }}>🌐 通用访问权限（链接范围）</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
                设置"任何知道链接的人"的访问范围，与上方指定邮箱权限独立生效
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { value: 'restricted' as const, label: '🔒 受限', desc: '仅指定邮箱可访问（默认推荐）', col: 'var(--red)' },
                  { value: 'viewer'     as const, label: '👁 查看者', desc: '任何知道链接的人可查看', col: 'var(--green)' },
                  { value: 'commenter'  as const, label: '💬 评论者', desc: '任何知道链接的人可评论', col: 'var(--yellow)' },
                  { value: 'editor'     as const, label: '✏️ 编辑者', desc: '任何知道链接的人可编辑', col: 'var(--accent-2)' },
                ].map(opt => (
                  <div key={opt.value} onClick={() => setGeneralAccess(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'all 0.15s',
                      background: generalAccess === opt.value ? 'rgba(123,111,255,0.10)' : 'var(--bg-elevated)',
                      border: `1px solid ${generalAccess === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                    }}>
                    <div className={`checkbox${generalAccess === opt.value ? ' checked' : ''}`} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: generalAccess === opt.value ? opt.col : undefined }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom emails (add/remove/modify) */}
          {needsEmails && (
            <div className="card card-body">
              <div className="form-group">
                <label className="form-label">
                  {mode === 'remove' ? '要移除的邮箱' : mode === 'modify' ? '要修改的邮箱' : '要添加的邮箱'}（换行或逗号分隔）
                </label>
                <textarea className="textarea" style={{ minHeight: 100 }}
                  placeholder="alice@example.com&#10;bob@example.com"
                  value={customEmails} onChange={e => setCustomEmails(e.target.value)} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  已输入 {parseCustomEmails().length} 个有效邮箱
                </div>
              </div>
              {needsRole && (
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label">权限角色</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ROLES.map(r => (
                      <button key={r} className={`btn btn--sm ${targetRole === r ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setTargetRole(r)}>
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transfer Ownership */}
          {isTransferMode && (
            <div className="card card-body" style={{ borderColor: 'rgba(249,115,22,0.35)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 28 }}>👑</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>转让所有权 — 输入接收方邮箱（只能填写 1 个）</div>
                  <div className="form-group" style={{ marginBottom: 6 }}>
                    <textarea className="textarea" style={{ minHeight: 60 }}
                      placeholder="new-owner@example.com（只填一个邮箱）"
                      value={customEmails} onChange={e => setCustomEmails(e.target.value)} />
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {parseCustomEmails().length === 0 && '请输入接收方邮箱'}
                      {parseCustomEmails().length === 1 && <span style={{ color: 'var(--accent-2)' }}>✓ 目标邮箱：{parseCustomEmails()[0]}</span>}
                      {parseCustomEmails().length > 1 && <span style={{ color: 'var(--red)' }}>⚠ 只能填写 1 个邮箱（当前 {parseCustomEmails().length} 个）</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, background: 'var(--bg-base)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                    <strong>执行步骤：</strong><br />
                    ① 检查接收方是否已是编辑者，若不是则先添加为编辑者<br />
                    ② 将文件所有权转让给该邮箱<br />
                    <span style={{ color: 'var(--accent-1)' }}>⚠ 如果接收方是个人 Gmail，对方需要在邮件中点击「接受」后才正式成为所有者</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accept Ownership */}
          {isAcceptMode && (
            <div className="card card-body" style={{ borderColor: 'rgba(20,184,166,0.35)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 28 }}>🤝</div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>接收所有权 — 使用当前登录账号</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    系统将用当前账号尝试接受文件的所有权转让邀请。<br />
                    适用场景：他人已将文件所有权转让给你，你需要通过此功能批量接受。<br />
                    <span style={{ color: 'var(--accent-1)' }}>⚠ 若文件的所有权还未被转让，接收操作会报错，不会影响其他文件。</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lock/Unlock info */}
          {isLockMode && (
            <div className="card card-body" style={{ borderColor: mode === 'lock' ? 'rgba(244,114,182,0.3)' : 'rgba(167,139,250,0.3)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontSize: 28 }}>{mode === 'lock' ? '🔒' : '🔓'}</div>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {mode === 'lock' ? '高级锁表 — 仅所有者可分享' : '解除锁表 — 恢复编辑者分享权限'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {mode === 'lock' ? (
                      <>设置后，即使其他账号拥有<strong>编辑者</strong>权限，也<strong>无法</strong>添加或移除其他人员。<br />
                        只有文件的<strong>所有者（Owner）</strong>才能修改共享设置。</>
                    ) : (
                      <>恢复默认设置，拥有<strong>编辑者</strong>权限的账号可以重新添加/移除其他人员。</>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                将对已选中的 <strong>{targetFiles.length}</strong> 个文件执行此操作
              </div>
            </div>
          )}

          {/* Execute button */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--primary btn--lg" style={{ flex: 1 }}
              onClick={run} disabled={!canRun() || running}>
              {running ? <><Spinner size={16} /> 执行中...</> : `${currentMode.icon} 执行操作`}
            </button>
            {running && (
              <button className="btn btn--danger" onClick={() => { abortRef.current = true }}>
                ⏹ 停止
              </button>
            )}
          </div>

          {/* Operation preview */}
          {!running && canRun() && !done && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
              <strong>操作预览：</strong><br />
              · 目标文件：<strong>{targetFiles.length}</strong> 个
              {selectedLibraryIds.size > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{' '}（来自 {selectedLibraryIds.size} 个表格库）</span>}
              <br />
              {needsGroup && mergedEmails.length > 0 && <>
                · 权限邮箱：<strong>{mergedEmails.length}</strong> 个
                {selectedGroupIds.size > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{' '}（来自 {selectedGroupIds.size} 个权限库）</span>}
                <br />
                {Object.entries(mergedEmails.reduce<Record<string,number>>((acc, e) => { acc[e.role]=(acc[e.role]||0)+1; return acc }, {})).map(([role, count]) => (
                  <span key={role} style={{ marginLeft: 12 }}>
                    {role === 'viewer' ? '查看者' : role === 'commenter' ? '评论者' : '编辑者'}: {count} 人{'  '}
                  </span>
                ))}<br />
              </>}
              {needsEmails && <>· 邮箱：{parseCustomEmails().length} 个<br /></>}
              {needsRole && <>· 角色：{ROLE_LABELS[targetRole]}<br /></>}
              {mode === 'sync' && <><br /><strong style={{ color: 'var(--red)' }}>⚠️ 同步模式将移除不在权限库中的所有成员（owner除外）</strong></>}
            </div>
          )}
        </div>

        {/* Right: progress */}
        <div>
          {(progress.length > 0 || running) && (
            <ProgressPanel items={progress} total={totalOps} done={done && !running} />
          )}
          {!running && !progress.length && (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>{currentMode.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{currentMode.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{currentMode.desc}</div>
              <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
                请在左侧选择表格库{needsGroup ? '和权限库' : ''}后点击执行
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
