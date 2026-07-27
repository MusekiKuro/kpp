'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCart } from '@/components/CartProvider'
import { DEFAULT_LOCALE, isLocale, localizedPath } from '@/lib/i18n/config'
import CatalogImage from './CatalogImage'
import PriceDisplay from './PriceDisplay'

export default function CatalogCard({ product, dictionary }) {
  const params = useParams()
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE
  const { addToCart } = useCart()
  const productPath = localizedPath(locale, `/product/${product.slug}`)

  return (
    <article className="card-hover group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
      <Link href={productPath} className="block" aria-label={product.name}>
        <div className="relative aspect-square overflow-hidden img-preview-bg">
          <CatalogImage src={product.image_url} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <Link href={productPath} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg">
          <h3 className="font-heading text-lg font-bold leading-snug text-slate-900 line-clamp-2 transition-colors group-hover:text-brand-600">{product.name}</h3>
        </Link>
        {product.short_description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">{product.short_description}</p>}
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-base text-brand-700"><PriceDisplay price={product.price} locale={locale} labels={dictionary.catalog.priceValues} /></strong>
            <span className="text-xs font-semibold text-slate-500">{dictionary.product.stockValues[product.stock_status]}</span>
          </div>
          <button
            type="button"
            onClick={() => addToCart(product)}
            className="btn-glow mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-sm font-bold text-white shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            {dictionary.product.request}
          </button>
        </div>
      </div>
    </article>
  )
}
