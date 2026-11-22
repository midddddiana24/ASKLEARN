import type { ReactNode } from 'react'
import { PanelTop } from 'lucide-react'

/** Labelled chrome, with no imitation operating-system controls. */
export default function WindowTitle({ children }: { children: ReactNode }) {
  return <div className="window-title"><PanelTop size={15} aria-hidden="true"/><span>{children}</span><span className="window-grip" aria-hidden="true"/></div>
}
