import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deleteDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Tasting from './Tasting'
import { initialChoices, makeRecipe } from './recipes'
import * as tastingStore from './tastingStore'
import { loadStore } from './tastingStore'

beforeEach(async () => { await deleteDB('coffee101-notebook'); localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('parcours de dégustation', () => {
  it('conserve une fiche lorsque sa suppression échoue', async () => {
    const record = { ...tastingStore.newTasting(), name: 'Fiche à conserver' }
    await tastingStore.saveStore({ version: 1, drafts: [], records: [record] })
    vi.spyOn(tastingStore, 'saveStore').mockRejectedValueOnce(new Error('Stockage indisponible'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /fiche à conserver/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible')
    expect(screen.getByRole('heading', { name: 'Fiche à conserver' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ma bibliothèque/ }))
    expect(screen.getByRole('button', { name: /fiche à conserver/i })).toBeInTheDocument()
  })

  it('conserve le brouillon quand la finalisation échoue et permet de réessayer', async () => {
    const draft = { ...tastingStore.newTasting(), name: 'Brouillon à conserver' }
    await tastingStore.saveStore({ version: 1, drafts: [draft], records: [] })
    vi.spyOn(tastingStore, 'saveStore').mockRejectedValueOnce(new Error('Stockage indisponible'))
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre : Brouillon à conserver/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma fiche' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible')
    expect(screen.getByLabelText('Nom du café')).toHaveValue('Brouillon à conserver')
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma fiche' }))
    expect(await screen.findByText('Ta fiche est enregistrée.')).toBeInTheDocument()
    expect((await loadStore()).records[0].name).toBe('Brouillon à conserver')
  })
  it('garde le travail visible si un autre onglet a modifié le carnet invité', async () => {
    const draft = tastingStore.newTasting()
    await tastingStore.saveStore({ version: 1, drafts: [draft], records: [] })
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre :/ }))
    await tastingStore.saveStore({ version: 1, drafts: [{ ...draft, notes: 'Autre onglet' }], records: [] })
    fireEvent.change(screen.getByLabelText('Nom du café'), { target: { value: 'Travail à exporter' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('autre onglet')
    expect(screen.getByLabelText('Nom du café')).toHaveValue('Travail à exporter')
    expect((await loadStore()).drafts[0].notes).toBe('Autre onglet')
  })

  it('ne remplace pas une fiche depuis un ancien brouillon sans base vérifiable', async () => {
    const original = { ...tastingStore.newTasting(), name: 'Fiche actuelle' }
    const draft = { ...tastingStore.newTasting(), name: 'Ancien brouillon', editOf: original.id }
    await tastingStore.saveStore({ version: 1, drafts: [draft], records: [original] })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre : Ancien brouillon/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma fiche' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('comme nouvelle fiche'))
    expect((await loadStore()).records[0].name).toBe('Fiche actuelle')
    expect((await loadStore()).drafts[0].name).toBe('Ancien brouillon')
  })

  it('conserve la recette, les impressions et la fiche après rechargement', async () => {
    const choices = { ...initialChoices, method: 'aeropress' as const }
    const recipe = makeRecipe(choices)
    const proposal = { choices, recipe, parameters: recipe.parameters, methodName: 'AeroPress' }
    const clearProposal = vi.fn()
    const view = render(<Tasting active proposal={proposal} clearProposal={clearProposal} libraryRequest={0} onReturn={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: /nouvelle dégustation/i })).toBeInTheDocument()
    expect(screen.getByText('14 g')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nom du café'), { target: { value: 'Café du matin' } })
    fireEvent.change(screen.getByLabelText('Paramètres réellement utilisés'), { target: { value: '13 g' } })
    fireEvent.click(screen.getByText('Voir tous les arômes en liste'))
    fireEvent.click(screen.getByText('Fruité', { selector: 'summary' }))
    fireEvent.click(screen.getByRole('button', { name: 'Citron' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fraise' }))
    await waitFor(() => expect(screen.getByText('Brouillon enregistré')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer ma fiche' }))
    expect(await screen.findByText('Ta fiche est enregistrée.')).toBeInTheDocument()
    expect((await loadStore()).records[0].actual).toBe('13 g')
    view.unmount()
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    const card = await screen.findByRole('button', { name: /café du matin/i })
    expect(within(card).getByText('Citron')).toBeInTheDocument()
    expect(within(card).getByText('Fraise')).toBeInTheDocument()
    fireEvent.click(card)
    expect(screen.getByRole('heading', { name: 'Recette proposée' })).toBeInTheDocument()
    expect(screen.getByText('13 g')).toBeInTheDocument()
  })

  it('affiche les familles enregistrées, filtre les fiches et ne modifie pas les choix en consultation', async () => {
    const record = { ...tastingStore.newTasting(), name: 'Café fruité', aromas: [{ id: 'citron', label: 'Citron' }, { id: 'chocolat', label: 'Chocolat' }, { id: 'libre-personnel', label: 'Souvenir personnel' }] }
    const other = { ...tastingStore.newTasting(), name: 'Autre café' }
    await tastingStore.saveStore({ version: 1, drafts: [], records: [record, other] })
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    const card = await screen.findByRole('button', { name: /café fruité/i })
    expect(card.querySelectorAll('.aroma-signature path[fill="#e5d7c6"]')).toHaveLength(7)
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'absent' } })
    expect(screen.getByText('Aucune fiche ne correspond à cette recherche.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Rechercher'), { target: { value: 'citron' } })
    expect(screen.getByRole('status')).toHaveTextContent('1 fiche sur 2')
    fireEvent.click(screen.getByRole('button', { name: /café fruité/i }))
    expect(screen.getByText('Fruité')).toBeInTheDocument()
    expect(screen.getByText('Cacao et fruits à coque')).toBeInTheDocument()
    expect(screen.getByText('Souvenir personnel')).toBeInTheDocument()
    expect((await loadStore()).records[0].aromas).toEqual(record.aromas)
  })

  it('distingue préparation non renseignée, identique et différente', async () => {
    const choices = { ...initialChoices, method: 'aeropress' as const }
    const recipe = makeRecipe(choices)
    const proposal = { choices, recipe, parameters: recipe.parameters, methodName: 'AeroPress' }
    const confirmed = recipe.parameters.map(parameter => `${parameter.label} : ${parameter.value}`).join('\n')
    const records = [
      { ...tastingStore.newTasting(proposal), name: 'Sans confirmation' },
      { ...tastingStore.newTasting(proposal), name: 'Recette confirmée', actual: confirmed },
      { ...tastingStore.newTasting(proposal), name: 'Recette modifiée', actual: 'Café : 13 g\nUne note libre' },
    ]
    await tastingStore.saveStore({ version: 1, drafts: [], records })
    render(<Tasting active proposal={null} clearProposal={vi.fn()} libraryRequest={0} onReturn={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /sans confirmation/i }))
    expect(screen.getByText('Non renseignée.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ma bibliothèque/ }))
    fireEvent.click(screen.getByRole('button', { name: /recette confirmée/i }))
    expect(screen.getByText('Identique à la recette proposée.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ma bibliothèque/ }))
    fireEvent.click(screen.getByRole('button', { name: /recette modifiée/i }))
    expect(screen.getByText('Café · valeur différente')).toBeInTheDocument()
    expect(screen.getByText('13 g')).toBeInTheDocument()
    expect(screen.getByText('Une note libre')).toBeInTheDocument()
    expect((await loadStore()).records[2].actual).toBe('Café : 13 g\nUne note libre')
  })
})