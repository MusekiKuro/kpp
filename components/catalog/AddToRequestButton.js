'use client'

import { useState } from 'react'
import { useCart } from '@/components/CartProvider'
import { trackEvent } from '@/lib/analytics'

export default function AddToRequestButton({ product, label, addedLabel }) {
  const { addToCart } = useCart()
  const [added, setAdded] = useState(false)

  const add = () => {
    addToCart(product)
    trackEvent('add_to_request', { locale: product?.locale, product_slug: product?.slug })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1800)
  }

  return <button type="button" onClick={add} aria-live="polite" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand-600 px-5 py-3 font-bold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 motion-reduce:transition-none">{added ? addedLabel : label}</button>
}
