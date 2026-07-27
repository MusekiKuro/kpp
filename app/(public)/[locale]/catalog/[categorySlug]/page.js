import { notFound } from 'next/navigation'
import CatalogPage from '@/components/catalog/CatalogPage'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getPublishedCategories } from '@/lib/catalog/repository.mjs'
import { localizedPageMetadata } from '@/lib/seo.mjs'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { locale, categorySlug } = await params
  const dictionary = getDictionary(locale)
  const category = (await getPublishedCategories(locale)).find((item) => item.slug === categorySlug)
  return localizedPageMetadata({ locale, path: `/catalog/${categorySlug}`, title: category?.name || dictionary.catalog.title, description: category?.description || dictionary.catalog.description })
}

export default async function CategoryRoute({ params, searchParams }) {
  const { locale, categorySlug } = await params
  const category = (await getPublishedCategories(locale)).find((item) => item.slug === categorySlug)
  if (!category) notFound()
  const dictionary = getDictionary(locale)
  return <CatalogPage locale={locale} pathname={`/catalog/${category.slug}`} heading={category.name} description={category.description || dictionary.catalog.description} lockedCategory={category.slug} searchParams={await searchParams} />
}
