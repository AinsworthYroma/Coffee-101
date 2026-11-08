import type { TastingProposal } from './Preparation'
import { aromaVersion } from './aromas'
import { openDB } from 'idb'

export interface AromaChoice { id: string; label: string }
export interface TastingRecord {
  id: string
  date: string
  name: string
  roaster: string
  country: string
  region: string
  altitude: string
  processing: string
  processingOther: string
  fermentation: string
  roast: string
  notes: string
  proposal: TastingProposal | null
  actual: string
  aromas: AromaChoice[]
  aromaVersion: number
  acidity: string
  bitterness: string
  sweetness: string
  body: string
  finish: string
  appreciation: string
  nextTime: string
  editOf?: string
  editBase?: string
}
export interface TastingStore { version: 1; drafts: TastingRecord[]; records: TastingRecord[] }
export class StaleNotebookError extends Error {}
export const storageKey = 'coffee101-tastings-v1'
export function newTasting(proposal: TastingProposal | null = null): TastingRecord {
  return { id: crypto.randomUUID(), date: new Date().toLocaleDateString('sv-SE'), name: '', roaster: '', country: '', region: '', altitude: '', processing: '', processingOther: '', fermentation: '', roast: proposal?.choices.roast === 'unknown' ? '' : ({ light: 'Claire', medium: 'Moyenne', dark: 'Foncée' } as Record<string, string>)[proposal?.choices.roast ?? ''] ?? '', notes: '', proposal, actual: '', aromas: [], aromaVersion, acidity: '', bitterness: '', sweetness: '', body: '', finish: '', appreciation: '', nextTime: '' }
}
const database = () => openDB('coffee101-notebook', 1, { upgrade(db) { db.createObjectStore('notebook') } })

export async function loadStore(): Promise<TastingStore> {
  const db = await database()
  try {
  const tx = db.transaction('notebook', 'readwrite')
  const existing: unknown = await tx.store.get('data')
  if (existing !== undefined) {
    if (!isStore(existing)) throw new Error('Données du carnet invalides ou version non prise en charge')
    await tx.done
    return existing
  }
  const stored = localStorage.getItem(storageKey)
  if (stored) {
    const parsed: unknown = JSON.parse(stored)
    if (!isStore(parsed)) throw new Error('Données du carnet invalides ou version non prise en charge')
    await tx.store.put(parsed, 'data')
    await tx.done
    return parsed
  }
  const legacy = localStorage.getItem('coffee101-tasting-draft')
  const draft = legacy ? { ...newTasting(), notes: legacy } : null
  const result: TastingStore = { version: 1, drafts: draft ? [draft] : [], records: [] }
  if (legacy) await tx.store.put(result, 'data')
  await tx.done
  return result
  } finally { db.close() }
}
export function isStore(value: unknown): value is TastingStore {
  if (!value || typeof value !== 'object') return false
  const data = value as TastingStore
  const isObject = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)
  const strings = (item: Record<string, unknown>, keys: string[]) => keys.every(key => typeof item[key] === 'string')
  const stringArray = (item: unknown) => Array.isArray(item) && item.every(value => typeof value === 'string')
  const validProposal = (item: unknown) => {
    if (item === null) return true
    if (!isObject(item) || !isObject(item.choices) || !isObject(item.recipe)) return false
    const choices = item.choices
    const recipe = item.recipe
    const parameters = (value: unknown) => Array.isArray(value) && value.every(parameter => isObject(parameter) && strings(parameter, ['label', 'value']))
    return typeof item.methodName === 'string' && ['automatic', 'aeropress', 'espresso', 'filter'].includes(String(choices.method)) && ['electric', 'v60'].includes(String(choices.filterMode)) && ['unknown', 'light', 'medium', 'dark'].includes(String(choices.roast)) && ['round', 'expressive'].includes(String(choices.profile)) && typeof choices.quantity === 'number' && Number.isFinite(choices.quantity) && typeof choices.basket === 'number' && Number.isFinite(choices.basket) && parameters(item.parameters) && parameters(recipe.parameters) && stringArray(recipe.steps) && stringArray(recipe.assumptions) && stringArray(recipe.adaptation) && strings(recipe, ['adjustment', 'result']) && Array.isArray(recipe.sources) && recipe.sources.every(source => isObject(source) && strings(source, ['label', 'url']))
  }
  const valid = (record: unknown) => isObject(record) && strings(record, ['id', 'date', 'name', 'roaster', 'country', 'region', 'altitude', 'processing', 'processingOther', 'fermentation', 'roast', 'notes', 'actual', 'acidity', 'bitterness', 'sweetness', 'body', 'finish', 'appreciation', 'nextTime']) && record.id !== '' && (record.editOf === undefined || typeof record.editOf === 'string') && (record.editBase === undefined || typeof record.editBase === 'string') && typeof record.aromaVersion === 'number' && Number.isInteger(record.aromaVersion) && validProposal(record.proposal) && Array.isArray(record.aromas) && record.aromas.every(aroma => isObject(aroma) && strings(aroma, ['id', 'label'])) && new Set(record.aromas.map(aroma => aroma.id)).size === record.aromas.length
  return data.version === 1 && Array.isArray(data.drafts) && Array.isArray(data.records) && data.drafts.every(valid) && data.records.every(valid) && new Set([...data.drafts, ...data.records].map(record => record.id)).size === data.drafts.length + data.records.length
}
export async function saveStore(store: TastingStore, previous?: TastingStore) {
  const db = await database()
  try {
    const tx = db.transaction('notebook', 'readwrite')
    if (previous) {
      const current = await tx.store.get('data')
      if ((current === undefined && (previous.drafts.length > 0 || previous.records.length > 0)) ||
          (current !== undefined && JSON.stringify(current) !== JSON.stringify(previous))) {
        tx.abort()
        await tx.done.catch(() => {})
        throw new StaleNotebookError('Notebook changed elsewhere')
      }
    }
    await tx.store.put(store, 'data')
    await tx.done
  } finally { db.close() }
}
