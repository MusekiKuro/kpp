import { getCorporateDictionary } from '@/lib/i18n/corporate'

// Kept as a compatibility component for legacy callers; the localized route is the source of truth.
export default function AboutSection({ locale = 'ru' }) {
  const page = getCorporateDictionary(locale).pages.about
  return <section id="about" className="border-y border-slate-200/60 bg-slate-50 px-4 py-16 sm:py-24">
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">Nurset</p>
      <h2 className="mt-3 font-heading text-3xl font-extrabold text-slate-900 sm:text-4xl">{page.title}</h2>
      <p className="mt-5 text-lg leading-relaxed text-slate-600">{page.intro}</p>
      <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950">{page.notice}</p>
    </div>
  </section>
}
