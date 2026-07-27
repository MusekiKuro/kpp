'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/components/CartProvider';
import { DEFAULT_LOCALE, isLocale, localizedPath } from '@/lib/i18n/config';

export default function ProductCard({ product, showCartButton = true }) {
  const { addToCart } = useCart();
  const router = useRouter();
  const params = useParams();
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE;
  const productPath = localizedPath(locale, `/product/${product.id}`);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
  };

  const handleViewInfo = (e) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(productPath);
  };

  return (
    <Link
      href={productPath}
      className="card-hover group flex flex-col rounded-3xl border border-slate-200/60 bg-white overflow-hidden shadow-sm"
    >
      <div className="relative aspect-square overflow-hidden img-preview-bg">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
        )}


      </div>

      <div className="flex flex-1 flex-col p-6 bg-white">
        <h3 className="font-heading text-lg font-bold text-slate-900 leading-snug line-clamp-2 transition-colors group-hover:text-brand-600">
          {product.name}
        </h3>

        {(() => {
          const desc = product.description?.replace(/<!--FEATURES-->[\s\S]*?<!--\/FEATURES-->\s*/, '')
          return desc ? (
            <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {desc}
            </p>
          ) : null
        })()}

        <div className="mt-5 flex gap-3 text-sm">
          <button
            onClick={handleViewInfo}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-3 text-slate-700 hover:bg-slate-100 hover:text-brand-600 hover:border-slate-300 transition-all font-bold"
          >
            Инфо
          </button>

          {showCartButton && (
            <button
              onClick={handleAddToCart}
              className="btn-glow flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 py-3 text-white shadow-md hover:shadow-xl hover:shadow-brand-500/25 hover:-translate-y-0.5 transition-all font-bold"
            >
              В корзину
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
