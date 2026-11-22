import { useEffect, useRef, useState } from 'react'
import { Check, X, GraduationCap, ArrowRight, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { api } from './api'
import { useApp } from './AppContext'
import { useSavedState, SaveStatus, registerSaveFlusher, trackPendingSave, waitForPendingSave } from './useSavedState'

export default function Assessment({ study, minutes, onUpdate, requestedAttempt, onAttempt, onState, Sources, Modal }: any) {
  const { notify } = useApp()
  const progress = useSavedState(`/study-sets/${study.id}/progress`, { attempt_id: null as number | null, index: 0 })
  const [attempt, setAttempt] = useState<any>(null), [answer, setAnswer] = useState(''), [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState(0), [confirm, setConfirm] = useState(false), [loading, setLoading] = useState(true)
  const [answerStatus, setAnswerStatus] = useState('Answers saved'), [conflict, setConflict] = useState(false)
  const offset = useRef(0), current = useRef<any>(null), draft = useRef(''), submitting = useRef(false), editing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), alive = useRef(true), indexRef = useRef(0)
  const answerFlight = useRef<Promise<boolean> | null>(null), flushDraft = useRef<() => Promise<boolean>>(async () => true), lastLoad = useRef(0)
  const questions = study.content.questions, index = progress.value.index
  useEffect(() => { if (attempt?.submitted) onState('success'); else if (progress.status.startsWith('Couldn’t')) onState('error') }, [attempt?.submitted, progress.status, onState])
  indexRef.current = index; draft.current = answer
  const sync = (a: any) => { current.current = a; offset.current = a.server_time * 1000 - Date.now(); if (alive.current) setAttempt(a) }
  const restore = async (id: number) => {
    await waitForPendingSave(`/attempts/${id}/answers`)
    const a = await api(`/attempts/${id}`); sync(a); setConflict(false); setAnswerStatus('Answers saved')
    const next = progress.value.attempt_id === a.id ? Math.min(progress.value.index, questions.length - 1) : 0
    progress.change({ attempt_id: a.id, index: next }); setAnswer(a.answers[String(next)] || ''); onAttempt(a.id)
  }
  useEffect(() => {
    alive.current = true
    const flush = () => flushDraft.current(), unregister = registerSaveFlusher(flush)
    const onPageHide = () => { void flush() }; window.addEventListener('pagehide', onPageHide)
    return () => { void flush(); unregister(); window.removeEventListener('pagehide', onPageHide); alive.current = false }
  }, [])
  useEffect(() => {
    if (!progress.ready) return
    const reloaded = lastLoad.current > 0 && lastLoad.current !== progress.loadRevision
    lastLoad.current = progress.loadRevision
    if (current.current && (!requestedAttempt || requestedAttempt === current.current.id) && !reloaded) return
    let active = true; setLoading(true)
    const load = async () => {
      try {
        const rows = await api('/attempts')
        const preferred = reloaded ? progress.value.attempt_id : requestedAttempt || progress.value.attempt_id
        const a = rows.find(r => r.id === preferred && r.study_set_id === study.id) || rows.find(r => r.study_set_id === study.id)
        if (a && active) await restore(a.id)
      } catch (error: any) { if (active) notify(error.message) }
      finally { if (active) setLoading(false) }
    }
    void load(); return () => { active = false }
  }, [progress.ready, requestedAttempt, progress.loadRevision])
  useEffect(() => { setAnswer(current.current?.answers[String(index)] || '') }, [index])

  const save = async (value: string, at = indexRef.current): Promise<boolean> => {
    if (answerFlight.current) return answerFlight.current
    const a = current.current
    if (!a || a.submitted || editing.current || conflict || progress.conflict) return false
    editing.current = true; setBusy(true); setAnswerStatus('Saving answer…')
    const path = `/attempts/${a.id}/answers`
    const operation = (async () => { try {
      const updated = await api(path, { method: 'PUT', body: JSON.stringify({ index: at, answer: value, version: a.version }), keepalive: true })
      sync(updated); setAnswerStatus('Answers saved'); return true
    } catch (error: any) {
      if (error.status === 409) { setConflict(true); setAnswerStatus('Answers changed on another device') }
      else { setAnswerStatus('Couldn’t save answer'); notify(error.message) }
      return false
    } finally { editing.current = false; answerFlight.current = null; setBusy(false) } })()
    answerFlight.current = operation; trackPendingSave(path, operation)
    return operation
  }
  flushDraft.current = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (answerFlight.current && !await answerFlight.current) return false
    const a = current.current
    if (study.kind === 'test' && a && !a.submitted && questions[indexRef.current].type === 'identification' && draft.current !== (a.answers[String(indexRef.current)] || '')) return save(draft.current)
    return !conflict
  }
  const edit = (value: string) => {
    setAnswer(value); draft.current = value
    if (timer.current) clearTimeout(timer.current)
    if (study.kind === 'test') { setAnswerStatus('Unsaved answer'); const at = index; timer.current = setTimeout(() => { void save(value, at) }, 600) }
  }
  const go = async (next: number) => {
    if (timer.current) clearTimeout(timer.current)
    if (study.kind === 'test' && questions[index].type === 'identification' && draft.current !== (current.current.answers[String(index)] || '')) {
      if (!await save(draft.current)) return
    }
    progress.change(v => ({ ...v, index: next }))
  }
  const submit = async () => {
    const a = current.current
    if (!a || submitting.current) return
    submitting.current = true; setBusy(true)
    if (timer.current) clearTimeout(timer.current)
    try {
      if (study.kind === 'test' && questions[indexRef.current].type === 'identification' && draft.current !== (a.answers[String(indexRef.current)] || '') && Date.now() + offset.current < a.deadline * 1000) {
        if (!await save(draft.current)) return
      }
      sync(await api(`/attempts/${a.id}/submit`, { method: 'POST' })); setConfirm(false); void onUpdate()
    } catch (error: any) { notify(error.message, submit) }
    finally { submitting.current = false; setBusy(false) }
  }
  useEffect(() => {
    if (!attempt || attempt.submitted || study.kind !== 'test') return
    const tick = () => { const left = Math.max(0, Math.ceil((current.current.deadline * 1000 - Date.now() - offset.current) / 1000)); setRemaining(left); if (!left) void submit() }
    tick(); const interval = setInterval(tick, 1000); return () => clearInterval(interval)
  }, [attempt?.id, attempt?.submitted])
  const start = async () => {
    setBusy(true)
    try { const a = await api('/attempts', { method: 'POST', body: JSON.stringify({ study_set_id: study.id, minutes }) }); sync(a); progress.change({ attempt_id: a.id, index: 0 }); setAnswer(a.answers['0'] || ''); onAttempt(a.id); void onUpdate() }
    catch (error: any) { notify(error.message, start) } finally { setBusy(false) }
  }
  if (!progress.ready || loading) return <><SaveStatus saved={progress}/><div className="loading" role="status"><span className="spinner"/>Restoring assessment…</div></>
  const locked = busy || conflict || progress.conflict
  if (!attempt) return <div className="assessment-start"><GraduationCap size={40}/><h2>A little practice. A clearer picture.</h2><p>{questions.length} questions · {study.kind === 'test' ? `${minutes} minutes · Answers after submission` : 'Feedback after each answer'}</p><button className="primary" onClick={start} disabled={locked}>{busy ? 'Preparing…' : 'Begin ' + (study.kind === 'test' ? 'practice test' : 'quiz')}<ArrowRight size={18}/></button></div>
  if (attempt.submitted) return <div className="results"><SaveStatus saved={progress}/><div className="score-display"><span>{attempt.score}<small> / {attempt.total}</small></span><h2>See how far you’ve come.</h2><p>Use the explanations to revisit the ideas that need another look.</p></div>{attempt.questions.map((q, i) => { const right = (attempt.answers[i] || '').trim().toLowerCase() === q.answer.trim().toLowerCase(); return <article className={'review-question ' + (right ? 'right' : 'wrong')} key={i}><span className="review-label">{right ? <Check size={16}/> : <X size={16}/>}Question {i + 1} · {right ? 'Correct' : 'Review this'}</span><h3>{q.question}</h3><p>Your answer: <strong>{attempt.answers[i] || 'Not answered'}</strong></p>{!right && <p>Correct answer: <strong>{q.answer}</strong></p>}<p>{q.explanation}</p><Sources sources={attempt.sources} ids={q.source_ids}/></article> })}<button className="secondary" onClick={start} disabled={locked}>Start a new attempt</button></div>
  const q = questions[index], feedback = attempt.feedback?.[String(index)], isTest = study.kind === 'test'
  return <div className="assessment"><SaveStatus saved={progress}/><div className="assessment-toolbar"><span>Question {index + 1} of {questions.length}</span>{isTest && <span className={'timer ' + (remaining < 60 ? 'urgent' : '')} role="timer" aria-label="Time remaining"><Clock size={17}/>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>}<span>{Object.keys(attempt.answers).length} answered</span></div><progress aria-label="Assessment progress" max={questions.length} value={Object.keys(attempt.answers).length}/><h3>{q.question}</h3><p className="fine muted">{q.type === 'mcq' ? 'Choose one answer' : q.type === 'true_false' ? 'True or false?' : 'Write a short answer'}</p>
    {q.type !== 'identification' ? <div className="answer-options">{(q.type === 'true_false' ? ['True', 'False'] : q.choices).map((choice, i) => <button key={choice} disabled={locked || !!feedback} aria-pressed={answer === choice} className={answer === choice ? 'chosen' : ''} onClick={() => { setAnswer(choice); if (isTest) void save(choice) }}><span>{String.fromCharCode(65 + i)}</span>{choice}{answer === choice && <Check size={18}/>}</button>)}</div> : <label>Your answer<input value={answer} maxLength={2000} disabled={locked || !!feedback} onChange={e => edit(e.target.value)}/></label>}
    <div className="answer-save-state" role="status">{answerStatus}{conflict ? <button onClick={() => restore(attempt.id)}>Load latest answers</button> : answerStatus === 'Couldn’t save answer' ? <button onClick={() => save(answer)}>Retry save</button> : null}</div>
    {feedback && <div className={'feedback ' + (feedback.correct ? 'right' : 'wrong')} role="status"><strong>{feedback.correct ? 'That’s it.' : 'Let’s revisit this one.'}</strong>{!feedback.correct && <p>Correct answer: {feedback.answer}</p>}<p>{feedback.explanation}</p><Sources sources={attempt.sources} ids={feedback.source_ids}/></div>}
    <div className="assessment-actions"><button className="secondary" disabled={index === 0 || locked} onClick={() => go(index - 1)}><ChevronLeft size={16}/> Previous</button>{!isTest && !feedback && <button className="primary" disabled={!answer.trim() || locked} onClick={() => save(answer)}>Check answer</button>}{(isTest || feedback) && index < questions.length - 1 && <button className="primary" disabled={locked} onClick={() => go(index + 1)}>Next question<ChevronRight size={16}/></button>}{(isTest || feedback) && index === questions.length - 1 && <button className="primary" disabled={locked} onClick={() => setConfirm(true)}>Finish and see results</button>}</div>
    {isTest && <p className="fine muted">Your deadline continues across devices. Written answers save after a short pause; check “Answers saved” before leaving.</p>}
    {confirm && <Modal title="Submit your answers?" close={() => setConfirm(false)}><p>{questions.length - Object.keys(attempt.answers).length} unanswered question(s). You can review results after submitting.</p><div className="actions"><button className="secondary" onClick={() => setConfirm(false)}>Keep working</button><button className="primary" onClick={submit} disabled={busy}>Submit answers</button></div></Modal>}
  </div>
}
