export const WHATSAPP_NUMBER = '77059000660'

export const WA_LINK = `https://wa.me/${WHATSAPP_NUMBER}`

export const PHONE_LINK = `tel:+${WHATSAPP_NUMBER}`

export const TELEGRAM_LINK = `https://t.me/+${WHATSAPP_NUMBER}`

export function whatsappLink(text) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}
