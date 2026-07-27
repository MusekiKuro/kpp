import Link from 'next/link'

export default function CatalogPagination({ locale, pathname, searchParams, pagination, dictionary }) {
  if (!pagination || pagination.total_pages <= 1) return null

  const makeHref = (page) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(page))
    return `/${locale}${pathname}${params.toString() ? `?${params.toString()}` : ''}`
  }

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      {pagination.has_previous && <Link href={makeHref(pagination.page - 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700">{dictionary.catalog.previous}</Link>}
      <span className="px-3 text-sm font-semibold text-slate-500">{dictionary.catalog.page} {pagination.page} / {pagination.total_pages}</span>
      {pagination.has_next && <Link href={makeHref(pagination.page + 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700">{dictionary.catalog.next}</Link>}
    </nav>
  )
}
