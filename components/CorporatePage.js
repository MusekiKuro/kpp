import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import { CONTACT_CHANNELS } from '@/lib/site-config.mjs'
import { getCorporateDictionary } from '@/lib/i18n/corporate'
import { breadcrumbJsonLd } from '@/lib/seo.mjs'

const PAGE_PATHS = {
  about: '/about',
  deliveryWarranty: '/delivery-warranty',
  contacts: '/contacts',
  privacy: '/privacy',
}

const CONTACT_LABELS = {
  ru: { whatsapp: 'WhatsApp', telegram: 'Telegram', phone: 'Позвонить' },
  kk: { whatsapp: 'WhatsApp', telegram: 'Telegram', phone: 'Қоңырау шалу' },
}

export default function CorporatePage({ locale, pageKey }) {
  const dictionary = getCorporateDictionary(locale)
  const page = dictionary.pages[pageKey]
  const path = PAGE_PATHS[pageKey]
  const contactLabels = CONTACT_LABELS[locale] || CONTACT_LABELS.ru
  const breadcrumbs = breadcrumbJsonLd({
    locale,
    items: [
      { name: 'Nurset', path: '/' },
      { name: page.title },
    ],
  })

  return <>
    <JsonLd data={breadcrumbs} />
    <Header />
    <main id="main-content" className="flex-1 bg-surface px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <nav aria-label={locale === 'kk' ? 'Навигация жолы' : 'Навигационная цепочка'} className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href={`/${locale}`} className="rounded-md hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">Nurset</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-slate-700">{page.title}</span>
        </nav>

        <header className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">Nurset</p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{page.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600">{page.intro}</p>
        </header>

        <div role="note" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950">
          <p className="font-bold">{locale === 'kk' ? 'Мазмұн күйі' : 'Статус содержания'}</p>
          <p className="mt-1">{page.notice}</p>
        </div>

        {pageKey === 'contacts' ? <ContactChannels locale={locale} labels={contactLabels} /> : <div className="mt-8 grid gap-5 md:grid-cols-2">
          {page.sections.map((section) => <section key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
            <p className="mt-4 leading-relaxed text-slate-600">{section.text}</p>
          </section>)}
        </div>}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={`/${locale}/catalog`} className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 py-3 font-bold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
            {locale === 'kk' ? 'Каталогты ашу' : 'Открыть каталог'}
          </Link>
          {pageKey !== 'contacts' && <Link href={`/${locale}/contacts`} className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
            {locale === 'kk' ? 'Байланыстарға өту' : 'Перейти к контактам'}
          </Link>}
        </div>
      </div>
    </main>
    <Footer />
  </>
}

function ContactChannels({ locale, labels }) {
  return <section aria-labelledby="contact-channels-title" className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <h2 id="contact-channels-title" className="text-2xl font-bold text-slate-900">{locale === 'kk' ? 'Байланыс арналары' : 'Каналы связи'}</h2>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {CONTACT_CHANNELS.map((channel) => <a key={channel.key} href={channel.href} target={channel.key === 'phone' ? undefined : '_blank'} rel={channel.key === 'phone' ? undefined : 'noopener noreferrer'} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-center font-bold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
        {labels[channel.key]}
      </a>)}
    </div>
  </section>
}
