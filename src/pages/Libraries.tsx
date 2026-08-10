import { useState } from 'react'
import { eAPI } from '../lib/api'
import { useApp } from '../context/AppContext'
import { FileLibrary, LibraryFile } from '../types'
import { Modal, ConfirmDialog, EmptyState, FileTypeIcon, Spinner, showToast } from '../components/ui'

// eAPI imported from ../lib/api

const COLORS = ['#7b6fff', '#22d3a0', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#34d399', '#fb923c']

function genId() { return `lib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
function mimeToType(mime: string): 'spreadsheet' | 'document' {
  return mime?.includes('spreadsheet') ? 'spreadsheet' : 'document'
}

// ─── Library Card ─────────────────────────────────────────────────────────────
function LibraryCard({ lib, onOpen, onDelete, onExport }: {
  lib: FileLibrary
  onOpen: () => void
  onDelete: () => void
  onExport: () => void
}) {
  return (
    <div className="library-card" onClick={onOpen}>
      <div className="library-card__accent" style={{ background: lib.color }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 24 }}>🗂️</div>
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn--ghost btn--sm" title="导出到表格"
            onClick={e => { e.stopPropagation(); onExport() }}
            style={{ fontSize: 12, padding: '3px 8px' }}>📤 导出</button>
          <button className="btn btn--ghost btn--icon btn--sm"
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ opacity: 0.5 }}>🗑</button>
        </div>
      </div>
      <div className="library-card__name">{lib.name}</div>
      <div className="library-card__desc">{lib.description || '暂无描述'}</div>
      <div className="library-card__stats">
        <div className="library-card__stat">文件 <span>{lib.files.length}</span></div>
        <div className="library-card__stat">创建于 <span>{new Date(lib.createdAt).toLocaleDateString('zh-CN')}</span></div>
      </div>
    </div>
  )
}

// ─── Export Library Modal ──────────────────────────────────────────────────────
function ExportLibraryModal({ lib, open, onClose }: {
  lib: FileLibrary | null
  open: boolean
  onClose: () => void
}) {
  const [sheetUrl, setSheetUrl] = useState('')
  const [sheetName, setSheetName] = useState('Sheet1')
  const [includeHeader, setIncludeHeader] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null)
  const api = eAPI()

  // Extract spreadsheet ID from URL
  const extractSheetId = (url: string): string | null => {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)
    return m ? m[1] : null
  }

  const handleExport = async () => {
    if (!lib || !lib.files.length) { showToast('库中没有文件', 'error'); return }
    const spreadsheetId = extractSheetId(sheetUrl)
    if (!spreadsheetId) { showToast('请输入有效的 Google Sheet 链接', 'error'); return }
    if (!sheetName.trim()) { showToast('请输入分表名称', 'error'); return }

    setExporting(true)
    setProgress(null)

    const unsubscribe = (api as unknown as {
      sheets: { onExportProgress: (cb: (d: { current: number; total: number; name: string }) => void) => () => void }
    }).sheets.onExportProgress((d) => setProgress(d))

    try {
      const result = await (api as unknown as {
        sheets: { exportLibrary: (args: { files: { driveId: string; name: string; url: string }[]; spreadsheetId: string; sheetName: string; includeHeader: boolean }) => Promise<{ rowsWritten: number }> }
      }).sheets.exportLibrary({
        files: lib.files.map(f => ({ driveId: f.driveId, name: f.name, url: f.url })),
        spreadsheetId,
        sheetName: sheetName.trim(),
        includeHeader
      })
      showToast(`✅ 导出成功！共写入 ${result.rowsWritten} 行`, 'success')
      onClose()
    } catch (e: unknown) {
      showToast(`导出失败: ${(e as Error).message}`, 'error')
    } finally {
      unsubscribe()
      setExporting(false)
      setProgress(null)
    }
  }

  if (!lib) return null

  return (
    <Modal open={open} onClose={onClose} title={`📤 导出「${lib.name}」到表格`}
      footer={<>
        <button className="btn btn--secondary" onClick={onClose} disabled={exporting}>取消</button>
        <button className="btn btn--primary" onClick={handleExport}
          disabled={exporting || !sheetUrl.trim() || !sheetName.trim()}>
          {exporting ? <><Spinner size={14} /> 导出中...</> : '📤 开始导出'}
        </button>
      </>}>

      {/* Target sheet URL */}
      <div className="form-group">
        <label className="form-label">目标 Google Sheet 链接 *</label>
        <input className="input" placeholder="https://docs.google.com/spreadsheets/d/..."
          value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} disabled={exporting} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          请确保该表格已向当前账号开放编辑权限
        </div>
      </div>

      {/* Sheet name */}
      <div className="form-group">
        <label className="form-label">分表名称（Tab 名称）</label>
        <input className="input" placeholder="Sheet1"
          value={sheetName} onChange={e => setSheetName(e.target.value)} disabled={exporting} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          分表必须已存在。数据将追加到该分表已有内容下方，不覆盖原有数据。
        </div>
      </div>

      {/* Header option */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={includeHeader} onChange={e => setIncludeHeader(e.target.checked)}
            style={{ width: 15, height: 15 }} />
          <span>包含标题行（文件名称 / 文件链接 / 所有者 / 常规访问权限）</span>
        </label>
      </div>

      {/* Export info */}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
          将导出 {lib.files.length} 个文件，包含以下字段：
        </div>
        <div>📋 <strong>文件名称</strong> — 文件在 Drive 中的名称</div>
        <div>🔗 <strong>文件链接</strong> — 可直接点击打开的 URL</div>
        <div>👤 <strong>所有者</strong> — 文件创建者/所有者的邮箱</div>
        <div>🌐 <strong>常规访问权限</strong> — 受限 / 任何知道链接的人（查看/评论/编辑）</div>
      </div>

      {/* Progress */}
      {exporting && (
        <div style={{ marginTop: 12 }}>
          {progress ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                正在读取权限 {progress.current}/{progress.total}：{progress.name}
              </div>
              <div className="progress-bar">
                <div className="progress-bar__fill" style={{ width: `${(progress.current / progress.total) * 100}%`, transition: 'width 0.3s' }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><Spinner size={12} /> 正在写入表格...</div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─── Create Library Modal ─────────────────────────────────────────────────────
function CreateLibraryModal({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: (lib: FileLibrary) => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState(COLORS[0])

  const handleCreate = () => {
    if (!name.trim()) return
    const lib: FileLibrary = {
      id: genId(), name: name.trim(), description: desc.trim(),
      color, files: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    }
    onCreated(lib)
    setName(''); setDesc(''); setColor(COLORS[0])
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="新建表格库"
      footer={<>
        <button className="btn btn--secondary" onClick={onClose}>取消</button>
        <button className="btn btn--primary" onClick={handleCreate} disabled={!name.trim()}>创建</button>
      </>}>
      <div className="form-group">
        <label className="form-label">库名称 *</label>
        <input className="input" placeholder="例：客户表格库" value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>
      <div className="form-group">
        <label className="form-label">描述（可选）</label>
        <input className="input" placeholder="简短描述..." value={desc} onChange={e => setDesc(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label">颜色标签</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c,
                cursor: 'pointer', border: color === c ? '2px solid #fff' : '2px solid transparent',
                boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                transition: 'all 0.15s'
              }} />
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ─── Library Detail Modal ─────────────────────────────────────────────────────
type ImportTab = 'scan' | 'folder' | 'url' | 'csv' | 'bookmarks'

function LibraryDetailModal({ lib, open, onClose, onUpdate }: {
  lib: FileLibrary
  open: boolean
  onClose: () => void
  onUpdate: (lib: FileLibrary) => void
}) {
  const [tab, setTab] = useState<ImportTab>('scan')
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ count: number; page: number } | null>(null)
  const [scannedFiles, setScannedFiles] = useState<LibraryFile[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [urlInput, setUrlInput] = useState('')
  const [csvText, setCsvText] = useState('')
  const [bmkParsed, setBmkParsed] = useState<LibraryFile[]>([])
  const [bmkSelected, setBmkSelected] = useState<Set<string>>(new Set())
  const [addingUrl, setAddingUrl] = useState(false)
  // ── Folder scan state ──
  const [folderInput, setFolderInput] = useState('')
  const [folderScanning, setFolderScanning] = useState(false)
  const [folderScanProgress, setFolderScanProgress] = useState<{ count: number; page: number; folder: string } | null>(null)
  const [folderScannedFiles, setFolderScannedFiles] = useState<LibraryFile[]>([])
  const [folderSelectedIds, setFolderSelectedIds] = useState<Set<string>>(new Set())

  const api = eAPI()

  // ── File type filter (for scan and folder) ──
  const FILE_TYPES = [
    { key: 'spreadsheet', label: '📊 表格', mime: 'application/vnd.google-apps.spreadsheet' },
    { key: 'document',    label: '📝 文档', mime: 'application/vnd.google-apps.document' },
    { key: 'presentation',label: '📑 幻灯片', mime: 'application/vnd.google-apps.presentation' },
    { key: 'pdf',         label: '📕 PDF', mime: 'application/pdf' },
  ] as const
  type FileTypeKey = typeof FILE_TYPES[number]['key']
  const [selectedTypes, setSelectedTypes] = useState<Set<FileTypeKey>>(new Set(['spreadsheet']))
  const [ownerOnly, setOwnerOnly] = useState(false)  // true = only files where I am the owner

  const toggleType = (key: FileTypeKey) => {
    setSelectedTypes(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  const buildMimeQuery = (forOwnerOnly?: boolean) => {
    const mimes = FILE_TYPES.filter(t => selectedTypes.has(t.key)).map(t => `mimeType='${t.mime}'`)
    const mimeClause = mimes.length ? `(${mimes.join(' or ')})` : null
    const ownerClause = (forOwnerOnly ?? ownerOnly) ? `'me' in owners` : null
    const parts = [ownerClause, mimeClause, 'trashed=false'].filter(Boolean)
    return parts.join(' and ')
  }

  const handleScan = async () => {
    setScanning(true)
    setScanProgress(null)
    setScannedFiles([])
    const unsubscribe = api.drive.onScanProgress((data) => {
      setScanProgress({ count: data.count, page: data.page })
    })
    try {
      const files = await api.drive.scan(buildMimeQuery()) as { id: string; name: string; mimeType: string; webViewLink: string; modifiedTime: string }[]
      const existing = new Set(lib.files.map(f => f.driveId))
      setScannedFiles(files
        .filter(f => !existing.has(f.id))
        .map(f => ({ driveId: f.id, name: f.name, mimeType: f.mimeType, url: f.webViewLink, type: mimeToType(f.mimeType), addedAt: new Date().toISOString() })))
    } catch (e: unknown) {
      showToast((e as Error).message, 'error')
    } finally {
      unsubscribe()
      setScanning(false)
    }
  }

  const toggleScan = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const importSelected = () => {
    const toAdd = scannedFiles.filter(f => selectedIds.has(f.driveId))
    const updated = { ...lib, files: [...lib.files, ...toAdd], updatedAt: new Date().toISOString() }
    onUpdate(updated)
    setSelectedIds(new Set())
    setScannedFiles([])
    showToast(`已添加 ${toAdd.length} 个文件`, 'success')
  }

  // ── URL parsing helpers ──
  // Extracts file ID from /d/ID pattern
  const extractFileId = (url: string): string | null => {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/)
    return m ? m[1] : null
  }
  // Extracts folder ID from drive/folders/ID pattern
  const extractFolderId = (url: string): string | null => {
    const m = url.match(/\/folders\/([a-zA-Z0-9_-]{25,})/)
    return m ? m[1] : null
  }
  const isFolderUrl = (url: string) => /\/folders\//.test(url) || url.includes('drive.google.com/drive')

  const addByUrl = async () => {
    const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean)
    if (!urls.length) return
    setAddingUrl(true)
    let added = 0
    const newFiles = [...lib.files]
    const existingIds = new Set(newFiles.map(f => f.driveId))

    for (const url of urls) {
      // ── Case 1: Folder URL ──
      if (isFolderUrl(url)) {
        const folderId = extractFolderId(url)
        if (!folderId) continue
        try {
          setScanProgress({ count: 0, page: 1 })
          // Build query: files in this folder matching selected types
          const mimeFilter = FILE_TYPES.filter(t => selectedTypes.has(t.key)).map(t => `mimeType='${t.mime}'`).join(' or ')
          const q = `'${folderId}' in parents and (${mimeFilter || "mimeType!=''"}) and trashed=false`
          const files = await api.drive.scan(q) as { id: string; name: string; mimeType: string; webViewLink: string }[]
          for (const f of files) {
            if (existingIds.has(f.id)) continue
            newFiles.push({ driveId: f.id, name: f.name, url: f.webViewLink, mimeType: f.mimeType, type: mimeToType(f.mimeType), addedAt: new Date().toISOString() })
            existingIds.add(f.id)
            added++
          }
          if (files.length === 0) showToast('文件夹为空或无匹配文件类型', 'warning' as 'error')
        } catch (e: unknown) {
          showToast(`文件夹扫描失败: ${(e as Error).message}`, 'error')
        }
        continue
      }

      // ── Case 2: Regular file URL ──
      const id = extractFileId(url)
      if (!id || existingIds.has(id)) continue
      try {
        const all = await api.drive.scan(`id='${id}'`) as { id: string; name: string; mimeType: string; webViewLink: string }[]
        const file = all[0]
        if (file) {
          newFiles.push({ driveId: file.id, name: file.name, url: file.webViewLink, mimeType: file.mimeType, type: mimeToType(file.mimeType), addedAt: new Date().toISOString() })
          existingIds.add(file.id)
          added++
        } else {
          const mime = url.includes('spreadsheets') ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document'
          newFiles.push({ driveId: id, name: `文件 ${id.slice(0, 8)}...`, url, mimeType: mime, type: mimeToType(mime), addedAt: new Date().toISOString() })
          existingIds.add(id)
          added++
        }
      } catch {
        const mime = url.includes('spreadsheets') ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document'
        newFiles.push({ driveId: id, name: `文件 ${id.slice(0, 8)}...`, url, mimeType: mime, type: mimeToType(mime), addedAt: new Date().toISOString() })
        existingIds.add(id)
        added++
      }
    }

    onUpdate({ ...lib, files: newFiles, updatedAt: new Date().toISOString() })
    setUrlInput('')
    setScanProgress(null)
    setAddingUrl(false)
    showToast(`已添加 ${added} 个文件`, 'success')
  }

  const importCsv = () => {
    const lines = csvText.split(/[\n,]/).map(l => l.trim()).filter(l => l.includes('docs.google.com') || l.includes('sheets.google.com'))
    const newFiles = [...lib.files]
    let added = 0
    for (const url of lines) {
      const id = extractFileId(url)
      if (!id || newFiles.find(f => f.driveId === id)) continue
      const mime = url.includes('spreadsheets') ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document'
      newFiles.push({ driveId: id, name: `文件 ${id.slice(0, 8)}...`, url, mimeType: mime, type: mimeToType(mime), addedAt: new Date().toISOString() })
      added++
    }
    onUpdate({ ...lib, files: newFiles, updatedAt: new Date().toISOString() })
    setCsvText('')
    showToast(`已从 CSV 导入 ${added} 个文件`, 'success')
  }

  const parseBookmarks = (html: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const links = doc.querySelectorAll('a')
    const result: LibraryFile[] = []
    const existingIds = new Set(lib.files.map(f => f.driveId))
    links.forEach(a => {
      const href = a.href
      if (!href.includes('docs.google.com') && !href.includes('sheets.google.com')) return
      const id = extractFileId(href)
      if (!id || existingIds.has(id)) return
      const mime = href.includes('spreadsheets') ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document'
      result.push({ driveId: id, name: a.textContent?.trim() || href, url: href, mimeType: mime, type: mimeToType(mime), addedAt: new Date().toISOString() })
    })
    setBmkParsed(result)
    setBmkSelected(new Set(result.map(f => f.driveId)))
  }

  const importBookmarks = () => {
    const toAdd = bmkParsed.filter(f => bmkSelected.has(f.driveId))
    onUpdate({ ...lib, files: [...lib.files, ...toAdd], updatedAt: new Date().toISOString() })
    setBmkParsed([]); setBmkSelected(new Set())
    showToast(`已导入 ${toAdd.length} 个书签文件`, 'success')
  }

  const removeFile = (driveId: string) => {
    onUpdate({ ...lib, files: lib.files.filter(f => f.driveId !== driveId), updatedAt: new Date().toISOString() })
  }

  const tabs: { key: ImportTab; label: string; icon: string }[] = [
    { key: 'scan',   label: '扫描账号', icon: '🔍' },
    { key: 'folder', label: '扫描文件夹', icon: '📂' },
    { key: 'url',    label: '粘贴链接', icon: '🔗' },
    { key: 'csv',    label: 'CSV导入',  icon: '📄' },
    { key: 'bookmarks', label: '书签导入', icon: '⭐' }
  ]

  // ── Folder scan logic ──
  const handleFolderScan = async () => {
    const lines = folderInput.split('\n').map(l => l.trim()).filter(Boolean)
    const folderIds: string[] = []
    for (const line of lines) {
      const m = line.match(/\/folders\/([a-zA-Z0-9_-]{10,})/)
      if (m) folderIds.push(m[1])
    }
    if (!folderIds.length) { showToast('请输入有效的 Google Drive 文件夹链接', 'error'); return }

    setFolderScanning(true)
    setFolderScanProgress(null)
    setFolderScannedFiles([])
    setFolderSelectedIds(new Set())

    const existing = new Set(lib.files.map(f => f.driveId))
    const mimeTypes = FILE_TYPES.filter(t => selectedTypes.has(t.key)).map(t => t.mime)

    const unsubscribe = api.drive.onScanProgress((data) => {
      setFolderScanProgress({ count: data.count, page: data.page, folder: `已扫描 ${data.page} 个文件夹` })
    })

    try {
      // Use recursive BFS scan — scans all subfolders automatically
      const files = await (api.drive as unknown as {
        scanFolderRecursive: (args: { folderIds: string[]; mimeTypes: string[]; ownerOnly: boolean }) => Promise<{ id: string; name: string; mimeType: string; webViewLink: string }[]>
      }).scanFolderRecursive({ folderIds, mimeTypes, ownerOnly })

      const collected: LibraryFile[] = files
        .filter(f => !existing.has(f.id))
        .map(f => ({ driveId: f.id, name: f.name, url: f.webViewLink, mimeType: f.mimeType, type: mimeToType(f.mimeType), addedAt: new Date().toISOString() }))

      setFolderScannedFiles(collected)
      setFolderSelectedIds(new Set(collected.map(f => f.driveId)))
      if (collected.length === 0) showToast('未找到匹配文件，请检查文件夹链接或文件类型筛选', 'error')
    } catch (e: unknown) {
      showToast(`扫描失败: ${(e as Error).message}`, 'error')
    } finally {
      unsubscribe()
      setFolderScanning(false)
      setFolderScanProgress(null)
    }
  }

  const importFolderSelected = () => {
    const toAdd = folderScannedFiles.filter(f => folderSelectedIds.has(f.driveId))
    onUpdate({ ...lib, files: [...lib.files, ...toAdd], updatedAt: new Date().toISOString() })
    setFolderScannedFiles([])
    setFolderSelectedIds(new Set())
    showToast(`已添加 ${toAdd.length} 个文件`, 'success')
  }

  const toggleFolderFile = (id: string) => {
    setFolderSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <Modal open={open} onClose={onClose} title={`${lib.name} — 文件列表`} wide>
      {/* Current files */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
          已添加文件（{lib.files.length}）
        </div>
        {lib.files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
            尚未添加任何文件，请使用下方导入功能
          </div>
        ) : (
          <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '4px' }}>
            {lib.files.map(f => (
              <div key={f.driveId} className="file-item">
                <FileTypeIcon mimeType={f.mimeType} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="file-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                  <div className="file-meta">{f.type === 'spreadsheet' ? 'Google Sheets' : 'Google Docs'}</div>
                </div>
                <button className="btn btn--ghost btn--icon btn--sm" style={{ opacity: 0.5 }}
                  onClick={() => removeFile(f.driveId)}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="divider" />

      {/* Import tabs */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>添加文件</div>
        <div className="tabs" style={{ marginBottom: 16 }}>
          {tabs.map(t => (
            <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'scan' && (
          <div>
            {/* File type filter */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>筛选文件类型（扫描时只获取选中类型）</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FILE_TYPES.map(t => (
                  <button key={t.key}
                    className={`btn btn--sm ${selectedTypes.has(t.key) ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => toggleType(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Owner filter */}
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={ownerOnly} onChange={e => setOwnerOnly(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <span>仅显示我是所有者的文件</span>
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {ownerOnly ? '（只扫描你创建/拥有的文件）' : '（包含他人共享给你的文件）'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn--primary" onClick={handleScan} disabled={scanning || selectedTypes.size === 0}>
                {scanning
                  ? <><Spinner size={14} /> {scanProgress ? `扫描中… 已发现 ${scanProgress.count} 个文件` : '扫描中...'}</>
                  : '🔍 扫描我的 Google 云端硬盘（全量）'}
              </button>
              {scannedFiles.length > 0 && selectedIds.size > 0 && (
                <button className="btn btn--success" onClick={importSelected}>
                  ✅ 导入选中（{selectedIds.size}）
                </button>
              )}
            </div>
            {/* Scanning progress bar */}
            {scanning && scanProgress && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  正在扫描第 {scanProgress.page} 页，已发现 <strong style={{ color: 'var(--accent-2)' }}>{scanProgress.count}</strong> 个文件...
                </div>
                <div className="progress-bar"><div className="progress-bar__fill animate-pulse" style={{ width: '100%' }} /></div>
              </div>
            )}
            {scannedFiles.length > 0 && (
              <div style={{ maxHeight: 220, overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: 4 }}>
                <div style={{ display: 'flex', gap: 8, padding: '6px 10px', alignItems: 'center' }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds(new Set(scannedFiles.map(f => f.driveId)))}>全选</button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds(new Set())}>取消全选</button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>共 {scannedFiles.length} 个文件</span>
                </div>
                {scannedFiles.map(f => (
                  <div key={f.driveId} className="file-item" onClick={() => toggleScan(f.driveId)}>
                    <div className={`checkbox${selectedIds.has(f.driveId) ? ' checked' : ''}`} />
                    <FileTypeIcon mimeType={f.mimeType} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="file-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}



        {/* ── 扫描文件夹 tab ── */}
        {tab === 'folder' && (
          <div>
            {/* File type filter */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>筛选文件类型（只扫描选中的类型）</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FILE_TYPES.map(t => (
                  <button key={t.key}
                    className={`btn btn--sm ${selectedTypes.has(t.key) ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => toggleType(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Owner filter */}
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={ownerOnly} onChange={e => setOwnerOnly(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <span>仅扫描我是所有者的文件</span>
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {ownerOnly ? '（只返回你创建的文件）' : '（包含他人共享给你的文件）'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--accent-2)', marginLeft: 'auto' }}>
                🔄 自动递归扫描所有子文件夹
              </span>
            </div>

            {/* Folder URL input */}
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">粘贴 Google Drive 文件夹链接（每行一个，支持多个文件夹）</label>
              <textarea className="textarea" style={{ minHeight: 90 }}
                placeholder={'https://drive.google.com/drive/folders/XXXXXXX\nhttps://drive.google.com/drive/folders/YYYYYYY\n（可同时粘贴多个文件夹链接，自动合并去重，自动扫描所有子文件夹）'}
                value={folderInput}
                onChange={e => setFolderInput(e.target.value)}
                disabled={folderScanning}
              />
            </div>

            {/* Scan button */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <button className="btn btn--primary"
                onClick={handleFolderScan}
                disabled={folderScanning || !folderInput.trim() || selectedTypes.size === 0}>
                {folderScanning
                  ? <><Spinner size={14} /> {folderScanProgress ? `正在扫描… 已发现 ${folderScanProgress.count} 个文件` : '扫描中...'}</>
                  : '📂 开始扫描文件夹'}
              </button>
              {folderScannedFiles.length > 0 && folderSelectedIds.size > 0 && (
                <button className="btn btn--success" onClick={importFolderSelected}>
                  ✅ 导入选中（{folderSelectedIds.size}）
                </button>
              )}
            </div>

            {/* Progress */}
            {folderScanning && folderScanProgress && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, wordBreak: 'break-all' }}>
                  正在递归扫描子文件夹（已扫描 <strong style={{ color: 'var(--accent-2)' }}>{folderScanProgress.page}</strong> 个文件夹），已找到 <strong style={{ color: 'var(--accent-2)' }}>{folderScanProgress.count}</strong> 个文件...
                </div>
                <div className="progress-bar"><div className="progress-bar__fill animate-pulse" style={{ width: '100%' }} /></div>
              </div>
            )}

            {/* Results */}
            {folderScannedFiles.length > 0 && (
              <div style={{ maxHeight: 240, overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: 4 }}>
                <div style={{ display: 'flex', gap: 8, padding: '6px 10px', alignItems: 'center' }}>
                  <button className="btn btn--ghost btn--sm"
                    onClick={() => setFolderSelectedIds(new Set(folderScannedFiles.map(f => f.driveId)))}>全选</button>
                  <button className="btn btn--ghost btn--sm"
                    onClick={() => setFolderSelectedIds(new Set())}>取消全选</button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    共 {folderScannedFiles.length} 个文件（已选 {folderSelectedIds.size}）
                  </span>
                </div>
                {folderScannedFiles.map(f => (
                  <div key={f.driveId} className="file-item" onClick={() => toggleFolderFile(f.driveId)}>
                    <div className={`checkbox${folderSelectedIds.has(f.driveId) ? ' checked' : ''}`} />
                    <FileTypeIcon mimeType={f.mimeType} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="file-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div className="file-meta" style={{ fontSize: 11 }}>{f.type === 'spreadsheet' ? 'Google Sheets' : f.type === 'document' ? 'Google Docs' : f.mimeType}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'url' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* File type filter for folder scanning */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>粘贴文件夹链接时，只获取以下类型：</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {FILE_TYPES.map(t => (
                  <button key={t.key}
                    className={`btn btn--sm ${selectedTypes.has(t.key) ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => toggleType(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">粘贴 Google Sheets / Docs / 文件夹 URL（每行一个）</label>
              <textarea className="textarea" style={{ minHeight: 100 }}
                placeholder={`https://docs.google.com/spreadsheets/d/...\nhttps://drive.google.com/drive/folders/...（文件夹链接，自动扫描其中所有文件）`}
                value={urlInput} onChange={e => setUrlInput(e.target.value)} />
            </div>
            {addingUrl && scanProgress && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <Spinner size={12} /> 正在扫描文件夹，已发现 {scanProgress.count} 个文件...
              </div>
            )}
            <button className="btn btn--primary" onClick={addByUrl} disabled={!urlInput.trim() || addingUrl} style={{ alignSelf: 'flex-start' }}>
              {addingUrl ? <><Spinner size={14} /> 添加中...</> : '➕ 添加'}
            </button>
          </div>
        )}

        {tab === 'csv' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">粘贴 CSV 内容（包含 Google 链接的行会被自动识别）</label>
              <textarea className="textarea" style={{ minHeight: 120 }}
                placeholder="可直接粘贴多行包含 docs.google.com 或 sheets.google.com 的内容..."
                value={csvText} onChange={e => setCsvText(e.target.value)} />
            </div>
            <button className="btn btn--primary" onClick={importCsv} disabled={!csvText.trim()} style={{ alignSelf: 'flex-start' }}>
              📥 导入
            </button>
          </div>
        )}

        {tab === 'bookmarks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong>使用方法：</strong><br />
              1. 打开 Chrome 浏览器 → 书签 → 书签管理器<br />
              2. 点击右上角「⋮」→「导出书签」→ 保存 HTML 文件<br />
              3. 点击下方按钮选择该 HTML 文件
            </div>
            <div>
              <label style={{ display: 'inline-block' }}>
                <input type="file" accept=".html,.htm" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = ev => parseBookmarks(ev.target?.result as string)
                    reader.readAsText(file)
                  }} />
                <span className="btn btn--secondary">📂 选择书签 HTML 文件</span>
              </label>
            </div>
            {bmkParsed.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    找到 {bmkParsed.length} 个 Google 文件（已选 {bmkSelected.size}）
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => setBmkSelected(new Set(bmkParsed.map(f => f.driveId)))}>全选</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setBmkSelected(new Set())}>取消</button>
                  </div>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: 4 }}>
                  {bmkParsed.map(f => (
                    <div key={f.driveId} className="file-item" onClick={() => setBmkSelected(prev => {
                      const n = new Set(prev); n.has(f.driveId) ? n.delete(f.driveId) : n.add(f.driveId); return n
                    })}>
                      <div className={`checkbox${bmkSelected.has(f.driveId) ? ' checked' : ''}`} />
                      <FileTypeIcon mimeType={f.mimeType} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="file-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn--success" style={{ marginTop: 10 }}
                  onClick={importBookmarks} disabled={bmkSelected.size === 0}>
                  ✅ 导入选中（{bmkSelected.size}）
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Main Libraries Page ──────────────────────────────────────────────────────
export default function Libraries() {
  const { libraries, saveLibraries } = useApp()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedLib, setSelectedLib] = useState<FileLibrary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileLibrary | null>(null)
  const [exportTarget, setExportTarget] = useState<FileLibrary | null>(null)

  const handleCreate = async (lib: FileLibrary) => {
    await saveLibraries([...libraries, lib])
    showToast('表格库已创建', 'success')
  }

  const handleUpdate = async (updated: FileLibrary) => {
    await saveLibraries(libraries.map(l => l.id === updated.id ? updated : l))
    if (selectedLib?.id === updated.id) setSelectedLib(updated)
  }

  const handleDelete = async (lib: FileLibrary) => {
    await saveLibraries(libraries.filter(l => l.id !== lib.id))
    showToast('表格库已删除', 'success')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">🗂️ 表格库</h1>
          <p className="page-subtitle">创建分组，将需要管理的 Google 文件集中在一起</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            ＋ 新建表格库
          </button>
        </div>
      </div>

      {libraries.length === 0 ? (
        <EmptyState icon="🗂️" title="暂无表格库" desc="创建您的第一个表格库，将 Google Sheets 和 Docs 集中管理"
          action={<button className="btn btn--primary" onClick={() => setCreateOpen(true)}>＋ 新建表格库</button>} />
      ) : (
        <div className="grid-3">
          {libraries.map(lib => (
            <LibraryCard key={lib.id} lib={lib}
              onOpen={() => setSelectedLib(lib)}
              onDelete={() => setDeleteTarget(lib)}
              onExport={() => setExportTarget(lib)} />
          ))}
        </div>
      )}

      <CreateLibraryModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreate} />

      {selectedLib && (
        <LibraryDetailModal lib={selectedLib} open={!!selectedLib}
          onClose={() => setSelectedLib(null)} onUpdate={handleUpdate} />
      )}

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title="删除表格库" danger
        message={`确定要删除「${deleteTarget?.name}」吗？该操作不可恢复，库中的文件引用将一并删除（不影响 Google 云端实际文件）。`} />

      <ExportLibraryModal lib={exportTarget} open={!!exportTarget} onClose={() => setExportTarget(null)} />
    </div>
  )
}
