import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CircleHelp, ArrowRight, ArrowLeft, X } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { api } from './api'
import { useApp } from './AppContext'
import { StudentIllustration } from './StudentArt'

type Section = 'dashboard' | 'library' | 'workspace'
type Status = 'not_started' | 'in_progress' | 'completed' | 'skipped'
type Progress = Record<Section, { guide_version: number; step: number; status: Status }>
type Step = { target: string; title: string; text: string }
const steps: Record<Section, Step[]> = {
  dashboard: [
    { target: '.continue-card', title: 'Pick up where you left off', text: 'Continue your saved workspace here. New here? Add your first material to begin.' },
    { target: '.history-section .section-heading', title: 'Your learning stays with you', text: 'Search and filter saved lessons, conversations, study tools and assessment attempts in your learning history.' },
    { target: '.navigation-dock a[href="/library"]', title: 'Bring your own lesson', text: 'My library holds your uploaded materials. Open it when you are ready to add a PDF, document, slide deck or text file.' },
    { target: '.account-profile', title: 'Make this space yours', text: 'Set your name, avatar and companion preference in Profile. Use Help to restart the guide on any study page.' },
  ],
  library: [
    { target: '.upload-zone', title: 'Start with a study material', text: 'Choose a file or drop it into this area. The guide will never upload a file for you.' },
    { target: '.upload-queue, .upload-zone', title: 'Follow the real progress', text: 'Upload percentage measures file transfer. Processing continues until extraction and saving finish; errors show recovery instructions.' },
    { target: '.document-card, .materials .section-heading', title: 'Choose what to study', text: 'After uploading, select up to 20 materials here. If your library is empty, upload a lesson first.' },
    { target: '.materials .section-heading', title: 'Open your study space', text: 'Open Workspace becomes available after selecting materials. Your existing lessons and saved progress stay in your account.' },
  ],
  workspace: [
    { target: '.workspace-sidebar .sidebar-section', title: 'Keep your sources in reach', text: 'Select the materials for your session here. If none are available, add a file in My library first.' },
    { target: '.tool-tabs', title: 'Choose a way to learn', text: 'Ask questions, create summaries and reviewers, or practise with flashcards and quizzes. Open source references to check AI explanations against your lesson.' },
    { target: '.workspace-sidebar', title: 'Come back to saved work', text: 'Your conversations, generated tools and practice history appear here. Select a saved item to return to it.' },
    { target: '.workspace-title', title: 'Watch your save status', text: 'Saved means the server acknowledged your progress. If saving fails or another device changes it, follow the displayed recovery instructions.' },
  ],
}

function Tour({ section, index, move, close, avatar }: { section: Section; index: number; move: (index: number) => void; close: (completed: boolean) => void; avatar?: string }) {
  const dialog = useRef<HTMLDialogElement>(null), panel = useRef<HTMLElement>(null), first = useRef<HTMLButtonElement>(null), reduced = useReducedMotion()
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [placement, setPlacement] = useState<{ top?: number; left?: number }>({})
  const step = steps[section][index]
  useEffect(() => {
    const node = dialog.current!
    node.showModal(); first.current?.focus()
    return () => { node.close(); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.help-launcher')?.focus()) }
  }, [])
  useEffect(() => {
    // Open only the mobile navigation drawer; no learning state is changed.
    const sidebar = document.querySelector('.workspace-sidebar'), wasOpen = sidebar?.classList.contains('guide-open')
    if (section === 'workspace' && index !== 1 && index !== 3) sidebar?.classList.add('guide-open')
    const target = step.target.split(',').map(selector => document.querySelector<HTMLElement>(selector.trim())).find(node => node && node.getClientRects().length > 0)
    target?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'center', inline: 'nearest' })
    const measure = () => {
      if (!target?.isConnected) { setRect(null); return }
      const r = target.getBoundingClientRect(), top = Math.max(8, r.top - 6), left = Math.max(8, r.left - 6)
      setRect({ top, left, width: Math.max(0, Math.min(innerWidth - left - 8, r.width + 12)), height: Math.max(0, Math.min(innerHeight - top - 8, r.height + 12)) })
      if (innerWidth < 768 || !panel.current) { setPlacement({}); return }
      const { width, height } = panel.current.getBoundingClientRect(), gap = 20, margin = 16
      const clampY = (y: number) => Math.max(margin, Math.min(innerHeight - height - margin, y))
      if (r.left - width - gap >= margin) setPlacement({ left: r.left - width - gap, top: clampY(r.top) })
      else if (r.right + gap + width <= innerWidth - margin) setPlacement({ left: r.right + gap, top: clampY(r.top) })
      else if (r.bottom + gap + height <= innerHeight - margin) setPlacement({ left: Math.max(margin, innerWidth - width - margin), top: r.bottom + gap })
      else if (r.top - gap - height >= margin) setPlacement({ left: Math.max(margin, innerWidth - width - margin), top: r.top - gap - height })
      else setPlacement({ left: r.left + r.width / 2 > innerWidth / 2 ? margin : innerWidth - width - margin, top: clampY(innerHeight - height - margin) })
    }
    measure(); const observer = new ResizeObserver(measure); if (target) observer.observe(target)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true)
    const timer = setTimeout(measure, 450)
    return () => { clearTimeout(timer); observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); if (!wasOpen) sidebar?.classList.remove('guide-open') }
  }, [section, index, step.target, reduced])
  return <dialog ref={dialog} className="guide-dialog" aria-labelledby="guide-title" aria-describedby="guide-description" onCancel={e => { e.preventDefault(); close(false) }}>
    {rect && <div className="guide-spotlight" aria-hidden="true" style={rect}/>}
    <section ref={panel} className="guide-panel" style={placement.left === undefined ? undefined : { ...placement, right: 'auto', bottom: 'auto' }}>
      <div className="guide-panel-top"><span className="eyebrow">YOUR STUDY GUIDE · {index + 1} OF {steps[section].length}</span><button ref={first} className="icon-button" aria-label="Close guide" onClick={() => close(false)}><X size={18}/></button></div>
      <div className="guide-explanation"><div className="guide-character"><StudentIllustration pose={index === 3 ? "success" : section === "library" && index === 0 ? "upload" : section === "library" && index === 1 ? "think" : section === "workspace" && index === 0 ? "read" : "point"} avatar={avatar}/></div><div aria-live="polite" aria-atomic="true"><h2 id="guide-title">{step.title}</h2><p id="guide-description">{step.text}</p>{!rect && <p className="fine">This control is currently unavailable. You can continue the guide or return later.</p>}</div></div>
      <div className="guide-controls"><button className="text-button" onClick={() => close(false)}>Skip tour</button><div><button className="secondary" disabled={index === 0} onClick={() => move(index - 1)}><ArrowLeft size={16}/> Back</button><button className="primary" onClick={() => index === 3 ? close(true) : move(index + 1)}>{index === 3 ? 'Done' : 'Next'}<ArrowRight size={16}/></button></div></div>
    </section>
  </dialog>
}

export default function Guidance({ introActive }: { introActive: boolean }) {
  const { user, profile, notify } = useApp(), location = useLocation()
  const section = location.pathname.slice(1) as Section
  const [progress, setProgress] = useState<Progress | null>(null), [active, setActive] = useState<number | null>(null), [error, setError] = useState(false)
  const [inAssessment, setInAssessment] = useState(false)
  const identity = useRef(user?.id), queue = useRef(Promise.resolve())
  const touched = useRef(new Set<Section>())
  const sequence = useRef(0), revisions = useRef(new Map<Section, number>())
  identity.current = user?.id
  useEffect(() => {
    let current = true; touched.current = new Set(); revisions.current = new Map(); setProgress(null); setActive(null); setError(false)
    if (user) api('/onboarding').then(p => { if (current) setProgress(old => {
      const next = { ...p }
      if (old) touched.current.forEach(section => { next[section] = old[section] })
      return next
    }) }).catch(() => { if (current) setError(true) })
    return () => { current = false }
  }, [user?.id])
  useEffect(() => { setActive(null) }, [location.pathname])
  useEffect(() => {
    const check = () => setInAssessment(!!document.querySelector('[role=timer]'))
    check(); const observer = new MutationObserver(check); observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  if (!user) return null
  const valid = Object.hasOwn(steps, section)
  const persist = (index: number, status: Exclude<Status, 'not_started'>) => {
    if (!valid) return
    const id = user.id, body = { section, guide_version: 1, step: index, status }
    const revision = ++sequence.current
    revisions.current.set(section, revision)
    touched.current.add(section)
    setProgress(old => {
      const base = old || Object.fromEntries(Object.keys(steps).map(name => [name, { guide_version: 1, step: 0, status: 'not_started' }])) as Progress
      return { ...base, [section]: { guide_version: 1, step: index, status: ['completed', 'skipped'].includes(base[section].status) ? base[section].status : status } }
    })
    const save = async () => {
      if (identity.current !== id || revisions.current.get(section) !== revision) return
      try { const p = await api('/onboarding', { method: 'PATCH', body: JSON.stringify(body) }); if (identity.current === id && revisions.current.get(section) === revision) { setError(false); setProgress(old => old ? { ...old, [section]: p[section] } : p) } }
      catch { if (identity.current === id && revisions.current.get(section) === revision) { setError(true); notify('Guide progress could not be saved. You can keep studying.', () => { void save() }) } }
    }
    queue.current = queue.current.then(save)
  }
  const start = (restart = false) => { const index = !restart && progress?.[section].status === 'in_progress' ? progress[section].step : 0; setActive(index); persist(index, 'in_progress') }
  const close = (completed: boolean) => { persist(active ?? 0, completed ? 'completed' : 'skipped'); setActive(null) }
  const status = progress?.[section]?.status
  const offer = valid && profile && profile.companion !== false && !introActive && active === null && !inAssessment && (status === 'not_started' || status === 'in_progress')
  return <>
    {!introActive && <button className="help-launcher" title="Restart this page’s guide" onClick={() => valid ? start(true) : notify('Open Dashboard, My library or Workspace to start a guide.')} aria-label="Help and study guide"><CircleHelp size={18}/> Help</button>}
    {offer && <aside className="guide-invitation" aria-label="New user help"><span className="eyebrow">LET’S FIND YOUR WAY</span><strong>{status === 'in_progress' ? 'Continue with your study guide' : 'Meet your study guide'}</strong><p>A short walkthrough of this page. You’re in control.</p><div><button className="secondary" onClick={() => { persist(0, 'skipped') }}>Skip tour</button><button className="primary" onClick={() => start()}>{status === 'in_progress' ? 'Resume guide' : 'Show me around'}<ArrowRight size={16}/></button></div></aside>}
    {error && !introActive && <span className="guide-save-note" role="status">Guide progress not synced. Help is still available.</span>}
    {active !== null && valid && !introActive && <Tour key={section} section={section} index={active} avatar={profile?.avatar} move={index => { setActive(index); persist(index, 'in_progress') }} close={close}/>}
  </>
}
