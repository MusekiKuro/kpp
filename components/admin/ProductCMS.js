'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { GalleryController } from '@/lib/gallery-controller.mjs'
import { SaveController } from '@/lib/save-controller.mjs'

const emptyProduct = {
  sku: '', external_id: '', slug: '', category_id: '', brand_id: '', name_ru: '', name_kk: '',
  short_description_ru: '', short_description_kk: '', description_ru: '', description_kk: '',
  warranty_ru: '', warranty_kk: '', price: { mode: 'request', amount: '', old_amount: '', currency: 'KZT' },
  stock_status: 'unknown', publication_status: 'draft', publish_ru: false, publish_kk: false,
  translation_status_kk: 'missing', is_featured: false, sort_order: 0,
  seo: { ru: { title: '', description: '' }, kk: { title: '', description: '' } }, attributes: [], images: [],
}

const qualityLabels = {
  missing_sku: 'Нет SKU', missing_kz: 'Нет KZ', missing_image: 'Нет изображения',
  missing_category: 'Нет категории', missing_brand: 'Нет бренда',
}

function cloneProduct(product) {
  return JSON.parse(JSON.stringify({ ...emptyProduct, ...product, price: { ...emptyProduct.price, ...(product?.price || {}) }, seo: { ru: { ...emptyProduct.seo.ru, ...(product?.seo?.ru || {}) }, kk: { ...emptyProduct.seo.kk, ...(product?.seo?.kk || {}) } } }))
}

async function jsonOrError(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
  return body
}

export default function ProductCMS() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [attributes, setAttributes] = useState([])
  const [pagination, setPagination] = useState({ page: 1, page_size: 20, total: 0, total_pages: 0 })
  const [query, setQuery] = useState({ q: '', quality: '', status: '', categoryId: '', brandId: '', priceMode: '', translation: '' })
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isGalleryBusy, setIsGalleryBusy] = useState(false)
  const [localeTab, setLocaleTab] = useState('ru')
  const [previewLocale, setPreviewLocale] = useState(null)
  const [message, setMessage] = useState(null)
  const saveBusyRef = useRef(false)
  // openerRef: records the focused element immediately before the editor dialog is opened.
  // It is stored as a ref so it remains stable during editing and is not read from inside effects.
  const openerRef = useRef(null)

  const loadLookups = useCallback(async () => {
    const [categoryResponse, brandResponse, attributeResponse] = await Promise.all([
      authFetch('/api/admin/catalog/categories'), authFetch('/api/admin/catalog/brands'), authFetch('/api/admin/catalog/attributes'),
    ])
    const [categoryBody, brandBody, attributeBody] = await Promise.all([jsonOrError(categoryResponse), jsonOrError(brandResponse), jsonOrError(attributeResponse)])
    setCategories(categoryBody.items || [])
    setBrands(brandBody.items || [])
    setAttributes((attributeBody.items || []).filter((attribute) => attribute.status !== 'archived'))
  }, [])

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ ...query, page: String(pagination.page), pageSize: String(pagination.page_size) })
      const body = await jsonOrError(await authFetch(`/api/admin/catalog/products?${params}`))
      setItems(body.items || [])
      setPagination((current) => body.pagination || current)
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Не удалось загрузить товары' })
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.page_size, query])

  useEffect(() => { loadLookups().catch((error) => setMessage({ type: 'error', text: error.message })) }, [loadLookups])
  useEffect(() => { loadProducts() }, [loadProducts])

  const saveControllerRef = useRef(null)
  if (saveControllerRef.current === null) {
    saveControllerRef.current = new SaveController({
      setEditor,
      setMessage,
      setIsSaving,
      authFetch,
      jsonOrError,
      loadProducts,
      saveBusyRef,
    })
  }

  const save = async () => {
    // Mutex guard via saveBusyRef and SaveController (calls setIsSaving(true), try/finally setIsSaving(false))
    return saveControllerRef.current.save(editor, attributes)
  }

  const archive = async (item) => {
    if (!window.confirm(`Архивировать «${item.name_ru || item.name || item.sku}»?`)) return
    try {
      await jsonOrError(await authFetch(`/api/admin/catalog/products/${item.id}`, { method: 'DELETE' }))
      setMessage({ type: 'success', text: 'Товар архивирован' })
      await loadProducts()
    } catch (error) { setMessage({ type: 'error', text: error.message }) }
  }

  const updateEditor = (field, value) => setEditor((current) => ({ ...current, [field]: value }))
  const updateLocale = (field, value) => setEditor((current) => ({ ...current, [`${field}_${localeTab}`]: value }))
  const updateSeo = (field, value) => setEditor((current) => ({ ...current, seo: { ...current.seo, [localeTab]: { ...current.seo[localeTab], [field]: value } } }))
  const updatePrice = (field, value) => setEditor((current) => ({ ...current, price: { ...current.price, [field]: value } }))

  const addAttribute = () => setEditor((current) => ({ ...current, attributes: [...(current.attributes || []), { attribute_id: attributes[0]?.id || '', data_type: attributes[0]?.data_type || 'text', value_text_ru: '', value_text_kk: '', value_number: null, value_boolean: null, value_option: '', raw_value: '' }] }))
  const updateAttribute = (index, field, value) => setEditor((current) => ({ ...current, attributes: current.attributes.map((entry, position) => position === index ? { ...entry, [field]: value } : entry) }))
  const removeAttribute = (index) => setEditor((current) => ({ ...current, attributes: current.attributes.filter((_, position) => position !== index) }))
  const handleAttributeIdChange = (index, newAttributeId) => {
    const newAttrMeta = attributes.find((a) => a.id === newAttributeId)
    const dataType = newAttrMeta?.data_type || 'text'
    setEditor((current) => ({
      ...current,
      attributes: current.attributes.map((entry, position) =>
        position === index
          ? {
              attribute_id: newAttributeId,
              data_type: dataType,
              value_text_ru: dataType === 'text' ? entry.value_text_ru || '' : null,
              value_text_kk: dataType === 'text' ? entry.value_text_kk || '' : null,
              value_number: dataType === 'number' ? (entry.value_number ?? null) : null,
              value_boolean: dataType === 'boolean' ? (entry.value_boolean ?? null) : null,
              value_option: dataType === 'option' ? entry.value_option || '' : null,
              raw_value: null,
            }
          : entry,
      ),
    }))
  }

  const galleryControllerRef = useRef(null)
  if (galleryControllerRef.current === null) {
    galleryControllerRef.current = new GalleryController({
      setEditor,
      setMessage,
      authFetch,
      jsonOrError,
      onBusyChange: (busy) => setIsGalleryBusy(busy),
    })
  }

  const uploadGalleryImage = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    await galleryControllerRef.current.uploadGalleryImage(editor, file)
    event.target.value = ''
  }

  const updateImage = (image, changes) => galleryControllerRef.current.updateImage(editor, image, changes)
  const deleteImage = (image) => galleryControllerRef.current.deleteImage(editor, image)
  const reorderImages = (newImages) => galleryControllerRef.current.reorderImages(editor, newImages)

  const moveImage = (index, direction) => {
    if (!editor?.images) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= editor.images.length) return
    const updated = [...editor.images]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    reorderImages(updated)
  }

  // dialogRef: moves initial focus to the first focusable element inside the dialog.
  const dialogRef = useCallback((node) => {
    if (node) {
      const focusable = node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (focusable.length) focusable[0].focus()
    }
  }, [])

  // Focus trap + Escape handler.
  // Depends only on whether the editor is open (Boolean), not on the full editor object,
  // so the effect is stable during editing and does not re-run on every field change.
  const isEditorOpen = editor !== null
  useEffect(() => {
    if (!isEditorOpen) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        // Do not allow closing the dialog while a save is in-flight to prevent inconsistent state.
        // isSaving is read via closure; we use the setter pattern to read current value safely.
        event.preventDefault()
        setIsSaving((currentlySaving) => {
          if (!currentlySaving) setEditor(null)
          return currentlySaving
        })
        return
      }

      if (event.key === 'Tab') {
        const dialogNode = document.querySelector('[role="dialog"]')
        if (!dialogNode) return

        const focusables = Array.from(
          dialogNode.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.disabled && el.offsetParent !== null)

        if (focusables.length === 0) return

        const firstElement = focusables[0]
        const lastElement = focusables[focusables.length - 1]

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the opener element (captured before the dialog was opened).
      // Guard against returning focus to a removed DOM element.
      const opener = openerRef.current
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus()
      }
      openerRef.current = null
    }
  }, [isEditorOpen])

  const selectedCategory = useMemo(() => categories.find((category) => category.id === editor?.category_id), [categories, editor?.category_id])

  return (
    <div className="space-y-5">
      {message && <div className={`rounded-xl px-4 py-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message.text}<button className="float-right" onClick={() => setMessage(null)}>×</button></div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Товары</h1><p className="text-sm text-gray-500">CMS с quality-фильтрами и отдельной публикацией RU/KZ</p></div>
        <button className="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white" onClick={() => { openerRef.current = document.activeElement; setEditor(cloneProduct()); setLocaleTab('ru'); setPreviewLocale(null) }}>Добавить товар</button>
      </div>
      <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:grid-cols-4">
        <input className="rounded-lg border p-2" placeholder="Поиск SKU или названия" value={query.q} onChange={(event) => { setQuery({ ...query, q: event.target.value }); setPagination({ ...pagination, page: 1 }) }} />
        <select className="rounded-lg border p-2" value={query.quality} onChange={(event) => { setQuery({ ...query, quality: event.target.value }); setPagination({ ...pagination, page: 1 }) }}><option value="">Все качества</option>{Object.entries(qualityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select className="rounded-lg border p-2" value={query.status} onChange={(event) => { setQuery({ ...query, status: event.target.value }); setPagination({ ...pagination, page: 1 }) }}><option value="">Все статусы</option><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select>
        <select className="rounded-lg border p-2" value={query.translation} onChange={(event) => { setQuery({ ...query, translation: event.target.value }); setPagination({ ...pagination, page: 1 }) }}><option value="">Перевод KZ: любой</option><option value="missing">Нет</option><option value="ai_draft">AI draft</option><option value="verified">Проверен</option></select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-4">Товар</th><th className="p-4">SKU</th><th className="p-4">Статус</th><th className="p-4">Качество</th><th className="p-4" /></tr></thead><tbody className="divide-y divide-gray-100">
          {loading ? <tr><td className="p-8 text-center" colSpan="5">Загрузка…</td></tr> : items.map((item) => <tr key={item.id}><td className="p-4"><div className="font-medium">{item.name_ru || item.name || 'Без названия'}</div><div className="text-xs text-gray-500">{item.category?.name_ru || item.category || 'Без категории'}</div></td><td className="p-4 font-mono text-xs">{item.sku || '—'}</td><td className="p-4">{item.publication_status}{item.publish_ru ? ' · RU' : ''}{item.publish_kk ? ' · KZ' : ''}</td><td className="p-4"><div className="flex flex-wrap gap-1">{(item.quality_issues || []).map((issue) => <span key={issue} className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">{qualityLabels[issue]}</span>)}</div></td><td className="p-4 text-right"><button className="mr-3 text-brand-600" onClick={(e) => { openerRef.current = e.currentTarget; setEditor(cloneProduct(item)); setLocaleTab('ru'); setPreviewLocale(null) }}>Редактировать</button><button className="text-red-600" onClick={() => archive(item)}>Архив</button></td></tr>)}
          {!loading && items.length === 0 && <tr><td className="p-8 text-center text-gray-500" colSpan="5">Ничего не найдено</td></tr>}
        </tbody></table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500"><span>{pagination.total} записей</span><div className="flex gap-2"><button disabled={pagination.page <= 1} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>Назад</button><span className="px-2 py-1">{pagination.page} / {pagination.total_pages || 1}</span><button disabled={!pagination.total_pages || pagination.page >= pagination.total_pages} className="rounded-lg border px-3 py-1 disabled:opacity-40" onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>Далее</button></div></div>

      {editor && <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cms-dialog-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:p-8 motion-reduce:transition-none" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) setEditor(null) }}><div className="mx-auto max-w-5xl rounded-2xl bg-white p-5 shadow-xl sm:p-7">
        <div className="mb-5 flex items-center justify-between"><div><h2 id="cms-dialog-title" className="text-xl font-bold">{editor.id ? 'Редактирование товара' : 'Новый товар'}</h2><p className="text-xs text-gray-500">{editor.id ? editor.id : 'Сначала сохраните, чтобы добавить галерею'}</p></div><button aria-label="Закрыть редактор товара" className="rounded-lg px-2 text-2xl text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-600" disabled={isSaving} onClick={() => setEditor(null)}>×</button></div>
        <div className="grid gap-4 md:grid-cols-3"><label className="text-sm">SKU<input className="mt-1 w-full rounded-lg border p-2" value={editor.sku} onChange={(event) => updateEditor('sku', event.target.value)} /></label><label className="text-sm">Slug<input className="mt-1 w-full rounded-lg border p-2" value={editor.slug} onChange={(event) => updateEditor('slug', event.target.value)} /></label><label className="text-sm">Порядок<input type="number" className="mt-1 w-full rounded-lg border p-2" value={editor.sort_order} onChange={(event) => updateEditor('sort_order', Number(event.target.value))} /></label><label className="text-sm">Категория<select className="mt-1 w-full rounded-lg border p-2" value={editor.category_id} onChange={(event) => updateEditor('category_id', event.target.value)}><option value="">Не выбрана</option>{categories.filter((category) => category.status !== 'archived').map((category) => <option key={category.id} value={category.id}>{category.name_ru}</option>)}</select></label><label className="text-sm">Бренд<select className="mt-1 w-full rounded-lg border p-2" value={editor.brand_id} onChange={(event) => updateEditor('brand_id', event.target.value)}><option value="">Не выбран</option>{brands.filter((brand) => brand.status !== 'archived').map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="text-sm">Остаток<select className="mt-1 w-full rounded-lg border p-2" value={editor.stock_status} onChange={(event) => updateEditor('stock_status', event.target.value)}><option value="unknown">Неизвестно</option><option value="in_stock">В наличии</option><option value="on_order">Под заказ</option><option value="out_of_stock">Нет в наличии</option></select></label></div>
        <div className="my-5 flex gap-2 border-b"><button className={`border-b-2 px-3 py-2 ${localeTab === 'ru' ? 'border-brand-600 text-brand-600' : 'border-transparent'}`} onClick={() => setLocaleTab('ru')}>RU</button><button className={`border-b-2 px-3 py-2 ${localeTab === 'kk' ? 'border-brand-600 text-brand-600' : 'border-transparent'}`} onClick={() => setLocaleTab('kk')}>KZ</button></div>
        <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Название {localeTab.toUpperCase()}<input className="mt-1 w-full rounded-lg border p-2" value={editor[`name_${localeTab}`] || ''} onChange={(event) => updateLocale('name', event.target.value)} /></label><label className="text-sm">Краткое описание<input className="mt-1 w-full rounded-lg border p-2" value={editor[`short_description_${localeTab}`] || ''} onChange={(event) => updateLocale('short_description', event.target.value)} /></label><label className="text-sm md:col-span-2">Описание<textarea className="mt-1 min-h-28 w-full rounded-lg border p-2" value={editor[`description_${localeTab}`] || ''} onChange={(event) => updateLocale('description', event.target.value)} /></label><label className="text-sm">Гарантия<input className="mt-1 w-full rounded-lg border p-2" value={editor[`warranty_${localeTab}`] || ''} onChange={(event) => updateLocale('warranty', event.target.value)} /></label></div>
        <div className="my-5 grid gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4"><label className="text-sm">Режим цены<select className="mt-1 w-full rounded-lg border p-2" value={editor.price.mode} onChange={(event) => updatePrice('mode', event.target.value)}><option value="request">По запросу</option><option value="exact">Точная</option><option value="from">От</option><option value="hidden">Скрыта</option></select></label><label className="text-sm">Цена<input type="number" step="0.01" className="mt-1 w-full rounded-lg border p-2" value={editor.price.amount ?? ''} onChange={(event) => updatePrice('amount', event.target.value)} /></label><label className="text-sm">Старая цена<input type="number" step="0.01" className="mt-1 w-full rounded-lg border p-2" value={editor.price.old_amount ?? ''} onChange={(event) => updatePrice('old_amount', event.target.value)} /></label><div className="flex items-end text-sm">KZT</div></div>
        <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2"><label className="flex items-center gap-2"><input type="checkbox" checked={editor.publish_ru} onChange={(event) => updateEditor('publish_ru', event.target.checked)} /> Публиковать RU</label><label className="flex items-center gap-2"><input type="checkbox" checked={editor.publish_kk} onChange={(event) => updateEditor('publish_kk', event.target.checked)} /> Публиковать KZ</label><label className="text-sm">Статус<select className="mt-1 w-full rounded-lg border p-2" value={editor.publication_status} onChange={(event) => updateEditor('publication_status', event.target.value)}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label><label className="text-sm">Статус перевода KZ<select className="mt-1 w-full rounded-lg border p-2" value={editor.translation_status_kk} onChange={(event) => updateEditor('translation_status_kk', event.target.value)}><option value="missing">Нет</option><option value="ai_draft">AI draft</option><option value="verified">Проверен</option></select></label></div>
        <div className="my-5 grid gap-4 md:grid-cols-2"><label className="text-sm">SEO title {localeTab.toUpperCase()}<input className="mt-1 w-full rounded-lg border p-2" value={editor.seo[localeTab].title} onChange={(event) => updateSeo('title', event.target.value)} /></label><label className="text-sm">SEO description {localeTab.toUpperCase()}<textarea className="mt-1 w-full rounded-lg border p-2" value={editor.seo[localeTab].description} onChange={(event) => updateSeo('description', event.target.value)} /></label></div>
        <div className="my-5 rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Характеристики</h3><button className="rounded-lg border px-3 py-1 text-sm" onClick={addAttribute}>Добавить</button></div>
          {(editor.attributes || []).map((entry, index) => {
            const attrMeta = attributes.find((a) => a.id === entry.attribute_id)
            const dataType = attrMeta?.data_type || 'text'
            const unitLabel = localeTab === 'kk' ? attrMeta?.unit_kk || attrMeta?.unit_ru : attrMeta?.unit_ru

            return (
              <div key={`${entry.attribute_id}-${index}`} className="mb-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <select
                  className="rounded-lg border p-2"
                  value={entry.attribute_id}
                  onChange={(event) => handleAttributeIdChange(index, event.target.value)}
                >
                  {attributes.map((attribute) => (
                    <option key={attribute.id} value={attribute.id}>
                      {attribute.name_ru} ({attribute.code})
                    </option>
                  ))}
                </select>

                {dataType === 'number' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      className="w-full rounded-lg border p-2"
                      placeholder="Числовое значение"
                      value={entry.value_number ?? ''}
                      onChange={(event) => updateAttribute(index, 'value_number', event.target.value === '' ? null : Number(event.target.value))}
                    />
                    {unitLabel && <span className="text-xs font-semibold text-gray-500">{unitLabel}</span>}
                  </div>
                ) : dataType === 'boolean' ? (
                  <select
                    className="rounded-lg border p-2"
                    value={entry.value_boolean === null || entry.value_boolean === undefined ? '' : String(entry.value_boolean)}
                    onChange={(event) => updateAttribute(index, 'value_boolean', event.target.value === '' ? null : event.target.value === 'true')}
                  >
                    <option value="">— Не выбрано —</option>
                    <option value="true">{localeTab === 'kk' ? 'Иә (Да)' : 'Да'}</option>
                    <option value="false">{localeTab === 'kk' ? 'Жоқ (Нет)' : 'Нет'}</option>
                  </select>
                ) : dataType === 'option' ? (
                  <select
                    className="rounded-lg border p-2"
                    value={entry.value_option || ''}
                    onChange={(event) => updateAttribute(index, 'value_option', event.target.value)}
                    disabled={!Array.isArray(attrMeta?.options) || attrMeta.options.length === 0}
                  >
                    <option value="">— Не выбрано —</option>
                    {(attrMeta?.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input
                    className="rounded-lg border p-2"
                    placeholder={localeTab === 'ru' ? 'Значение RU' : 'Значение KZ'}
                    value={entry[`value_text_${localeTab}`] || ''}
                    onChange={(event) => updateAttribute(index, `value_text_${localeTab}`, event.target.value)}
                  />
                )}

                <button className="text-red-600" onClick={() => removeAttribute(index)}>Удалить</button>
              </div>
            )
          })}
        </div>

        <div className="my-5 rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Галерея</h3>
            <label className="cursor-pointer rounded-lg border px-3 py-1 text-sm">
              Загрузить
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" onChange={uploadGalleryImage} disabled={!editor.id || isGalleryBusy} />
            </label>
          </div>
          {editor.images?.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {editor.images.map((image, idx) => (
                <div key={image.id} className="rounded-lg border p-2">
                  <img src={image.source_url || image.storage_path} alt={image.alt_ru || ''} className="mb-2 aspect-square w-full rounded object-cover" />
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between">
                      <button disabled={isGalleryBusy} className={image.is_primary ? 'font-bold text-brand-600' : 'text-gray-500'} onClick={() => updateImage(image, { is_primary: true })}>
                        {image.is_primary ? 'Primary ★' : 'Сделать primary'}
                      </button>
                      <button disabled={isGalleryBusy} className="text-red-600" onClick={() => deleteImage(image)}>Удалить</button>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <button disabled={idx === 0 || isGalleryBusy} className="disabled:opacity-30 text-gray-600" onClick={() => moveImage(idx, -1)}>↑ Вверх</button>
                      <button disabled={idx === editor.images.length - 1 || isGalleryBusy} className="disabled:opacity-30 text-gray-600" onClick={() => moveImage(idx, 1)}>↓ Вниз</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Изображений пока нет.</p>
          )}
        </div>
        <div className="my-5 flex flex-wrap gap-3"><button className="rounded-lg border px-4 py-2" onClick={() => setPreviewLocale(previewLocale ? null : localeTab)}>{previewLocale ? 'Закрыть preview' : `Preview ${localeTab.toUpperCase()}`}</button><button id="cms-save-btn" className="rounded-lg bg-brand-600 px-5 py-2 font-semibold text-white disabled:opacity-60" disabled={isSaving} onClick={save}>{isSaving ? 'Сохранение…' : 'Сохранить'}</button></div>
        {previewLocale && <div className="rounded-xl bg-gray-50 p-5"><p className="mb-2 text-xs uppercase text-gray-500">Preview {previewLocale.toUpperCase()}</p><h3 className="text-xl font-bold">{editor[`name_${previewLocale}`] || 'Без названия'}</h3><p className="mt-2 text-gray-600">{editor[`short_description_${previewLocale}`] || editor[`description_${previewLocale}`] || 'Нет описания'}</p>{selectedCategory && <p className="mt-3 text-xs text-gray-500">Категория: {selectedCategory.name_ru}</p>}</div>}
      </div></div>}
    </div>
  )
}
