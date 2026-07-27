'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { IMPORT_UI_FIELDS, mapImportRows, mappedFilename, parseImportText, suggestImportMapping } from '@/lib/import-ui.mjs'

const ACTIONS = ['all', 'create', 'update', 'skip', 'error']
const PROGRESS = { reading: 15, staging: 55, approving: 70, applying: 85, refreshing: 95, report: 60 }

function display(value) {
  if (value === null || value === undefined || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

async function requestJson(url, options) {
  const response = await authFetch(url, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.error || `HTTP ${response.status}`)
    error.body = body
    throw error
  }
  return body
}

export default function ImportWorkflow() {
  const [history, setHistory] = useState([])
  const [batch, setBatch] = useState(null)
  const [rows, setRows] = useState([])
  const [source, setSource] = useState(null)
  const [sourceReference, setSourceReference] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [confirmation, setConfirmation] = useState('')
  const [rowPagination, setRowPagination] = useState({ page: 1, page_size: 200, total: 0, total_pages: 0 })
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState(null)

  const loadHistory = useCallback(async () => {
    const body = await requestJson('/api/admin/imports?page=1&pageSize=20')
    setHistory(body.items || [])
  }, [])

  const loadBatch = useCallback(async (id, page = 1) => {
    const body = await requestJson(`/api/admin/imports/${id}?page=${page}&pageSize=200`)
    setBatch(body.batch)
    setRows(body.rows || [])
    setRowPagination(body.pagination || { page: 1, page_size: 200, total: 0, total_pages: 0 })
    setConfirmation('')
  }, [])

  useEffect(() => { loadHistory().catch((error) => setMessage({ type: 'error', text: error.message })) }, [loadHistory])

  const mappedRows = useMemo(() => {
    if (!source) return []
    try { return mapImportRows(source.rows, source.mapping) } catch { return [] }
  }, [source])
  const filteredRows = useMemo(() => actionFilter === 'all' ? rows : rows.filter((row) => row.proposed_action === actionFilter), [actionFilter, rows])
  const errorRows = rows.filter((row) => row.proposed_action === 'error' || row.validation_errors?.length)
  const progress = busy ? PROGRESS[busy] || 50 : 0
  const actions = batch?.summary?.actions || {}

  const readFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy('reading')
    setMessage(null)
    try {
      const lower = file.name.toLowerCase()
      if (lower.endsWith('.xlsx')) {
        const form = new FormData()
        form.append('file', file)
        const body = await requestJson('/api/admin/imports/preview-xlsx', { method: 'POST', body: form })
        setSource({
          file,
          isXlsx: true,
          sheets: body.sheets || [],
          activeSheet: body.activeSheet,
          rows: body.sampleRows || [],
          columns: body.columns || [],
          mapping: suggestImportMapping(body.columns || []),
          totalRows: body.totalRows || body.sampleRows?.length || 0,
        })
        setBatch(null)
        setRows([])
        setMessage({ type: 'success', text: `${body.sampleRows?.length || 0} строк в preview (из ${body.totalRows || body.sampleRows?.length || 0} всего, ${body.sheets?.length || 1} лист(ов)). При staging будут обработаны все строки.` })
      } else {
        const parsed = parseImportText(await file.text(), file.name)
        setSource({ file, isXlsx: false, sheets: [], activeSheet: null, ...parsed, mapping: suggestImportMapping(parsed.columns), totalRows: parsed.rows.length })
        setBatch(null)
        setRows([])
        setMessage({ type: 'success', text: `${parsed.rows.length} строк прочитано. Проверьте сопоставление колонок.` })
      }
    } catch (error) { setMessage({ type: 'error', text: error.message }) } finally { setBusy(null) }
  }

  const changeSheet = async (sheetName) => {
    if (!source || !source.isXlsx) return
    setBusy('reading')
    try {
      const form = new FormData()
      form.append('file', source.file)
      form.append('sheet', sheetName)
      const body = await requestJson('/api/admin/imports/preview-xlsx', { method: 'POST', body: form })
      setSource((cur) => ({
        ...cur,
        activeSheet: body.activeSheet,
        rows: body.sampleRows || [],
        columns: body.columns || [],
        mapping: suggestImportMapping(body.columns || []),
        totalRows: body.totalRows || body.sampleRows?.length || 0,
      }))
    } catch (error) { setMessage({ type: 'error', text: error.message }) } finally { setBusy(null) }
  }

  const updateMapping = (column, target) => setSource((current) => ({ ...current, mapping: { ...current.mapping, [column]: target } }))

  const stage = async () => {
    if (!source) return
    if (!source.isXlsx && mappedRows.length === 0) return
    setBusy('staging')
    setMessage(null)
    try {
      const form = new FormData()
      if (source.isXlsx) {
        form.append('file', source.file)
        if (source.activeSheet) form.append('sheet', source.activeSheet)
        if (source.mapping) form.append('mapping', JSON.stringify(source.mapping))
      } else {
        form.append('file', new Blob([JSON.stringify(mappedRows)], { type: 'application/json' }), mappedFilename(source.file.name))
      }
      if (sourceReference.trim()) form.append('source_reference', sourceReference.trim())
      const body = await requestJson('/api/admin/imports', { method: 'POST', body: form })
      await loadBatch(body.batch.id, 1)
      await loadHistory()
      setMessage({ type: 'success', text: 'Источник помещён в staging. Проверьте preview перед approval.' })
    } catch (error) {
      const duplicate = error.message === 'This exact source has already been staged'
      setMessage({ type: 'error', text: duplicate ? 'Дубликат источника: этот файл уже был помещён в staging.' : error.message })
    } finally { setBusy(null) }
  }

  const approve = async () => {
    if (!batch) return
    if (Number(actions.error || 0) > 0) { setMessage({ type: 'error', text: 'Сначала исправьте строки с ошибками.' }); return }
    setBusy('approving')
    try {
      await requestJson(`/api/admin/imports/${batch.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) })
      await loadBatch(batch.id, rowPagination.page)
      await loadHistory()
      setMessage({ type: 'success', text: 'Batch approved. Для apply требуется typed confirmation.' })
    } catch (error) { setMessage({ type: 'error', text: error.message }) } finally { setBusy(null) }
  }

  const apply = async () => {
    if (!batch || !['approved', 'failed'].includes(batch.status) || confirmation !== 'APPLY') return
    setBusy('applying')
    try {
      const body = await requestJson(`/api/admin/imports/${batch.id}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) })
      setMessage({ type: 'success', text: `Apply completed: ${body.result?.created || 0} created, ${body.result?.updated || 0} updated, ${body.result?.skipped || 0} skipped.` })
      setBusy('refreshing')
      await loadBatch(batch.id, rowPagination.page)
      await loadHistory()
    } catch (error) {
      await loadBatch(batch.id, rowPagination.page).catch(() => undefined)
      setMessage({ type: 'error', text: error.message })
    } finally { setBusy(null) }
  }

  const downloadErrors = async () => {
    if (!batch || !Number(actions.error || 0)) return
    setBusy('report')
    try {
      const report = await requestJson(`/api/admin/imports/${batch.id}/errors`)
      const payload = { batch_id: report.batch.id, source_hash: report.batch.source_hash, rows: report.rows.map((row) => ({ row_number: row.row_number, raw_payload: row.raw_payload, normalized_payload: row.normalized_payload, errors: row.validation_errors, warnings: row.validation_warnings })) }
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `import-errors-${batch.id}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) { setMessage({ type: 'error', text: error.message }) } finally { setBusy(null) }
  }

  return <div className="space-y-5">
    {message && <div className={`rounded-xl px-4 py-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message.text}<button className="float-right" onClick={() => setMessage(null)}>×</button></div>}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Импорт каталога</h1><p className="text-sm text-gray-500">JSON / CSV / XLSX → mapping → staging → human approval → apply</p></div><label className="cursor-pointer rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white">Выбрать JSON/CSV/XLSX<input className="hidden" type="file" accept=".json,.csv,.xlsx" onChange={readFile} /></label></div>
    {source && <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">1. Column mapping</h2><p className="text-xs text-gray-500">Файл: {source.file.name}; preview: {source.rows.length} строк из {source.totalRows ?? source.rows.length} всего. При staging будут обработаны все {source.totalRows ?? source.rows.length} строк. Не сопоставленные колонки будут отброшены.</p></div><div className="flex items-center gap-3">{source.isXlsx && source.sheets?.length > 1 && <label className="flex items-center gap-2 text-xs font-medium"><span>Лист XLSX:</span><select className="rounded-lg border p-1 text-xs" value={source.activeSheet} onChange={(e) => changeSheet(e.target.value)}>{source.sheets.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>}<input className="rounded-lg border p-2 text-sm" placeholder="source reference (optional)" value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} /></div></div><div className="grid gap-3 md:grid-cols-2">{source.columns.map((column) => <label key={column} className="grid grid-cols-[1fr_1fr] items-center gap-2 text-sm"><span className="truncate" title={column}>{column}</span><select className="rounded-lg border p-2" value={source.mapping[column] || ''} onChange={(event) => updateMapping(column, event.target.value)}><option value="">Skip</option>{IMPORT_UI_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}</select></label>)}</div><div className="flex flex-wrap items-center gap-3"><button className="rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-40" disabled={busy !== null || (source.isXlsx ? source.totalRows === 0 : mappedRows.length === 0)} onClick={stage}>{source.isXlsx ? `Stage all ${source.totalRows ?? source.rows.length} rows` : `Stage ${mappedRows.length} rows`}</button><span className="text-xs text-gray-500">Mapped data is revalidated server-side and receives a source hash.</span></div></section>}
    {busy && <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><div className="mb-2 flex justify-between"><span>Работа с импортом: {busy}</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div></div>}
    {batch && <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="font-semibold">2. Preview batch</h2><p className="break-all text-xs text-gray-500">{batch.id} · {batch.source_filename} · {batch.source_hash}</p><p className="mt-1 text-sm">Status: <span className="font-semibold">{batch.status}</span></p></div><div className="flex flex-wrap gap-2 text-xs">{['create', 'update', 'skip', 'error'].map((action) => <span key={action} className="rounded-full bg-gray-100 px-3 py-1">{action}: {actions[action] || 0}</span>)}</div></div><div className="flex flex-wrap gap-2"><div className="flex rounded-lg border p-1">{ACTIONS.map((action) => <button key={action} className={`px-3 py-1 text-sm ${actionFilter === action ? 'rounded bg-gray-900 text-white' : ''}`} onClick={() => setActionFilter(action)}>{action}</button>)}</div><button className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40" disabled={!Number(actions.error || 0) || busy !== null} onClick={downloadErrors}>Download all errors ({actions.error || 0})</button></div><div className="space-y-2">{filteredRows.map((row) => <details key={row.id} className={`rounded-xl border p-3 ${row.proposed_action === 'error' ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}><summary className="cursor-pointer text-sm"><span className="mr-3 font-mono">#{row.row_number}</span><span className="mr-3 rounded bg-gray-100 px-2 py-1 text-xs">{row.proposed_action}</span>{row.raw_payload?.sku || row.raw_payload?.name_ru || 'row'}</summary><div className="mt-3 space-y-2 text-xs">{row.validation_errors?.length > 0 && <div className="text-red-700">Errors: {row.validation_errors.join('; ')}</div>}{row.validation_warnings?.length > 0 && <div className="text-amber-700">Warnings: {row.validation_warnings.join('; ')}</div>}{row.diff?.fields?.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Field</th><th className="p-2">Before</th><th className="p-2">After</th></tr></thead><tbody>{row.diff.fields.map((field) => <tr key={field.field} className="border-t"><td className="p-2 font-mono">{field.field}</td><td className="max-w-xs break-words p-2">{display(field.before)}</td><td className="max-w-xs break-words p-2">{display(field.after)}</td></tr>)}</tbody></table></div>}</div></details>)}{filteredRows.length === 0 && <p className="py-6 text-center text-sm text-gray-500">Нет строк для фильтра.</p>}</div><div className="flex items-center justify-between text-sm text-gray-500"><span>Rows {rowPagination.page} / {rowPagination.total_pages || 1} · {rowPagination.total} total</span><div className="flex gap-2"><button className="rounded-lg border px-3 py-1 disabled:opacity-40" disabled={rowPagination.page <= 1 || busy !== null} onClick={() => loadBatch(batch.id, rowPagination.page - 1)}>Previous</button><button className="rounded-lg border px-3 py-1 disabled:opacity-40" disabled={!rowPagination.total_pages || rowPagination.page >= rowPagination.total_pages || busy !== null} onClick={() => loadBatch(batch.id, rowPagination.page + 1)}>Next</button></div></div>{['parsed', 'needs_review'].includes(batch.status) && <button className="rounded-xl bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-40" disabled={busy !== null || Number(actions.error || 0) > 0} onClick={approve}>Approve reviewed batch</button>}{['approved', 'failed'].includes(batch.status) && <div className="flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium">Type APPLY to {batch.status === 'failed' ? 'retry' : 'apply'}<input className="mt-1 w-full rounded-lg border p-2 font-mono" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-40" disabled={busy !== null || confirmation !== 'APPLY'} onClick={apply}>{batch.status === 'failed' ? 'Retry apply' : 'Apply batch'}</button></div>}{batch.status === 'completed' && <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">Apply result: {display(batch.summary?.apply)}</div>}</section>}
    <section className="rounded-2xl border border-gray-100 bg-white p-5"><h2 className="mb-3 font-semibold">Result history</h2><div className="divide-y">{history.map((entry) => <button key={entry.id} className="flex w-full flex-col gap-1 py-3 text-left text-sm hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between" onClick={() => loadBatch(entry.id)}><span><span className="mr-2 font-mono text-xs">{entry.id.slice(0, 8)}</span>{entry.source_filename || entry.source_type}</span><span className="text-xs text-gray-500">{entry.status} · {entry.summary?.rows || 0} rows</span></button>)}{history.length === 0 && <p className="py-4 text-sm text-gray-500">История импортов пуста.</p>}</div></section>
  </div>
}
