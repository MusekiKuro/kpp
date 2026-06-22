import Link from 'next/link';

export default function OmarketBanner({ isSidebar = false }) {
  const logo = (
    <div className="bg-white px-3.5 py-2 rounded-xl flex items-center justify-center shadow-sm select-none">
      <div className="flex items-center font-black text-lg tracking-tight">
        <span className="text-[#ff7a00]">o</span>
        <span className="text-[#0b58c6]">market</span>
        <span className="text-gray-400 text-xs font-normal">.kz</span>
      </div>
    </div>
  );

  if (isSidebar) {
    return (
      <div className="w-56 rounded-2xl bg-gradient-to-b from-[#ff8a00] to-[#ff5200] border border-orange-400/30 p-5 text-left shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 animate-fade-in-up relative">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 w-full h-full bg-white/5 rounded-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
            <div className="mb-4">
              {logo}
            </div>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-orange-100 bg-orange-950/40 px-2.5 py-0.5 rounded-full border border-orange-400/20 mb-3">
              Госзакупки
            </span>
            <h4 className="text-base font-bold text-white mb-2 leading-tight">
              Мы на Omarket.kz
            </h4>
            <p className="text-xs text-orange-50 leading-relaxed mb-4">
              Приобретайте наши товары быстро и официально через портал.
            </p>
          </div>
          
          <a 
            href="https://omarket.kz/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 w-full rounded-xl bg-white hover:bg-orange-50 py-2.5 text-xs font-bold text-[#ff7a00] shadow transition-colors"
          >
            Перейти
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    );
  }

  // Mobile / inline version
  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-gradient-to-r from-[#ff8a00] to-[#ff5200] border border-orange-400/30 p-5 text-left shadow-lg relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {logo}
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-100 bg-orange-950/40 px-2.5 py-0.5 rounded-full border border-orange-400/20">
              Госзакупки
            </span>
          </div>
          <h4 className="text-base font-bold text-white mb-1">
            Мы на Omarket.kz
          </h4>
          <p className="text-xs text-orange-50">
            Официальный поставщик техники, мебели и оборудования.
          </p>
        </div>
        
        <div className="flex-shrink-0">
          <a 
            href="https://omarket.kz/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-white hover:bg-orange-50 px-4 py-2.5 text-xs font-bold text-[#ff7a00] shadow transition-colors w-full sm:w-auto"
          >
            Перейти
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
