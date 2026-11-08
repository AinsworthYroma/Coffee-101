import { useId, useRef, useState, type HTMLAttributes, type MouseEventHandler, type PointerEvent, type ReactNode } from 'react'
import type { TastingRecord } from './tastingStore'
import './espresso-library-card.css'

type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & { record: TastingRecord; equipment: ReactNode; signature: ReactNode; onOpen: MouseEventHandler<HTMLButtonElement> }
const methods = { automatic: 'Machine automatique', aeropress: 'AeroPress', espresso: 'Porte-filtre', filter: 'Filtre' }

export default function EspressoLibraryCard({ record, equipment, signature, onOpen, className = '', ...props }: Props) {
  const [flipped, setFlipped] = useState(false)
  const id = useId()
  const card = useRef<HTMLElement>(null)
  const method = record.proposal?.choices.method
  const methodLabel = method === 'filter' && record.proposal?.choices.filterMode === 'v60' ? 'V60 manuel' : method === 'filter' ? 'Filtre électrique' : method ? methods[method] : 'Dégustation'
  const name = record.name.trim() || `${methodLabel} · ${record.date}`
  const facts = [
    ['Altitude', record.altitude],
    ['Traitement', record.processing === 'Autre' ? record.processingOther : record.processing],
    ['Torréfaction', record.roast],
    ['Torréfacteur', record.roaster],
  ].filter(([, value]) => value.trim())
  const resetTilt = () => {
    card.current?.style.setProperty('--espresso-rx', '0deg')
    card.current?.style.setProperty('--espresso-ry', '0deg')
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    try { if (localStorage.getItem('coffee101-reduce-animations') === 'true') return } catch { return }
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height))
    event.currentTarget.style.setProperty('--espresso-rx', `${(0.5 - y) * 5}deg`)
    event.currentTarget.style.setProperty('--espresso-ry', `${(x - 0.5) * 5}deg`)
    event.currentTarget.style.setProperty('--espresso-light-x', `${x * 100}%`)
    event.currentTarget.style.setProperty('--espresso-light-y', `${y * 100}%`)
  }
  return <article {...props} ref={card} className={`espresso-card ${className}`} aria-label={`Dégustation : ${name}`} onPointerMove={move} onPointerLeave={resetTilt} onPointerCancel={resetTilt} data-flipped={flipped}>
    <div className="espresso-card__stage">
      <div className="espresso-card__rotor">
        <div className="espresso-card__face espresso-card__front" inert={flipped || undefined} aria-hidden={flipped || undefined}>
          <div className="espresso-card__eyebrow"><span>{methodLabel}</span><span>{record.date}</span></div>
          <div className="espresso-card__machine">{equipment}</div>
          <div className="espresso-card__identity"><h3>{name}</h3>{record.country.trim() && <p>{record.country}</p>}{record.roaster.trim() && <p className="espresso-card__roaster">{record.roaster}</p>}</div>
        </div>
        <div id={`${id}-notes`} className="espresso-card__face espresso-card__back" inert={!flipped || undefined} aria-hidden={!flipped || undefined}>
          <div className="espresso-card__back-heading"><span className="espresso-card__caption">Notes de dégustation</span><h3>{name}</h3>{record.country.trim() && <p>{record.country}</p>}</div>
          {facts.length > 0 ? <dl className="espresso-card__facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="espresso-card__empty">Aucun repère renseigné pour le moment.</p>}
          <div className="espresso-card__aromas">{signature}<div><span className="espresso-card__caption">Signature aromatique</span><p>{record.aromas.length ? record.aromas.map(aroma => aroma.label).join(' · ') : 'Aucun arôme noté'}</p></div></div>
          {record.notes.trim() && <div className="espresso-card__notes"><span className="espresso-card__caption">Mes notes</span><p>{record.notes}</p></div>}
        </div>
      </div>
    </div>
    <div className="espresso-card__actions">
      <button type="button" aria-controls={`${id}-notes`} aria-expanded={flipped} aria-label={flipped ? `Retour au café ${name}` : `Voir les notes de ${name}`} onClick={() => { resetTilt(); setFlipped(value => !value) }}>{flipped ? '← Retour' : 'Voir les notes ↗'}</button>
      {flipped && <button type="button" className="espresso-card__open" onClick={onOpen} aria-label={`Ouvrir la fiche ${name}`}>Ouvrir la fiche →</button>}
    </div>
  </article>
}
