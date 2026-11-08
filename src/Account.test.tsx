import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import Account from './Account'
import { acknowledgeNotebookSync, beginNotebookSession, failNotebookSync, finishNotebookSync, finishNotebookWrite, startNotebookWrite } from './notebookActivity'

const mocks = vi.hoisted(() => ({
  initializeAuth: vi.fn(), updateRecoveryPassword: vi.fn(), queueLength: vi.fn(),
  auth: {
    onAuthStateChange: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), resend: vi.fn(),
    resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  },
}))
vi.mock('./notebookSync', () => ({ notebookQueueLength: mocks.queueLength }))
vi.mock('./auth', () => ({
  supabase: { auth: mocks.auth },
  initializeAuth: mocks.initializeAuth,
  updateRecoveryPassword: mocks.updateRecoveryPassword,
  redirectUrl: (kind: string) => `http://localhost:3000/?auth=${kind}`,
}))

const session = { user: { id: 'user-1', email: 'cafe@example.test' } } as Session
let listener: (event: AuthChangeEvent, session: Session | null) => void
const unsubscribe = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  beginNotebookSession(session.user.id)
  sessionStorage.clear()
  mocks.initializeAuth.mockResolvedValue({ session: null, callback: null, failed: false })
  mocks.queueLength.mockResolvedValue(0)
  mocks.updateRecoveryPassword.mockResolvedValue(undefined)
  mocks.auth.onAuthStateChange.mockImplementation(callback => { listener = callback; return { data: { subscription: { unsubscribe } } } })
  for (const fn of [mocks.auth.signInWithPassword, mocks.auth.resend, mocks.auth.resetPasswordForEmail, mocks.auth.updateUser, mocks.auth.signOut]) fn.mockResolvedValue({ error: null })
  mocks.auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function openAccount() {
  render(<Account />)
  fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
  await screen.findByRole('heading', { name: 'Se connecter' })
  await screen.findByLabelText('Adresse e-mail')
}
function fillEmail() { fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: ' cafe@example.test ' } }) }
function fillPassword(label = 'Mot de passe') { fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value: 'password123' } }) }

describe('compte', () => {
  it('ne confirme la synchronisation qu’après un accusé et une vérification sans attente', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    expect(await screen.findByText(/n’est pas encore confirmé comme synchronisé/)).toBeInTheDocument()
    act(() => { acknowledgeNotebookSync(session.user.id); finishNotebookSync(session.user.id, 0, false, true) })
    expect(await screen.findByText(/Dernière synchronisation confirmée/)).toBeInTheDocument()
    act(() => failNotebookSync(session.user.id))
    expect(await screen.findByText(/La synchronisation n’est pas confirmée/)).toBeInTheDocument()
  })
  it('avertit avant de déconnecter des modifications enregistrées mais non synchronisées', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    vi.mocked(window.confirm).mockReturnValue(false)
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    await screen.findByText(/Connecté avec/)
    act(() => { startNotebookWrite(session.user.id); finishNotebookWrite(session.user.id, true) })
    expect(await screen.findByText(/Des modifications ne sont pas encore synchronisées/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('synchronisation n’est pas confirmée')))
    expect(mocks.auth.signOut).not.toHaveBeenCalled()
  })
  it('vérifie la file persistée avant la déconnexion, même si le dernier état affiché était à jour', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    mocks.queueLength.mockResolvedValue(1)
    vi.mocked(window.confirm).mockReturnValue(false)
    acknowledgeNotebookSync(session.user.id)
    finishNotebookSync(session.user.id, 0, false, true)
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    await screen.findByText(/Dernière synchronisation confirmée/)
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(window.confirm).toHaveBeenCalled())
    expect(mocks.auth.signOut).not.toHaveBeenCalled()
  })
  it('ne déconnecte pas un nouveau compte après une vérification différée', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    let resolve!: (value: number) => void
    mocks.queueLength.mockReturnValue(new Promise(res => { resolve = res }))
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    await screen.findByText(/Connecté avec/)
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    act(() => listener('SIGNED_IN', { user: { id: 'user-2', email: 'autre@example.test' } } as Session))
    await act(async () => resolve(0))
    expect(mocks.auth.signOut).not.toHaveBeenCalled()
    expect(await screen.findByText(/Connecté avec autre@example.test/)).toBeInTheDocument()
  })
  it('demande confirmation avant une déconnexion avec des écritures locales en cours', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    await screen.findByText(/Connecté avec/)
    startNotebookWrite(session.user.id)
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    await waitFor(() => expect(window.confirm).toHaveBeenCalled())
    expect(mocks.auth.signOut).not.toHaveBeenCalled()
    finishNotebookWrite(session.user.id, true)
  })
  it('signale une déconnexion externe pendant une écriture locale', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    await screen.findByText(/Connecté avec/)
    startNotebookWrite(session.user.id)
    act(() => listener('SIGNED_OUT', null))
    expect(await screen.findByRole('alert')).toHaveTextContent('travail en attente')
    finishNotebookWrite(session.user.id, true)
  })
  it('ne restaure pas une ancienne session après une déconnexion pendant l’initialisation', async () => {
    let resolve!: (value: { session: Session; callback: null; failed: false }) => void
    mocks.initializeAuth.mockReturnValue(new Promise(res => { resolve = res }))
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    act(() => listener('SIGNED_OUT', null))
    await act(async () => resolve({ session, callback: null, failed: false }))
    expect(await screen.findByRole('heading', { name: 'Se connecter' })).toBeInTheDocument()
    expect(screen.queryByText(/Connecté avec/)).not.toBeInTheDocument()
  })

  it('connecte, suit le renouvellement de session et déconnecte sans perdre le carnet', async () => {
    localStorage.setItem('coffee101-tasting-draft', 'notes locales')
    await openAccount()
    fillEmail(); fillPassword()
    fireEvent.submit(screen.getByRole('button', { name: 'Se connecter' }).closest('form')!)
    await waitFor(() => expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'cafe@example.test', password: 'password123' }))
    listener('SIGNED_IN', session)
    expect(await screen.findByText(/Connecté avec cafe@example.test/)).toBeInTheDocument()
    listener('TOKEN_REFRESHED', session)
    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    await screen.findByText('Tu es déconnecté.')
    expect(localStorage.getItem('coffee101-tasting-draft')).toBe('notes locales')
    cleanup()
    expect(unsubscribe).toHaveBeenCalled()
    localStorage.removeItem('coffee101-tasting-draft')
  })

  it('restaure une session et réagit à une déconnexion externe', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    expect(await screen.findByText(/Connecté avec/)).toBeInTheDocument()
    listener('SIGNED_OUT', null)
    expect(await screen.findByRole('heading', { name: 'Se connecter' })).toBeInTheDocument()
  })

  it('inscrit et propose une confirmation sans révéler si le compte existe', async () => {
    await openAccount()
    fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))
    fillEmail(); fillPassword()
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Si cette adresse')
    expect(mocks.auth.signUp).toHaveBeenCalledWith({ email: 'cafe@example.test', password: 'password123', options: { emailRedirectTo: 'http://localhost:3000/?auth=confirm' } })
    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer la confirmation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer le lien' }))
    await waitFor(() => expect(mocks.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'cafe@example.test', options: { emailRedirectTo: 'http://localhost:3000/?auth=confirm' } }))
    expect(await screen.findByRole('status')).toHaveTextContent('Si cette adresse')
  })

  it.each([
    ['user_already_exists', null],
    ['user_already_exists', { user: null, session: null }],
    ['email_exists', null],
    ['email_exists', { user: null, session: null }],
  ])('donne le même message pour %s avec données %s', async (code, data) => {
    mocks.auth.signUp.mockResolvedValue({ data, error: { code } })
    await openAccount()
    fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))
    fillEmail(); fillPassword()
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer un compte' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Si cette adresse')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('demande un lien puis permet de modifier le mot de passe', async () => {
    await openAccount()
    fireEvent.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }))
    fillEmail()
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))
    await waitFor(() => expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith('cafe@example.test', { redirectTo: 'http://localhost:3000/?auth=recovery' }))
    listener('PASSWORD_RECOVERY', session)
    expect(await screen.findByRole('heading', { name: 'Choisir un nouveau mot de passe' })).toBeInTheDocument()
    fillPassword('Nouveau mot de passe')
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
    await waitFor(() => expect(mocks.updateRecoveryPassword).toHaveBeenCalledWith('user-1', 'password123', expect.any(Function)))
    expect(await screen.findByText('Ton mot de passe a été modifié.')).toBeInTheDocument()
  })

  it('signale un lien expiré et une erreur réseau sans exposer de détails', async () => {
    mocks.initializeAuth.mockResolvedValue({ session: null, callback: 'invalid', failed: false })
    render(<Account />)
    expect(await screen.findByRole('alert')).toHaveTextContent('invalide ou a expiré')
    fillEmail(); fillPassword()
    mocks.auth.signInWithPassword.mockRejectedValue(new Error('secret technical detail'))
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connexion impossible'))
    expect(screen.getByRole('alert')).not.toHaveTextContent('secret')
  })

  it('signale une erreur réseau à la demande de réinitialisation', async () => {
    mocks.auth.resetPasswordForEmail.mockRejectedValue(new Error('offline'))
    await openAccount()
    fireEvent.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }))
    fillEmail()
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La demande n’a pas abouti')
  })

  it('garde la session si la déconnexion échoue', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    mocks.auth.signOut.mockResolvedValue({ error: new Error('offline') })
    render(<Account />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Déconnexion impossible')
    expect(screen.getByText(/Connecté avec/)).toBeInTheDocument()
  })

  it('restaure l’écran de nouveau mot de passe après un rechargement', async () => {
    sessionStorage.setItem('coffee101-password-recovery', 'user-1')
    mocks.initializeAuth.mockResolvedValue({ session, callback: null, failed: false })
    render(<Account />)
    expect(await screen.findByRole('heading', { name: 'Choisir un nouveau mot de passe' })).toBeVisible()
  })

  it('ferme la récupération quand un autre compte se connecte', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: 'recovery', failed: false })
    render(<Account />)
    await screen.findByRole('heading', { name: 'Choisir un nouveau mot de passe' })
    listener('SIGNED_IN', { user: { id: 'user-2', email: 'autre@example.test' } } as Session)
    expect(await screen.findByRole('alert')).toHaveTextContent('La session a changé')
    expect(screen.queryByRole('heading', { name: 'Choisir un nouveau mot de passe' })).not.toBeInTheDocument()
    expect(mocks.updateRecoveryPassword).not.toHaveBeenCalled()
  })

  it('ne montre pas de succès périmé après un changement de session', async () => {
    let resolve!: () => void
    mocks.updateRecoveryPassword.mockReturnValue(new Promise<void>(done => { resolve = done }))
    mocks.initializeAuth.mockResolvedValue({ session, callback: 'recovery', failed: false })
    render(<Account />)
    await screen.findByRole('heading', { name: 'Choisir un nouveau mot de passe' })
    fillPassword('Nouveau mot de passe')
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
    listener('SIGNED_IN', { user: { id: 'user-2', email: 'autre@example.test' } } as Session)
    expect(await screen.findByRole('alert')).toHaveTextContent('La session a changé')
    resolve()
    await waitFor(() => expect(screen.queryByText('Ton mot de passe a été modifié.')).not.toBeInTheDocument())
  })

  it('permet d’annuler la récupération et de se déconnecter', async () => {
    mocks.initializeAuth.mockResolvedValue({ session, callback: 'recovery', failed: false })
    render(<Account />)
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler et se déconnecter' }))
    expect(await screen.findByText('Tu es déconnecté.')).toBeInTheDocument()
    expect(mocks.auth.signOut).toHaveBeenCalledOnce()
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(sessionStorage.getItem('coffee101-password-recovery')).toBeNull()
  })

  it('confirme le retour et ne confond pas les comptes lors de la reprise', async () => {
    sessionStorage.setItem('coffee101-password-recovery', 'another-user')
    mocks.initializeAuth.mockResolvedValue({ session, callback: 'confirm', failed: false })
    render(<Account />)
    expect(await screen.findByText('Ton adresse a été confirmée.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Choisir un nouveau mot de passe' })).not.toBeInTheDocument()
  })

  it('empêche les soumissions simultanées et indique l’attente', async () => {
    let resolve!: (value: { error: null }) => void
    mocks.auth.signInWithPassword.mockReturnValue(new Promise(done => { resolve = done }))
    await openAccount()
    fillEmail(); fillPassword()
    const form = screen.getByRole('button', { name: 'Se connecter' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(within(form).getByRole('button', { name: 'En cours…' })).toBeDisabled()
    resolve({ error: null })
    expect(await screen.findByRole('status')).toHaveTextContent('Connexion réussie')
  })
})
