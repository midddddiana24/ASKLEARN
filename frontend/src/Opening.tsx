import { useEffect, useState } from 'react'
import TaskVisual from './TaskVisual'

export default function Opening() {
  const [skipped, setSkipped] = useState(() => {
    try { return !!sessionStorage.getItem('asklearn-opening-v1') } catch { return false }
  })
  useEffect(() => { try { sessionStorage.setItem('asklearn-opening-v1', 'seen') } catch { /* Optional preference storage. */ } }, [])
  return <div className="opening-panel" role="status">
    {!skipped && <TaskVisual phase="opening"/>}
    <h1>Opening your study space</h1><p>Your lessons, ideas, and progress.</p>
    {!skipped && <button className="secondary" onClick={() => setSkipped(true)}>Skip animation</button>}
    <span className="fine muted">Connecting to ASKLearn…</span>
  </div>
}
