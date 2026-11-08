import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deleteDB } from 'idb'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import Tasting from './Tasting'
import { loadStore, newTasting, saveStore } from './tastingStore'
import * as tastingStore from './tastingStore'
import { loadAccountStore } from './notebookSync'
import * as notebookSync from './notebookSync'
import { finishNotebookWrite, notebookActivity } from './notebookActivity'

const auth = vi.hoisted(() => ({ initialize: vi.fn(), subscribe: vi.fn() }))
vi.mock('./auth', () => ({ initializeAuth: auth.initialize, supabase: { auth: { onAuthStateChange: auth.subscribe } } }))
vi.mock('./notebookSync', async original => {
  const actual = await original<typeof import('./notebookSync')>()
  return { ...actual, notebookClient: () => ({}), synchronizeNotebook: vi.fn().mockRejectedValue(new Error('offline')) }
})

let listener: (event: AuthChangeEvent, session: Session | null) => void
const alice = { user: { id: 'alice' }, access_token: 'alice-token' } as Session
const bob = { user: { id: 'bob' }, access_token: 'bob-token' } as Session
beforeEach(async () => {
  await deleteDB('coffee101-notebook')
  localStorage.clear()
  auth.initialize.mockResolvedValue({ session: null, callback: null, failed: false })
  auth.subscribe.mockImplementation(callback => { listener = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks() })

it('sépare le carnet local et les comptes lors des changements de session', async () => {
  render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: /Créer ma première fiche/ }))
  fireEvent.change(screen.getByLabelText('Nom du café'), { target: { value: 'Café local' } })
  await waitFor(async () => expect((await loadStore()).drafts[0]?.name).toBe('Café local'))
  act(() => listener('SIGNED_IN', alice))
  expect(await screen.findByRole('button', { name: /Créer ma première fiche/ })).toBeVisible()
  expect(screen.queryByDisplayValue('Café local')).not.toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Créer ma première fiche/ }))
  fireEvent.change(screen.getAllByLabelText('Nom du café').find(element => !element.closest('[hidden]'))!, { target: { value: 'Café Alice' } })
  await waitFor(async () => expect((await loadAccountStore('alice')).drafts[0]?.name).toBe('Café Alice'))
  act(() => listener('SIGNED_IN', bob))
  expect(await screen.findByRole('button', { name: /Créer ma première fiche/ })).toBeVisible()
  expect(screen.queryByDisplayValue('Café Alice')).not.toBeVisible()
  act(() => listener('SIGNED_OUT', null))
  expect(await screen.findByDisplayValue('Café local')).toBeVisible()
  expect((await loadAccountStore('alice')).drafts[0].name).toBe('Café Alice')
})

it('ignore une initialisation tardive après un changement de session', async () => {
  let resolve!: (value: { session: null; callback: null; failed: false }) => void
  auth.initialize.mockReturnValue(new Promise(res => { resolve = res }))
  render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
  act(() => listener('SIGNED_IN', alice))
  expect(await screen.findByRole('button', { name: /Créer ma première fiche/ })).toBeVisible()
  await act(async () => resolve({ session: null, callback: null, failed: false }))
  fireEvent.click(screen.getByRole('button', { name: /Créer ma première fiche/ }))
  fireEvent.change(screen.getAllByLabelText('Nom du café').find(element => !element.closest('[hidden]'))!, { target: { value: 'Compte Alice' } })
  await waitFor(async () => expect((await loadAccountStore('alice')).drafts[0]?.name).toBe('Compte Alice'))
  expect((await loadStore()).drafts).toHaveLength(0)
})

it('masque le carnet du compte expiré même si une ancienne initialisation le retourne', async () => {
  let resolve!: (value: { session: Session | null; callback: null; failed: false }) => void
  auth.initialize.mockReturnValue(new Promise(res => { resolve = res }))
  render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
  act(() => listener('SIGNED_IN', alice))
  fireEvent.click(await screen.findByRole('button', { name: /Créer ma première fiche/ }))
  fireEvent.change(screen.getByLabelText('Nom du café'), { target: { value: 'Notes privées' } })
  await waitFor(async () => expect((await loadAccountStore('alice')).drafts[0]?.name).toBe('Notes privées'))
  act(() => listener('SIGNED_OUT', null))
  expect(await screen.findByText(/Carnet local, non synchronisé/)).toBeVisible()
  expect(screen.getByDisplayValue('Notes privées')).not.toBeVisible()
  await act(async () => resolve({ session: alice, callback: null, failed: false }))
  expect(screen.getByDisplayValue('Notes privées')).not.toBeVisible()
  expect((await loadAccountStore('alice')).drafts[0]?.name).toBe('Notes privées')
})

it('ne copie le carnet local qu’après accord et conserve les liens entre copies', async () => {
  const record = { ...newTasting(), name: 'Fiche locale' }
  const draft = { ...record, id: crypto.randomUUID(), editOf: record.id, editBase: JSON.stringify(record), name: 'Brouillon local' }
  const guest = { version: 1 as const, drafts: [draft], records: [record] }
  await saveStore(guest)
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
  await screen.findByText(/Carnet local, non synchronisé/)
  act(() => listener('SIGNED_IN', alice))
  await screen.findByRole('button', { name: /Créer ma première fiche/ })
  expect((await loadAccountStore('alice')).records).toHaveLength(0)
  fireEvent.click(screen.getAllByText('Mon carnet').find(element => !element.closest('[hidden]'))!)
  fireEvent.click(screen.getByRole('button', { name: 'Copier le carnet local dans ce compte' }))
  expect((await loadAccountStore('alice')).records).toHaveLength(0)
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Copier le carnet local dans ce compte' }))
  await waitFor(async () => expect((await loadAccountStore('alice')).records).toHaveLength(1))
  const account = await loadAccountStore('alice')
  expect(account.records[0].id).not.toBe(record.id)
  expect(account.drafts[0].id).not.toBe(draft.id)
  expect(account.drafts[0].editOf).toBe(account.records[0].id)
  expect(account.drafts[0].editBase).toBe(JSON.stringify(account.records[0]))
  expect(await loadStore()).toEqual(guest)
  confirm.mockRestore()
})

it('conserve le brouillon du compte lors de la finalisation pour éviter une suppression distante prématurée', async () => {
  const draft = { ...newTasting(), name: 'Fiche à enregistrer', notes: 'À préserver' }
  await notebookSync.saveAccountStore('alice', { version: 1, drafts: [], records: [] }, { version: 1, drafts: [draft], records: [] })
  render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
  act(() => listener('SIGNED_IN', alice))
  fireEvent.click(await screen.findByRole('button', { name: /Reprendre : Fiche à enregistrer/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma fiche' }))
  expect(await screen.findByText(/Le brouillon reste disponible par précaution/)).toBeVisible()
  const stored = await loadAccountStore('alice')
  expect(stored.drafts).toHaveLength(1)
  expect(stored.records).toHaveLength(1)
  expect(stored.records[0].id).not.toBe(draft.id)
  expect(stored.records[0].notes).toBe('À préserver')
  expect(stored.drafts[0].editOf).toBe(stored.records[0].id)
  expect(stored.drafts[0].editBase).toBe(JSON.stringify(stored.records[0]))
})

it('ne remplace pas une fiche si la création d’identifiant rencontre une collision', async () => {
  const draft = { ...newTasting(), name: 'Brouillon' }
  const record = { ...newTasting(), name: 'Fiche existante' }
  await notebookSync.saveAccountStore('alice', { version: 1, drafts: [], records: [] }, { version: 1, drafts: [draft], records: [record] })
  render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
  act(() => listener('SIGNED_IN', alice))
  fireEvent.click(await screen.findByRole('button', { name: /Reprendre : Brouillon/ }))
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(record.id as ReturnType<typeof crypto.randomUUID>)
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma fiche' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('sans risque de doublon')
  const stored = await loadAccountStore('alice')
  expect(stored.drafts[0].name).toBe('Brouillon')
  expect(stored.records[0].name).toBe('Fiche existante')
})

it('annule une copie locale différée après un changement de session aller-retour', async () => {
  const record = newTasting()
  await saveStore({ version: 1, drafts: [], records: [record] })
  render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
  await screen.findByText(/Carnet local, non synchronisé/)
  act(() => listener('SIGNED_IN', alice))
  await screen.findByRole('button', { name: /Créer ma première fiche/ })
  fireEvent.click(screen.getAllByText('Mon carnet').find(element => !element.closest('[hidden]'))!)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  let release!: (value: tastingStore.TastingStore) => void
  vi.spyOn(tastingStore, 'loadStore').mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'Copier le carnet local dans ce compte' }))
  act(() => { listener('SIGNED_IN', bob); listener('SIGNED_IN', alice) })
  await act(async () => release({ version: 1, drafts: [], records: [record] }))
  expect((await loadAccountStore('alice')).records).toHaveLength(0)
})

it('présente séparément la version locale et la version supprimée du compte', async () => {
  const record = newTasting()
  const local = { schema: 'coffee101.tasting' as const, version: 1 as const, kind: 'record' as const, record: { ...record, notes: 'Note locale' } }
  const remote = { ...local, record: { ...record, notes: 'Note du compte' } }
  const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} })
  vi.mocked(notebookSync.synchronizeNotebook).mockResolvedValue({ pending: 1, conflicts: 1, unsupported: 0 })
  vi.spyOn(notebookSync, 'loadNotebookConflicts').mockResolvedValue([{ id: 'conflit', local: { choices: local, deleted: false }, remote: { recipe_id: 'conflit', choices: remote, deleted: true, version: 2, last_operation: null }, remoteRecognized: true }])
  try {
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    act(() => listener('SIGNED_IN', alice))
    expect(await screen.findByRole('heading', { name: 'Comparer les versions' })).toBeVisible()
    fireEvent.click(screen.getByText('Conflit 1'))
    expect(screen.getByText('Version locale · fiche')).toBeVisible()
    expect(screen.getByText('Version du compte · suppression')).toBeVisible()
    expect(screen.getByText('Note locale')).toBeVisible()
    expect(screen.getByText('Note du compte')).toBeVisible()
  } finally {
    vi.mocked(notebookSync.synchronizeNotebook).mockRejectedValue(new Error('offline'))
    if (locks) Object.defineProperty(navigator, 'locks', locks)
    else Reflect.deleteProperty(navigator, 'locks')
  }
})

it('déclenche la synchronisation même hors de la page Déguster', async () => {
  const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} })
  const synchronize = vi.mocked(notebookSync.synchronizeNotebook)
  synchronize.mockResolvedValue({ pending: 0, conflicts: 0, unsupported: 0 })
  try {
    render(<Tasting active={false} proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    act(() => listener('SIGNED_IN', alice))
    await waitFor(() => expect(synchronize).toHaveBeenCalled())
    const calls = synchronize.mock.calls.length
    fireEvent.focus(window)
    await waitFor(() => expect(synchronize.mock.calls.length).toBeGreaterThan(calls))
  } finally {
    synchronize.mockRejectedValue(new Error('offline'))
    if (locks) Object.defineProperty(navigator, 'locks', locks)
    else Reflect.deleteProperty(navigator, 'locks')
  }
})

it('retire immédiatement le message de synchronisation avant la fin d’une écriture locale', async () => {
  const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} })
  const synchronize = vi.mocked(notebookSync.synchronizeNotebook)
  synchronize.mockResolvedValue({ pending: 0, conflicts: 0, unsupported: 0 })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const save = notebookSync.saveAccountStore
  vi.spyOn(notebookSync, 'saveAccountStore').mockImplementationOnce(async (...args) => { await gate; return save(...args) })
  try {
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    act(() => listener('SIGNED_IN', alice))
    expect(await screen.findByText(/Lecture du compte terminée/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Créer ma première fiche/ }))
    expect(screen.getByText(/Modification en cours d’enregistrement ou en attente de synchronisation/)).toBeVisible()
    expect(screen.queryByText(/Lecture du compte terminée/)).not.toBeInTheDocument()
    await act(async () => release())
    await waitFor(async () => expect((await loadAccountStore('alice')).drafts).toHaveLength(1))
    await waitFor(() => expect(notebookActivity('alice').pending).toBe(0))
  } finally {
    synchronize.mockRejectedValue(new Error('offline'))
    if (locks) Object.defineProperty(navigator, 'locks', locks)
    else Reflect.deleteProperty(navigator, 'locks')
  }
})

it('ne réaffiche pas un ancien succès après une modification encore en cours', async () => {
  const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} })
  const synchronize = vi.mocked(notebookSync.synchronizeNotebook)
  let releaseSync!: (value: notebookSync.SyncResult) => void
  synchronize.mockReturnValueOnce(new Promise(resolve => { releaseSync = resolve })).mockResolvedValue({ pending: 0, conflicts: 0, unsupported: 0 })
  let releaseSave!: () => void
  const gate = new Promise<void>(resolve => { releaseSave = resolve })
  const save = notebookSync.saveAccountStore
  vi.spyOn(notebookSync, 'saveAccountStore').mockImplementationOnce(async (...args) => { await gate; return save(...args) })
  try {
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    act(() => listener('SIGNED_IN', alice))
    fireEvent.click(await screen.findByRole('button', { name: /Créer ma première fiche/ }))
    await act(async () => releaseSync({ pending: 0, conflicts: 0, unsupported: 0 }))
    expect(screen.getByText(/Modification en cours d’enregistrement ou en attente de synchronisation/)).toBeVisible()
    expect(screen.queryByText(/Lecture du compte terminée/)).not.toBeInTheDocument()
    await act(async () => releaseSave())
    await waitFor(async () => expect((await loadAccountStore('alice')).drafts).toHaveLength(1))
    await waitFor(() => expect(notebookActivity('alice').pending).toBe(0))
  } finally {
    synchronize.mockRejectedValue(new Error('offline'))
    if (locks) Object.defineProperty(navigator, 'locks', locks)
    else Reflect.deleteProperty(navigator, 'locks')
  }
})

it('ne remplace pas un brouillon non enregistré par une lecture terminée plus tard', async () => {
  const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} })
  let release!: (value: notebookSync.SyncResult) => void
  const synchronize = vi.mocked(notebookSync.synchronizeNotebook)
  synchronize.mockReturnValue(new Promise(resolve => { release = resolve }))
  vi.spyOn(notebookSync, 'saveAccountStore').mockRejectedValueOnce(new Error('stockage indisponible'))
  try {
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    act(() => listener('SIGNED_IN', alice))
    fireEvent.click(await screen.findByRole('button', { name: /Créer ma première fiche/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible')
    fireEvent.change(screen.getByLabelText('Nom du café'), { target: { value: 'À conserver' } })
    await act(async () => release({ pending: 0, conflicts: 0, unsupported: 0 }))
    expect(screen.getByLabelText('Nom du café')).toHaveValue('À conserver')
    await waitFor(() => expect(notebookActivity('alice').pending).toBe(0))
  } finally {
    finishNotebookWrite('alice', true)
    synchronize.mockRejectedValue(new Error('offline'))
    if (locks) Object.defineProperty(navigator, 'locks', locks)
    else Reflect.deleteProperty(navigator, 'locks')
  }
})

it('garde le brouillon affiché après un conflit de transaction avec un autre onglet', async () => {
  const locks = Object.getOwnPropertyDescriptor(navigator, 'locks')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} })
  let release!: (value: notebookSync.SyncResult) => void
  const synchronize = vi.mocked(notebookSync.synchronizeNotebook)
  synchronize.mockReturnValue(new Promise(resolve => { release = resolve }))
  const draft = { ...newTasting(), name: 'Version précédente' }
  const original = { version: 1 as const, drafts: [draft], records: [] }
  await notebookSync.saveAccountStore('alice', { version: 1, drafts: [], records: [] }, original)
  try {
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    act(() => listener('SIGNED_IN', alice))
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre : Version précédente/ }))
    const changed = { ...original, drafts: [{ ...draft, name: 'Autre onglet' }] }
    await notebookSync.saveAccountStore('alice', original, changed)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma fiche' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('autre onglet')
    await act(async () => release({ pending: 0, conflicts: 0, unsupported: 0 }))
    expect(screen.getByLabelText('Nom du café')).toHaveValue('Version précédente')
    expect((await loadAccountStore('alice')).drafts[0].name).toBe('Autre onglet')
  } finally {
    finishNotebookWrite('alice', true)
    synchronize.mockRejectedValue(new Error('offline'))
    if (locks) Object.defineProperty(navigator, 'locks', locks)
    else Reflect.deleteProperty(navigator, 'locks')
  }
})
