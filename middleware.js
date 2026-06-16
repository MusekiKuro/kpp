import { NextResponse } from 'next/server'
import {
  createAuthedClient,
  getAccessTokenFromRequest,
  isAdminUser,
} from '@/lib/api-auth'

export async function middleware(request) {
  const accessToken = getAccessTokenFromRequest(request)

  if (!accessToken) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const supabase = createAuthedClient(accessToken)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (!isAdminUser(user)) {
    return NextResponse.redirect(new URL('/admin/login?error=forbidden', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/((?!login).*)'],
}
