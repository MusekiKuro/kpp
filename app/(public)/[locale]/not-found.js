'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default function NotFound() {
  const params = useParams()
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE
  const dictionary = getDictionary(locale)
  return (
    <>
      <Header />
      <main className="flex-1 bg-[#F8FAFC] min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-brand-600 mb-4">404</h1>
          <p className="text-xl text-gray-700 mb-2">{dictionary.states.notFound}</p>
          <p className="text-gray-500 mb-8">{dictionary.product.notFound}</p>
          <Link
            href={locale ? `/${locale}` : '/ru'}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {dictionary.states.home}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
