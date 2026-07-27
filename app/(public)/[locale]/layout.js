import '../../globals.css'
import { notFound } from 'next/navigation'
import CartProvider from '@/components/CartProvider'
import CartButton from '@/components/CartButton'
import { LOCALES, isLocale, DEFAULT_LOCALE } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { SITE_URL } from '@/lib/site-config.mjs'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }) {
  const { locale } = await params
  const dictionary = getDictionary(isLocale(locale) ? locale : DEFAULT_LOCALE)

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: dictionary.siteTitle,
      template: '%s — Nurset',
    },
    description: dictionary.siteTitle,
    icons: {
      icon: '/favicon.svg',
    },
    manifest: '/manifest.json',
  }
}

export default async function PublicRootLayout({ children, params }) {
  const { locale } = await params

  if (!isLocale(locale)) {
    notFound()
  }

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-surface text-gray-800">
        <CartProvider>
          {children}
          <CartButton />
        </CartProvider>
      </body>
    </html>
  )
}
