import StudyArtwork from './StudyArtwork'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, BookOpen, Check, ChevronLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { api } from './api'
import { useApp } from './AppContext'

export default function AuthPage({ register = false, brand }: { register?: boolean; brand: ReactNode }) {
  const { login } = useApp(), navigate = useNavigate()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [visible, setVisible] = useState(false), [caps, setCaps] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null), request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [register])
  useEffect(() => { setError(''); setVisible(false); setCaps(false); setBusy(false) }, [register])
  useEffect(() => { if (error) errorRef.current?.focus() }, [error])
  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setError(''); setBusy(true)
    const data = Object.fromEntries(new FormData(event.currentTarget))
    const controller = new AbortController(); request.current = controller
    try {
      const user = await api('/auth/' + (register ? 'register' : 'login'), { method: 'POST', body: JSON.stringify(data), signal: controller.signal })
      if (!controller.signal.aborted) { login(user); navigate('/dashboard') }
    } catch (failure: any) { if (!controller.signal.aborted) setError(failure.message) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <main id="main" className="auth-layout auth-refined">
    <aside className="auth-story" aria-label="Your ASKLearn study space">
      {brand}
      <div className="auth-story-content"><span className="auth-story-tag"><BookOpen size={16}/> A little progress, every day.</span>
        <h2>Your next chapter,<br/>right here.</h2><p>A familiar place for your lessons, questions, and everything you’re learning.</p>
        <StudyArtwork className="auth-study-art"/>
      </div>
      <div className="auth-story-footer"><Check size={18}/><p>Your materials and progress stay with your account.</p></div>
    </aside>
    <div className="auth-form-wrap">
      <div className="auth-mobile-brand">{brand}</div>
      <Link className="back-link" to="/"><ChevronLeft size={17}/> Back to ASKLearn</Link>
      <form onSubmit={submit} className="auth-form" aria-labelledby="auth-heading" aria-busy={busy}>
        <div className="auth-form-emblem" aria-hidden="true"><LockKeyhole size={22}/></div>
        <h1 id="auth-heading">{register ? 'Create your account.' : 'Welcome back.'}</h1>
        <p className="auth-subtitle">{register ? 'Keep your lessons and learning progress in one place.' : 'Sign in to pick up where you left off.'}</p>
        {error && <div ref={errorRef} id="auth-error" className="auth-error" role="alert" tabIndex={-1}><AlertCircle size={19}/><span>{error}</span></div>}
        <div className="auth-fields">
          {register && <label htmlFor="auth-name">Your name<input id="auth-name" name="name" autoComplete="name" required maxLength={80} placeholder="Your name" disabled={busy}/></label>}
          <label htmlFor="auth-email">Email address<input id="auth-email" name="email" autoComplete="email" type="email" required placeholder="you@example.com" disabled={busy} autoCapitalize="none" spellCheck={false}/></label>
          <div className="auth-password-field"><label htmlFor="auth-password">Password</label>
            <div className="password-input"><input id="auth-password" name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={10} maxLength={128} required placeholder={register ? 'At least 10 characters' : 'Enter your password'} disabled={busy} aria-describedby={register ? 'auth-password-help' : undefined} onKeyUp={event => setCaps(event.getModifierState('CapsLock'))} onBlur={() => setCaps(false)}/>
              <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} disabled={busy} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
            </div>
            {register && <p id="auth-password-help" className="auth-field-help">Use at least 10 characters.</p>}
            {caps && <p className="auth-caps" role="status">Caps Lock is on.</p>}
          </div>
        </div>
        <button className="primary large auth-submit" disabled={busy}>{busy ? <><span className="spinner" aria-hidden="true"/>{register ? 'Creating account…' : 'Signing in…'}</> : <>{register ? 'Create account' : 'Sign in'}<ArrowRight size={18}/></>}</button>
        <p className="auth-switch">{register ? 'Already have an account?' : 'New to ASKLearn?'} <Link to={register ? '/login' : '/register'} onClick={event => { if (busy) event.preventDefault() }} aria-disabled={busy || undefined}>{register ? 'Sign in' : 'Create an account'}</Link></p>
        <div className="auth-privacy"><LockKeyhole size={15}/><p>Materials are private to your account within ASKLearn. AI features send lesson passages to Gemini or OpenRouter and its model providers. Gemini free-tier content may be used to improve Google products.</p></div>
      </form>
      <p className="auth-form-footer">Your lessons. Your pace. A place to make progress.</p>
    </div>
  </main>
}
