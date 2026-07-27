import { parseCatalogQuery } from '../catalog/query-parser.mjs'

export const LOCALES = ['ru', 'kk']

export const DEFAULT_LOCALE = 'ru'

export function isLocale(value) {
  return LOCALES.includes(value)
}

export function localizedPath(locale, path = '/') {
  const suffix = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
  return `/${locale}${suffix}`
}

function toURLSearchParams(input) {
  if (!input) return new URLSearchParams()
  if (input instanceof URLSearchParams || (typeof input === 'object' && typeof input.entries === 'function' && typeof input.get === 'function')) {
    return new URLSearchParams(input.toString())
  }
  if (typeof input === 'string') return new URLSearchParams(input.replace(/^\?/, ''))
  if (typeof input === 'object') {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(input)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) params.append(key, String(item))
        }
      } else if (value !== undefined && value !== null) {
        params.append(key, String(value))
      }
    }
    return params
  }
  return new URLSearchParams()
}

function isCatalogRoute(routePath) {
  return routePath === '/catalog' || routePath.startsWith('/catalog/') || routePath === '/brands' || routePath.startsWith('/brands/')
}

function sanitizeCatalogParams(params) {
  if ([...params.keys()].length === 0) return ''
  try {
    parseCatalogQuery(params)
    return params.toString()
  } catch {
    const clean = new URLSearchParams()
    for (const [key, value] of params.entries()) {
      const candidate = new URLSearchParams(clean)
      candidate.append(key, value)
      try {
        parseCatalogQuery(candidate)
        clean.append(key, value)
      } catch {
        // Skip invalid parameter or value
      }
    }
    return clean.toString()
  }
}

export function switchLocalePath(pathname, locale, searchParams = null) {
  const targetLocale = isLocale(locale) ? locale : DEFAULT_LOCALE
  const segments = (pathname || '/').split('/')

  if (isLocale(segments[1])) {
    segments[1] = targetLocale
  } else {
    segments.splice(1, 0, targetLocale)
  }

  const newPathname = segments.join('/') || `/${targetLocale}`
  const routePath = '/' + segments.slice(2).join('/')

  const params = toURLSearchParams(searchParams)
  if ([...params.keys()].length === 0) {
    return newPathname
  }

  let queryString = ''
  if (isCatalogRoute(routePath)) {
    queryString = sanitizeCatalogParams(params)
  }

  return queryString ? `${newPathname}?${queryString}` : newPathname
}
