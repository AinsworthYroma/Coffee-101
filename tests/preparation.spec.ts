import { chromium, expect, test } from '@playwright/test'

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } })

test('nettoyage ciblé, navigation et préférences conservées', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null
      return Reflect.apply(original, this, [type, ...args])
    } })
  })
  await page.goto('/')
  const hero = page.locator('.hero')
  const controls = page.locator('.carousel-controls')
  await expect(page.locator('.site-header .brand')).toHaveCount(0)
  await expect(hero.locator('.curved-loop')).toHaveCount(2)
  await expect(hero.locator('.hero-intro, .hero-actions svg')).toHaveCount(0)
  await expect(hero.getByRole('heading', { name: 'Ta prochaine bonne tasse commence ici.' })).toBeVisible()
  await expect(hero.getByRole('button', { name: 'Préparer ma tasse' })).toBeVisible()
  await expect(hero.getByRole('link', { name: 'Explorer les origines' })).toBeVisible()
  await expect(page.getByText('Fais défiler les méthodes, puis touche un équipement pour ouvrir sa fiche.')).toHaveCount(0)
  await expect(page.locator('.preparation-top')).not.toContainText('UN CAFÉ, À TA MANIÈRE')
  await expect(page.locator('.method-access button')).toHaveCount(4)
  await expect(page.locator('.method-credits summary')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Réduire les animations' })).toBeVisible()
  await expect(page.locator('.site-footer')).not.toContainText('UN CAFÉ À LA FOIS')
  await expect(page.locator('.site-footer')).not.toContainText('FAIT POUR LE PLAISIR DE DÉCOUVRIR.')
  const controlGeometry = await controls.evaluate(element => ({ height: element.getBoundingClientRect().height, buttons: Array.from(element.querySelectorAll('button'), button => button.getBoundingClientRect().x) }))
  for (const [index, title] of ['Ta machine automatique', 'AeroPress', 'Espresso au porte-filtre', 'Café filtre & V60'].entries()) {
    await expect(controls.locator('.carousel-active-name')).toHaveText(title)
    await expect(controls.locator('small, .open-selected')).toHaveCount(0)
    expect(await controls.evaluate(element => ({ height: element.getBoundingClientRect().height, buttons: Array.from(element.querySelectorAll('button'), button => button.getBoundingClientRect().x) }))).toEqual(controlGeometry)
    await expect(page.locator('.preparation-count')).toContainText(String(index + 1).padStart(2, '0'))
    await page.getByRole('button', { name: `Ouvrir la fiche ${title}` }).click()
    await expect(page.locator('.recipe-intro h2')).toHaveText(title)
    await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
    await controls.getByRole('button', { name: 'Méthode suivante' }).click()
  }
  const preference = page.getByRole('checkbox', { name: 'Réduire les animations' })
  await preference.check()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('coffee101-reduce-animations'))).toBe('true')
  await hero.getByRole('link', { name: 'Explorer les origines' }).click()
  await expect(page).toHaveURL(/vue=explorer/)
  await expect(page.locator('.site-header .brand')).toHaveCount(0)
  await expect(preference).toBeChecked()
})

test('boutons centrés et commandes utilisables sur téléphone et iPad', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
  for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(nav).toBeVisible()
    const alignment = await page.locator('.hero-actions').evaluate(actions => Array.from(actions.children).map(button => {
      const bounds = button.getBoundingClientRect()
      const text = button.querySelector('.specular-button__label') || button
      const range = document.createRange()
      range.selectNodeContents(text)
      const label = range.getBoundingClientRect()
      return { difference: Math.abs((bounds.left + bounds.right) / 2 - (label.left + label.right) / 2), left: bounds.left, right: bounds.right }
    }))
    for (const button of alignment) {
      expect(button.difference).toBeLessThan(2)
      expect(button.left).toBeGreaterThanOrEqual(0)
      expect(button.right).toBeLessThanOrEqual(viewport.width)
    }
    const prepare = page.getByRole('button', { name: 'Préparer ma tasse' })
    await prepare.focus()
    await page.keyboard.press('Enter')
    const next = page.getByRole('button', { name: 'Méthode suivante' })
    await next.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.preparation-count')).toContainText('02')
    const carousel = page.locator('.equipment-scene')
    await carousel.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.recipe-intro h2')).toHaveText('AeroPress')
    await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
    await expect(page.getByRole('checkbox', { name: 'Réduire les animations' })).toBeChecked()
  }
})

test('nom actif et commandes restent stables pour toutes les méthodes', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null
      return Reflect.apply(original, this, [type, ...args])
    } })
  })
  for (const viewport of [{ width: 320, height: 800 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const controls = page.locator('.carousel-controls')
    const name = controls.locator('.carousel-active-name')
    const geometry = () => controls.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      const label = element.querySelector<HTMLElement>('.carousel-active-name')!
      const labelBounds = label.getBoundingClientRect()
      return { height: bounds.height, buttons: Array.from(element.querySelectorAll('button'), button => button.getBoundingClientRect().x), labelHeight: labelBounds.height, labelWidth: labelBounds.width, scrollWidth: label.scrollWidth, scrollHeight: label.scrollHeight }
    })
    const initial = await geometry()
    for (const title of ['Ta machine automatique', 'AeroPress', 'Espresso au porte-filtre', 'Café filtre & V60']) {
      await expect(name).toHaveText(title)
      const current = await geometry()
      expect(current.height).toBe(initial.height)
      expect(current.buttons).toEqual(initial.buttons)
      expect(current.labelHeight).toBeLessThanOrEqual(current.height)
      expect(current.scrollHeight).toBeLessThanOrEqual(current.height)
      expect(current.scrollWidth).toBeLessThanOrEqual(current.labelWidth)
      await controls.getByRole('button', { name: 'Méthode suivante' }).click()
    }
    await controls.getByRole('button', { name: 'Méthode précédente' }).click()
    await expect(name).toHaveText('Café filtre & V60')
  }
})

test('les méthodes restent accessibles lorsque WebGL est indisponible', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(type)) return null
      return Reflect.apply(original, this, [type, ...args])
    } })
  })
  await page.goto('/')
  await expect(page.locator('.equipment-scene canvas')).toBeHidden()
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
  await expect(page.getByRole('heading', { name: 'AeroPress', exact: true })).toBeVisible()
})

test('quatre fiches, réglages conservés et retour au focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const methods = page.locator('.method-access button')
  await expect(methods).toHaveCount(4)
  const trigger = page.getByRole('button', { name: 'Ouvrir la fiche Café filtre & V60' })
  await trigger.click()
  await expect(page.getByRole('heading', { name: 'Café filtre & V60' })).toBeVisible()
  await page.getByLabel('V60 manuel').check()
  await page.getByRole('option', { name: 'Claire', exact: true }).click()
  await page.getByRole('radio', { name: /Expressif & complexe/ }).click()
  await page.getByLabel('Eau à préparer').selectOption('500')
  await expect(page.locator('.recipe-parameters')).toContainText('30 g')
  await page.getByLabel('Cafetière filtre électrique').check()
  await expect(page.locator('.recipe-steps')).toContainText('réservoir')
  await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(page.getByRole('option', { name: 'Claire', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('radio', { name: /Expressif & complexe/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Eau à préparer')).toHaveValue('500')
})

test('le clic sur image ouvre directement, le glissement ne le fait pas', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const carousel = page.locator('.circular-carousel')
  await carousel.scrollIntoViewIfNeeded()
  await expect(carousel.locator('canvas')).toHaveAttribute('data-loaded', /0/, { timeout: 30_000 })
  const box = (await carousel.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(page.locator('.recipe-detail')).toHaveCount(0)
  await page.getByRole('button', { name: 'Méthode suivante' }).click()
  await page.waitForTimeout(1200)
  const active = (await carousel.getAttribute('aria-label'))!.replace('Sélecteur 3D : ', '')
  await expect(page.locator('.carousel-active-name')).toHaveText(active)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('.recipe-intro h2')).toHaveText(active)
  await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
  await expect(carousel).toBeFocused()
})

test('transfert modifiable sans écraser un brouillon et retour aux choix', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?vue=deguster')
  await page.getByRole('button', { name: 'Nouvelle dégustation' }).click()
  await page.getByLabel('Notes libres').fill('Ma note existante')
  await expect(page.getByText('Brouillon enregistré', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Préparer' }).click()
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
  await page.getByRole('option', { name: 'Foncée' }).click()
  await page.getByRole('button', { name: 'Déguster ce café' }).click()
  await expect(page.getByText('Un brouillon existe déjà')).toBeVisible()
  await page.getByRole('button', { name: 'Reprendre le brouillon' }).click()
  await expect(page.getByLabel('Notes libres')).toHaveValue('Ma note existante')
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Préparer' }).click()
  await expect(page.getByRole('option', { name: 'Foncée' })).toHaveAttribute('aria-selected', 'true')
})

test('roue et profils commandent chaque recette au clavier et à la souris', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
  await page.goto('/')
  for (const method of ['Ta machine automatique', 'AeroPress', 'Espresso au porte-filtre', 'Café filtre & V60']) {
    await page.getByRole('button', { name: `Ouvrir la fiche ${method}` }).click()
    const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
    const group = page.getByRole('radiogroup', { name: 'Ton envie' })
    for (const [label, summary] of [['Claire', 'Claire'], ['Moyenne', 'Moyenne'], ['Foncée', 'Foncée'], ['Je ne sais pas', 'Torréfaction inconnue']]) {
      await wheel.getByRole('option', { name: label, exact: true }).click()
      await expect(wheel.getByRole('option', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true')
      await expect(page.locator('.recipe-summary')).toContainText(summary)
    }
    const expressive = group.getByRole('radio', { name: /Expressif & complexe/ })
    await expressive.click()
    await expressive.click()
    await expect(expressive).toHaveAttribute('aria-checked', 'true')
    await expect(group.locator('[aria-checked="true"]')).toHaveCount(1)
    await expect(page.locator('.recipe-summary')).toContainText('Expressif & complexe')
    await expressive.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(group.getByRole('radio', { name: /Rond & gourmand/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('.recipe-summary')).toContainText('Rond & gourmand')
    await wheel.focus()
    await page.keyboard.press('ArrowUp')
    await expect(wheel.getByRole('option', { name: 'Foncée' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.recipe-summary')).toContainText('Foncée')
    await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
  }
})

test('la roue valide au relâchement sans remonter la fiche', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
  await page.locator('.recipe-intro img').evaluate(element => { element.setAttribute('data-preserved', 'oui') })
  const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
  await wheel.scrollIntoViewIfNeeded()
  const mark = (await wheel.locator('.brand-mark').boundingBox())!
  const pivotX = mark.x + mark.width / 2
  const pivotY = mark.y + mark.height / 2
  await page.mouse.move(pivotX + 110, pivotY)
  await page.mouse.down()
  await page.mouse.move(pivotX + 110 * Math.cos(0.7), pivotY + 110 * Math.sin(0.7), { steps: 6 })
  await expect(page.locator('.recipe-summary')).toContainText('Torréfaction inconnue')
  await page.mouse.up()
  await expect(page.locator('.recipe-summary')).toContainText('Moyenne')
  await expect(page.locator('.recipe-intro img')).toHaveAttribute('data-preserved', 'oui')
  await page.getByRole('radio', { name: /Expressif & complexe/ }).click()
  await expect(page.locator('.recipe-intro img')).toHaveAttribute('data-preserved', 'oui')
  await expect(page).toHaveURL('/')
})

test('la roue tourne autour du même pivot et valide seulement après le glissement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
  const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
  await wheel.getByRole('option', { name: 'Claire', exact: true }).click()
  await wheel.scrollIntoViewIfNeeded()
  const geometry = () => wheel.evaluate(element => {
    const box = element.getBoundingClientRect()
    const mark = element.querySelector('.brand-mark')!.getBoundingClientRect()
    const centerX = (mark.left + mark.right) / 2 - box.left
    const centerY = (mark.top + mark.bottom) / 2 - box.top
    const options = Array.from(element.querySelectorAll('[role="option"]')).map(option => {
      const rect = option.getBoundingClientRect()
      return { x: rect.left - box.left, y: (rect.top + rect.bottom) / 2 - box.top, top: rect.top, bottom: rect.bottom, right: rect.right, width: option.clientWidth, scrollWidth: option.scrollWidth }
    })
    return { centerX, centerY, options, background: getComputedStyle(element.parentElement!).backgroundColor, border: getComputedStyle(element.parentElement!).borderWidth }
  })
  const checkGeometry = (state: Awaited<ReturnType<typeof geometry>>) => {
    for (const option of state.options) expect(Math.hypot(option.x - state.centerX, option.y - state.centerY)).toBeCloseTo(110, 1)
    for (let index = 1; index < state.options.length; index++) expect(state.options[index].top).toBeGreaterThanOrEqual(state.options[index - 1].bottom - 0.1)
    expect(state.background).toBe('rgba(0, 0, 0, 0)')
    expect(state.border).toBe('0px')
    expect(state.options.every(option => option.scrollWidth <= option.width)).toBe(true)
  }
  const before = await geometry()
  checkGeometry(before)
  expect(before.options[0].y).toBeCloseTo(before.centerY, 1)
  expect(before.options[0].x).toBeGreaterThan(before.options[3].x + 45)
  const box = (await wheel.boundingBox())!
  const pivotX = box.x + before.centerX
  const pivotY = box.y + before.centerY
  await page.mouse.move(pivotX + 110, pivotY)
  await page.mouse.down()
  await page.mouse.move(pivotX + 110 * Math.cos(-0.65), pivotY + 110 * Math.sin(-0.65), { steps: 10 })
  const during = await geometry()
  checkGeometry(during)
  expect(during.centerX).toBe(before.centerX)
  expect(during.options[0].x).toBeLessThan(before.options[0].x - 20)
  await expect(page.locator('.recipe-summary')).toContainText('Claire')
  await page.mouse.up()
  await expect(page.locator('.recipe-summary')).toContainText('Foncée')
  await expect.poll(async () => {
    const state = await geometry()
    return Math.abs(state.options[2].y - state.centerY)
  }).toBeLessThan(0.1)
  const after = await geometry()
  checkGeometry(after)
  expect(after.options[2].x).toBeCloseTo(before.options[0].x, 1)
  expect(after.options[2].y).toBeCloseTo(before.centerY, 1)
  await wheel.focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('End')
  await expect(wheel.getByRole('option', { name: 'Je ne sais pas' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.recipe-summary')).toContainText('Torréfaction inconnue')
})

test('glissement tactile radial et page libre hors de la roue', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
  await context.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/')
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).tap()
  const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
  await wheel.getByRole('option', { name: 'Claire', exact: true }).tap()
  await wheel.scrollIntoViewIfNeeded()
  const mark = (await wheel.locator('.brand-mark').boundingBox())!
  const pivotX = mark.x + mark.width / 2
  const pivotY = mark.y + mark.height / 2
  const session = await context.newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pivotX + 110, y: pivotY }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pivotX + 110 * Math.cos(-0.65), y: pivotY + 110 * Math.sin(-0.65) }] })
  await expect(page.locator('.recipe-summary')).toContainText('Claire')
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.locator('.recipe-summary')).toContainText('Foncée')
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).touchAction)).toBe('auto')
  await context.close()
})

test('la dernière commande rapide gagne pendant le recentrage', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
  const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
  await wheel.focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('End')
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowDown')
  await expect(wheel.getByRole('option', { name: 'Moyenne' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.recipe-summary')).toContainText('Moyenne')
})

test('le grain partagé reste au pivot et le trait aligne les quatre choix au redimensionnement', async () => {
  test.setTimeout(60_000)
  const browser = await chromium.launch({ args: ['--disable-gpu', '--disable-3d-apis'] })
  const page = await browser.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('coffee101-reduce-animations', 'true')
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null
      return (getContext as Function).call(this, type, ...args)
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  await page.goto('http://127.0.0.1:4173/')
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).evaluate(button => button.click())
  const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
  const bean = wheel.locator('.brand-mark')
  const headerPaths = await page.locator('.site-header .brand-mark path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  expect(await bean.locator('path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(headerPaths)
  await expect(wheel.locator('.option-wheel__pivot')).toHaveAttribute('aria-hidden', 'true')
  await expect(wheel.locator('.option-wheel__pivot')).toHaveCSS('pointer-events', 'none')
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }, { width: 375, height: 812 }, { width: 320, height: 812 }]) {
    await page.setViewportSize(viewport)
    for (const label of ['Claire', 'Moyenne', 'Foncée', 'Je ne sais pas']) {
      const option = wheel.getByRole('option', { name: label, exact: true })
      await option.click()
      await expect(option).toHaveAttribute('aria-selected', 'true')
      await expect(page.locator('.recipe-summary')).toContainText(label === 'Je ne sais pas' ? 'Torréfaction inconnue' : label)
      await expect.poll(() => wheel.evaluate(element => {
        const selected = element.querySelector('[aria-selected="true"]')!.getBoundingClientRect()
        const mark = element.querySelector('.brand-mark')!.getBoundingClientRect()
        return Math.abs((selected.top + selected.bottom - mark.top - mark.bottom) / 2)
      })).toBeLessThan(0.1)
      const state = await wheel.evaluate(element => {
        const root = element.getBoundingClientRect()
        const mark = element.querySelector('.brand-mark')!.getBoundingClientRect()
        const line = element.querySelector('.option-wheel__marker')!.getBoundingClientRect()
        const options = Array.from(element.querySelectorAll('[role="option"]')).map(option => {
          const box = option.getBoundingClientRect()
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, selected: option.getAttribute('aria-selected') === 'true', fits: option.scrollWidth <= option.clientWidth }
        })
        return { root: { left: root.left, top: root.top, width: root.width, height: root.height }, mark: { left: mark.left, right: mark.right, top: mark.top, bottom: mark.bottom }, line: { left: line.left, right: line.right, top: line.top, bottom: line.bottom }, options, background: getComputedStyle(element.parentElement!).backgroundColor, border: getComputedStyle(element.parentElement!).borderWidth }
      })
      const centerX = (state.mark.left + state.mark.right) / 2
      const centerY = (state.mark.top + state.mark.bottom) / 2
      const selected = state.options.find(item => item.selected)!
      const radius = selected.left - centerX
      expect(centerX - state.root.left).toBeCloseTo(68, 0)
      expect(state.root.height).toBe(220)
      expect(centerY - state.root.top).toBeCloseTo(state.root.height / 2, 1)
      expect((state.line.top + state.line.bottom) / 2).toBeCloseTo(centerY, 1)
      expect(state.line.left - state.mark.right).toBeGreaterThanOrEqual(7)
      expect(selected.left - state.line.right).toBeCloseTo(14, 0)
      expect(radius).toBeCloseTo(110, 0)
      expect(state.mark.right - state.mark.left).toBeCloseTo(136, 0)
      expect(state.mark.left).toBeGreaterThanOrEqual(0)
      expect(state.mark.right).toBeLessThanOrEqual(viewport.width)
      expect(state.options.every(item => item.fits && (item.left >= state.mark.right || item.bottom <= state.mark.top || item.top >= state.mark.bottom) && item.left >= state.root.left && item.right <= state.root.left + state.root.width && item.top >= state.root.top && item.bottom <= state.root.top + state.root.height)).toBe(true)
      for (let index = 1; index < state.options.length; index++) expect(state.options[index].top).toBeGreaterThanOrEqual(state.options[index - 1].bottom - 0.1)
      for (const item of state.options) expect(Math.hypot(item.left - centerX, (item.top + item.bottom) / 2 - centerY)).toBeCloseTo(radius, 1)
      expect(state.background).toBe('rgba(0, 0, 0, 0)')
      expect(state.border).toBe('0px')
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(viewport)
    await wheel.getByRole('option', { name: 'Claire', exact: true }).click()
    await expect(wheel.getByRole('option', { name: 'Claire', exact: true })).toHaveAttribute('aria-selected', 'true')
    await wheel.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await page.keyboard.press('Tab')
    await wheel.evaluate(element => (element as HTMLElement).focus({ preventScroll: true }))
    expect(await wheel.evaluate(element => element.matches(':focus-visible') && getComputedStyle(element).outlineStyle !== 'none')).toBe(true)
    const mark = (await bean.boundingBox())!
    const centerX = mark.x + mark.width / 2
    const centerY = mark.y + mark.height / 2
    await page.mouse.move(centerX + 112, centerY)
    await page.mouse.down()
    for (let step = 1; step <= 12; step++) {
      const angle = -0.99 * step / 12
      await page.mouse.move(centerX + 112 * Math.cos(angle), centerY + 112 * Math.sin(angle))
      await expect(wheel).toHaveClass(/option-wheel--dragging/)
      const bounds = await wheel.evaluate(element => {
        const root = element.getBoundingClientRect()
        return { height: root.height, options: Array.from(element.querySelectorAll('[role="option"]')).map(option => {
          const box = option.getBoundingClientRect()
          return { top: box.top, bottom: box.bottom, inside: box.top >= root.top && box.bottom <= root.bottom }
        }) }
      })
      expect(bounds.height).toBe(220)
      expect(bounds.options.every(option => option.inside)).toBe(true)
      for (let index = 1; index < bounds.options.length; index++) expect(bounds.options[index].top).toBeGreaterThanOrEqual(bounds.options[index - 1].bottom - 0.1)
    }
    await page.mouse.up()
    await expect(wheel.getByRole('option', { name: 'Je ne sais pas' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.recipe-summary')).toContainText('Torréfaction inconnue')
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
  for (const method of ['Ta machine automatique', 'AeroPress', 'Espresso au porte-filtre', 'Café filtre & V60']) {
    await page.getByRole('button', { name: `Ouvrir la fiche ${method}` }).evaluate(button => button.click())
    await expect(wheel).toHaveCSS('height', '220px')
    for (const label of ['Claire', 'Moyenne', 'Foncée', 'Je ne sais pas']) {
      await wheel.getByRole('option', { name: label, exact: true }).click()
      await expect(page.locator('.recipe-summary')).toContainText(label === 'Je ne sais pas' ? 'Torréfaction inconnue' : label)
    }
    await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
  }
  await browser.close()
})

for (const width of [320, 375]) {
  test(`les quatre positions restent radiales et lisibles à ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
    await page.goto('/')
    await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
    const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
    for (const label of ['Claire', 'Moyenne', 'Foncée', 'Je ne sais pas']) {
      await wheel.getByRole('option', { name: label, exact: true }).click()
      await expect(wheel.getByRole('option', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true')
      await expect.poll(() => wheel.getByRole('option', { name: label, exact: true }).evaluate(option => {
        const bounds = option.parentElement!.getBoundingClientRect()
        const rect = option.getBoundingClientRect()
        return Math.abs((rect.top + rect.bottom) / 2 - bounds.top - bounds.height / 2)
      })).toBeLessThan(0.1)
      const state = await wheel.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        return Array.from(element.querySelectorAll('[role="option"]')).map(option => {
          const rect = option.getBoundingClientRect()
          return { x: rect.left - bounds.left, y: (rect.top + rect.bottom) / 2 - bounds.top, within: rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom, fits: option.scrollWidth <= option.clientWidth, selected: option.getAttribute('aria-selected') === 'true' }
        })
      })
      const selected = state.find(option => option.selected)!
      expect(selected.y).toBeCloseTo(110, 0)
      expect(state.every(option => option.within && option.fits && option.x <= selected.x + 0.1)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
  })
}

for (const viewport of [{ width: 1180, height: 820 }, { width: 820, height: 1180 }]) {
  test(`sélecteurs tactiles lisibles : ${viewport.width} × ${viewport.height}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, reducedMotion: 'reduce' })
    await context.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4173/')
    await page.getByRole('button', { name: 'Ouvrir la fiche Café filtre & V60' }).tap()
    await page.getByLabel('V60 manuel').check()
    const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
    await wheel.getByRole('option', { name: 'Claire' }).tap()
    await expect(page.locator('.recipe-summary')).toContainText('Claire')
    const bounds = await wheel.evaluate(element => {
      const container = element.getBoundingClientRect()
      return Array.from(element.querySelectorAll('[role="option"]')).map(option => {
        const rect = option.getBoundingClientRect()
        return { visible: rect.top >= container.top && rect.bottom <= container.bottom && rect.left >= container.left && rect.right <= container.right, width: option.scrollWidth <= option.clientWidth }
      })
    })
    expect(bounds.every(option => option.visible && option.width)).toBe(true)
    await page.getByRole('radio', { name: /Expressif & complexe/ }).tap()
    await expect(page.locator('.recipe-summary')).toContainText('V60 manuel')
    await expect(page.locator('.recipe-summary')).toContainText('Expressif & complexe')
    await expect(page.getByRole('radio', { name: /Expressif & complexe/ }).locator('strong')).toHaveCSS('color', 'rgb(240, 226, 201)')
    await expect(page.getByRole('radio', { name: /Rond & gourmand/ }).locator('strong')).toHaveCSS('color', 'rgb(38, 24, 15)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await context.close()
  })
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1180, height: 820 }, { width: 820, height: 1180 }]) {
  test(`contrôles et rendu des quatre fiches : ${viewport.width} × ${viewport.height}`, async ({ page }) => {
    test.setTimeout(90_000)
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    page.on('response', response => {
      if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
    })
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
    await page.goto('/')
    for (const method of ['Ta machine automatique', 'AeroPress', 'Espresso au porte-filtre', 'Café filtre & V60']) {
      await page.getByRole('button', { name: `Ouvrir la fiche ${method}` }).click()
      const wheel = page.getByRole('listbox', { name: 'Ta torréfaction' })
      for (const label of ['Claire', 'Moyenne', 'Foncée', 'Je ne sais pas']) {
        await wheel.getByRole('option', { name: label, exact: true }).click()
        await expect(wheel.getByRole('option', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true')
        await expect(page.locator('.recipe-summary')).toContainText(label === 'Je ne sais pas' ? 'Torréfaction inconnue' : label)
        await expect.poll(() => wheel.evaluate(element => {
          const box = element.getBoundingClientRect()
          return Array.from(element.querySelectorAll('[role="option"]')).every(option => {
            const rect = option.getBoundingClientRect()
            return rect.top >= box.top && rect.bottom <= box.bottom && rect.left >= box.left && rect.right <= box.right && option.scrollWidth <= option.clientWidth
          })
        })).toBe(true)
      }
      const profiles = page.getByRole('radiogroup', { name: 'Ton envie' })
      await profiles.getByRole('radio', { name: /Expressif & complexe/ }).click()
      await expect(profiles.locator('[aria-checked="true"]')).toHaveCount(1)
      await expect(page.locator('.recipe-summary')).toContainText('Expressif & complexe')
      await expect(profiles.getByRole('radio', { name: /Rond & gourmand/ }).locator('strong')).toHaveCSS('color', 'rgb(38, 24, 15)')
      await expect(profiles.getByRole('radio', { name: /Expressif & complexe/ }).locator('strong')).toHaveCSS('color', 'rgb(240, 226, 201)')
      const layout = await profiles.evaluate(element => {
        const group = element.getBoundingClientRect()
        const recommendation = element.nextElementSibling!.getBoundingClientRect()
        return { gap: recommendation.top - group.bottom, buttons: Array.from(element.querySelectorAll('button')).map(button => {
          const style = getComputedStyle(button)
          const light = button.querySelector('canvas')!
          const gl = light.getContext('webgl2')
          return { background: style.backgroundColor, overflow: style.overflow, contextLost: gl?.isContextLost(), text: getComputedStyle(button.querySelector('strong')!).color }
        }) }
      })
      expect(layout.gap).toBeGreaterThanOrEqual(12)
      expect(layout.buttons.map(button => button.background)).toEqual(['rgb(230, 209, 176)', 'rgb(72, 39, 25)'])
      expect(layout.buttons.every(button => button.overflow === 'hidden' && button.contextLost === false)).toBe(true)
      expect(await page.locator('.recipe-intro img').evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
    }
    expect(failures).toEqual([])
  })
}

test('perte du reflet WebGL : sélection et contenu restent utilisables', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).click()
  const profile = page.getByRole('radio', { name: /Expressif & complexe/ })
  const canvas = profile.locator('canvas')
  await canvas.evaluate(element => (element as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext())
  await expect(canvas).toHaveCSS('visibility', 'hidden')
  await profile.click()
  await expect(profile).toHaveAttribute('aria-checked', 'true')
  await expect(profile.locator('strong')).toHaveCSS('color', 'rgb(240, 226, 201)')
  await expect(page.locator('.recipe-summary')).toContainText('Expressif & complexe')
})

test('secours si le carrousel ne charge pas', async ({ page }) => {
  await page.route('**/src/EquipmentScene.tsx*', route => route.abort())
  await page.goto('/')
  await expect(page.locator('.carousel-stage .equipment-fallback img')).toHaveCount(3)
  await page.getByRole('button', { name: 'Ouvrir la fiche Espresso au porte-filtre' }).click()
  await expect(page.getByRole('heading', { name: 'Espresso au porte-filtre' })).toBeVisible()
})

test('secours détouré sans WebGL et navigation au clavier', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl') return null
      return original.call(this, type as '2d', ...args as [])
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  await page.goto('/')
  const scene = page.locator('.equipment-scene')
  await scene.scrollIntoViewIfNeeded()
  await expect(scene.locator('.equipment-fallback img')).toHaveCount(3)
  for (const image of await scene.locator('.equipment-fallback img').all()) {
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  await scene.focus()
  await page.keyboard.press('ArrowRight')
  await expect(scene).toHaveAttribute('aria-label', 'Sélecteur 3D : AeroPress')
  await expect(page.locator('.carousel-active-name')).toHaveText('AeroPress')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'AeroPress' })).toBeVisible()
  await page.getByRole('button', { name: 'Retour aux méthodes' }).click()
  await expect(scene).toBeFocused()
})

test('scène 3D : modèles chargés et arrêt en mouvement réduit', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const scene = page.locator('.equipment-scene')
  await scene.scrollIntoViewIfNeeded()
  const canvas = scene.locator('canvas')
  await expect(canvas).toHaveAttribute('data-loaded', /0/)
  await expect(canvas).toHaveAttribute('data-loaded', /1/)
  await expect(canvas).toHaveAttribute('data-loaded', /3/)
  await page.waitForTimeout(500)
  expect(Number(await canvas.getAttribute('data-draw-calls'))).toBeLessThan(80)
  const first = await canvas.screenshot()
  await page.waitForTimeout(500)
  expect(first.equals(await canvas.screenshot())).toBe(true)
  await page.getByRole('button', { name: 'Méthode suivante' }).click()
  await page.getByRole('button', { name: 'Méthode suivante' }).click()
  await expect(canvas).toHaveAttribute('data-loaded', /2/)
  await expect(scene).toHaveAttribute('aria-label', 'Sélecteur 3D : Espresso au porte-filtre')
})

test('stockage indisponible annoncé avant et après saisie', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Stockage indisponible') } })
  })
  await page.goto('/?vue=deguster')
  await expect(page.getByText(/stockage est indisponible/i)).toBeVisible()
  await page.getByLabel('Brouillon de dégustation').fill('Une note')
  await expect(page.getByText(/stockage est indisponible/i)).toBeVisible()
})

test('navigation et ouverture au toucher avec mouvement réduit', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, reducedMotion: 'reduce', viewport: { width: 820, height: 1180 } })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/')
  await page.getByRole('button', { name: 'Méthode suivante' }).tap()
  await expect(page.locator('.equipment-scene')).toHaveAttribute('aria-label', 'Sélecteur 3D : AeroPress')
  await page.getByRole('button', { name: 'Ouvrir la fiche AeroPress' }).tap()
  await expect(page.getByRole('heading', { name: 'AeroPress' })).toBeVisible()
  await context.close()
})

test('glissement tactile et suspension de la scène', async ({ browser }) => {
  test.setTimeout(60_000)
  const context = await browser.newContext({ hasTouch: true, isMobile: true, reducedMotion: 'reduce', viewport: { width: 820, height: 1180 } })
  await context.addInitScript(() => localStorage.setItem('coffee101-reduce-animations', 'true'))
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4173/')
  const scene = page.locator('.equipment-scene')
  await scene.scrollIntoViewIfNeeded()
  const canvas = scene.locator('canvas')
  await expect(canvas).toHaveAttribute('data-loaded', /1/, { timeout: 30_000 })
  const box = (await scene.boundingBox())!
  const session = await context.newCDPSession(page)
  const start = { x: box.x + box.width * .65, y: box.y + box.height * .5 }
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - 150, y: start.y }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(scene).toHaveAttribute('aria-label', 'Sélecteur 3D : AeroPress')
  await expect(page.locator('.carousel-active-name')).toHaveText('AeroPress')
  await expect(page.locator('.recipe-detail')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(async () => Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(1)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await page.waitForTimeout(300)
  const stopped = await canvas.getAttribute('data-frames')
  await page.waitForTimeout(500)
  await expect(canvas).toHaveAttribute('data-frames', stopped!)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect.poll(async () => Number(await canvas.getAttribute('data-frames'))).toBeGreaterThan(Number(stopped))
  await context.close()
})