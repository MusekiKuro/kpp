import CorporatePage from '@/components/CorporatePage'
import { getCorporateDictionary } from '@/lib/i18n/corporate'
import { localizedPageMetadata } from '@/lib/seo.mjs'

export async function generateMetadata({ params }) {
  const { locale } = await params
  const page = getCorporateDictionary(locale).pages.privacy
  return localizedPageMetadata({ locale, path: '/privacy', title: page.title, description: page.description, noindex: true })
}

export default async function PrivacyPage({ params }) {
  const { locale } = await params
  return <CorporatePage locale={locale} pageKey="privacy" />
}
