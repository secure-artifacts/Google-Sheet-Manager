import './index.css'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { TitleBar, Sidebar } from './components/Layout'
import { ToastContainer } from './components/ui'
import Dashboard from './pages/Dashboard'
import Libraries from './pages/Libraries'
import Permissions from './pages/Permissions'
import Sync from './pages/Sync'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import Login from './pages/Login'

function AppShell() {
  const { auth, loading } = useApp()

  if (loading) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-full">
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
          <div style={{ fontSize: 14 }}>正在加载...</div>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <>
        <Settings />
        <ToastContainer />
      </>
    )
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/libraries" element={<Libraries />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/sync" element={<Sync />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </HashRouter>
  )
}
