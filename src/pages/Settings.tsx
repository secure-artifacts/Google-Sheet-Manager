import { useState, useEffect } from 'react'
import { eAPI } from '../lib/api'
import { useApp } from '../context/AppContext'
import { Spinner, showToast } from '../components/ui'

// eAPI from ../lib/api

export default function Settings() {
  const { auth, checkAuth } = useApp()
  const api = eAPI()

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logging, setLogging] = useState(false)
  const [inputMode, setInputMode] = useState<'json' | 'manual'>('json')
  const [jsonFileName, setJsonFileName] = useState('')
  const [configSaved, setConfigSaved] = useState(false)

  useEffect(() => {
    api.auth.getOAuthConfig().then((cfg: unknown) => {
      const c = cfg as { hasConfig: boolean; clientId: string }
      if (c.clientId) {
        setClientId(c.clientId)
        setConfigSaved(true)
      }
    })
  }, [])

  // Parse the downloaded credentials JSON from Google Cloud Console
  const handleJsonFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string)
        // Google credentials JSON has two possible shapes
        const installed = raw.installed || raw.web
        if (!installed?.client_id || !installed?.client_secret) {
          showToast('JSON 文件格式不正确，请确认是从 Google Cloud Console 下载的凭据文件', 'error')
          return
        }
        setClientId(installed.client_id)
        setClientSecret(installed.client_secret)
        setJsonFileName(file.name)
        showToast('凭据文件解析成功，请点击「保存并启用」', 'success')
      } catch {
        showToast('文件解析失败，请确认是有效的 JSON 文件', 'error')
      }
    }
    reader.readAsText(file)
  }

  const saveOAuth = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      showToast('请先导入凭据文件或填写 Client ID 和 Secret', 'error'); return
    }
    setSaving(true)
    try {
      await api.auth.saveOAuthConfig({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
      showToast('✅ 配置已保存！现在可以登录了', 'success')
      setConfigSaved(true)
      setClientSecret('')
    } catch {
      showToast('保存失败', 'error')
    } finally { setSaving(false) }
  }

  const handleLogin = async () => {
    setLogging(true)
    try {
      await api.auth.login()
      await checkAuth()
      showToast('登录成功！', 'success')
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    } finally { setLogging(false) }
  }

  const handleLogout = async () => {
    await api.auth.logout()
    await checkAuth()
    showToast('已退出登录', 'info')
  }

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">⚙️ 设置</h1>
          <p className="page-subtitle">配置 Google OAuth 连接</p>
        </div>
      </div>

      {/* Step 1: OAuth Config */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: configSaved ? 'var(--green)' : 'var(--accent-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700
            }}>
              {configSaved ? '✓' : '1'}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>配置 Google OAuth 凭据</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {configSaved ? `已配置 Client ID: ${clientId.slice(0, 20)}...` : '导入从 Google Cloud Console 下载的凭据文件'}
              </div>
            </div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Method toggle */}
          <div className="tabs">
            <button className={`tab${inputMode === 'json' ? ' active' : ''}`} onClick={() => setInputMode('json')}>
              📄 导入 JSON 文件（推荐）
            </button>
            <button className={`tab${inputMode === 'manual' ? ' active' : ''}`} onClick={() => setInputMode('manual')}>
              ✏️ 手动填写
            </button>
          </div>

          {inputMode === 'json' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* How to get JSON */}
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '14px 16px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>📋 如何获取凭据 JSON 文件：</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>① 访问 <a href="#" onClick={() => api.shell.openExternal('https://console.cloud.google.com/')} style={{ color: 'var(--accent-2)' }}>Google Cloud Console</a> → 创建/选择项目</div>
                  <div>② 左侧「API 和服务」→「已启用的 API」→ 启用 <strong>Google Drive API</strong></div>
                  <div>③ 左侧「凭据」→「创建凭据」→「OAuth 2.0 客户端 ID」</div>
                  <div>④ 应用类型选 <strong>「桌面应用」</strong>，名称随意填</div>
                  <div>⑤ 创建后，点击 <strong>「⬇ 下载 JSON」</strong> 按钮</div>
                  <div>⑥ 将下载的 JSON 文件导入下方 👇</div>
                </div>
              </div>

              {/* JSON file drop zone */}
              <label style={{ display: 'block' }}>
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleJsonFile(f) }}
                />
                <div style={{
                  border: `2px dashed ${jsonFileName ? 'var(--green)' : 'var(--border-active)'}`,
                  borderRadius: 'var(--r-lg)',
                  padding: '28px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: jsonFileName ? 'var(--green-bg)' : 'var(--bg-elevated)',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>
                    {jsonFileName ? '✅' : '📂'}
                  </div>
                  {jsonFileName ? (
                    <>
                      <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                        {jsonFileName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Client ID: {clientId.slice(0, 30)}...
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        点击重新选择文件
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>点击选择 credentials JSON 文件</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        从 Google Cloud Console 下载的 client_secret_xxx.json
                      </div>
                    </>
                  )}
                </div>
              </label>
            </div>
          )}

          {inputMode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                在 Google Cloud Console → 凭据 → 点击您的 OAuth 客户端 → 复制 Client ID 和 Client Secret 填入下方
              </div>
              <div className="form-group">
                <label className="form-label">Client ID</label>
                <input className="input" placeholder="xxxxxx.apps.googleusercontent.com"
                  value={clientId} onChange={e => setClientId(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Client Secret</label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showSecret ? 'text' : 'password'}
                    placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxx"
                    value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                    style={{ paddingRight: 40 }} />
                  <button className="btn btn--ghost btn--icon btn--sm"
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}
                    onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          {(clientId && clientSecret) && (
            <button className="btn btn--primary" onClick={saveOAuth} disabled={saving}>
              {saving ? <><Spinner size={14} /> 保存中...</> : '💾 保存并启用'}
            </button>
          )}
        </div>
      </div>

      {/* Step 2: Login */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: auth.isAuthenticated ? 'var(--green)' : 'var(--accent-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700
            }}>
              {auth.isAuthenticated ? '✓' : '2'}
            </div>
            <div>
              <div style={{ fontWeight: 700 }}>Google 账号授权</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {auth.isAuthenticated ? `已登录为 ${auth.email}` : '点击下方按钮，在浏览器中完成 Google 授权'}
              </div>
            </div>
          </div>
        </div>
        <div className="card-body">
          {auth.isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
                background: 'var(--accent-grad)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0
              }}>
                {auth.photo
                  ? <img src={auth.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" alt="" />
                  : auth.name?.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{auth.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{auth.email}</div>
              </div>
              <button className="btn btn--danger btn--sm" onClick={handleLogout}>退出登录</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!configSaved && (
                <div style={{ padding: '10px 14px', background: 'var(--yellow-bg)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--yellow)' }}>
                  ⚠️ 请先完成第 1 步，导入凭据文件并保存
                </div>
              )}
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                点击下方按钮 → 浏览器弹出 Google 授权页面 → 选择您的账号并点击「允许」→ 自动返回应用
              </p>
              <div>
                <button className="btn btn--primary btn--lg" onClick={handleLogin} disabled={logging || !configSaved}>
                  {logging
                    ? <><Spinner size={16} /> 等待授权，请在浏览器中操作...</>
                    : '🔑 点击授权 Google 账号'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test users hint */}
      {!auth.isAuthenticated && configSaved && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.04)' }}>
          <div className="card-body">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠️ 遇到「403: access_denied」错误？</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              这是因为您的 OAuth 应用处于「测试模式」，需要将您的 Google 邮箱添加为测试用户：<br />
              <strong>Google Cloud Console</strong> → OAuth 同意屏幕 → 测试用户 → 「＋ 添加用户」→ 填入您的 Gmail
            </div>
          </div>
        </div>
      )}

      {/* Data location */}
      <div className="card">
        <div className="card-header">
          <div style={{ fontWeight: 700 }}>📁 数据存储位置</div>
        </div>
        <div className="card-body">
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            %USERPROFILE%\.google-sheet-manager\
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.6 }}>
            所有表格库、权限库和操作日志数据均以 JSON 格式保存在上述目录中。可手动备份此目录以保存数据。
          </p>
        </div>
      </div>
    </div>
  )
}
