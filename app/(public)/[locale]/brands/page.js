import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getPublishedBrands } from '@/lib/catalog/repository.mjs'

export const dynamic = 'force-dynamic'

export default async function BrandsRoute({ params }) {
  const { locale } = await params
  const dictionary = getDictionary(locale)
  const brands = await getPublishedBrands(locale)
  return <><Header /><main className="flex-1 bg-surface px-4 pb-20 pt-28 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><p className="mb-3 text-sm text-slate-500"><Link href={`/${locale}`} className="hover:text-brand-600">Nurset</Link><span className="mx-2">/</span>{dictionary.navigation.brands}</p><h1 className="font-heading text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{dictionary.navigation.brands}</h1><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{brands.map((brand) => <Link key={brand.id} href={`/${locale}/brands/${brand.slug}`} className="card-hover rounded-3xl border border-slate-200 bg-white p-6 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><h2 className="text-xl font-bold text-slate-900">{brand.name}</h2>{brand.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{brand.description}</p>}</Link>)}</div>{brands.length === 0 && <div className="mt-8 rounded-3xl border border-slate-200 bg-white px-6 py-20 text-center text-slate-500">{dictionary.catalog.emptyText}</div>}</div></main><Footer /></>
}
