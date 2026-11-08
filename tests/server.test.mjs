import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { networkInterfaces } from 'node:os'
import { test } from 'node:test'

test('serveur de production : santé, routes et fichiers', { timeout: 20000 }, async () => {
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const port = socket.address().port
  await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()))

  const server = spawn(process.execPath, ['server.mjs'], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  try {
    await Promise.race([
      once(server.stdout, 'data'),
      once(server, 'exit').then(() => { throw new Error('Le serveur ne démarre pas.') }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Démarrage expiré.')), 10000).unref()),
    ])
    const url = `http://127.0.0.1:${port}`
    const health = await fetch(`${url}/health`)
    assert.equal(health.status, 200)
    assert.equal(await health.text(), 'ok')
    assert.equal(health.headers.get('cache-control'), 'no-store')
    assert.match(health.headers.get('content-type'), /^text\/plain/)
    const healthHead = await fetch(`${url}/health?probe=railway`, { method: 'HEAD' })
    assert.equal(healthHead.status, 200)
    assert.equal(await healthHead.text(), '')
    assert.equal((await fetch(`${url}/health`, { method: 'POST' })).status, 405)
    const externalAddress = Object.values(networkInterfaces()).flat().find(address => address?.family === 'IPv4' && !address.internal)?.address
    if (externalAddress) {
      const externalHealth = await fetch(`http://${externalAddress}:${port}/health`)
      assert.equal(externalHealth.status, 200)
      assert.equal(await externalHealth.text(), 'ok')
    }
    let shell
    for (const route of ['/', '/?vue=preparer', '/?vue=explorer', '/?vue=deguster', '/une-route-directe']) {
      const response = await fetch(url + route)
      assert.equal(response.status, 200, route)
      assert.match(response.headers.get('content-type'), /^text\/html/)
      const html = await response.text()
      assert.match(html, /<div id="root"><\/div>/)
      if (shell === undefined) shell = html
      else assert.equal(html, shell, route)
    }
    const script = shell.match(/<script[^>]+src="([^"]+)"/)?.[1]
    assert.ok(script, 'le build doit référencer son JavaScript')
    const javascript = await fetch(new URL(script, url))
    assert.equal(javascript.status, 200)
    assert.match(javascript.headers.get('content-type'), /javascript/)
    for (const [asset, mime] of [
      ['/origines/minas-gerais.jpg', /^image\/jpeg/],
      ['/fonts/bricolage-grotesque-latin.woff2', /^font\/woff2/],
      ['/equipements/automatique.glb', /^model\/gltf-binary/],
      ['/data/ne_110m_admin_0_countries.geojson', /^(application\/geo\+json|application\/json)/],
    ]) {
      const response = await fetch(url + asset, { method: 'HEAD' })
      assert.equal(response.status, 200, asset)
      assert.match(response.headers.get('content-type'), mime, asset)
      assert.ok(Number(response.headers.get('content-length')) > 0, asset)
    }
    assert.equal((await fetch(`${url}/inexistant.png`)).status, 404)
  } finally {
    server.kill()
    if (server.exitCode === null) await once(server, 'exit')
  }
})

test('serveur de production : PORT invalide refusé', () => {
  for (const port of ['invalide', '0', '65536', '-1', '3.14']) {
    const result = spawnSync(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: port }, encoding: 'utf8' })
    assert.notEqual(result.status, 0, port)
    assert.match(result.stderr, /PORT doit être/)
  }
})