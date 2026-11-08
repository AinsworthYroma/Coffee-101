import { expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), unsubscribe: vi.fn() }))
vi.mock('./auth', () => ({ supabase: { auth: { onAuthStateChange: mocks.subscribe } } }))
import { observeAuth } from './sharedAuth'

it('partage la même souscription et transmet la session courante aux nouveaux observateurs', () => {
  let emit!: (event: AuthChangeEvent, session: Session | null) => void
  mocks.subscribe.mockImplementation(listener => { emit = listener; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } } })
  const first = vi.fn()
  const second = vi.fn()
  const unsubscribeFirst = observeAuth(first)
  const session = { user: { id: 'alice' } } as Session
  emit('SIGNED_IN', session)
  const unsubscribeSecond = observeAuth(second)
  expect(mocks.subscribe).toHaveBeenCalledTimes(1)
  expect(first).toHaveBeenCalledWith('SIGNED_IN', session)
  expect(second).toHaveBeenCalledWith('SIGNED_IN', session)
  emit('SIGNED_OUT', null)
  expect(first).toHaveBeenLastCalledWith('SIGNED_OUT', null)
  expect(second).toHaveBeenLastCalledWith('SIGNED_OUT', null)
  unsubscribeFirst()
  expect(mocks.unsubscribe).not.toHaveBeenCalled()
  unsubscribeSecond()
  expect(mocks.unsubscribe).toHaveBeenCalledTimes(1)
})
