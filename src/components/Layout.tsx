import { NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { eAPI } from '../lib/api'

const navItems = [
  { path: '/', icon: '🏠', label: '概览', exact: true },
  { path: '/libraries', icon: '🗂️', label: '表格库' },
  { path: '/permissions', icon: '👥', label: '权限库' },
  { path: '/sync', icon: '⚡', label: '权限操作' },
  { path: '/logs', icon: '📋', label: '操作日志' },
  { path: '/settings', icon: '⚙️', label: '设置' }
]

const api = eAPI()

export function TitleBar() {
  return (
    <div className="title-bar">
      <div className="title-bar__logo">
        <div className="title-bar__logo-icon">📊</div>
        <span className="title-bar__logo-text">Sheet Manager</span>
      </div>
      <div className="title-bar__controls">
        <button className="title-bar__btn" onClick={() => api.minimize()} title="最小化">─</button>
        <button className="title-bar__btn" onClick={() => api.maximize()} title="最大化">□</button>
        <button className="title-bar__btn title-bar__btn--close" onClick={() => api.close()} title="关闭">✕</button>
      </div>
    </div>
  )
}

export function Sidebar() {
  const { auth } = useApp()

  const initial = auth.name ? auth.name.charAt(0).toUpperCase() : '?'

  return (
    <aside className="sidebar">
      <div className="sidebar__section" style={{ flex: 1 }}>
        <div style={{ marginBottom: 4 }} />
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) => `sidebar__nav-item${isActive ? ' active' : ''}`}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar__footer">
        {auth.isAuthenticated && (
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {auth.photo
                ? <img src={auth.photo} alt={auth.name || ''} referrerPolicy="no-referrer" />
                : initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar__user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {auth.name || '用户'}
              </div>
              <div className="sidebar__user-email" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {auth.email}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
