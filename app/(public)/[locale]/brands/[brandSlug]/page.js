import CatalogPage from '@/components/catalog/CatalogPage'
import { notFound } from 'next/navigation'
import { getPublishedBrands } from '@/lib/catalog/repository.mjs'
import { localizedPageMetadata } from '@/lib/seo.mjs'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { locale, brandSlug } = await params
  const brand = (await getPublishedBrands(locale)).find((item) => item.slug === brandSlug)
  return localizedPageMetadata({ locale, path: `/brands/${brandSlug}`, title: brand?.name || 'Nurset', description: brand?.description || 'Nurset' })
}

export default async function BrandRoute({ params, searchParams }) {
  const { locale, brandSlug } = await params
  const brand = (await getPublishedBrands(locale)).find((item) => item.slug === brandSlug)
  if (!brand) notFound()
  return <CatalogPage locale={locale} pathname={`/brands/${brand.slug}`} heading={brand.name} description={brand.description || undefined} lockedBrand={brand.slug} searchParams={await searchParams} />
}
