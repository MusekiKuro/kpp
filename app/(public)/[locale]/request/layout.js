import { getDictionary } from '@/lib/i18n/dictionaries'
import { localizedPageMetadata } from '@/lib/seo.mjs'

export async function generateMetadata({ params }) {
  const { locale } = await params
  const dictionary = getDictionary(locale)
  return localizedPageMetadata({ locale, path: '/request', title: dictionary.request.title, description: dictionary.request.note, noindex: true })
}

export default function RequestLayout({ children }) {
  return children
}
