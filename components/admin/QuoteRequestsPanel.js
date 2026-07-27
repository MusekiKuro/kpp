'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'

const STATUS_CONFIG = {
  new: { label: 'Новые', badge: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'Связались', badge: 'bg-violet-100 text-violet-700' },
  in_progress: { label: 'В работе', badge: 'bg-amber-100 text-amber-700' },
  closed: { label: 'Закрытые', badge: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Отклонённые', badge: 'bg-slate-100 text-slate-600' },
}

const TABS = [{ key: 'all', label: 'Все' }, ...Object.entries(STATUS_CONFIG).map(([key, value]) => ({ key, label: value.label }))]

function formatDate(value) {
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function formatPrice(item) {
  if (item.price_mode_snapshot === 'hidden') return 'Цена по запросу'
  if (item.price_mode_snapshot === 'from') return `от ${item.price_amount_snapshot ?? ''} ${item.currency_snapshot || 'KZT'}`
  if (item.price_mode_snapshot === 'exact') return `${item.price_amount_snapshot ?? ''} ${item.currency_snapshot || 'KZT'}`
  return 'Цена по запросу'
}

export default function QuoteRequestsPanel() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3500)
  }, [])

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const response = await authFetch('/api/quote-requests?limit=500')
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !Array.isArray(data)) throw new Error(data.error || `HTTP ${response.status}`)
      setRequests(data)
      setDrafts(Object.fromEntries(data.map((request) => [request.id, request.internal_comment || ''])))
    } catch {
      notify('Не удалось загрузить запросы КП', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    const timer = window.setTimeout(() => loadRequests(), 0)
    return () => window.clearTimeout(timer)
  }, [loadRequests])

  const filteredRequests = useMemo(() => (
    activeTab === 'all' ? requests : requests.filter((request) => request.status === activeTab)
  ), [activeTab, requests])

  const updateRequest = async (request, status = request.status) => {
    setSavingId(request.id)
    try {
      const response = await authFetch('/api/quote-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request.id, status, internal_comment: drafts[request.id] || '' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`)
      setRequests((previous) => previous.map((item) => item.id === request.id ? { ...item, ...data } : item))
      notify('Запрос обновлён')
    } catch {
      notify('Не удалось обновить запрос', 'error')
    } finally {
      setSavingId(null)
    }
  }

  const exportCsv = async () => {
    try {
      const response = await authFetch('/api/quote-requests?format=csv&limit=500')
      if (!response.ok) throw new Error('CSV export failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `nurset-quote-requests-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch {
      notify('Не удалось выгрузить CSV', 'error')
    }
  }

  if (loading) return <div className="space-y-3"><div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />{[1, 2, 3].map((item) => <div key={item} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}</div>

  return (
    <div>
      {toast && <div role="status" className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>{toast.message}</div>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Запросы коммерческого предложения</h1><p className="text-sm text-gray-500 mt-1">Контакты и состав запросов из публичного каталога</p></div>
        <button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-xl text-sm cursor-pointer">Экспорт CSV</button>
      </div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">{TABS.map((tab) => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap cursor-pointer ${activeTab === tab.key ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{tab.label}<span className="ml-1.5 opacity-70">{tab.key === 'all' ? requests.length : requests.filter((item) => item.status === tab.key).length}</span></button>)}</div>
      <div className="space-y-3">
        {filteredRequests.map((request) => {
          const expanded = expandedId === request.id
          const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.new
          return <article key={request.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button onClick={() => setExpandedId(expanded ? null : request.id)} className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-gray-50/50 cursor-pointer">
              <div className="flex-1 min-w-0"><div className="flex items-center gap-3 flex-wrap"><span className="font-semibold text-gray-900 truncate">{request.customer_name}</span><span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${status.badge}`}>{status.label}</span></div><div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500"><span>{request.customer_phone}</span>{request.organization && <span>{request.organization}</span>}<span>{request.items?.length || 0} поз.</span><span>{formatDate(request.created_at)}</span></div></div><span className="text-gray-400 text-xl" aria-hidden="true">{expanded ? '−' : '+'}</span>
            </button>
            {expanded && <div className="border-t border-gray-100 p-4 sm:p-5 bg-gray-50/50 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm"><div><span className="text-xs font-semibold text-gray-500 uppercase">Контакты</span><p className="mt-1 text-gray-900">{request.customer_phone}{request.customer_email ? ` · ${request.customer_email}` : ''}</p></div><div><span className="text-xs font-semibold text-gray-500 uppercase">Язык / источник</span><p className="mt-1 text-gray-900">{request.locale === 'kk' ? 'Қазақша' : 'Русский'}{request.source_url ? ` · ${request.source_url}` : ''}</p></div></div>
              {request.customer_message && <div><span className="text-xs font-semibold text-gray-500 uppercase">Комментарий клиента</span><p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{request.customer_message}</p></div>}
              <div><span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Товары</span><div className="space-y-2">{(request.items || []).map((item) => <div key={item.id || item.product_id} className="bg-white rounded-xl p-3 flex flex-wrap items-center gap-2 text-sm"><span className="flex-1 min-w-[12rem] text-gray-900">{item.name_snapshot || item.sku_snapshot || item.product_id}</span><span className="text-gray-500">× {item.quantity}</span><span className="text-gray-500">{formatPrice(item)}</span></div>)}</div></div>
              <div><label htmlFor={`note-${request.id}`} className="text-xs font-semibold text-gray-500 uppercase">Внутренняя заметка</label><textarea id={`note-${request.id}`} value={drafts[request.id] || ''} onChange={(event) => setDrafts((previous) => ({ ...previous, [request.id]: event.target.value }))} rows={3} maxLength={4000} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" placeholder="Только для команды" />
              <div className="flex flex-col sm:flex-row gap-2 mt-3"><select value={request.status} onChange={(event) => updateRequest(request, event.target.value)} disabled={savingId === request.id} className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white text-gray-900">{Object.entries(STATUS_CONFIG).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select><button onClick={() => updateRequest(request)} disabled={savingId === request.id} className="rounded-xl bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 cursor-pointer">{savingId === request.id ? 'Сохраняем…' : 'Сохранить заметку'}</button></div></div>
            </div>}
          </article>
        })}
        {filteredRequests.length === 0 && <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">Запросов пока нет</div>}
      </div>
    </div>
  )
}
