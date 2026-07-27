import CorporatePage from '@/components/CorporatePage'
import { getCorporateDictionary } from '@/lib/i18n/corporate'
import { localizedPageMetadata } from '@/lib/seo.mjs'

export async function generateMetadata({ params }) {
  const { locale } = await params
  const page = getCorporateDictionary(locale).pages.deliveryWarranty
  return localizedPageMetadata({ locale, path: '/delivery-warranty', title: page.title, description: page.description })
}

export default async function DeliveryWarrantyPage({ params }) {
  const { locale } = await params
  return <CorporatePage locale={locale} pageKey="deliveryWarranty" />
}
