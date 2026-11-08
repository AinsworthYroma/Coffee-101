import { useEffect } from 'react'
import './tasting-detail-glass.css'

export default function TastingDetailAppearance() {
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    const selector = '.tasting-detail :is(.tasting-detail-head, .detail-wheel, .detail-impressions, .detail-recipe)'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    let active: HTMLElement | null = null
    const clear = () => {
      active?.style.removeProperty('--detail-glow')
      active?.style.removeProperty('--detail-light-x')
      active?.style.removeProperty('--detail-light-y')
      active = null
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || reduced.matches || !fine.matches) { clear(); return }
      try { if (localStorage.getItem('coffee101-reduce-animations') === 'true') { clear(); return } } catch { clear(); return }
      const panel = event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null
      if (!panel || !root.contains(panel)) { clear(); return }
      if (active !== panel) clear()
      active = panel
      const bounds = panel.getBoundingClientRect()
      panel.style.setProperty('--detail-light-x', `${event.clientX - bounds.left}px`)
      panel.style.setProperty('--detail-light-y', `${event.clientY - bounds.top}px`)
      panel.style.setProperty('--detail-glow', '.12')
    }
    const leave = (event: PointerEvent) => {
      if (active && !(event.relatedTarget instanceof Node && active.contains(event.relatedTarget))) clear()
    }
    root.addEventListener('pointermove', move, { passive: true })
    root.addEventListener('pointerout', leave, { passive: true })
    root.addEventListener('pointercancel', clear, { passive: true })
    return () => {
      root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerout', leave)
      root.removeEventListener('pointercancel', clear)
      clear()
    }
  }, [])
  return null
}
