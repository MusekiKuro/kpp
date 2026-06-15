'use client'

import { useCart } from '@/components/CartProvider'

export function AddToCartButton({ product }) {
  const { addToCart } = useCart()

  const handleAdd = () => {
    addToCart({
      id: product.id,
      name: product.name,
      image_url: product.image_url,
    })
  }

  return (
    <button
      onClick={handleAdd}
      className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 cursor-pointer"
    >
      В корзину
    </button>
  )
}
