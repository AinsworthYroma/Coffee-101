import { useEffect, useId, useRef, useState } from 'react'

const phrase = 'PRÉPARER · EXPLORER · DÉGUSTER · UN CAFÉ À LA FOIS ·'
const sequence = `${phrase}\u00a0`

export default function CurvedLoop({ active, reduced, reverse = false }: { active: boolean; reduced: boolean; reverse?: boolean }) {
  const pathId = `curved-loop-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<SVGTextElement>(null)
  const textPathRef = useRef<SVGTextPathElement>(null)
  const offsetRef = useRef(0)
  const [spacing, setSpacing] = useState(0)
  const [dimensions, setDimensions] = useState({ width: 1440, height: 200 })
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let cancelled = false
    const measure = () => {
      if (cancelled || !containerRef.current || !measureRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      setDimensions({ width, height })
      setSpacing(measureRef.current.getComputedTextLength())
    }
    const observer = new ResizeObserver(measure)
    if (containerRef.current) observer.observe(containerRef.current)
    document.fonts.load('800 90px "Bricolage Grotesque"', sequence).then(measure).catch(() => {})
    return () => { cancelled = true; observer.disconnect() }
  }, [])

  useEffect(() => {
    if (!active || reduced || systemReduced || !spacing) return
    let frame = 0
    let last = 0
    let visible = false
    const tick = (now: number) => {
      if (last) offsetRef.current = (offsetRef.current + (reverse ? 1 : -1) * Math.min((now - last) / 1000, 0.05) * 30 + spacing) % spacing
      last = now
      textPathRef.current?.setAttribute('startOffset', `${offsetRef.current}px`)
      frame = requestAnimationFrame(tick)
    }
    const update = () => {
      if (visible && !document.hidden) {
        if (!frame) { last = 0; frame = requestAnimationFrame(tick) }
      } else {
        cancelAnimationFrame(frame)
        frame = 0
        last = 0
      }
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() })
    if (containerRef.current) observer.observe(containerRef.current)
    document.addEventListener('visibilitychange', update)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [active, reduced, systemReduced, spacing, reverse])

  const { width, height } = dimensions
  const extension = spacing + 200
  const baseline = height * (reverse ? 0.84 : 0.56)
  const path = `M${-extension},${baseline} L-100,${baseline} Q${width / 2},${height * (reverse ? 0.12 : 0.96)} ${width + 100},${baseline} L${width + extension},${baseline}`
  return <div className={`curved-loop${reverse ? ' curved-loop--reverse' : ''}`} ref={containerRef} aria-hidden="true">
    {!spacing && <div className="curved-loop__still">{phrase}</div>}
    <svg className="curved-loop__svg" viewBox={`0 0 ${width} ${height}`}>
      <defs><path id={pathId} d={path} /></defs>
      <text ref={measureRef} visibility="hidden" xmlSpace="preserve">{sequence}</text>
      {spacing > 0 && <text xmlSpace="preserve"><textPath ref={textPathRef} href={`#${pathId}`} startOffset={`${offsetRef.current}px`}>{sequence.repeat(Math.ceil((width + 2 * extension) / spacing) + 2)}</textPath></text>}
    </svg>
  </div>
}