import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isAdminUser } from '@/lib/auth-roles'

export async function requireAuth(_request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    return { user, supabase }
  } catch (error) {
    console.error('Authentication check failed:', error)
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
}

export async function requireAdmin(request) {
  const auth = await requireAuth(request)
  if (auth.error) return auth

  if (!isAdminUser(auth.user)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return auth
}
