import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { initializeAuth, redirectUrl, supabase, updateRecoveryPassword } from './auth'
import './account.css'

type Mode = 'signin' | 'signup' | 'resend' | 'reset' | 'recovery'
const titles: Record<Mode, string> = {
  signin: 'Se connecter', signup: 'Créer un compte', resend: 'Renvoyer le lien de confirmation',
  reset: 'Mot de passe oublié', recovery: 'Choisir un nouveau mot de passe',
}
const emailMessage = 'Si cette adresse peut recevoir ce message, un lien lui sera envoyé. Vérifie aussi les courriers indésirables.'
const recoveryKey = 'coffee101-password-recovery'
function recoveryOwner(): string | null { try { return sessionStorage.getItem(recoveryKey) } catch { return null } }
function rememberRecovery(userId: string | null) {
  try { if (userId) sessionStorage.setItem(recoveryKey, userId); else sessionStorage.removeItem(recoveryKey) } catch { /* La session reste utilisable sans stockage de session. */ }
}

export default function Account() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('signin')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const recoveryUser = useRef<string | null>(null)
  const recoveryVersion = useRef(0)

  useEffect(() => {
    let active = true
    const subscription = supabase?.auth.onAuthStateChange((event, next) => {
      if (!active) return
      setSession(next)
      if (event === 'PASSWORD_RECOVERY' && next) { recoveryVersion.current++; recoveryUser.current = next.user.id; rememberRecovery(next.user.id); setMode('recovery'); setOpen(true) }
      else if (recoveryUser.current && next?.user.id !== recoveryUser.current) {
        recoveryVersion.current++; recoveryUser.current = null; rememberRecovery(null); setMode('signin')
        setError('La session a changé. Demande un nouveau lien de réinitialisation.')
      }
      if (event === 'SIGNED_OUT') { recoveryVersion.current++; recoveryUser.current = null; rememberRecovery(null); setMode('signin') }
    }).data.subscription
    void initializeAuth().then(result => {
      if (!active) return
      setSession(result.session)
      setLoading(false)
      if (result.callback) {
        setOpen(true)
        if (result.callback === 'recovery' && result.session) { recoveryVersion.current++; recoveryUser.current = result.session.user.id; rememberRecovery(result.session.user.id); setMode('recovery') }
        else if (result.callback === 'confirm') setMessage('Ton adresse a été confirmée.')
        else setError('Ce lien est invalide ou a expiré. Demande un nouveau lien.')
      } else if (result.failed) setError('Impossible de retrouver la session. Vérifie ta connexion et réessaie.')
      else if (result.session && recoveryOwner() === result.session.user.id) { recoveryVersion.current++; recoveryUser.current = result.session.user.id; setMode('recovery'); setOpen(true) }
    })
    return () => { active = false; subscription?.unsubscribe() }
  }, [])

  const changeMode = (next: Mode) => { setMode(next); setPassword(''); setConfirmation(''); setMessage(''); setError('') }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || submitting.current) return
    if ((mode === 'signup' || mode === 'recovery') && password !== confirmation) { setError('Les mots de passe ne correspondent pas.'); return }
    submitting.current = true
    const recoveryAttempt = recoveryVersion.current
    setBusy(true); setError(''); setMessage('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setPassword('')
        setMessage('Connexion réussie.')
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectUrl('confirm') } })
        if (error && !['user_already_exists', 'email_exists'].includes(error.code ?? '')) throw error
        setPassword(''); setConfirmation(''); setMessage(!error && data?.session ? 'Compte créé et connecté.' : emailMessage)
      } else if (mode === 'resend') {
        const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectUrl('confirm') } })
        if (error && !['user_not_found', 'email_not_found'].includes(error.code ?? '')) throw error
        setMessage(emailMessage)
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl('recovery') })
        if (error && !['user_not_found', 'email_not_found'].includes(error.code ?? '')) throw error
        setMessage(emailMessage)
      } else {
        const owner = recoveryUser.current
        const version = recoveryVersion.current
        if (!owner) throw new Error('Recovery session missing')
        await updateRecoveryPassword(owner, password, () => recoveryUser.current === owner && recoveryVersion.current === version)
        if (recoveryUser.current !== owner || recoveryVersion.current !== version) return
        recoveryUser.current = null; rememberRecovery(null); setPassword(''); setConfirmation(''); setMode('signin'); setMessage('Ton mot de passe a été modifié.')
      }
    } catch {
      if (mode !== 'recovery' || recoveryVersion.current === recoveryAttempt) setError(mode === 'signin' ? 'Connexion impossible. Vérifie tes identifiants et ta connexion, puis réessaie.' : 'La demande n’a pas abouti. Vérifie ta connexion et réessaie plus tard.')
    } finally { submitting.current = false; setBusy(false) }
  }
  const signOut = async () => {
    if (!supabase || submitting.current) return
    submitting.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      recoveryVersion.current++; recoveryUser.current = null; rememberRecovery(null); setSession(null); changeMode('signin'); setMessage('Tu es déconnecté.')
    } catch { setError('Déconnexion impossible. Vérifie ta connexion et réessaie.') }
    finally { submitting.current = false; setBusy(false) }
  }

  return <>
    <button className="account-entry" type="button" aria-expanded={open} aria-controls="account-panel" onClick={() => setOpen(value => !value)}>Mon compte</button>
    <section className="account-panel" id="account-panel" aria-labelledby="account-title" hidden={!open}>
      <div className="account-heading"><h2 id="account-title">{session && mode !== 'recovery' ? 'Mon compte' : titles[mode]}</h2><button type="button" onClick={() => setOpen(false)} aria-label="Fermer le compte">×</button></div>
      <p>Ton carnet reste sur cet appareil et n’est pas synchronisé avec ton compte.</p>
      {message && <p className="account-message" role="status">{message}</p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      {!supabase ? <p>Le compte n’est pas configuré. Tu peux continuer à utiliser le carnet local.</p> : loading ? <p role="status">Chargement du compte…</p> : session && mode !== 'recovery' ? <>
        <p>Connecté avec {session.user.email}.</p>
        <button type="button" className="account-submit" disabled={busy} onClick={() => void signOut()}>{busy ? 'Déconnexion…' : 'Se déconnecter'}</button>
      </> : <>
        <form onSubmit={submit}>
          {mode !== 'recovery' && <label>Adresse e-mail<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
          {(mode === 'signin' || mode === 'signup' || mode === 'recovery') && <label>{mode === 'recovery' ? 'Nouveau mot de passe' : 'Mot de passe'}<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={mode === 'signin' ? undefined : 6} value={password} onChange={event => setPassword(event.target.value)} /></label>}
          {(mode === 'signup' || mode === 'recovery') && <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" required minLength={6} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>}
          <button className="account-submit" type="submit" disabled={busy}>{busy ? 'En cours…' : mode === 'recovery' ? 'Enregistrer le mot de passe' : mode === 'reset' ? 'Envoyer le lien' : mode === 'resend' ? 'Renvoyer le lien' : titles[mode]}</button>
        </form>
        {mode === 'recovery' && <button className="account-cancel" type="button" disabled={busy} onClick={() => void signOut()}>Annuler et se déconnecter</button>}
        {mode !== 'recovery' && <div className="account-links">
          {mode !== 'signin' && <button type="button" disabled={busy} onClick={() => changeMode('signin')}>Se connecter</button>}
          {mode !== 'signup' && <button type="button" disabled={busy} onClick={() => changeMode('signup')}>Créer un compte</button>}
          {mode !== 'reset' && <button type="button" disabled={busy} onClick={() => changeMode('reset')}>Mot de passe oublié ?</button>}
          {mode !== 'resend' && <button type="button" disabled={busy} onClick={() => changeMode('resend')}>Renvoyer la confirmation</button>}
        </div>}
      </>}
    </section>
  </>
}
