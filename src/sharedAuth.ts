import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js'
import { supabase } from './auth'
import { beginNotebookSession } from './notebookActivity'

type Listener = (event: AuthChangeEvent, session: Session | null) => void
const listeners = new Set<Listener>()
let upstream: Subscription | undefined
let latest: { event: AuthChangeEvent; session: Session | null } | undefined

// Account and notebook observe the same SDK subscription and session events.
export function observeAuth(listener: Listener): () => void {
  listeners.add(listener)
  if (!upstream && supabase) {
    upstream = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || latest?.session?.user.id !== session.user.id)) beginNotebookSession(session.user.id)
      latest = { event, session }
      for (const subscriber of [...listeners]) subscriber(event, session)
    }).data.subscription
  } else if (latest) {
    listener(latest.event, latest.session)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      upstream?.unsubscribe()
      upstream = undefined
      latest = undefined
    }
  }
}
