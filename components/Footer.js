'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getCorporateDictionary } from '@/lib/i18n/corporate'

export default function Footer() {
  const params = useParams()
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE
  const dictionary = getDictionary(locale)
  const corporate = getCorporateDictionary(locale)

  return (
    <footer className="bg-brand-950 text-slate-400 border-t border-brand-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-500 text-white font-bold text-sm">
              N
            </span>
            <span className="font-heading text-2xl font-extrabold tracking-tight text-white">
              NURSET
            </span>
          </div>

          {/* Copyright */}
          <p className="text-sm text-center sm:text-right">
            © {new Date().getFullYear()} Nurset. {dictionary.siteTitle}.
          </p>
        </div>
        <nav aria-label={locale === 'kk' ? 'Қосымша навигация' : 'Дополнительная навигация'} className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm">
          <Link href={`/${locale}/about`} className="rounded-md hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{dictionary.navigation.about}</Link>
          <Link href={`/${locale}/delivery-warranty`} className="rounded-md hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{corporate.navigation.deliveryWarranty}</Link>
          <Link href={`/${locale}/contacts`} className="rounded-md hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{dictionary.navigation.contacts}</Link>
          <Link href={`/${locale}/privacy`} className="rounded-md hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{corporate.navigation.privacy}</Link>
        </nav>
      </div>
    </footer>
  );
}
