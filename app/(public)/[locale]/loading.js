'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { useParams } from 'next/navigation'
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default function Loading() {
  const params = useParams()
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE
  const dictionary = getDictionary(locale)
  return (
    <>
      <Header />
      <main className="flex-1 bg-[#F8FAFC] min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-10 h-10 text-brand-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500 text-sm">{dictionary.states.loading}</p>
        </div>
      </main>
      <Footer />
    </>
  )
}
