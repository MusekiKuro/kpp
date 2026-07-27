import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/auth-roles'

export async function proxy(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (!isAdminUser(user)) {
    return NextResponse.redirect(new URL('/admin/login?error=forbidden', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin', '/admin/((?!login(?:/|$)).*)'],
}
