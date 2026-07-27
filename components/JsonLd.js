import { safeJsonLd } from '@/lib/seo.mjs'

export default function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />
}
