'use client'

import { useState } from 'react'
import CatalogImage from './CatalogImage'

export default function ProductGallery({ gallery, name, label }) {
  const [active, setActive] = useState(gallery[0] || null)
  if (!gallery.length) return <div className="flex aspect-square items-center justify-center bg-slate-50 text-slate-400">{label}</div>

  return <div aria-label={label}>
    <div className="relative aspect-square overflow-hidden bg-slate-50"><CatalogImage src={active?.url} alt={active?.alt || name} className="h-full w-full object-contain p-6 sm:p-10" priority /></div>
    {gallery.length > 1 && <div className="grid grid-cols-5 gap-2 border-t border-slate-100 bg-white p-3">{gallery.map((image) => <button key={image.id} type="button" onClick={() => setActive(image)} className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active?.id === image.id ? 'border-brand-500' : 'border-transparent'}`} aria-label={image.alt || name}><CatalogImage src={image.url} alt="" className="h-full w-full object-cover" /></button>)}</div>}
  </div>
}
