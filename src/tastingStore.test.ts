import 'fake-indexeddb/auto'
import { deleteDB } from 'idb'
import { beforeEach, describe, expect, it } from 'vitest'
import { initialChoices, makeRecipe } from './recipes'
import { isStore, loadStore, newTasting, saveStore, storageKey, type TastingStore } from './tastingStore'

beforeEach(async () => {
  await deleteDB('coffee101-notebook')
  localStorage.clear()
})

describe('carnet local', () => {
  it('migre le brouillon texte sans le supprimer', async () => {
    localStorage.setItem('coffee101-tasting-draft', 'Mon ancien brouillon')
    const data = await loadStore()
    expect(data.drafts[0].notes).toBe('Mon ancien brouillon')
    expect(localStorage.getItem('coffee101-tasting-draft')).toBe('Mon ancien brouillon')
    expect((await loadStore()).drafts[0].id).toBe(data.drafts[0].id)
  })
  it('migre le même brouillon dans deux onglets concurrents', async () => {
    localStorage.setItem('coffee101-tasting-draft', 'Brouillon historique')
    const [first, second] = await Promise.all([loadStore(), loadStore()])
    expect(first.drafts[0].id).toBe(second.drafts[0].id)
    expect((await loadStore()).drafts[0].id).toBe(first.drafts[0].id)
  })
  it('refuse une écriture invitée obsolète au lieu de remplacer un autre onglet', async () => {
    const first = await loadStore()
    const second = await loadStore()
    const one = { ...first, drafts: [newTasting()] }
    const two = { ...second, drafts: [newTasting()] }
    const results = await Promise.allSettled([saveStore(one, first), saveStore(two, second)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    const stored = await loadStore()
    expect([one.drafts[0].id, two.drafts[0].id]).toContain(stored.drafts[0].id)
  })

  it('migre le carnet provisoire sans le supprimer et conserve les instantanés', async () => {
    const choices = { ...initialChoices, method: 'aeropress' as const }
    const recipe = makeRecipe(choices)
    const draft = newTasting({ choices, recipe, parameters: recipe.parameters, methodName: 'AeroPress' })
    const data: TastingStore = { version: 1, drafts: [draft], records: [] }
    localStorage.setItem(storageKey, JSON.stringify(data))
    expect(await loadStore()).toEqual(data)
    expect(localStorage.getItem(storageKey)).not.toBeNull()
    await saveStore({ ...data, drafts: [], records: [draft] })
    expect((await loadStore()).records[0].proposal?.recipe.steps).toEqual(recipe.steps)
  })

  it('refuse les imports incomplets ou mal formés', () => {
    const draft = newTasting()
    expect(isStore({ version: 1, drafts: [draft], records: [] })).toBe(true)
    expect(isStore({ version: 1, drafts: [{ id: 'a', date: '', aromas: [] }], records: [] })).toBe(false)
    expect(isStore({ version: 1, drafts: [{ ...draft, proposal: { choices: {} } }], records: [] })).toBe(false)
    expect(isStore({ version: 1, drafts: [draft], records: [draft] })).toBe(false)
  })
})