import { useEffect } from 'react'
import './library-toolbar.css'

type Controller = { sync: () => void; destroy: () => void }

// Keep the existing controlled input and select as the source of truth.
function enhance(host: HTMLElement): Controller | null {
  const input = host.querySelector<HTMLInputElement>(':scope > label input')
  const select = host.querySelector<HTMLSelectElement>(':scope > label select')
  const label = input?.closest('label')
  if (!input || !select || !label) return null
  const previousPlaceholder = input.getAttribute('placeholder')
  const group = document.createElement('div')
  group.className = 'library-pill-filters'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Filtrer par méthode')
  const buttons = Array.from(select.options, option => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'library-method-pill'
    button.textContent = option.value === '' ? 'Toutes' : option.value === 'automatic' ? 'Auto' : option.text
    button.setAttribute('aria-label', option.text)
    button.addEventListener('click', () => {
      select.value = option.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
      sync()
    })
    group.append(button)
    return { button, value: option.value }
  })
  const clear = document.createElement('button')
  clear.type = 'button'
  clear.className = 'library-search-clear'
  clear.textContent = '×'
  clear.setAttribute('aria-label', 'Effacer la recherche')
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'library-search-reset'
  reset.textContent = 'Réinitialiser'
  const setSearch = (value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    if (!setter) return
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  function sync() {
    for (const { button, value } of buttons) button.setAttribute('aria-pressed', String(select!.value === value))
    clear.hidden = !input!.value
    reset.hidden = !input!.value && !select!.value
  }
  clear.addEventListener('click', () => { setSearch(''); sync(); input.focus() })
  reset.addEventListener('click', () => {
    setSearch('')
    select.value = ''
    select.dispatchEvent(new Event('change', { bubbles: true }))
    sync()
    input.focus()
  })
  input.addEventListener('input', sync)
  select.addEventListener('change', sync)
  input.placeholder = 'Rechercher un café ou un arôme…'
  label.append(clear)
  host.append(group, reset)
  host.classList.add('library-controls--espresso')
  sync()
  return { sync, destroy: () => {
    input.removeEventListener('input', sync)
    select.removeEventListener('change', sync)
    group.remove(); clear.remove(); reset.remove()
    host.classList.remove('library-controls--espresso')
    if (previousPlaceholder === null) input.removeAttribute('placeholder')
    else input.setAttribute('placeholder', previousPlaceholder)
  } }
}

export function installLibraryToolbar(root: HTMLElement): () => void {
  const controllers = new Map<HTMLElement, Controller>()
  let frame: number | null = null
  const scan = () => {
    frame = null
    for (const [host, controller] of controllers) {
      if (!root.contains(host)) { controller.destroy(); controllers.delete(host) }
      else controller.sync()
    }
    root.querySelectorAll<HTMLElement>('.library-controls').forEach(host => {
      if (!controllers.has(host)) { const controller = enhance(host); if (controller) controllers.set(host, controller) }
    })
  }
  const observer = new MutationObserver(() => { if (frame === null) frame = requestAnimationFrame(scan) })
  observer.observe(root, { childList: true, subtree: true })
  scan()
  return () => {
    observer.disconnect()
    if (frame !== null) cancelAnimationFrame(frame)
    for (const controller of controllers.values()) controller.destroy()
    controllers.clear()
  }
}

export default function LibraryToolbar() {
  useEffect(() => { const root = document.getElementById('root'); if (root) return installLibraryToolbar(root) }, [])
  return null
}
