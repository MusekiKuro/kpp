'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const navItems = [
  ['Товары', '/admin/products', '▣'],
  ['Категории', '/admin/categories', '▦'],
  ['Бренды', '/admin/brands', '◇'],
  ['Характеристики', '/admin/attributes', '≡'],
  ['Импорты', '/admin/imports', '↑'],
  ['Заявки', '/admin/orders', '☷'],
  ['Запросы КП', '/admin/requests', '□'],
]

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (pathname === '/admin/login') return undefined
    const supabase = getSupabaseBrowserClient()
    let active = true
    async function checkAuth() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!active) return
      if (error || !user) { router.replace('/admin/login'); return }
      if (user.app_metadata?.role !== 'admin') { router.replace('/admin/login?error=forbidden'); return }
      setAuthenticated(true)
      setLoading(false)
    }
    checkAuth()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') router.replace('/admin/login') })
    return () => { active = false; subscription.unsubscribe() }
  }, [pathname, router])

  if (pathname === '/admin/login') return children
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-gray-500">Проверка доступа…</div>
  if (!authenticated) return null

  const signOut = async () => { await getSupabaseBrowserClient().auth.signOut(); router.push('/admin/login') }
  return <div className="flex min-h-screen bg-[#F8FAFC]">
    {sidebarOpen && <button aria-label="Закрыть меню" className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-100 bg-white transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-16 items-center border-b border-gray-100 px-6"><Link href="/admin/products" className="text-xl font-bold text-brand-600">Nurset Admin</Link></div>
      <nav className="flex-1 space-y-1 px-3 py-4">{navItems.map(([label, href, icon]) => <Link key={href} href={href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${pathname === href ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'}`}><span className="w-5 text-center">{icon}</span>{label}</Link>)}</nav>
      <div className="border-t border-gray-100 p-3"><button onClick={signOut} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-600 hover:bg-gray-50">Выйти</button></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex h-16 items-center border-b border-gray-100 bg-white px-4 lg:hidden"><button aria-label="Открыть меню" onClick={() => setSidebarOpen(true)} className="text-xl">☰</button><span className="ml-4 font-bold text-brand-600">Nurset Admin</span></header><main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main></div>
  </div>
}
