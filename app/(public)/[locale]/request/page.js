'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CatalogImage from '@/components/catalog/CatalogImage'
import PriceDisplay from '@/components/catalog/PriceDisplay'
import { useCart } from '@/components/CartProvider'
import { DEFAULT_LOCALE, isLocale, localizedPath } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { trackEvent } from '@/lib/analytics'

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return `quote-${Date.now()}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
  }
  return `quote-${Date.now()}-${Date.now().toString(36)}`
}

export default function RequestPage() {
  const params = useParams()
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE
  const dictionary = getDictionary(locale)
  const { items, updateQuantity, removeFromCart, clearCart } = useCart()
  const [products, setProducts] = useState({})
  const [previewError, setPreviewError] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    organization: '',
    bin: '',
    city: '',
    customer_message: '',
    consent_personal_data: false,
  })

  const ids = useMemo(() => items.map((item) => item.id).join(','), [items])

  useEffect(() => {
    trackEvent('request_form_open', { locale })
  }, [locale])

  useEffect(() => {
    if (!ids) {
      return undefined
    }
    let active = true
    fetch(`/api/quote-requests/preview?locale=${locale}&ids=${encodeURIComponent(ids)}`, { credentials: 'same-origin' })
      .then(async (response) => {
        const data = await response.json().catch(() => [])
        if (!response.ok || !Array.isArray(data)) throw new Error('preview')
        return data
      })
      .then((data) => {
        if (!active) return
        setPreviewError(false)
        setProducts(Object.fromEntries(data.map((product) => [product.id, product])))
      })
      .catch(() => {
        if (active) setPreviewError(true)
      })
    return () => { active = false }
  }, [ids, locale])

  const updateForm = (event) => {
    const { name, value, type, checked } = event.target
    setForm((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const query = new URLSearchParams(window.location.search)
    const payload = {
      ...form,
      locale,
      idempotency_key: idempotencyKey,
      source_url: window.location.href,
      utm_source: query.get('utm_source') || '',
      utm_medium: query.get('utm_medium') || '',
      utm_campaign: query.get('utm_campaign') || '',
      utm_term: query.get('utm_term') || '',
      utm_content: query.get('utm_content') || '',
      items: items.map(({ id, qty }) => ({ product_id: id, quantity: qty })),
    }

    try {
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 400 && data.error?.toLowerCase().includes('product')) throw new Error(dictionary.request.form.unavailable)
        throw new Error(data.error || dictionary.request.form.genericError)
      }
      clearCart()
      setSubmitted(true)
      trackEvent('request_submit', { locale, outcome: 'success' })
      setIdempotencyKey(newIdempotencyKey())
    } catch (submitError) {
      setError(submitError.message || dictionary.request.form.genericError)
      trackEvent('request_submit', { locale, outcome: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return <>
    <Header />
    <main id="main-content" className="flex-1 bg-surface px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-heading text-4xl font-extrabold text-slate-900">{dictionary.request.title}</h1>
        <p className="mt-3 max-w-3xl text-slate-600">{dictionary.request.note}</p>
        {submitted ? <SuccessState locale={locale} dictionary={dictionary} /> : items.length === 0 ? <EmptyState locale={locale} dictionary={dictionary} /> : <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.8fr)]"><section aria-labelledby="request-items-title"><h2 id="request-items-title" className="text-2xl font-bold text-slate-900">{dictionary.request.title}</h2>{previewError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{dictionary.request.form.unavailable}</p>}<div className="mt-4 space-y-3">{items.map((item) => <RequestItem key={item.id} item={item} product={products[item.id]} locale={locale} dictionary={dictionary} updateQuantity={updateQuantity} removeFromCart={removeFromCart} />)}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-2xl font-bold text-slate-900">{dictionary.request.form.title}</h2>{error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<form onSubmit={handleSubmit} className="mt-5 space-y-4"><Field name="customer_name" label={dictionary.request.form.name} value={form.customer_name} onChange={updateForm} required /><Field name="customer_phone" label={dictionary.request.form.phone} type="tel" value={form.customer_phone} onChange={updateForm} required /><Field name="customer_email" label={dictionary.request.form.email} type="email" value={form.customer_email} onChange={updateForm} /><Field name="organization" label={dictionary.request.form.organization} value={form.organization} onChange={updateForm} /><Field name="bin" label={dictionary.request.form.bin} inputMode="numeric" value={form.bin} onChange={updateForm} /><Field name="city" label={dictionary.request.form.city} value={form.city} onChange={updateForm} /><label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{dictionary.request.form.message}</span><textarea name="customer_message" value={form.customer_message} onChange={updateForm} rows="4" className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" /></label><label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" name="consent_personal_data" checked={form.consent_personal_data} onChange={updateForm} required className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" /><span>{dictionary.request.form.consent}</span></label><button type="submit" disabled={submitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-600 px-5 py-3 font-bold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">{submitting ? dictionary.request.form.sending : dictionary.request.form.submit}</button></form></section></div>}
      </div>
    </main>
    <Footer />
  </>
}

function Field({ name, label, type = 'text', value, onChange, required = false, inputMode }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{label}{required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}</span><input name={name} type={type} inputMode={inputMode} autoComplete={name === 'customer_name' ? 'name' : name === 'customer_phone' ? 'tel' : name === 'customer_email' ? 'email' : 'off'} value={value} onChange={onChange} required={required} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 motion-reduce:transition-none" /></label>
}

function RequestItem({ item, product, locale, dictionary, updateQuantity, removeFromCart }) {
  return <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-50"><CatalogImage src={product?.image_url} alt={product?.name || item.id} className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{product?.name || item.id}</h3>{product?.sku && <p className="mt-1 text-xs text-slate-500">{dictionary.product.sku}: {product.sku}</p>}</div><button type="button" onClick={() => removeFromCart(item.id)} className="text-sm font-bold text-red-600 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">{dictionary.request.remove}</button></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-semibold text-brand-700">{product ? <PriceDisplay price={product.price} locale={locale} labels={dictionary.catalog.priceValues} /> : '—'}</span><label className="flex items-center gap-2 text-sm text-slate-600">{dictionary.request.quantity}<input type="number" min="1" max="99" value={item.qty} onChange={(event) => updateQuantity(item.id, Math.max(1, Math.min(99, Number(event.target.value) || 1)))} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" /></label></div></div></div>
}

function EmptyState({ locale, dictionary }) {
  return <div className="mt-8 rounded-3xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm"><h2 className="text-2xl font-bold text-slate-900">{dictionary.request.emptyTitle}</h2><p className="mt-3 text-slate-500">{dictionary.request.emptyText}</p><Link href={localizedPath(locale, '/catalog')} className="mt-7 inline-flex rounded-xl bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700">{dictionary.request.openCatalog}</Link></div>
}

function SuccessState({ locale, dictionary }) {
  return <div role="status" className="mt-8 rounded-3xl border border-green-200 bg-green-50 px-6 py-20 text-center"><h2 className="text-2xl font-bold text-green-900">{dictionary.request.form.successTitle}</h2><p className="mx-auto mt-3 max-w-lg text-green-800">{dictionary.request.form.successText}</p><Link href={localizedPath(locale, '/catalog')} className="mt-7 inline-flex rounded-xl bg-brand-600 px-5 py-3 font-bold text-white hover:bg-brand-700">{dictionary.request.openCatalog}</Link></div>
}
