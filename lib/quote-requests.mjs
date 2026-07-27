export const QUOTE_PRODUCT_SELECT = [
  'id',
  'sku',
  'name_ru',
  'name_kk',
  'image_url',
  'price_mode',
  'price_amount',
  'currency',
  'publication_status',
  'publish_ru',
  'publish_kk',
  'translation_status_kk',
].join(',')

export const QUOTE_REQUEST_SELECT = [
  'id',
  'customer_name',
  'customer_phone',
  'customer_email',
  'organization',
  'bin',
  'city',
  'customer_message',
  'locale',
  'consent_personal_data',
  'consent_at',
  'source_url',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'status',
  'internal_comment',
  'created_at',
  'updated_at',
  'items:quote_request_items(id,product_id,quantity,sku_snapshot,name_snapshot,image_url_snapshot,price_mode_snapshot,price_amount_snapshot,currency_snapshot,sort_order)',
].join(',')

export class QuoteProductUnavailableError extends Error {
  constructor() {
    super('One or more requested products are unavailable')
    this.name = 'QuoteProductUnavailableError'
    this.code = 'QUOTE_PRODUCT_UNAVAILABLE'
    this.status = 400
  }
}

export class QuoteSchemaNotReadyError extends Error {
  constructor() {
    super('Quote request storage is not ready')
    this.name = 'QuoteSchemaNotReadyError'
    this.code = 'QUOTE_SCHEMA_NOT_READY'
    this.status = 503
  }
}

function relationProductName(product, locale) {
  return locale === 'kk' ? product.name_kk : product.name_ru
}

export function buildQuoteSnapshotItems({ items, products, locale }) {
  const productMap = new Map((products || []).map((product) => [product.id, product]))
  if (productMap.size !== items.length) throw new QuoteProductUnavailableError()

  return items.map((item, index) => {
    const product = productMap.get(item.product_id)
    const name = relationProductName(product, locale)
    const isPublished = product.publication_status === 'published'
      && product[`publish_${locale}`] === true
      && (locale !== 'kk' || product.translation_status_kk === 'verified')
    if (!isPublished || !name || product.currency !== 'KZT') throw new QuoteProductUnavailableError()

    return {
      product_id: product.id,
      quantity: item.quantity,
      sku_snapshot: product.sku || null,
      name_snapshot: name,
      image_url_snapshot: product.image_url || null,
      price_mode_snapshot: product.price_mode,
      price_amount_snapshot: product.price_amount === null || product.price_amount === undefined
        ? null
        : Number(product.price_amount),
      currency_snapshot: 'KZT',
      sort_order: index,
    }
  })
}

function csvSafe(value) {
  const text = String(value ?? '')
  return /^[\t ]*[=+\-@]/.test(text) ? `'${text}` : text
}

export function escapeCsvCell(value) {
  return `"${csvSafe(value).replace(/"/g, '""')}"`
}

export function buildQuoteCsv(requests) {
  const rows = [[
    'ID',
    'Дата',
    'Статус',
    'Язык',
    'Имя',
    'Телефон',
    'Email',
    'Организация',
    'БИН',
    'Город',
    'Комментарий клиента',
    'Товары',
    'Внутренний комментарий',
  ]]

  for (const request of requests || []) {
    const items = (request.items || [])
      .map((item) => `${item.name_snapshot} ×${item.quantity}`)
      .join('; ')
    rows.push([
      request.id,
      request.created_at,
      request.status,
      request.locale,
      request.customer_name,
      request.customer_phone,
      request.customer_email,
      request.organization,
      request.bin,
      request.city,
      request.customer_message,
      items,
      request.internal_comment,
    ])
  }

  return `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`
}

export function isQuoteSchemaError(error) {
  return error?.code === '42703'
    || error?.code === 'PGRST204'
    || /column .* does not exist|schema cache/i.test(error?.message || '')
}
