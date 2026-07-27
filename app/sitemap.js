import { LOCALES } from '@/lib/i18n/config'
import { getPublishedBrands, getPublishedCategories, getPublishedProducts } from '@/lib/catalog/repository.mjs'
import { CORPORATE_PAGE_CONFIG, localizedUrl } from '@/lib/site-config.mjs'

export const revalidate = 3600

const CORPORATE_PATHS = {
  about: '/about',
  deliveryWarranty: '/delivery-warranty',
  contacts: '/contacts',
  privacy: '/privacy',
}

async function getPublishedPaths(locale) {
  try {
    const [categories, brands, firstProducts] = await Promise.all([
      getPublishedCategories(locale),
      getPublishedBrands(locale),
      getPublishedProducts({ locale, searchParams: new URLSearchParams({ page: '1', page_size: '50' }) }),
    ])
    const products = [...firstProducts.items]
    for (let page = 2; page <= firstProducts.pagination.total_pages; page += 1) {
      const next = await getPublishedProducts({ locale, searchParams: new URLSearchParams({ page: String(page), page_size: '50' }) })
      products.push(...next.items)
    }
    return {
      '/': true,
      '/catalog': true,
      '/brands': true,
      ...Object.fromEntries(Object.entries(CORPORATE_PAGE_CONFIG).filter(([, config]) => config.published).map(([pageKey]) => [CORPORATE_PATHS[pageKey], true])),
      ...Object.fromEntries(categories.map((category) => [`/catalog/${category.slug}`, true])),
      ...Object.fromEntries(brands.map((brand) => [`/brands/${brand.slug}`, true])),
      ...Object.fromEntries(products.map((product) => [`/product/${product.slug}`, true])),
    }
  } catch (error) {
    console.error('Sitemap catalog load failed', { locale, code: error?.code, status: error?.status })
    return {
      '/': true,
      '/catalog': true,
      '/brands': true,
      ...Object.fromEntries(Object.entries(CORPORATE_PAGE_CONFIG).filter(([, config]) => config.published).map(([pageKey]) => [CORPORATE_PATHS[pageKey], true])),
    }
  }
}

function localizedEntries(path, availableLocales) {
  const languages = Object.fromEntries([
    ...availableLocales.map((locale) => [locale, localizedUrl(locale, path)]),
    ...(availableLocales.includes('ru') ? [['x-default', localizedUrl('ru', path)]] : []),
  ])
  return availableLocales.map((locale) => ({ url: localizedUrl(locale, path), alternates: { languages } }))
}

export default async function sitemap() {
  const publishedByLocale = Object.fromEntries(await Promise.all(LOCALES.map(async (locale) => [locale, await getPublishedPaths(locale)])))
  const paths = new Set(['/', '/catalog', '/brands'])

  for (const [pageKey, config] of Object.entries(CORPORATE_PAGE_CONFIG)) {
    if (config.published) paths.add(CORPORATE_PATHS[pageKey])
  }
  for (const locale of LOCALES) {
    Object.keys(publishedByLocale[locale]).forEach((path) => paths.add(path))
  }

  const entries = []
  for (const path of paths) {
    const availableLocales = LOCALES.filter((locale) => publishedByLocale[locale][path])
    entries.push(...localizedEntries(path, availableLocales))
  }

  return entries.filter((entry, index, all) => all.findIndex((candidate) => candidate.url === entry.url) === index)
}
