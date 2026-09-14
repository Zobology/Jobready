import { useState } from 'react'
import { ArrowRight, Bot, CalendarDays, CheckCircle2, Clock3, Sparkles, UserRoundCheck } from 'lucide-react'
import { coachingHours, validateCoachingSelection, type CoachingPlan, type CoachingPlanInput, type ExpertPreference } from './coaching'
import type { CoachingSessionProgress, PortalSubmission } from './portalTypes'

const planDescriptions: Record<number, string> = {
  2: 'Focused interview preparation with one AI practice hour and one mandatory industry-expert rehearsal.',
  4: 'A compact plan for the highest-priority readiness gaps.',
  8: 'Structured practice and expert guidance across several development areas.',
  16: 'A deeper role-readiness pathway with repeated application and feedback.',
  24: 'Comprehensive coaching for sustained skill-building and job preparation.',
}

function existingPreferences(plan?: CoachingPlan): ExpertPreference[] {
  return plan?.sessions.filter((session) => session.mode === 'expert').map((session) => ({
    date: session.preferredDate ?? '',
    time: session.preferredTime ?? '',
  })) ?? []
}

function AiModuleProgress({ planId, sessionId, progress, onSave }: { planId: string; sessionId: string; progress?: CoachingSessionProgress; onSave: (planId: string, sessionId: string, progressPercent: number) => Promise<void> }) {
  const [value, setValue] = useState(progress?.progressPercent ?? 0)
  const [saving, setSaving] = useState(false)
  async function save() { setSaving(true); try { await onSave(planId, sessionId, value) } finally { setSaving(false) } }
  return <div className="ai-module-progress"><label><span>Module progress</span><input type="range" min="0" max="100" step="10" value={value} onChange={(event) => setValue(Number(event.target.value))} /><b>{value}%</b></label><button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : value === 100 ? 'Save as completed' : 'Save progress'}</button></div>
}

export function CoachingPlanner({ submission, progress, onSave, onSaveProgress }: { submission: PortalSubmission; progress: CoachingSessionProgress[]; onSave: (input: CoachingPlanInput) => Promise<void>; onSaveProgress: (planId: string, sessionId: string, progressPercent: number) => Promise<void> }) {
  const existing = submission.coachingPlan
  const [editing, setEditing] = useState(!existing)
  const [totalHours, setTotalHours] = useState<CoachingPlanInput['totalHours']>(existing?.totalHours ?? 2)
  const [expertHours, setExpertHours] = useState(existing?.expertHours ?? 1)
  const [preferences, setPreferences] = useState<ExpertPreference[]>(existingPreferences(existing))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function chooseExpertHours(hours: number) {
    setExpertHours(hours)
    setPreferences((current) => Array.from({ length: hours }, (_, index) => current[index] ?? { date: '', time: '' }))
  }

  function choosePlan(hours: CoachingPlanInput['totalHours']) {
    setTotalHours(hours)
    chooseExpertHours(hours === 2 ? 1 : Math.max(1, Math.min(expertHours, hours - 1)))
    setError('')
  }

  function updatePreference(index: number, field: keyof ExpertPreference, value: string) {
    setPreferences((current) => current.map((preference, position) => position === index ? { ...preference, [field]: value } : preference))
  }

  function editPlan() {
    setPreferences((current) => Array.from({ length: expertHours }, (_, index) => current[index] ?? { date: '', time: '' }))
    setEditing(true)
  }

  async function save() {
    const input = { totalHours, expertHours, expertPreferences: preferences }
    const validationError = validateCoachingSelection(input)
    if (validationError) { setError(validationError); return }
    setBusy(true)
    setError('')
    try {
      await onSave(input)
      setEditing(false)
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (existing?.status === 'under_review' && !editing) {
    return <section className="coaching-module coaching-review-pending"><div className="coaching-heading"><div><span className="eyebrow"><i /> Roadmap governance</span><h2>Your coaching roadmap is under review</h2><p>An industry mentor or Zobology admin is reviewing the AI-curated sequence before it is shared with you. Your selected mix is {existing.aiHours} AI self-paced hours and {existing.expertHours} industry-expert hours.</p></div><Clock3 /></div><div className="coaching-governance"><CheckCircle2 /><span><strong>Selection received</strong>The approved roadmap will appear here after quality review.</span></div><div className="coaching-actions"><button className="secondary-button" onClick={editPlan}>Change selection</button></div></section>
  }

  if (existing?.status === 'published' && !editing) {
    return (
      <section className="coaching-module coaching-plan-view">
        <div className="coaching-heading"><div><span className="eyebrow"><i /> Personalized coaching</span><h2>Your coaching pathway</h2><p>{existing.summary}</p></div><button className="secondary-button" onClick={editPlan}>Change plan</button></div>
        <div className="coaching-plan-summary">
          <article><Clock3 /><span><strong>{existing.totalHours} hours</strong><small>Total coaching</small></span></article>
          <article><Bot /><span><strong>{existing.aiHours} hours</strong><small>AI self-paced modules</small></span></article>
          <article><UserRoundCheck /><span><strong>{existing.expertHours} hours</strong><small>Industry expert</small></span></article>
        </div>
        <div className="coaching-content-grid">
          <div className="coaching-focus"><span className="section-label">Priorities from your evaluation</span>{existing.focusAreas.map((area) => <article key={area.competency}><i>{area.score}</i><div><strong>{area.competency}</strong><p>{area.rationale}</p></div></article>)}</div>
          <div className="coaching-sessions"><span className="section-label">One-hour session roadmap</span>{existing.sessions.map((session) => <article key={session.id}><i>{session.mode === 'expert' ? <UserRoundCheck /> : <Bot />}</i><div><small>Session {session.sequence} · {session.mode === 'expert' ? 'Industry expert' : 'AI self-paced'}</small><strong>{session.title}</strong><p>{session.objective}</p><ul>{session.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul>{session.preferredDate && <em><CalendarDays /> Preferred: {new Date(`${session.preferredDate}T${session.preferredTime}`).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</em>}{session.mode === 'ai' && <AiModuleProgress planId={existing.id} sessionId={session.id} progress={progress.find((item) => item.coachingPlanId === existing.id && item.sessionId === session.id)} onSave={onSaveProgress} />}</div></article>)}</div>
        </div>
      </section>
    )
  }

  return (
    <section className="coaching-module">
      <div className="coaching-heading"><div><span className="eyebrow"><i /> Next step</span><h2>Build your personalized coaching plan</h2><p>Choose your coaching time. Your pathway will be curated from your AI evaluation and mentor-validated feedback for {submission.role.name} in {submission.industry.name}.</p></div><Sparkles /></div>
      <div className="coaching-plan-options">{coachingHours.map((hours) => <button key={hours} className={totalHours === hours ? 'selected' : ''} onClick={() => choosePlan(hours)}><strong>{hours} hours</strong><span>{hours === 2 ? 'Interview prep' : 'Personalized plan'}</span><small>{planDescriptions[hours]}</small></button>)}</div>
      <div className="coaching-ratio">
        <div><span className="section-label">Choose your coaching mix</span><h3>{totalHours - expertHours} AI self-paced hours + {expertHours} industry-expert hours</h3><p>{totalHours === 2 ? 'This interview plan always includes one expert session.' : 'Every roadmap includes both AI learning modules and industry-expert coaching.'}</p></div>
        {totalHours !== 2 && <label><span>Industry-expert hours</span><input type="range" min="1" max={totalHours - 1} step="1" value={expertHours} onChange={(event) => chooseExpertHours(Number(event.target.value))} /><b>{expertHours}</b></label>}
      </div>
      {expertHours > 0 && <div className="expert-calendar"><div><span className="section-label">Expert session preferences</span><h3>Choose a different day for each one-hour session</h3><p>These are preferred slots. The matched expert will confirm availability.</p></div><div className="expert-slot-grid">{preferences.map((preference, index) => <article key={index}><span><CalendarDays /> Expert session {index + 1}</span><label>Date<input type="date" min={new Date().toISOString().slice(0, 10)} value={preference.date} onChange={(event) => updatePreference(index, 'date', event.target.value)} /></label><label>Time<input type="time" value={preference.time} onChange={(event) => updatePreference(index, 'time', event.target.value)} /></label><small>Duration: 1 hour</small></article>)}</div></div>}
      {error && <p className="coaching-error">{error}</p>}
      <div className="coaching-actions">{existing && <button className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>}<button className="primary-button compact" disabled={busy} onClick={save}>{busy ? 'Curating your plan…' : totalHours === 2 ? 'Create my interview plan' : 'Submit roadmap for review'} <ArrowRight /></button></div>
      <div className="coaching-governance"><CheckCircle2 /><span><strong>{totalHours === 2 ? 'Evaluation-led personalization' : 'Mentor/admin review required'}</strong>{totalHours === 2 ? 'Your plan prioritizes demonstrated gaps and preserves mentor-validated assessment feedback.' : 'Your AI-curated roadmap remains hidden until an industry mentor or admin reviews and approves it.'}</span></div>
    </section>
  )
}
