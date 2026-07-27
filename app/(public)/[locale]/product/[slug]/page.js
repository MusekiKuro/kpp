import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { isUUID } from '@/lib/domain-contracts.mjs'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getPublishedProductById, getPublishedProductBySlug, getPublishedProducts } from '@/lib/catalog/repository.mjs'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import CatalogCard from '@/components/catalog/CatalogCard'
import ProductGallery from '@/components/catalog/ProductGallery'
import AddToRequestButton from '@/components/catalog/AddToRequestButton'
import PriceDisplay from '@/components/catalog/PriceDisplay'
import JsonLd from '@/components/JsonLd'
import { breadcrumbJsonLd, localizedPageMetadata } from '@/lib/seo.mjs'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { locale, slug } = await params
  try {
    const product = isUUID(slug) ? await getPublishedProductById({ locale, id: slug }).then(async (legacy) => legacy?.slug ? getPublishedProductBySlug({ locale, slug: legacy.slug }) : null) : await getPublishedProductBySlug({ locale, slug })
    return product ? localizedPageMetadata({ locale, path: `/product/${product.slug}`, title: product.name, description: product.short_description || product.description || product.name }) : localizedPageMetadata({ locale, path: `/product/${slug}`, title: 'Nurset', description: 'Nurset' })
  } catch {
    return localizedPageMetadata({ locale, path: `/product/${slug}`, title: 'Nurset', description: 'Nurset' })
  }
}

function cleanDescription(value) {
  return (value || '').replace(/<!--FEATURES-->[\s\S]*?<!--\/FEATURES-->\s*/g, '').trim()
}

export default async function ProductPage({ params }) {
  const { locale, slug } = await params
  const dictionary = getDictionary(locale)
  let product

  if (isUUID(slug)) {
    const legacy = await getPublishedProductById({ locale, id: slug })
    if (legacy?.slug) redirect(`/${locale}/product/${legacy.slug}`)
    notFound()
  }

  product = await getPublishedProductBySlug({ locale, slug })
  if (!product) notFound()

  const relatedResult = product.category_slug
    ? await getPublishedProducts({ locale, searchParams: { category: product.category_slug, page_size: '12', sort: 'recommended' } })
    : { items: [] }
  const related = relatedResult.items.filter((item) => item.id !== product.id).slice(0, 4)
  const offer = product.price?.amount !== null && product.price?.amount !== undefined && ['exact', 'from'].includes(product.price?.mode)
    ? {
        '@type': 'Offer',
        priceCurrency: product.price.currency,
        ...(product.price.mode === 'from' ? { lowPrice: product.price.amount } : { price: product.price.amount }),
        availability: product.stock_status === 'in_stock' ? 'https://schema.org/InStock' : product.stock_status === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/LimitedAvailability',
      }
    : null
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.description ? { description: cleanDescription(product.description) } : {}),
    ...(product.gallery?.length ? { image: product.gallery.map((image) => image.url) } : {}),
    ...(offer ? { offers: offer } : {}),
  }
  const breadcrumb = breadcrumbJsonLd({ locale, items: [{ name: 'Nurset', path: '/' }, { name: dictionary.catalog.title, path: '/catalog' }, { name: product.name }] })

  return <>
    <JsonLd data={breadcrumb} />
    <JsonLd data={productJsonLd} />
    <Header />
    <main id="main-content" className="flex-1 bg-surface px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link href={`/${locale}`} className="hover:text-brand-600">Nurset</Link><span>/</span><Link href={`/${locale}/catalog`} className="hover:text-brand-600">{dictionary.catalog.title}</Link><span>/</span><span className="max-w-[18rem] truncate text-slate-700">{product.name}</span></nav>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]"><ProductGallery gallery={product.gallery} name={product.name} label={dictionary.product.gallery} /><div className="flex flex-col p-6 sm:p-10 lg:p-12"><div className="flex flex-wrap gap-2">{product.category_slug && <Link href={`/${locale}/catalog/${product.category_slug}`} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">{product.category_slug}</Link>}{product.brand_slug && <Link href={`/${locale}/brands/${product.brand_slug}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{product.brand_slug}</Link>}</div><h1 className="mt-5 font-heading text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">{product.name}</h1>{product.sku && <p className="mt-3 text-sm text-slate-500">{dictionary.product.sku}: {product.sku}</p>}<div className="mt-7 flex flex-wrap items-center gap-4"><span className="text-2xl font-extrabold text-brand-700"><PriceDisplay price={product.price} locale={locale} labels={dictionary.catalog.priceValues} /></span><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{dictionary.product.stockValues[product.stock_status]}</span></div>{product.short_description && <p className="mt-6 text-lg leading-relaxed text-slate-600">{product.short_description}</p>}<div className="mt-8 flex flex-col gap-3 sm:flex-row"><AddToRequestButton product={product} label={dictionary.product.request} addedLabel={dictionary.product.added} /><a href={`https://wa.me/77059000660?text=${encodeURIComponent(product.name)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700">{dictionary.home.contactCta}</a></div></div></div></div>
        {(product.description || product.specs.length > 0) && <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]"><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-bold text-slate-900">{dictionary.product.description}</h2><p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">{cleanDescription(product.description)}</p></section><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-bold text-slate-900">{dictionary.product.specs}</h2>{product.specs.length ? <dl className="mt-4 divide-y divide-slate-100">{product.specs.map((spec) => <div key={spec.code} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 py-3 text-sm"><dt className="text-slate-500">{spec.name}</dt><dd className="font-semibold text-slate-800">{spec.value}{spec.unit ? ` ${spec.unit}` : ''}</dd></div>)}</dl> : <p className="mt-4 text-slate-500">—</p>}</section></div>}
        {related.length > 0 && <section className="mt-14"><h2 className="font-heading text-3xl font-extrabold text-slate-900">{dictionary.product.related}</h2><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{related.map((item) => <CatalogCard key={item.id} product={item} dictionary={dictionary} />)}</div></section>}
      </div>
    </main>
    <Footer />
  </>
}
