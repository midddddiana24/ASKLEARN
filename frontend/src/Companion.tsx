import { useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

export type CompanionState = 'idle' | 'uploading' | 'processing' | 'ready' | 'studying' | 'success' | 'error'

export { StudentIllustration } from './StudentArt'
import { StudentIllustration } from './StudentArt'

const copy: Record<CompanionState, [string, string]> = {
  idle: ['A little progress, together.', 'Bring a lesson. Ask a question. Find your next connection.'],
  uploading: ['Your lesson is on its way.', 'The progress shown is the actual file transfer.'],
  processing: ['Making room for new ideas.', 'Your material is being processed. It will appear after saving completes.'],
  ready: ['Your lesson is safely in your library.', 'Select it to start a conversation or create a study tool.'],
  studying: ['One idea at a time.', 'Open a source passage when you want to check an explanation.'],
  success: ['Another step forward.', 'Your result is saved. Take a look at what you learned.'],
  error: ['Let’s try that again.', 'Follow the error message to retry. Your existing saved work remains available.'],
}
export default function Companion({ state = 'idle', enabled = true, avatar = 'sage', compact = false, onHide, action, actionLabel, message }: {
  state?: CompanionState; enabled?: boolean; avatar?: string; compact?: boolean; onHide?: () => void;
  action?: () => void; actionLabel?: string; message?: string;
}) {
  const [expanded, setExpanded] = useState(!compact)
  if (!enabled) return null
  return <aside className={`companion companion-${state} ${compact ? 'compact' : ''}`} aria-label="Illustrated study companion"><div className="companion-title">Study companion<span>{state === 'uploading' ? 'Transferring' : state === 'processing' ? 'Processing' : 'Here to help'}</span></div>
    <div className="companion-scene"><span className="scene-shelf" aria-hidden="true"/><StudentIllustration state={state} avatar={avatar}/>{state === 'processing' && <span className="scene-lens" aria-hidden="true"/>}</div><div className="companion-copy"><strong>{copy[state][0]}</strong>
      {expanded && <><p>{message || copy[state][1]}</p>{action && <button className="text-button" onClick={action}>{actionLabel || 'Explore your lesson'}</button>}</>}
    </div><div className="companion-controls"><button aria-label={expanded ? 'Minimize companion help' : 'Expand companion help'} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>{onHide && <button aria-label="Hide study companion" onClick={onHide}><X size={16}/></button>}</div>
  </aside>
}
