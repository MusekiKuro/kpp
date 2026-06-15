'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';

export default function ProductCard({ product, showCartButton = true }) {
  const { addToCart } = useCart();
  const router = useRouter();

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
  };

  const handleViewInfo = (e) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/product/${product.id}`);
  };

  return (
    <Link
      href={`/product/${product.id}`}
      className="card-hover group flex flex-col rounded-xl border border-brand-200 bg-white overflow-hidden"
    >
      <div className="relative aspect-square overflow-hidden bg-brand-50">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
        )}

        {product.category && (
          <span className="absolute top-3 left-3 rounded bg-brand-800/90 text-[10px] font-semibold tracking-wider uppercase text-white px-2 py-0.5 shadow-sm">
            {product.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 bg-white">
        <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 transition-colors">
          {product.name}
        </h3>

        {(() => {
          const desc = product.description?.replace(/^<!--FEATURES-->\n[\s\S]*?\n<!--\/FEATURES-->\n*/, '')
          return desc ? (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">
              {desc}
            </p>
          ) : null
        })()}

        <div className="mt-3.5 flex gap-2 text-xs">
          <button
            onClick={handleViewInfo}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white py-2 text-gray-600 hover:bg-brand-50 transition-all font-medium"
          >
            Инфо
          </button>

          {showCartButton && (
            <button
              onClick={handleAddToCart}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-white hover:bg-brand-500 transition-all font-semibold"
            >
              В корзину
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
