import { useState } from 'react'
import { eAPI } from '../lib/api'
import { Spinner, showToast } from '../components/ui'
import { useApp } from '../context/AppContext'

// eAPI from ../lib/api

export default function Login() {
  const { checkAuth } = useApp()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'check' | 'login'>('check')

  const handleLogin = async () => {
    setLoading(true)
    try {
      const api = eAPI()
      const cfg = await api.auth.getOAuthConfig() as { hasConfig: boolean }
      if (!cfg.hasConfig) {
        showToast('请先在设置页面配置 Google OAuth Client ID 和 Secret', 'error')
        setLoading(false)
        return
      }
      await api.auth.login()
      await checkAuth()
      showToast('登录成功！', 'success')
    } catch (e: unknown) {
      showToast((e as Error).message || '登录失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48, display: 'flex', justifyContent: 'flex-end', padding: '0 12px', alignItems: 'center' }}>
        <div className="title-bar__controls" style={{ display: 'flex', gap: 4 }}>
          <button className="title-bar__btn" onClick={() => eAPI().minimize?.()}>─</button>
          <button className="title-bar__btn" onClick={() => eAPI().maximize?.()}>□</button>
          <button className="title-bar__btn title-bar__btn--close" onClick={() => eAPI().close?.()}>✕</button>
        </div>
      </div>

      <div className="login-card" style={{ animation: 'slideUp 0.4s ease' }}>
        <div className="login-logo">📊</div>
        <div className="login-title">Sheet Manager</div>
        <p className="login-subtitle">
          Google 表格权限批量管理工具<br />
          管理您的表格库，批量配置分享权限
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn btn--primary btn--lg" style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleLogin} disabled={loading}>
            {loading ? <><Spinner size={16} /> 等待 Google 授权...</> : '🔑 使用 Google 账号登录'}
          </button>
        </div>

        <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'left', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>首次使用？</strong><br />
          请先在<strong> 设置 </strong>页面配置您的 Google OAuth 凭据，才能正常登录。
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn--ghost btn--sm" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setStep('login')}>
            ⚙️ 跳转到设置页面配置 OAuth
          </button>
        </div>
      </div>
    </div>
  )
}
