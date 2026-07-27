'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { WA_LINK } from '@/lib/constants'
import { DEFAULT_LOCALE, isLocale, localizedPath, LOCALES, switchLocalePath } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getCorporateDictionary } from '@/lib/i18n/corporate'
import { trackEvent } from '@/lib/analytics'

function HeaderInner({ searchParams }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const locale = isLocale(params?.locale) ? params.locale : DEFAULT_LOCALE
  const dictionary = getDictionary(locale)
  const corporate = getCorporateDictionary(locale)
  const navLinks = [
    { label: dictionary.navigation.catalog, href: localizedPath(locale, '/catalog') },
    { label: dictionary.navigation.brands, href: localizedPath(locale, '/brands') },
    { label: dictionary.navigation.about, href: localizedPath(locale, '/about') },
    { label: corporate.navigation.deliveryWarranty, href: localizedPath(locale, '/delivery-warranty') },
    { label: dictionary.navigation.contacts, href: localizedPath(locale, '/contacts') },
  ]
  const cartPath = localizedPath(locale, '/request')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const logoClicks = useRef([])
  const menuButtonRef = useRef(null)
  const menuPanelRef = useRef(null)

  const handleLogoClick = (event) => {
    const now = Date.now()
    logoClicks.current.push(now)
    logoClicks.current = logoClicks.current.filter((time) => now - time < 1500)
    if (logoClicks.current.length >= 3) {
      event.preventDefault()
      logoClicks.current = []
      router.push('/admin/login')
    }
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = previousOverflow
    }

    if (!menuOpen) return () => { document.body.style.overflow = previousOverflow }

    const focusables = () => Array.from(menuPanelRef.current?.querySelectorAll('a, button') || []).filter((item) => !item.hasAttribute('disabled'))
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const first = focusables()[0]
    first?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  const languageSwitcher = (mobile = false) => (
    <div className={mobile ? 'flex items-center gap-2 px-4 py-3 text-xs font-bold' : 'hidden sm:flex items-center rounded-xl border border-slate-200 bg-white/70 p-1 text-xs font-bold'}>
      {LOCALES.map((option) => (
        <Link
          key={option}
          href={switchLocalePath(pathname, option, searchParams)}
          aria-current={option === locale ? 'page' : undefined}
          onClick={mobile ? () => setMenuOpen(false) : undefined}
          className={`rounded-lg px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${option === locale ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600'}`}
        >
          {mobile ? dictionary.language[option] : option.toUpperCase()}
        </Link>
      ))}
    </div>
  )

  return (
    <>
      <a href="#main-content" className="sr-only z-[60] rounded-md bg-white px-4 py-2 text-sm font-bold text-brand-700 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{locale === 'kk' ? 'Негізгі мазмұнға өту' : 'Перейти к основному содержанию'}</a>
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'glass-panel border-b border-white/40' : 'bg-transparent py-2'}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href={localizedPath(locale)} onClick={handleLogoClick} className="flex items-center gap-2 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 text-white font-bold text-lg shadow-md group-hover:shadow-lg transition-shadow">N</span>
            <span className="font-heading text-2xl font-extrabold tracking-tight text-gradient">NURSET</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="nav-link px-3 py-2 text-sm font-semibold text-slate-700 hover:text-brand-600 transition-colors">
                {link.label}
              </a>
            ))}
            <Link href={cartPath} className="nav-link px-3 py-2 text-sm font-semibold text-slate-700 hover:text-brand-600 transition-colors">
              {dictionary.navigation.request}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {languageSwitcher()}
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('contact_cta', { locale, channel: 'whatsapp' })} className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:shadow-lg hover:shadow-[#25D366]/40 hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.61.609l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.25 0-4.336-.738-6.022-1.985l-.42-.312-2.647.887.887-2.647-.312-.42A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
              </svg>
              WhatsApp
            </a>
             <button type="button" ref={menuButtonRef} onClick={() => setMenuOpen(!menuOpen)} className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? dictionary.closeMenu : dictionary.openMenu}>
              {menuOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div id="mobile-navigation" ref={menuPanelRef} inert={!menuOpen ? true : undefined} aria-hidden={!menuOpen} className={`md:hidden transition-all duration-300 overflow-hidden ${menuOpen ? 'max-h-[40rem] opacity-100' : 'max-h-0 opacity-0'} motion-reduce:transition-none`}>
        <nav className="border-t border-gray-100 bg-white/95 backdrop-blur-lg px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-600 transition-colors">
              {link.label}
            </a>
          ))}
          <Link href={cartPath} onClick={() => setMenuOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-600 transition-colors">
             {dictionary.navigation.request}
          </Link>
          {languageSwitcher(true)}
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('contact_cta', { locale, channel: 'whatsapp' })} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
            WhatsApp
          </a>
        </nav>
      </div>
      </header>
    </>
  )
}

function HeaderWithSearchParams() {
  const searchParams = useSearchParams()
  return <HeaderInner searchParams={searchParams} />
}

export default function Header() {
  return (
    <Suspense fallback={<HeaderInner searchParams={null} />}>
      <HeaderWithSearchParams />
    </Suspense>
  )
}
