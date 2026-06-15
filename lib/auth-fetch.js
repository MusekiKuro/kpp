function getSupabaseAccessToken() {
  if (typeof window === 'undefined') return null

  // 1. Try global variable set by admin layout
  if (window.__SUPABASE_ACCESS_TOKEN__) {
    return window.__SUPABASE_ACCESS_TOKEN__
  }

  // 2. Fallback: read from localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.includes('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        return parsed.access_token || null
      }
    }
  } catch {
    // localStorage not available or parse error
  }
  return null
}

export function authFetch(url, options = {}) {
  const token = getSupabaseAccessToken()
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
