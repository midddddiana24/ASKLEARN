import StudyArtwork from './StudyArtwork'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, BookOpen, Check, Clock, FileText, MessageSquare, Layers, Search, Settings, GraduationCap } from 'lucide-react'
import WindowTitle from './WindowTitle'
import { MaterialsIcon, AskIcon, CardsIcon, TestIcon } from './StudyIcons'
import { api, setCsrf } from './api'
import { useApp } from './AppContext'
import Companion, { StudentIllustration } from './Companion'
import { useSavedState, SaveStatus } from './useSavedState'

export const EMPTY_WORKSPACE = { document_ids: [] as number[], tab: 'chat', chat_id: null as number | null, study_set_id: null as number | null, attempt_id: null as number | null }

export function Dashboard() {
  const { user, profile, updateProfile, notify } = useApp(), navigate = useNavigate()
  const saved = useSavedState('/workspace', EMPTY_WORKSPACE)
  const [history, setHistory] = useState<any>(null), [query, setQuery] = useState(''), [type, setType] = useState('all'), [offset, setOffset] = useState(0), [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true; setLoading(true)
    const timer = setTimeout(() => { api(`/history?q=${encodeURIComponent(query)}&type=${type}&offset=${offset}`).then(result => { if (active) setHistory(result) }).catch(error => { if (active) notify(error.message) }).finally(() => { if (active) setLoading(false) }) }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [query, type, offset])
  const open = async (item) => {
    const next = { ...EMPTY_WORKSPACE, document_ids: item.document_ids }
    if (item.type === 'chat') next.chat_id = item.id
    if (item.type === 'study') { next.study_set_id = item.id; next.tab = item.kind }
    if (item.type === 'attempt') { next.study_set_id = item.study_set_id; next.tab = item.kind; next.attempt_id = item.id }
    saved.change(next)
    if (await saved.flush()) navigate('/workspace')
  }
  const counts = history?.counts
  return <main id="main" className="dashboard-page">
    <section className="profile-welcome"><WindowTitle>Student profile</WindowTitle><div className="profile-welcome-copy"><span className="welcome-avatar"><StudentIllustration avatar={profile?.avatar}/></span><p>Your personal learning space</p><h1>Welcome back,<br/>{' '}{user.name.split(' ')[0]}.</h1><p>Your lessons and ideas are right where you left them.</p><Link className="welcome-settings" to="/profile"><Settings size={16}/> Profile settings</Link></div><StudentIllustration state="ready" avatar={profile?.avatar}/></section>
    <div className="dashboard-stats" aria-label="Your learning activity"><div><MaterialsIcon size={22}/><strong>{counts?.document ?? '—'}</strong><span>Materials</span></div><div><AskIcon size={22}/><strong>{counts?.chat ?? '—'}</strong><span>Conversations</span></div><div><CardsIcon size={22}/><strong>{counts?.study ?? '—'}</strong><span>Study tools</span></div><div><TestIcon size={22}/><strong>{counts?.completed ?? '—'}</strong><span>Completed assessments</span></div></div>
    <section className="continue-card"><WindowTitle>Saved workspace</WindowTitle><span className="continue-icon"><BookOpen size={26}/></span><div><h2>Continue learning</h2><p>{saved.value.document_ids.length ? `Return to your saved ${saved.value.tab === 'chat' ? 'conversation' : saved.value.tab} workspace.` : 'Your next chapter starts with a lesson.'}</p><SaveStatus saved={saved}/></div>{saved.value.document_ids.length ? <button className="primary" disabled={!saved.ready || saved.conflict} onClick={() => navigate('/workspace')}>Pick up where you left off<ArrowUpRight size={17}/></button> : <Link to="/library" className="primary">Add your first material<ArrowUpRight size={17}/></Link>}</section>
    <Companion enabled={profile?.companion !== false} avatar={profile?.avatar} onHide={() => { void updateProfile({ companion: false }).catch((e: any) => notify(e.message)) }} action={() => navigate('/library')} actionLabel="Open my library"/>
    <section className="history-section"><WindowTitle>Recent work</WindowTitle><div className="section-heading"><div><h2>Your learning history</h2><p className="muted">Saved to your account, ready whenever you return.</p></div><label className="history-search"><Search size={17}/><input aria-label="Search learning history" placeholder="Find a lesson or conversation" value={query} onChange={e => { setQuery(e.target.value); setOffset(0) }}/></label></div>
      <div className="history-filters" aria-label="Filter history">{[['all', 'Everything'], ['document', 'Materials'], ['chat', 'Conversations'], ['study', 'Study tools'], ['attempt', 'Assessments']].map(([id, label]) => <button key={id} aria-pressed={type === id} onClick={() => { setType(id); setOffset(0) }}>{label}</button>)}</div>
      {loading ? <div className="history-loading" role="status"><span className="spinner"/>Loading your history…</div> : !history?.items.length ? <div className="history-empty">{query ? <MaterialsIcon size={28}/> : <StudyArtwork className="empty-study-art"/>}<h3>{query ? 'No matching saved work.' : 'Room for your first idea.'}</h3><p>{query ? 'Try a different name or filter.' : 'Upload a lesson and your activity will appear here.'}</p></div> : <div className="history-list">{history.items.map(item => { const Icon = { document: MaterialsIcon, chat: AskIcon, study: CardsIcon, attempt: TestIcon }[item.type]; return <button className="history-row" key={`${item.type}:${item.id}`} onClick={() => open(item)} disabled={!saved.ready || saved.conflict}><span className={`history-resource ${item.type}`}><Icon size={21}/></span><span className="history-row-title"><strong>{item.title}</strong><small>{item.type === 'attempt' ? item.submitted ? `Completed · ${item.score}/${item.total}` : 'Assessment · Open to continue' : item.type === 'study' ? item.kind : item.type === 'document' ? 'Study material' : 'Conversation'}</small></span><span className="history-date"><Clock size={13}/>{new Date(item.updated_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><ArrowUpRight size={17}/></button> })}</div>}
      <div className="history-pagination"><button className="secondary" disabled={!offset || loading} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</button><span className="fine muted">{history?.total || 0} saved item{history?.total === 1 ? '' : 's'}</span><button className="secondary" disabled={history?.next_offset == null || loading} onClick={() => setOffset(history.next_offset)}>Next</button></div>
    </section>
  </main>
}

export function ProfilePage() {
  const { profile, updateProfile, notify, endSession } = useApp(), [name, setName] = useState(profile?.name || ''), [avatar, setAvatar] = useState(profile?.avatar || 'sage'), [companion, setCompanion] = useState(profile?.companion !== false), [busy, setBusy] = useState(false)
  useEffect(() => { if (profile) { setName(profile.name); setAvatar(profile.avatar); setCompanion(profile.companion) } }, [profile])
  const save = async e => { e.preventDefault(); setBusy(true); try { await updateProfile({ name, avatar, companion }); notify('Profile saved.') } catch (error: any) { notify(error.message) } finally { setBusy(false) } }
  const password = async e => {
    e.preventDefault(); const form = e.currentTarget, data = Object.fromEntries(new FormData(form))
    if (data.new_password !== data.confirm_password) { notify('The new passwords do not match.'); return }
    setBusy(true)
    try { await api('/auth/change-password', { method: 'POST', body: JSON.stringify(data) }); setCsrf(''); endSession(); notify('Password changed. Sign in again on your devices.') }
    catch (error: any) { notify(error.message) } finally { setBusy(false) }
  }
  return <main id="main" className="profile-page"><div className="section-heading"><div><h1>Make yourself at home.</h1><p className="muted">Your profile, your study companion, your preferences.</p></div><Link to="/dashboard" className="secondary">Back to dashboard</Link></div><div className="profile-layout"><section className="profile-preview"><WindowTitle>Student card</WindowTitle><div className="profile-cover"/><span className="profile-big-avatar"><StudentIllustration avatar={avatar}/></span><h2>{name || 'Your name'}</h2><p className="muted">{profile?.email}</p><span className="private-label"><Check size={15}/> Your personal study space</span><p className="fine muted">Your learning records stay associated with this account.</p></section><div className="profile-forms"><form className="settings-card" onSubmit={save}><WindowTitle>Personal preferences</WindowTitle><h2>Profile details</h2><label>Your name<input name="name" required minLength={1} maxLength={80} value={name} onChange={e => setName(e.target.value)}/></label><fieldset><legend>Choose your avatar</legend><div className="avatar-options">{['sage', 'mint', 'ocean', 'sunrise'].map(preset => <button type="button" key={preset} aria-label={`${preset} avatar`} aria-pressed={avatar === preset} onClick={() => setAvatar(preset)}><StudentIllustration avatar={preset}/></button>)}</div></fieldset><label className="inline-check"><input type="checkbox" checked={companion} onChange={e => setCompanion(e.target.checked)}/> Show my illustrated study companion</label><p className="fine muted">Motion follows your device’s reduced-motion preference. Practice tests keep the companion minimized.</p><button className="primary" disabled={busy}>Save profile</button></form>
      <form className="settings-card" onSubmit={password}><WindowTitle>Account security</WindowTitle><h2>Change password</h2><p className="fine muted">You’ll be signed out on all devices after changing your password.</p><label>Current password<input name="current_password" type="password" autoComplete="current-password" required maxLength={128}/></label><label>New password<input name="new_password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></label><label>Confirm new password<input name="confirm_password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required/></label><button className="secondary" disabled={busy}>Change password and sign out</button></form><p className="fine muted">This pilot does not offer email verification or forgotten-password recovery. Keep your password in a secure password manager.</p></div></div></main>
}
