import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import TaskVisual, { type TaskPhase } from './TaskVisual'

const pending = new Map<string, Promise<boolean>>()
const flushers = new Set<() => Promise<boolean>>()
export async function flushSavedStates() {
  const results = await Promise.all([...flushers].map(f => f()))
  const outstanding = await Promise.all([...pending.values()])
  return [...results, ...outstanding].every(Boolean)
}
export function registerSaveFlusher(flush: () => Promise<boolean>) { flushers.add(flush); return () => { flushers.delete(flush) } }
export function trackPendingSave(path: string, operation: Promise<boolean>) {
  pending.set(path, operation)
  void operation.finally(() => { if (pending.get(path) === operation) pending.delete(path) })
}
export async function waitForPendingSave(path: string) { await pending.get(path) }

/** Account-owned state, serialized writes, and optimistic version checks. */
export function useSavedState<T>(path: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback), [ready, setReady] = useState(false)
  const [status, setStatusText] = useState('Loading saved progress'), [conflict, setConflict] = useState(false)
  const [phase, setPhase] = useState<TaskPhase>('processing')
  const setStatus = useCallback((text: string) => {
    setStatusText(text)
    setPhase(text === 'Saved' ? 'saved' : text.startsWith('Saving') ? 'saving' : text === 'Loading saved progress' ? 'processing' : 'error')
  }, [])
  const [loadRevision, setLoadRevision] = useState(0)
  const ref = useRef({ value: fallback, version: 0, saved: JSON.stringify(fallback), ready: false,
    conflict: false, generation: 0, flight: null as Promise<boolean> | null, timer: null as ReturnType<typeof setTimeout> | null })

  const load = useCallback(async () => {
    const generation = ++ref.current.generation
    setReady(false); setStatus('Loading saved progress'); ref.current.ready = false
    try {
      await pending.get(path)
      const response = await api(path), data = response.data ?? fallback
      if (generation !== ref.current.generation) return
      Object.assign(ref.current, { value: data, version: response.version, saved: JSON.stringify(data), ready: true, conflict: false })
      setValue(data); setConflict(false); setStatus('Saved'); setReady(true)
      setLoadRevision(old => old + 1)
    } catch (error: any) { if (generation === ref.current.generation) { setStatus('Couldn’t load progress: ' + error.message); setReady(false) } }
  }, [path])

  const flush = useCallback(async (): Promise<boolean> => {
    const r = ref.current
    if (r.timer) { clearTimeout(r.timer); r.timer = null }
    if (!r.ready || r.conflict) return false
    if (r.flight) { const okay = await r.flight; return okay ? flush() : false }
    const snapshot = JSON.stringify(r.value)
    if (snapshot === r.saved) { setStatus('Saved'); return true }
    setStatus('Saving…')
    const operation: Promise<boolean> = (async () => {
      try {
        const response = await api(path, { method: 'PUT', body: JSON.stringify({ version: r.version, data: JSON.parse(snapshot) }), keepalive: true })
        r.version = response.version; r.saved = snapshot
        setStatus('Saved'); return true
      } catch (error: any) {
        if (error.status === 409) { r.conflict = true; setConflict(true); setStatus('Updated on another device') }
        else setStatus('Couldn’t save: ' + error.message)
        return false
      } finally { if (pending.get(path) === r.flight) pending.delete(path); r.flight = null }
    })()
    r.flight = operation; pending.set(path, operation)
    const okay = await operation
    return okay && JSON.stringify(r.value) !== r.saved ? flush() : okay
  }, [path])

  const change = useCallback((next: T | ((previous: T) => T)) => {
    const r = ref.current
    if (!r.ready || r.conflict) return
    const result = typeof next === 'function' ? (next as (v: T) => T)(r.value) : next
    if (JSON.stringify(result) === JSON.stringify(r.value)) return
    r.value = result
    setValue(r.value); setStatus('Saving…')
    if (r.timer) clearTimeout(r.timer)
    r.timer = setTimeout(() => { void flush() }, 250)
  }, [flush])

  useEffect(() => {
    let active = true
    const start = async () => { if (active) await load() }; void start()
    flushers.add(flush)
    return () => { active = false; ++ref.current.generation; flushers.delete(flush); void flush() }
  }, [load, flush])
  return { value, change, ready, status, phase, conflict, flush, reload: load, loadRevision }
}

export function SaveStatus({ saved }: { saved: ReturnType<typeof useSavedState<any>> }) {
  const failed = saved.status.startsWith('Couldn’t save')
  return <div className={'save-status ' + (saved.conflict || failed ? 'save-problem' : '')} role="status">
    <TaskVisual phase={saved.phase} compact/><span className={saved.status === 'Saved' ? 'saved-dot' : 'pending-dot'}/><span>{saved.status}</span>
    {saved.conflict ? <button type="button" onClick={saved.reload}>Load latest</button> : failed ? <button type="button" onClick={saved.flush}>Retry save</button> : !saved.ready ? saved.status === 'Loading saved progress' ? null : <button onClick={saved.reload}>Retry load</button> : null}
  </div>
}
