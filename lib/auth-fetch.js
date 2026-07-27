import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

async function requestWithCookies(url, options) {
  return fetch(url, {
    ...options,
    credentials: 'include',
  })
}

export async function authFetch(url, options = {}) {
  const response = await requestWithCookies(url, options)
  if (response.status !== 401 || typeof window === 'undefined') return response

  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.auth.refreshSession()
  if (!error && data.session) {
    const retry = await requestWithCookies(url, options)
    if (retry.status !== 401) return retry
  }

  await supabase.auth.signOut()
  if (window.location.pathname !== '/admin/login') {
    window.location.assign('/admin/login')
  }
  return response
}
