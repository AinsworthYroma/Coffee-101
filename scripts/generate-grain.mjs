import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch()
const page = await browser.newPage()
const image = await page.evaluate(() => {
  const canvas = document.createElement('canvas')
  canvas.width = 1536
  canvas.height = 1536
  const context = canvas.getContext('2d')
  const image = context.createImageData(canvas.width, canvas.height)
  let state = 1012026
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  for (let index = 0; index < image.data.length; index += 4) {
    const light = random() > 0.53
    const color = light ? 245 : 20
    image.data[index] = color
    image.data[index + 1] = light ? 231 : 14
    image.data[index + 2] = light ? 209 : 10
    image.data[index + 3] = Math.floor(random() * 65)
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/webp', 0.65).split(',')[1]
})
await writeFile('public/grain.webp', Buffer.from(image, 'base64'))
await browser.close()