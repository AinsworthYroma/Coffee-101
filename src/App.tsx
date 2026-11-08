import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { gift } from './config/gift'
import Preparation, { type TastingProposal } from './Preparation'
import GooeyNav from './vendor/react-bits/GooeyNav'
import BrandMark from './BrandMark'
import ProcessingGuide from './ProcessingGuide'
import { processingTopics } from './processing'
import { origins, type OriginId } from './origins'
import { originImages } from './originImages'
import ProcessingGallery from './ProcessingGallery'
import Tasting from './Tasting'
import CurvedLoop from './vendor/react-bits/CurvedLoop'
import SpecularButton from './vendor/react-bits/SpecularButton'
import Account from './Account'
import './atlas.css'

const CremaBackground = lazy(() => import('./CremaBackground'))
const ExplorerGlobe = lazy(() => import('./ExplorerGlobe'))

type View = 'preparer' | 'explorer' | 'deguster'

const navigation: { id: View; label: string; number: string }[] = [
  { id: 'preparer', label: 'Préparer', number: '01' },
  { id: 'explorer', label: 'Explorer', number: '02' },
  { id: 'deguster', label: 'Déguster', number: '03' },
]

function currentView(): View {
  const view = new URLSearchParams(window.location.search).get('vue')
  return view === 'explorer' || view === 'deguster' ? view : 'preparer'
}

function Header({ view, navigate }: { view: View; navigate: (index: number) => void }) {
  return (
    <header className={`site-header site-header--dark${view !== 'deguster' ? ' site-header--landing' : ''}`}>
      {view === 'deguster' && <a className="brand" href="?vue=preparer" aria-label="Coffee 101, accueil" onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(0) } }}>
        <BrandMark />
        <span>coffee <strong>101</strong><small>UN CAFÉ À LA FOIS</small></span>
      </a>}
      <GooeyNav ariaLabel="Navigation principale" items={navigation.map(item => ({ label: item.label, href: `?vue=${item.id}` }))} activeIndex={navigation.findIndex(item => item.id === view)} onNavigate={navigate} color="#f0d9b3" activeTextColor="#24150e" colors={['#d4a565', '#f0d9b3']} animationTime={450} particleCount={6} timeVariance={60} spread={24} gooeyness={0.45} wobble={0.15} hoverEffect={false} />
      <Account />
    </header>
  )
}

function Landing({ onTaste, active, reduced, onExplore }: { onTaste: (proposal: TastingProposal) => void; active: boolean; reduced: boolean; onExplore: () => void }) {
  return (
    <main id={active ? 'main' : undefined}>
      <section className={`hero wrap${reduced ? ' hero--reduced' : ''}`} aria-labelledby="hero-title">
        <CurvedLoop active={active} reduced={reduced} />
        <div className="hero-copy">
          <h1 id="hero-title" aria-label="Ta prochaine bonne tasse commence ici."><span aria-hidden="true" className="hero-title-words">{['Ta', 'prochaine', 'bonne', 'tasse', 'commence', 'ici.'].map((word, index) => <span key={word} style={{ animationDelay: `${index * 65}ms` }}>{word}</span>)}</span></h1>
          {gift.dedication && <p className="dedication">{gift.dedication}</p>}
          <div className="hero-actions">
            <SpecularButton className="hero-primary" radius={4} tint="#f0d9b3" tintOpacity={1} textColor="#25150e" lineColor="#fff1d2" baseColor="#c69a68" followMouse={false} autoAnimate={false} onClick={() => document.getElementById('ma-machine')?.scrollIntoView()}>Préparer ma tasse</SpecularButton>
            <a className="hero-secondary" href="?vue=explorer" onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onExplore() } }}>Explorer les origines</a>
          </div>
        </div>
        <CurvedLoop active={active} reduced={reduced} reverse />
      </section>

      <div className="reading-surface"><Preparation onTaste={onTaste} /></div>
    </main>
  )
}

function Explorer({ active, reduced, onGuide }: { active: boolean; reduced: boolean; onGuide: (section?: string) => void }) {
  const [selectedId, setSelectedId] = useState<OriginId | null>(null)
  const [selectionVersion, setSelectionVersion] = useState(0)
  const selected = origins.find(origin => origin.id === selectedId)
  const atlasRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<SVGLineElement>(null)
  const selectOrigin = (id: OriginId) => { if (lineRef.current) lineRef.current.style.display = 'none'; setSelectedId(id); setSelectionVersion(value => value + 1) }
  const updateLine = (marker: HTMLElement | null, globeEdge = 0, position?: { x: number; y: number }) => {
    const atlas = atlasRef.current
    const line = lineRef.current
    const card = atlas?.querySelector<HTMLElement>('.origin-card')
    const globe = atlas?.querySelector<HTMLElement>('.globe-stage')
    if (!atlas || !line || !card || !globe || !marker || marker.hidden || !position) { if (line) line.style.display = 'none'; return }
    const bounds = atlas.getBoundingClientRect()
    const cardBounds = card.getBoundingClientRect()
    const globeBounds = globe.getBoundingClientRect()
    const markerX = globeBounds.left + position.x
    const markerY = globeBounds.top + position.y
    if (cardBounds.right >= globeBounds.left || markerX > globeBounds.left + globeEdge + 24 || markerY < cardBounds.top || markerY > cardBounds.bottom || cardBounds.width < 160) { line.style.display = 'none'; return }
    line.setAttribute('x1', String(cardBounds.right - bounds.left))
    line.setAttribute('y1', String(markerY - bounds.top))
    line.setAttribute('x2', String(markerX - bounds.left))
    line.setAttribute('y2', String(markerY - bounds.top))
    line.style.display = ''
  }
  return (
    <main id={active ? 'main' : undefined} className="explorer-layout wrap">
      <div className="explorer-atlas" ref={atlasRef}>
      <svg className="origin-connector" aria-hidden="true"><line ref={lineRef} style={{ display: 'none' }} /></svg>
      <article className={`origin-card${reduced ? ' origin-card--reduced' : ''}`} aria-labelledby="origin-title" data-origin={selected?.id} data-selection-version={selectionVersion}>
        {selected ? <><div className="origin-destination" key={selected.id}>
        <figure className="origin-photo"><img src={originImages[selected.id].src} alt={originImages[selected.id].alt} /><figcaption>{originImages[selected.id].caption}</figcaption></figure>
        <p className="origin-card-kicker">REPÈRE RÉGIONAL</p><h2 id="origin-title">{selected.name}</h2><p className="origin-intro">{selected.intro}</p></div>
        <details><summary>En tasse</summary><p>{selected.cup}</p></details><details><summary>Altitudes &amp; origines</summary><p>{selected.countries} {selected.altitude}</p></details>
        <details><summary>Traitements</summary><p>{selected.processingText}</p><div className="origin-processing-links">{selected.processing.map(id => { const topic = processingTopics.find(item => item.id === id)!; return <a key={id} href={`?vue=explorer&guide=traitements#${id}`} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onGuide(id) } }}>{topic.title} <ArrowUpRight size={14} aria-hidden="true" /></a> })}</div></details>
        <details className="origin-sources"><summary>Sources</summary><ul>{selected.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label} <ArrowUpRight size={13} aria-hidden="true" /></a></li>)}</ul></details></> : <><div className="origin-previews">{origins.map(origin => <button key={origin.id} type="button" aria-label={`Découvrir ${origin.name}`} onClick={() => selectOrigin(origin.id)}><img src={originImages[origin.id].src} alt="" /><span>{origin.name}</span></button>)}</div><p className="origin-card-kicker">TROIS REPÈRES, MILLE HISTOIRES</p><h2 id="origin-title">À toi de choisir</h2><p className="origin-intro">Choisis une région sur le globe ou dans la liste pour découvrir son histoire.</p></>}
        <details className="origin-photo-credits"><summary>Crédits des photographies</summary><ul>{origins.map(origin => { const image = originImages[origin.id]; return <li key={origin.id}>{image.caption} : <a href={image.source} target="_blank" rel="noreferrer">{image.author}</a> · <a href={image.licenseUrl} target="_blank" rel="noreferrer">{image.license}</a> · image recadrée.</li> })}</ul></details>
      </article>
      <div className="explorer-earth"><Suspense fallback={<div className="globe-stage" />}><ExplorerGlobe selectedId={selectedId} selectionVersion={selectionVersion} reduced={reduced} onSelect={selectOrigin} onMarkerPosition={updateLine} /></Suspense></div>
      <section className="explorer-details" aria-labelledby="explorer-title">
        <p className="kicker">02 / EXPLORER</p>
        <h1 id="explorer-title">Le café a<br /><em>des histoires.</em></h1>
        <p>Trois régions, autant de pistes pour découvrir les cafés du monde.</p>
        <div className="explorer-origins">
          <h2>Les origines</h2>
          <div role="group" aria-label="Choisir une région"><ul className="origin-choices" aria-label="Liste des origines">{origins.map(origin => <li key={origin.id}><button type="button" aria-pressed={selectedId === origin.id} onClick={() => selectOrigin(origin.id)}>{origin.name}</button></li>)}</ul></div>
        </div>
      </section>
      </div>
      <section className="explorer-processing" aria-labelledby="gallery-title"><p className="kicker">DU FRUIT AU GRAIN</p><h2 id="gallery-title">Les traitements</h2><p>Après la récolte, le café peut être préparé de différentes façons.</p><ProcessingGallery onGuide={onGuide} /></section>
    </main>
  )
}

function Footer({ reduced, onChange }: { reduced: boolean; onChange: (value: boolean) => void }) {
  return <footer className="site-footer"><div className="wrap footer-inner"><fieldset className="display-settings"><legend>Préférences d’affichage</legend><label className="motion-setting"><input type="checkbox" checked={reduced} onChange={event => onChange(event.target.checked)} /> Réduire les animations</label></fieldset></div></footer>
}

export default function App() {
  const [view, setView] = useState(currentView)
  const [guide, setGuide] = useState(() => new URLSearchParams(window.location.search).get('guide') === 'traitements')
  const [explorerVisited, setExplorerVisited] = useState(() => currentView() === 'explorer')
  const atlasScroll = useRef(0)
  const [proposal, setProposal] = useState<TastingProposal | null>(null)
  const [libraryRequest, setLibraryRequest] = useState(0)
  const transferring = useRef(false)
  const [reduced, setReduced] = useState(() => {
    try { return window.localStorage.getItem('coffee101-reduce-animations') === 'true' } catch { return false }
  })
  const updateReduced = (value: boolean) => {
    setReduced(value)
    try { window.localStorage.setItem('coffee101-reduce-animations', String(value)) } catch { return }
  }
  useEffect(() => {
    const update = () => {
      const next = currentView()
      setView(next)
      if (next === 'explorer') setExplorerVisited(true)
      setGuide(new URLSearchParams(window.location.search).get('guide') === 'traitements')
    }
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  useEffect(() => {
    if (view !== 'explorer' || guide || typeof window.history.state?.atlasScroll !== 'number') return
    atlasScroll.current = window.history.state.atlasScroll
    const frame = requestAnimationFrame(() => window.scrollTo({ top: atlasScroll.current, behavior: 'instant' }))
    return () => cancelAnimationFrame(frame)
  }, [view, guide])
  const navigate = (index: number) => {
    const next = navigation[index]?.id
    if (!next || (next === view && !guide)) return
    window.history.pushState({}, '', `?vue=${next}`)
    setView(next)
    if (next !== 'deguster') transferring.current = false
    if (next === 'deguster') setLibraryRequest(value => value + 1)
    if (next === 'explorer') setExplorerVisited(true)
    setGuide(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const openGuide = (section?: string) => {
    atlasScroll.current = window.scrollY
    window.history.replaceState({ ...window.history.state, atlasScroll: atlasScroll.current }, '')
    window.history.pushState({}, '', `?vue=explorer&guide=traitements${section ? `#${section}` : ''}`)
    setGuide(true)
  }
  const returnToAtlas = () => {
    window.history.pushState({ atlasScroll: atlasScroll.current }, '', '?vue=explorer')
    setGuide(false)
  }
  const startTasting = (next: TastingProposal) => {
    if (transferring.current) return
    transferring.current = true
    navigate(2)
    setProposal(structuredClone(next))
  }
  return <div className={`app-shell app-shell--${view}`}><a className="skip-link" href="#main">Aller au contenu</a><Suspense fallback={<div className="crema-background crema-fallback" aria-hidden="true" />}><CremaBackground reduced={reduced} /></Suspense><Header view={view} navigate={navigate} /><div hidden={view !== 'preparer'}><Landing onTaste={startTasting} active={view === 'preparer'} reduced={reduced} onExplore={() => navigate(1)} /></div><div className="preview-surface" hidden={view === 'preparer'}>{explorerVisited && <div hidden={view !== 'explorer' || guide}><Explorer active={view === 'explorer' && !guide} reduced={reduced} onGuide={openGuide} /></div>}{view === 'explorer' && guide && <ProcessingGuide onReturn={returnToAtlas} />}<div hidden={view !== 'deguster'}><Tasting active={view === 'deguster'} proposal={proposal} clearProposal={() => setProposal(null)} libraryRequest={libraryRequest} onReturn={() => navigate(0)} /></div></div><Footer reduced={reduced} onChange={updateReduced} /></div>
}
