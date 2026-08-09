import { useState, useEffect } from 'react'
import { ReactNode } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let toastHandlers: ((toast: Toast) => void)[] = []

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast: Toast = { id: Date.now().toString(), message, type }
  toastHandlers.forEach(h => h(toast))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (toast: Toast) => {
      setToasts(prev => [...prev, toast])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 3500)
    }
    toastHandlers.push(handler)
    return () => { toastHandlers = toastHandlers.filter(h => h !== handler) }
  }, [])

  const icons = { success: '✅', error: '❌', info: 'ℹ️' }

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span>{icons[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal${wide ? ' modal--wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  danger?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <button className="btn btn--secondary" onClick={onClose}>取消</button>
        <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={() => { onConfirm(); onClose() }}>
          确认
        </button>
      </>}>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid rgba(255,255,255,0.1)`,
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0
    }} />
  )
}

interface CheckboxProps {
  checked: boolean
  onChange: (v: boolean) => void
}

export function Checkbox({ checked, onChange }: CheckboxProps) {
  return (
    <div className={`checkbox${checked ? ' checked' : ''}`}
      onClick={() => onChange(!checked)} />
  )
}

export function EmptyState({ icon, title, desc, action }: {
  icon: string; title: string; desc: string; action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <div className="empty-state__title">{title}</div>
      <p className="empty-state__desc">{desc}</p>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    editor: '编辑者', viewer: '查看者', commenter: '评论者', owner: '所有者'
  }
  return (
    <span className={`badge role-${role}`}>{labels[role] || role}</span>
  )
}

export function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const isSheet = mimeType?.includes('spreadsheet')
  return (
    <div className={`file-icon ${isSheet ? 'file-icon--sheet' : 'file-icon--doc'}`}>
      {isSheet ? '📊' : '📄'}
    </div>
  )
}
