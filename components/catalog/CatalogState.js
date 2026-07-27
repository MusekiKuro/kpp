import Link from 'next/link'

export function CatalogEmptyState({ locale, dictionary }) {
  return <div className="rounded-3xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm"><h2 className="text-2xl font-bold text-slate-900">{dictionary.catalog.emptyTitle}</h2><p className="mx-auto mt-3 max-w-md text-slate-500">{dictionary.catalog.emptyText}</p><Link href={`/${locale}/catalog`} className="mt-7 inline-flex rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700">{dictionary.catalog.clear}</Link></div>
}

export function CatalogErrorState({ locale, dictionary }) {
  return <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-20 text-center"><h2 className="text-2xl font-bold text-red-900">{dictionary.catalog.loadError}</h2><p className="mt-3 text-red-700">{dictionary.catalog.loadErrorText}</p><Link href={`/${locale}/catalog`} className="mt-7 inline-flex rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white hover:bg-red-800">{dictionary.states.retry}</Link></div>
}
