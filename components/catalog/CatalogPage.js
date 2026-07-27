import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CatalogCard from './CatalogCard'
import CatalogControls from './CatalogControls'
import CatalogPagination from './CatalogPagination'
import { CatalogEmptyState, CatalogErrorState } from './CatalogState'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getPublishedBrands, getPublishedCategories, getPublishedProducts } from '@/lib/catalog/repository.mjs'

export default async function CatalogPage({ locale, pathname = '/catalog', heading, description, searchParams = {}, lockedCategory, lockedBrand }) {
  const dictionary = getDictionary(locale)
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value !== undefined && value !== null) params.set(key, Array.isArray(value) ? value[0] : value)
  }
  if (lockedCategory) params.set('category', lockedCategory)
  if (lockedBrand) params.set('brand', lockedBrand)

  let categories = []
  let brands = []
  let result
  try {
    ;[categories, brands, result] = await Promise.all([
      getPublishedCategories(locale),
      getPublishedBrands(locale),
      getPublishedProducts({ locale, searchParams: params }),
    ])
  } catch (error) {
    console.error('Catalog page failed', { code: error?.code, status: error?.status })
    return <><Header /><main className="flex-1 bg-surface px-4 pb-20 pt-28 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><CatalogErrorState locale={locale} dictionary={dictionary} /></div></main><Footer /></>
  }

  const visibleSearchParams = new URLSearchParams(params)
  if (lockedCategory) visibleSearchParams.delete('category')
  if (lockedBrand) visibleSearchParams.delete('brand')

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1 bg-surface px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <nav className="mb-3 text-sm text-slate-500"><Link href={`/${locale}`} className="hover:text-brand-600">Nurset</Link><span className="mx-2">/</span><span>{dictionary.catalog.title}</span></nav>
              <h1 className="font-heading text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{heading || dictionary.catalog.title}</h1>
              <p className="mt-3 max-w-2xl text-slate-600">{description || dictionary.catalog.description}</p>
            </div>
            <p className="text-sm font-semibold text-slate-500">{dictionary.catalog.found}: {result.pagination.total}</p>
          </div>
          <CatalogControls dictionary={dictionary} categories={categories} brands={brands} filters={result.filters} lockedCategory={lockedCategory} lockedBrand={lockedBrand} />
          <div className="mt-8">
            {result.items.length === 0 ? <CatalogEmptyState locale={locale} dictionary={dictionary} /> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{result.items.map((product) => <CatalogCard key={product.id} product={product} dictionary={dictionary} />)}</div>}
          </div>
          <CatalogPagination locale={locale} pathname={pathname} searchParams={visibleSearchParams} pagination={result.pagination} dictionary={dictionary} />
        </div>
      </main>
      <Footer />
    </>
  )
}
