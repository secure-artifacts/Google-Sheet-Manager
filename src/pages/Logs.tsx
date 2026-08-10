import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { LogEntry, OperationMode } from '../types'
import { EmptyState, RoleBadge } from '../components/ui'
import { eAPI } from '../lib/api'

const MODE_LABELS: Record<OperationMode, string> = {
  sync: '一键同步', grant: '批量授权', add: '添加邮箱', remove: '移除邮箱', modify: '修改角色',
  lock: '高级锁表', unlock: '解除锁表', transfer: '转让所有权', accept: '接收所有权'
}
const ACTION_COLORS: Record<string, string> = {
  added: 'green', removed: 'red', modified: 'blue', skipped: 'gray', failed: 'red'
}
const ACTION_LABELS: Record<string, string> = {
  added: '已添加', removed: '已移除', modified: '已修改', skipped: '已跳过', failed: '失败'
}

export default function Logs() {
  const { logs } = useApp()
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (modeFilter !== 'all' && l.mode !== modeFilter) return false
      if (actionFilter !== 'all' && l.action !== actionFilter) return false
      if (search && !l.email.includes(search) && !l.fileName.includes(search)) return false
      return true
    })
  }, [logs, modeFilter, actionFilter, search])

  const paginated = filtered.slice(0, page * PAGE_SIZE)

  const exportCsv = () => {
    const header = 'timestamp,mode,action,email,role,fileName,fileUrl,error\n'
    const rows = filtered.map(l =>
      `${l.timestamp},${l.modeLabel},${l.action},${l.email},${l.role || ''},${JSON.stringify(l.fileName)},${l.fileUrl},${l.error || ''}`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sheet-manager-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const stats = {
    total: logs.length,
    added: logs.filter(l => l.action === 'added').length,
    removed: logs.filter(l => l.action === 'removed').length,
    failed: logs.filter(l => l.action === 'failed').length
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">📋 操作日志</h1>
          <p className="page-subtitle">所有权限操作的完整历史记录（最近 2000 条）</p>
        </div>
        <div className="page-header__actions">
          {logs.length > 0 && (
            <button className="btn btn--secondary" onClick={exportCsv}>
              📥 导出 CSV
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {logs.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="badge badge--gray" style={{ padding: '6px 12px', fontSize: 12 }}>共 {stats.total} 条记录</div>
          <div className="badge badge--green" style={{ padding: '6px 12px', fontSize: 12 }}>✅ {stats.added} 次添加</div>
          <div className="badge badge--red" style={{ padding: '6px 12px', fontSize: 12 }}>🗑 {stats.removed} 次移除</div>
          {stats.failed > 0 && <div className="badge badge--red" style={{ padding: '6px 12px', fontSize: 12 }}>❌ {stats.failed} 次失败</div>}
        </div>
      )}

      {/* Filters */}
      {logs.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <span className="search-icon">🔍</span>
            <input className="input" placeholder="搜索邮箱或文件名..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="select" style={{ width: 'auto' }} value={modeFilter} onChange={e => { setModeFilter(e.target.value); setPage(1) }}>
            <option value="all">全部模式</option>
            {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="select" style={{ width: 'auto' }} value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }}>
            <option value="all">全部操作</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}

      {logs.length === 0 ? (
        <EmptyState icon="📋" title="暂无操作记录" desc="执行权限操作后，所有操作记录将显示在这里" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作模式</th>
                  <th>结果</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>文件名</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                      {new Date(log.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <span className="badge badge--accent" style={{ fontSize: 11 }}>{log.modeLabel}</span>
                    </td>
                    <td>
                      <span className={`badge badge--${ACTION_COLORS[log.action] || 'gray'}`} style={{ fontSize: 11 }}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      {log.error && (
                        <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }} title={log.error}>
                          {log.error.slice(0, 40)}...
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{log.email}</td>
                    <td>{log.role && <RoleBadge role={log.role} />}</td>
                    <td>
                      <a href={log.fileUrl} onClick={e => { e.preventDefault(); eAPI().shell.openExternal(log.fileUrl) }}
                        style={{ color: 'var(--accent-2)', textDecoration: 'none', fontSize: 12 }}
                        title={log.fileName}>
                        {log.fileName.length > 30 ? log.fileName.slice(0, 30) + '…' : log.fileName}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > paginated.length && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn btn--secondary" onClick={() => setPage(p => p + 1)}>
                加载更多（已显示 {paginated.length} / {filtered.length}）
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              无匹配记录
            </div>
          )}
        </>
      )}
    </div>
  )
}
