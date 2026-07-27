import { CONTACT_CHANNELS } from '@/lib/site-config.mjs'
import { getCorporateDictionary } from '@/lib/i18n/corporate'

// Kept as a compatibility component for legacy callers; the localized route is the source of truth.
export default function ContactsSection({ locale = 'ru' }) {
  const page = getCorporateDictionary(locale).pages.contacts
  const labels = locale === 'kk' ? { whatsapp: 'WhatsApp', telegram: 'Telegram', phone: 'Қоңырау шалу' } : { whatsapp: 'WhatsApp', telegram: 'Telegram', phone: 'Позвонить' }
  return <section id="contacts" className="px-4 py-16 sm:py-24">
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">Nurset</p>
      <h2 className="mt-3 font-heading text-3xl font-extrabold text-slate-900 sm:text-4xl">{page.title}</h2>
      <p className="mt-5 text-lg leading-relaxed text-slate-600">{page.intro}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {CONTACT_CHANNELS.map((channel) => <a key={channel.key} href={channel.href} target={channel.key === 'phone' ? undefined : '_blank'} rel={channel.key === 'phone' ? undefined : 'noopener noreferrer'} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700 hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{labels[channel.key]}</a>)}
      </div>
      <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950">{page.notice}</p>
    </div>
  </section>
}
