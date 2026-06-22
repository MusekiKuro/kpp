import { WA_LINK } from '@/lib/constants'
import OmarketBanner from '@/components/OmarketBanner'

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center hero-pattern border-b border-slate-100 overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* ── Desktop Omarket Banner (Sidebar on the left) ──────────────── */}
        <div className="hidden xl:block absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20">
          <OmarketBanner isSidebar={true} />
        </div>

        {/* ── Badge ───────────────────────── */}
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/60 backdrop-blur-md px-4 py-1.5 text-xs font-semibold tracking-wider text-brand-700 uppercase mb-8 shadow-sm animate-fade-in-up">
          Тараз, Казахстан — с 2013 года
        </div>

        {/* ── Headline ───────────────────── */}
        <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          Техника, мебель
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-600 font-light">и оборудование</span>
        </h1>

        {/* ── Subtitle ───────────────────── */}
        <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-slate-600 leading-relaxed font-normal animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          Продажа и доставка бытовой техники, мебели и профессионального оборудования по Таразу и всему Казахстану. Официальная гарантия и сервис.
        </p>

        {/* ── CTA buttons ────────────────── */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <a
            href="#catalog"
            className="btn-glow w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition-transform hover:scale-105 cursor-pointer"
          >
            Смотреть каталог
          </a>

          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-md hover:bg-white px-8 py-3.5 text-base font-semibold text-slate-700 shadow-sm transition-all hover:scale-105 cursor-pointer"
          >
            Связаться с нами
          </a>
        </div>

        {/* ── Trust badges ───────────────── */}
        <div className="mt-20 grid grid-cols-3 gap-6 max-w-lg mx-auto animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          {[
            { label: 'Официальная гарантия' },
            { label: 'Быстрая доставка' },
            { label: '5 филиалов' }
          ].map((badge) => (
            <div
              key={badge.label}
              className="flex flex-col items-center justify-center text-center p-4 rounded-2xl glass-panel animate-float"
              style={{ animationDelay: `${Math.random()}s` }}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{badge.label}</span>
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
