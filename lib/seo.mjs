import { LOCALES, isLocale } from './i18n/config.js'
import { SITE_URL, localizedUrl } from './site-config.mjs'

export function localizedAlternates(locale, path = '/') {
  const normalizedPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
  return {
    canonical: localizedUrl(locale, normalizedPath || '/'),
    languages: Object.fromEntries([
      ...LOCALES.map((locale) => [locale, localizedUrl(locale, normalizedPath || '/')]),
      ['x-default', localizedUrl('ru', normalizedPath || '/')],
    ]),
  }
}

export function localizedPageMetadata({ locale, path, title, description, noindex = false }) {
  const safeLocale = isLocale(locale) ? locale : 'ru'
  return {
    title,
    description,
    alternates: localizedAlternates(safeLocale, path),
    openGraph: {
      title,
      description,
      url: localizedUrl(safeLocale, path),
      locale: safeLocale === 'kk' ? 'kk_KZ' : 'ru_KZ',
      type: 'website',
    },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
  }
}

export function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function breadcrumbJsonLd({ locale, items }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: localizedUrl(locale, item.path) } : {}),
    })),
  }
}
