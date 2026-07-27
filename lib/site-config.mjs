import { PHONE_LINK, TELEGRAM_LINK, WA_LINK } from './constants.js'

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()

function normalizeSiteUrl(value) {
  try {
    const url = new URL(value)
    return url.origin
  } catch {
    return 'http://localhost:3000'
  }
}

export const SITE_URL = normalizeSiteUrl(configuredSiteUrl || 'http://localhost:3000')
export const SITE_URL_CONFIGURED = Boolean(configuredSiteUrl)

// Keep this list owner-controlled: a page can exist for review without being submitted to search engines.
export const CORPORATE_PAGE_CONFIG = Object.freeze({
  about: { published: true },
  deliveryWarranty: { published: true },
  contacts: { published: true },
  privacy: { published: false },
})

export const CONTACT_CHANNELS = Object.freeze([
  { key: 'whatsapp', href: WA_LINK },
  { key: 'telegram', href: TELEGRAM_LINK },
  { key: 'phone', href: PHONE_LINK },
])

export function siteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString()
}

export function localizedUrl(locale, path = '/') {
  const suffix = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
  return siteUrl(`/${locale}${suffix}`)
}
