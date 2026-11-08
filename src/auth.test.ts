import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), setSession: vi.fn(), getSession: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://uatfivtdbizqljzljmgw.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
  mocks.createClient.mockReturnValue({ auth: { setSession: mocks.setSession, getSession: mocks.getSession } })
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  window.history.replaceState({}, '', '/')
})
afterEach(() => { vi.unstubAllEnvs(); window.history.replaceState({}, '', '/') })

describe('retour d’authentification', () => {
  it.each(['signup', 'recovery'])('traite le retour %s une seule fois et nettoie l’adresse', async type => {
    const kind = type === 'signup' ? 'confirm' : 'recovery'
    window.history.replaceState({}, '', `/?vue=explorer&auth=${kind}#access_token=access&refresh_token=refresh&type=${type}`)
    const session = { user: { id: 'one' } }
    mocks.setSession.mockResolvedValue({ data: { session }, error: null })
    const auth = await import('./auth')
    expect(window.location.href).not.toContain('access')
    expect(window.location.search).toBe('?vue=explorer')
    expect(auth.redirectUrl('recovery')).toBe(`${window.location.origin}/?auth=recovery`)
    const [first, second] = await Promise.all([auth.initializeAuth(), auth.initializeAuth()])
    expect(first).toEqual({ session, callback: kind, failed: false })
    expect(second).toEqual(first)
    expect(mocks.setSession).toHaveBeenCalledOnce()
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' })
    expect(mocks.createClient).toHaveBeenCalledWith(expect.any(String), 'sb_publishable_test', { auth: { detectSessionInUrl: false, flowType: 'implicit' } })
  })

  it.each([
    '/?auth=recovery#error=access_denied&error_code=otp_expired',
    '/?auth=recovery#access_token=access&refresh_token=refresh&type=signup',
    '/?auth=confirm#access_token=access',
  ])('refuse et efface un retour invalide : %s', async path => {
    window.history.replaceState({}, '', path)
    const auth = await import('./auth')
    expect(await auth.initializeAuth()).toMatchObject({ callback: 'invalid' })
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
    expect(mocks.setSession).not.toHaveBeenCalled()
  })

  it('refuse un jeton expiré même si une session antérieure existe', async () => {
    window.history.replaceState({}, '', '/?auth=recovery#access_token=access&refresh_token=refresh&type=recovery')
    mocks.setSession.mockResolvedValue({ data: { session: null }, error: new Error('expired') })
    const auth = await import('./auth')
    expect(await auth.initializeAuth()).toMatchObject({ session: null, callback: 'invalid' })
  })

  it('restaure une session et signale les erreurs de stockage ou de réseau', async () => {
    mocks.getSession.mockRejectedValue(new Error('offline'))
    const auth = await import('./auth')
    expect(await auth.initializeAuth()).toEqual({ session: null, callback: null, failed: true })
  })

  it('refuse les configurations manquantes, secrètes ou visant un autre projet', async () => {
    for (const [url, key] of [
      ['', 'sb_publishable_test'],
      ['https://uatfivtdbizqljzljmgw.supabase.co', 'sb_secret_do_not_use'],
      ['https://example.test', 'sb_publishable_test'],
    ]) {
      vi.resetModules(); mocks.createClient.mockClear()
      vi.stubEnv('VITE_SUPABASE_URL', url); vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key)
      const auth = await import('./auth')
      expect(auth.supabase).toBeNull()
      expect(mocks.createClient).not.toHaveBeenCalled()
    }
  })

  it('isole la modification du mot de passe et vérifie le compte auprès du serveur', async () => {
    const recovery = { user: { id: 'one' }, access_token: 'a', refresh_token: 'r' }
    const isolated = { auth: { setSession: vi.fn().mockResolvedValue({ data: { user: { id: 'one' } }, error: null }), updateUser: vi.fn().mockResolvedValue({ error: null }), stopAutoRefresh: vi.fn() } }
    mocks.getSession.mockResolvedValue({ data: { session: recovery }, error: null })
    mocks.createClient.mockReturnValueOnce({ auth: { setSession: mocks.setSession, getSession: mocks.getSession } }).mockReturnValueOnce(isolated)
    const auth = await import('./auth')
    await auth.updateRecoveryPassword('one', 'nouveau')
    expect(isolated.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' })
    expect(isolated.auth.updateUser).toHaveBeenCalledWith({ password: 'nouveau' })
    expect(isolated.auth.stopAutoRefresh).toHaveBeenCalledOnce()
  })

  it('refuse de modifier le mot de passe si le compte a changé', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'other' } } }, error: null })
    const auth = await import('./auth')
    await expect(auth.updateRecoveryPassword('one', 'nouveau')).rejects.toThrow()
    expect(mocks.createClient).toHaveBeenCalledTimes(1)
  })

  it('refuse une identité distante différente du compte en récupération', async () => {
    const recovery = { user: { id: 'one' }, access_token: 'a', refresh_token: 'r' }
    const isolated = { auth: { setSession: vi.fn().mockResolvedValue({ data: { user: { id: 'other' } }, error: null }), updateUser: vi.fn(), stopAutoRefresh: vi.fn() } }
    mocks.getSession.mockResolvedValue({ data: { session: recovery }, error: null })
    mocks.createClient.mockReturnValueOnce({ auth: { setSession: mocks.setSession, getSession: mocks.getSession } }).mockReturnValueOnce(isolated)
    const auth = await import('./auth')
    await expect(auth.updateRecoveryPassword('one', 'nouveau')).rejects.toThrow()
    expect(isolated.auth.updateUser).not.toHaveBeenCalled()
    expect(isolated.auth.stopAutoRefresh).toHaveBeenCalledOnce()
  })
})
