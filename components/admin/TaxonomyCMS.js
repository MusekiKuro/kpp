'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'

const configs = {
  categories: { title: 'Категории', endpoint: '/api/admin/catalog/categories', name: 'Категория' },
  brands: { title: 'Бренды', endpoint: '/api/admin/catalog/brands', name: 'Бренд' },
  attributes: { title: 'Характеристики', endpoint: '/api/admin/catalog/attributes', name: 'Характеристика' },
}

function empty(kind) {
  if (kind === 'categories') return { slug: '', parent_id: '', name_ru: '', name_kk: '', description_ru: '', description_kk: '', seo: { ru: { title: '', description: '' }, kk: { title: '', description: '' } }, sort_order: 0, status: 'draft' }
  if (kind === 'brands') return { slug: '', name: '', description_ru: '', description_kk: '', logo_url: '', website_url: '', sort_order: 0, status: 'draft' }
  return { category_id: '', code: '', name_ru: '', name_kk: '', data_type: 'text', unit_ru: '', unit_kk: '', options: [], options_input: '', is_filterable: false, sort_order: 0, status: 'published' }
}

async function bodyOrError(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
  return body
}

export default function TaxonomyCMS({ kind }) {
  const config = configs[kind]
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [editor, setEditor] = useState(null)
  const [localeTab, setLocaleTab] = useState('ru')
  const [preview, setPreview] = useState(false)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    try {
      const result = await bodyOrError(await authFetch(config.endpoint))
      setItems(result.items || [])
      if (kind !== 'categories') {
        const categoryResult = await bodyOrError(await authFetch('/api/admin/catalog/categories'))
        setCategories(categoryResult.items || [])
      }
    } catch (error) { setMessage({ type: 'error', text: error.message }) }
  }, [config.endpoint, kind])

  useEffect(() => { load() }, [load])

  const save = async () => {
    try {
      const payload = kind === 'categories'
        ? { parent_id: editor.parent_id || null, slug: editor.slug, name_ru: editor.name_ru, name_kk: editor.name_kk, description_ru: editor.description_ru, description_kk: editor.description_kk, seo: editor.seo, sort_order: editor.sort_order, status: editor.status }
        : kind === 'brands'
          ? { slug: editor.slug, name: editor.name, description_ru: editor.description_ru, description_kk: editor.description_kk, logo_url: editor.logo_url, website_url: editor.website_url, sort_order: editor.sort_order, status: editor.status }
          : { category_id: editor.category_id || null, code: editor.code, name_ru: editor.name_ru, name_kk: editor.name_kk, data_type: editor.data_type, unit_ru: editor.unit_ru, unit_kk: editor.unit_kk, options: editor.data_type === 'option' ? (editor.options_input ?? (editor.options || []).join('\n')).split(/\r?\n/).map((option) => option.trim()).filter(Boolean) : [], is_filterable: editor.is_filterable, sort_order: editor.sort_order, status: editor.status }
      const response = await authFetch(editor.id ? `${config.endpoint}/${editor.id}` : config.endpoint, { method: editor.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      await bodyOrError(response)
      setEditor(null); setMessage({ type: 'success', text: `${config.name} сохранён` }); await load()
    } catch (error) { setMessage({ type: 'error', text: error.message }) }
  }

  const archive = async (item) => {
    if (!window.confirm(`Архивировать «${item.name_ru || item.name || item.code}»?`)) return
    try { await bodyOrError(await authFetch(`${config.endpoint}/${item.id}`, { method: 'DELETE' })); setMessage({ type: 'success', text: 'Запись архивирована' }); await load() } catch (error) { setMessage({ type: 'error', text: error.message }) }
  }

  const update = (field, value) => setEditor((current) => ({ ...current, [field]: value }))
  const updateLocale = (field, value) => setEditor((current) => ({ ...current, [`${field}_${localeTab}`]: value }))
  const updateSeo = (field, value) => setEditor((current) => ({ ...current, seo: { ...current.seo, [localeTab]: { ...current.seo[localeTab], [field]: value } } }))

  return <div className="space-y-5">
    {message && <div className={`rounded-xl px-4 py-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message.text}<button className="float-right" onClick={() => setMessage(null)}>×</button></div>}
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">{config.title}</h1><p className="text-sm text-gray-500">CRUD, preview и архивирование</p></div><button className="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white" onClick={() => { setEditor(empty(kind)); setLocaleTab('ru'); setPreview(false) }}>Добавить</button></div>
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="p-4">Название</th><th className="p-4">Slug / code</th><th className="p-4">Статус</th><th className="p-4" /></tr></thead><tbody className="divide-y divide-gray-100">{items.map((item) => <tr key={item.id}><td className="p-4"><div className="font-medium">{item.name_ru || item.name || item.code}</div>{kind === 'categories' && item.parent_id && <div className="text-xs text-gray-500">Есть родитель</div>}</td><td className="p-4 font-mono text-xs">{item.slug || item.code}</td><td className="p-4">{item.status || '—'}</td><td className="p-4 text-right"><button className="mr-3 text-brand-600" onClick={() => { setEditor({ ...item, seo: { ru: { title: item.seo_title_ru || '', description: item.seo_description_ru || '' }, kk: { title: item.seo_title_kk || '', description: item.seo_description_kk || '' } } }); setLocaleTab('ru'); setPreview(false) }}>Редактировать</button><button className="text-red-600" onClick={() => archive(item)}>Архив</button></td></tr>)}{items.length === 0 && <tr><td className="p-8 text-center text-gray-500" colSpan="4">Нет записей</td></tr>}</tbody></table></div>
    {editor && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:p-8" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null) }}><div className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-xl sm:p-7"><div className="mb-5 flex justify-between"><h2 className="text-xl font-bold">{editor.id ? `Редактировать: ${config.name}` : `Новая запись: ${config.name}`}</h2><button className="text-2xl text-gray-400" onClick={() => setEditor(null)}>×</button></div>
      {kind === 'categories' && <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Slug<input className="mt-1 w-full rounded-lg border p-2" value={editor.slug} onChange={(event) => update('slug', event.target.value)} /></label><label className="text-sm">Родитель<select className="mt-1 w-full rounded-lg border p-2" value={editor.parent_id || ''} onChange={(event) => update('parent_id', event.target.value)}><option value="">Корневая категория</option>{items.filter((item) => item.id !== editor.id && item.status !== 'archived').map((item) => <option key={item.id} value={item.id}>{item.name_ru}</option>)}</select></label></div>}
      {kind === 'brands' && <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Название<input className="mt-1 w-full rounded-lg border p-2" value={editor.name} onChange={(event) => update('name', event.target.value)} /></label><label className="text-sm">Slug<input className="mt-1 w-full rounded-lg border p-2" value={editor.slug} onChange={(event) => update('slug', event.target.value)} /></label></div>}
      {kind === 'attributes' && <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Code<input className="mt-1 w-full rounded-lg border p-2" value={editor.code} onChange={(event) => update('code', event.target.value)} /></label><label className="text-sm">Тип<select className="mt-1 w-full rounded-lg border p-2" value={editor.data_type} onChange={(event) => update('data_type', event.target.value)}><option value="text">Текст</option><option value="number">Число</option><option value="boolean">Да/нет</option><option value="option">Опция</option></select></label><label className="text-sm">Категория<select className="mt-1 w-full rounded-lg border p-2" value={editor.category_id || ''} onChange={(event) => update('category_id', event.target.value)}><option value="">Общая</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name_ru}</option>)}</select></label><label className="flex items-end gap-2 text-sm"><input type="checkbox" checked={editor.is_filterable} onChange={(event) => update('is_filterable', event.target.checked)} /> Использовать в фильтрах</label></div>}
      {kind !== 'brands' && <div className="my-5 flex gap-2 border-b"><button className={`border-b-2 px-3 py-2 ${localeTab === 'ru' ? 'border-brand-600 text-brand-600' : 'border-transparent'}`} onClick={() => setLocaleTab('ru')}>RU</button><button className={`border-b-2 px-3 py-2 ${localeTab === 'kk' ? 'border-brand-600 text-brand-600' : 'border-transparent'}`} onClick={() => setLocaleTab('kk')}>KZ</button></div>}
      {kind === 'brands' && <div className="my-5 flex gap-2 border-b"><button className={`border-b-2 px-3 py-2 ${localeTab === 'ru' ? 'border-brand-600 text-brand-600' : 'border-transparent'}`} onClick={() => setLocaleTab('ru')}>RU</button><button className={`border-b-2 px-3 py-2 ${localeTab === 'kk' ? 'border-brand-600 text-brand-600' : 'border-transparent'}`} onClick={() => setLocaleTab('kk')}>KZ</button></div>}
      {kind === 'brands' ? <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Описание {localeTab.toUpperCase()}<textarea className="mt-1 min-h-24 w-full rounded-lg border p-2" value={editor[`description_${localeTab}`] || ''} onChange={(event) => updateLocale('description', event.target.value)} /></label><label className="text-sm">Логотип URL<input className="mt-1 w-full rounded-lg border p-2" value={editor.logo_url || ''} onChange={(event) => update('logo_url', event.target.value)} /></label><label className="text-sm">Сайт URL<input className="mt-1 w-full rounded-lg border p-2" value={editor.website_url || ''} onChange={(event) => update('website_url', event.target.value)} /></label></div> : <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Название {localeTab.toUpperCase()}<input className="mt-1 w-full rounded-lg border p-2" value={editor[`name_${localeTab}`] || ''} onChange={(event) => updateLocale('name', event.target.value)} /></label><label className="text-sm">Описание {localeTab.toUpperCase()}<textarea className="mt-1 min-h-24 w-full rounded-lg border p-2" value={editor[`description_${localeTab}`] || ''} onChange={(event) => updateLocale('description', event.target.value)} /></label>{kind === 'categories' && <><label className="text-sm">SEO title<input className="mt-1 w-full rounded-lg border p-2" value={editor.seo[localeTab].title} onChange={(event) => updateSeo('title', event.target.value)} /></label><label className="text-sm">SEO description<textarea className="mt-1 w-full rounded-lg border p-2" value={editor.seo[localeTab].description} onChange={(event) => updateSeo('description', event.target.value)} /></label></>}</div>}
      {kind === 'attributes' && <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm">Единица RU<input className="mt-1 w-full rounded-lg border p-2" value={editor.unit_ru || ''} onChange={(event) => update('unit_ru', event.target.value)} /></label><label className="text-sm">Единица KZ<input className="mt-1 w-full rounded-lg border p-2" value={editor.unit_kk || ''} onChange={(event) => update('unit_kk', event.target.value)} /></label></div>}
      <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm">Статус<select className="mt-1 w-full rounded-lg border p-2" value={editor.status} onChange={(event) => update('status', event.target.value)}><option value="draft">Черновик</option><option value="published">Опубликован</option><option value="archived">Архив</option></select></label><label className="text-sm">Порядок<input type="number" className="mt-1 w-full rounded-lg border p-2" value={editor.sort_order} onChange={(event) => update('sort_order', Number(event.target.value))} /></label></div>
      <div className="mt-5 flex gap-3"><button className="rounded-lg border px-4 py-2" onClick={() => setPreview(!preview)}>{preview ? 'Закрыть preview' : `Preview ${localeTab.toUpperCase()}`}</button><button className="rounded-lg bg-brand-600 px-5 py-2 font-semibold text-white" onClick={save}>Сохранить</button></div>{preview && <div className="mt-4 rounded-xl bg-gray-50 p-4"><p className="text-xs uppercase text-gray-500">Preview {localeTab.toUpperCase()}</p><h3 className="text-xl font-bold">{editor.name || editor[`name_${localeTab}`] || editor.code}</h3><p className="text-gray-600">{editor[`description_${localeTab}`] || 'Нет описания'}</p></div>}
      {kind === 'attributes' && editor.data_type === 'option' && <label className="mt-5 block text-sm">Варианты — по одному в строке<textarea className="mt-1 min-h-28 w-full rounded-lg border p-2" value={editor.options_input ?? (editor.options || []).join('\n')} onChange={(event) => update('options_input', event.target.value)} placeholder={'Красный\nСиний\nЗелёный'} /></label>}
    </div></div>}
  </div>
}
