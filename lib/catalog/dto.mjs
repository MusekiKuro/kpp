import { validatePublicProductDTO } from '../domain-contracts.mjs'

export class CatalogDTOError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CatalogDTOError'
    this.code = 'INVALID_PUBLIC_CATALOG_DATA'
  }
}

function relationRow(value) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function publicUrlOrNull(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null
  return value
}

function publicStorageUrl(value, storageBaseUrl) {
  if (publicUrlOrNull(value)) return value
  if (typeof value !== 'string' || !value.trim() || !storageBaseUrl) return null

  const path = value.split('/').map((part) => encodeURIComponent(part)).join('/')
  return `${storageBaseUrl.replace(/\/$/, '')}/storage/v1/object/public/product-images/${path}`
}

function localized(row, field, locale) {
  return row[`${field}_${locale}`]
}

export function toPublicProductDTO(row, locale) {
  const category = relationRow(row.category)
  const brand = relationRow(row.brand)
  const isNumericMode = row.price_mode === 'exact' || row.price_mode === 'from'
  const dto = {
    id: row.id,
    slug: row.slug,
    sku: row.sku ?? null,
    locale,
    name: localized(row, 'name', locale),
    short_description: localized(row, 'short_description', locale) ?? null,
    description: localized(row, 'description', locale) ?? null,
    category_slug: category?.slug ?? null,
    brand_slug: brand?.slug ?? null,
    price: {
      mode: row.price_mode,
      amount: isNumericMode ? numericOrNull(row.price_amount) : null,
      old_amount: isNumericMode ? numericOrNull(row.old_price_amount) : null,
      currency: row.currency,
    },
    stock_status: row.stock_status,
    image_url: publicUrlOrNull(row.image_url),
  }

  try {
    return validatePublicProductDTO(dto)
  } catch (error) {
    throw new CatalogDTOError(error.message)
  }
}

export function toPublicProductDetailDTO(row, locale, { storageBaseUrl = null } = {}) {
  const product = toPublicProductDTO(row, locale)
  const gallery = (Array.isArray(row.product_images) ? row.product_images : [])
    .map((image) => ({
      id: image.id,
      url: publicStorageUrl(image.source_url || image.storage_path, storageBaseUrl),
      alt: image[`alt_${locale}`] || product.name,
      sort_order: image.sort_order ?? 0,
      is_primary: image.is_primary === true,
    }))
    .filter((image) => image.url)
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary) || left.sort_order - right.sort_order)

  if (gallery.length === 0 && product.image_url) {
    gallery.push({
      id: `${product.id}-legacy-image`,
      url: product.image_url,
      alt: product.name,
      sort_order: 0,
      is_primary: true,
    })
  }

  const specs = (Array.isArray(row.product_attribute_values) ? row.product_attribute_values : [])
    .map((value) => {
      const attribute = Array.isArray(value.attribute) ? value.attribute[0] : value.attribute
      if (!attribute) return null

      let formattedValue = null
      if (typeof value.value_boolean === 'boolean') {
        formattedValue = locale === 'kk' ? (value.value_boolean ? 'Иә' : 'Жоқ') : (value.value_boolean ? 'Да' : 'Нет')
      } else if (value.value_number !== null && value.value_number !== undefined) {
        formattedValue = String(value.value_number)
      } else if (value.value_option !== null && value.value_option !== undefined && value.value_option !== '') {
        formattedValue = String(value.value_option)
      } else {
        const localizedValue = locale === 'kk' ? value.value_text_kk : value.value_text_ru
        formattedValue = localizedValue ?? value.value_text_ru ?? value.raw_value ?? null
      }

      if (formattedValue === null || formattedValue === undefined || formattedValue === '') return null

      return {
        code: attribute.code,
        name: (locale === 'kk' ? attribute.name_kk : attribute.name_ru) || attribute.name_ru,
        value: String(formattedValue),
        unit: (locale === 'kk' ? attribute.unit_kk : attribute.unit_ru) || null,
        sort_order: attribute.sort_order ?? 0,
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
    .map(({ sort_order, ...spec }) => spec)

  return { ...product, gallery, specs }
}

export function toPublicCategoryDTO(row, locale) {
  return {
    id: row.id,
    parent_id: row.parent_id ?? null,
    slug: row.slug,
    name: localized(row, 'name', locale),
    description: localized(row, 'description', locale) ?? null,
    sort_order: row.sort_order,
  }
}

export function toPublicBrandDTO(row, locale) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: localized(row, 'description', locale) ?? null,
    logo_url: publicUrlOrNull(row.logo_url),
    website_url: publicUrlOrNull(row.website_url),
    sort_order: row.sort_order,
  }
}
