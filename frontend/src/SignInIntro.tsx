import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import TaskVisual from './TaskVisual'
import { StudentIllustration } from './StudentArt'

export default function SignInIntro({ name, done }: { name: string; done: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), skip = useRef<HTMLButtonElement>(null), callback = useRef(done)
  const reduced = useReducedMotion(), [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(performance.now())
  callback.current = done
  useEffect(() => {
    if (reduced) { callback.current(); return }
    const node = dialog.current!; node.showModal(); skip.current?.focus()
    const start = startedAt.current
    const tick = () => { const time = performance.now() - start; if (time >= 10000) callback.current(); else setElapsed(time) }
    const timer = window.setInterval(tick, 100)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); node.close() }
  }, [reduced])
  if (reduced) return null
  const phase = elapsed < 1000 ? 'splash' : elapsed < 4000 ? 'book' : elapsed < 7000 ? 'cards' : elapsed < 9000 ? 'settle' : 'reveal'
  return <dialog ref={dialog} className={`signin-intro intro-${phase}`} aria-labelledby="intro-title" onCancel={e => { e.preventDefault(); done() }}>
    <button ref={skip} className="secondary intro-skip" onClick={done}>Skip Intro <span aria-hidden="true">→</span></button>
    <div className="intro-logo-splash" aria-hidden="true"><img src="/brand/asklearn-mark-cobalt-v2.png" alt=""/><span/></div>
    <div className="intro-content"><span className="eyebrow">YOUR NEXT CHAPTER</span><div className="intro-study-scene"><StudentIllustration pose={elapsed < 3000 ? "wave" : elapsed < 7000 ? "point" : "success"}/><TaskVisual phase="opening" priority={100} startedAt={startedAt.current}/></div>
      <h1 id="intro-title">Welcome, {name.split(' ')[0]}.</h1><p>A little curiosity. A clearer understanding.</p>
      <div className="intro-timeline" aria-hidden="true"><span style={{ width: `${elapsed / 100}%` }}/></div><small>Welcome animation · skip whenever you’re ready</small>
    </div>
  </dialog>
}
