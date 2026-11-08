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
  let state = 1012027
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4
      const variation = Math.sin(x * Math.PI * 4 / canvas.width + Math.sin(y * Math.PI * 2 / canvas.height)) + Math.cos(y * Math.PI * 6 / canvas.height + Math.sin(x * Math.PI * 2 / canvas.width))
      const light = random() + variation * 0.08 > 0.5
      image.data[index] = light ? 255 : 47
      image.data[index + 1] = light ? 238 : 28
      image.data[index + 2] = light ? 203 : 14
      image.data[index + 3] = Math.floor(random() * 28 + Math.abs(variation) * 4)
    }
  }
  context.putImageData(image, 0, 0)
  for (let index = 0; index < 28000; index++) {
    const x = random() * canvas.width
    const y = random() * canvas.height
    const length = 1 + random() * 6
    context.strokeStyle = random() > 0.5 ? 'rgba(255,244,218,0.12)' : 'rgba(76,45,24,0.10)'
    context.lineWidth = 0.35 + random() * 0.45
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + length, y + (random() - 0.5) * length)
    context.stroke()
  }
  return canvas.toDataURL('image/webp', 0.7).split(',')[1]
})
await writeFile('public/kraft.webp', Buffer.from(image, 'base64'))
await browser.close()