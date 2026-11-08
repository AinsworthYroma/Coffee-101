import 'fake-indexeddb/auto'
import { deleteDB, openDB } from 'idb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAccountStore, loadNotebookConflicts, notebookClient, resolveNotebookConflicts, saveAccountStore, synchronizeNotebook } from './notebookSync'
import { newTasting, type TastingStore } from './tastingStore'
import { beginNotebookSession, notebookActivity } from './notebookActivity'
import { initialChoices, makeRecipe } from './recipes'

const blank = (): TastingStore => ({ version: 1, drafts: [], records: [] })
function deferred() {
  let release!: () => void
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}
async function snapshotAccount(owner: string): Promise<unknown> {
  const db = await openDB('coffee101-notebook', 1)
  try { return await db.get('notebook', `account:${owner}`) } finally { db.close() }
}
async function restoreAccount(owner: string, snapshot: unknown) {
  await deleteDB('coffee101-notebook')
  const db = await openDB('coffee101-notebook', 1, { upgrade(database) { database.createObjectStore('notebook') } })
  try { await db.put('notebook', snapshot, `account:${owner}`) } finally { db.close() }
}
type Row = { recipe_id: string; user_id: string; choices: unknown; deleted: boolean; version: number; last_operation: string | null }
function server() {
  const rows: Row[] = []
  let loseResponse = false
  let pageLimit = 500
  const operations: string[] = []
  const clientFor = (authenticatedOwner: string) => ({
    from: () => ({ select: () => ({ eq: (_field: string, requestedOwner: string) => ({ order: () => {
      let cursor: string | undefined
      const query = {
        gt: (_field: string, value: string) => { cursor = value; return query },
        range: async (start: number, end: number) => ({ data: structuredClone(rows.filter(row => row.user_id === authenticatedOwner && row.user_id === requestedOwner && (cursor === undefined || row.recipe_id > cursor)).sort((a, b) => a.recipe_id < b.recipe_id ? -1 : a.recipe_id > b.recipe_id ? 1 : 0).slice(start, Math.min(end + 1, start + pageLimit))), error: null }),
      }
      return query
    } }) }) }),
    rpc: async (_name: string, args: { p_recipe_id: string; p_choices: unknown; p_deleted: boolean; p_version: number; p_operation: string }) => {
      operations.push(args.p_operation)
      if (!authenticatedOwner || !args.p_recipe_id || args.p_recipe_id.length > 200 ||
          !args.p_choices || typeof args.p_choices !== 'object' || Array.isArray(args.p_choices) ||
          typeof args.p_deleted !== 'boolean' || !Number.isInteger(args.p_version) || args.p_version < 0 ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args.p_operation)) {
        return { data: null, error: new Error('Invalid RPC arguments') }
      }
      let row = rows.find(item => item.recipe_id === args.p_recipe_id && item.user_id === authenticatedOwner)
      if (!row) { row = { recipe_id: args.p_recipe_id, user_id: authenticatedOwner, choices: structuredClone(args.p_choices), deleted: true, version: 0, last_operation: null }; rows.push(row) }
      if (row.last_operation === args.p_operation) return { data: { applied: true, version: row.version }, error: null }
      if (row.version !== args.p_version) return { data: { applied: false, version: row.version }, error: null }
      row.choices = structuredClone(args.p_choices); row.deleted = args.p_deleted; row.version++; row.last_operation = args.p_operation
      if (loseResponse) { loseResponse = false; return { data: null, error: new Error('offline') } }
      return { data: { applied: true, version: row.version }, error: null }
    },
  }) as unknown as SupabaseClient
  return { client: clientFor('alice'), clientFor, rows, operations, lose: () => { loseResponse = true }, limit: (size: number) => { pageLimit = size } }
}
beforeEach(async () => {
  await deleteDB('coffee101-notebook')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, fn: () => Promise<unknown>) => fn() } })
})
describe('synchronisation du carnet', () => {
  it('modélise les comptes autorisés séparément, même avec le même identifiant de recette', async () => {
    const api = server()
    const record = newTasting()
    const aliceData = { ...blank(), records: [{ ...record, notes: 'Alice' }] }
    const bobData = { ...blank(), records: [{ ...record, notes: 'Bob' }] }
    await saveAccountStore('alice', blank(), aliceData)
    await saveAccountStore('bob', blank(), bobData)
    await synchronizeNotebook('alice', api.client, () => true)
    await synchronizeNotebook('bob', api.clientFor('bob'), () => true)
    expect(api.rows).toHaveLength(2)
    expect(api.rows[0].recipe_id).toBe(api.rows[1].recipe_id)
    expect(api.rows.map(row => row.user_id).sort()).toEqual(['alice', 'bob'])
    const { data } = await api.clientFor('bob').from('saved_recipes').select().eq('user_id', 'alice').order('recipe_id').range(0, 10)
    expect(data).toEqual([])
    await deleteDB('coffee101-notebook')
    await synchronizeNotebook('bob', api.clientFor('bob'), () => true)
    expect(await loadAccountStore('bob')).toEqual(bobData)
    expect(await loadAccountStore('alice')).toEqual(blank())
  })
  it('modélise la déduplication de la seule dernière opération, avant le contrôle de version', async () => {
    const api = server()
    const operation = crypto.randomUUID()
    const newer = crypto.randomUUID()
    const initial = { p_recipe_id: 'test', p_choices: { notes: 'première' }, p_deleted: false, p_version: 0, p_operation: operation }
    expect((await api.client.rpc('apply_recipe_change', initial)).data).toEqual({ applied: true, version: 1 })
    expect((await api.client.rpc('apply_recipe_change', { ...initial, p_choices: { notes: 'différente' }, p_version: 99 })).data).toEqual({ applied: true, version: 1 })
    expect(api.rows[0].choices).toEqual({ notes: 'première' })
    expect((await api.client.rpc('apply_recipe_change', { ...initial, p_choices: { notes: 'suivante' }, p_version: 1, p_operation: newer })).data).toEqual({ applied: true, version: 2 })
    expect((await api.client.rpc('apply_recipe_change', initial)).data).toEqual({ applied: false, version: 2 })
    expect(api.rows[0].choices).toEqual({ notes: 'suivante' })
    expect((await api.client.rpc('apply_recipe_change', { ...initial, p_recipe_id: 'nouveau', p_version: 3, p_operation: crypto.randomUUID() })).data).toEqual({ applied: false, version: 0 })
    expect(api.rows[1]).toMatchObject({ recipe_id: 'nouveau', choices: initial.p_choices, deleted: true, version: 0, last_operation: null })
  })
  it('restaure sur un second appareil la fiche et le brouillon complets avec recette et arômes', async () => {
    const api = server()
    const choices = { ...initialChoices, method: 'aeropress' as const }
    const recipe = makeRecipe(choices)
    const proposal = { choices, recipe, parameters: recipe.parameters, methodName: 'AeroPress' }
    const record = {
      ...newTasting(proposal), date: '2026-01-02', name: 'Café', roaster: 'Torréfacteur', country: 'Pays', region: 'Région',
      altitude: '1 200 m', processing: 'Autre', processingOther: 'Précision', fermentation: 'Lente', roast: 'Moyenne',
      notes: 'Notes détaillées', actual: '13 g', acidity: 'Vive', bitterness: 'Légère', sweetness: 'Douce',
      body: 'Rond', finish: 'Longue', appreciation: 'Aimé', nextTime: 'Changer la dose',
      aromas: [{ id: 'fruite', label: 'Fruité' }, { id: 'libre', label: 'Ma nuance' }],
    }
    const draft = { ...structuredClone(record), id: crypto.randomUUID(), editOf: record.id, editBase: JSON.stringify(record), name: 'Brouillon' }
    const data = { version: 1 as const, drafts: [draft], records: [record] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    await deleteDB('coffee101-notebook')
    await synchronizeNotebook('alice', api.client, () => true)
    expect(await loadAccountStore('alice')).toEqual(data)
  })
  it('détecte le conflit d’un appareil resté hors ligne après édition sur un second appareil', async () => {
    const api = server()
    const record = newTasting()
    const original = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), original)
    await synchronizeNotebook('alice', api.client, () => true)
    const deviceA = await snapshotAccount('alice')
    await deleteDB('coffee101-notebook')
    await synchronizeNotebook('alice', api.client, () => true)
    const remoteEdit = { ...blank(), records: [{ ...record, notes: 'Deuxième appareil' }] }
    await saveAccountStore('alice', original, remoteEdit)
    await synchronizeNotebook('alice', api.client, () => true)
    await restoreAccount('alice', deviceA)
    const offlineEdit = { ...blank(), records: [{ ...record, notes: 'Premier appareil hors ligne' }] }
    await saveAccountStore('alice', original, offlineEdit)
    expect((await synchronizeNotebook('alice', api.client, () => true)).conflicts).toBe(1)
    expect(await loadAccountStore('alice')).toEqual(offlineEdit)
    expect((api.rows[0].choices as { record: typeof record }).record.notes).toBe('Deuxième appareil')
    const resolved = await resolveNotebookConflicts('alice', api.client, () => true)
    expect(resolved.records.map(item => item.notes).sort()).toEqual(['Deuxième appareil', 'Premier appareil hors ligne'])
  })
  it('garde la file hors ligne et l’envoie après rétablissement de la connexion', async () => {
    const api = server()
    const data = { ...blank(), drafts: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    const offline = { ...api.client, from: () => { throw new Error('offline') } } as unknown as SupabaseClient
    await expect(synchronizeNotebook('alice', offline, () => true)).rejects.toThrow()
    expect(await loadAccountStore('alice')).toEqual(data)
    expect((await synchronizeNotebook('alice', api.client, () => true)).pending).toBe(0)
    expect(api.rows).toHaveLength(1)
  })
  it('ne confirme pas l’envoi à partir d’une lecture seule', async () => {
    const api = server()
    beginNotebookSession('alice')
    await synchronizeNotebook('alice', api.client, () => true)
    expect(notebookActivity('alice').acknowledged).toBe(false)
    await saveAccountStore('alice', blank(), { ...blank(), records: [newTasting()] })
    await synchronizeNotebook('alice', api.client, () => true)
    expect(notebookActivity('alice').acknowledged).toBe(true)
  })
  it('isole les comptes, détecte les écritures concurrentes et conserve les suppressions', async () => {
    const api = server()
    const draft = newTasting()
    const data: TastingStore = { ...blank(), drafts: [draft] }
    await saveAccountStore('alice', blank(), data)
    await expect(saveAccountStore('alice', blank(), blank())).rejects.toThrow()
    expect(await loadAccountStore('bob')).toEqual(blank())
    expect(await synchronizeNotebook('alice', api.client, () => true)).toEqual({ pending: 0, conflicts: 0, unsupported: 0 })
    expect(api.rows[0].deleted).toBe(false)
    await saveAccountStore('alice', data, blank())
    await synchronizeNotebook('alice', api.client, () => true)
    expect(api.rows[0].deleted).toBe(true)
    expect(api.rows[0].version).toBe(2)
  })
  it('conserve les identifiants importés arbitraires tout en bornant l’identifiant distant', async () => {
    const api = server()
    const record = { ...newTasting(), id: `café/${'x'.repeat(300)}` }
    const data = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    expect(api.rows[0].recipe_id.length).toBeLessThanOrEqual(200)
    expect((api.rows[0].choices as { record: typeof record }).record.id).toBe(record.id)
    await deleteDB('coffee101-notebook')
    await synchronizeNotebook('alice', api.client, () => true)
    expect(await loadAccountStore('alice')).toEqual(data)
  })
  it('distingue les identifiants contenant des demi-surrogates isolés', async () => {
    const api = server()
    const data = { ...blank(), records: [{ ...newTasting(), id: '\ud800' }, { ...newTasting(), id: '\udc00' }] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    expect(api.rows).toHaveLength(2)
    expect(api.rows[0].recipe_id).not.toBe(api.rows[1].recipe_id)
  })
  it('bloque une collision de hachage sans écraser les données', async () => {
    const digest = vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(new Uint8Array(32).buffer)
    try {
      const api = server()
      const first = { ...blank(), records: [{ ...newTasting(), id: 'premier' }] }
      const other = { ...blank(), records: [{ ...newTasting(), id: 'autre' }] }
      await saveAccountStore('alice', blank(), first)
      await synchronizeNotebook('alice', api.client, () => true)
      await expect(saveAccountStore('alice', first, other)).rejects.toThrow()
      expect(await loadAccountStore('alice')).toEqual(first)
      await deleteDB('coffee101-notebook')
      await saveAccountStore('alice', blank(), other)
      expect((await synchronizeNotebook('alice', api.client, () => true)).conflicts).toBe(1)
      expect(api.operations).toHaveLength(1)
      expect((api.rows[0].choices as { record: { id: string } }).record.id).toBe('premier')
      expect(await loadAccountStore('alice')).toEqual(other)
    } finally { digest.mockRestore() }
  })
  it('reconnaît une réponse perdue sans renvoyer une opération appliquée', async () => {
    const api = server()
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    api.lose()
    await expect(synchronizeNotebook('alice', api.client, () => true)).rejects.toThrow()
    const result = await synchronizeNotebook('alice', api.client, () => true)
    expect(result.pending).toBe(0)
    expect(api.operations).toHaveLength(1)
  })
  it('confirme une mutation par lecture même si les champs de succès ne sont pas connus', async () => {
    const api = server()
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    const client = {
      ...api.client,
      rpc: async (...args: Parameters<SupabaseClient['rpc']>) => {
        const result = await api.client.rpc(...args)
        return { data: {}, error: result.error }
      },
    } as unknown as SupabaseClient
    expect((await synchronizeNotebook('alice', client, () => true)).pending).toBe(0)
    expect(api.rows).toHaveLength(1)
  })
  it('ne confirme pas un succès annoncé si la ligne ne prouve pas l’opération', async () => {
    const api = server()
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    const client = { ...api.client, rpc: async () => ({ data: { applied: true, version: 1 }, error: null }) } as unknown as SupabaseClient
    const result = await synchronizeNotebook('alice', client, () => true)
    expect(result.pending).toBe(1)
    expect(result.conflicts).toBe(1)
    expect(await loadAccountStore('alice')).toEqual(data)
  })
  it('ne déduit pas un succès si la dernière opération a un contenu différent', async () => {
    const api = server()
    const record = newTasting()
    const data = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), data)
    api.lose()
    await expect(synchronizeNotebook('alice', api.client, () => true)).rejects.toThrow()
    const choices = api.rows[0].choices as { record: typeof record }
    choices.record.notes = 'Autre contenu'
    const result = await synchronizeNotebook('alice', api.client, () => true)
    expect(result.pending).toBe(1)
    expect(result.conflicts).toBe(1)
    expect(await loadAccountStore('alice')).toEqual(data)
  })
  it('reconnaît une réponse perdue après suppression sans ressusciter la fiche', async () => {
    const api = server()
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    await saveAccountStore('alice', data, blank())
    api.lose()
    await expect(synchronizeNotebook('alice', api.client, () => true)).rejects.toThrow()
    expect(api.rows[0].deleted).toBe(true)
    expect((await synchronizeNotebook('alice', api.client, () => true)).pending).toBe(0)
    expect(api.rows[0].version).toBe(2)
    expect(api.operations).toHaveLength(2)
  })
  it('retrouve l’opération si la persistance de son accusé échoue', async () => {
    const api = server()
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    let fail = false
    const put = IDBObjectStore.prototype.put
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (fail && key === 'account:alice') throw new Error('Stockage indisponible')
      return put.call(this, value, key)
    })
    const client = {
      ...api.client,
      rpc: async (...args: Parameters<SupabaseClient['rpc']>) => {
        const result = await api.client.rpc(...args)
        fail = true
        return result
      },
    } as unknown as SupabaseClient
    try { await expect(synchronizeNotebook('alice', client, () => true)).rejects.toThrow() }
    finally { spy.mockRestore() }
    expect(api.rows).toHaveLength(1)
    expect((await synchronizeNotebook('alice', api.client, () => true)).pending).toBe(0)
    expect(api.operations).toHaveLength(1)
    expect(await loadAccountStore('alice')).toEqual(data)
  })
  it('conserve une édition faite pendant un envoi et confirme chaque opération séparément', async () => {
    const api = server()
    const gate = deferred()
    const entered = deferred()
    let first = true
    const client = {
      ...api.client,
      rpc: async (...args: Parameters<SupabaseClient['rpc']>) => {
        if (first) { first = false; entered.release(); await gate.promise }
        return api.client.rpc(...args)
      },
    } as unknown as SupabaseClient
    const record = newTasting()
    const before = { ...blank(), drafts: [record] }
    const after = { ...blank(), drafts: [{ ...record, notes: 'Nouvelle édition' }] }
    await saveAccountStore('alice', blank(), before)
    const sync = synchronizeNotebook('alice', client, () => true)
    await entered.promise
    await saveAccountStore('alice', before, after)
    gate.release()
    expect((await sync).pending).toBe(0)
    expect(api.operations).toHaveLength(2)
    expect((api.rows[0].choices as { record: typeof record }).record.notes).toBe('Nouvelle édition')
    expect(await loadAccountStore('alice')).toEqual(after)
  })
  it('conserve l’opération si la session change pendant un envoi déjà appliqué', async () => {
    const api = server()
    const gate = deferred()
    const entered = deferred()
    let active = true
    const client = {
      ...api.client,
      rpc: async (...args: Parameters<SupabaseClient['rpc']>) => {
        const result = await api.client.rpc(...args)
        entered.release()
        await gate.promise
        return result
      },
    } as unknown as SupabaseClient
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    const sync = synchronizeNotebook('alice', client, () => active)
    await entered.promise
    active = false
    gate.release()
    await expect(sync).rejects.toThrow()
    expect(await loadAccountStore('alice')).toEqual(data)
    expect((await synchronizeNotebook('alice', api.client, () => true)).pending).toBe(0)
    expect(api.operations).toHaveLength(1)
  })
  it('ne remplace pas une édition locale effectuée pendant une lecture distante', async () => {
    const api = server()
    const record = newTasting()
    const initial = { ...blank(), drafts: [record] }
    await saveAccountStore('alice', blank(), initial)
    await synchronizeNotebook('alice', api.client, () => true)
    await deleteDB('coffee101-notebook')
    const entered = deferred()
    const gate = deferred()
    const client = {
      ...api.client,
      from: () => ({ select: () => ({ eq: () => ({ order: () => ({
        range: async () => { entered.release(); await gate.promise; return { data: api.rows, error: null } },
        gt: () => ({ range: async () => ({ data: [], error: null }) }),
      }) }) }) }),
    } as unknown as SupabaseClient
    const sync = synchronizeNotebook('alice', client, () => true)
    await entered.promise
    const local = { ...blank(), drafts: [{ ...record, notes: 'Pendant la lecture' }] }
    await saveAccountStore('alice', blank(), local)
    gate.release()
    expect((await sync).conflicts).toBe(1)
    expect(await loadAccountStore('alice')).toEqual(local)
  })
  it('signale un conflit après une réponse perdue suivie d’une modification distante', async () => {
    const api = server()
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    api.lose()
    await expect(synchronizeNotebook('alice', api.client, () => true)).rejects.toThrow()
    api.rows[0].version++; api.rows[0].last_operation = crypto.randomUUID()
    const result = await synchronizeNotebook('alice', api.client, () => true)
    expect(result.conflicts).toBe(1)
    expect(result.pending).toBe(1)
    expect(api.operations).toHaveLength(1)
    expect(await loadAccountStore('alice')).toEqual(data)
  })
  it('conserve les modifications suivantes quand une réponse a été perdue', async () => {
    const api = server()
    const record = newTasting()
    const first = { ...blank(), drafts: [record] }
    await saveAccountStore('alice', blank(), first)
    api.lose()
    await expect(synchronizeNotebook('alice', api.client, () => true)).rejects.toThrow()
    const next = { ...blank(), drafts: [{ ...record, notes: 'Suite' }] }
    await saveAccountStore('alice', first, next)
    expect((await synchronizeNotebook('alice', api.client, () => true)).pending).toBe(0)
    expect(api.rows[0].version).toBe(2)
    expect((api.rows[0].choices as { record: { notes: string } }).record.notes).toBe('Suite')
  })
  it('importe les données reconnues sans modifier les données inconnues', async () => {
    const api = server()
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    api.rows.push({ recipe_id: 'other', user_id: 'alice', choices: { future: true }, deleted: false, version: 1, last_operation: crypto.randomUUID() })
    await saveAccountStore('alice', data, blank())
    await synchronizeNotebook('alice', api.client, () => true)
    expect(api.rows[1].choices).toEqual({ future: true })
  })
  it('restaure un compte sur un nouvel appareil et conserve les données non prises en charge', async () => {
    const api = server()
    const data = { ...blank(), drafts: [newTasting()], records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    api.rows.push({ recipe_id: `coffee101:tasting:v1:${'0'.repeat(64)}`, user_id: 'alice', choices: { schema: 'coffee101.tasting', version: 2 }, deleted: false, version: 1, last_operation: crypto.randomUUID() })
    await deleteDB('coffee101-notebook')
    const result = await synchronizeNotebook('alice', api.client, () => true)
    expect(result.unsupported).toBe(1)
    expect(await loadAccountStore('alice')).toEqual(data)
    expect(api.rows[2].choices).toEqual({ schema: 'coffee101.tasting', version: 2 })
  })
  it('lit toutes les pages même si le serveur impose une limite inférieure à la taille demandée', async () => {
    const api = server()
    const data = { ...blank(), records: [newTasting()] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    for (let index = 0; index < 1100; index++) api.rows.push({ recipe_id: `aaa-${String(index).padStart(4, '0')}`, user_id: 'alice', choices: {}, deleted: false, version: 1, last_operation: crypto.randomUUID() })
    api.rows.push({ recipe_id: 'aaa-other-owner', user_id: 'bob', choices: {}, deleted: false, version: 1, last_operation: crypto.randomUUID() })
    api.limit(113)
    await deleteDB('coffee101-notebook')
    expect((await synchronizeNotebook('alice', api.client, () => true)).pending).toBe(0)
    expect(await loadAccountStore('alice')).toEqual(data)
  })
  it('bloque une modification locale si le format distant de cet identifiant est inconnu', async () => {
    const api = server()
    const record = newTasting()
    const first = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), first)
    await synchronizeNotebook('alice', api.client, () => true)
    const edited = { ...blank(), records: [{ ...record, notes: 'local' }] }
    await saveAccountStore('alice', first, edited)
    api.rows[0].choices = { schema: 'coffee101.tasting', version: 2 }
    api.rows[0].version++
    const result = await synchronizeNotebook('alice', api.client, () => true)
    expect(result.unsupported).toBe(1)
    expect(result.conflicts).toBe(1)
    expect(api.operations).toHaveLength(1)
    expect(api.rows[0].choices).toEqual({ schema: 'coffee101.tasting', version: 2 })
    expect(await loadAccountStore('alice')).toEqual(edited)
  })
  it('conserve une entrée technique distante de version zéro sans la traiter comme une suppression volontaire', async () => {
    const api = server()
    const record = newTasting()
    const data = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), data)
    const db = await openDB('coffee101-notebook', 1)
    const cache = await db.get('notebook', 'account:alice') as { queue: { id: string; choices: unknown }[] }
    db.close()
    api.rows.push({ recipe_id: cache.queue[0].id, user_id: 'alice', choices: structuredClone(cache.queue[0].choices), deleted: true, version: 0, last_operation: null })
    const result = await synchronizeNotebook('alice', api.client, () => true)
    const conflict = (await loadNotebookConflicts('alice'))[0]
    expect(result.conflicts).toBe(1)
    expect(result.unsupported).toBe(0)
    expect(conflict.remote?.version).toBe(0)
    expect(conflict.remoteRecognized).toBe(false)
    expect(await loadAccountStore('alice')).toEqual(data)
    expect(api.operations).toHaveLength(0)
  })
  it('ne modifie jamais une ligne dont le contenu ne correspond pas à son identifiant distant', async () => {
    const api = server()
    const record = newTasting()
    const data = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    const edited = { ...blank(), records: [{ ...record, notes: 'local' }] }
    await saveAccountStore('alice', data, edited)
    const payload = api.rows[0].choices as { record: typeof record }
    payload.record = { ...payload.record, id: 'mauvais-identifiant' }
    const db = await openDB('coffee101-notebook', 1)
    const cache = await db.get('notebook', 'account:alice') as { queue: { choices: { record: typeof record } }[] }
    cache.queue[0].choices.record.id = 'mauvais-identifiant'
    await db.put('notebook', cache, 'account:alice')
    db.close()
    const result = await synchronizeNotebook('alice', api.client, () => true)
    expect(result.unsupported).toBe(1)
    expect(result.conflicts).toBe(1)
    expect(api.operations).toHaveLength(1)
    expect(payload.record.id).toBe('mauvais-identifiant')
  })
  it('empêche la résurrection silencieuse d’une fiche supprimée', async () => {
    const api = server()
    const record = newTasting()
    const data = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    await saveAccountStore('alice', data, blank())
    await saveAccountStore('alice', blank(), data)
    const result = await synchronizeNotebook('alice', api.client, () => true)
    expect(result.conflicts).toBe(1)
    expect(result.pending).toBe(1)
    expect(api.rows[0].deleted).toBe(true)
    expect(api.operations).toHaveLength(2)
    expect(await loadAccountStore('alice')).toEqual(data)
    const resolved = await resolveNotebookConflicts('alice', api.client, () => true)
    expect(resolved.records).toHaveLength(1)
    expect(resolved.records[0].id).not.toBe(record.id)
    await synchronizeNotebook('alice', api.client, () => true)
    expect(api.rows[0].deleted).toBe(true)
    expect(api.rows).toHaveLength(2)
  })
  it('ne confirme pas une modification si le RPC est indisponible', async () => {
    const api = server()
    await saveAccountStore('alice', blank(), { ...blank(), records: [newTasting()] })
    const client = { ...api.client, rpc: async () => ({ data: null, error: new Error('RPC absent') }) } as unknown as SupabaseClient
    await expect(synchronizeNotebook('alice', client, () => true)).rejects.toThrow()
    expect((await loadAccountStore('alice')).records).toHaveLength(1)
    expect(api.rows).toHaveLength(0)
  })
  it('relit et conserve la version distante après un refus du RPC', async () => {
    const api = server()
    const record = newTasting()
    const first = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), first)
    await synchronizeNotebook('alice', api.client, () => true)
    const edited = { ...blank(), records: [{ ...record, notes: 'Version locale' }] }
    await saveAccountStore('alice', first, edited)
    const client = {
      ...api.client,
      rpc: async () => {
        api.rows[0].version++
        api.rows[0].deleted = true
        api.rows[0].last_operation = crypto.randomUUID()
        return { data: { applied: false, version: api.rows[0].version }, error: null }
      },
    } as unknown as SupabaseClient
    const result = await synchronizeNotebook('alice', client, () => true)
    expect(result.conflicts).toBe(1)
    expect(result.pending).toBe(1)
    const conflicts = await loadNotebookConflicts('alice')
    expect(conflicts[0].local?.choices.record.notes).toBe('Version locale')
    expect(conflicts[0].remote?.deleted).toBe(true)
    expect(conflicts[0].remote?.version).toBe(2)
    expect(conflicts[0].remoteRecognized).toBe(true)
    expect(await loadAccountStore('alice')).toEqual(edited)
  })
  it('ne confirme rien si la table ne peut pas être lue', async () => {
    const api = server()
    await saveAccountStore('alice', blank(), { ...blank(), records: [newTasting()] })
    const client = {
      ...api.client,
      from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: null, error: new Error('table absente') }) }) }) }) }),
    } as unknown as SupabaseClient
    await expect(synchronizeNotebook('alice', client, () => true)).rejects.toThrow()
    expect(api.operations).toHaveLength(0)
    expect((await loadAccountStore('alice')).records).toHaveLength(1)
  })
  it('conserve les modifications locales lorsque la version distante change', async () => {
    const api = server()
    const record = newTasting()
    const first = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), first)
    await synchronizeNotebook('alice', api.client, () => true)
    const edited = { ...blank(), records: [{ ...record, notes: 'local' }] }
    await saveAccountStore('alice', first, edited)
    api.rows[0].version++; api.rows[0].last_operation = crypto.randomUUID()
    expect((await synchronizeNotebook('alice', api.client, () => true)).conflicts).toBe(1)
    expect(await loadAccountStore('alice')).toEqual(edited)
    expect(api.operations).toHaveLength(1)
  })
  it('ne ressuscite pas une suppression distante face à une édition hors ligne', async () => {
    const api = server()
    const record = newTasting()
    const data = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    const edited = { ...blank(), records: [{ ...record, notes: 'hors ligne' }] }
    await saveAccountStore('alice', data, edited)
    api.rows[0].deleted = true
    api.rows[0].version++
    api.rows[0].last_operation = crypto.randomUUID()
    expect((await synchronizeNotebook('alice', api.client, () => true)).conflicts).toBe(1)
    expect(api.rows[0].deleted).toBe(true)
    expect(api.operations).toHaveLength(1)
    expect(await loadAccountStore('alice')).toEqual(edited)
  })
  it('résout explicitement un conflit en conservant les deux versions sans réécrire la distante', async () => {
    const api = server()
    const original = newTasting()
    const first = { ...blank(), records: [original] }
    await saveAccountStore('alice', blank(), first)
    await synchronizeNotebook('alice', api.client, () => true)
    const edited = { ...blank(), records: [{ ...original, notes: 'local' }] }
    await saveAccountStore('alice', first, edited)
    const payload = api.rows[0].choices as { record: typeof original }
    payload.record = { ...original, notes: 'distant' }
    api.rows[0].version++; api.rows[0].last_operation = crypto.randomUUID()
    expect((await synchronizeNotebook('alice', api.client, () => true)).conflicts).toBe(1)
    const result = await resolveNotebookConflicts('alice', api.client, () => true)
    expect(result.records).toHaveLength(2)
    expect(result.records.find(item => item.id === original.id)?.notes).toBe('distant')
    const copy = result.records.find(item => item.id !== original.id)
    expect(copy?.notes).toBe('local')
    await synchronizeNotebook('alice', api.client, () => true)
    expect(api.rows).toHaveLength(2)
    expect((api.rows[0].choices as { record: typeof original }).record.notes).toBe('distant')
  })
  it('refuse la résolution si la version distante a disparu', async () => {
    const api = server()
    const record = newTasting()
    const data = { ...blank(), records: [record] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    api.rows.length = 0
    expect((await synchronizeNotebook('alice', api.client, () => true)).conflicts).toBe(1)
    await expect(resolveNotebookConflicts('alice', api.client, () => true)).rejects.toThrow()
    expect(await loadAccountStore('alice')).toEqual(data)
  })
  it('relie les copies de brouillon et fiche résolues sans perdre leur base', async () => {
    const api = server()
    const record = newTasting()
    const draft = { ...newTasting(), editOf: record.id, editBase: JSON.stringify(record) }
    const data = { version: 1 as const, drafts: [draft], records: [record] }
    await saveAccountStore('alice', blank(), data)
    await synchronizeNotebook('alice', api.client, () => true)
    const editedRecord = { ...record, notes: 'fiche locale' }
    const edited = { version: 1 as const, records: [editedRecord], drafts: [{ ...draft, notes: 'brouillon local', editBase: JSON.stringify(editedRecord) }] }
    await saveAccountStore('alice', data, edited)
    for (const row of api.rows) { row.version++; row.last_operation = crypto.randomUUID() }
    expect((await synchronizeNotebook('alice', api.client, () => true)).conflicts).toBe(2)
    const result = await resolveNotebookConflicts('alice', api.client, () => true)
    const localRecord = result.records.find(item => item.notes === 'fiche locale')!
    const localDraft = result.drafts.find(item => item.notes === 'brouillon local')!
    expect(localDraft.editOf).toBe(localRecord.id)
    expect(localDraft.editBase).toBe(JSON.stringify(localRecord))
  })
  it('ne démarre pas sans verrou ni avec une session changée', async () => {
    const api = server()
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
    await expect(synchronizeNotebook('alice', api.client, () => true)).rejects.toThrow()
    expect(api.operations).toHaveLength(0)
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: vi.fn(async (_name, fn) => fn()) } })
    await expect(synchronizeNotebook('alice', api.client, () => false)).rejects.toThrow()
  })
  it('ne lance pas le RPC si la session change après la préparation locale', async () => {
    const api = server()
    await saveAccountStore('alice', blank(), { ...blank(), drafts: [newTasting()] })
    let checks = 0
    await expect(synchronizeNotebook('alice', api.client, () => ++checks < 4)).rejects.toThrow()
    expect(api.operations).toHaveLength(0)
    expect((await loadAccountStore('alice')).drafts).toHaveLength(1)
  })
  it('sérialise deux synchronisations du même compte avec le verrou', async () => {
    let tail: Promise<unknown> = Promise.resolve()
    Object.defineProperty(navigator, 'locks', { configurable: true, value: {
      request: (_name: string, fn: () => Promise<unknown>) => {
        const next = tail.then(fn)
        tail = next.catch(() => {})
        return next
      },
    } })
    const api = server()
    await saveAccountStore('alice', blank(), { ...blank(), records: [newTasting()] })
    await Promise.all([synchronizeNotebook('alice', api.client, () => true), synchronizeNotebook('alice', api.client, () => true)])
    expect(api.operations).toHaveLength(1)
  })
  it('lie chaque client au jeton capturé et non à une session globale ultérieure', async () => {
    const headers: string[] = []
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
      headers.push(new Headers(init?.headers).get('authorization') ?? '')
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    try {
      const alice = notebookClient('token-alice')
      const bob = notebookClient('token-bob')
      await Promise.all([alice.from('saved_recipes').select(), bob.from('saved_recipes').select()])
      expect(headers).toEqual(expect.arrayContaining(['alice', 'bob'].map(name => ['Bearer', 'token-' + name].join(' '))))
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs() }
  })
})
