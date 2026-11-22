import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useReducedMotion } from 'framer-motion'

export type TaskPhase = 'opening' | 'idle' | 'uploading' | 'processing' | 'generating' | 'saving' | 'saved' | 'error'
const requests = new Map<string, number>(), listeners = new Set<() => void>()
const subscribe = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback) } }
const owner = () => [...requests].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
const announce = () => listeners.forEach(callback => callback())

export function TaskArtwork({ phase }: { phase: TaskPhase }) {
  return <svg viewBox="0 0 160 110" aria-hidden="true" className="task-artwork">
    <ellipse cx="80" cy="96" rx="57" ry="6" fill="currentColor" opacity=".09"/>
    <path d="m91 43 27-8 22 14v38l-43 12z" fill="var(--chrome)" stroke="currentColor" strokeWidth="2"/>
    <path d="m96 66 28-8 16 8v21l-43 12z" fill="var(--accent-light)" stroke="currentColor" strokeWidth="2"/>
    <g className="task-paper"><path d="m100 21 22-6 9 26-22 7z" fill="var(--surface)" stroke="currentColor" strokeWidth="2"/><path d="m106 28 13-3m-11 10 13-4" stroke="currentColor"/></g>
    <path d="m19 63 39-19 40 23-39 23z" fill="var(--accent)" stroke="currentColor" strokeWidth="2"/>
    <path d="m22 54 36-19 38 23v10L59 87 22 64z" fill="var(--surface)" stroke="currentColor" strokeWidth="2"/>
    <path d="m19 50 39-22 40 24-39 22z" fill="var(--accent-light)" stroke="currentColor" strokeWidth="2"/>
    <path className="task-bookmark" d="m65 48 8-4 19 11-8 5v14l-5-2-6 6V64z" fill={phase === 'error' ? 'var(--danger)' : 'var(--success)'}/>
    {phase === 'saved' && <path d="m44 44 7 7 16-18" fill="none" stroke="var(--success)" strokeWidth="5" strokeLinecap="round"/>}
    {phase === 'error' && <path d="M53 35v13m0 5v2" stroke="var(--danger)" strokeWidth="4" strokeLinecap="round"/>}
  </svg>
}

export default function TaskVisual({ phase, label, progress, compact = false, threeD = true, priority = 0, startedAt }: {
  phase: TaskPhase; label?: string; progress?: number; compact?: boolean; threeD?: boolean; priority?: number; startedAt?: number
}) {
  const reduced = useReducedMotion(), id = useId(), host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false), [failed, setFailed] = useState(false), [rendered, setRendered] = useState(false)
  const [theme, setTheme] = useState(document.documentElement.dataset.theme)
  const activeOwner = useSyncExternalStore(subscribe, owner, () => '')
  const eligible = threeD && !compact && !reduced && !failed && visible
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.dataset.theme))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const node = host.current!
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting))
    observer.observe(node); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!eligible) return
    requests.set(id, priority || (phase === 'opening' ? 30 : 10)); announce()
    return () => { requests.delete(id); announce() }
  }, [eligible, id, phase, priority])
  useEffect(() => {
    if (!eligible || activeOwner !== id || !host.current) return
    let cancelled = false, dispose: (() => void) | undefined
    setRendered(false)
    void import('./taskScene').then(({ mountTaskScene }) => {
      if (cancelled) return
      try { dispose = mountTaskScene(host.current!, phase, () => { if (!cancelled) setFailed(true) }, () => { if (!cancelled) setRendered(true) }, { startedAt }) }
      catch { setFailed(true) }
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true; dispose?.(); setRendered(false) }
  }, [eligible, activeOwner, id, phase, theme, startedAt])
  return <div className={`task-visual task-${phase} ${compact ? 'task-compact' : ''}`} data-phase={phase}>
    <div className="task-object" ref={host} aria-hidden="true" data-renderer={rendered ? 'webgl' : 'svg'}>
      <div className={`task-fallback ${rendered ? 'is-rendered' : ''}`}><TaskArtwork phase={phase}/></div>
    </div>
    {label && <span className="task-label">{label}</span>}
    {progress !== undefined && <progress aria-label="Upload progress" value={Math.max(0, Math.min(progress, 100))} max={100}/>}
  </div>
}
