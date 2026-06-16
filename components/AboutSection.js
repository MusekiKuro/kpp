export default function AboutSection() {
  const stats = [
    {
      number: '10+',
      label: 'лет на рынке',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      number: '5',
      label: 'магазинов',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36a1.11 1.11 0 01-1.11-1.11v0a1.11 1.11 0 01.367-.828l8.49-7.56a1.11 1.11 0 011.486 0l8.49 7.56a1.11 1.11 0 01.367.828v0a1.11 1.11 0 01-1.11 1.11H13.5" />
        </svg>
      ),
    },
    {
      number: '1000+',
      label: 'клиентов',
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="about" className="py-20 sm:py-32 bg-slate-50 border-y border-slate-200/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* ── Text ──────────────────────── */}
          <div>
            <span className="inline-block rounded-full border border-brand-200 bg-brand-50/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 mb-6 shadow-sm">
              О компании
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight">
              Nurset — ваш надёжный партнёр
            </h2>
            <div className="mt-8 space-y-5 text-slate-600 leading-relaxed text-base">
              <p>
                С 2013 года мы обеспечиваем жителей Тараза и всего Казахстана качественной бытовой техникой, мебелью и оборудованием. Наша сеть из 5 магазинов позволяет удобно выбирать и покупать товары.
              </p>
              <p>
                Мы работаем только с проверенными поставщиками и предоставляем официальную гарантию на всю продукцию. Наша миссия — сделать покупки простыми, доступными и приятными.
              </p>
            </div>
          </div>

          {/* ── Stats grid ────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-5 rounded-2xl glass-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  {stat.icon}
                </div>
                <div>
                  <p className="font-heading text-2xl font-extrabold text-brand-700">
                    {stat.number}
                  </p>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
