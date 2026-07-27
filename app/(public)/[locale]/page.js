import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Hero from '@/components/Hero'
import CatalogCard from '@/components/catalog/CatalogCard'
import { CatalogErrorState } from '@/components/catalog/CatalogState'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getPublishedCategories, getPublishedProducts } from '@/lib/catalog/repository.mjs'
import { localizedPageMetadata } from '@/lib/seo.mjs'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { locale } = await params
  const dictionary = getDictionary(locale)
  return localizedPageMetadata({ locale, path: '/', title: dictionary.siteTitle, description: dictionary.home.subtitle })
}

export default async function HomePage({ params }) {
  const { locale } = await params
  const dictionary = getDictionary(locale)
  let categories = []
  let products = []
  let failed = false

  try {
    ;[categories, products] = await Promise.all([
      getPublishedCategories(locale),
      getPublishedProducts({ locale, searchParams: { sort: 'recommended', page_size: '8' } }).then((result) => result.items),
    ])
  } catch (error) {
    console.error('Home catalog failed', { code: error?.code, status: error?.status })
    failed = true
  }

  return <>
    <Header />
    <main id="main-content" className="flex-1">
      <Hero />
      <section id="catalog" className="bg-surface px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">Nurset</p><h2 className="mt-2 font-heading text-3xl font-extrabold text-slate-900 sm:text-4xl">{dictionary.home.categories}</h2></div><Link href={`/${locale}/catalog`} className="text-sm font-bold text-brand-700 hover:text-brand-900">{dictionary.home.catalogCta} →</Link></div>
          {failed ? <div className="mt-8"><CatalogErrorState locale={locale} dictionary={dictionary} /></div> : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{categories.filter((item) => !item.parent_id).slice(0, 8).map((category) => <Link key={category.id} href={`/${locale}/catalog/${category.slug}`} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl text-brand-700" aria-hidden="true">✦</span><h3 className="mt-5 text-xl font-bold text-slate-900 group-hover:text-brand-700">{category.name}</h3>{category.description && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{category.description}</p>}</Link>)}</div>}
        </div>
      </section>
      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="mx-auto max-w-7xl"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">{dictionary.home.featured}</p><h2 className="mt-2 font-heading text-3xl font-extrabold text-slate-900 sm:text-4xl">{dictionary.home.featured}</h2></div><Link href={`/${locale}/catalog`} className="text-sm font-bold text-brand-700 hover:text-brand-900">{dictionary.home.catalogCta} →</Link></div>{!failed && <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <CatalogCard key={product.id} product={product} dictionary={dictionary} />)}</div>}</div></section>
      <section id="about" className="bg-surface px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="mx-auto max-w-4xl text-center"><p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">Nurset</p><h2 className="mt-3 font-heading text-3xl font-extrabold text-slate-900 sm:text-4xl">{dictionary.home.aboutTitle}</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{dictionary.home.aboutText}</p><Link href={`/${locale}/about`} className="mt-8 inline-flex rounded-2xl bg-brand-600 px-7 py-4 font-bold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">{dictionary.home.catalogCta}</Link></div></section>
    </main>
    <Footer />
  </>
}
