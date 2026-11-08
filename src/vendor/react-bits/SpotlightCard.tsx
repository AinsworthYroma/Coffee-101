import { useRef, type HTMLAttributes, type MouseEvent } from 'react'

export default function SpotlightCard({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  const cardRef = useRef<HTMLElement>(null)
  const moveSpotlight = (event: MouseEvent<HTMLElement>) => {
    const card = cardRef.current
    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = card.getBoundingClientRect()
    card.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`)
    card.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`)
  }
  return <article ref={cardRef} className={`spotlight-card ${className}`} onMouseMove={moveSpotlight} {...props}>{children}</article>
}