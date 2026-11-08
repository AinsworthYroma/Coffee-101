import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { openDB } from 'idb'
import { isStore, StaleNotebookError, type TastingRecord, type TastingStore } from './tastingStore'
import { acknowledgeNotebookSync } from './notebookActivity'

// Wire format: recipe_id is coffee101:tasting:v1:<SHA-256 of the UTF-8
// JSON string representation of record.id>. JSON escaping preserves lone surrogates.
// choices is { schema: "coffee101.tasting", version: 1, kind, record }.
// Unknown names, schemas and versions are never rewritten by this client.
const prefix = 'coffee101:tasting:v1:'
type Kind = 'draft' | 'record'
export type Payload = { schema: 'coffee101.tasting'; version: 1; kind: Kind; record: TastingRecord }
export type Remote = { recipe_id: string; choices: unknown; deleted: boolean; version: number; last_operation: string | null }
type Change = { id: string; choices: Payload; deleted: boolean; operation: string; expected?: number }
type Cache = { format: 1; store: TastingStore; base: Record<string, Remote>; queue: Change[]; conflicts: string[]; conflictRemote: Record<string, Remote | null> }
const empty = (): TastingStore => ({ version: 1, drafts: [], records: [] })
const emptyCache = (): Cache => ({ format: 1, store: empty(), base: {}, queue: [], conflicts: [], conflictRemote: {} })
const db = () => openDB('coffee101-notebook', 1, { upgrade(database) { database.createObjectStore('notebook') } })
const key = (owner: string) => `account:${owner}`
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
function sameWire(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([name, item]) => [name, normalize(item)]))
    return value
  }
  try { return same(normalize(JSON.parse(JSON.stringify(a))), normalize(JSON.parse(JSON.stringify(b)))) }
  catch { return false }
}
function checkedCache(value: unknown): Cache {
  if (value === undefined) return emptyCache()
  if (!value || typeof value !== 'object') throw new Error('Invalid account cache')
  const cache = value as Cache
  if (cache.conflictRemote === undefined) cache.conflictRemote = {}
  if (cache.format !== 1 || !isStore(cache.store) || !cache.base || typeof cache.base !== 'object' || Array.isArray(cache.base) ||
      !cache.conflictRemote || typeof cache.conflictRemote !== 'object' || Array.isArray(cache.conflictRemote) ||
      !Array.isArray(cache.queue) || !cache.queue.every(item => item && typeof item.id === 'string' && typeof item.operation === 'string' && typeof item.deleted === 'boolean' && payload(item.choices) && (item.expected === undefined || (Number.isSafeInteger(item.expected) && item.expected >= 0))) ||
      !Array.isArray(cache.conflicts) || !cache.conflicts.every(item => typeof item === 'string') ||
      !Object.values(cache.base).every(row => row && validRemote(row) && payload(row.choices))) throw new Error('Invalid account cache')
  return cache
}

async function recipeId(id: string) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(id))))
  return prefix + Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('')
}
async function entries(store: TastingStore) {
  const result = new Map<string, Payload>()
  for (const [kind, records] of [['draft', store.drafts], ['record', store.records]] as const) {
    for (const record of records) {
      const id = await recipeId(record.id)
      if (result.has(id)) throw new Error('Duplicate notebook identifier')
      result.set(id, { schema: 'coffee101.tasting', version: 1, kind, record })
    }
  }
  return result
}
export function isNotebookPayload(value: unknown): value is Payload {
  if (!value || typeof value !== 'object') return false
  const item = value as Payload
  return item.schema === 'coffee101.tasting' && item.version === 1 && (item.kind === 'draft' || item.kind === 'record') &&
    isStore({ version: 1, drafts: item.kind === 'draft' ? [item.record] : [], records: item.kind === 'record' ? [item.record] : [] })
}
const payload = isNotebookPayload
function validRemote(row: Remote) {
  return typeof row.recipe_id === 'string' && typeof row.deleted === 'boolean' &&
    Number.isSafeInteger(row.version) && row.version > 0 && (row.last_operation === null || typeof row.last_operation === 'string')
}
export function isTechnicalPlaceholder(row: Remote) {
  return typeof row.recipe_id === 'string' && row.deleted === true && row.version === 0 && row.last_operation === null &&
    !!row.choices && typeof row.choices === 'object' && !Array.isArray(row.choices)
}

export async function loadAccountStore(owner: string): Promise<TastingStore> {
  const database = await db()
  try { return checkedCache(await database.get('notebook', key(owner))).store }
  finally { database.close() }
}

// Compare-and-swap prevents a stale whole-store save from erasing another tab or a pull.
export async function saveAccountStore(owner: string, previous: TastingStore, next: TastingStore) {
  if (!isStore(next)) throw new Error('Invalid notebook')
  const before = await entries(previous)
  const after = await entries(next)
  const database = await db()
  try {
    const tx = database.transaction('notebook', 'readwrite')
    const cache = checkedCache(await tx.store.get(key(owner)))
    if (!same(cache.store, previous)) { tx.abort(); await tx.done.catch(() => {}); throw new StaleNotebookError('Notebook changed elsewhere') }
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const old = before.get(id)
      const value = after.get(id)
      if (old && value && old.record.id !== value.record.id) {
        tx.abort()
        await tx.done.catch(() => {})
        throw new StaleNotebookError('Notebook identifier collision')
      }
      if (!same(old, value)) cache.queue.push({ id, choices: value ?? old!, deleted: !value, operation: crypto.randomUUID() })
    }
    cache.store = next
    await tx.store.put(cache, key(owner))
    await tx.done
  } finally { database.close() }
}

async function mutate(owner: string, fn: (cache: Cache) => void) {
  const database = await db()
  try {
    const tx = database.transaction('notebook', 'readwrite')
    const cache = checkedCache(await tx.store.get(key(owner)))
    fn(cache)
    await tx.store.put(cache, key(owner))
    await tx.done
    return cache
  } finally { database.close() }
}
async function readCache(owner: string) {
  const database = await db()
  try { return checkedCache(await database.get('notebook', key(owner))) }
  finally { database.close() }
}
export async function notebookQueueLength(owner: string): Promise<number> {
  const cache = await readCache(owner)
  return cache.queue.length + cache.conflicts.length
}
function applyRemote(cache: Cache, row: Remote, value: Payload) {
  const others = [...cache.store.drafts, ...cache.store.records].filter(item => item.id !== value.record.id)
  // Never discard an unrelated local record with an identical id.
  const old = cache.base[row.recipe_id]
  if (old && payload(old.choices) && old.choices.record.id !== value.record.id) {
    if (!cache.conflicts.includes(row.recipe_id)) cache.conflicts.push(row.recipe_id)
    cache.conflictRemote[row.recipe_id] = row
    return
  }
  if (!old && others.length !== cache.store.drafts.length + cache.store.records.length) {
    if (!cache.conflicts.includes(row.recipe_id)) cache.conflicts.push(row.recipe_id)
    cache.conflictRemote[row.recipe_id] = row
    return
  }
  cache.store = {
    version: 1,
    drafts: cache.store.drafts.filter(item => item.id !== value.record.id),
    records: cache.store.records.filter(item => item.id !== value.record.id),
  }
  if (!row.deleted) cache.store[value.kind === 'draft' ? 'drafts' : 'records'].push(value.record)
  cache.base[row.recipe_id] = row
}
async function fetchRows(client: SupabaseClient, owner: string): Promise<Remote[]> {
  const rows: Remote[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  for (;;) {
    let query = client.from('saved_recipes').select('recipe_id,choices,deleted,version,last_operation').eq('user_id', owner).order('recipe_id')
    if (cursor !== undefined) query = query.gt('recipe_id', cursor)
    const { data, error } = await query.range(0, 499)
    if (error || !data) throw error ?? new Error('Read failed')
    if (!data.length) return rows
    for (const row of data) {
      if (typeof row.recipe_id !== 'string' || seen.has(row.recipe_id)) throw new Error('Invalid or repeated remote identifier')
      seen.add(row.recipe_id)
    }
    rows.push(...data as Remote[])
    cursor = data[data.length - 1].recipe_id
  }
}

export type SyncResult = { pending: number; conflicts: number; unsupported: number }
export type ConflictDetails = { id: string; local: { choices: Payload; deleted: boolean } | null; remote: Remote | null | undefined; remoteRecognized: boolean }
export async function loadNotebookConflicts(owner: string): Promise<ConflictDetails[]> {
  const cache = await readCache(owner)
  return Promise.all(cache.conflicts.map(async id => {
    const remote = cache.conflictRemote[id]
    const remoteRecognized = !!remote && validRemote(remote) && payload(remote.choices) && await recipeId(remote.choices.record.id) === id
    const change = [...cache.queue].reverse().find(item => item.id === id)
    if (change) return { id, local: { choices: change.choices, deleted: change.deleted }, remote, remoteRecognized }
    const base = cache.base[id]
    if (base && payload(base.choices)) {
      const local = cache.store.drafts.find(item => item.id === (base.choices as Payload).record.id)
      const record = cache.store.records.find(item => item.id === (base.choices as Payload).record.id)
      const item = local ?? record
      return { id, local: item ? { choices: { schema: 'coffee101.tasting', version: 1, kind: local ? 'draft' as const : 'record' as const, record: item }, deleted: false } : null, remote, remoteRecognized }
    }
    return { id, local: null, remote, remoteRecognized }
  }))
}
export async function synchronizeNotebook(owner: string, client: SupabaseClient, current: () => boolean): Promise<SyncResult> {
  if (!navigator.locks) throw new Error('Lock unavailable')
  return navigator.locks.request(`coffee101-sync:${owner}`, async () => {
    if (!current()) throw new Error('Session changed')
    const remote = await fetchRows(client, owner)
    if (!current()) throw new Error('Session changed')
    let unsupported = 0
    for (const row of remote) {
      if (!row.recipe_id?.startsWith(prefix)) continue
      const placeholder = isTechnicalPlaceholder(row)
      if (placeholder || !validRemote(row) || !payload(row.choices) || await recipeId(row.choices.record.id) !== row.recipe_id) {
        if (!placeholder) unsupported++
        await mutate(owner, cache => {
          if (!current()) throw new Error('Session changed')
          if (cache.queue.some(change => change.id === row.recipe_id) || cache.base[row.recipe_id]) {
            if (!cache.conflicts.includes(row.recipe_id)) cache.conflicts.push(row.recipe_id)
            cache.conflictRemote[row.recipe_id] = row
          }
        })
        continue
      }
      let acknowledged = false
      await mutate(owner, cache => {
        if (!current()) throw new Error('Session changed')
        const base = cache.base[row.recipe_id]
        const queued = cache.queue.find(change => change.id === row.recipe_id)
        if (cache.conflicts.includes(row.recipe_id)) cache.conflictRemote[row.recipe_id] = row
        if (queued) {
          // A response may have been lost. Only the exact last operation proves success.
          if ((row.choices as Payload).record.id !== queued.choices.record.id) {
            if (!cache.conflicts.includes(row.recipe_id)) cache.conflicts.push(row.recipe_id)
            cache.conflictRemote[row.recipe_id] = row
          } else if (queued.expected !== undefined && row.last_operation === queued.operation && row.version === queued.expected + 1 && row.deleted === queued.deleted && sameWire(row.choices, queued.choices)) {
            cache.queue.splice(cache.queue.indexOf(queued), 1)
            cache.base[row.recipe_id] = row
            acknowledged = true
          } else if (row.version !== (queued.expected ?? base?.version ?? 0) || row.last_operation === queued.operation) {
            if (!cache.conflicts.includes(row.recipe_id)) cache.conflicts.push(row.recipe_id)
            cache.conflictRemote[row.recipe_id] = row
          }
        } else if (!base || row.version !== base.version || row.last_operation !== base.last_operation) {
          applyRemote(cache, row, row.choices as Payload)
        }
      })
      if (acknowledged && current()) acknowledgeNotebookSync(owner)
    }
    const seen = new Set(remote.map(row => row.recipe_id))
    await mutate(owner, cache => {
      if (!current()) throw new Error('Session changed')
      // Missing previously observed rows are ambiguous, not permission to recreate them.
      for (const id of Object.keys(cache.base)) if (!seen.has(id)) {
        if (!cache.conflicts.includes(id)) cache.conflicts.push(id)
        cache.conflictRemote[id] = null
      }
    })
    while (current()) {
      if (!current()) throw new Error('Session changed')
      const cache = await readCache(owner)
      const change = cache.queue.find(item => !cache.conflicts.includes(item.id))
      if (!change) break
      const row = remote.find(item => item.recipe_id === change.id)
      const base = cache.base[change.id]
      const changeIdMatches = await recipeId(change.choices.record.id) === change.id
      const rowIdMatches = !row || (validRemote(row) && payload(row.choices) && await recipeId(row.choices.record.id) === row.recipe_id)
      if (!current()) throw new Error('Session changed')
      if (base?.deleted && !change.deleted) {
        await mutate(owner, state => { if (!current()) throw new Error('Session changed'); if (!state.conflicts.includes(change.id)) state.conflicts.push(change.id); state.conflictRemote[change.id] = row ?? null })
        continue
      }
      if (!changeIdMatches || !rowIdMatches || (row && payload(row.choices) && row.choices.record.id !== change.choices.record.id) || (row?.version ?? 0) !== (change.expected ?? base?.version ?? 0)) {
        await mutate(owner, state => { if (!current()) throw new Error('Session changed'); if (!state.conflicts.includes(change.id)) state.conflicts.push(change.id); state.conflictRemote[change.id] = row ?? null })
        continue
      }
      const expected = change.expected ?? base?.version ?? 0
      await mutate(owner, state => {
        if (!current()) throw new Error('Session changed')
        const pending = state.queue.find(item => item.operation === change.operation)
        if (pending && pending.expected === undefined) pending.expected = expected
      })
      if (!current()) throw new Error('Session changed')
      const { data, error } = await client.rpc('apply_recipe_change', { p_recipe_id: change.id, p_choices: change.choices, p_deleted: change.deleted, p_version: expected, p_operation: change.operation })
      if (error) throw error
      if (!current()) throw new Error('Session changed')
      const result = Array.isArray(data) ? data[0] : data
      const declined = !!result && typeof result === 'object' && result.applied === false
      const fresh = await fetchRows(client, owner)
      if (!current()) throw new Error('Session changed')
      const applied = fresh.find(item => item.recipe_id === change.id)
      if (declined || !applied || !validRemote(applied) || !payload(applied.choices) ||
          await recipeId(applied.choices.record.id) !== change.id || applied.last_operation !== change.operation ||
          applied.version !== expected + 1 || applied.deleted !== change.deleted || !sameWire(applied.choices, change.choices)) {
        await mutate(owner, state => {
          if (!current()) throw new Error('Session changed')
          if (!state.conflicts.includes(change.id)) state.conflicts.push(change.id)
          state.conflictRemote[change.id] = applied ?? null
        })
        continue
      }
      await mutate(owner, state => {
        if (!current()) throw new Error('Session changed')
        const index = state.queue.findIndex(item => item.operation === change.operation)
        if (index >= 0) state.queue.splice(index, 1)
        state.base[change.id] = applied
      })
      if (current()) acknowledgeNotebookSync(owner)
      const index = remote.findIndex(item => item.recipe_id === change.id)
      if (index < 0) remote.push(applied); else remote[index] = applied
    }
    if (!current()) throw new Error('Session changed')
    const cache = await readCache(owner)
    return { pending: cache.queue.length, conflicts: cache.conflicts.length, unsupported }
  })
}

// Conflict resolution never writes to the conflicting remote IDs. Current local
// values are copied under new IDs before the remote values are restored locally.
export async function resolveNotebookConflicts(owner: string, client: SupabaseClient, current: () => boolean): Promise<TastingStore> {
  if (!navigator.locks) throw new Error('Lock unavailable')
  return navigator.locks.request(`coffee101-sync:${owner}`, async () => {
    if (!current()) throw new Error('Session changed')
    const remote = await fetchRows(client, owner)
    if (!current()) throw new Error('Session changed')
    const cache = await readCache(owner)
    const conflicts = new Set(cache.conflicts)
    const rows = new Map<string, Remote>()
    for (const id of conflicts) {
      const row = remote.find(item => item.recipe_id === id)
      if (!row || !validRemote(row) || !payload(row.choices) || await recipeId(row.choices.record.id) !== id) throw new Error('Remote conflict cannot be reconciled')
      rows.set(id, row)
    }
    const localEntries = await entries(cache.store)
    const copies = new Map<string, string>()
    for (const id of conflicts) {
      const local = localEntries.get(id)
      if (local) copies.set(local.record.id, crypto.randomUUID())
    }
    const copiedRecords = new Map<string, TastingRecord>()
    for (const [id, value] of localEntries) {
      if (conflicts.has(id)) {
        const copy = structuredClone(value.record)
        copy.id = copies.get(value.record.id)!
        if (copy.editOf && copies.has(copy.editOf)) copy.editOf = copies.get(copy.editOf)
        copiedRecords.set(value.record.id, copy)
      }
    }
    for (const [originalId, copy] of copiedRecords) {
      const original = [...cache.store.drafts, ...cache.store.records].find(item => item.id === originalId)
      const target = original?.editOf && cache.store.records.find(item => item.id === original.editOf)
      const copiedTarget = original?.editOf && copiedRecords.get(original.editOf)
      if (original && target && copiedTarget && original.editBase === JSON.stringify(target)) copy.editBase = JSON.stringify(copiedTarget)
    }
    const next: TastingStore = structuredClone(cache.store)
    for (const [id, row] of rows) {
      const remoteValue = row.choices as Payload
      const local = localEntries.get(id)
      if (local) {
        next[local.kind === 'draft' ? 'drafts' : 'records'].push(copiedRecords.get(local.record.id)!)
      }
      next.drafts = next.drafts.filter(item => item.id !== remoteValue.record.id && item.id !== local?.record.id)
      next.records = next.records.filter(item => item.id !== remoteValue.record.id && item.id !== local?.record.id)
      if (!row.deleted) next[remoteValue.kind === 'draft' ? 'drafts' : 'records'].push(remoteValue.record)
    }
    if (!isStore(next)) throw new Error('Conflicting notebook identifiers')
    const nextEntries = await entries(next)
    const added = [...nextEntries].filter(([id]) => !localEntries.has(id) && !rows.has(id))
    if (!current()) throw new Error('Session changed')
    const database = await db()
    try {
      const tx = database.transaction('notebook', 'readwrite')
      const latest = checkedCache(await tx.store.get(key(owner)))
      if (!same(latest, cache) || !current()) {
        tx.abort()
        await tx.done.catch(() => {})
        throw new Error('Notebook or session changed')
      }
      latest.store = next
      latest.queue = latest.queue.filter(change => !conflicts.has(change.id))
      for (const [id, choices] of added) latest.queue.push({ id, choices, deleted: false, operation: crypto.randomUUID() })
      for (const [id, row] of rows) latest.base[id] = row
      latest.conflicts = latest.conflicts.filter(id => !conflicts.has(id))
      for (const id of conflicts) delete latest.conflictRemote[id]
      await tx.store.put(latest, key(owner))
      await tx.done
      return next
    } finally { database.close() }
  })
}

// The isolated client uses only the captured account token, even if the shared
// authentication session changes while a request is in flight.
export function notebookClient(token: string): SupabaseClient {
  return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
