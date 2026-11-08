import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

type Callback = { kind: 'confirm' | 'recovery'; accessToken: string; refreshToken: string } | { kind: 'invalid' } | null

export function readCallback(location: Location, history: History): Callback {
  const url = new URL(location.href)
  const kind = url.searchParams.get('auth')
  const fragment = new URLSearchParams(url.hash.slice(1))
  const isCallback = kind === 'confirm' || kind === 'recovery' || fragment.has('access_token') || fragment.has('error') || fragment.has('error_code') || url.searchParams.has('error') || url.searchParams.has('error_code')
  if (!isCallback) return null
  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  const error = fragment.has('error') || fragment.has('error_code') || url.searchParams.has('error') || url.searchParams.has('error_code')
  const type = fragment.get('type')
  for (const key of ['auth', 'error', 'error_code', 'error_description', 'code']) url.searchParams.delete(key)
  url.hash = ''
  history.replaceState(history.state, '', url.pathname + url.search)
  if (error || !accessToken || !refreshToken || (kind !== 'confirm' && kind !== 'recovery') || (kind === 'recovery' ? type !== 'recovery' : type !== 'signup')) return { kind: 'invalid' }
  return { kind, accessToken, refreshToken }
}

export function redirectUrl(kind: 'confirm' | 'recovery'): string {
  const url = new URL('/', window.location.origin)
  url.searchParams.set('auth', kind)
  return url.href
}

const callback = readCallback(window.location, window.history)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

function createAuthClient(): SupabaseClient | null {
  try {
    if (!url || !key?.startsWith('sb_publishable_')) return null
    const parsed = new URL(url)
    if (parsed.origin !== 'https://uatfivtdbizqljzljmgw.supabase.co' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null
    return createClient(url, key, { auth: { detectSessionInUrl: false, flowType: 'implicit' } })
  } catch {
    return null
  }
}

export const supabase = createAuthClient()

export async function updateRecoveryPassword(owner: string, password: string): Promise<void> {
  if (!supabase || !url || !key) throw new Error('Authentication unavailable')
  const { data: current, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !current.session || current.session.user.id !== owner) throw new Error('Recovery session changed')
  const recoveryClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `coffee101-recovery-${crypto.randomUUID()}` },
  })
  try {
    const { data, error } = await recoveryClient.auth.setSession({
      access_token: current.session.access_token, refresh_token: current.session.refresh_token,
    })
    if (error || data.user?.id !== owner) throw new Error('Recovery session changed')
    const result = await recoveryClient.auth.updateUser({ password })
    if (result.error) throw result.error
  } finally {
    recoveryClient.auth.stopAutoRefresh()
  }
}

export type InitialAuth = { session: Session | null; callback: 'confirm' | 'recovery' | 'invalid' | null; failed: boolean }
let initialization: Promise<InitialAuth> | undefined
export function initializeAuth(): Promise<InitialAuth> {
  if (!initialization) initialization = (async () => {
    if (!supabase) return { session: null, callback: callback ? 'invalid' : null, failed: false }
    try {
      if (callback?.kind === 'invalid') return { session: null, callback: 'invalid', failed: false }
      if (callback) {
        const { data, error } = await supabase.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken })
        if (error || !data.session) return { session: null, callback: 'invalid', failed: false }
        return { session: data.session, callback: callback.kind, failed: false }
      }
      const { data, error } = await supabase.auth.getSession()
      if (error) return { session: null, callback: null, failed: true }
      return { session: data.session, callback: null, failed: false }
    } catch {
      return { session: null, callback: callback ? 'invalid' : null, failed: true }
    }
  })()
  return initialization
}
