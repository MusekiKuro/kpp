import { WA_LINK } from '@/lib/constants'

export default function Hero() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center bg-white border-b border-brand-100">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        {/* ── Badge ───────────────────────── */}
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold tracking-wider text-brand-600 uppercase mb-8">
          Тараз, Казахстан — с 2013 года
        </div>

        {/* ── Headline ───────────────────── */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
          Техника, мебель
          <br />
          <span className="text-gray-500 font-light">и оборудование</span>
        </h1>

        {/* ── Subtitle ───────────────────── */}
        <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-gray-500 leading-relaxed font-normal">
          Продажа и доставка бытовой техники, мебели и профессионального оборудования по Таразу и всему Казахстану. Официальная гарантия и сервис.
        </p>

        {/* ── CTA buttons ────────────────── */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="#catalog"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 px-8 py-3.5 text-sm font-semibold text-white transition-all cursor-pointer"
          >
            Смотреть каталог
          </a>

          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white hover:bg-brand-50 px-8 py-3.5 text-sm font-semibold text-brand-700 transition-all cursor-pointer"
          >
            Связаться с нами
          </a>
        </div>

        {/* ── Trust badges ───────────────── */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto">
          {[
            { label: 'Гарантия' },
            { label: 'Доставка' },
            { label: '5 магазинов' }
          ].map((badge) => (
            <div
              key={badge.label}
              className="flex flex-col items-center justify-center text-center"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
