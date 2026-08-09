import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { libraries, groups, logs, auth } = useApp()
  const navigate = useNavigate()

  const totalFiles = libraries.reduce((s, l) => s + l.files.length, 0)
  const totalEmails = groups.reduce((s, g) => s + g.emails.length, 0)
  const recentLogs = logs.slice(0, 8)

  const stats = [
    { icon: '🗂️', label: '表格库', value: libraries.length, color: '#7b6fff', glow: '#7b6fff' },
    { icon: '📊', label: '管理文件', value: totalFiles, color: '#22d3a0', glow: '#22d3a0' },
    { icon: '👥', label: '权限组', value: groups.length, color: '#60a5fa', glow: '#60a5fa' },
    { icon: '📧', label: '邮箱总数', value: totalEmails, color: '#fbbf24', glow: '#fbbf24' }
  ]

  const quickActions = [
    { icon: '⚡', label: '一键权限同步', desc: '快速执行权限同步操作', path: '/sync', color: '#7b6fff' },
    { icon: '🗂️', label: '新建表格库', desc: '创建并管理表格分组', path: '/libraries', color: '#22d3a0' },
    { icon: '👥', label: '管理权限库', desc: '配置邮箱权限组', path: '/permissions', color: '#60a5fa' },
    { icon: '📋', label: '查看操作日志', desc: '追溯所有历史操作', path: '/logs', color: '#fbbf24' }
  ]

  const actionColors: Record<string, string> = {
    added: 'green', removed: 'red', modified: 'blue', skipped: 'gray', failed: 'red'
  }
  const actionLabels: Record<string, string> = {
    added: '已添加', removed: '已移除', modified: '已修改', skipped: '已跳过', failed: '失败'
  }

  return (
    <div className="page">
      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">
          👋 你好，{auth.name?.split(' ')[0] || '用户'}
        </h1>
        <p className="page-subtitle">使用 Google Sheet Manager 统一管理您的文件权限</p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {stats.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-card__glow" style={{ background: s.glow }} />
            <div className="stat-card__icon" style={{ background: `${s.color}18` }}>
              {s.icon}
            </div>
            <div className="stat-card__value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Quick Actions */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            快捷操作
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quickActions.map(a => (
              <div key={a.path} className="card"
                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                onClick={() => navigate(a.path)}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--r-md)',
                  background: `${a.color}18`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, flexShrink: 0
                }}>{a.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.desc}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 16 }}>›</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Logs */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            最近操作
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {recentLogs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                暂无操作记录
              </div>
            ) : (
              recentLogs.map(log => (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', borderBottom: '1px solid var(--border)'
                }}>
                  <span className={`badge badge--${actionColors[log.action] || 'gray'}`}>
                    {actionLabels[log.action] || log.action}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.email}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.fileName}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {new Date(log.timestamp).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
