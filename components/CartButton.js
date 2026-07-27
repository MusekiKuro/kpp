'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCart } from './CartProvider';
import { DEFAULT_LOCALE, isLocale, localizedPath } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default function CartButton() {
  const { items } = useCart();
  const params = useParams();
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE;
  const dictionary = getDictionary(locale);

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

  // Don't render anything if cart is empty (keep UI clean)
  if (totalQty === 0) return null;

  return (
    <Link
      href={localizedPath(locale, '/request')}
      className="fixed bottom-6 right-24 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 hover:-translate-y-1 transition-all"
      aria-label={`${dictionary.navigation.request}: ${totalQty}`}
    >
      {/* Cart icon */}
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>

      {/* Badge */}
      <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-white">
        {totalQty > 99 ? '99+' : totalQty}
      </span>
    </Link>
  );
}
