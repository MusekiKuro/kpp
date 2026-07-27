import { siteUrl } from '@/lib/site-config.mjs'

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/import/', '/request', '/ru/request', '/kk/request', '/*?'],
    },
    sitemap: siteUrl('/sitemap.xml'),
  }
}
