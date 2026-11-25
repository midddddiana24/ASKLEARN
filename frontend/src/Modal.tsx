import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, children, close, busy = false, restoreFocus }: {
  title: string; children: ReactNode; close: () => void; busy?: boolean; restoreFocus?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId(), restore = useRef(restoreFocus)
  restore.current = restoreFocus
  useEffect(() => {
    const dialog = ref.current!; dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-dialog-autofocus]')?.focus()
    return () => { dialog.close(); if (restore.current) requestAnimationFrame(() => { if (!document.querySelector('dialog[open]')) restore.current?.() }) }
  }, [])
  return <dialog ref={ref} aria-labelledby={titleId} aria-busy={busy || undefined}
    onCancel={e => { e.preventDefault(); if (!busy) close() }}
    onClick={e => { if (e.target === e.currentTarget && !busy) close() }}>
    <div className="modal-head"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" title="Close dialog" disabled={busy} onClick={close}><X/></button></div>{children}
  </dialog>
}
