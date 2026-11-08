type Activity = { pending: number; failed: boolean; queue: 'unknown' | 'pending' | 'empty'; sync: 'unverified' | 'checking' | 'ready' | 'problem'; acknowledged: boolean }
const activity = new Map<string, Activity>()
const listeners = new Set<() => void>()
const initial: Activity = { pending: 0, failed: false, queue: 'unknown', sync: 'unverified', acknowledged: false }
function update(owner: string, value: Activity) {
  activity.set(owner, value)
  for (const listener of listeners) listener()
}

export function observeNotebookActivity(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function notebookActivity(owner: string): Activity {
  return activity.get(owner) ?? initial
}

export function startNotebookWrite(owner: string) {
  const state = notebookActivity(owner)
  update(owner, { ...state, pending: state.pending + 1, queue: owner ? 'pending' : state.queue, sync: 'unverified' })
}

export function finishNotebookWrite(owner: string, success: boolean) {
  const state = notebookActivity(owner)
  const pending = Math.max(0, state.pending - 1)
  update(owner, { ...state, pending, failed: success ? (pending ? state.failed : false) : true })
}

export function markNotebookFailure(owner: string) {
  const state = notebookActivity(owner)
  update(owner, { ...state, failed: true, sync: 'problem' })
}

export function startNotebookSync(owner: string) {
  const state = notebookActivity(owner)
  update(owner, { ...state, sync: 'checking' })
}
export function beginNotebookSession(owner: string) {
  const state = notebookActivity(owner)
  update(owner, { ...state, queue: 'unknown', sync: 'unverified', acknowledged: false })
}

export function acknowledgeNotebookSync(owner: string) {
  const state = notebookActivity(owner)
  update(owner, { ...state, acknowledged: true })
}
export function markNotebookPending(owner: string) {
  const state = notebookActivity(owner)
  update(owner, { ...state, queue: 'pending', sync: 'unverified' })
}

export function finishNotebookSync(owner: string, pending: number, problems: boolean, stable: boolean) {
  const state = notebookActivity(owner)
  update(owner, {
    ...state,
    queue: stable && !state.pending && !state.failed ? (pending ? 'pending' : 'empty') : 'pending',
    sync: problems ? 'problem' : stable && !state.pending && !state.failed && !pending && state.acknowledged ? 'ready' : 'unverified',
  })
}

export function failNotebookSync(owner: string) {
  const state = notebookActivity(owner)
  update(owner, { ...state, sync: 'problem' })
}
