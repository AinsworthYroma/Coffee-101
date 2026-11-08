import { expect, test, type Page } from '@playwright/test'

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } })

async function imageDifference(page: Page, before: Buffer, after: Buffer) {
  return page.evaluate(async images => {
    const read = async (data: string) => {
      const image = new Image()
      image.src = `data:image/png;base64,${data}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return context.getImageData(0, 0, image.width, image.height).data
    }
    const first = await read(images[0])
    const second = await read(images[1])
    let changed = 0
    for (let index = 0; index < first.length; index += 4) {
      if (Math.abs(first[index] - second[index]) + Math.abs(first[index + 1] - second[index + 1]) + Math.abs(first[index + 2] - second[index + 2]) > 12) changed++
    }
    return changed / (first.length / 4)
  }, [before.toString('base64'), after.toString('base64')])
}

test('globe : rotation continue et préférence unique', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'false'))
  await page.goto('/?vue=explorer')
  const globe = page.locator('.globe-canvas')
  const stage = page.locator('.globe-stage')
  const setting = page.getByRole('checkbox', { name: 'Réduire les animations' })
  const positions = () => page.locator('.globe-marker').evaluateAll(markers => markers.map(marker => ({ left: (marker as HTMLElement).style.left, top: (marker as HTMLElement).style.top, hidden: (marker as HTMLElement).hidden })))
  await expect(globe).toBeVisible()
  await expect.poll(async () => (await positions()).every(position => position.left !== ''), { timeout: 30_000 }).toBe(true)
  await expect(page.locator('.globe-controls')).toHaveCount(0)
  const dimensions = await page.locator('.explorer-globe').evaluate(element => ({ outer: element.getBoundingClientRect().height, stage: element.querySelector('.globe-stage')!.getBoundingClientRect().height }))
  expect(dimensions.outer).toBe(dimensions.stage)
  const initial = await positions()
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(initial)
  await page.getByRole('button', { name: 'Afrique de l’Est', exact: true }).click()
  await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'afrique-de-l-est')
  await expect(page.locator('.globe-pin[aria-pressed="true"]')).toHaveAttribute('aria-label', 'Afficher Afrique de l’Est')
  const selected = await positions()
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(selected)
  await page.getByRole('button', { name: 'Asie', exact: true }).click()
  await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'asie')
  const changed = await positions()
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(changed)
  await globe.hover()
  const hovered = await positions()
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(hovered)
  await page.mouse.move(10, 10)
  const left = await positions()
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(left)
  await setting.evaluate(element => (element as HTMLInputElement).click())
  await expect(setting).toBeChecked()
  const stopped = await positions()
  await page.waitForTimeout(600)
  expect(await positions()).toEqual(stopped)
  await page.getByRole('button', { name: 'Amérique du Sud', exact: true }).click()
  expect(await positions()).toEqual(stopped)
  await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'amerique-du-sud')
  await expect(page.locator('.globe-marker[hidden] .globe-pin').first()).toBeHidden()
  await setting.evaluate(element => (element as HTMLInputElement).click())
  await expect(setting).not.toBeChecked()
  const resumed = await positions()
  for (let index = 0; index < stopped.length; index++) {
    expect(Math.abs(parseFloat(resumed[index].left) - parseFloat(stopped[index].left))).toBeLessThan(5)
    expect(Math.abs(parseFloat(resumed[index].top) - parseFloat(stopped[index].top))).toBeLessThan(5)
  }
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(stopped)
  const bounds = (await stage.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * .42, bounds.y + bounds.height * .45)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width * .58, bounds.y + bounds.height * .45, { steps: 6 })
  await page.mouse.up()
  const dragged = await positions()
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(dragged)
  await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'amerique-du-sud')
})

test('globe : glissement tactile et reprise de la rotation', async ({ browser }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' })
  await context.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'false'))
  try {
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4173/?vue=explorer')
    const globe = page.locator('.globe-canvas')
    const positions = () => page.locator('.globe-marker').evaluateAll(markers => markers.map(marker => (marker as HTMLElement).style.left))
    await expect(globe).toBeVisible()
    await expect.poll(async () => (await positions()).every(position => position !== ''), { timeout: 30_000 }).toBe(true)
    await page.getByRole('button', { name: 'Asie', exact: true }).tap()
    await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'asie')
    await globe.scrollIntoViewIfNeeded()
    const box = (await globe.boundingBox())!
    const session = await context.newCDPSession(page)
    const start = { x: box.x + box.width * .4, y: box.y + box.height * .6 }
    const before = await positions()
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 120, y: start.y }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const dragged = await positions()
    expect(dragged).not.toEqual(before)
    await expect.poll(positions, { timeout: 15_000 }).not.toEqual(dragged)
    const setting = page.getByRole('checkbox', { name: 'Réduire les animations' })
    await setting.tap()
    await expect(setting).toBeChecked()
    await globe.scrollIntoViewIfNeeded()
    const stopped = await positions()
    await page.waitForTimeout(600)
    expect(await positions()).toEqual(stopped)
    await setting.tap()
    await expect(setting).not.toBeChecked()
    await globe.scrollIntoViewIfNeeded()
    await expect.poll(positions, { timeout: 15_000 }).not.toEqual(stopped)
    await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'asie')
  } finally {
    await context.close()
  }
})

test.describe('atlas des origines', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
  })

  for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'ipad-portrait', width: 820, height: 1180 }]) {
    test(`introduction et navigation centrées : ${viewport.name}`, async ({ page }) => {
      test.setTimeout(60_000)
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/?vue=explorer')
      const header = page.locator('.site-header')
      const nav = page.getByRole('navigation', { name: 'Navigation principale' })
      const intro = page.locator('.explorer-details')
      const title = intro.getByRole('heading', { name: 'Le café a des histoires.' })
      const description = intro.getByText('Trois régions, autant de pistes pour découvrir les cafés du monde.')
      const origins = intro.getByRole('group', { name: 'Choisir une région' })
      await expect(header.locator('.brand')).toHaveCount(0)
      await expect(header.getByRole('link')).toHaveCount(3)
      await expect(intro.getByRole('link', { name: 'Retour à la préparation' })).toHaveCount(0)
      const geometry = await Promise.all([nav, title, description, origins, intro.locator('.kicker')].map(element => element.boundingBox()))
      const [navBox, titleBox, descriptionBox, originsBox, kickerBox] = geometry.map(box => box!)
      expect(Math.abs(navBox.x + navBox.width / 2 - viewport.width / 2)).toBeLessThan(2)
      expect(Math.abs(titleBox.x - descriptionBox.x)).toBeLessThan(1)
      expect(Math.abs(titleBox.x - originsBox.x)).toBeLessThan(1)
      expect(kickerBox.y + kickerBox.height).toBeLessThanOrEqual(titleBox.y)
      expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(descriptionBox.y)
      expect(descriptionBox.y + descriptionBox.height).toBeLessThanOrEqual(originsBox.y)
      await origins.getByRole('button', { name: 'Afrique de l’Est' }).focus()
      await page.keyboard.press('Enter')
      await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'afrique-de-l-est')
      await expect(page.locator('.origin-photo img')).toBeVisible()
      await expect(page.locator('.globe-stage')).toBeVisible()
      await expect(page.locator('.explorer-processing')).toBeAttached()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: `artifacts/explorer-correction-${viewport.name}.png` })
      await nav.getByRole('link', { name: 'Déguster' }).click()
      await expect(page.locator('.site-header .brand')).toBeVisible()
    })
  }

  test('sélection synchronisée, carte et retour du guide', async ({ page }) => {
    test.setTimeout(60_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?vue=explorer')
    const globe = page.locator('.globe-canvas')
    await expect(globe).toBeVisible()
    const card = page.locator('.origin-card')
    const choices = page.getByRole('group', { name: 'Choisir une région' })
    await expect(card.getByRole('heading', { name: 'À toi de choisir' })).toBeVisible()
    await expect(page.locator('.origin-card')).toHaveCount(1)
    for (const [name, id] of [['Afrique de l’Est', 'afrique-de-l-est'], ['Asie', 'asie'], ['Amérique du Sud', 'amerique-du-sud']]) {
      await choices.getByRole('button', { name, exact: true }).focus()
      await page.keyboard.press('Enter')
      await expect(card).toHaveAttribute('data-origin', id)
      await expect(choices.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
      const marker = page.getByRole('button', { name: `Afficher ${name}`, includeHidden: true })
      await expect(marker).toHaveAttribute('aria-pressed', 'true')
      for (const title of ['En tasse', 'Altitudes & origines']) await expect(card.locator('summary').getByText(title, { exact: true })).toBeVisible()
      for (const title of ['Traitements', 'Sources']) {
        const section = card.locator('details').filter({ has: page.getByText(title, { exact: true }) })
        if (!(await section.evaluate(element => element.hasAttribute('open')))) await section.locator('summary').click()
        await expect(section.locator('p, a').first()).toBeVisible()
      }
    }
    await choices.getByRole('button', { name: 'Asie', exact: true }).click()
    await globe.evaluate(element => { (element as HTMLElement).style.backgroundColor = '#26180f' })
    const before = await globe.screenshot()
    const link = card.getByRole('link', { name: /Wet-hulled/ })
    await link.scrollIntoViewIfNeeded()
    const scroll = await page.evaluate(() => window.scrollY)
    await link.click()
    await expect(page).toHaveURL(/guide=traitements#wet-hulled$/)
    await page.getByRole('link', { name: 'Retour à l’atlas' }).click()
    await expect(card).toHaveAttribute('data-origin', 'asie')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0)
    const after = await globe.screenshot()
    expect(await imageDifference(page, before, after)).toBeLessThan(.005)
  })

  test('raccord projeté et disparition derrière le globe', async ({ page }) => {
    test.setTimeout(60_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?vue=explorer')
    const globe = page.locator('.globe-canvas')
    await expect(globe).toBeVisible()
    await page.getByRole('button', { name: 'Afrique de l’Est', exact: true }).click()
    const marker = page.getByRole('button', { name: 'Afficher Afrique de l’Est', includeHidden: true })
    const line = page.locator('.origin-connector line')
    const box = (await globe.boundingBox())!
    let seen = false
    for (let index = 0; index < 100; index++) {
      await page.mouse.move(box.x + box.width * .15, box.y + box.height * .2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width * .15 + 8, box.y + box.height * .2)
      await page.mouse.up()
      if (await line.evaluate(element => getComputedStyle(element).display !== 'none')) {
        seen = true
        const measure = () => page.evaluate(() => {
          const atlas = document.querySelector('.explorer-atlas')!.getBoundingClientRect()
          const card = document.querySelector('.origin-card')!.getBoundingClientRect()
          const pin = document.querySelector<HTMLButtonElement>('.globe-pin[aria-pressed=true]')!.getBoundingClientRect()
          const connector = document.querySelector<SVGLineElement>('.origin-connector line')!
          const stage = document.querySelector('.globe-stage')!.getBoundingClientRect()
          const marker = document.querySelector<HTMLElement>('.globe-pin[aria-pressed=true]')!.parentElement!
          const markerBounds = marker.getBoundingClientRect()
          return { start: Number(connector.getAttribute('x1')) + atlas.left - card.right, endX: Number(connector.getAttribute('x2')) + atlas.left - pin.left - pin.width / 2, endY: Number(connector.getAttribute('y2')) + atlas.top - pin.top - pin.height / 2, stage: { left: stage.left - atlas.left, top: stage.top - atlas.top, width: stage.width, height: stage.height }, marker: marker.style.cssText, markerBounds: { left: markerBounds.left - stage.left, top: markerBounds.top - stage.top, width: markerBounds.width, height: markerBounds.height }, markerTransform: getComputedStyle(marker).transform, offsetParent: marker.offsetParent?.className, markerPosition: getComputedStyle(marker).position, pinBounds: { left: pin.left - stage.left, top: pin.top - stage.top, width: pin.width, height: pin.height }, line: connector.outerHTML }
        })
        const aligned = await measure()
        expect(Math.max(Math.abs(aligned.start), Math.abs(aligned.endX), Math.abs(aligned.endY)), JSON.stringify(aligned)).toBeLessThan(1)
      }
      if (seen && await marker.isHidden()) { await expect(line).toHaveCSS('display', 'none'); break }
    }
    expect(seen).toBe(true)
    await expect(marker).toBeHidden()
  })

  test('marqueur cliquable, face arrière cachée et glissement sans sélection', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?vue=explorer')
    await expect(page.locator('.globe-canvas')).toBeVisible()
    await expect(page.locator('.globe-marker[hidden] .globe-pin').first()).toBeHidden()
    const marker = page.locator('.globe-marker:not([hidden]) .globe-pin').first()
    await marker.click()
    await expect(marker).toHaveAttribute('aria-pressed', 'true')
    const version = await page.locator('.origin-card').getAttribute('data-selection-version')
    const bounds = (await marker.boundingBox())!
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await page.mouse.move(bounds.x + bounds.width / 2 + 55, bounds.y + bounds.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect(page.locator('.origin-card')).toHaveAttribute('data-selection-version', version!)
  })

  test('fiches et guide accessibles sans WebGL', async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
        if (type.startsWith('webgl')) return null
        return (getContext as Function).call(this, type, ...args)
      } as typeof HTMLCanvasElement.prototype.getContext
    })
    await page.goto('/?vue=explorer')
    await expect(page.getByRole('img', { name: 'Carte plane des continents' })).toBeVisible()
    await page.getByRole('button', { name: 'Asie', exact: true }).click()
    await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'asie')
    await page.locator('.origin-card summary').getByText('Traitements').click()
    await page.locator('.origin-card').getByRole('link', { name: /Wet-hulled/ }).click()
    await expect(page).toHaveURL(/#wet-hulled$/)
    await page.getByRole('link', { name: 'Retour à l’atlas' }).click()
    await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'asie')
  })

  test('sélection et glissement tactiles sur les repères', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
    await context.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4173/?vue=explorer')
    await expect(page.locator('.globe-canvas')).toBeVisible()
    const marker = page.locator('.globe-marker:not([hidden]) .globe-pin').first()
    await marker.tap()
    const card = page.locator('.origin-card')
    await expect(marker).toHaveAttribute('aria-pressed', 'true')
    const version = await card.getAttribute('data-selection-version')
    const box = (await marker.boundingBox())!
    const session = await context.newCDPSession(page)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 65, y }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(card).toHaveAttribute('data-selection-version', version!)
    await context.close()
  })

  test('sélection hors écran sans mouvement réduit', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/?vue=explorer')
    await expect(page.locator('.globe-canvas')).toBeVisible()
    const choice = page.getByRole('button', { name: 'Asie', exact: true })
    await choice.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(300)
    await choice.click()
    await page.locator('.globe-stage').scrollIntoViewIfNeeded()
    await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'asie')
    await expect(page.getByRole('button', { name: 'Afficher Asie', includeHidden: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('la sélection ne recentre pas le globe immobile', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/?vue=explorer')
    await expect(page.locator('.globe-canvas')).toBeVisible()
    const positions = () => page.locator('.globe-marker').evaluateAll(markers => markers.map(marker => (marker as HTMLElement).style.cssText))
    const before = await positions()
    await page.getByRole('button', { name: 'Afrique de l’Est', exact: true }).click()
    await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'afrique-de-l-est')
    expect(await positions()).toEqual(before)
  })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }, { width: 1024, height: 1366 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    test(`atlas lisible à ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/?vue=explorer')
      await expect(page.locator('.globe-canvas')).toBeVisible()
      await page.getByRole('button', { name: 'Asie', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Afficher Asie', includeHidden: true })).toHaveAttribute('aria-pressed', 'true')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const positions = await page.evaluate(() => {
        const globe = document.querySelector('.explorer-earth')!.getBoundingClientRect()
        const details = document.querySelector('.explorer-details')!.getBoundingClientRect()
        return { globeRight: globe.right, globeBottom: globe.bottom, detailsLeft: details.left, detailsTop: details.top }
      })
      expect(positions.detailsTop).toBeLessThan(positions.globeBottom)
    })
  }
})

test('revue photographique de l’atlas et sélections rapides', async ({ browser }) => {
  test.setTimeout(120_000)
  const selections = [
    { name: 'Amérique du Sud', id: 'amerique-du-sud', image: 'minas-gerais.jpg' },
    { name: 'Afrique de l’Est', id: 'afrique-de-l-est', image: 'ouganda.jpg' },
    { name: 'Asie', id: 'asie', image: 'gumitir.jpg' },
  ]
  for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['ipad', { width: 820, height: 1180 }]] as const) {
    const context = await browser.newContext({ viewport, hasTouch: label === 'ipad', reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4173/?vue=explorer')
    await expect(page.locator('.globe-canvas')).toBeVisible()
    const atlas = page.locator('.explorer-atlas')
    const card = page.locator('.origin-card')
    await expect(page.locator('.origin-previews img')).toHaveCount(3)
    await atlas.screenshot({ path: `artifacts/atlas-voyage-${label}-initial.png` })
    const heights: number[] = []
    for (const selection of selections) {
      const choice = page.getByRole('group', { name: 'Choisir une région' }).getByRole('button', { name: selection.name, exact: true })
      if (label === 'ipad') await choice.tap()
      else { await choice.focus(); await page.keyboard.press('Enter') }
      await expect(card).toHaveAttribute('data-origin', selection.id)
      await expect(choice).toHaveAttribute('aria-pressed', 'true')
      await expect(card.locator('.origin-photo img')).toHaveAttribute('src', new RegExp(selection.image))
      await expect.poll(() => card.locator('.origin-photo img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      await expect(page.getByRole('button', { name: `Afficher ${selection.name}`, includeHidden: true })).toHaveAttribute('aria-pressed', 'true')
      heights.push(await card.evaluate(element => element.getBoundingClientRect().height))
      await atlas.screenshot({ path: `artifacts/atlas-voyage-${label}-${selection.id}.png` })
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2)
    await card.locator('summary').getByText('Altitudes & origines', { exact: true }).click()
    await expect(card.getByText(/hauts plateaux de Gayo/)).toBeVisible()
    await atlas.screenshot({ path: `artifacts/atlas-voyage-${label}-details.png` })
    await expect(page.locator('.origin-destination')).toHaveCSS('animation-name', 'none')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await context.close()
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'artifacts', size: { width: 1440, height: 900 } } })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/?vue=explorer')
  await expect(page.locator('.globe-canvas')).toBeVisible()
  await page.waitForTimeout(500)
  const choices = page.getByRole('group', { name: 'Choisir une région' })
  await choices.getByRole('button', { name: 'Amérique du Sud', exact: true }).click()
  await page.waitForTimeout(900)
  await choices.getByRole('button', { name: 'Afrique de l’Est', exact: true }).click()
  await choices.getByRole('button', { name: 'Asie', exact: true }).click()
  await expect(page.locator('.origin-card')).toHaveAttribute('data-origin', 'asie')
  await expect(page.getByRole('button', { name: 'Afficher Asie', includeHidden: true })).toHaveAttribute('aria-pressed', 'true')
  await page.waitForTimeout(900)
  const video = page.video()!
  await context.close()
  await video.saveAs('artifacts/atlas-voyage-interactions.webm')
})

test.describe('guide des traitements', () => {
  test('galerie au clavier et panneau conservé au retour', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
    await page.goto('/?vue=explorer')
    const gallery = page.locator('.accordion-gallery')
    const first = gallery.getByRole('button', { name: /Lavé/ })
    await first.focus()
    await page.keyboard.press('ArrowRight')
    const nature = gallery.getByRole('button', { name: /Nature/ })
    await expect(nature).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(nature).toHaveAttribute('aria-expanded', 'true')
    await gallery.getByRole('link', { name: 'Découvrir : Nature' }).click()
    await expect(page).toHaveURL(/#nature$/)
    await page.getByRole('link', { name: 'Retour à l’atlas' }).click()
    await page.mouse.move(0, 0)
    await expect(nature).toHaveAttribute('aria-expanded', 'true')
    await expect(gallery.locator('.ag-art img')).toHaveCount(5)
    await gallery.getByRole('button', { name: /Fermentations particulières/ }).click()
    await expect(gallery.getByText('Une étape transversale')).toBeVisible()
  })

  test('aperçu à la souris sans perdre le panneau choisi', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      localStorage.setItem('coffee101-reduce-animations', 'true')
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) { return type.startsWith('webgl') ? null : (getContext as Function).call(this, type, ...args) } as typeof HTMLCanvasElement.prototype.getContext
    })
    await page.goto('/?vue=explorer')
    const gallery = page.locator('.accordion-gallery')
    const nature = gallery.getByRole('button', { name: /Nature/ })
    await nature.click()
    await page.mouse.move(0, 0)
    await expect(nature).toHaveAttribute('aria-expanded', 'true')
    const honey = gallery.getByRole('button', { name: /Honey et pulped natural/ })
    await honey.hover()
    await expect(honey).toHaveAttribute('aria-expanded', 'true')
    await page.mouse.move(0, 0)
    await expect(nature).toHaveAttribute('aria-expanded', 'true')
  })

  test('panneau tactile conservé au retour du guide', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, reducedMotion: 'reduce' })
    await context.addInitScript(() => {
      localStorage.setItem('coffee101-reduce-animations', 'true')
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) { return type.startsWith('webgl') ? null : (getContext as Function).call(this, type, ...args) } as typeof HTMLCanvasElement.prototype.getContext
    })
    const page = await context.newPage()
    await page.route('**/data/ne_110m_admin_0_countries.geojson', route => route.abort())
    await page.goto('http://127.0.0.1:4173/?vue=explorer')
    const gallery = page.locator('.accordion-gallery')
    const honey = gallery.getByRole('button', { name: /Honey et pulped natural/ })
    await honey.tap()
    await expect(honey).toHaveAttribute('aria-expanded', 'true')
    await gallery.getByRole('link', { name: 'Découvrir : Honey et pulped natural' }).tap()
    await expect(page).toHaveURL(/#honey$/)
    await page.getByRole('link', { name: 'Retour à l’atlas' }).tap()
    await expect(honey).toHaveAttribute('aria-expanded', 'true')
    await context.close()
  })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    test(`galerie sans débordement à ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
      await page.goto('/?vue=explorer')
      await expect(page.locator('.globe-canvas')).toBeVisible()
      const gallery = page.locator('.accordion-gallery')
      for (const title of ['Lavé', 'Nature', 'Honey et pulped natural', 'Wet-hulled', 'Fermentations particulières']) {
        await gallery.getByRole('button', { name: new RegExp(title) }).click()
        await expect(gallery.getByRole('link', { name: `Découvrir : ${title}` })).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
      await page.screenshot({ path: `test-results/explorer-${viewport.width}.png` })
      const image = await page.locator('.globe-canvas').screenshot()
      const colors = await page.evaluate(async data => {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width; canvas.height = image.height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        const colors = new Set<string>()
        for (let index = 0; index < pixels.length; index += 400) colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`)
        return colors.size
      }, image.toString('base64'))
      expect(colors).toBeGreaterThan(30)
    })
  }

  test('liens directs, état du globe et historique de l’atlas', async ({ page }) => {
    test.setTimeout(60_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
    await page.goto('/?vue=explorer')
    const globe = page.locator('.globe-canvas')
    await expect(globe).toBeVisible()
    await globe.evaluate(element => element.setAttribute('data-preserved', 'oui'))
    const box = (await globe.boundingBox())!
    await page.mouse.move(box.x + box.width * .15, box.y + box.height * .2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * .25, box.y + box.height * .2, { steps: 4 })
    await page.mouse.up()
    await globe.evaluate(element => { (element as HTMLElement).style.backgroundColor = '#26180f' })
    const before = await globe.screenshot()
    const link = page.locator('.explorer-processing').getByRole('link', { name: 'Découvrir : Lavé' })
    await link.scrollIntoViewIfNeeded()
    const scroll = await page.evaluate(() => window.scrollY)
    await link.click()
    await expect(page).toHaveURL(/guide=traitements#lave$/)
    await expect(page.getByRole('heading', { name: 'Lavé', exact: true })).toBeVisible()
    await expect(page.locator('#lave')).toBeFocused()
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Explorer' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('link', { name: 'Retour à l’atlas' })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/vue=explorer$/)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0)
    await expect(globe).toHaveAttribute('data-preserved', 'oui')
    await page.goForward()
    await expect(page).toHaveURL(/guide=traitements#lave$/)
    await page.getByRole('link', { name: 'Retour à l’atlas' }).click()
    await expect(page).toHaveURL(/vue=explorer$/)
    await expect(globe).toHaveAttribute('data-preserved', 'oui')
    await expect(page.getByRole('checkbox', { name: 'Réduire les animations' })).toBeChecked()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, 0)
    expect(await imageDifference(page, before, await globe.screenshot())).toBeLessThan(.005)
    await page.goBack()
    await expect(page).toHaveURL(/guide=traitements#lave$/)
    await page.goForward()
    await expect(page).toHaveURL(/vue=explorer$/)
    await expect(globe).toHaveAttribute('data-preserved', 'oui')
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/guide=traitements#lave$/)
    await page.getByRole('link', { name: 'Retour à l’atlas' }).click()
    await expect(page.getByRole('checkbox', { name: 'Réduire les animations' })).toBeChecked()
    await expect(globe).toHaveAttribute('data-preserved', 'oui')
  })

  test('liens de l’atlas utilisables sans WebGL', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      localStorage.setItem('coffee101-reduce-animations', 'true')
      const getContext = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
        if (type.startsWith('webgl')) return null
        return (getContext as Function).call(this, type, ...args)
      } as typeof HTMLCanvasElement.prototype.getContext
    })
    await page.goto('/?vue=explorer')
    await expect(page.getByRole('img', { name: 'Carte plane des continents' })).toBeVisible()
    for (const [section, title] of [['lave', 'Lavé'], ['nature', 'Nature'], ['honey', 'Honey et pulped natural'], ['wet-hulled', 'Wet-hulled'], ['fermentations', 'Fermentations particulières']]) {
      await page.locator('.explorer-processing').getByRole('button', { name: new RegExp(title) }).click()
      await page.locator('.explorer-processing').getByRole('link', { name: `Découvrir : ${title}` }).click()
      await expect(page).toHaveURL(new RegExp(`guide=traitements#${section}$`))
      await expect(page.locator(`#${section}`)).toBeFocused()
      await page.getByRole('link', { name: 'Retour à l’atlas' }).click()
    }
  })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    test(`sections et lecture à ${viewport.width} px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
      for (const [section, title] of [['lave', 'Lavé'], ['nature', 'Nature'], ['honey', 'Honey et pulped natural'], ['wet-hulled', 'Wet-hulled'], ['fermentations', 'Fermentations particulières']]) {
        await page.goto(`/?vue=explorer&guide=traitements#${section}`)
        await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
        await expect(page.locator(`#${section}`)).toBeFocused()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
      const navigation = page.getByRole('navigation', { name: 'Navigation principale' })
      await expect(navigation.getByRole('link')).toHaveCount(3)
      await expect(navigation.getByRole('link', { name: 'Explorer' })).toHaveAttribute('aria-current', 'page')
      await page.getByRole('link', { name: 'Retour à l’atlas' }).click()
      await expect(page.getByRole('heading', { name: 'Les origines' })).toBeVisible()
    })
  }
})

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'ipad-paysage', width: 1180, height: 820 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'telephone', width: 390, height: 844 },
]) {
  test(`rendu et mise en page : ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /un café à la fois/i })).toBeVisible()
    await expect(page.locator('.liquid-ether__canvas')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Réduire les animations' })).not.toBeChecked()
    await expect(page.locator('.crema-toggle')).toHaveCount(0)
    await expect(page.locator('.journey-strip')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/${viewport.name}.png`, fullPage: true })
    const textBounds = await page.locator('.hero-intro').boundingBox()
    await page.locator('.hero-copy').evaluate(element => { element.style.visibility = 'hidden' })
    await page.waitForTimeout(300)
    const background = await page.screenshot()
    const contrast = await page.evaluate(async ({ imageData, bounds }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${imageData}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const luminance = (red: number, green: number, blue: number) => {
        const [r, g, b] = [red, green, blue].map(value => value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const foreground = luminance(240, 223, 200)
      let minimum = Infinity
      for (let x = bounds.x; x < bounds.x + bounds.width; x += 10) {
        for (let y = bounds.y; y < bounds.y + bounds.height; y += 10) {
          const pixel = context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
          const background = luminance(pixel[0], pixel[1], pixel[2])
          minimum = Math.min(minimum, (foreground + 0.05) / (background + 0.05))
        }
      }
      return minimum
    }, { imageData: background.toString('base64'), bounds: textBounds! })
    expect(contrast).toBeGreaterThan(4.5)
  })
}

test('titres Bricolage chargés et lisibles aux formats principaux', async ({ browser }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' })
    const session = await page.context().newCDPSession(page)
    await session.send('DOM.enable')
    await session.send('CSS.enable')
    for (const view of ['preparer', 'deguster']) {
      await page.goto(`http://127.0.0.1:4173/?vue=${view}`)
      await page.evaluate(() => document.fonts.ready)
      const selectors = view === 'preparer' ? ['.hero h1', '.preparation-heading h2'] : ['.preview h1']
      for (const selector of selectors) {
        const heading = page.locator(selector)
        const style = await heading.evaluate(element => {
          const computed = getComputedStyle(element)
          const emphasis = getComputedStyle(element.querySelector('em')!)
          const rect = element.getBoundingClientRect()
          const lines = document.createRange()
          lines.selectNodeContents(element)
          const textRects = Array.from(lines.getClientRects()).filter(box => box.width > 0)
          return { family: computed.fontFamily, weight: computed.fontWeight, optical: computed.fontVariationSettings, style: emphasis.fontStyle, emphasisFamily: emphasis.fontFamily, emphasisWeight: emphasis.fontWeight, left: rect.left, right: rect.right, textRight: Math.max(...textRects.map(box => box.right)), lines: new Set(textRects.map(box => Math.round(box.top))).size }
        })
        expect(style.family).toContain('Bricolage Grotesque')
        expect(style.weight).toBe(selector === '.hero h1' ? '800' : '700')
        expect(style.optical).toContain('"opsz" 72')
        expect(style.style).toBe('normal')
        expect(style.emphasisFamily).toBe(style.family)
        expect(style.emphasisWeight).toBe(style.weight)
        expect(style.left).toBeGreaterThanOrEqual(0)
        expect(style.textRight).toBeLessThanOrEqual(style.right + 1)
        expect(style.right).toBeLessThanOrEqual(viewport.width)
        if (selector !== '.preparation-heading h2') expect(style.lines).toBe(2)
        const document = await session.send('DOM.getDocument')
        const { nodeId } = await session.send('DOM.querySelector', { nodeId: document.root.nodeId, selector })
        const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId })
        expect(fonts.some(font => font.isCustomFont && font.familyName.includes('Bricolage Grotesque') && font.glyphCount > 0)).toBe(true)
        expect(fonts.every(font => font.familyName.includes('Bricolage Grotesque'))).toBe(true)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    }
    await page.close()
  }
})

test('navigation directe, historique, clavier et redimensionnement', async ({ page }) => {
  await page.goto('/?vue=explorer')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('link', { name: 'Explorer' })).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.crema-background')).toHaveCount(1)
  await expect(page.locator('.crema-toggle')).toHaveCount(0)
  await nav.getByRole('link', { name: 'Déguster' }).focus()
  expect(await nav.getByRole('link', { name: 'Déguster' }).evaluate(element => element.matches(':focus-visible'))).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/vue=deguster/)
  await expect(nav.getByRole('link', { name: 'Déguster' })).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await expect(nav.getByRole('link', { name: 'Explorer' })).toHaveAttribute('aria-current', 'page')
  await page.goForward()
  await expect(nav.getByRole('link', { name: 'Déguster' })).toHaveAttribute('aria-current', 'page')
  await page.setViewportSize({ width: 820, height: 1180 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(200)
  const alignment = () => page.evaluate(() => {
    const active = document.querySelector('.gooey-nav__list:not(.gooey-nav__list--active) [aria-current="page"]')!.getBoundingClientRect()
    const overlay = document.querySelector<HTMLElement>('.gooey-nav__list--active')!
    const stage = overlay.getBoundingClientRect()
    const path = getComputedStyle(overlay).clipPath.match(/M\s*([\d.]+)[, ]+([\d.]+)\s*H\s*([\d.]+)/i)
    if (!path) return { x: Infinity, y: Infinity, width: Infinity }
    const radius = active.height / 2
    return { x: Math.abs(stage.x + Number(path[1]) - radius - active.x), y: Math.abs(stage.y + Number(path[2]) - active.y), width: Math.abs(Number(path[3]) - Number(path[1]) + 2 * radius - active.width) }
  })
  await expect.poll(async () => (await alignment()).x).toBeLessThan(2)
  expect((await alignment()).y).toBeLessThan(2)
  expect((await alignment()).width).toBeLessThan(2)
  await nav.getByRole('link', { name: 'Préparer' }).click()
  await expect(page).toHaveURL(/vue=preparer/)
  await expect(page.locator('.liquid-ether__canvas')).toBeVisible()
})

test('animation autonome, préférence persistante et visibilité', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const state = window as Window & { cremaDraws: number }
    state.cremaDraws = 0
    const original = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      if (this.canvas instanceof HTMLCanvasElement && this.canvas.classList.contains('liquid-ether__canvas')) state.cremaDraws++
      return original.apply(this, args)
    }
  })
  await page.goto('/')
  const count = () => page.evaluate(() => (window as Window & { cremaDraws: number }).cremaDraws)
  await expect.poll(count).toBeGreaterThan(0)
  await expect(page.locator('.crema-background')).toHaveCSS('pointer-events', 'none')
  const preference = page.getByRole('checkbox', { name: 'Réduire les animations' })
  await preference.focus()
  await page.keyboard.press('Space')
  await expect(preference).toBeChecked()
  await page.waitForTimeout(250)
  const paused = await count()
  await page.mouse.move(900, 400)
  await page.mouse.click(1000, 500)
  await page.waitForTimeout(350)
  expect(await count()).toBe(paused)
  await preference.uncheck()
  await expect.poll(count).toBeGreaterThan(paused)
  await page.locator('#hero-title').scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(250)
  const hidden = await count()
  await page.waitForTimeout(350)
  expect(await count()).toBe(hidden)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(count).toBeGreaterThan(hidden)
  await page.locator('.liquid-ether__canvas').evaluate(canvas => { canvas.setAttribute('data-persistent', 'yes') })
  await page.getByRole('navigation').getByRole('link', { name: 'Explorer' }).click()
  await expect(page.locator('.liquid-ether__canvas')).toHaveAttribute('data-persistent', 'yes')
  const secondary = await count()
  await expect.poll(count).toBeGreaterThan(secondary)
  await preference.check()
  await page.getByRole('navigation').getByRole('link', { name: 'Déguster' }).click()
  await expect(preference).toBeChecked()
  await page.reload()
  await expect(preference).toBeChecked()
})

test('grain fixe visible et sélection dans les vues de lecture', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?vue=deguster')
  await expect(page.getByRole('heading', { name: /à la découverte de tes goûts/i })).toBeVisible()
  const fruity = page.getByRole('button', { name: 'Fruité' })
  await expect(fruity).toHaveAttribute('aria-pressed', 'false')
  await fruity.click()
  await expect(fruity).toHaveAttribute('aria-pressed', 'true')
  await fruity.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  expect(await fruity.evaluate(element => element.matches(':focus-visible'))).toBe(true)
  await page.waitForTimeout(300)
  const textured = await page.screenshot()
  await page.waitForTimeout(300)
  expect(textured.equals(await page.screenshot())).toBe(true)
  await page.evaluate(() => document.documentElement.style.setProperty('--grain-intensity', '0'))
  await page.waitForTimeout(300)
  expect(textured.equals(await page.screenshot())).toBe(false)
  await page.getByRole('navigation').getByRole('link', { name: 'Explorer' }).click()
  await expect(page.getByRole('heading', { name: 'Les origines' })).toBeVisible()
  await expect(page.locator('.crema-background')).toHaveCount(1)
  await page.evaluate(() => document.documentElement.style.removeProperty('--grain-intensity'))
  await page.getByRole('navigation').getByRole('link', { name: 'Préparer' }).click()
  await page.waitForTimeout(300)
  const texturedCrema = await page.screenshot()
  await page.evaluate(() => document.documentElement.style.setProperty('--grain-intensity', '0'))
  await page.waitForTimeout(300)
  expect(texturedCrema.equals(await page.screenshot())).toBe(false)
})

test('globe : rendu, rotation, pause et glissement', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'false'))
  await page.goto('/?vue=explorer')
  const globe = page.locator('.globe-canvas')
  await expect(globe).toBeVisible()
  const setting = page.getByRole('checkbox', { name: 'Réduire les animations' })
  await expect(setting).not.toBeChecked()
  const initial = await globe.screenshot()
  const colors = await page.evaluate(async data => {
    const image = new Image()
    image.src = `data:image/png;base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let land = 0
    let water = 0
    for (let index = 0; index < pixels.length; index += 64) {
      const [red, green, blue] = [pixels[index], pixels[index + 1], pixels[index + 2]]
      if (red > 140 && red > green * 1.1 && green > blue * 1.1) land++
      if (green > red && blue > red && green < 170) water++
    }
    return { land, water }
  }, initial.toString('base64'))
  expect(colors.land).toBeGreaterThan(100)
  expect(colors.water).toBeGreaterThan(100)
  await page.waitForTimeout(1400)
  expect(initial.equals(await globe.screenshot())).toBe(false)
  await setting.evaluate(element => (element as HTMLInputElement).click())
  await page.waitForTimeout(300)
  const paused = await globe.screenshot()
  await page.waitForTimeout(600)
  expect(paused.equals(await globe.screenshot())).toBe(true)
  const box = (await globe.boundingBox())!
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .5, { steps: 8 })
  await page.mouse.up()
  const dragged = await globe.screenshot()
  expect(paused.equals(dragged)).toBe(false)
  await page.waitForTimeout(1800)
  expect(dragged.equals(await globe.screenshot())).toBe(true)
  await setting.evaluate(element => (element as HTMLInputElement).click())
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .6, box.y + box.height * .5, { steps: 5 })
  const positions = () => page.locator('.globe-marker').evaluateAll(markers => markers.map(marker => (marker as HTMLElement).style.cssText))
  const held = await positions()
  await page.waitForTimeout(500)
  expect(await positions()).toEqual(held)
  await page.mouse.up()
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(held)
})

test('papier kraft fixe derrière les surfaces de lecture', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?vue=deguster')
  await expect(page.locator('.preview-surface')).toHaveCSS('background-color', 'rgba(198, 164, 119, 0.82)')
  await page.waitForTimeout(500)
  const paper = await page.screenshot()
  await page.waitForTimeout(400)
  expect(paper.equals(await page.screenshot())).toBe(true)
  await page.addStyleTag({ content: '.preview-surface::before { opacity: 0 }' })
  await page.waitForTimeout(300)
  expect(paper.equals(await page.screenshot())).toBe(false)
})

test('crema visible en mouvement sous le kraft des deux vues', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const view of ['explorer', 'deguster']) {
    await page.goto(`/?vue=${view}`)
    await expect(page.locator('.liquid-ether__canvas')).toBeVisible()
    await page.addStyleTag({ content: '.preview-surface > * { visibility: hidden }' })
    await page.waitForTimeout(1400)
    const region = { x: 0, y: 120, width: 1440, height: 650 }
    const first = await page.screenshot({ clip: region })
    await page.waitForTimeout(2500)
    const second = await page.screenshot({ clip: region })
    expect(first.equals(second)).toBe(false)
    expect(await page.locator('.preview-surface').evaluate(element => getComputedStyle(element).opacity)).toBe('1')
    expect(await page.locator(view === 'explorer' ? '.explorer-details' : '.preview-copy').evaluate(element => getComputedStyle(element).opacity)).toBe('1')
  }
})

test('préférence disponible sans stockage', async ({ browser }) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Stockage indisponible') } })
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/')
  const setting = page.getByRole('checkbox', { name: 'Réduire les animations' })
  await setting.check()
  await expect(setting).toBeChecked()
  await page.getByRole('navigation').getByRole('link', { name: 'Déguster' }).click()
  await expect(setting).toBeChecked()
  await context.close()
})

test('contraste des textes sur le kraft animé', async ({ browser }) => {
  test.setTimeout(180_000)
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }]) {
    const page = await browser.newPage({ viewport })
    for (const view of ['explorer', 'deguster']) {
      await page.goto(`http://127.0.0.1:4173/?vue=${view}`)
      await page.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; await document.fonts.ready })
      if (view === 'explorer') await expect(page.locator('.globe-canvas')).toBeVisible()
      const text = page.locator(view === 'explorer' ? '.explorer-details > p:not(.kicker)' : '.preview-copy > p:not(.kicker)').first()
      await text.scrollIntoViewIfNeeded()
      const details = await text.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        const color = getComputedStyle(element).color.match(/\d+/g)!.map(Number)
        element.style.visibility = 'hidden'
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, color }
      })
      for (let frame = 0; frame < 2; frame++) {
        await page.waitForTimeout(1200)
        const image = await page.screenshot()
        const contrast = await page.evaluate(async ({ data, details }) => {
          const image = new Image()
          image.src = `data:image/png;base64,${data}`
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const context = canvas.getContext('2d')!
          context.drawImage(image, 0, 0)
          const luminance = (color: number[]) => {
            const [red, green, blue] = color.map(value => value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4)
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue
          }
          const foreground = luminance(details.color)
          let minimum = Infinity
          for (let x = details.x; x < details.x + details.width; x += 8) {
            for (let y = details.y; y < details.y + details.height; y += 8) {
              const background = luminance(Array.from(context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data).slice(0, 3))
              minimum = Math.min(minimum, (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05))
            }
          }
          return minimum
        }, { data: image.toString('base64'), details })
        expect(contrast, `${view} ${viewport.width} frame ${frame}`).toBeGreaterThan(4.5)
      }
    }
    await page.close()
  }
})

test('globe : mouvement réduit, toucher et secours WebGL', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, reducedMotion: 'reduce', viewport: { width: 820, height: 1180 } })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/?vue=explorer')
  const globe = page.locator('.globe-canvas')
  await expect(globe).toBeVisible()
  const initial = await globe.screenshot()
  await page.waitForTimeout(500)
  expect(initial.equals(await globe.screenshot())).toBe(true)
  const box = (await globe.boundingBox())!
  const session = await context.newCDPSession(page)
  const start = { x: box.x + box.width * .4, y: box.y + box.height * .5 }
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 120, y: start.y }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect(initial.equals(await globe.screenshot())).toBe(false)
  await expect(page.getByRole('list', { name: 'Liste des origines' })).toBeVisible()
  await context.close()

  const fallback = await browser.newContext()
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl') return null
      return original.call(this, type as '2d', ...args as [])
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  const fallbackPage = await fallback.newPage()
  await fallbackPage.goto('http://127.0.0.1:4173/?vue=explorer')
  await expect(fallbackPage.getByRole('img', { name: 'Carte plane des continents' })).toBeVisible()
  await expect(fallbackPage.getByRole('list', { name: 'Liste des origines' })).toBeVisible()
  await fallback.close()
})

test('globe : onglet masqué et perte du contexte', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'false'))
  await page.goto('/?vue=explorer')
  const globe = page.locator('.globe-canvas')
  await expect(globe).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(300)
  const positions = () => page.locator('.globe-marker').evaluateAll(markers => markers.map(marker => (marker as HTMLElement).style.cssText))
  const hidden = await positions()
  await page.waitForTimeout(500)
  expect(await positions()).toEqual(hidden)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(positions, { timeout: 15_000 }).not.toEqual(hidden)
  const supported = await globe.evaluate(canvas => {
    const extension = (canvas as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    return Boolean(extension)
  })
  expect(supported).toBe(true)
  await expect(page.getByRole('img', { name: 'Carte plane des continents' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Liste des origines' })).toBeVisible()
})

test('secours lorsque WebGL est indisponible ou échoue', async ({ browser }) => {
  for (const throws of [false, true]) {
    const context = await browser.newContext()
    await context.addInitScript(throws => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
        if (type === 'webgl2') {
          if (throws) throw new Error('WebGL indisponible')
          return null
        }
        return original.call(this, type as '2d', ...args as [])
      } as typeof HTMLCanvasElement.prototype.getContext
    }, throws)
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('http://127.0.0.1:4173/')
    await expect(page.locator('.crema-fallback')).toBeVisible()
    await expect(page.locator('.gooey-nav__fallback')).toBeVisible()
    await page.getByRole('navigation').getByRole('link', { name: 'Explorer' }).click()
    await expect(page).toHaveURL(/vue=explorer/)
    expect(errors).toEqual([])
    await context.close()
  }
})

test('préférence de mouvement modifiée pendant la visite', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.liquid-ether__canvas')).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(300)
  const first = await page.locator('.liquid-ether__canvas').screenshot()
  await page.waitForTimeout(500)
  expect(first.equals(await page.locator('.liquid-ether__canvas').screenshot())).toBe(true)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(1000)
  expect(first.equals(await page.locator('.liquid-ether__canvas').screenshot())).toBe(false)
})

test('perte du contexte WebGL du fond', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.liquid-ether__canvas')).toBeVisible()
  const supported = await page.locator('.liquid-ether__canvas').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')!
    const extension = gl.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    return Boolean(extension)
  })
  expect(supported).toBe(true)
  await expect(page.locator('.crema-fallback')).toBeVisible()
})

test('pause et navigation au toucher émulé', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 1180 } })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/')
  await page.getByRole('checkbox', { name: 'Réduire les animations' }).tap()
  await expect(page.getByRole('checkbox', { name: 'Réduire les animations' })).toBeChecked()
  await page.getByRole('navigation').getByRole('link', { name: 'Explorer' }).tap()
  await expect(page).toHaveURL(/vue=explorer/)
  await context.close()
})

test('capture du mouvement', async ({ browser }) => {
  test.setTimeout(60_000)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'test-results', size: { width: 1440, height: 900 } } })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/')
  await expect(page.locator('.liquid-ether__canvas')).toBeVisible()
  const first = await page.locator('.liquid-ether__canvas').screenshot()
  await page.waitForTimeout(3500)
  expect(first.equals(await page.locator('.liquid-ether__canvas').screenshot())).toBe(false)
  const video = page.video()!
  await page.close()
  await context.close()
  await video.saveAs('test-results/crema.webm')
})