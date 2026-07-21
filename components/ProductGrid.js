'use client';

import { useState, useMemo } from 'react';
import ProductCard from '@/components/ProductCard';

const getCategoryIcon = (category) => {
  const cat = (category || '').toLowerCase();
  
  if (cat.includes('кондиционер')) {
    return (
      <svg className="w-12 h-12 mb-4 text-cyan-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3M3 12h18m-18 0l3-3m-3 3l3 3m15-3l-3-3m3 3l-3 3M5.636 5.636l12.728 12.728m-12.728 0l12.728-12.728" />
      </svg>
    );
  }
  if (cat.includes('моноблок')) {
    return (
      <svg className="w-12 h-12 mb-4 text-indigo-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-6-3v3m-9-6h18a1.5 1.5 0 001.5-1.5V5.25A1.5 1.5 0 0021 3.75H3a1.5 1.5 0 00-1.5 1.5V12.75A1.5 1.5 0 003 14.25z" />
      </svg>
    );
  }
  if (cat.includes('ноутбук')) {
    return (
      <svg className="w-12 h-12 mb-4 text-blue-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25M2.25 15V6A2.25 2.25 0 014.5 3.75h15A2.25 2.25 0 0121.75 6v9m-19.5 0h19.5" />
      </svg>
    );
  }
  if (cat.includes('телевизор')) {
    return (
      <svg className="w-12 h-12 mb-4 text-purple-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-6-3v3m-9-6h18a1.5 1.5 0 001.5-1.5V5.25A1.5 1.5 0 0021 3.75H3a1.5 1.5 0 00-1.5 1.5V12.75A1.5 1.5 0 003 14.25z" />
      </svg>
    );
  }
  if (cat.includes('холодильник')) {
    return (
      <svg className="w-12 h-12 mb-4 text-teal-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 3h13.5A1.5 1.5 0 0120.25 4.5v15a1.5 1.5 0 01-1.5 1.5H5.25A1.5 1.5 0 013.75 19.5v-15A1.5 1.5 0 015.25 3zM3.75 10.5h16.5M8.25 6.75h.008v1.5H8.25v-1.5zm0 6.75h.008v2.25H8.25v-2.25z" />
      </svg>
    );
  }
  if (cat.includes('котл') || cat.includes('котел')) {
    return (
      <svg className="w-12 h-12 mb-4 text-orange-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      </svg>
    );
  }
  if (cat.includes('радиатор')) {
    return (
      <svg className="w-12 h-12 mb-4 text-red-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v12a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18V6z" />
      </svg>
    );
  }
  if (cat.includes('водонагрев') || cat.includes('насос')) {
    return (
      <svg className="w-12 h-12 mb-4 text-cyan-600 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 5.385-8.25 9.224-8.25 12.75a8.25 8.25 0 0016.5 0c0-3.526-2.865-7.365-8.25-12.75z" />
      </svg>
    );
  }
  if (cat.includes('труб') || cat.includes('фитинг')) {
    return (
      <svg className="w-12 h-12 mb-4 text-slate-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
         <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    );
  }
  if (cat.includes('монтаж')) {
    return (
      <svg className="w-12 h-12 mb-4 text-emerald-500 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014-8.81c-2.28 1.09-4.75 1.875-7.33 2.31M19.175 4.125A24.08 24.08 0 0120.915 12m-1.74-7.875A24.08 24.08 0 0019.175 12" />
      </svg>
    );
  }
  
  return (
    <svg className="w-12 h-12 mb-4 text-brand-400 drop-shadow-sm transition-transform group-hover:scale-110 duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4m-6 0h8m-11.25-3.75h16.5a1.5 1.5 0 001.5-1.5V5.25A1.5 1.5 0 0020.25 3.75H3.75A1.5 1.5 0 002.25 5.25V6a1.5 1.5 0 001.5 1.5z" />
    </svg>
  );
};

const extractBrand = (productName) => {
  const name = productName || '';
  const knownBrands = [
    'ALMACOM', 'Acron', 'Klima', 'Lenovo', 'Acer', 'HP',
    'LG', 'Samsung', 'Xiaomi', 'Beko', 'Oasis', 'Timberk',
    'Midea', 'Arideya', 'VALFEX'
  ];
  for (const b of knownBrands) {
    if (name.toLowerCase().includes(b.toLowerCase())) return b;
  }
  return name.split(' ')[0] || 'Прочее';
};

export default function ProductGrid({ products = [] }) {
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState('Все бренды');
  const [selectedArea, setSelectedArea] = useState('Все площади');
  const [selectedFeature, setSelectedFeature] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => {
    const unique = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return unique.sort();
  }, [products]);

  // Extract available brands for selected category
  const availableBrands = useMemo(() => {
    if (!activeFilter) return [];
    const catProducts = products.filter(p => p.category === activeFilter);
    const brandsSet = new Set();
    catProducts.forEach(p => {
      const b = extractBrand(p.name);
      if (b) brandsSet.add(b);
    });
    return ['Все бренды', ...Array.from(brandsSet).sort()];
  }, [products, activeFilter]);

  const availableAreas = useMemo(() => {
    if (activeFilter !== 'Кондиционеры') return [];
    return ['Все площади', '18-20 м²', '20-25 м²', '30-35 м²', '50-55 м²', '65-70 м²'];
  }, [activeFilter]);

  const resetSubFilters = () => {
    setSelectedBrand('Все бренды');
    setSelectedArea('Все площади');
    setSelectedFeature('Все');
  };

  const handleSelectCategory = (cat) => {
    setActiveFilter(cat);
    resetSubFilters();
  };

  const handleResetCategory = () => {
    setActiveFilter(null);
    setSearchQuery('');
    resetSubFilters();
  };

  const filtered = useMemo(() => {
    let result = products;

    if (activeFilter) {
      result = result.filter((p) => p.category === activeFilter);

      if (selectedBrand && selectedBrand !== 'Все бренды') {
        result = result.filter((p) => extractBrand(p.name).toLowerCase() === selectedBrand.toLowerCase());
      }

      if (selectedArea && selectedArea !== 'Все площади') {
        result = result.filter((p) => {
          const text = (p.name + ' ' + (p.description || '')).toLowerCase();
          if (selectedArea === '18-20 м²') return text.includes('18-20') || text.includes('07');
          if (selectedArea === '20-25 м²') return text.includes('20-25') || text.includes('09');
          if (selectedArea === '30-35 м²') return text.includes('30-35') || text.includes('12');
          if (selectedArea === '50-55 м²') return text.includes('50-55') || text.includes('18');
          if (selectedArea === '65-70 м²') return text.includes('65-70') || text.includes('24');
          return true;
        });
      }

      if (selectedFeature && selectedFeature !== 'Все') {
        result = result.filter((p) => {
          const text = (p.name + ' ' + (p.description || '')).toLowerCase();
          if (selectedFeature === 'Wi-Fi') return text.includes('wi-fi') || text.includes('wifi');
          if (selectedFeature === 'С инсталляцией') return text.includes('standard') || text.includes('инсталляц');
          return true;
        });
      }
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
  }, [products, activeFilter, selectedBrand, selectedArea, selectedFeature, searchQuery]);

  const groupedProducts = useMemo(() => {
    const groups = {};
    filtered.forEach(p => {
      const cat = p.category || 'Без категории';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <section id="catalog" className="py-16 sm:py-24 bg-slate-50/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700 mb-4 shadow-sm animate-fade-in-up">
            Разделы каталога
          </span>
          <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-slate-900 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            Каталог <span className="text-gradient">оборудования</span>
          </h2>
          <p className="mt-4 text-slate-500 max-w-2xl mx-auto text-lg animate-fade-in-up leading-relaxed" style={{ animationDelay: '0.2s' }}>
            Выберите нужную категорию, чтобы фильтровать по брендам, площади и характеристикам.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-3xl mx-auto mb-12 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400 group-focus-within:text-brand-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или характеристикам..."
              className="w-full pl-14 pr-12 py-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-base text-slate-800 placeholder-slate-400 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all hover:shadow-md"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category Cards Grid (shown when no specific category is selected and no search) */}
        {!activeFilter && !searchQuery && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mb-16 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleSelectCategory(cat)}
                className="group flex flex-col items-center justify-center p-6 sm:p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-brand-500/5 hover:border-brand-200 hover:-translate-y-1 transition-all duration-300 text-center cursor-pointer"
              >
                {getCategoryIcon(cat)}
                <span className="font-heading font-bold text-slate-800 text-lg sm:text-xl group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                  {cat}
                </span>
                <span className="text-sm text-slate-500 mt-2 font-medium bg-slate-50 px-3 py-1 rounded-full group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                  {products.filter(p => p.category === cat).length} товаров
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Selected Category Header (with back button) */}
        {(activeFilter || searchQuery) && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200 animate-fade-in-up">
            <div>
              <h3 className="font-heading text-3xl font-extrabold text-slate-900">
                {searchQuery ? 'Результаты поиска' : activeFilter}
              </h3>
              <p className="text-slate-500 mt-2 font-medium">
                Найдено товаров: <span className="text-brand-600 font-bold">{filtered.length}</span>
              </p>
            </div>
            <button
              onClick={handleResetCategory}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:text-brand-600 hover:border-slate-300 transition-all shadow-sm cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Ко всем разделам
            </button>
          </div>
        )}

        {/* SUB-FILTERS PANEL inside active category */}
        {activeFilter && !searchQuery && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm mb-10 space-y-6 animate-fade-in-up">
            {/* Brands Filter */}
            {availableBrands.length > 2 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Бренд
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableBrands.map((b) => (
                    <button
                      key={b}
                      onClick={() => setSelectedBrand(b)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        selectedBrand === b
                          ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Area Filter for Air Conditioners */}
            {activeFilter === 'Кондиционеры' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Площадь помещения
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableAreas.map((area) => (
                    <button
                      key={area}
                      onClick={() => setSelectedArea(area)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        selectedArea === area
                          ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Special Features Filter */}
            {activeFilter === 'Кондиционеры' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Особенности
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Все', 'Wi-Fi', 'С инсталляцией'].map((feat) => (
                    <button
                      key={feat}
                      onClick={() => setSelectedFeature(feat)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        selectedFeature === feat
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {feat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Products Grid */}
        {(activeFilter || searchQuery) ? (
          filtered.length > 0 ? (
            <div className="space-y-16">
              {groupedProducts.map(([category, items]) => (
                <div key={category} className="animate-fade-in-up">
                  {/* Category Header (only show if viewing multiple categories like in search) */}
                  {(!activeFilter && searchQuery) && (
                    <div className="flex items-center gap-4 mb-8">
                      <h4 className="font-heading text-2xl font-bold text-slate-800">
                        {category}
                      </h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {items.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-slate-100 shadow-sm animate-fade-in-up">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-50 mb-6">
                <svg className="h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Товары не найдены
              </h3>
              <p className="text-slate-500 max-w-md mx-auto mb-8">
                По выбранным фильтрам ничего не найдено. Попробуйте сбросить некоторые параметы.
              </p>
              <button
                onClick={resetSubFilters}
                className="px-8 py-3 rounded-xl bg-brand-50 text-brand-700 font-bold hover:bg-brand-100 transition-colors cursor-pointer"
              >
                Сбросить фильтры
              </button>
            </div>
          )
        ) : null}
      </div>
    </section>
  );
}
