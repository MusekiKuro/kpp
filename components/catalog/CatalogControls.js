'use client'

import { usePathname, useRouter } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

export default function CatalogControls({ dictionary, categories, brands, filters, lockedCategory, lockedBrand }) {
  const pathname = usePathname()
  const router = useRouter()

  const submit = (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    for (const [key, value] of data.entries()) {
      if (typeof value === 'string' && value.trim()) params.set(key, value.trim())
    }
    trackEvent('search', { has_query: Boolean(params.get('q')) })
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label={dictionary.catalog.title}>
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="flex-1">
          <span className="sr-only">{dictionary.catalog.search}</span>
          <input name="q" type="search" autoComplete="off" defaultValue={filters.q || ''} placeholder={dictionary.catalog.search} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 motion-reduce:transition-none" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">{dictionary.catalog.searchButton}</button>
        <a href={pathname} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{dictionary.catalog.clear}</a>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {lockedCategory ? <LockedFilter label={dictionary.catalog.category} value={categories.find((item) => item.slug === lockedCategory)?.name || lockedCategory} /> : <Select label={dictionary.catalog.category} name="category" value={filters.category} options={categories.map((item) => [item.slug, item.name])} all={dictionary.catalog.all} />}
        {lockedBrand ? <LockedFilter label={dictionary.catalog.brand} value={brands.find((item) => item.slug === lockedBrand)?.name || lockedBrand} /> : <Select label={dictionary.catalog.brand} name="brand" value={filters.brand} options={brands.map((item) => [item.slug, item.name])} all={dictionary.catalog.all} />}
        <Select label={dictionary.catalog.stock} name="stock" value={filters.stock} options={Object.entries(dictionary.catalog.stockValues)} all={dictionary.catalog.all} />
        <Select label={dictionary.catalog.priceMode} name="price_mode" value={filters.price_mode} options={Object.entries(dictionary.catalog.priceValues)} all={dictionary.catalog.all} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={dictionary.catalog.minPrice} name="min_price" defaultValue={filters.min_price ?? ''} inputMode="decimal" />
        <Field label={dictionary.catalog.maxPrice} name="max_price" defaultValue={filters.max_price ?? ''} inputMode="decimal" />
        <Select label={dictionary.catalog.sort} name="sort" value={filters.sort} options={Object.entries(dictionary.catalog.sortValues)} all={dictionary.catalog.all} />
      </div>
    </form>
  )
}

function Field({ label, name, defaultValue, inputMode }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{label}</span><input name={name} defaultValue={defaultValue} inputMode={inputMode} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200" /></label>
}

function Select({ label, name, value, options, all }) {
  return <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{label}</span><select name={name} defaultValue={value || ''} className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"><option value="">{all}</option>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>
}

function LockedFilter({ label, value }) {
  return <div className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{label}</span><div className="flex min-h-11 items-center rounded-xl border border-brand-100 bg-brand-50 px-3 text-sm text-brand-800">{value}</div></div>
}
