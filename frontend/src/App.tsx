import StudyArtwork from './StudyArtwork'
import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { BookOpen, ArrowUpRight, ArrowRight, Plus, Upload, FileText, MessageSquare, Layers, ListChecks,
  GraduationCap, Sparkles, Sun, Moon, LogOut, X, Check, Copy, Download, Send, Square, Trash2, Pencil,
  ChevronLeft, ChevronRight, RotateCcw, Shuffle, Clock, Menu, AlertCircle, WifiOff, Library as LibraryIcon } from 'lucide-react'
import { api, setCsrf, uploadFile, streamChat, download } from './api'
import { AppContext, useApp } from './AppContext'
import Assessment from './Assessment'
import AuthPage from './AuthPage'
import { HomeIcon, MaterialsIcon, AskIcon, CardsIcon, QuizIcon, TestIcon, ProfileIcon, StudyBookIcon } from './StudyIcons'
import TaskVisual, { type TaskPhase } from './TaskVisual'
import Opening from './Opening'
import SignInIntro from './SignInIntro'
import Guidance from './Guidance'
import HomeMotion from './HomeMotion'
import WindowTitle from './WindowTitle'
import { Dashboard, ProfilePage, EMPTY_WORKSPACE } from './AccountPages'
import Companion, { StudentIllustration, type CompanionState } from './Companion'
import { useSavedState, SaveStatus, flushSavedStates } from './useSavedState'

type User = { id: number; name: string; email: string; csrf: string }
type Notice = { text: string; retry?: () => void }
const tools = [
  { id: 'chat', label: 'Ask your lesson', icon: AskIcon },
  { id: 'summary', label: 'Summary', icon: MaterialsIcon },
  { id: 'reviewer', label: 'Reviewer', icon: StudyBookIcon },
  { id: 'flashcards', label: 'Flashcards', icon: CardsIcon },
  { id: 'quiz', label: 'Quiz', icon: QuizIcon },
  { id: 'test', label: 'Practice test', icon: TestIcon },
]

function Brand() { return <Link className="brand" to="/" aria-label="ASKLearn home"><span className="brand-symbol"><img src="/brand/asklearn-mark-cobalt-v2.png" alt="" width="40" height="40" decoding="async"/></span><span className="brand-text">ASK<span>Learn</span></span></Link> }
function IconButton({ label, children, ...props }: any) { return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button> }
function Empty({ title, children, illustration = false }: { title: string; children: ReactNode; illustration?: boolean }) { return <div className="empty">{illustration ? <StudyArtwork className="empty-study-art"/> : <StudyBookIcon size={32}/>}<h2>{title}</h2><p>{children}</p></div> }
function Loading({ label = 'Preparing your study space…', phase = 'processing' }: { label?: string; phase?: TaskPhase }) { return <div className="loading" role="status"><TaskVisual phase={phase}/><p>{label}</p><div className="skeleton"/><div className="skeleton short"/></div> }
function Markdown({ text }: { text: string }) { return <div className="prose"><ReactMarkdown>{text}</ReactMarkdown></div> }

function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close() }, [])
  return <dialog ref={ref} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close() }}><div className="modal-head"><h2>{title}</h2><IconButton label="Close dialog" onClick={close}><X/></IconButton></div>{children}</dialog>
}

function Sources({ sources = [], ids }: any) {
  const [open, setOpen] = useState<any>(null)
  const shown = ids ? sources.filter((s: any) => ids.includes(s.id)) : sources
  return <><div className="sources">{shown.map((s: any) => <button key={s.id} onClick={() => setOpen(s)}><FileText size={13}/>{s.id} · {s.file} · loc. {s.page}</button>)}</div>
    {open && <Modal title={`${open.file} · location ${open.page}`} close={() => setOpen(null)}><p className="muted">PDF page / slide number; DOCX and plain text use document location 1.</p><blockquote className="excerpt">{open.excerpt}</blockquote></Modal>}</>
}

export default function App() {
  const [user, setUser] = useState<User | null>(null), [ready, setReady] = useState(false), [health, setHealth] = useState<any>(null)
  const [intro, setIntro] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [notice, setNotice] = useState<Notice | null>(null), [online, setOnline] = useState(navigator.onLine)
  const [theme, setTheme] = useState(() => localStorage.getItem('asklearn-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  const notify = (text: string, retry?: () => void) => setNotice({ text, retry })
  const refresh = async () => {
    setReady(false)
    try {
      setHealth(await api('/health'))
      try { const u = await api('/auth/me'); setUser(u); setCsrf(u.csrf) } catch { setUser(null) }
    } catch { setHealth(null) }
    finally { setReady(true) }
  }
  useEffect(() => { void refresh(); const yes = () => setOnline(true), no = () => setOnline(false)
    window.addEventListener('online', yes); window.addEventListener('offline', no)
    return () => { window.removeEventListener('online', yes); window.removeEventListener('offline', no) }
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('asklearn-theme', theme) }, [theme])
  useEffect(() => {
    const expired = () => { setIntro(false); setUser(null); setProfile(null); setCsrf(''); notify('Please sign in again. Your previously saved work is still available.') }
    window.addEventListener('asklearn-session-expired', expired)
    return () => window.removeEventListener('asklearn-session-expired', expired)
  }, [])
  const login = (u: User) => { setUser(u); setCsrf(u.csrf); setIntro(true) }
  useEffect(() => { if (user) api('/profile').then(setProfile).catch(e => notify(e.message)); else setProfile(null) }, [user?.id])
  const updateProfile = async (data) => { const p = await api('/profile', { method: 'PATCH', body: JSON.stringify(data) }); setProfile(p); setUser(old => old ? { ...old, name: p.name } : old); return p }
  const endSession = () => { setIntro(false); setUser(null); setProfile(null); setCsrf('') }
  const logout = async () => { try { const saved = await flushSavedStates(); if (!saved) notify('Some recent changes could not be saved.'); await api('/auth/logout', { method: 'POST' }); endSession() } catch (e: any) { notify(e.message) } }
  return <AppContext.Provider value={{ user, login, logout, notify, health, profile, updateProfile, endSession }}>
    {ready && health && <HomeMotion/>}
    <a className="skip-link" href="#main">Skip to content</a>
    {!online && <div className="offline" role="status"><WifiOff size={16}/>You’re offline. Reconnect to save or use AI.</div>}
    <div className="theme-control"><IconButton label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</IconButton></div>
    {!ready ? <main id="main" className="boot"><Brand/><Opening/></main> : !health ?
      <main id="main" className="boot"><Brand/><Empty title="Server not reachable">Start the ASKLearn backend, then try again.</Empty><button className="primary" onClick={refresh}>Retry connection</button></main> :
      <Routes><Route path="/" element={user ? <Navigate to="/dashboard"/> : <Welcome/>}/>
        <Route path="/login" element={user ? <Navigate to="/dashboard"/> : <Auth/>}/>
        <Route path="/register" element={user ? <Navigate to="/dashboard"/> : <Auth register/>}/>
        <Route path="/dashboard" element={user ? <><Header/><Dashboard/></> : <Navigate to="/login"/>}/>
        <Route path="/profile" element={user ? <><Header/><ProfilePage/></> : <Navigate to="/login"/>}/>
        <Route path="/library" element={user ? <LibraryPage/> : <Navigate to="/login"/>}/>
        <Route path="/workspace" element={user ? <Workspace/> : <Navigate to="/login"/>}/>
        <Route path="*" element={<Navigate to="/"/>}/></Routes>}
    {user && intro && <SignInIntro key={user.id} name={user.name} done={() => { setIntro(false); requestAnimationFrame(() => { const heading = document.querySelector<HTMLElement>('main h1'); if (heading) { heading.tabIndex = -1; heading.focus() } }) }}/>}
    {ready && health && <Guidance introActive={intro}/>}
    {notice && <div className="toast" role="alert"><AlertCircle size={20}/><span>{notice.text}</span>{notice.retry && <button onClick={() => { setNotice(null); notice.retry!() }}>Retry</button>}<IconButton label="Dismiss notification" onClick={() => setNotice(null)}><X size={18}/></IconButton></div>}
  </AppContext.Provider>
}

function Welcome() {
  const [sample, setSample] = useState<'lesson' | 'question' | 'recall'>('lesson')
  return <main id="main" className="welcome">
    <div className="home-scroll-progress" aria-hidden="true"/><header className="public-header"><Brand/><nav><a href="#how">How it works</a><Link to="/login">Sign in</Link><Link className="primary" to="/register">Start learning <ArrowUpRight size={16}/></Link></nav></header>
    <section className="welcome-hero"><div className="hero-copy"><h1>Your lesson.<br/>Understood.</h1><p>A clearer way through your course materials. Ask questions, connect ideas, and put what you know into practice.</p><Link className="primary large" to="/register">Create your study space <ArrowRight size={18}/></Link><p className="muted fine">Your materials. Your pace. One place to learn.</p></div>
      <div className="lesson-stage"><div className="lesson-object" data-ui><div className="paper-top"><span className="mini-logo"><BookOpen size={18}/> ASKLearn</span><span className="muted">A sample study session</span></div><div className="sample-tabs" aria-label="Explore the sample">{[['lesson', 'Read'], ['question', 'Ask'], ['recall', 'Recall']].map(([id, label]) => <button key={id} aria-pressed={sample === id} onClick={() => setSample(id as any)}>{label}</button>)}</div>
        <div className="sample-content"><span className="sample-subject">Biology / Cell energy</span><h2>{sample === 'lesson' ? 'A little light. A lot of life.' : sample === 'question' ? 'Why do plants need light?' : 'Make the idea stick.'}</h2>
          {sample === 'lesson' ? <><p>Photosynthesis converts light energy into chemical energy. Plants use sunlight, water, and carbon dioxide to produce glucose and oxygen.</p><div className="plant-diagram"><span>Sunlight</span><span className="diagram-arrow">↓</span><span className="leaf-shape"/><span>Glucose + oxygen</span></div><p className="sample-note">Select “Ask” to connect the idea.</p></> : sample === 'question' ? <><div className="sample-question">Why do plants need light?</div><p>Light provides the energy plants convert into chemical energy during photosynthesis. That energy is stored in glucose.</p><span className="sample-citation">S1 · Sample biology lesson · loc. 1</span><p className="sample-note">This example is written for the tour, not generated live.</p></> : <SampleCard/>}</div>
        <div className="paper-bottom"><Check size={16}/> Study from the source. Check your understanding.</div></div></div></section>
    <section id="how" className="welcome-how"><h2>From “I don’t get it”<br/>to “I’ve got this.”</h2><div className="how-list"><article><Upload/><h3>Bring your lesson</h3><p>Upload a PDF, document, slide deck, or text file. Keep your learning materials together.</p></article><article><MessageSquare/><h3>Follow your curiosity</h3><p>Ask a question and follow the answer back to a passage in your own materials.</p></article><article><Layers/><h3>Learn by doing</h3><p>Make flashcards, answer a quiz, or take a timed practice test. See what needs another look.</p></article></div></section>
    <section className="tour-section"><h2>One lesson. More ways in.</h2><p>The same sample lesson, seen through ASKLearn’s study tools.</p><div className="tour-images">{['summary', 'flashcards', 'quiz', 'chat'].map(name => <figure key={name}><img src={`/tour/${name}.png`} alt={`ASKLearn ${name} interface with a sample biology lesson`} loading="lazy"/><figcaption>{name === 'chat' ? 'Ask your lesson' : name[0].toUpperCase() + name.slice(1)}</figcaption></figure>)}</div></section>
    <footer className="public-footer"><Brand/><p>AI can make mistakes. Verify important information with your lesson.</p><Link to="/register">Start learning <ArrowUpRight size={16}/></Link></footer>
  </main>
}
function SampleCard() { const [flipped, setFlipped] = useState(false); return <><button className="sample-flash" onClick={() => setFlipped(!flipped)}>{flipped ? 'Light energy becomes chemical energy stored in glucose.' : 'What energy change happens in photosynthesis?'}</button><p className="sample-note">Tap the card to {flipped ? 'see the question' : 'reveal the answer'}.</p></> }

function Auth({ register = false }) { return <AuthPage register={register} brand={<Brand/>}/> }

function Header({ workspace = false, openMenu }: any) {
  const { user, profile, logout } = useApp(), location = useLocation()
  return <header className="app-header">{workspace && <IconButton label="Toggle workspace sidebar" onClick={openMenu}><Menu size={20}/></IconButton>}<Brand/><nav className="navigation-dock" aria-label="Main navigation"><Link aria-current={location.pathname === '/dashboard' ? 'page' : undefined} className={location.pathname === '/dashboard' ? 'active' : ''} to="/dashboard"><HomeIcon size={19}/> Dashboard</Link><Link aria-current={location.pathname === '/library' ? 'page' : undefined} className={location.pathname === '/library' ? 'active' : ''} to="/library"><MaterialsIcon size={19}/> My library</Link><Link aria-current={workspace ? 'page' : undefined} className={workspace ? 'active' : ''} to="/workspace"><StudyBookIcon size={19}/> Workspace</Link><Link aria-current={location.pathname === '/profile' ? 'page' : undefined} className={location.pathname === '/profile' ? 'active' : ''} to="/profile"><ProfileIcon size={19}/> Profile</Link></nav><div className="account"><Link to="/profile" className="account-profile" aria-label="Profile settings"><span className="avatar"><StudentIllustration avatar={profile?.avatar}/></span><span>{user.name.split(' ')[0]}</span></Link><IconButton label="Sign out" onClick={logout}><LogOut size={18}/></IconButton></div></header>
}

function LibraryPage() {
  const { user, notify, health, profile, updateProfile } = useApp(), navigate = useNavigate()
  const workspace = useSavedState('/workspace', EMPTY_WORKSPACE)
  const [uploadState, setUploadState] = useState<CompanionState>('idle')
  const [queue, setQueue] = useState<any[]>([])
  const updateQueue = (id, changes) => setQueue(old => old.map(item => item.id === id ? { ...item, ...changes } : item))
  const [docs, setDocs] = useState<any[]>([]), [selected, setSelected] = useState<number[]>([]), [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<number | null>(null), [drag, setDrag] = useState(false), [rename, setRename] = useState<any>(null), [remove, setRemove] = useState<any>(null), [wipe, setWipe] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const load = async () => { try { const data = await api('/documents'); setDocs(data); setSelected(old => old.filter(id => data.some(d => d.id === id))) } catch (e: any) { notify(e.message, load) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const upload = async (files: FileList | File[]) => {
    if (progress !== null) return
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID(); setQueue(old => [...old, { id, name: file.name, status: 'waiting', progress: 0 }])
      if (!/\.(pdf|docx|pptx|txt|md)$/i.test(file.name)) { setUploadState('error'); updateQueue(id, { status: 'error' }); notify('Choose PDF, DOCX, PPTX, TXT or MD files.'); continue }
      if (file.size > 15 * 1048576) { setUploadState('error'); updateQueue(id, { status: 'error' }); notify('File too large. Maximum 15 MB per file.'); continue }
      try { setUploadState('uploading'); updateQueue(id, { status: 'uploading' }); setProgress(0); await uploadFile(file, n => { setProgress(n); updateQueue(id, { progress: n, status: n === 100 ? 'processing' : 'uploading' }) }); setUploadState('ready'); updateQueue(id, { status: 'ready', progress: 100 }); await load() }
      catch (e: any) { setUploadState('error'); updateQueue(id, { status: 'error' }); notify(e.message, () => upload([file])) }
      finally { setProgress(null) }
    }
  }
  const openWorkspace = async () => { workspace.change({ ...EMPTY_WORKSPACE, document_ids: selected }); if (await workspace.flush()) navigate('/workspace') }
  return <><Header/><main id="main" className="library-page"><WindowTitle>Study material library</WindowTitle><div className="library-intro"><div><p className="greeting">A little progress, every day.</p><h1>What are we learning,<br/><span>{user.name.split(' ')[0]}?</span></h1><p className="muted">Bring your materials. We’ll help you make sense of them.</p></div><div className="library-quote"><StudyArtwork className="library-study-art"/><p>Understanding starts<br/>with a good question.</p></div></div>
    {!health.ai_configured && <div className="config-banner"><AlertCircle size={20}/><div><strong>Your library is ready. AI tools are not enabled yet.</strong><p>Your saved work stays available. Contact the person managing ASKLearn to enable AI study tools.</p></div></div>}
    <section className={'upload-zone ' + (drag ? 'dragging' : '')} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files) }}>
      <span className="upload-icon"><Upload size={24}/></span><div><h2>{progress === null ? 'Give your next lesson a home.' : progress === 100 ? 'Processing material…' : `Uploading… ${progress}%`}</h2><p>Drop your files here, or choose from your device.</p><p className="fine">PDF, DOCX, PPTX, TXT, MD · Up to 15 MB each · Text-based files</p></div><button className="primary" disabled={progress !== null} onClick={() => input.current?.click()}><Plus size={18}/> Add materials</button>
      <TaskVisual phase={progress !== null ? progress === 100 ? 'processing' : 'uploading' : uploadState === 'ready' ? 'saved' : uploadState === 'error' ? 'error' : 'idle'} threeD={progress !== null}/><input ref={input} hidden type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md" aria-label="Upload learning materials" onChange={e => { if (e.target.files) void upload(e.target.files); e.target.value = '' }}/>{progress !== null && (progress < 100 ? <progress value={progress} max={100} aria-label="Upload progress"/> : <div className="processing-track" role="status" aria-label="Processing material"><span/></div>)}</section>
    {queue.length > 0 && <ol className="upload-queue" aria-label="Material upload status">{queue.map(item => <li key={item.id}><span className="queue-filename">{item.name}</span><span className={'queue-state ' + item.status} role="status">{item.status === 'ready' ? 'Saved to your library' : item.status === 'processing' ? 'Processing material…' : item.status === 'error' ? 'Could not upload' : item.status === 'waiting' ? 'Waiting' : `Uploading ${item.progress}%`}</span></li>)}</ol>}
    <Companion state={progress === 100 ? 'processing' : uploadState} enabled={profile?.companion !== false} avatar={profile?.avatar} onHide={() => { void updateProfile({ companion: false }).catch((e: any) => notify(e.message)) }} compact/>
    {workspace.status !== 'Saved' && <div className="workspace-save-hint">Workspace progress: <SaveStatus saved={workspace}/></div>}<p className="upload-permission">Upload only materials you are allowed to use. Raw files are deleted after extraction. AI requests send lesson passages to the configured AI provider.</p>
    <section className="materials"><div className="section-heading"><div><h2>Your materials <span className="count">{docs.length}</span></h2><p className="muted">Select up to 20 materials to study together.</p></div><button className="primary" disabled={!selected.length || !workspace.ready || workspace.conflict} onClick={openWorkspace}>Open workspace{selected.length > 0 && ` (${selected.length})`}<ArrowUpRight size={18}/></button></div>
      {loading ? <Loading label="Loading your materials…"/> : docs.length === 0 ? <Empty illustration title="A fresh page, waiting for you.">Add your first lesson above to start asking, exploring, and practicing.</Empty> : <div className="document-grid">{docs.map(d => <article key={d.id} className={'document-card ' + (selected.includes(d.id) ? 'selected' : '')}><div className="doc-top"><span className={'file-icon ' + d.file_type}><FileText size={25}/></span><input type="checkbox" aria-label={`Select ${d.filename}`} checked={selected.includes(d.id)} onChange={e => { if (e.target.checked && selected.length >= 20) { notify('Select no more than 20 materials.'); return } setSelected(e.target.checked ? [...selected, d.id] : selected.filter(id => id !== d.id)) }}/></div><h3>{d.filename}</h3><p className="fine muted">{d.file_type.toUpperCase()} · {d.pages} {d.file_type === 'pptx' ? 'slides' : d.file_type === 'pdf' ? 'pages' : 'document'} · {d.char_count.toLocaleString()} characters</p><div className="doc-bottom"><span className="fine muted">{new Date(d.created_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><div><IconButton label={`Rename ${d.filename}`} onClick={() => setRename(d)}><Pencil size={16}/></IconButton><IconButton label={`Delete ${d.filename}`} onClick={() => setRemove(d)}><Trash2 size={16}/></IconButton></div></div></article>)}</div>}
    </section><div className="library-bottom"><p className="fine muted">AI can make mistakes. Verify important information with your lesson.</p><button className="text-button danger" onClick={() => setWipe(true)}>Delete my learning data</button></div>
  </main>
  {rename && <Modal title="Rename material" close={() => setRename(null)}><form onSubmit={async e => { e.preventDefault(); const filename = new FormData(e.currentTarget).get('filename'); try { await api(`/documents/${rename.id}`, { method: 'PATCH', body: JSON.stringify({ filename }) }); setRename(null); await load() } catch (err: any) { notify(err.message) } }}><label>Document name<input autoFocus name="filename" defaultValue={rename.filename} required maxLength={255}/></label><button className="primary">Save name</button></form></Modal>}
  {(remove || wipe) && <Modal title={wipe ? 'Delete all learning data?' : 'Delete this material?'} close={() => { setRemove(null); setWipe(false) }}><p>This also deletes related conversations, study sets, and attempts. This cannot be undone.{wipe && ' Your account will remain.'}</p><div className="actions"><button className="secondary" onClick={() => { setRemove(null); setWipe(false) }}>Keep my data</button><button className="primary destructive" onClick={async () => { try { await api(wipe ? '/data' : `/documents/${remove.id}`, { method: 'DELETE' }); setRemove(null); setWipe(false); await workspace.reload(); await load() } catch (e: any) { notify(e.message) } }}>Delete permanently</button></div></Modal>}
  </>
}

function Workspace() {
  const { notify, profile, updateProfile } = useApp(), location = useLocation()
  const state = useSavedState('/workspace', EMPTY_WORKSPACE)
  const [companionState, setCompanionState] = useState<CompanionState>('studying')
  const { document_ids: selected, tab, chat_id: chatId, study_set_id: studyId } = state.value
  useEffect(() => { setCompanionState('studying') }, [tab])
  const [docs, setDocs] = useState<any[]>([]), [chats, setChats] = useState<any[]>([]), [sets, setSets] = useState<any[]>([]), [attempts, setAttempts] = useState<any[]>([])
  const [saved, setSaved] = useState<any>(null), [menu, setMenu] = useState(false), [ready, setReady] = useState(false), [toolLoading, setToolLoading] = useState(false)
  const loadLists = async () => { const [c, s, a] = await Promise.all([api('/chats'), api('/study-sets'), api('/attempts')]); setChats(c); setSets(s); setAttempts(a) }
  const load = async () => { try { setDocs(await api('/documents')); await loadLists() } catch (e: any) { notify(e.message, load) } finally { setReady(true) } }
  useEffect(() => { void load() }, [])
  useEffect(() => { let active = true; if (studyId) { setToolLoading(true); api(`/study-sets/${studyId}`).then(s => { if (active) setSaved(s) }).catch(e => notify(e.message)).finally(() => { if (active) setToolLoading(false) }) } else setSaved(null); return () => { active = false } }, [studyId])
  const choose = (ids: number[]) => state.change({ ...EMPTY_WORKSPACE, document_ids: ids })
  const openStudy = async (id: number, attemptId: number | null = null) => { try { const s = await api(`/study-sets/${id}`); setSaved(s); state.change({ ...EMPTY_WORKSPACE, document_ids: s.document_ids, study_set_id: s.id, tab: s.kind, attempt_id: attemptId }); setMenu(false) } catch (e: any) { notify(e.message) } }
  return <><Header workspace openMenu={() => setMenu(!menu)}/><div className="workspace-shell"><aside className={'workspace-sidebar ' + (menu ? 'is-open' : '')}><div className="sidebar-section"><div className="sidebar-heading"><h2>Study materials</h2><Link to="/library" aria-label="Add materials"><Plus size={18}/></Link></div>{docs.length === 0 && <p className="fine muted">Your uploaded materials appear here.</p>}{docs.map(d => <label className="sidebar-document" key={d.id}><input type="checkbox" disabled={!state.ready || state.conflict} checked={selected.includes(d.id)} onChange={e => { if (e.target.checked && selected.length >= 20) { notify('Select up to 20 materials.'); return } choose(e.target.checked ? [...selected, d.id] : selected.filter(id => id !== d.id)) }}/><FileText size={16}/><span>{d.filename}</span></label>)}</div>
    <div className="sidebar-section"><div className="sidebar-heading"><h2>Conversations</h2><IconButton label="New chat" disabled={state.conflict} onClick={() => { state.change(v => ({ ...v, chat_id: null, tab: 'chat', study_set_id: null, attempt_id: null })); setMenu(false) }}><Plus size={17}/></IconButton></div>{chats.length === 0 && <p className="fine muted">Room for your first question.</p>}{chats.map(c => <button className={'history-item ' + (c.id === chatId ? 'active' : '')} key={c.id} disabled={state.conflict} onClick={() => { state.change({ ...EMPTY_WORKSPACE, document_ids: c.document_ids, chat_id: c.id }); setMenu(false) }}><MessageSquare size={15}/>{c.title}</button>)}</div>
    <div className="sidebar-section"><h2>Saved study tools</h2>{sets.length === 0 && <p className="fine muted">Generated tools are saved here.</p>}{sets.map(s => <button className="history-item" key={s.id} onClick={() => openStudy(s.id)} disabled={state.conflict}><Layers size={15}/><span>{tools.find(t => t.id === s.kind)?.label} <small>{new Date(s.created_at * 1000).toLocaleDateString()}</small></span></button>)}</div>
    {attempts.length > 0 && <div className="sidebar-section"><h2>Practice history</h2>{attempts.map(a => <button key={a.id} className="history-item" onClick={() => openStudy(a.study_set_id, a.id)} disabled={state.conflict}><GraduationCap size={15}/>{a.kind === 'test' ? 'Practice test' : 'Quiz'} · {a.submitted ? `${a.score}/${a.total}` : 'In progress'}</button>)}</div>}
    <div className="sidebar-footer"><BookOpen size={20}/><p>Small steps.<br/>Deeper understanding.</p></div></aside>
    <main id="main" className="workspace-main"><div className="workspace-title"><div><h1>Your study space</h1><p className="muted">{selected.length ? `${selected.length} material${selected.length > 1 ? 's' : ''} selected · Let’s connect the dots.` : 'Choose materials from the sidebar to get started.'}</p></div><SaveStatus saved={state}/></div>
      <div className="tool-tabs" role="tablist" aria-label="Study tools">{tools.map(t => <button role="tab" aria-selected={tab === t.id} aria-controls="tool-panel" disabled={!state.ready || state.conflict} key={t.id} onClick={() => { if (tab === t.id) return; setSaved(null); state.change(v => ({ ...v, tab: t.id, study_set_id: null, attempt_id: null })) }}><t.icon size={17}/>{t.label}</button>)}</div>
      <div id="tool-panel" role="tabpanel" className="tool-panel">{!ready || !state.ready || toolLoading ? <Loading/> : !selected.length ? <Empty title="Choose a lesson to begin.">Select your materials in the sidebar, or <Link to="/library">add a new file</Link>.</Empty> : state.conflict ? <Empty title="This workspace changed on another device.">Use “Load latest” above to continue with the newer saved progress.</Empty> : tab === 'chat' ? <ChatPanel onState={setCompanionState} key={`${selected.join(',')}:${chatId || 'new'}`} selected={selected} chatId={chatId} onChat={(id: number) => { state.change(v => ({ ...v, chat_id: id })); void loadLists() }} onUpdate={loadLists}/> : <StudyPanel onState={setCompanionState} key={`${tab}:${selected.join(',')}:${saved?.id || studyId || 'new'}`} kind={tab} selected={selected} initial={saved} onGenerated={(s) => { setSaved(s.id ? s : null); state.change(v => ({ ...v, study_set_id: s.id, attempt_id: null })) }} requestedAttempt={state.value.attempt_id} onAttempt={(id) => state.change(v => ({ ...v, attempt_id: id }))} onUpdate={loadLists}/>}</div>
      {tab !== 'test' && <Companion state={companionState} enabled={profile?.companion !== false} avatar={profile?.avatar} compact onHide={() => { void updateProfile({ companion: false }).catch((e: any) => notify(e.message)) }}/>}<p className="ai-note"><Sparkles size={13}/> AI can make mistakes. Verify important information with your lesson.</p>
    </main></div></>
}

function ChatPanel({ selected, chatId, onChat, onUpdate, onState }: any) {
  const { notify } = useApp(), [messages, setMessages] = useState<any[]>([]), [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(!!chatId)
  const controller = useRef<AbortController | null>(null), end = useRef<HTMLDivElement>(null), currentId = useRef(chatId), alive = useRef(true)
  useEffect(() => { alive.current = true; if (chatId) api(`/chats/${chatId}`).then(d => setMessages(d.messages)).catch((e: any) => notify(e.message)).finally(() => setLoading(false)); return () => { alive.current = false; controller.current?.abort() } }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [messages])
  const send = async (text: string) => {
    if (busy || !text.trim()) return
    setQuestion(''); setBusy(true); onState('processing'); controller.current = new AbortController()
    setMessages(old => [...old, { role: 'user', content: text }, { role: 'assistant', content: '', sources: [], status: 'streaming' }])
    let newId: number | null = null
    let completedState: CompanionState = 'studying'
    try {
      await streamChat({ question: text, document_ids: selected, chat_id: currentId.current }, controller.current.signal, (kind, data) => {
        if (kind === 'meta') { currentId.current = data.chat_id; newId = data.chat_id }
        if (kind === 'error') { notify(data); completedState = 'error' }
        if (kind === 'done') completedState = data.status === 'complete' ? 'ready' : data.status === 'error' ? 'error' : 'studying'
        if (['sources', 'token', 'done'].includes(kind)) setMessages(old => old.map((m, i) => i === old.length - 1 ? { ...m,
          ...(kind === 'sources' ? { sources: data } : kind === 'token' ? { content: m.content + data } : { status: data.status }) } : m))
      })
    } catch (e: any) { if (e.name !== 'AbortError') { completedState = 'error'; notify(e.message, () => { setQuestion(text) }) }; setMessages(old => old.map((m, i) => i === old.length - 1 ? { ...m, status: 'interrupted' } : m)) }
    finally { if (alive.current) { setBusy(false); onState(completedState); if (newId && newId !== chatId) onChat(newId); else void onUpdate() } }
  }
  if (loading) return <Loading label="Opening your conversation…"/>
  return <div className="chat-panel"><div className="chat-scroll">{!messages.length ? <div className="chat-welcome"><span className="chat-emblem"><Sparkles size={30}/></span><h2>Let’s make it click.</h2><p>Ask about a tricky concept, connect two ideas,<br/>or get a simpler explanation of your lesson.</p><div className="suggestions">{['What are the key ideas in this lesson?', 'Explain the main concept simply.', 'How do the key ideas connect?'].map(q => <button key={q} onClick={() => send(q)}>{q}<ArrowUpRight size={16}/></button>)}</div></div> : messages.map((m, i) => <motion.article initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={'message ' + m.role} key={i}><div className="message-label">{m.role === 'user' ? 'You' : <><Sparkles size={15}/> ASKLearn</>}</div>{m.content ? <Markdown text={m.content}/> : busy ? <span className="thinking" role="status">Reading your materials<span>…</span></span> : <p className="muted">No answer received. Try your question again.</p>}{m.role === 'assistant' && <><Sources sources={m.sources}/>{m.content && <button className="text-button fine" onClick={() => navigator.clipboard.writeText(m.content).then(() => notify('Answer copied.')).catch(() => notify('Copy is unavailable in this browser.'))}><Copy size={13}/> Copy answer</button>}{m.status && !['complete', 'streaming'].includes(m.status) && <p className="form-error fine">{m.status === 'error' ? 'This answer needs checking.' : 'Response stopped before completion.'}</p>}</>}</motion.article>)}<div ref={end}/></div>
    <form className="composer" onSubmit={e => { e.preventDefault(); void send(question) }}><textarea aria-label="Ask a question about your lesson" placeholder="What would you like to understand?" value={question} maxLength={4000} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(question) } }}/>{busy ? <IconButton label="Stop generating" onClick={() => controller.current?.abort()} type="button"><Square size={19}/></IconButton> : <button className="send-button" aria-label="Send question" disabled={!question.trim()}><Send size={19}/></button>}</form><p className="composer-note">Answers use your selected materials. Follow a source chip to check the passage.</p></div>
}

function StudyPanel({ kind, selected, initial, onUpdate, onGenerated, requestedAttempt, onAttempt, onState }: any) {
  const { notify } = useApp(), [study, setStudy] = useState<any>(initial), [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const [n, setN] = useState(kind === 'test' ? 20 : 10), [difficulty, setDifficulty] = useState('medium'), [style, setStyle] = useState('concise')
  const [types, setTypes] = useState(['mcq', 'true_false', 'identification']), [minutes, setMinutes] = useState(30)
  const info = tools.find(t => t.id === kind)!
  const descriptions: Record<string, string> = { summary: 'Find the thread running through your lesson.', reviewer: 'The important ideas, organized for your next study session.', flashcards: 'A little active recall goes a long way.', quiz: 'Find out what clicks, and what needs another look.', test: 'Give yourself a focused rehearsal. Answers stay hidden until you finish.' }
  const generate = async () => { setBusy(true); onState('processing'); try { const s = await api('/generate', { method: 'POST', body: JSON.stringify({ kind, document_ids: selected, n, difficulty, style, types }) }); if (!alive.current) return; setStudy(s); onState('ready'); onGenerated(s); void onUpdate() } catch (e: any) { if (alive.current) { onState('error'); notify(e.message, generate) } } finally { if (alive.current) setBusy(false) } }
  const exportText = () => {
    const c = study.content
    const references = '\n\n## Sources\n\n' + c.sources.map(s => `- [${s.id}] ${s.file}, location ${s.page}: ${s.excerpt}`).join('\n') + (c.sampled ? '\n\nCoverage note: sampled passages from longer materials.' : '')
    if (kind === 'summary') return `# ${c.title}\n\n${c.summary}\n\n${c.key_points.map(p => '- ' + p).join('\n')}` + references
    return `# ${c.title}\n\n${c.sections.map(s => `## ${s.heading}\n\n${s.points.map(p => '- ' + p).join('\n')}\n\nSources: ${s.source_ids.join(', ')}`).join('\n\n')}\n\n## Key terms\n\n${c.key_terms.map(t => `**${t.term}**: ${t.definition}`).join('\n\n')}` + references
  }
  return <div className="study-panel"><div className="study-heading"><span className="study-tool-icon"><info.icon size={25}/></span><div><h2>{info.label}</h2><p className="muted">{descriptions[kind]}</p></div></div>
    {!study && !busy && <div className="generator-setup"><div className="setup-fields">{['summary', 'reviewer'].includes(kind) ? <label>Detail level<select value={style} onChange={e => setStyle(e.target.value)}><option value="concise">Concise</option><option value="detailed">Detailed</option><option value="bullet points">Bullet points</option></select></label> : <><label>{kind === 'flashcards' ? 'Number of cards' : 'Number of questions'}<input type="number" min={kind === 'test' ? 20 : 3} max={40} value={n} onChange={e => setN(Number(e.target.value))}/></label>{kind !== 'flashcards' && <label>Difficulty<select value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>}{kind === 'test' && <label>Time limit (minutes)<input type="number" value={minutes} min={5} max={120} onChange={e => setMinutes(Number(e.target.value))}/></label>}</>}
    </div>{kind === 'quiz' && <fieldset><legend>Question types</legend>{[['mcq', 'Multiple choice'], ['true_false', 'True / false'], ['identification', 'Identification']].map(([id, label]) => <label className="inline-check" key={id}><input type="checkbox" checked={types.includes(id)} onChange={e => setTypes(e.target.checked ? [...types, id] : types.filter(t => t !== id))}/>{label}</label>)}</fieldset>}
    <button className="primary" onClick={generate} disabled={!types.length || n < (kind === 'test' ? 20 : 3) || n > 40 || minutes < 5 || minutes > 120}><Sparkles size={18}/> Generate {info.label.toLowerCase()}</button><p className="fine muted">Created from your selected materials. Longer lessons may use sampled passages.</p></div>}
    {busy && <Loading phase="generating" label={`Creating your ${info.label.toLowerCase()}… This can take a minute.`}/>}
    {study && <>{['summary', 'reviewer'].includes(kind) ? <div className="reading-result"><div className="result-actions"><button className="secondary" onClick={() => navigator.clipboard.writeText(exportText()).then(() => notify('Copied to clipboard.')).catch(() => notify('Copy is unavailable. Use Download instead.'))}><Copy size={16}/> Copy</button><button className="secondary" onClick={() => download(`asklearn-${kind}.md`, exportText())}><Download size={16}/> Download Markdown</button></div><h2>{study.content.title}</h2>{kind === 'summary' ? <><Markdown text={study.content.summary}/><h3>Key ideas</h3><ul>{study.content.key_points.map((p, i) => <li key={i}>{p}</li>)}</ul></> : <>{study.content.sections.map((s, i) => <section key={i}><h3>{s.heading}</h3><ul>{s.points.map((p, j) => <li key={j}>{p}</li>)}</ul><Sources sources={study.content.sources} ids={s.source_ids}/></section>)}<h3>Key terms</h3><dl>{study.content.key_terms.map((t, i) => <div key={i}><dt>{t.term}</dt><dd>{t.definition}</dd></div>)}</dl></>}<Sources sources={study.content.sources} ids={study.content.source_ids}/>{study.content.sampled && <p className="fine muted">This tool uses sampled passages from a longer lesson, so coverage is partial.</p>}</div> : kind === 'flashcards' ? <Flashcards content={study.content} studyId={study.id} onState={onState}/> : <Assessment onState={onState} study={study} minutes={minutes} onUpdate={onUpdate} requestedAttempt={requestedAttempt} onAttempt={onAttempt} Sources={Sources} Modal={Modal}/>}
    <button className="text-button regenerate" onClick={() => { setStudy(null); onGenerated({ id: null }) }}><RotateCcw size={15}/> Create another {info.label.toLowerCase()}</button></>}
  </div>
}

function Flashcards({ content, studyId, onState }: any) {
  const progress = useSavedState(`/study-sets/${studyId}/progress`, { order: content.cards.map((_, i) => i), index: 0, flipped: false, known: 0, again: [] as number[] })
  const { order, index, flipped, known, again } = progress.value
  useEffect(() => { if (progress.ready && progress.status === 'Saved') onState(index >= order.length ? 'success' : 'studying'); else if (progress.status.startsWith('Couldn’t')) onState('error') }, [progress.ready, progress.status, index, order.length, onState])
  if (!progress.ready) return <><SaveStatus saved={progress}/><Loading label="Restoring your flashcards…"/></>
  const card = content.cards[order[index]], done = index >= order.length
  const next = (got: boolean) => progress.change(v => ({ ...v, known: got ? v.known + 1 : v.known, again: got ? v.again : [...v.again, v.order[v.index]], flipped: false, index: v.index + 1 }))
  if (done) return <div className="deck-complete"><SaveStatus saved={progress}/><span className="completion-symbol"><Check size={32}/></span><h2>Another layer of understanding.</h2><p>{known} of {order.length} cards marked “Got it”. {again.length} to review again.</p><div className="actions">{again.length > 0 && <button className="primary" disabled={progress.conflict} onClick={() => progress.change({ order: again, index: 0, known: 0, again: [], flipped: false })}>Review these {again.length} cards</button>}<button className="secondary" disabled={progress.conflict} onClick={() => progress.change({ order: content.cards.map((_, i) => i), index: 0, known: 0, again: [], flipped: false })}>Restart deck</button></div></div>
  return <div className="flashcard-panel"><SaveStatus saved={progress}/><div className="deck-toolbar"><span>Card {index + 1} of {order.length}</span><button className="text-button" disabled={progress.conflict} onClick={() => { const copy = [...order.slice(index)]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]] } progress.change(v => ({ ...v, order: [...order.slice(0, index), ...copy], flipped: false })) }}><Shuffle size={16}/> Shuffle remaining</button></div><progress aria-label="Flashcard progress" max={order.length} value={index}/><button disabled={progress.conflict} className={'flashcard ' + (flipped ? 'flipped' : '')} aria-label={flipped ? 'Show flashcard question' : 'Reveal flashcard answer'} onClick={() => progress.change(v => ({ ...v, flipped: !v.flipped }))}><span className="flashcard-inner"><span className="flashcard-face"><span className="fine muted">Think it through</span><strong>{card.front}</strong><span className="fine muted">Tap to reveal</span></span><span className="flashcard-face flashcard-back"><span className="fine muted">The connection</span><strong>{card.back}</strong><span className="fine muted">Tap to return</span></span></span></button><Sources sources={content.sources} ids={card.source_ids}/><div className="actions"><button className="secondary" disabled={!flipped || progress.conflict} onClick={() => next(false)}><RotateCcw size={16}/> Review again</button><button className="primary" disabled={!flipped || progress.conflict} onClick={() => next(true)}><Check size={17}/> Got it</button></div></div>
}
