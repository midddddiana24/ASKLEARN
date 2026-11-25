import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Ellipsis, Pencil, ListMinus, Trash2 } from 'lucide-react'
import Modal from './Modal'

export type WorkspaceMaterial = { id: number; filename: string }
type Props = {
  material: WorkspaceMaterial; selected: boolean; disabled: boolean; blockedReason: string
  onRename: (material: WorkspaceMaterial, name: string) => Promise<void>
  onRemove: (material: WorkspaceMaterial) => Promise<void>
  onDelete: (material: WorkspaceMaterial) => Promise<void>
}

export default function WorkspaceFileActions({ material, selected, disabled, blockedReason, onRename, onRemove, onDelete }: Props) {
  const [open, setOpen] = useState(false), [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const [name, setName] = useState(material.filename), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [position, setPosition] = useState({ left: 12, top: 12 })
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), flight = useRef(false), alive = useRef(true)
  const menuId = useId(), helpId = useId(), errorId = useId()
  const restoreFocus = () => {
    if (trigger.current?.isConnected) trigger.current.focus()
    else document.querySelector<HTMLElement>('.workspace-sidebar [aria-label="Add materials"]')?.focus()
  }
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!open) return
    const update = () => {
      if (!trigger.current || !menu.current) return
      const r = trigger.current.getBoundingClientRect(), m = menu.current.getBoundingClientRect()
      setPosition({ left: Math.max(12, Math.min(r.left, innerWidth - m.width - 12)), top: Math.max(12, r.bottom + m.height + 8 < innerHeight ? r.bottom + 6 : r.top - m.height - 6) })
    }
    update(); menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus()
    const outside = (e: PointerEvent) => { if (!trigger.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open])
  const keys = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); setOpen(false); restoreFocus(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)')]
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }
  const launch = (kind: 'rename' | 'delete') => { if (flight.current || disabled) return; setOpen(false); setError(''); setName(material.filename); setDialog(kind) }
  const run = async (kind: 'rename' | 'remove' | 'delete') => {
    if (flight.current || disabled) return
    const trimmed = name.trim()
    if (kind === 'rename' && (!trimmed || trimmed.length > 255 || /[/\\]/.test(trimmed))) { setError('Enter 1–255 characters without / or \\.'); return }
    if (kind !== 'rename' && blockedReason) { setError(blockedReason); return }
    flight.current = true; setBusy(true); setError('')
    try {
      if (kind === 'rename') await onRename(material, trimmed)
      else if (kind === 'remove') await onRemove(material)
      else await onDelete(material)
      if (alive.current) { setDialog(null); setOpen(false); requestAnimationFrame(restoreFocus) }
    } catch (failure: any) { if (alive.current) setError(failure.message || 'The file action could not be completed. Try again.') }
    finally { flight.current = false; if (alive.current) setBusy(false) }
  }
  return <>
    <button ref={trigger} type="button" className="icon-button workspace-file-trigger" aria-label={`Actions for ${material.filename}`} title={`Actions for ${material.filename}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={disabled || busy}
      onClick={() => { setError(''); setOpen(!open) }}><Ellipsis size={18}/></button>
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label={`Actions for ${material.filename}`} aria-describedby={blockedReason ? helpId : undefined}
      className="workspace-file-menu" style={position} onKeyDown={keys}>
      <button type="button" role="menuitem" disabled={disabled || busy} onClick={() => launch('rename')}><Pencil size={16}/>Rename</button>
      <button type="button" role="menuitem" disabled={!!blockedReason || !selected || busy} onClick={() => { void run('remove') }}><ListMinus size={16}/>Remove from workspace</button>
      <button type="button" role="menuitem" className="danger" disabled={!!blockedReason || busy} onClick={() => launch('delete')}><Trash2 size={16}/>Delete from account</button>
      {blockedReason ? <p id={helpId}>{blockedReason}</p> : !selected && <p>This material is not selected in this workspace.</p>}
      {error && <p className="file-action-error" role="alert">{error}</p>}
    </div>, document.body)}
    {dialog === 'rename' && <Modal title="Rename material" busy={busy} restoreFocus={restoreFocus} close={() => setDialog(null)}>
      <form onSubmit={e => { e.preventDefault(); void run('rename') }}><label>Document name<input autoFocus data-dialog-autofocus required maxLength={255} value={name} disabled={busy} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} onFocus={e => e.currentTarget.select()} onChange={e => { setName(e.target.value); setError('') }}/></label>
        <p className="fine muted">Changes the display name. Your material, sources and saved history stay in your account.</p>
        {error && <p id={errorId} className="file-action-error" role="alert">{error}</p>}
        <div className="actions"><button type="button" className="secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="primary" disabled={busy || !name.trim()}>{busy ? 'Saving name…' : 'Save name'}</button></div>
      </form>
    </Modal>}
    {dialog === 'delete' && <Modal title="Delete this material?" busy={busy} restoreFocus={restoreFocus} close={() => setDialog(null)}>
      <p>Delete <strong className="file-action-name">{material.filename}</strong> from your account?</p><p>This permanently deletes this material and its related conversations, study tools and assessment attempts. If used by the current workspace, that workspace will be cleared. This cannot be undone.</p>
      {error && <p className="file-action-error" role="alert">{error}</p>}
      <div className="actions"><button type="button" autoFocus data-dialog-autofocus className="secondary" disabled={busy} onClick={() => setDialog(null)}>Keep my material</button><button type="button" className="primary destructive" disabled={busy || !!blockedReason} onClick={() => { void run('delete') }}>{busy ? 'Deleting…' : 'Delete permanently'}</button></div>
    </Modal>}
  </>
}
