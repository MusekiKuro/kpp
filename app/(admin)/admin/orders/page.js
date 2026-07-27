'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { authFetch } from '@/lib/auth-fetch'

const STATUS_CONFIG = {
  new: { label: 'Новый', bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { label: 'В работе', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  done: { label: 'Выполнен', bg: 'bg-green-100', text: 'text-green-700' },
}

const TABS = [
  { key: 'all', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'done', label: 'Выполнены' },
]

function sanitizeCsvCell(value) {
  const text = String(value ?? '')
  return /^[\t ]*[=+\-@]/.test(text) ? `'${text}` : text
}

function escapeCsvCell(value) {
  return `"${sanitizeCsvCell(value).replace(/"/g, '""')}"`
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ message, type })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  const fetchOrders = useCallback(async () => {
    try {
      const res = await authFetch('/api/orders')
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !Array.isArray(data)) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setOrders(data)
    } catch {
      showToast('Ошибка загрузки заявок', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    let cancelled = false

    async function loadOrders() {
      try {
        const res = await authFetch('/api/orders')
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !Array.isArray(data)) {
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        if (!cancelled) {
          setOrders(data)
        }
      } catch {
        if (!cancelled) {
          showToast('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё Р·Р°СЏРІРѕРє', 'error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadOrders()

    return () => {
      cancelled = true
    }
  }, [showToast])

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const res = await authFetch(`/api/orders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to update status')
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      )
      showToast('Статус обновлён')
    } catch {
      showToast('Ошибка при обновлении статуса', 'error')
    }
  }

  const handleDeleteOrder = async () => {
    if (!deleteConfirm) return

    try {
      const res = await authFetch(`/api/orders`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteConfirm.id }),
      })

      if (!res.ok) {
        throw new Error('Failed to delete order')
      }

      setDeleteConfirm(null)
      setOrders((prev) => prev.filter((o) => o.id !== deleteConfirm.id))
      showToast('Заявка удалена')
    } catch {
      setDeleteConfirm(null)
      showToast('Ошибка при удалении заявки', 'error')
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const exportCSV = (ordersToExport) => {
    const BOM = '\uFEFF'
    const rows = [['№', 'Имя', 'Телефон', 'Комментарий', 'Товары', 'Статус', 'Дата']]
    ordersToExport.forEach((order, i) => {
      const itemsStr = (order.items || [])
        .map(item => `${item.name} ×${item.quantity || 1}`)
        .join('; ')
      const statusLabel = STATUS_CONFIG[order.status]?.label || order.status
      rows.push([
        String(i + 1),
        order.customer_name || '',
        order.customer_phone || '',
        order.customer_message || '',
        itemsStr,
        statusLabel,
        formatDate(order.created_at),
      ])
    })
    const csv = BOM + rows.map(row => row.map(escapeCsvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nurset-zayavki-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredOrders =
    activeTab === 'all'
      ? orders
      : orders.filter((o) => o.status === activeTab)

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-28 bg-gray-200 rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-9 w-24 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden p-5">
            <div className="flex items-center gap-4">
              <div className="h-4 w-10 bg-gray-200 rounded animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Заявки</h1>
        <button
          onClick={() => exportCSV(filteredOrders)}
          className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-xl transition-colors text-sm cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Экспорт CSV
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const count =
            tab.key === 'all'
              ? orders.length
              : orders.filter((o) => o.status === tab.key).length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 ${activeTab === tab.key ? 'text-white/70' : 'text-gray-400'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Orders list */}
      <div className="space-y-3">
        {filteredOrders.map((order, index) => {
          const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.new
          const isExpanded = expandedId === order.id
          const items = Array.isArray(order.items) ? order.items : []

          return (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            >
              {/* Order row */}
              <button
                onClick={() => toggleExpand(order.id)}
                className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <span className="text-sm font-mono text-gray-400 shrink-0">
                  #{orders.length - orders.indexOf(order)}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {order.customer_name}
                    </span>
                    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span>{order.customer_phone}</span>
                    <span>·</span>
                    <span>{items.length} товар(ов)</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">{formatDate(order.created_at)}</span>
                  </div>
                </div>

                <svg
                  className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 sm:p-5 bg-gray-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Дата</span>
                      <p className="text-sm text-gray-900 mt-0.5">{formatDate(order.created_at)}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Телефон</span>
                      <p className="text-sm text-gray-900 mt-0.5">{order.customer_phone}</p>
                    </div>
                  </div>

                  {order.customer_message && (
                    <div className="mb-4">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Комментарий</span>
                      <p className="text-sm text-gray-700 mt-0.5">{order.customer_message}</p>
                    </div>
                  )}

                  {/* Items */}
                  <div className="mb-4">
                    <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Товары
                    </span>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 bg-white rounded-xl p-3"
                        >
                          {item.image_url && (
                            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <span className="flex-1 text-sm text-gray-900 truncate">
                            {item.name}
                          </span>
                          <span className="text-sm text-gray-500">
                            × {item.quantity || 1}
                          </span>

                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status change */}
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                      Изменить статус
                    </span>
                    <div className="flex gap-2">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(order.id, key)}
                          disabled={order.status === key}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                            order.status === key
                              ? `${cfg.bg} ${cfg.text} opacity-50 cursor-not-allowed`
                              : `${cfg.bg} ${cfg.text} hover:opacity-80`
                          }`}
                        >
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setDeleteConfirm(order)}
                      className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      Удалить заявку
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filteredOrders.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
            Нет заявок
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Удалить заявку?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Вы уверены, что хотите удалить заявку от «{deleteConfirm.customer_name}»? Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteOrder}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
