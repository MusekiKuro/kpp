'use client';

import { useState, useMemo } from 'react';
import ProductCard from '@/components/ProductCard';

export default function ProductGrid({ products }) {
  const [activeFilter, setActiveFilter] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const unique = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return ['Все', ...unique.sort()];
  }, [products]);

  const filtered = useMemo(() => {
    let result = products;

    if (activeFilter !== 'Все') {
      result = result.filter((p) => p.category === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    return result;
  }, [products, activeFilter, searchQuery]);

  const groupedProducts = useMemo(() => {
    const groups = {};
    filtered.forEach(p => {
      const cat = p.category || 'Без категории';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    // Sort categories alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <section id="catalog" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Section header ──────────────── */}
        <div className="text-center mb-10">
          <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 mb-4 shadow-sm animate-fade-in-up">
            Каталог
          </span>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-slate-900 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Наш <span className="text-gradient">ассортимент</span>
          </h2>
        </div>

        {/* ── Search ────────────────────────── */}
        <div className="max-w-md mx-auto mb-6">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск товаров..."
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl bg-white shadow-sm text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all hover:shadow-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Filter pills ────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-300 ${
                activeFilter === cat
                  ? 'bg-gradient-to-r from-brand-600 to-cyan-500 text-white shadow-lg shadow-brand-500/30 transform scale-105'
                  : 'border border-slate-200 bg-white/80 backdrop-blur-sm text-slate-600 hover:border-brand-300 hover:text-brand-600 hover:shadow-md'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Grid with Categories ────────────────────────── */}
        {filtered.length > 0 ? (
          <div className="space-y-16">
            {groupedProducts.map(([category, items]) => (
              <div key={category} className="animate-fade-in-up">
                {/* Category Header with Line */}
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="font-heading text-2xl font-bold text-slate-800 tracking-tight">
                    {category}
                  </h3>
                  <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
                </div>
                
                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Empty state ──────────────── */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 mb-6">
              <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Товары не найдены
            </h3>
            <p className="text-sm text-gray-500">
              {searchQuery
                ? 'Попробуйте изменить поисковый запрос'
                : 'Попробуйте выбрать другую категорию'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
