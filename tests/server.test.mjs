import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
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
    assert.equal((await fetch(`${url}/health`, { method: 'POST' })).status, 405)
    for (const route of ['/', '/?vue=explorer', '/?vue=deguster', '/une-route-directe']) {
      const response = await fetch(url + route)
      assert.equal(response.status, 200, route)
      assert.match(response.headers.get('content-type'), /^text\/html/)
    }
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
  const result = spawnSync(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: 'invalide' }, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /PORT doit être/)
})