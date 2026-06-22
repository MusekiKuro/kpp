import Link from 'next/link';

export default function OmarketBanner() {
  return (
    <section className="relative w-full max-w-5xl py-12 pr-4 sm:pr-6 lg:pr-8">
      <div 
        className="relative overflow-hidden rounded-r-3xl bg-blue-700 px-6 py-10 sm:px-12 sm:py-14 shadow-2xl animate-fade-in-up" 
        style={{ animationDelay: '0.2s' }}
      >
        {/* Decorative elements - clean and subtle for Omarket style */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-blue-600 opacity-50 blur-2xl" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-blue-800 opacity-50 blur-2xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="text-left text-white max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white p-2 rounded-lg inline-flex">
                <span className="text-blue-700 font-bold text-xl tracking-tight">Omarket.kz</span>
              </div>
              <span className="text-blue-200 text-sm font-semibold uppercase tracking-wider">Государственные закупки</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Мы являемся официальными поставщиками
            </h2>
            <p className="text-lg text-blue-100">
              Приобретайте наши товары через государственный портал закупок. Удобно, быстро и надежно в соответствии с законодательством РК.
            </p>
          </div>
          
          <div className="flex-shrink-0 mt-6 md:mt-0">
            <a 
              href="https://omarket.kz/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-blue-700 shadow-lg transition-all hover:scale-105 hover:bg-gray-50 hover:shadow-xl focus:ring-4 focus:ring-blue-300"
            >
              Перейти на портал
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
