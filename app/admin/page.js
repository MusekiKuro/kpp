'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import ProductModal from '@/components/ProductModal'
import { authFetch } from '@/lib/auth-fetch'

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toast, setToast] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Все')
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

  const fetchProducts = useCallback(async () => {
    try {
      const res = await authFetch('/api/products')
      const data = await res.json()
      setProducts(data)
    } catch {
      showToast('Ошибка загрузки товаров', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    let cancelled = false

    async function loadProducts() {
      try {
        const res = await authFetch('/api/products')
        const data = await res.json()
        if (!cancelled) {
          setProducts(data)
        }
      } catch {
        if (!cancelled) {
          showToast('РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С‚РѕРІР°СЂРѕРІ', 'error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      cancelled = true
    }
  }, [showToast])

  const handleAdd = () => {
    setEditingProduct(null)
    setShowModal(true)
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setShowModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    const product = deleteConfirm

    try {
      const res = await authFetch(`/api/products/${product.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${res.status}`)
      }
      setDeleteConfirm(null)
      showToast('Товар удалён')
      fetchProducts()
    } catch (err) {
      setDeleteConfirm(null)
      showToast(err.message || 'Ошибка при удалении', 'error')
    }
  }

  const handleMoveUp = async (product) => {
    const catProducts = products
      .filter(p => (p.category || 'Без категории') === (product.category || 'Без категории'))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at) - new Date(a.created_at))
    const idx = catProducts.findIndex(p => p.id === product.id)
    if (idx <= 0) return
    const above = catProducts[idx - 1]
    try {
      await Promise.all([
        authFetch(`/api/products/${product.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: above.sort_order ?? 0 }),
        }),
        authFetch(`/api/products/${above.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: product.sort_order ?? 0 }),
        }),
      ])
      fetchProducts()
    } catch (err) {
      showToast('Ошибка при перемещении', 'error')
    }
  }

  const handleMoveDown = async (product) => {
    const catProducts = products
      .filter(p => (p.category || 'Без категории') === (product.category || 'Без категории'))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at) - new Date(a.created_at))
    const idx = catProducts.findIndex(p => p.id === product.id)
    if (idx >= catProducts.length - 1) return
    const below = catProducts[idx + 1]
    try {
      await Promise.all([
        authFetch(`/api/products/${product.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: below.sort_order ?? 0 }),
        }),
        authFetch(`/api/products/${below.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: product.sort_order ?? 0 }),
        }),
      ])
      fetchProducts()
    } catch (err) {
      showToast('Ошибка при перемещении', 'error')
    }
  }

  const handleSave = async (formData) => {
    try {
      let image_url = formData.image_url

      // Upload new image if provided
      if (formData.imageFile) {
        const uploadData = new FormData()
        uploadData.append('file', formData.imageFile)
        const uploadRes = await authFetch('/api/upload', {
          method: 'POST',
          body: uploadData,
        })
        if (!uploadRes.ok) {
          const errBody = await uploadRes.json().catch(() => ({}))
          throw new Error(errBody.error || 'Image upload failed')
        }
        const uploadJson = await uploadRes.json()
        image_url = uploadJson.url
      }

      const body = {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        sort_order: formData.sort_order ?? 0,
        image_url: image_url || null,
      }

      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products'
      const method = editingProduct ? 'PUT' : 'POST'

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `HTTP ${res.status}`)
      }

      showToast(editingProduct ? 'Товар обновлён' : 'Товар добавлен')
      setShowModal(false)
      fetchProducts()
    } catch (err) {
      showToast(err.message || 'Ошибка при сохранении', 'error')
    }
  }

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))]
    return cats.sort()
  }, [products])

  const filteredProducts = useMemo(() => {
    let result = products
    if (activeCategory !== 'Все') {
      result = result.filter(p => p.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        p => p.name?.toLowerCase().includes(q) ||
             p.category?.toLowerCase().includes(q)
      )
    }
    return result
  }, [products, activeCategory, search])

  const grouped = useMemo(() => {
    const groups = {}
    for (const p of filteredProducts) {
      const cat = p.category || 'Без категории'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(p)
    }
    return groups
  }, [filteredProducts])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 w-72 bg-gray-200 rounded-xl animate-pulse" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse" />)}
        </div>
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              </div>
              {[1,2,3].map(j => (
                <div key={j} className="flex items-center gap-3 px-6 py-4">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse shrink-0" />
                  <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Товары</h1>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 px-5 rounded-xl transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Добавить товар
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Поиск по названию или категории..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-white"
          />
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory('Все')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            activeCategory === 'Все'
              ? 'bg-brand-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600'
          }`}
        >
          Все
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === cat
                ? 'bg-brand-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products by category */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">{category}</h2>
              <span className="text-xs text-gray-500">{items.length} товар(ов)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody className="divide-y divide-gray-50">
                  {items.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-gray-900 truncate max-w-[200px]">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => handleMoveUp(product)}
                            className="text-gray-300 hover:text-brand-600 transition-colors cursor-pointer p-1.5"
                            title="Выше"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveDown(product)}
                            className="text-gray-300 hover:text-brand-600 transition-colors cursor-pointer p-1.5"
                            title="Ниже"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-gray-400 hover:text-brand-600 transition-colors cursor-pointer p-1.5"
                            title="Редактировать"
                          >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(product)}
                            className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-1.5"
                            title="Удалить"
                          >
                            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {Object.entries(grouped).length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-500">
            {search ? 'Ничего не найдено' : 'Нет товаров'}
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editingProduct ? JSON.parse(JSON.stringify(editingProduct)) : null}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          categories={categories}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Удалить товар?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Вы уверены, что хотите удалить «{deleteConfirm.name}»? Это действие нельзя отменить.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteConfirm}
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
