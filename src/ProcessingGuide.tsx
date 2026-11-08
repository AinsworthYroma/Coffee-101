import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { processingSources, processingTopics } from './processing'

export default function ProcessingGuide({ onReturn }: { onReturn: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' })
        target.focus({ preventScroll: true })
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' })
        heading.current?.focus({ preventScroll: true })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return <main id="main" className="processing-guide wrap">
    <a className="text-link processing-back" href="?vue=explorer" onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onReturn() } }}><ArrowLeft size={17} aria-hidden="true" /> Retour à l’atlas</a>
    <header className="processing-heading"><p className="kicker">02 / EXPLORER</p><h1 ref={heading} tabIndex={-1}>Comprendre les traitements du café</h1><p>Après la récolte, les étapes qui séparent le grain de la cerise et le sèchent varient. La fermentation décrit des conditions possibles au cours de ce parcours.</p></header>
    <div className="processing-layout"><nav className="processing-index" aria-label="Sommaire des traitements"><h2>Dans ce guide</h2>{processingTopics.map(topic => <a key={topic.id} href={`#${topic.id}`}>{topic.title}</a>)}</nav>
      <div className="processing-content">{processingTopics.map((topic, index) => <section key={topic.id} className="processing-section" aria-labelledby={`${topic.id}-titre`}>
        <p className="kicker">{topic.id === 'fermentations' ? 'FERMENTATION' : 'TRAITEMENT'} / {String(index + 1).padStart(2, '0')}</p><h2 id={topic.id} tabIndex={-1}><span id={`${topic.id}-titre`}>{topic.title}</span></h2><p className="processing-subtitle">{topic.subtitle}</p>
        <p>{topic.principle}</p><h3>Les étapes</h3><p>{topic.steps}</p><h3>Ce qui change</h3><p>{topic.difference}</p><h3>En tasse</h3><p>{topic.cup}</p><h3>Un exemple documenté</h3><p>{topic.origin}</p><p className="processing-sources">Sources : {topic.sources.map((key, sourceIndex) => <span key={key}>{sourceIndex > 0 && ' · '}<a href={processingSources[key].url}>{processingSources[key].label}</a></span>)}. Les résultats décrivent les lots étudiés, pas tous les cafés de ces origines.</p>
      </section>)}</div></div>
  </main>
}