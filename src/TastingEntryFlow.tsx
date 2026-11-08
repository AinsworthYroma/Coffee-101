import { useEffect } from 'react'
import './tasting-entry-flow.css'

const guidance = 'Pour créer une dégustation, va dans « Préparer », sélectionne ta machine, puis clique sur « Déguster ce café » depuis la recette.'

function startsWithoutRecipe(button: HTMLButtonElement): boolean {
  if (!button.closest('.tasting')) return false
  if (button.matches('.tasting-heading > .tasting-primary, .tasting-empty-actions > .tasting-primary, .tasting-drafts > button')) return true
  if (button.textContent?.trim() !== 'Commencer une autre fiche') return false
  const chooser = button.closest('.tasting-panel')
  return !!chooser && !chooser.querySelector('p')?.textContent?.includes('avec cette recette')
}

function openPreparation() {
  window.history.pushState({}, '', '?vue=preparer')
  window.dispatchEvent(new PopStateEvent('popstate'))
  requestAnimationFrame(() => {
    const section = document.getElementById('ma-machine')
    if (!section) return
    section.scrollIntoView({ block: 'start', behavior: 'instant' })
    const heading = section.querySelector<HTMLElement>('#preparation-title')
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }) }
  })
}

export function installTastingEntryFlow(root: HTMLElement): () => void {
  const inserted = new Set<HTMLElement>()
  const suppressed = new Set<HTMLButtonElement>()
  let frame: number | null = null
  const scan = () => {
    frame = null
    for (const node of inserted) if (!root.contains(node)) inserted.delete(node)
    for (const node of suppressed) if (!root.contains(node)) suppressed.delete(node)
    root.querySelectorAll<HTMLButtonElement>('.tasting .tasting-panel button').forEach(button => {
      if (startsWithoutRecipe(button)) {
        if (!button.hasAttribute('data-requires-preparation')) { button.setAttribute('data-requires-preparation', ''); suppressed.add(button) }
      } else if (suppressed.has(button)) { button.removeAttribute('data-requires-preparation'); suppressed.delete(button) }
    })
    root.querySelectorAll<HTMLElement>('.tasting .tasting-empty').forEach(empty => {
      const actions = empty.querySelector<HTMLElement>('.tasting-empty-actions')
      if (!actions || empty.querySelector('.tasting-start-guidance')) return
      const text = document.createElement('p')
      text.className = 'tasting-start-guidance'
      text.textContent = guidance
      actions.before(text)
      inserted.add(text)
    })
  }
  const guard = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null
    if (!button || !root.contains(button) || !startsWithoutRecipe(button)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    openPreparation()
  }
  root.addEventListener('click', guard, true)
  const observer = new MutationObserver(() => { if (frame === null) frame = requestAnimationFrame(scan) })
  observer.observe(root, { childList: true, subtree: true })
  scan()
  return () => {
    root.removeEventListener('click', guard, true)
    observer.disconnect()
    if (frame !== null) cancelAnimationFrame(frame)
    for (const node of inserted) node.remove()
    for (const node of suppressed) node.removeAttribute('data-requires-preparation')
    inserted.clear(); suppressed.clear()
  }
}

export default function TastingEntryFlow() {
  useEffect(() => { const root = document.getElementById('root'); if (root) return installTastingEntryFlow(root) }, [])
  return null
}
