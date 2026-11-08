import { expect, test } from '@playwright/test'

test('prototype 3D : transparence, vues et mouvement réduit', async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/prototype-aeropress.html')
  const canvas = page.locator('canvas[data-triangles]')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reprendre la rotation' })).toBeVisible()
  const properties = await canvas.evaluate(element => {
    const canvas = element as HTMLCanvasElement
    const context = canvas.getContext('webgl2')!
    const pixel = new Uint8Array(4)
    context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel)
    return { alpha: pixel[3], width: canvas.width, height: canvas.height, triangles: Number(canvas.dataset.triangles) }
  })
  expect(properties.alpha).toBe(0)
  expect(properties.width * properties.height).toBeGreaterThan(100_000)
  expect(properties.triangles).toBeGreaterThan(1000)
  await page.getByRole('button', { name: 'Face' }).click()
  const front = await canvas.screenshot()
  await page.waitForTimeout(300)
  expect(front.equals(await canvas.screenshot())).toBe(true)
  await page.getByRole('button', { name: 'Côté' }).click()
  expect(front.equals(await canvas.screenshot())).toBe(false)
})

test('prototype 3D : message sans WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl2' || type === 'webgl') return null
      return original.call(this, type as '2d', ...args as [])
    } as typeof HTMLCanvasElement.prototype.getContext
  })
  await page.goto('/prototype-aeropress.html')
  await expect(page.getByRole('status')).toContainText('ne peut pas être affiché')
})