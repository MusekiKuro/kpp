import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createServerClient } from '@/lib/supabase-server'
import { whatsappLink } from '@/lib/constants'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ProductCard from '@/components/ProductCard'
import { AddToCartButton } from './AddToCartButton'

export async function generateMetadata({ params }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (!product) {
    return { title: 'Товар не найден — Nurset' }
  }

  return {
    title: `${product.name} — Nurset`,
    description: product.description || `Купить ${product.name} в Nurset`,
  }
}

function parseProductDescription(description) {
  if (!description) return { features: [], cleanDescription: '' }
  
  const featureMatch = description.match(/<!--FEATURES-->\s*([\s\S]*?)\s*<!--\/FEATURES-->\s*/)
  if (featureMatch) {
    let rawFeatures = featureMatch[1].trim()
    let features;
    
    if (rawFeatures.includes('\n')) {
      features = rawFeatures.split('\n').map(s => s.trim()).filter(Boolean)
    } else {
      features = rawFeatures
        .split(/(?=\s[A-ZА-Я][a-zA-Zа-яА-Я\s]+:)/)
        .map(s => s.trim())
        .filter(Boolean)
    }
    
    const cleanDescription = description.replace(/<!--FEATURES-->[\s\S]*?<!--\/FEATURES-->\s*/, '').trim()
    return { features, cleanDescription }
  }
  
  const features = description
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(s => s.length > 3)
  return { features, cleanDescription: description }
}

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }) {
  const { id } = await params
  const supabase = createServerClient()

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !product) {
    notFound()
  }

  const { data: similarProducts } = await supabase
    .from('products')
    .select('*')
    .eq('category', product.category)
    .neq('id', product.id)
    .order('sort_order', { ascending: true })
    .limit(3)

  const { features, cleanDescription } = parseProductDescription(product.description)

  const whatsappHref = whatsappLink(
    `Здравствуйте! Хочу узнать цену на: ${product.name}`
  )

  return (
    <>
      <Header />
      <main className="flex-1 bg-[#F8FAFC] min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <Link href="/" className="hover:text-brand-600 transition-colors">Главная</Link>
            <span>/</span>
            <Link href="/#catalog" className="hover:text-brand-600 transition-colors">
              {product.category || 'Каталог'}
            </Link>
            <span>/</span>
            <span className="text-gray-600 truncate max-w-[200px]">{product.name}</span>
          </nav>

          {/* Main card */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {/* Image */}
              <div className="relative aspect-square bg-slate-50">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
                {product.category && (
                  <span className="inline-block bg-brand-50 text-brand-600 text-sm font-medium px-3 py-1 rounded-full mb-4 w-fit">
                    {product.category}
                  </span>
                )}

                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                  {product.name}
                </h1>

                {cleanDescription && (
                  <p className="text-gray-600 leading-relaxed mb-6">
                    {cleanDescription}
                  </p>
                )}

                {/* Features */}
                {features.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Характеристики</h3>
                    <ul className="space-y-1.5">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <AddToCartButton product={product} />

                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Узнать цену
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Similar products */}
          {similarProducts && similarProducts.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Похожие товары
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {similarProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
