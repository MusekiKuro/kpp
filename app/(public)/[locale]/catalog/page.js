import CatalogPage from '@/components/catalog/CatalogPage'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { localizedPageMetadata } from '@/lib/seo.mjs'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  const { locale } = await params
  const dictionary = getDictionary(locale)
  return localizedPageMetadata({ locale, path: '/catalog', title: dictionary.catalog.title, description: dictionary.catalog.description })
}

export default async function CatalogRoute({ params, searchParams }) {
  const { locale } = await params
  return <CatalogPage locale={locale} searchParams={await searchParams} />
}
