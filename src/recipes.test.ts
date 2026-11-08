import { describe, expect, it } from 'vitest'
import { initialChoices, makeRecipe, type Method, type Profile, type Roast } from './recipes'

describe('recettes de préparation', () => {
  it('couvre les combinaisons sans inventer de réglages pour la machine', () => {
    for (const method of ['automatic', 'aeropress', 'espresso', 'filter'] as Method[]) {
      for (const roast of ['unknown', 'light', 'medium', 'dark'] as Roast[]) {
        for (const profile of ['round', 'expressive'] as Profile[]) {
          const recipe = makeRecipe({ ...initialChoices, method, roast, profile })
          expect(recipe.steps.length).toBeGreaterThan(1)
          expect(recipe.sources.length).toBeGreaterThan(0)
          expect(recipe.adaptation.join(' ')).toBeTruthy()
          if (method === 'automatic') expect(recipe.parameters).toHaveLength(1)
        }
      }
    }
  })

  it('distingue les sous-modes et calcule les proportions', () => {
    const electric = makeRecipe({ ...initialChoices, method: 'filter', profile: 'expressive', quantity: 500 })
    const v60 = makeRecipe({ ...initialChoices, method: 'filter', filterMode: 'v60', profile: 'round', quantity: 500 })
    expect(electric.parameters).toContainEqual({ label: 'Café', value: '30 g' })
    expect(v60.parameters).toContainEqual({ label: 'Café', value: '32,5 g' })
    expect(electric.steps.join(' ')).toContain('réservoir')
    expect(v60.steps.join(' ')).toContain('progressivement')
  })

  it('distingue dose et boisson et respecte le panier', () => {
    const recipe = makeRecipe({ ...initialChoices, method: 'espresso', basket: 16, profile: 'expressive' })
    expect(recipe.parameters).toContainEqual({ label: 'Café sec', value: '16 g' })
    expect(recipe.parameters).toContainEqual({ label: 'Boisson en tasse', value: '35 g' })
  })

  it('adapte les températures et les quantités sans dépasser les limites', () => {
    for (const method of ['aeropress', 'filter'] as const) {
      for (const roast of ['unknown', 'light', 'medium', 'dark'] as Roast[]) {
        for (const profile of ['round', 'expressive'] as Profile[]) {
          for (const filterMode of ['electric', 'v60'] as const) {
            const recipe = makeRecipe({ ...initialChoices, method, filterMode, roast, profile, quantity: 750 })
            expect(recipe.steps.length).toBeGreaterThan(1)
            if (method === 'aeropress' || filterMode === 'v60') {
              const degrees = { unknown: 93, light: 96, medium: 93, dark: 90 }[roast]
              expect(recipe.parameters).toContainEqual({ label: 'Température indicative', value: `${degrees} °C` })
            } else expect(recipe.parameters.some(parameter => parameter.label.includes('Température'))).toBe(false)
          }
        }
      }
    }
    expect(makeRecipe({ ...initialChoices, method: 'filter', quantity: 1000 }).parameters).toContainEqual({ label: 'Eau versée', value: '750 ml' })
    expect(makeRecipe({ ...initialChoices, method: 'espresso', basket: 30 }).parameters).toContainEqual({ label: 'Café sec', value: '22 g' })
  })
})