export function formatPrice(price, locale = 'ru') {
  if (!price || price.amount === null || price.amount === undefined) return null
  return new Intl.NumberFormat(locale === 'kk' ? 'kk-KZ' : 'ru-RU', {
    maximumFractionDigits: 2,
  }).format(price.amount)
}

export default function PriceDisplay({ price, locale = 'ru', labels, className = '' }) {
  const label = labels?.[price?.mode] || price?.mode
  const amount = formatPrice(price, locale)
  const text = price?.mode === 'exact'
    ? `${amount} ${price.currency}`
    : price?.mode === 'from'
      ? `${label} ${amount} ${price.currency}`
      : label

  return <span className={className}>{text || '—'}</span>
}
