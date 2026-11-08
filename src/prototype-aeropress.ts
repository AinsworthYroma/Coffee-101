import * as THREE from 'three'

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
const status = document.querySelector<HTMLElement>('[role="status"]')!
const stage = document.querySelector<HTMLElement>('.stage')!
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

try {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 50)
  camera.position.set(0, 1.8, 10)
  camera.lookAt(0, 0, 0)
  scene.add(new THREE.HemisphereLight(0xffead1, 0x574032, 2.2))
  const key = new THREE.DirectionalLight(0xfff1de, 3)
  key.position.set(-4, 6, 8)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xffffff, 1.6)
  rim.position.set(5, 2, -4)
  scene.add(rim)

  const group = new THREE.Group()
  scene.add(group)
  const body = new THREE.MeshStandardMaterial({ color: 0x3c3936, roughness: 0.27, metalness: 0.06 })
  const plunger = new THREE.MeshStandardMaterial({ color: 0x6a625c, roughness: 0.3, metalness: 0.03 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.4 })
  const edge = new THREE.MeshStandardMaterial({ color: 0x514b46, roughness: 0.24, metalness: 0.04 })
  const markings = new THREE.MeshStandardMaterial({ color: 0xd0c2ae, roughness: 0.7 })
  const ring = (profile: [number, number][], material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 96), material)
    group.add(mesh)
    return mesh
  }

  ring([[0.63,-1.7],[0.68,-1.69],[0.71,-1.64],[0.71,0.51],[0.70,0.55],[0.66,0.57],[0.63,0.55],[0.63,-1.7]], body)
  ring([[0.63,0.48],[0.63,0.56],[0.60,0.6],[0.56,0.6],[0.56,0.48]], edge)
  ring([[0.54,0.43],[0.56,0.48],[0.56,1.52],[0.54,1.56],[0.49,1.56],[0.49,0.43]], plunger)
  ring([[0.48,1.5],[0.5,1.56],[0.53,1.6],[0.82,1.6],[0.86,1.63],[0.85,1.68],[0.81,1.7],[0.52,1.7],[0.49,1.66],[0.48,1.5]], edge)
  ring([[0.59,-1.37],[0.61,-1.36],[0.62,-1.24],[0.60,-1.22],[0.59,-1.37]], dark)
  ring([[0.68,-1.74],[0.71,-1.7],[0.86,-1.7],[0.91,-1.73],[0.91,-1.78],[0.86,-1.8],[0.67,-1.8],[0.68,-1.74]], edge)
  ring([[0.62,-2.02],[0.66,-2.02],[0.7,-1.97],[0.7,-1.8],[0.67,-1.77],[0.62,-1.8],[0.62,-2.02]], dark)
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), edge)
    grip.scale.set(0.3, 0.045, 0.16)
    grip.position.set(side * 0.82, -1.75, 0)
    group.add(grip)
  }
  for (let index = 0; index < 4; index++) {
    const marker = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.006, 8, 24), markings)
    marker.position.set(0, -1.24 + index * 0.43, 0.713)
    group.add(marker)
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.008), markings)
    tick.position.set(0.16, -1.24 + index * 0.43, 0.695)
    group.add(tick)
  }
  for (let index = 0; index < 32; index++) {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.035), edge)
    const angle = index * Math.PI * 2 / 32
    ridge.position.set(Math.sin(angle) * 0.7, -1.9, Math.cos(angle) * 0.7)
    ridge.rotation.y = angle
    group.add(ridge)
  }
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 96), dark)
  bottom.position.y = -2.03
  group.add(bottom)
  group.rotation.y = 0.75

  let running = !reduced.matches
  let visible = true
  let frame = 0
  let previous = 0
  const rotateButton = document.querySelector<HTMLButtonElement>('[data-rotate]')!
  const updateButton = () => { rotateButton.textContent = running ? 'Arrêter la rotation' : 'Reprendre la rotation' }
  const render = () => {
    renderer.render(scene, camera)
    canvas.dataset.triangles = String(renderer.info.render.triangles)
    canvas.dataset.drawCalls = String(renderer.info.render.calls)
  }
  const tick = (time: number) => {
    frame = 0
    if (!running || !visible || document.hidden) { previous = 0; return }
    if (previous) group.rotation.y += Math.min((time - previous) / 1000, 0.05) * 0.25
    previous = time
    render()
    frame = requestAnimationFrame(tick)
  }
  const wake = () => { if (!frame && running && visible && !document.hidden) frame = requestAnimationFrame(tick) }
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect()
    renderer.setSize(width, height, false)
    camera.left = -2.6 * width / height
    camera.right = 2.6 * width / height
    camera.top = 2.6
    camera.bottom = -2.6
    camera.updateProjectionMatrix()
    render()
  }
  document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(button => button.addEventListener('click', () => {
    running = false
    group.rotation.y = Number(button.dataset.angle)
    updateButton()
    render()
  }))
  rotateButton.addEventListener('click', () => { running = !running; updateButton(); wake() })
  const motionChange = () => { if (reduced.matches) running = false; updateButton(); render(); wake() }
  const visibilityChange = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0 } else wake() }
  reduced.addEventListener('change', motionChange)
  document.addEventListener('visibilitychange', visibilityChange)
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) wake(); else { cancelAnimationFrame(frame); frame = 0; previous = 0 } })
  observer.observe(stage)
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(stage)
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    resizeObserver.disconnect()
    reduced.removeEventListener('change', motionChange)
    document.removeEventListener('visibilitychange', visibilityChange)
    group.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose() })
    body.dispose(); plunger.dispose(); dark.dispose(); edge.dispose(); markings.dispose()
    renderer.dispose()
  }, { once: true })
  updateButton()
  resize()
  wake()
} catch {
  status.textContent = 'Le prototype 3D ne peut pas être affiché sur cet appareil.'
}