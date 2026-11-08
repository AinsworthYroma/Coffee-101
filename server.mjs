import { createServer } from 'node:http'
import { accessSync, constants } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sirv from 'sirv'

const rawPort = process.env.PORT ?? '3000'
if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
  throw new Error('PORT doit être un nombre entier entre 1 et 65535.')
}

const directory = fileURLToPath(new URL('./dist/', import.meta.url))
accessSync(fileURLToPath(new URL('./dist/index.html', import.meta.url)), constants.R_OK)
const serve = sirv(directory, { single: true, etag: true })

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end()
    return
  }
  if (request.url?.split('?')[0] === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : 'ok')
    return
  }
  serve(request, response)
}).listen(Number(rawPort), '0.0.0.0', () => {
  console.log(`Coffee 101 écoute sur le port ${rawPort}.`)
})