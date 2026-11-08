import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { initialChoices, makeRecipe, type Method, type Recipe, type RecipeChoices } from './recipes'
import OptionWheel from './vendor/react-bits/OptionWheel'
import SpecularButton from './vendor/react-bits/SpecularButton'
import './preparation.css'

const EquipmentScene = lazy(() => import('./EquipmentScene'))

class CarouselFallback extends Component<{ children: ReactNode; active: number }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <div className="equipment-fallback" aria-hidden="true">{[-1, 0, 1].map(offset => <img key={offset} className={offset === 0 ? 'is-active' : ''} src={methods[(this.props.active + offset + methods.length) % methods.length].image} alt="" />)}</div> : this.props.children
  }
}

const methods: { id: Method; title: string; description: string; image: string; equipment: string }[] = [
  { id: 'automatic', title: 'Ta machine automatique', description: 'Un espresso avec ta machine à grains.', image: '/equipements/automatique.png', equipment: 'Machine automatique à grains, eau fraîche et tasse.' },
  { id: 'aeropress', title: 'AeroPress', description: 'Une infusion douce et polyvalente.', image: '/equipements/aeropress.png', equipment: 'AeroPress Original, filtre papier, bouilloire et tasse solide.' },
  { id: 'espresso', title: 'Espresso au porte-filtre', description: 'Une extraction préparée à la main.', image: '/equipements/porteFiltre.png', equipment: 'Machine espresso, porte-filtre, moulin, balance et tasse.' },
  { id: 'filter', title: 'Café filtre & V60', description: 'En cafetière électrique ou à la main.', image: '/equipements/filtre.png', equipment: 'Cafetière filtre électrique ou V60, filtre papier et balance.' },
]
const roasts = [
  { value: 'light', label: 'Claire' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'dark', label: 'Foncée' },
  { value: 'unknown', label: 'Je ne sais pas' },
] as const
const roastLabels = roasts.map(roast => roast.label)
const profiles = [
  { value: 'round', label: 'Rond & gourmand', description: 'Une tasse enveloppante, avec une sensation d’équilibre et de gourmandise.' },
  { value: 'expressive', label: 'Expressif & complexe', description: 'Des arômes plus distincts et les nuances de ton café à explorer.' },
] as const

export interface TastingProposal {
  choices: RecipeChoices
  methodName: string
  parameters: { label: string; value: string }[]
  recipe: Recipe
}

export default function Preparation({ onTaste }: { onTaste: (proposal: TastingProposal) => void }) {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState<Method | null>(null)
  const [choices, setChoices] = useState<Record<Method, RecipeChoices>>(() => Object.fromEntries(methods.map(method => [method.id, { ...initialChoices, method: method.id }])) as Record<Method, RecipeChoices>)
  const trigger = useRef<HTMLElement | null>(null)
  const scroll = useRef(0)
  const section = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const current = methods.find(method => method.id === open)
  const selected = open ? choices[open] : null
  const recipe = selected ? makeRecipe(selected) : null

  useEffect(() => {
    if (open) {
      section.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      heading.current?.focus({ preventScroll: true })
    }
  }, [open])

  const show = (index: number, element?: HTMLElement) => {
    scroll.current = window.scrollY
    trigger.current = element ?? section.current?.querySelector<HTMLElement>('.circular-carousel') ?? null
    setActive(index)
    setOpen(methods[index].id)
  }
  const close = () => {
    setOpen(null)
    requestAnimationFrame(() => {
      window.scrollTo({ top: scroll.current, behavior: 'instant' })
      trigger.current?.focus({ preventScroll: true })
    })
  }
  const update = (patch: Partial<RecipeChoices>) => {
    if (open) setChoices(previous => ({ ...previous, [open]: { ...previous[open], ...patch } }))
  }
  const move = (delta: number) => {
    setActive(previous => (previous + delta + methods.length) % methods.length)
  }

  return <section className="preparation wrap" id="ma-machine" aria-labelledby="preparation-title" ref={section}>
    <div className="preparation-top"><p className="kicker">01 / PRÉPARER</p></div>
    <div hidden={open !== null}>
      <div className="preparation-heading"><h2 id="preparation-title">Comment veux-tu préparer <em>ton café ?</em></h2><span className="preparation-count">{String(active + 1).padStart(2, '0')} <span>/ 04</span></span></div>
      <div className="carousel-stage"><CarouselFallback active={active}><Suspense fallback={<div className="carousel-loading">Chargement des équipements…</div>}><EquipmentScene active={active} enabled={open === null} title={methods[active].title} onMove={move} onOpen={(index, element) => show(index, element)} /></Suspense></CarouselFallback></div>
      <div className="carousel-controls"><button type="button" onClick={() => move(-1)} aria-label="Méthode précédente"><ArrowLeft size={20} /></button><strong className="carousel-active-name" aria-live="polite" aria-atomic="true">{methods[active].title}</strong><button type="button" onClick={() => move(1)} aria-label="Méthode suivante"><ArrowRight size={20} /></button></div>
      <div className="method-access" aria-label="Ouvrir une méthode">{methods.map((method, index) => <button key={method.id} type="button" onClick={event => show(index, event.currentTarget)} aria-label={`Ouvrir la fiche ${method.title}`}><span>{String(index + 1).padStart(2, '0')}</span>{method.title}<ArrowUpRight size={16} aria-hidden="true" /></button>)}</div>
      <details className="method-credits"><summary>Crédits des modèles 3D</summary><ul>
        <li><a href="https://sketchfab.com/3d-models/4e2f800066d64fee9a4129d6c3850992">Machine automatique : idehn_3d</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></li>
        <li>AeroPress : illustration originale de Coffee 101.</li>
        <li><a href="https://sketchfab.com/3d-models/coffee-machine-3d-model-8178f0abb4214672961cc650cf880e9a">Porte-filtre : keshavV20</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></li>
        <li><a href="https://sketchfab.com/3d-models/coffee-maker-9ccda2fddba846e6ba97eb774b8a09c6">Cafetière filtre : Fredrik Johansen</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></li>
      </ul><p>Modèles recadrés et éclairés pour cette présentation ; la couleur de la machine automatique a été modifiée. Les appareils illustrent des catégories et ne reproduisent pas nécessairement ton matériel.</p></details>
    </div>
    {current && selected && recipe && <div className="recipe-detail">
      <button className="back-methods" type="button" onClick={close}><ArrowLeft size={18} aria-hidden="true" /> Retour aux méthodes</button>
      <div className="recipe-intro"><div><p className="kicker">TA MÉTHODE / {String(methods.findIndex(method => method.id === open) + 1).padStart(2, '0')}</p><h2 ref={heading} tabIndex={-1}>{current.title}</h2><p>{current.description}</p><p><strong>Il te faut :</strong> {current.equipment}</p></div><img src={current.image} alt="" /></div>
      <div className="recipe-layout"><div className="recipe-settings">
        {open === 'filter' && <fieldset><legend>Ta méthode filtre</legend><div className="option-row">{([{ value: 'electric', label: 'Cafetière filtre électrique' }, { value: 'v60', label: 'V60 manuel' }] as const).map(option => <label key={option.value}><input type="radio" name="filter-mode" checked={selected.filterMode === option.value} onChange={() => update({ filterMode: option.value })} />{option.label}</label>)}</div></fieldset>}
        <fieldset><legend>Ta torréfaction</legend><p>La torréfaction est parfois indiquée sur le paquet. Sinon, choisis « Je ne sais pas ».</p><div className="roast-wheel"><OptionWheel items={roastLabels} label="Ta torréfaction" selected={roasts.findIndex(roast => roast.value === selected.roast)} onChange={index => update({ roast: roasts[index].value })} /></div></fieldset>
        <fieldset><legend id="profile-label">Ton envie</legend><div className="profile-options" role="radiogroup" aria-labelledby="profile-label" onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
          event.preventDefault()
          const next = selected.profile === 'round' ? 'expressive' : 'round'
          update({ profile: next })
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next === 'round' ? 0 : 1]?.focus()
        }}>{profiles.map(profile => <SpecularButton key={profile.value} role="radio" aria-checked={selected.profile === profile.value} tabIndex={selected.profile === profile.value ? 0 : -1} onClick={() => update({ profile: profile.value })} className="profile-button" radius={6} tint="#482719" tintOpacity={0.14} textColor="#26180f" lineColor="#f0d9b3" baseColor="#a56836" intensity={0.7} idleIntensity={0.3} glow={0.3}><span className="profile-indicator" aria-hidden="true" /><span><strong style={{ color: selected.profile === profile.value ? '#f0e2c9' : '#26180f' }}>{profile.label}</strong><small style={{ color: selected.profile === profile.value ? '#f0e2c9' : '#26180f' }}>{profile.description}</small></span></SpecularButton>)}</div><p>Pour commencer : explore les profils ronds en espresso, et les profils expressifs en filtre, V60 ou AeroPress. Ce sont des pistes, pas des règles : chaque méthode permet plusieurs styles de tasse.</p></fieldset>
        {open === 'filter' && <label className="quantity-label">Eau à préparer <select value={selected.quantity} onChange={event => update({ quantity: Number(event.target.value) })}>{[250, 300, 400, 500, 600, 750].map(value => <option key={value} value={value}>{value} ml</option>)}</select></label>}
        {open === 'espresso' && <label className="quantity-label">Capacité de ton panier <select value={selected.basket} onChange={event => update({ basket: Number(event.target.value) })}>{[14, 15, 16, 17, 18, 19, 20, 21, 22].map(value => <option key={value} value={value}>{value} g</option>)}</select></label>}
      </div><div className="recipe-result"><p className="kicker">UNE BASE POUR COMMENCER</p><h3>Ta recette</h3><p className="recipe-summary">{selected.roast === 'unknown' ? 'Torréfaction inconnue' : ({ light: 'Claire', medium: 'Moyenne', dark: 'Foncée' } as const)[selected.roast]} · {selected.profile === 'round' ? 'Rond & gourmand' : 'Expressif & complexe'}{open === 'filter' ? ` · ${selected.filterMode === 'v60' ? 'V60 manuel' : 'Filtre électrique'}` : ''}</p><dl className="recipe-parameters">{recipe.parameters.map(parameter => <div key={`${parameter.label}-${parameter.value}`}><dt>{parameter.label}</dt><dd>{parameter.value}</dd></div>)}</dl><h4>Préparation</h4><ol className="recipe-steps">{recipe.steps.map(step => <li key={step}>{step}</li>)}</ol><h4>Ce qui change avec ton choix</h4>{recipe.adaptation.map(text => <p key={text}>{text}</p>)}<h4>Pour la prochaine tasse</h4><p>{recipe.adjustment}</p><p>{recipe.result}</p>{recipe.assumptions.map(text => <p className="recipe-assumption" key={text}>{text}</p>)}<p className="recipe-sources">Sources : {recipe.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} <ArrowUpRight size={13} aria-hidden="true" /></a>)}</p><button className="button button-dark taste-button" type="button" onClick={() => onTaste({ choices: { ...selected }, methodName: current.title, parameters: recipe.parameters.map(parameter => ({ ...parameter })), recipe: structuredClone(recipe) })}>Déguster ce café <ArrowRight size={18} aria-hidden="true" /></button></div></div>
    </div>}
  </section>
}