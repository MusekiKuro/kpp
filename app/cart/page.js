'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '@/components/CartProvider'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function CartPage() {
  const { items, updateQuantity, removeFromCart, clearCart } = useCart()
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    if (e.target.name === 'customer_phone') {
      let input = e.target.value.replace(/\D/g, '');
      if (!input) {
        setForm((prev) => ({ ...prev, customer_phone: '' }));
        return;
      }
      if (input[0] === '8') input = '7' + input.slice(1);
      else if (input[0] !== '7' && e.target.value.length > 2) input = '7' + input;
      else if (input[0] !== '7') input = '7'; // Default to +7

      let formatted = '+7';
      if (input.length > 1) formatted += ' (' + input.substring(1, 4);
      if (input.length >= 5) formatted += ') ' + input.substring(4, 7);
      if (input.length >= 8) formatted += '-' + input.substring(7, 9);
      if (input.length >= 10) formatted += '-' + input.substring(9, 11);

      setForm((prev) => ({ ...prev, customer_phone: formatted }));
    } else {
      setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const orderItems = items.map((item) => ({
        product_id: item.id,
        name: item.name,
        quantity: item.qty,
        image_url: item.image_url,
      }))

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_message: form.customer_message,
          items: orderItems,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка при отправке заявки')
      }

      setSuccess(true)
      clearCart()
      setForm({ customer_name: '', customer_phone: '', customer_message: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-[#F8FAFC]">
        {success ? (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
            <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Заявка отправлена!</h1>
              <p className="text-gray-600 mb-8">
                Мы свяжемся с вами в ближайшее время для подтверждения заказа.
              </p>
              <Link
                href="/"
                className="inline-block bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
              >
                Вернуться в каталог
              </Link>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
            <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Корзина пуста</h1>
              <p className="text-gray-600 mb-8">
                Добавьте товары из каталога, чтобы оформить заявку
              </p>
              <Link
                href="/"
                className="inline-block bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
              >
                Перейти в каталог
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">Корзина</h1>

            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 mb-8">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 sm:p-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-50 shrink-0 relative">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.name} fill sizes="80px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.qty - 1)}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-medium text-gray-900">{item.qty}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.qty + 1)}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-1"
                    title="Удалить"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Оформить заявку</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Имя <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="customer_name"
                    name="customer_name"
                    required
                    value={form.customer_name}
                    onChange={handleChange}
                    placeholder="Ваше имя"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-shadow"
                  />
                </div>

                <div>
                  <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Телефон <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="customer_phone"
                    name="customer_phone"
                    required
                    value={form.customer_phone}
                    onChange={handleChange}
                    placeholder="+7 (___) ___-__-__"
                    maxLength="18"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-shadow"
                  />
                </div>

                <div>
                  <label htmlFor="customer_message" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Комментарий
                  </label>
                  <textarea
                    id="customer_message"
                    name="customer_message"
                    rows={3}
                    value={form.customer_message}
                    onChange={handleChange}
                    placeholder="Дополнительные пожелания..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-shadow resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 cursor-pointer"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Отправка...
                    </span>
                  ) : (
                    'Отправить заявку'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
