import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createAeropress } from './AeropressModel'

const assets = ['/equipements/automatique.glb', '', '/equipements/porteFiltre.glb', '/equipements/filtre.glb']
const previews = ['/equipements/automatique.png', '/equipements/aeropress.png', '/equipements/porteFiltre.png', '/equipements/filtre.png']

type Props = { active: number; enabled: boolean; title: string; onMove: (direction: number) => void; onOpen: (index: number, element: HTMLElement) => void }

export default function EquipmentScene({ active, enabled, title, onMove, onOpen }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const selection = useRef(active)
  const enabledRef = useRef(enabled)
  const wakeRef = useRef<() => void>(() => {})
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [fallback, setFallback] = useState(false)
  const fallbackRef = useRef(false)
  selection.current = active
  enabledRef.current = enabled
  fallbackRef.current = fallback

  useEffect(() => { wakeRef.current() }, [active, enabled])

  useEffect(() => {
    const element = host.current!
    const surface = canvas.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ canvas: surface, alpha: true, antialias: true }) } catch { setFallback(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
    renderer.setClearColor(0, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-4, 4, 1.8, -1.8, 0.1, 100)
    camera.position.set(0, 1, 12)
    camera.lookAt(0, 0, 0)
    scene.add(new THREE.HemisphereLight(0xffead1, 0x574032, 2.5))
    const key = new THREE.DirectionalLight(0xfff1de, 3.5)
    key.position.set(-4, 6, 8)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xffffff, 1.8)
    rim.position.set(5, 2, -4)
    scene.add(rim)
    const groups = assets.map(() => { const group = new THREE.Group(); scene.add(group); return group })
    const loaded = new Set<number>()
    const loading = new Set<number>()
    const loader = new GLTFLoader()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = false
    let disposed = false
    let frame = 0
    let previous = 0
    let rotation = 0.75
    const dispose = (object: THREE.Object3D) => object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      child.geometry.dispose()
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose()
        material.dispose()
      }
    })
    const batchAutomatic = (object: THREE.Object3D) => {
      object.updateMatrixWorld(true)
      const batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>()
      object.traverse(child => {
        if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return
        const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld)
        const attributes = Object.keys(geometry.attributes).sort().join(',')
        const key = `${child.material.uuid}:${attributes}:${Boolean(geometry.index)}`
        const batch: { material: THREE.Material; geometries: THREE.BufferGeometry[] } = batches.get(key) ?? { material: child.material, geometries: [] }
        batch.geometries.push(geometry)
        batches.set(key, batch)
      })
      const combined = new THREE.Group()
      for (const batch of batches.values()) {
        const geometry = mergeGeometries(batch.geometries)
        if (geometry) combined.add(new THREE.Mesh(geometry, batch.material))
        else for (const part of batch.geometries) combined.add(new THREE.Mesh(part, batch.material))
        if (geometry) batch.geometries.forEach(part => part.dispose())
      }
      object.traverse(child => { if (child instanceof THREE.Mesh) child.geometry.dispose() })
      return combined
    }
    const fit = (object: THREE.Object3D, index: number) => {
      if (index === 0) object.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
          if (material instanceof THREE.MeshStandardMaterial && material.name === 'green_bodyG') {
            material.map?.dispose()
            material.map = null
            material.color.set('#aa8a6a')
            material.needsUpdate = true
          }
        }
      })
      const box = new THREE.Box3().setFromObject(object)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const scale = 2.35 / Math.max(size.x, size.y, size.z)
      object.position.sub(center).multiplyScalar(scale)
      object.scale.multiplyScalar(scale)
      groups[index].add(object)
      loaded.add(index)
      surface.dataset.loaded = [...loaded].sort().join(',')
    }
    const load = (index: number) => {
      if (loaded.has(index) || loading.has(index)) return
      loading.add(index)
      if (index === 1) { fit(createAeropress(), index); return }
      loader.load(assets[index], gltf => {
        if (disposed) { dispose(gltf.scene); return }
        fit(index === 0 ? batchAutomatic(gltf.scene) : gltf.scene, index)
        wake()
      }, undefined, () => { if (!disposed) setFallback(true) })
    }
    const render = (time: number) => {
      frame = 0
      if (!visible || !enabledRef.current || fallbackRef.current || document.hidden || disposed) { previous = 0; return }
      if (previous && !reduced.matches && time - previous < 33) { frame = requestAnimationFrame(render); return }
      const delta = previous ? Math.min((time - previous) / 1000, 0.05) : 0
      previous = time
      if (!reduced.matches) rotation += delta * 0.22
      const compact = Math.min(1, Math.max(0.55, camera.right / 3.6))
      for (let index = 0; index < groups.length; index++) {
        let relative = (index - selection.current + groups.length) % groups.length
        if (relative > 2) relative -= groups.length
        const group = groups[index]
        group.visible = Math.abs(relative) <= 1
        if (!group.visible) continue
        load(index)
        const blend = reduced.matches ? 1 : 1 - Math.exp(-delta * 9)
        group.position.lerp(new THREE.Vector3(relative * 2.5 * compact, 0, relative === 0 ? 0 : -1.2), blend)
        const scale = THREE.MathUtils.lerp(group.scale.x, relative === 0 ? 0.8 + 0.2 * compact : 0.62 * compact, blend)
        group.scale.setScalar(scale)
        group.rotation.y = relative === 0 ? rotation : 0.75
      }
      renderer.render(scene, camera)
      surface.dataset.frames = String(Number(surface.dataset.frames || 0) + 1)
      surface.dataset.triangles = String(renderer.info.render.triangles)
      surface.dataset.drawCalls = String(renderer.info.render.calls)
      if (!reduced.matches) frame = requestAnimationFrame(render)
    }
    const wake = () => { if (!frame && visible && enabledRef.current && !fallbackRef.current && !document.hidden && !disposed) frame = requestAnimationFrame(render) }
    wakeRef.current = wake
    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.left = -1.8 * width / height
      camera.right = 1.8 * width / height
      camera.updateProjectionMatrix()
      wake()
    }
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0 } else wake() }
    const motion = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; wake() }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) { resize(); wake() } else { cancelAnimationFrame(frame); frame = 0; previous = 0 } })
    const resizeObserver = new ResizeObserver(resize)
    observer.observe(element)
    resizeObserver.observe(element)
    document.addEventListener('visibilitychange', visibility)
    reduced.addEventListener('change', motion)
    const lost = (event: Event) => { event.preventDefault(); setFallback(true) }
    surface.addEventListener('webglcontextlost', lost)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      reduced.removeEventListener('change', motion)
      surface.removeEventListener('webglcontextlost', lost)
      groups.forEach(dispose)
      renderer.dispose()
      wakeRef.current = () => {}
    }
  }, [])

  return <div ref={host} className="equipment-scene circular-carousel" role="button" tabIndex={0} aria-label={`Sélecteur 3D : ${title}`}
    onPointerDown={event => { if (event.button === 0) { press.current = { x: event.clientX, y: event.clientY, moved: false }; suppressClick.current = false } }}
    onPointerMove={event => { const start = press.current; if (start && Math.abs(event.clientX - start.x) > 12 && Math.abs(event.clientX - start.x) > Math.abs(event.clientY - start.y)) { start.moved = true; if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId) } }}
    onPointerUp={event => { const start = press.current; press.current = null; if (start?.moved) { suppressClick.current = true; onMove(event.clientX < start.x ? 1 : -1) } }}
    onPointerCancel={() => { press.current = null }}
    onClick={event => { if (suppressClick.current) { suppressClick.current = false; return } const bounds = event.currentTarget.getBoundingClientRect(); const offset = (event.clientX - bounds.left) / bounds.width - 0.5; const neighbor = Math.abs(offset) > 0.13 ? Math.sign(offset) : 0; onOpen((active + neighbor + 4) % 4, event.currentTarget) }}
    onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); onMove(event.key === 'ArrowRight' ? 1 : -1) } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(active, event.currentTarget) } }}>
    <canvas ref={canvas} aria-hidden="true" hidden={fallback} />
    {fallback && <div className="equipment-fallback" aria-hidden="true">{[-1, 0, 1].map(offset => <img key={offset} className={offset === 0 ? 'is-active' : ''} src={previews[(active + offset + previews.length) % previews.length]} alt="" />)}</div>}
  </div>
}