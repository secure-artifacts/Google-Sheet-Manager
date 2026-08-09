import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { PermissionGroup, EmailEntry, Role } from '../types'
import { Modal, ConfirmDialog, EmptyState, showToast } from '../components/ui'

const COLORS = ['#7b6fff', '#22d3a0', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#fb923c']
const ROLES: { value: Role; label: string; icon: string; color: string }[] = [
  { value: 'viewer',    label: '查看者', icon: '👁',  color: 'var(--green)' },
  { value: 'commenter', label: '评论者', icon: '💬', color: 'var(--yellow)' },
  { value: 'editor',   label: '编辑者', icon: '✏️',  color: 'var(--accent-2)' }
]

const ROLE_COLORS: Record<Role, string> = { viewer: 'green', commenter: 'yellow', editor: 'accent' }

function genId() { return `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
function isValidEmail(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) }

function RoleToggle({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: 'var(--bg-base)', borderRadius: 6, padding: 2 }}>
      {ROLES.map(r => (
        <button key={r.value} onClick={() => onChange(r.value)}
          style={{
            padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11,
            background: value === r.value ? r.color : 'transparent',
            color: value === r.value ? '#fff' : 'var(--text-muted)',
            fontWeight: value === r.value ? 700 : 400, transition: 'all 0.15s'
          }}>
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function GroupCard({ group, onOpen, onDelete }: {
  group: PermissionGroup; onOpen: () => void; onDelete: () => void
}) {
  // Count roles
  const roleCount = group.emails.reduce<Record<string, number>>((acc, e) => {
    acc[e.role] = (acc[e.role] || 0) + 1; return acc
  }, {})

  return (
    <div className="library-card" onClick={onOpen}>
      <div className="library-card__accent" style={{ background: group.color }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 24 }}>👥</div>
        <button className="btn btn--ghost btn--icon btn--sm"
          onClick={e => { e.stopPropagation(); onDelete() }} style={{ opacity: 0.5 }}>🗑</button>
      </div>
      <div className="library-card__name">{group.name}</div>
      <div className="library-card__desc">{group.description || '暂无描述'}</div>
      <div className="library-card__stats">
        <div className="library-card__stat">邮箱 <span>{group.emails.length}</span></div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 'auto' }}>
          {ROLES.filter(r => roleCount[r.value]).map(r => (
            <span key={r.value} className={`badge badge--${ROLE_COLORS[r.value]}`} style={{ fontSize: 10 }}>
              {r.label} {roleCount[r.value]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Create Group Modal ────────────────────────────────────────────────────────
function CreateGroupModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: (g: PermissionGroup) => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const [color, setColor] = useState(COLORS[2])

  const handleCreate = () => {
    if (!name.trim()) return
    onCreated({
      id: genId(), name: name.trim(), description: desc.trim(),
      color, defaultRole: role, emails: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    })
    setName(''); setDesc(''); setColor(COLORS[2]); setRole('editor')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="新建权限组"
      footer={<>
        <button className="btn btn--secondary" onClick={onClose}>取消</button>
        <button className="btn btn--primary" onClick={handleCreate} disabled={!name.trim()}>创建</button>
      </>}>
      <div className="form-group">
        <label className="form-label">组名称 *</label>
        <input className="input" placeholder="例：销售团队" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">描述（可选）</label>
        <input className="input" placeholder="简短描述..." value={desc} onChange={e => setDesc(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">新增邮箱时的默认角色</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ROLES.map(r => (
            <label key={r.value} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'all 0.15s',
              border: `1px solid ${role === r.value ? 'var(--accent)' : 'var(--border)'}`,
              background: role === r.value ? 'rgba(123,111,255,0.08)' : 'var(--bg-elevated)'
            }}>
              <input type="radio" style={{ display: 'none' }} checked={role === r.value} onChange={() => setRole(r.value)} />
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${role === r.value ? 'var(--accent)' : 'var(--border-active)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {role === r.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
              </div>
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{r.icon} {r.label}</div></div>
            </label>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">颜色标签</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{
              width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === c ? '2px solid #fff' : '2px solid transparent',
              boxShadow: color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s'
            }} />
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Group Detail Modal ────────────────────────────────────────────────────────
function GroupDetailModal({ group, open, onClose, onUpdate }: {
  group: PermissionGroup; open: boolean; onClose: () => void; onUpdate: (g: PermissionGroup) => void
}) {
  const [emailInput, setEmailInput] = useState('')
  const [addRole, setAddRole] = useState<Role>(group.defaultRole)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all')

  const addEmails = () => {
    const raw = emailInput.split(/[\n,;，；\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean)
    const valid = raw.filter(isValidEmail)
    const invalid = raw.filter(e => !isValidEmail(e))
    const existingEmails = new Set(group.emails.map(e => e.email))
    const toAdd: EmailEntry[] = valid.filter(e => !existingEmails.has(e)).map(e => ({ email: e, role: addRole }))
    onUpdate({ ...group, emails: [...group.emails, ...toAdd], updatedAt: new Date().toISOString() })
    setEmailInput('')
    if (toAdd.length) showToast(`已添加 ${toAdd.length} 个邮箱（${ROLES.find(r => r.value === addRole)?.label}）`, 'success')
    if (valid.length - toAdd.length > 0) showToast(`${valid.length - toAdd.length} 个邮箱已存在`, 'info')
    if (invalid.length) showToast(`${invalid.length} 个格式无效已跳过`, 'error')
  }

  const removeEmail = (email: string) => {
    onUpdate({ ...group, emails: group.emails.filter(e => e.email !== email), updatedAt: new Date().toISOString() })
  }

  const changeEmailRole = (email: string, role: Role) => {
    onUpdate({
      ...group,
      emails: group.emails.map(e => e.email === email ? { ...e, role } : e),
      updatedAt: new Date().toISOString()
    })
  }

  const setAllRole = (role: Role) => {
    onUpdate({ ...group, defaultRole: role, emails: group.emails.map(e => ({ ...e, role })), updatedAt: new Date().toISOString() })
    showToast(`已将所有邮箱设为：${ROLES.find(r => r.value === role)?.label}`, 'success')
  }

  const importCsv = (text: string) => {
    const existingEmails = new Set(group.emails.map(e => e.email))
    const emails = text.split(/[\n,;，；\s]+/).map(e => e.trim().toLowerCase()).filter(isValidEmail)
    const toAdd: EmailEntry[] = emails.filter(e => !existingEmails.has(e)).map(e => ({ email: e, role: addRole }))
    onUpdate({ ...group, emails: [...group.emails, ...toAdd], updatedAt: new Date().toISOString() })
    showToast(`已导入 ${toAdd.length} 个邮箱`, 'success')
  }

  const filtered = group.emails.filter(e => {
    if (filterRole !== 'all' && e.role !== filterRole) return false
    return !search || e.email.includes(search.toLowerCase())
  })

  const roleCount = group.emails.reduce<Record<string, number>>((acc, e) => {
    acc[e.role] = (acc[e.role] || 0) + 1; return acc
  }, {})

  return (
    <Modal open={open} onClose={onClose} title={`${group.name} — 邮箱权限管理`} wide>

      {/* Add emails section */}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>添加邮箱</div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <textarea className="textarea" style={{ minHeight: 70 }}
            placeholder="alice@example.com&#10;bob@example.com, carol@example.com"
            value={emailInput} onChange={e => setEmailInput(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>添加角色：</span>
          <RoleToggle value={addRole} onChange={setAddRole} />
          <button className="btn btn--primary btn--sm" onClick={addEmails} disabled={!emailInput.trim()}>
            ＋ 添加
          </button>
          <label style={{ display: 'inline-flex', alignItems: 'center' }}>
            <input type="file" accept=".csv,.txt" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]; if (!file) return
                const reader = new FileReader()
                reader.onload = ev => importCsv(ev.target?.result as string)
                reader.readAsText(file)
              }} />
            <span className="btn btn--secondary btn--sm">📄 导入 CSV</span>
          </label>
        </div>
      </div>

      <div className="divider" />

      {/* Email list header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          邮箱列表（{group.emails.length}）
        </div>
        {/* Role filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button className={`btn btn--sm ${filterRole === 'all' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setFilterRole('all')}>全部</button>
          {ROLES.filter(r => roleCount[r.value]).map(r => (
            <button key={r.value} className={`btn btn--sm ${filterRole === r.value ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setFilterRole(filterRole === r.value ? 'all' : r.value)}>
              {r.label} ({roleCount[r.value]})
            </button>
          ))}
        </div>
        {/* Batch set all */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>全部改为：</span>
          {ROLES.map(r => (
            <button key={r.value} className="btn btn--ghost btn--sm" onClick={() => setAllRole(r.value)}
              style={{ fontSize: 11 }}>{r.icon} {r.label}</button>
          ))}
        </div>
      </div>

      {/* Search */}
      {group.emails.length > 5 && (
        <div className="search-wrap" style={{ marginBottom: 10 }}>
          <span className="search-icon">🔍</span>
          <input className="input" style={{ fontSize: 12 }} placeholder="搜索邮箱..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* Email list */}
      {group.emails.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
          暂无邮箱，请使用上方输入框添加
        </div>
      ) : (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {filtered.map(entry => (
            <div key={entry.email} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderBottom: '1px solid var(--border)', minWidth: 0
            }}>
              <span style={{ fontSize: 13 }}>📧</span>
              <span style={{ flex: 1, fontSize: 13, wordBreak: 'break-all', minWidth: 0 }}>{entry.email}</span>
              <RoleToggle value={entry.role} onChange={role => changeEmailRole(entry.email, role)} />
              <button className="btn btn--ghost btn--icon btn--sm" style={{ opacity: 0.5, flexShrink: 0 }}
                onClick={() => removeEmail(entry.email)}>✕</button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>
              无匹配结果
            </div>
          )}
        </div>
      )}

      {/* Copy */}
      {group.emails.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => {
            navigator.clipboard.writeText(group.emails.map(e => e.email).join('\n'))
            showToast('已复制全部邮箱', 'success')
          }}>📋 复制全部邮箱</button>
        </div>
      )}
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Permissions() {
  const { groups, saveGroups } = useApp()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<PermissionGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PermissionGroup | null>(null)

  const handleCreate = async (g: PermissionGroup) => {
    await saveGroups([...groups, g])
    showToast('权限组已创建', 'success')
  }

  const handleUpdate = async (updated: PermissionGroup) => {
    await saveGroups(groups.map(g => g.id === updated.id ? updated : g))
    if (selectedGroup?.id === updated.id) setSelectedGroup(updated)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await saveGroups(groups.filter(g => g.id !== deleteTarget.id))
    showToast('权限组已删除', 'success')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">👥 权限库</h1>
          <p className="page-subtitle">管理邮箱权限组，每个邮箱可单独设置查看/评论/编辑权限</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setCreateOpen(true)}>＋ 新建权限组</button>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="👥" title="暂无权限组" desc="创建您的第一个权限组，可为每个邮箱单独设置权限角色"
          action={<button className="btn btn--primary" onClick={() => setCreateOpen(true)}>＋ 新建权限组</button>} />
      ) : (
        <div className="grid-3">
          {groups.map(g => (
            <GroupCard key={g.id} group={g}
              onOpen={() => setSelectedGroup(g)}
              onDelete={() => setDeleteTarget(g)} />
          ))}
        </div>
      )}

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreate} />

      {selectedGroup && (
        <GroupDetailModal group={selectedGroup} open={!!selectedGroup}
          onClose={() => setSelectedGroup(null)} onUpdate={handleUpdate} />
      )}

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete} title="删除权限组" danger
        message={`确定要删除「${deleteTarget?.name}」吗？该操作不可恢复。`} />
    </div>
  )
}
