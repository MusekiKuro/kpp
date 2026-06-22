import Link from 'next/link';

export default function OmarketBanner() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-12 sm:px-12 sm:py-16 shadow-2xl animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left text-white max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Мы являемся поставщиками на Omarket.kz
            </h2>
            <p className="text-lg sm:text-xl text-blue-100 font-medium">
              Приобретайте наши товары через государственный портал закупок. Удобно, быстро и надежно.
            </p>
          </div>
          
          <div className="flex-shrink-0">
            <a 
              href="https://omarket.kz/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-bold text-indigo-600 shadow-xl transition-all hover:scale-105 hover:bg-slate-50 hover:shadow-indigo-500/25"
            >
              Перейти на Omarket
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
