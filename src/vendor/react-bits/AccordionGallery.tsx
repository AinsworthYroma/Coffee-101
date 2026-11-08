import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type GalleryItem = { id: string; title: string; subtitle: string; principle: string; difference: string; caption: string; artwork: ReactNode }

export default function AccordionGallery({ items, onGuide }: { items: readonly GalleryItem[]; onGuide: (id: string) => void }) {
  const [selected, setSelected] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const active = hovered ?? focused ?? selected
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!direction) return
    event.preventDefault()
    buttons.current[(index + direction + items.length) % items.length]?.focus()
  }
  return <div className="accordion-gallery" onMouseLeave={() => setHovered(null)}>
    {items.map((item, index) => {
      const expanded = active === index
      return <section key={item.id} className={`ag-panel${expanded ? ' ag-panel--active' : ''}`} onMouseMove={event => { if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && (event.movementX || event.movementY)) { setFocused(null); setHovered(index) } }} onFocusCapture={event => { if (event.target.matches(':focus-visible')) { setHovered(null); setFocused(index) } }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null) }}>
        <div className="ag-art" aria-hidden="true">{item.artwork}</div>
        <button ref={element => { buttons.current[index] = element }} className="ag-trigger" type="button" aria-expanded={expanded} aria-controls={`gallery-${item.id}`} onClick={() => { setHovered(null); setFocused(index); setSelected(index) }} onKeyDown={event => moveFocus(event, index)}>
          <span className="ag-number">0{index + 1}</span><span className="ag-title">{item.title}</span><span className="ag-plus" aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button>
        <div className="ag-content" id={`gallery-${item.id}`} hidden={!expanded}>
          <div className="ag-copy"><p className="ag-subtitle">{item.subtitle}</p><p>{item.principle}</p><p className="ag-difference">{item.difference}</p><p className="ag-caption">{item.caption}</p><a href={`?vue=explorer&guide=traitements#${item.id}`} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setSelected(index); setHovered(null); setFocused(null); onGuide(item.id) } }}>Découvrir : {item.title} <span aria-hidden="true">↗</span></a></div>
        </div>
      </section>
    })}
  </div>
}