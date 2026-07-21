import { WA_LINK } from '@/lib/constants'
import OmarketBanner from '@/components/OmarketBanner'

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center hero-pattern border-b border-slate-100 overflow-hidden">
      <div className="relative w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* ── Desktop Omarket Banner (Sidebar on the left) ──────────────── */}
        <div className="hidden xl:block absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20">
          <OmarketBanner isSidebar={true} />
        </div>

        {/* ── Badge ───────────────────────── */}
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-300 bg-brand-50/80 backdrop-blur-md px-5 py-2 text-xs font-bold tracking-widest text-brand-800 uppercase mb-10 shadow-sm animate-fade-in-up">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
          </span>
          Тараз, Казахстан — с 2013 года
        </div>

        {/* ── Headline ───────────────────── */}
        <h1 className="font-heading text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tighter text-slate-900 leading-[1.1] animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Техника, мебель
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-cyan-500 font-light">и оборудование</span>
        </h1>

        {/* ── Subtitle ───────────────────── */}
        <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-2xl text-slate-600 leading-relaxed font-normal animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Продажа и доставка бытовой техники, мебели и профессионального оборудования по Таразу и всему Казахстану. Официальная гарантия и сервис.
        </p>

        {/* ── CTA buttons ────────────────── */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <a
            href="#catalog"
            className="btn-glow w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-cyan-500 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-brand-500/30 transition-transform hover:-translate-y-1 cursor-pointer"
          >
            Смотреть каталог
          </a>

          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-md hover:bg-white px-8 py-4 text-lg font-bold text-slate-800 shadow-md transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer"
          >
            Связаться с нами
          </a>
        </div>

        {/* ── Trust badges ───────────────── */}
        <div className="mt-24 grid grid-cols-3 gap-6 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          {[
            { label: 'Официальная гарантия' },
            { label: 'Быстрая доставка' },
            { label: '5 филиалов' }
          ].map((badge) => (
            <div
              key={badge.label}
              className="group flex flex-col items-center justify-center text-center p-6 rounded-3xl glass-panel animate-float hover:-translate-y-2 hover:shadow-xl transition-all duration-300"
              style={{ animationDelay: `${Math.random()}s` }}
            >
              <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-700 group-hover:text-brand-600 transition-colors">{badge.label}</span>
            </div>
          ))}
        </div>

        {/* ── Mobile Omarket Banner ────────────────── */}
        <div className="xl:hidden mt-12 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <OmarketBanner isSidebar={false} />
        </div>
      </div>
    </section>
  );
}
