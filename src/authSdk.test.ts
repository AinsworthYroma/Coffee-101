import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
  localStorage.clear()
})

it('valide le retour de récupération avec le vrai SDK et un serveur simulé', async () => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://uatfivtdbizqljzljmgw.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${encode({ alg: 'none' })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'user-1', email: 'cafe@example.test', aud: 'authenticated' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetchMock)
  window.history.replaceState({}, '', `/?auth=recovery#access_token=${jwt}&refresh_token=test-refresh&type=recovery`)
  const auth = await import('./auth')
  try {
    const result = await auth.initializeAuth()
    expect(result.callback).toBe('recovery')
    expect(result.session?.user.id).toBe('user-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://uatfivtdbizqljzljmgw.supabase.co/auth/v1/user',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(window.location.href).not.toContain('access_token')
  } finally {
    auth.supabase?.auth.stopAutoRefresh()
  }
})
