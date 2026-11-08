import { expect, test } from '@playwright/test'

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] }, reducedMotion: 'reduce' })

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
  test(`carnet et roue ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize(viewport)
    await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
    await page.goto('/')
    await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
    await page.getByRole('button', { name: 'Déguster ce café' }).click()
    await expect(page.getByRole('heading', { name: /Nouvelle dégustation/ })).toBeVisible()
    await expect(page.locator('.tasting-parameters').first()).toContainText('14 g')
    await page.getByLabel('Nom du café').fill('Café de test')
    await page.getByLabel('Paramètres réellement utilisés').fill('13 g de café')
    await page.getByText('Voir tous les arômes en liste').click()
    await page.locator('.aroma-list summary').filter({ hasText: /^Fruité$/ }).click()
    await page.getByRole('button', { name: 'Citron', exact: true }).click()
    await page.getByRole('button', { name: 'Fraise', exact: true }).click()
    await expect(page.getByText('Brouillon enregistré', { exact: true })).toBeVisible()
    await page.locator('.aroma-section').screenshot({ path: `artifacts/carnet-roue-${viewport.width}.png` })
    await page.getByRole('button', { name: 'Enregistrer ma fiche' }).click()
    await expect(page.getByText('Ta fiche est enregistrée.')).toBeVisible()
    const equipmentFits = await page.locator('.tasting-detail-head .tasting-equipment img').evaluate(image => {
      const bounds = image.getBoundingClientRect()
      const container = image.parentElement!.getBoundingClientRect()
      return bounds.top >= container.top && bounds.bottom <= container.bottom && bounds.left >= container.left && bounds.right <= container.right
    })
    expect(equipmentFits).toBe(true)
    await page.screenshot({ path: `artifacts/carnet-fiche-${viewport.width}.png`, fullPage: true })
    await page.getByRole('button', { name: /Ma bibliothèque/ }).click()
    const card = page.getByRole('button', { name: /Café de test/ })
    const cardEquipment = card.locator('.tasting-equipment img')
    expect(await cardEquipment.evaluate(image => image.getBoundingClientRect().bottom <= image.closest('.tasting-equipment')!.getBoundingClientRect().bottom)).toBe(true)
    await expect(card).toContainText('Citron')
    await expect(card).toContainText('Fraise')
    await page.screenshot({ path: `artifacts/carnet-bibliotheque-${viewport.width}.png`, fullPage: true })
    await page.reload()
    await page.getByRole('button', { name: /Café de test/ }).click()
    await expect(page.getByText('13 g de café')).toBeVisible()
    await page.getByRole('button', { name: 'Modifier' }).click()
    await page.getByLabel('Nom du café').fill('Café de test modifié')
    await page.getByRole('button', { name: 'Enregistrer ma fiche' }).click()
    await expect(page.getByRole('heading', { name: 'Café de test modifié' })).toBeVisible()
    await page.getByRole('button', { name: /Ma bibliothèque/ }).click()
    await page.getByText('Mon carnet', { exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter mon carnet' }).click()
    expect((await download).suggestedFilename()).toBe('coffee-101-carnet.json')
  })
}

test('bibliothèque, import et textes longs restent utilisables au zoom', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.addInitScript(() => {
    localStorage.setItem('coffee101-reduce-animations', 'true')
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2') return null
      return (original as (...values: unknown[]) => unknown).call(this, type, ...args)
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  await page.goto('/?vue=deguster')
  await expect(page.getByRole('button', { name: 'Créer ma première fiche' })).toBeVisible()
  await page.getByRole('button', { name: /Aller à Préparer/ }).click()
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
  await page.getByRole('button', { name: 'Déguster ce café' }).click()
  const longName = 'Un café très long aux impressions chocolatées et caramélisées '.repeat(3)
  await page.getByLabel('Nom du café').fill(longName)
  await page.getByRole('button', { name: 'Enregistrer ma fiche' }).click()
  await expect(page.getByText('Ta fiche est enregistrée.')).toBeVisible()
  expect(await page.locator('.tasting-detail-head .tasting-equipment img').evaluate(image => image.getBoundingClientRect().bottom <= image.parentElement!.getBoundingClientRect().bottom)).toBe(true)
  await page.getByRole('button', { name: /Ma bibliothèque/ }).click()
  await page.evaluate(() => { document.body.style.zoom = '1.5' })
  const card = page.locator('.tasting-card')
  await expect(card).toContainText('Ouvrir la fiche')
  expect(await card.locator('.tasting-equipment img').evaluate(image => image.getBoundingClientRect().bottom <= image.parentElement!.getBoundingClientRect().bottom)).toBe(true)
  await expect(page.locator('.tasting-card-surface')).toHaveCount(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const icon = page.locator('.card-open svg')
  expect(await icon.getAttribute('viewBox')).toBe('0 0 24 24')
  const geometry = await icon.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const parent = element.parentElement!.getBoundingClientRect()
    return { width: bounds.width, height: bounds.height, inside: bounds.left >= parent.left && bounds.right <= parent.right && bounds.top >= parent.top && bounds.bottom <= parent.bottom }
  })
  expect(geometry.width).toBeLessThanOrEqual(28)
  expect(geometry.height).toBeLessThanOrEqual(28)
  expect(geometry.inside).toBe(true)
  await page.getByText('Mon carnet', { exact: true }).click()
  await page.locator('.tasting-import input').setInputFiles({ name: 'carnet-invalide.json', mimeType: 'application/json', buffer: Buffer.from('{') })
  await expect(page.getByText('Fichier choisi : carnet-invalide.json')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Import impossible')
  await expect(card).toContainText(longName.trim())
})

for (const motion of ['reduce', 'no-preference'] as const) {
  for (const removed of ['Alpha', 'Bravo'] as const) {
    test(`replacement après suppression de ${removed}, mouvement ${motion}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: motion })
      const page = await context.newPage()
      const base = { date: '2026-10-01', roaster: '', country: '', region: '', altitude: '', processing: '', processingOther: '', fermentation: '', roast: '', notes: '', proposal: null, actual: '', aromas: [], aromaVersion: 1, acidity: '', bitterness: '', sweetness: '', body: '', finish: '', appreciation: '', nextTime: '' }
      await page.addInitScript(records => {
        localStorage.setItem('coffee101-reduce-animations', 'true')
        localStorage.setItem('coffee101-tastings-v1', JSON.stringify({ version: 1, drafts: [], records }))
        const original = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
          if (type === 'webgl' || type === 'webgl2') return null
          return (original as (...values: unknown[]) => unknown).call(this, type, ...args)
        } as typeof HTMLCanvasElement.prototype.getContext
      }, ['Alpha', 'Bravo', 'Charlie'].map((name, index) => ({ ...base, id: `test-${index}`, name })))
      await page.goto('/?vue=deguster')
      page.on('dialog', dialog => dialog.accept())
      const cards = page.locator('.tasting-card-surface')
      const checkGrid = async (count: number) => {
        await expect(cards).toHaveCount(count)
        if (!count) return
        await expect.poll(async () => page.locator('.tasting-grid').evaluate(grid => {
          const children = [...grid.children] as HTMLElement[]
          const rect = grid.getBoundingClientRect()
          const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
          const gap = parseFloat(getComputedStyle(grid).columnGap)
          const width = (rect.width - gap * (columns - 1)) / columns
          return children.every((child, index) => Math.abs(child.getBoundingClientRect().left - (rect.left + (index % columns) * (width + gap))) < 1 && getComputedStyle(child).gridColumn === 'auto')
        })).toBe(true)
      }
      const deleteRecord = async (name: string) => {
        await page.getByRole('button', { name: new RegExp(name) }).click()
        await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
      }
      await checkGrid(3)
      await deleteRecord(removed)
      await checkGrid(2)
      const firstRemaining = removed === 'Alpha' ? 'Bravo' : 'Alpha'
      await deleteRecord(firstRemaining)
      await checkGrid(1)
      await page.getByLabel('Rechercher').fill('Charlie')
      await checkGrid(1)
      await page.getByLabel('Rechercher').clear()
      for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(viewport)
        await checkGrid(1)
      }
      await page.getByRole('button', { name: /Charlie/ }).click()
      await page.getByRole('button', { name: /Ma bibliothèque/ }).click()
      await checkGrid(1)
      await deleteRecord('Charlie')
      await expect(page.getByRole('button', { name: 'Créer ma première fiche' })).toBeVisible()
      await page.getByRole('button', { name: 'Créer ma première fiche' }).click()
      await page.getByLabel('Nom du café').fill('Nouvelle fiche')
      await page.getByRole('button', { name: 'Enregistrer ma fiche' }).click()
      await page.getByRole('button', { name: /Ma bibliothèque/ }).click()
      await checkGrid(1)
      await context.close()
    })
  }
}