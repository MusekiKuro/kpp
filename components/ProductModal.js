'use client'

import { useState, useRef, useEffect } from 'react'

export default function ProductModal({ product, onClose, onSave, categories }) {
  const [name, setName] = useState(product?.name || '')
  const [category, setCategory] = useState(product?.category || '')
  const [features, setFeatures] = useState(() => {
    if (!product?.description) return ''
    const m = product.description.match(/^<!--FEATURES-->\n([\s\S]*?)\n<!--\/FEATURES-->\n*/)
    return m ? m[1] : ''
  })
  const [description, setDescription] = useState(() => {
    if (!product?.description) return ''
    return product.description.replace(/^<!--FEATURES-->\n[\s\S]*?\n<!--\/FEATURES-->\n*/, '')
  })
  const [sortOrder, setSortOrder] = useState(product?.sort_order ?? 0)
  const [imageUrl, setImageUrl] = useState(product?.image_url || '')
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(product?.image_url || '')
  const previewUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      setImageFile(file)
      const url = URL.createObjectURL(file)
      previewUrlRef.current = url
      setPreview(url)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const combinedDesc = features.trim()
      ? `<!--FEATURES-->\n${features.trim()}\n<!--/FEATURES-->\n${description.trim()}`
      : description.trim()

    await onSave({
      name,
      category,
      description: combinedDesc,
      sort_order: sortOrder,
      image_url: imageUrl,
      imageFile,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {product ? 'Редактировать товар' : 'Добавить товар'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Категория
            </label>
            <input
              type="text"
              list="category-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
            <datalist id="category-list">
              {(categories || []).map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Порядок сортировки
            </label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Характеристики (каждая с новой строки)
            </label>
            <textarea
              rows={3}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
              placeholder="Материал: хлопок&#10;Размер: 42-52&#10;Цвет: белый"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Описание
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Изображение
            </label>
            {preview && (
              <div className="mb-3 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center min-h-[120px] max-h-60">
                <img src={preview} alt="Preview" className="object-contain" style={{ maxWidth: '100%', maxHeight: '240px' }} />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-600 hover:file:bg-brand-100 file:cursor-pointer"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
