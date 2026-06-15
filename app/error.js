'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function Error({ error, reset }) {
  return (
    <>
      <Header />
      <main className="flex-1 bg-[#F8FAFC] min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-red-500 mb-4">Ошибка</h1>
          <p className="text-xl text-gray-700 mb-2">Что-то пошло не так</p>
          <p className="text-gray-500 mb-8">Попробуйте обновить страницу или вернуться позже</p>
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Попробовать снова
          </button>
        </div>
      </main>
      <Footer />
    </>
  )
}
