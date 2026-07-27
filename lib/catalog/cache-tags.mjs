export const CATALOG_CACHE_TAGS = Object.freeze({
  all: 'catalog',
  products: 'catalog:products',
  categories: 'catalog:categories',
  brands: 'catalog:brands',
  attributes: 'catalog:attributes',
})

export function catalogCacheTags(locale, resource = CATALOG_CACHE_TAGS.products) {
  return [CATALOG_CACHE_TAGS.all, resource, `catalog:${locale}`]
}
