import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminUser(user) {
  const role = user?.app_metadata?.role || user?.user_metadata?.role
  if (role === 'admin') return true

  const email = user?.email?.toLowerCase()
  return Boolean(email && getAdminEmails().includes(email))
}

export function getAccessTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  const requestCookies = request.cookies?.getAll?.()
  const requestCookie = requestCookies?.find((cookie) =>
    cookie.name.includes('sb-') && cookie.name.includes('-auth-token')
  )

  if (requestCookie) {
    try {
      return JSON.parse(requestCookie.value).access_token || null
    } catch {
      return null
    }
  }

  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = cookieHeader.split(';').map((s) => s.trim()).filter(Boolean)
  const authCookie = cookies.find((cookie) =>
    cookie.includes('sb-') && cookie.includes('-auth-token')
  )

  if (!authCookie) return null

  try {
    const value = authCookie.split('=').slice(1).join('=')
    return JSON.parse(decodeURIComponent(value)).access_token || null
  } catch {
    return null
  }
}

export function createAuthedClient(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )
}

export async function requireAuth(request) {
  const accessToken = getAccessTokenFromRequest(request)

  if (!accessToken) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createAuthedClient(accessToken)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { user, supabase, accessToken }
}

export async function requireAdmin(request) {
  const auth = await requireAuth(request)
  if (auth.error) return auth

  if (!isAdminUser(auth.user)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return auth
}
