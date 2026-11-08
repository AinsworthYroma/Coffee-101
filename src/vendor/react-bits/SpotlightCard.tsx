import { Children, isValidElement, useRef, type HTMLAttributes, type MouseEvent, type ReactNode, type MouseEventHandler } from 'react'
import type { TastingRecord } from '../../tastingStore'
import EspressoLibraryCard from '../../EspressoLibraryCard'

type ElementProps = { children?: ReactNode; record?: TastingRecord; className?: string; onClick?: MouseEventHandler<HTMLButtonElement> }

function libraryPresentation(children: ReactNode) {
  if (!isValidElement<ElementProps>(children) || children.type !== 'button' || !children.props.onClick) return null
  const parts = Children.toArray(children.props.children)
  const equipment = parts.find(part => isValidElement<ElementProps>(part) && part.props.record)
  if (!isValidElement<ElementProps>(equipment) || !equipment.props.record) return null
  const profile = parts.find(part => isValidElement<ElementProps>(part) && part.props.className === 'card-profile')
  const signature = isValidElement<ElementProps>(profile) ? Children.toArray(profile.props.children)[0] : null
  return { record: equipment.props.record, equipment, signature, onOpen: children.props.onClick }
}

export default function SpotlightCard({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  const cardRef = useRef<HTMLElement>(null)
  const presentation = className.split(/\s+/).includes('tasting-card-surface') ? libraryPresentation(children) : null
  const moveSpotlight = (event: MouseEvent<HTMLElement>) => {
    const card = cardRef.current
    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = card.getBoundingClientRect()
    card.style.setProperty('--spotlight-x', `${event.clientX - bounds.left}px`)
    card.style.setProperty('--spotlight-y', `${event.clientY - bounds.top}px`)
  }
  if (presentation) return <EspressoLibraryCard {...props} {...presentation} />
  return <article ref={cardRef} className={`spotlight-card ${className}`} onMouseMove={moveSpotlight} {...props}>{children}</article>
}
