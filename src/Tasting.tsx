import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Download, FileUp, Plus } from 'lucide-react'
import type { TastingProposal } from './Preparation'
import { aromas, type AromaNode } from './aromas'
import { isStore, loadStore, newTasting, saveStore, StaleNotebookError, type AromaChoice, type TastingRecord, type TastingStore } from './tastingStore'
import { initializeAuth, supabase } from './auth'
import { isNotebookPayload, isTechnicalPlaceholder, loadAccountStore, loadNotebookConflicts, notebookClient, resolveNotebookConflicts, saveAccountStore, synchronizeNotebook, type ConflictDetails, type Payload } from './notebookSync'
import { failNotebookSync, finishNotebookSync, finishNotebookWrite, markNotebookFailure, markNotebookPending, notebookActivity, startNotebookSync, startNotebookWrite } from './notebookActivity'
import { observeAuth } from './sharedAuth'
import type { Session } from '@supabase/supabase-js'
import BrandMark from './BrandMark'
import SpotlightCard from './vendor/react-bits/SpotlightCard'
import SpecularButton from './vendor/react-bits/SpecularButton'
import './tasting.css'

const colors = ['#d76c38', '#c56d86', '#d2a13b', '#91634d', '#b34d4b', '#685345', '#6e9252', '#a2a741', '#958777']
const signatureColors = ['#b95636', '#a75d70', '#bf8730', '#79513d', '#a9433e', '#614338', '#a87756', '#a66b42', '#8f7b70']
const methods = { automatic: 'Machine automatique', aeropress: 'AeroPress', espresso: 'Porte-filtre', filter: 'Filtre' }
const images = { automatic: '/equipements/automatique.png', aeropress: '/equipements/aeropress.png', espresso: '/equipements/porteFiltre.png', filter: '/equipements/filtre.png' }
const methodName = (record: TastingRecord) => record.proposal ? record.proposal.choices.method === 'filter' ? record.proposal.choices.filterMode === 'v60' ? 'V60 manuel' : 'Filtre électrique' : methods[record.proposal.choices.method] : 'Méthode non renseignée'
const title = (record: TastingRecord) => record.name.trim() || `${methodName(record)} · ${record.date}`
const blankStore = (): TastingStore => ({ version: 1, drafts: [], records: [] })
function uniqueTastingId(store: TastingStore): string {
  const taken = new Set([...store.drafts, ...store.records].map(item => item.id))
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = crypto.randomUUID()
    if (!taken.has(id)) return id
  }
  throw new Error('Unable to allocate notebook identifier')
}

function Equipment({ record }: { record: TastingRecord }) {
  const method = record.proposal?.choices.method
  const isV60 = method === 'filter' && record.proposal?.choices.filterMode === 'v60'
  return <div className="tasting-equipment">{method && !isV60 ? <img src={images[method]} alt="" onError={event => { event.currentTarget.hidden = true }} /> : <span aria-hidden="true">{isV60 ? 'V60' : '☕'}</span>}</div>
}

function descendants(node: AromaNode): string[] { return [node.id, ...(node.children ?? []).flatMap(descendants)] }
function AromaSignature({ choices, detailed = false }: { choices: AromaChoice[]; detailed?: boolean }) {
  const selected = aromas.map(family => choices.some(choice => descendants(family).includes(choice.id)))
  return <span className={`aroma-signature${detailed ? ' aroma-signature-detail' : ''}`} aria-hidden="true"><svg viewBox="0 0 120 120">{aromas.map((family, index) => {
    const start = -Math.PI / 2 + index * 2 * Math.PI / aromas.length
    const end = -Math.PI / 2 + (index + 1) * 2 * Math.PI / aromas.length
    return <path key={family.id} d={`M 60 60 L ${60 + 56 * Math.cos(start)} ${60 + 56 * Math.sin(start)} A 56 56 0 0 1 ${60 + 56 * Math.cos(end)} ${60 + 56 * Math.sin(end)} Z`} fill={selected[index] ? signatureColors[index] : '#e5d7c6'} stroke="#f7efe0" strokeWidth="2" />
  })}<circle cx="60" cy="60" r="21" fill="#f7efe0" /></svg></span>
}
function findPath(nodes: AromaNode[], id: string, parents: AromaNode[] = []): AromaNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [...parents, node]
    const found = findPath(node.children ?? [], id, [...parents, node])
    if (found) return found
  }
  return null
}
function Wheel({ choices, onChange }: { choices: AromaChoice[]; onChange: (choices: AromaChoice[]) => void }) {
  const [path, setPath] = useState<AromaNode[]>([])
  const [other, setOther] = useState('')
  const nodes = path.length ? path[path.length - 1].children ?? [] : aromas
  const toggle = (node: AromaNode) => {
    if (choices.some(choice => choice.id === node.id)) { onChange(choices.filter(choice => choice.id !== node.id)); return }
    const ancestry = findPath(aromas, node.id) ?? []
    const redundant = new Set([...ancestry.map(item => item.id), ...descendants(node)])
    onChange([...choices.filter(choice => !redundant.has(choice.id)), { id: node.id, label: node.label }])
  }
  const addOther = () => {
    const label = other.trim()
    if (label && !choices.some(choice => choice.label.toLocaleLowerCase('fr') === label.toLocaleLowerCase('fr'))) onChange([...choices, { id: `libre-${crypto.randomUUID()}`, label }])
    setOther('')
  }
  const point = (angle: number, radius: number) => [150 + radius * Math.cos(angle), 150 + radius * Math.sin(angle)]
  return <section className="aroma-section"><p className="kicker">03 / TES IMPRESSIONS</p><h2>La roue des arômes</h2><p>Choisis ce que ce café t’évoque. Une impression générale suffit.</p><p className="tasting-hint">Vocabulaire provisoire : cette roue ne reproduit pas encore toutes les notes de la référence.</p><div className="wheel-layout"><div><div className="wheel-breadcrumb"><button type="button" onClick={() => setPath([])}>Toutes les familles</button>{path.map((node, index) => <span key={node.id}> / <button type="button" onClick={() => setPath(path.slice(0, index + 1))}>{node.label}</button></span>)}</div><svg className="aroma-wheel" viewBox="0 0 300 300" role="group" aria-label="Explorer les familles aromatiques">
    {nodes.map((node, index) => {
      const start = -Math.PI / 2 + index * 2 * Math.PI / nodes.length
      const end = -Math.PI / 2 + (index + 1) * 2 * Math.PI / nodes.length
      const [x1, y1] = point(start, 145); const [x2, y2] = point(end - 0.00001, 145)
      const [tx, ty] = point((start + end) / 2, 98)
      const selected = choices.some(choice => choice.id === node.id)
      return <g key={node.id} role="button" tabIndex={0} aria-label={`${node.label} : ${node.children?.length ? 'explorer' : selected ? 'retirer' : 'sélectionner'}`} onClick={() => node.children?.length ? setPath([...path, node]) : toggle(node)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); node.children?.length ? setPath([...path, node]) : toggle(node) } }}><path d={`M 150 150 L ${x1} ${y1} A 145 145 0 ${end - start > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`} fill={colors[path.length ? aromas.findIndex(family => family.id === path[0].id) : index]} stroke="#fff8ed" strokeWidth="2" /><text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle">{selected ? '✓ ' : ''}{node.label.length > 17 ? `${node.label.slice(0, 15)}…` : node.label}</text></g>
    })}<circle cx="150" cy="150" r="39" fill="#fbf5ea" /><text x="150" y="150" textAnchor="middle" dominantBaseline="middle">ARÔMES</text></svg><p className="tasting-hint">Choisis un secteur pour explorer ; la liste permet aussi de sélectionner un terme général.</p></div><div className="aroma-summary"><h3>Mes mots</h3>{choices.length ? <div className="aroma-tags">{choices.map(choice => <button type="button" key={choice.id} onClick={() => onChange(choices.filter(item => item.id !== choice.id))} aria-label={`Retirer ${choice.label}`}>{choice.label} <span aria-hidden="true">×</span></button>)}</div> : <p>Aucun arôme choisi pour le moment.</p>}<label>Autre impression<input value={other} onChange={event => setOther(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addOther() } }} /></label><button type="button" className="tasting-secondary" onClick={addOther}>Ajouter</button></div></div><details className="aroma-list"><summary>Voir tous les arômes en liste</summary><p>Sélectionne une famille, une nuance ou un descripteur.</p>{aromas.map(family => <details key={family.id}><summary>{family.label}</summary><AromaList node={family} choices={choices} toggle={toggle} /></details>)}</details></section>
}
function AromaList({ node, choices, toggle }: { node: AromaNode; choices: AromaChoice[]; toggle: (node: AromaNode) => void }) {
  return <div className="aroma-list-group"><button type="button" aria-pressed={choices.some(choice => choice.id === node.id)} onClick={() => toggle(node)}>{choices.some(choice => choice.id === node.id) ? '✓ ' : ''}{node.label}</button>{node.children?.map(child => <AromaList key={child.id} node={child} choices={choices} toggle={toggle} />)}</div>
}

function Collection({ results, total, search, setSearch, filter, setFilter, open }: { results: TastingRecord[]; total: number; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; open: (item: TastingRecord) => void }) {
  return <><div className="library-controls"><label>Rechercher<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Café ou arôme" /></label><label>Méthode<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">Toutes les méthodes</option>{Object.entries(methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><p role="status">{results.length} {results.length === 1 ? 'fiche' : 'fiches'}{results.length !== total && ` sur ${total}`}</p></div>
    {results.length ? <div className="tasting-grid">{results.map((item, index) => <SpotlightCard className="tasting-card-surface" key={item.id} style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}><button className="tasting-card" type="button" onClick={() => open(item)}><span className="card-content"><small>{methodName(item)} · {item.date}</small><strong>{title(item)}</strong>{item.country && <span className="card-origin">{item.country}</span>}</span><Equipment record={item} /><span className="card-profile"><AromaSignature choices={item.aromas} /><span className="card-profile-text"><span className="card-profile-label">Signature aromatique</span><span className="card-tags">{item.aromas.length ? <>{item.aromas.slice(0, 5).map(aroma => <span key={aroma.id}>{aroma.label}</span>)}{item.aromas.length > 5 && <span>+ {item.aromas.length - 5}</span>}</> : <span>Aucun arôme noté</span>}</span></span></span><span className="card-open">Ouvrir la fiche <ArrowRight aria-hidden="true" /></span></button></SpotlightCard>)}</div> : <p className="library-no-results">Aucune fiche ne correspond à cette recherche.</p>}</>
}

function TastingDetail({ record, edit, duplicate, remove, back }: { record: TastingRecord; edit: () => void; duplicate: () => void; remove: () => void; back: () => void }) {
  const identity = ([['Torréfacteur', record.roaster], ['Région ou ferme', record.region], ['Altitude', record.altitude], ['Traitement', record.processing === 'Autre' ? record.processingOther : record.processing], ['Fermentation', record.fermentation], ['Torréfaction', record.roast]] as const).filter(([, value]) => value.trim())
  const impressions = ([['Acidité', record.acidity], ['Amertume', record.bitterness], ['Douceur', record.sweetness], ['Corps / texture', record.body], ['Persistance', record.finish], ['Appréciation', record.appreciation]] as const).filter(([, value]) => value.trim())
  const parameters = record.proposal?.parameters ?? []
  const proposedText = parameters.map(parameter => `${parameter.label} : ${parameter.value}`).join('\n')
  const same = !!record.actual.trim() && !!parameters.length && record.actual.trim() === proposedText.trim()
  const actualLines = record.actual.split('\n').filter(line => line.trim())
  return <div className="tasting-detail"><button type="button" className="tasting-link" onClick={back}>← Ma bibliothèque</button><header className="tasting-detail-head"><div className="detail-identity"><p className="kicker">FICHE AROMATIQUE · {record.date}</p><h1>{title(record)}</h1><p className="detail-origin">{methodName(record)}{record.country ? ` · ${record.country}` : ''}</p>{identity.length > 0 && <dl className="detail-identity-list">{identity.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}<div className="tasting-actions"><SpecularButton className="tasting-primary" radius={4} tint="#301d16" tintOpacity={1} lineColor="#e5b580" autoAnimate={false} onClick={edit}>Modifier</SpecularButton><button className="tasting-secondary" type="button" onClick={duplicate}>Dupliquer dans un brouillon</button></div></div><Equipment record={record} /></header>
    <section className="detail-section detail-profile"><div className="detail-section-heading"><p className="kicker">01 / PROFIL ET IMPRESSIONS</p><h2>Mes arômes</h2></div><div className="detail-profile-layout"><div className="detail-wheel"><h3>Familles aromatiques sélectionnées</h3><AromaSignature choices={record.aromas} detailed /><div className="detail-family-list">{aromas.map((family, index) => record.aromas.some(choice => descendants(family).includes(choice.id)) && <span key={family.id}><i aria-hidden="true" style={{ backgroundColor: signatureColors[index] }} />{family.label}</span>)}</div></div><div className="detail-impressions"><h3>Les mots de cette tasse</h3><div className="aroma-tags">{record.aromas.length ? record.aromas.map(aroma => <span key={aroma.id}>{aroma.label}</span>) : <span>Aucun arôme noté</span>}</div>{impressions.length > 0 && <dl className="detail-observations">{impressions.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}{record.notes && <div className="detail-note"><h3>Notes</h3><p className="preserve-lines">{record.notes}</p></div>}{record.nextTime && <div className="detail-note"><h3>La prochaine fois</h3><p className="preserve-lines">{record.nextTime}</p></div>}</div></div></section>
    <section className="detail-section detail-recipe"><p className="kicker">02 / RECETTE ET PRÉPARATION</p><h2>Recette proposée</h2>{record.proposal ? <><p>{methodName(record)} · Intention : {record.proposal.choices.profile === 'round' ? 'Rond & gourmand' : 'Expressif & complexe'}</p><dl className="tasting-parameters">{parameters.map((parameter, index) => <div key={index}><dt>{parameter.label}</dt><dd>{parameter.value}</dd></div>)}</dl><details><summary>Étapes de la recette proposée</summary><ol>{record.proposal.recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>{record.proposal.recipe.assumptions.map(text => <p key={text}>{text}</p>)}</details></> : <p>Aucune recette proposée.</p>}<div className="detail-actual"><h3>Préparation réellement confirmée</h3>{!record.actual.trim() ? <p>Non renseignée.</p> : same ? <p>Identique à la recette proposée.</p> : <dl className="tasting-parameters">{actualLines.map((line, index) => { const separator = line.indexOf(' : '); const label = separator >= 0 ? line.slice(0, separator) : ''; const value = separator >= 0 ? line.slice(separator + 3) : line; const proposed = parameters.find(parameter => parameter.label === label); return <div key={index}><dt>{label || 'Note de préparation'}{proposed && proposed.value !== value ? ' · valeur différente' : ''}</dt><dd>{value}</dd></div> })}</dl>}</div></section><div className="detail-delete"><button className="tasting-link" type="button" onClick={remove}>Supprimer</button></div></div>
}

function ConflictVersion({ label, value, deleted }: { label: string; value: Payload; deleted: boolean }) {
  const record = value.record
  const fields: [string, string][] = [
    ['Nom', record.name], ['Date', record.date], ['Torréfacteur', record.roaster], ['Pays', record.country],
    ['Région', record.region], ['Altitude', record.altitude], ['Traitement', record.processing],
    ['Précision du traitement', record.processingOther], ['Fermentation', record.fermentation], ['Torréfaction', record.roast],
    ['Préparation réellement utilisée', record.actual], ['Arômes', record.aromas.map(item => item.label).join(', ')],
    ['Acidité', record.acidity], ['Amertume', record.bitterness], ['Douceur', record.sweetness],
    ['Corps', record.body], ['Persistance', record.finish], ['Appréciation', record.appreciation],
    ['Notes', record.notes], ['La prochaine fois', record.nextTime],
  ]
  return <div><h4>{label} · {deleted ? 'suppression' : value.kind === 'draft' ? 'brouillon' : 'fiche'}</h4>
    <dl>{fields.filter(([, text]) => text).map(([field, text]) => <div key={field}><dt>{field}</dt><dd className="preserve-lines">{text}</dd></div>)}</dl>
    {record.proposal && <p>Recette proposée : {record.proposal.methodName}</p>}
  </div>
}

type Props = { active: boolean; proposal: TastingProposal | null; clearProposal: () => void; libraryRequest: number; onReturn: () => void }

export default function Tasting(props: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [owners, setOwners] = useState<string[]>([''])
  const [switchWarning, setSwitchWarning] = useState('')
  const current = useRef<Session | null>(null)
  const authEpoch = useRef(0)
  useEffect(() => {
    if (!supabase) return
    let active = true
    let changed = false
    const accept = (next: Session | null) => {
      const oldOwner = current.current?.user.id ?? ''
      const newOwner = next?.user.id ?? ''
      if (oldOwner !== newOwner) {
        const activity = notebookActivity(oldOwner)
        if (activity.pending || activity.failed || (oldOwner && activity.queue !== 'empty')) setSwitchWarning('Le carnet précédent contient un travail non enregistré ou dont la synchronisation n’est pas confirmée. Reviens à ce carnet sans fermer la page pour le vérifier et l’exporter.')
        const focused = document.activeElement
        if (focused instanceof HTMLElement && focused.closest('[data-notebook]')) focused.blur()
      }
      authEpoch.current++
      current.current = next
      setSession(next)
      setAuthReady(true)
      if (next) setOwners(owners => owners.includes(next.user.id) ? owners : [...owners, next.user.id])
    }
    const unsubscribe = observeAuth((_event, next) => { if (active) { changed = true; accept(next) } })
    void initializeAuth().then(result => { if (active && !changed) accept(result.session) })
    return () => { active = false; authEpoch.current++; current.current = null; unsubscribe() }
  }, [])
  if (!authReady) return <main id={props.active ? 'main' : undefined} className="tasting wrap"><p role="status">Chargement du compte et du carnet…</p></main>
  const owner = session?.user.id ?? ''
  return <>{switchWarning && <p className="tasting-error" role="alert">{switchWarning} <button type="button" onClick={() => setSwitchWarning('')}>Compris</button></p>}{owners.map(id => <div key={id} data-notebook hidden={id !== owner} inert={id !== owner || undefined} aria-hidden={id !== owner || undefined}><Notebook {...props} active={props.active && id === owner} proposal={id === owner ? props.proposal : null} owner={id} session={id === owner ? session : null} current={current} authEpoch={authEpoch} /></div>)}</>
}

function Notebook({ active, proposal, clearProposal, libraryRequest, onReturn, owner, session, current, authEpoch }: Props & { owner: string; session: Session | null; current: React.RefObject<Session | null>; authEpoch: React.RefObject<number> }) {
  const [store, setStore] = useState(blankStore)
  const storeRef = useRef(store)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [committing, setCommitting] = useState(false)
  const blocked = useRef(true)
  const writes = useRef<Promise<void>>(Promise.resolve())
  const writeNumber = useRef(0)
  const load = useRef<Promise<TastingStore> | null>(null)
  const [view, setView] = useState<'library' | 'edit' | 'detail'>('library')
  const [id, setId] = useState('')
  const [pending, setPending] = useState<TastingProposal | null>(null)
  const [chooseDraft, setChooseDraft] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [message, setMessage] = useState('')
  const [fileName, setFileName] = useState('')
  const [importError, setImportError] = useState('')
  const saveLock = useRef(false)
  const createLock = useRef(false)
  const transactionLock = useRef(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [conflictCount, setConflictCount] = useState(0)
  const [conflictDetails, setConflictDetails] = useState<ConflictDetails[]>([])
  const [syncTick, setSyncTick] = useState(0)
  const latest = useRef(0)
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 6000)
    return () => window.clearTimeout(timer)
  }, [message])
  useEffect(() => {
    load.current ??= owner ? loadAccountStore(owner) : loadStore()
    let active = true
    load.current.then(data => { if (active) { storeRef.current = data; setStore(data); blocked.current = false; setReady(true) } }).catch(() => { if (active) { markNotebookFailure(owner); setError('Impossible de lire le carnet. Les données existantes ne seront pas écrasées.'); setReady(true) } })
    return () => { active = false }
  }, [owner])
  useEffect(() => {
    if (!owner || !session || !ready || blocked.current) return
    const refresh = () => setSyncTick(value => value + 1)
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [owner, session, ready])
  useEffect(() => {
    if (!owner || !session || !ready || blocked.current || document.hidden) return
    let live = true
    const revision = latest.current
    const epoch = authEpoch.current
    const isCurrent = () => live && authEpoch.current === epoch && !blocked.current && !transactionLock.current && current.current?.user.id === owner
    startNotebookSync(owner)
    setSyncMessage('Synchronisation en cours…')
    if (!navigator.locks) { failNotebookSync(owner); setSyncMessage('Ce navigateur ne permet pas de synchroniser en sécurité entre les onglets. Ton carnet reste sur cet appareil.'); return () => { live = false } }
    void synchronizeNotebook(owner, notebookClient(session.access_token), isCurrent).then(async result => {
      if (!isCurrent()) return
      const saved = await loadAccountStore(owner)
      if (!isCurrent()) return
      const details = await loadNotebookConflicts(owner)
      if (!isCurrent()) return
      if (revision !== latest.current) {
        finishNotebookSync(owner, result.pending, !!result.conflicts || !!result.unsupported, false)
        setSyncMessage('Modification en cours d’enregistrement ou en attente de synchronisation.')
        return
      }
      storeRef.current = saved; setStore(saved)
      setConflictCount(result.conflicts)
      setConflictDetails(details)
      finishNotebookSync(owner, result.pending, !!result.conflicts || !!result.unsupported, revision === latest.current)
      const notices: string[] = []
      if (result.conflicts) notices.push(`Conflit de synchronisation : ${result.conflicts} élément(s). Les versions locales sont conservées ; exporte ton carnet avant toute intervention.`)
      if (result.pending) notices.push(`${result.pending} modification(s) attendent une confirmation du compte.`)
      if (result.unsupported) notices.push('Certaines données distantes ne sont pas reconnues et restent intactes.')
      setSyncMessage(notices.length ? notices.join(' ') : 'Lecture du compte terminée ; aucune modification locale en attente.')
    }).catch(async () => {
      if (!isCurrent()) return
      failNotebookSync(owner)
      setSyncMessage('Synchronisation en attente. Vérifie la connexion et la session ; les modifications restent sur cet appareil.')
      try {
        const details = await loadNotebookConflicts(owner)
        if (isCurrent()) { setConflictCount(details.length); setConflictDetails(details) }
      } catch { /* Le carnet reste disponible en mémoire si son stockage ne peut pas être lu. */ }
    })
    return () => { live = false }
  }, [owner, session, ready, active, syncTick, current, authEpoch])
  const updateStore = (next: TastingStore, transactional = true): Promise<boolean> => {
    if (transactionLock.current) return Promise.resolve(false)
    const previous = storeRef.current
    latest.current++
    startNotebookWrite(owner)
    if (owner) setSyncMessage('Modification en cours d’enregistrement ou en attente de synchronisation.')
    if (transactional) { transactionLock.current = true; setCommitting(true) }
    else { storeRef.current = next; setStore(next) }
    setSaving(true)
    const currentWrite = ++writeNumber.current
    const write = writes.current.then(async () => { if (blocked.current) throw new Error(); if (owner) await saveAccountStore(owner, previous, next); else await saveStore(next, previous) })
    writes.current = write.catch(() => {})
    return write.then(() => { finishNotebookWrite(owner, true); if (transactional) { storeRef.current = next; setStore(next); transactionLock.current = false; setCommitting(false) }; if (currentWrite === writeNumber.current) { setError(''); setSaving(false); if (owner) setSyncTick(value => value + 1) }; return true }, (reason: unknown) => { finishNotebookWrite(owner, false); if (!transactional || reason instanceof StaleNotebookError) { blocked.current = true; setSyncMessage('Synchronisation suspendue pour protéger ton travail.') }; if (transactional) { transactionLock.current = false; setCommitting(false) }; if (currentWrite === writeNumber.current) { setError('Enregistrement impossible ou carnet modifié dans un autre onglet. Ton travail reste disponible pendant cette visite : exporte-le avant de fermer.'); setSaving(false) }; return false })
  }
  const create = (source: TastingProposal | null = null) => {
    if (createLock.current) return
    createLock.current = true
    const draft = newTasting(source)
    updateStore({ ...storeRef.current, drafts: [...storeRef.current.drafts, draft] }, false)
    setId(draft.id); setView('edit'); setMessage('')
  }
  useEffect(() => { if (view === 'library') createLock.current = false }, [view])
  useEffect(() => { setView('library'); setMessage('') }, [libraryRequest])
  useEffect(() => {
    if (!proposal || !ready) return
    if (storeRef.current.drafts.length) { setPending(proposal); setChooseDraft(true); setView('library') } else create(proposal)
    clearProposal()
  // La proposition est consommée une seule fois.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal, ready])
  const draft = store.drafts.find(item => item.id === id)
  const record = store.records.find(item => item.id === id)
  const edit = (changes: Partial<TastingRecord>) => { if (draft) updateStore({ ...storeRef.current, drafts: storeRef.current.drafts.map(item => item.id === id ? { ...item, ...changes } : item) }, false) }
  const finish = async () => {
    if (!draft || saveLock.current) return
    saveLock.current = true
    const original = draft.editOf ? storeRef.current.records.find(item => item.id === draft.editOf) : undefined
    const changed = !!draft.editOf && (!original || !draft.editBase || draft.editBase !== JSON.stringify(original))
    if (changed && !window.confirm('La fiche d’origine a changé ou n’est plus disponible. Enregistrer ce brouillon comme nouvelle fiche, sans remplacer l’original ?')) { saveLock.current = false; return }
    let finalId = changed ? draft.id : draft.editOf ?? draft.id
    if (owner && (changed || !draft.editOf)) {
      try { finalId = uniqueTastingId(storeRef.current) }
      catch { setError('Impossible de créer une nouvelle fiche sans risque de doublon. Le brouillon est conservé.'); saveLock.current = false; return }
    }
    const final = { ...draft, id: finalId, editOf: undefined, editBase: undefined }
    const drafts = owner ? storeRef.current.drafts.map(item => item.id === draft.id ? { ...item, editOf: final.id, editBase: JSON.stringify(final) } : item) : storeRef.current.drafts.filter(item => item.id !== draft.id)
    const next = { ...storeRef.current, drafts, records: [final, ...storeRef.current.records.filter(item => item.id !== final.id)] }
    if (await updateStore(next, true)) { setId(final.id); setView('detail'); setMessage(owner ? 'Ta fiche est enregistrée. Le brouillon reste disponible par précaution ; tu peux le supprimer après vérification de la synchronisation.' : 'Ta fiche est enregistrée.') }
    saveLock.current = false
  }
  const editRecord = (item: TastingRecord, duplicate = false) => {
    const existing = !duplicate && storeRef.current.drafts.find(entry => entry.editOf === item.id)
    if (existing) { setId(existing.id); setView('edit'); return }
    const copy = { ...structuredClone(item), id: crypto.randomUUID(), editOf: duplicate ? undefined : item.id, editBase: duplicate ? undefined : JSON.stringify(item), ...(duplicate ? { date: new Date().toLocaleDateString('sv-SE'), aromas: [], actual: '', acidity: '', bitterness: '', sweetness: '', body: '', finish: '', appreciation: '', notes: '', nextTime: '' } : {}) }
    updateStore({ ...storeRef.current, drafts: [...storeRef.current.drafts, copy] }, false); setId(copy.id); setView('edit'); setMessage('')
  }
  const exportData = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'coffee-101-carnet.json'; link.click(); URL.revokeObjectURL(url) }
  const mergeGuest = async () => {
    if (!window.confirm('Copier les fiches et brouillons locaux dans ce compte ? Les originaux restent sur cet appareil. Répéter cette action crée de nouvelles copies.')) return
    const epoch = authEpoch.current
    try {
      const guest = await loadStore()
      if (authEpoch.current !== epoch || current.current?.user.id !== owner) return
      const ids = new Map([...guest.drafts, ...guest.records].map(item => [item.id, crypto.randomUUID()]))
      for (const draft of guest.drafts) if (draft.editOf && !ids.has(draft.editOf)) ids.set(draft.editOf, crypto.randomUUID())
      const copy = (item: TastingRecord) => ({ ...structuredClone(item), id: ids.get(item.id)!, editOf: item.editOf ? ids.get(item.editOf) : item.editOf })
      const copiedRecords = guest.records.map(copy)
      const copiedDrafts = guest.drafts.map(draft => {
        const result = copy(draft)
        const original = guest.records.find(record => record.id === draft.editOf)
        const copiedOriginal = copiedRecords.find(record => record.id === result.editOf)
        if (original && copiedOriginal && draft.editBase === JSON.stringify(original)) result.editBase = JSON.stringify(copiedOriginal)
        return result
      })
      if (await updateStore({ version: 1, drafts: [...storeRef.current.drafts, ...copiedDrafts], records: [...storeRef.current.records, ...copiedRecords] })) setMessage('Copies ajoutées à ce compte. Les originaux locaux sont conservés.')
    } catch { setError('Impossible de lire le carnet local. Aucune copie n’a été créée.') }
  }
  const resolveConflicts = async () => {
    if (!session || transactionLock.current || blocked.current) return
    if (!window.confirm('Récupérer les versions du compte et conserver les versions locales en nouvelles copies ? Les suppressions locales en conflit seront annulées. Exporte d’abord ton carnet si nécessaire.')) return
    const epoch = authEpoch.current
    transactionLock.current = true
    setCommitting(true)
    latest.current++
    markNotebookPending(owner)
    setSyncMessage('Résolution en cours ; la synchronisation n’est pas encore confirmée.')
    try {
      await writes.current
      const isCurrent = () => authEpoch.current === epoch && !blocked.current && current.current?.user.id === owner
      const resolved = await resolveNotebookConflicts(owner, notebookClient(session.access_token), isCurrent)
      if (!isCurrent()) return
      storeRef.current = resolved; setStore(resolved); setConflictCount(0); setConflictDetails([]); setError(''); setView('library')
      setMessage('Versions locales conservées en copies et versions du compte récupérées.')
      setSyncTick(value => value + 1)
    } catch { if (current.current?.user.id === owner) setError('Impossible de résoudre ce conflit pour le moment. Rien n’a été remplacé ; exporte ton carnet et réessaie après reconnexion.') }
    finally { transactionLock.current = false; setCommitting(false) }
  }
  const exportConflicts = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(conflictDetails.map(item => ({ id: item.id, versionDuCompte: item.remote })), null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'coffee-101-conflits-compte.json'; link.click(); URL.revokeObjectURL(url)
  }
  const importData = async (file: File | undefined) => {
    if (!file) return
    const epoch = authEpoch.current
    setFileName(file.name)
    setImportError('')
    try { const data: unknown = JSON.parse(await file.text()); if (!isStore(data)) throw new Error(); if (authEpoch.current !== epoch || (owner ? current.current?.user.id !== owner : !!current.current)) return; if (window.confirm('Remplacer ce carnet, y compris les brouillons, par le fichier importé ? Les suppressions seront synchronisées si tu es connecté. Exporte d’abord tes fiches si nécessaire.')) { if (await updateStore(data, true)) { setView('library'); setMessage('Carnet importé.') } } } catch { setImportError('Import impossible : fichier invalide ou version non prise en charge.') }
  }
  const results = [...store.records].filter(item => (!filter || item.proposal?.choices.method === filter) && `${title(item)} ${item.country} ${item.aromas.map(aroma => aroma.label).join(' ')}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))).sort((a, b) => b.date.localeCompare(a.date))
  if (!ready) return <main id={active ? 'main' : undefined} className="tasting wrap"><p role="status">Chargement du carnet…</p></main>
  return <main id={active ? 'main' : undefined} className="tasting wrap" inert={committing || undefined} aria-busy={committing}><p className="kicker">03 / DÉGUSTER</p>{error && <p className="tasting-error" role="alert">{error}</p>}{message && <p className="tasting-success" role="status">{message}</p>}<p aria-live="polite">{owner ? syncMessage || 'Carnet de ce compte sur cet appareil.' : 'Carnet local, non synchronisé. Si ta session a expiré, reconnecte-toi pour retrouver le carnet de ton compte.'}</p>{owner && conflictCount > 0 && <section className="tasting-panel" aria-label="Conflits du carnet"><h2>Comparer les versions</h2><p>Les modifications locales restent sur cet appareil. Les versions affichées datent de la dernière vérification et peuvent avoir changé.</p>{conflictDetails.map((conflict, index) => <details key={conflict.id}><summary>Conflit {index + 1}</summary>{conflict.local ? <ConflictVersion label="Version locale" value={conflict.local.choices} deleted={conflict.local.deleted} /> : <p>Aucune version locale disponible.</p>}{conflict.remote === undefined ? <p>Version du compte pas encore récupérée.</p> : conflict.remote === null ? <p>Version du compte introuvable.</p> : conflict.remoteRecognized && isNotebookPayload(conflict.remote.choices) ? <ConflictVersion label="Version du compte" value={conflict.remote.choices} deleted={conflict.remote.deleted} /> : isTechnicalPlaceholder(conflict.remote) ? <p>Une entrée supprimée de version initiale existe sur le compte. Elle ne prouve pas une suppression volontaire et reste intacte.</p> : <p>Version du compte non reconnue ou incohérente ; elle reste intacte.</p>}</details>)}<p>Télécharge les versions du compte et exporte aussi ton carnet local avant de résoudre un conflit.</p><button type="button" className="tasting-secondary" onClick={exportConflicts}>Télécharger les versions du compte</button> <button type="button" className="tasting-secondary" onClick={() => void resolveConflicts()}>Résoudre les conflits en conservant des copies</button></section>}
    {view === 'library' && <><div className="tasting-heading"><div><h1>Ma bibliothèque<span>.</span></h1><p>Tes cafés, tes impressions, une tasse à la fois.</p></div>{store.records.length > 0 && <SpecularButton className="tasting-primary" radius={4} tint="#301d16" tintOpacity={1} lineColor="#e5b580" autoAnimate={false} onClick={() => { if (store.drafts.length) { setPending(null); setChooseDraft(true) } else create() }}><Plus aria-hidden="true" /> Nouvelle dégustation</SpecularButton>}</div>
      {chooseDraft && store.drafts.length > 0 && <div className="tasting-panel"><h2>Un brouillon existe déjà</h2><p>Reprends-le ou commence une autre fiche{pending ? ' avec cette recette' : ''}. Aucun brouillon ne sera écrasé.</p><button type="button" className="tasting-secondary" onClick={() => { setId(store.drafts[0].id); setView('edit'); setPending(null); setChooseDraft(false) }}>Reprendre le brouillon</button> <button type="button" className="tasting-secondary" onClick={() => { create(pending); setPending(null); setChooseDraft(false) }}>Commencer une autre fiche</button></div>}
      {store.drafts.length > 0 && <section className="tasting-drafts"><h2>Mes brouillons</h2>{store.drafts.map(item => <div key={item.id}><button type="button" onClick={() => { setId(item.id); setView('edit') }}>Reprendre : {title(item)}</button><button type="button" onClick={() => { if (window.confirm('Supprimer ce brouillon ?')) updateStore({ ...storeRef.current, drafts: storeRef.current.drafts.filter(entry => entry.id !== item.id) }, true) }}>Supprimer</button></div>)}<button type="button" onClick={() => create()}>Commencer une autre fiche</button></section>}
      {store.records.length === 0 ? <div className="tasting-empty"><div className="tasting-empty-mark"><BrandMark /></div><div><h2>La première page t’attend.</h2><p>Garde une trace de tes découvertes, à ton rythme.</p><div className="tasting-empty-actions"><SpecularButton className="tasting-primary" radius={4} tint="#301d16" tintOpacity={1} lineColor="#e5b580" autoAnimate={false} onClick={() => { if (store.drafts.length) { setPending(null); setChooseDraft(true) } else create() }}><Plus aria-hidden="true" /> Créer ma première fiche</SpecularButton><button type="button" className="tasting-link" onClick={onReturn}>Aller à Préparer <ArrowRight aria-hidden="true" /></button></div></div></div> : <Collection results={results} total={store.records.length} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} open={item => { setId(item.id); setView('detail'); setMessage('') }} />}
      <details className="tasting-data"><summary>Mon carnet</summary><p>Tes fiches sont enregistrées dans ce navigateur. Pense à les exporter pour les sauvegarder.</p><div className="tasting-data-actions"><button type="button" className="tasting-secondary" onClick={exportData}><Download aria-hidden="true" /> Exporter mon carnet</button><label className="tasting-import"><FileUp aria-hidden="true" /> Choisir un carnet à importer<input type="file" accept="application/json,.json" onChange={event => { void importData(event.target.files?.[0]); event.target.value = '' }} /></label>{owner && <button type="button" className="tasting-secondary" onClick={() => void mergeGuest()}>Copier le carnet local dans ce compte</button>}</div>{fileName && <p className="tasting-filename">Fichier choisi : {fileName}</p>}{importError && <p className="tasting-error" role="alert">{importError}</p>}</details></>}
    {view === 'edit' && draft && <><button type="button" className="tasting-link" onClick={() => setView('library')}>← Ma bibliothèque</button><div className="tasting-heading"><div><h1>{draft.editOf ? 'Modifier ma fiche' : 'Nouvelle dégustation'}<span>.</span></h1><p>Tous les champs sont facultatifs. Prends ton temps.</p></div><p role="status">{error ? 'Brouillon non enregistré' : saving ? 'Enregistrement en cours…' : 'Brouillon enregistré'}</p></div>
      <section className="tasting-panel"><p className="kicker">01 / LE CAFÉ</p><h2>Parle-nous de ton café</h2><div className="tasting-fields">{([['name', 'Nom du café'], ['roaster', 'Torréfacteur'], ['date', 'Date de dégustation'], ['country', 'Pays d’origine'], ['region', 'Région ou ferme'], ['altitude', 'Altitude ou plage d’altitude']] as const).map(([key, label]) => <label key={key}>{label}<input type={key === 'date' ? 'date' : 'text'} value={draft[key]} placeholder={key === 'altitude' ? 'Ex. 1 400–1 800 m, ou inconnu' : undefined} onChange={event => edit({ [key]: event.target.value })} /></label>)}<label>Traitement principal<select value={draft.processing} onChange={event => edit({ processing: event.target.value })}><option value="">Je ne sais pas</option>{['Lavé', 'Nature', 'Honey et pulped natural', 'Wet-hulled', 'Autre'].map(option => <option key={option}>{option}</option>)}</select></label>{draft.processing === 'Autre' && <label>Préciser le traitement<input value={draft.processingOther} onChange={event => edit({ processingOther: event.target.value })} /></label>}<label>Fermentation particulière<input value={draft.fermentation} placeholder="Je ne sais pas" onChange={event => edit({ fermentation: event.target.value })} /></label><label>Torréfaction<select value={draft.roast} onChange={event => edit({ roast: event.target.value })}><option value="">Je ne sais pas</option><option>Claire</option><option>Moyenne</option><option>Foncée</option></select></label></div></section>
      <section className="tasting-panel"><p className="kicker">02 / LA PRÉPARATION</p><h2>Recette proposée</h2>{draft.proposal ? <><p>{methodName(draft)} · Torréfaction : {draft.roast || 'inconnue'} · Intention : {draft.proposal.choices.profile === 'round' ? 'Rond & gourmand' : 'Expressif & complexe'}</p><dl className="tasting-parameters">{draft.proposal.parameters.map((parameter, index) => <div key={index}><dt>{parameter.label}</dt><dd>{parameter.value}</dd></div>)}</dl><details><summary>Voir les étapes et indications</summary><ol>{draft.proposal.recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>{draft.proposal.recipe.assumptions.map(text => <p key={text}>{text}</p>)}</details></> : <p>Aucune recette proposée.</p>}<h3>Ce que j’ai réellement préparé</h3><p>Ces paramètres ne sont pas confirmés automatiquement. Ajoute ou corrige uniquement ce que tu connais.</p>{draft.proposal && <button type="button" className="tasting-secondary" onClick={() => { if (!draft.actual || window.confirm('Remplacer les paramètres saisis par la proposition ?')) edit({ actual: draft.proposal!.parameters.map(parameter => `${parameter.label} : ${parameter.value}`).join('\n') }) }}>Confirmer la proposition comme point de départ</button>}<label>Paramètres réellement utilisés<textarea rows={5} value={draft.actual} placeholder="Non renseignés" onChange={event => edit({ actual: event.target.value })} /></label></section>
      <Wheel choices={draft.aromas} onChange={aromas => edit({ aromas })} /><section className="tasting-panel"><p className="kicker">04 / EN BOUCHE</p><h2>À ton rythme</h2><div className="tasting-fields">{([['acidity', 'Acidité perçue'], ['bitterness', 'Amertume'], ['sweetness', 'Douceur perçue'], ['body', 'Corps / texture'], ['finish', 'Persistance'], ['appreciation', 'Appréciation personnelle']] as const).map(([key, label]) => <label key={key}>{label}<input value={draft[key]} placeholder="Facultatif" onChange={event => edit({ [key]: event.target.value })} /></label>)}</div><label>Notes libres<textarea value={draft.notes} rows={4} onChange={event => edit({ notes: event.target.value })} /></label><label>La prochaine fois, je changerais…<textarea value={draft.nextTime} rows={3} onChange={event => edit({ nextTime: event.target.value })} /></label></section><SpecularButton className="tasting-primary tasting-save" radius={4} tint="#301d16" tintOpacity={1} lineColor="#e5b580" autoAnimate={false} onClick={finish}>Enregistrer ma fiche</SpecularButton></>}
    {view === 'detail' && record && <TastingDetail record={record} back={() => setView('library')} edit={() => editRecord(record)} duplicate={() => editRecord(record, true)} remove={async () => { if (window.confirm('Supprimer définitivement cette fiche ?')) { if (await updateStore({ ...storeRef.current, records: storeRef.current.records.filter(item => item.id !== record.id) })) { setView('library'); setMessage('Fiche supprimée.') } } }} />}
  </main>
}
