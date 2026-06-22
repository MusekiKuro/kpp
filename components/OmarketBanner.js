import Link from 'next/link';

export default function OmarketBanner() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 animate-fade-in-up">
      <div className="flex justify-start">
        {/* Medium-small card styled like Omarket.kz */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0b58c6] border border-blue-800 p-6 sm:p-8 shadow-lg max-w-xl w-full group hover:shadow-xl transition-all duration-300">
          
          {/* Decorative subtle background shape */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 rounded-full bg-blue-500/20 blur-xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 -mb-12 -mr-6 w-48 h-48 rounded-full bg-yellow-400/10 blur-xl pointer-events-none" />
          
          <div className="relative z-10">
            {/* Header/Logo section */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg shadow-sm select-none">
                {/* Logo Omarket.kz */}
                <div className="flex items-center font-extrabold text-base tracking-tight">
                  <span className="text-[#ff9f1c]">o</span>
                  <span className="text-[#0b58c6]">market</span>
                  <span className="text-gray-400 text-xs font-normal">.kz</span>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200 bg-blue-900/40 px-2.5 py-1 rounded-full border border-blue-700/50">
                Партнер
              </span>
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-white mb-2 leading-snug">
              Покупайте у нас через Omarket.kz
            </h3>
            
            <p className="text-sm text-blue-100 mb-6 leading-relaxed">
              Мы зарегистрированы как официальный поставщик. Заказывайте технику, мебель и оборудование быстро и безопасно через портал госзакупок.
            </p>

            {/* Action Button - Omarket yellow/orange primary style */}
            <div className="flex items-center gap-4">
              <a 
                href="https://omarket.kz/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff9f1c] hover:bg-[#f39000] active:bg-[#e08100] px-5 py-3 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
              >
                Перейти в магазин
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
