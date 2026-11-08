import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { origins, type OriginId } from './origins'

type Point = [number, number]
type Geometry = { type: 'Polygon'; coordinates: Point[][] } | { type: 'MultiPolygon'; coordinates: Point[][][] }
type Geography = { features: { geometry: Geometry | null }[] }

function paintMap(canvas: HTMLCanvasElement, geography: Geography) {
  canvas.width = 2048
  canvas.height = 1024
  const context = canvas.getContext('2d')!
  context.fillStyle = '#607580'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#d9c199'
  context.strokeStyle = '#8d846b'
  context.lineWidth = 0.8
  for (const feature of geography.features) {
    if (!feature.geometry) continue
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const polygon of polygons) {
      context.beginPath()
      for (const ring of polygon) {
        ring.forEach(([longitude, latitude], index) => {
          const x = (longitude + 180) / 360 * canvas.width
          const y = (90 - latitude) / 180 * canvas.height
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.closePath()
      }
      context.fill('evenodd')
      context.stroke()
    }
  }
}

function originVector(latitude: number, longitude: number) {
  const lat = THREE.MathUtils.degToRad(latitude)
  const lon = THREE.MathUtils.degToRad(longitude)
  return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon))
}

export default function ExplorerGlobe({ selectedId, selectionVersion, reduced, onSelect, onMarkerPosition }: { selectedId: OriginId | null; selectionVersion: number; reduced: boolean; onSelect: (id: OriginId) => void; onMarkerPosition: (marker: HTMLElement | null, globeEdge?: number, position?: { x: number; y: number }) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const markersRef = useRef<(HTMLDivElement | null)[]>([])
  const gestureRef = useRef<{ x: number; y: number; lastX: number; lastY: number; dragging: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const selectionRef = useRef(selectedId)
  selectionRef.current = selectedId
  const markerPositionRef = useRef(onMarkerPosition)
  markerPositionRef.current = onMarkerPosition
  const commandsRef = useRef<{ update: () => void; draw: () => void; startDrag: () => void; drag: (x: number, y: number) => void; endDrag: () => void } | null>(null)
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const motionRef = useRef(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [mapAvailable, setMapAvailable] = useState(false)
  motionRef.current = !reduced && !systemReduced

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = (event: MediaQueryListEvent) => setSystemReduced(event.matches)
    preference.addEventListener('change', change)
    return () => preference.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    commandsRef.current?.update()
  }, [reduced, systemReduced])

  useEffect(() => { commandsRef.current?.draw() }, [selectedId, selectionVersion])

  useEffect(() => {
    const container = containerRef.current
    const map = mapRef.current
    if (!container || !map) return
    const abort = new AbortController()
    let disposeScene: (() => void) | undefined
    let disposed = false

    fetch('/data/ne_110m_admin_0_countries.geojson', { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error('Données géographiques indisponibles')
        return response.json() as Promise<Geography>
      })
      .then(geography => {
        if (disposed) return
        paintMap(map, geography)
        setMapAvailable(true)
        let renderer: THREE.WebGLRenderer
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
        } catch {
          setAvailable(false)
          return
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.domElement.className = 'globe-canvas'
        renderer.domElement.setAttribute('aria-hidden', 'true')
        container.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
        camera.position.set(0, 0.25, 3.45)
        const texture = new THREE.CanvasTexture(map)
        texture.colorSpace = THREE.SRGBColorSpace
        const geometry = new THREE.SphereGeometry(1, 96, 64)
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 })
        const earth = new THREE.Mesh(geometry, material)
        scene.add(earth, new THREE.AmbientLight(0xfff0d7, 1.15))
        const sun = new THREE.DirectionalLight(0xffefda, 1.6)
        sun.position.set(-3, 4, 5)
        scene.add(sun)
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enablePan = false
        controls.enableZoom = false
        controls.enableDamping = false
        controls.autoRotate = false
        controls.autoRotateSpeed = 0.45
        renderer.domElement.style.touchAction = 'pan-y pinch-zoom'
        let visible = true
        let dragging = false
        let contextLost = false
        let raf = 0
        let previous = 0
        const draw = () => {
          if (renderer.getContext().isContextLost()) return
          renderer.render(scene, camera)
          const { width, height } = container.getBoundingClientRect()
          origins.forEach((origin, index) => {
            const marker = markersRef.current[index]
            if (!marker) return
            const point = originVector(origin.latitude, origin.longitude)
            const projection = point.clone().project(camera)
            const x = (projection.x + 1) * width / 2
            const y = (1 - projection.y) * height / 2
            marker.hidden = point.dot(camera.position) <= 1.01 || x < 22 || x > width - 22 || y < 22 || y > height - 22
            marker.style.left = `${x}px`
            marker.style.top = `${y}px`
            marker.classList.toggle('globe-marker--left', x > width * 0.62)
          })
          const selectedIndex = origins.findIndex(origin => origin.id === selectionRef.current)
          const marker = selectedIndex < 0 ? null : markersRef.current[selectedIndex]
          const radius = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.sqrt(camera.position.lengthSq() - 1))
          const markerY = marker ? parseFloat(marker.style.top) - height / 2 : 0
          const globeEdge = width / 2 - Math.sqrt(Math.max(0, radius * radius - markerY * markerY))
          markerPositionRef.current(marker, globeEdge, marker ? { x: parseFloat(marker.style.left), y: parseFloat(marker.style.top) } : undefined)
        }
        const frame = (time: number) => {
          raf = 0
          if (contextLost || !motionRef.current || dragging || !visible || document.hidden) { previous = 0; return }
          const delta = previous ? Math.min((time - previous) / 1000, 0.05) : 0
          previous = time
          controls.autoRotate = true
          controls.update(delta)
          controls.autoRotate = false
          draw()
          raf = requestAnimationFrame(frame)
        }
        const update = () => {
          if (raf) cancelAnimationFrame(raf)
          raf = 0
          previous = 0
          if (!contextLost && motionRef.current && !dragging && visible && !document.hidden) raf = requestAnimationFrame(frame)
        }
        const start = () => {
          dragging = true
          renderer.domElement.classList.add('is-dragging')
          update()
        }
        const end = () => {
          dragging = false
          renderer.domElement.classList.remove('is-dragging')
          update()
        }
        const resize = () => {
          const { width, height } = container.getBoundingClientRect()
          if (!width || !height) return
          renderer.setSize(width, height, false)
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          draw()
        }
        const lost = (event: Event) => {
          event.preventDefault()
          contextLost = true
          cancelAnimationFrame(raf)
          raf = 0
          setAvailable(false)
          markerPositionRef.current(null)
        }
        controls.addEventListener('change', draw)
        controls.addEventListener('start', start)
        controls.addEventListener('end', end)
        renderer.domElement.addEventListener('webglcontextlost', lost)
        const resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(container)
        const layoutObserver = new ResizeObserver(() => { if (container.getBoundingClientRect().width) draw() })
        const atlas = container.closest('.explorer-atlas')
        const card = atlas?.querySelector('.origin-card')
        if (atlas) layoutObserver.observe(atlas)
        if (card) layoutObserver.observe(card)
        const intersection = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); update() })
        intersection.observe(container)
        const visibilityChange = () => update()
        document.addEventListener('visibilitychange', visibilityChange)
        commandsRef.current = {
          update,
          draw,
          startDrag: start,
          drag: (x, y) => {
            const spherical = new THREE.Spherical().setFromVector3(camera.position)
            spherical.theta -= x * 0.008
            spherical.phi = THREE.MathUtils.clamp(spherical.phi - y * 0.008, 0.02, Math.PI - 0.02)
            camera.position.setFromSpherical(spherical)
            controls.update()
            draw()
          },
          endDrag: end,
        }
        resize()
        setAvailable(true)
        update()
        disposeScene = () => {
          cancelAnimationFrame(raf)
          commandsRef.current = null
          document.removeEventListener('visibilitychange', visibilityChange)
          intersection.disconnect()
          resizeObserver.disconnect()
          layoutObserver.disconnect()
          controls.removeEventListener('change', draw)
          controls.removeEventListener('start', start)
          controls.removeEventListener('end', end)
          renderer.domElement.removeEventListener('webglcontextlost', lost)
          controls.dispose()
          texture.dispose()
          geometry.dispose()
          material.dispose()
          renderer.dispose()
          renderer.domElement.remove()
        }
      })
      .catch(() => { if (!disposed) setAvailable(false) })
    return () => { disposed = true; abort.abort(); disposeScene?.() }
  }, [])

  return (
    <div className="explorer-globe">
      <div className="globe-stage" ref={containerRef} data-available={available !== false}>
        <canvas ref={mapRef} className="globe-map" role="img" aria-label="Carte plane des continents" hidden={available !== false || !mapAvailable} />
        {available === false && !mapAvailable && <p className="globe-unavailable">La carte est momentanément indisponible.</p>}
        {origins.map((origin, index) => <div key={origin.id} ref={element => { markersRef.current[index] = element }} className="globe-marker" hidden>
          <button type="button" className="globe-pin" aria-label={`Afficher ${origin.name}`} aria-pressed={selectedId === origin.id} title={origin.name}
            onPointerDown={event => { suppressClickRef.current = false; gestureRef.current = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, dragging: false }; event.currentTarget.setPointerCapture(event.pointerId) }}
            onPointerMove={event => { const gesture = gestureRef.current; if (!gesture) return; if (!gesture.dragging && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { gesture.dragging = true; commandsRef.current?.startDrag() } if (gesture.dragging) commandsRef.current?.drag(event.clientX - gesture.lastX, event.clientY - gesture.lastY); gesture.lastX = event.clientX; gesture.lastY = event.clientY }}
            onPointerUp={() => { if (gestureRef.current?.dragging) { suppressClickRef.current = true; commandsRef.current?.endDrag() } gestureRef.current = null }}
            onPointerCancel={() => { if (gestureRef.current?.dragging) commandsRef.current?.endDrag(); gestureRef.current = null }}
            onLostPointerCapture={() => { if (gestureRef.current?.dragging) { suppressClickRef.current = true; commandsRef.current?.endDrag() } gestureRef.current = null }}
            onClick={event => { if (suppressClickRef.current && event.detail !== 0) { suppressClickRef.current = false; return } onSelect(origin.id) }}><span aria-hidden="true" /></button>
          {selectedId === origin.id && <span className="globe-callout" aria-hidden="true">{origin.name}<small>Repère régional</small></span>}
        </div>)}
      </div>
    </div>
  )
}