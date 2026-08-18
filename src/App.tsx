import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clock3,
  GraduationCap,
  Lightbulb,
  Mic,
  Menu,
  RotateCcw,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import {
  buildAssessment,
  educationOptions,
  industries,
  levelOptions,
  roles,
  type Dimension,
  type Industry,
  type Question,
  type RoleFamily,
} from './data'
import { ReviewQueue, ReviewWorkspace, SubmissionConfirmation } from './HumanReview'
import type { AssessmentAnswer, CandidateProfile, HumanReview } from './reviewTypes'

type Screen = 'profile' | 'assessment' | 'submitted' | 'reviewQueue' | 'review' | 'results'

interface Submission {
  id: string
  submittedAt: string
  profile: CandidateProfile
  role: RoleFamily
  industry: Industry
  questions: Question[]
  answers: Record<string, AssessmentAnswer>
}

const initialProfile: CandidateProfile = {
  name: '',
  education: '',
  experienceType: 'fresher',
  experienceYears: '',
  roleId: '',
  industryId: '',
  level: 'Entry level',
  resumeName: '',
}

const dimensionNames: Record<Dimension, string> = {
  core: 'Core employability',
  role: 'Role capability',
  industry: 'Industry context',
  simulation: 'Job simulation',
}

function App() {
  const [screen, setScreen] = useState<Screen>('profile')
  const [profile, setProfile] = useState<CandidateProfile>(initialProfile)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({})
  const [mobileMenu, setMobileMenu] = useState(false)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [review, setReview] = useState<HumanReview>({
    id: 'REV-0001',
    reviewerName: 'Industry Expert 01',
    status: 'accepted',
    questionReviews: {},
  })

  const role = roles.find((item) => item.id === profile.roleId) ?? roles[3]
  const industry = industries.find((item) => item.id === profile.industryId) ?? industries[1]
  const questions = useMemo(() => buildAssessment(role, industry), [role, industry])
  const reviewedAnswers = useMemo(() => {
    if (!submission) return {}
    return Object.fromEntries(submission.questions.map((question) => {
      const answer = submission.answers[question.id]
      const questionReview = review.questionReviews[question.id]
      const criterionScores = question.rubric.map((criterion) => questionReview?.criteria[criterion]?.score).filter((score): score is 1 | 2 | 3 | 4 => Boolean(score))
      const humanScore = criterionScores.length === question.rubric.length
        ? Math.round((criterionScores.reduce((sum, score) => sum + score, 0) / criterionScores.length) * 25)
        : answer?.score ?? 0
      return [question.id, { ...answer, score: humanScore, feedback: questionReview?.comment || 'Reviewed against the competency rubric by an industry expert.' }]
    }))
  }, [review, submission])

  function beginAssessment() {
    setQuestionIndex(0)
    setAnswers({})
    setSubmission(null)
    setReviewIndex(0)
    setReview({ id: `REV-${String(Date.now()).slice(-6)}`, reviewerName: 'Industry Expert 01', status: 'accepted', questionReviews: {} })
    setScreen('assessment')
    window.scrollTo(0, 0)
  }

  function reset() {
    setProfile(initialProfile)
    setAnswers({})
    setQuestionIndex(0)
    setScreen('profile')
    window.scrollTo(0, 0)
  }

  function submitAssessment() {
    const submittedAt = new Date().toISOString()
    setSubmission({
      id: `ZOB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      submittedAt,
      profile: { ...profile },
      role,
      industry,
      questions,
      answers: { ...answers },
    })
    setReview({ id: `REV-${String(Date.now()).slice(-6)}`, reviewerName: 'Industry Expert 01', status: 'accepted', questionReviews: {} })
    setScreen('submitted')
    window.scrollTo(0, 0)
  }

  return (
    <div className="app-shell">
      <Header
        screen={screen}
        mobileMenu={mobileMenu}
        setMobileMenu={setMobileMenu}
        onReset={reset}
        onReviewQueue={() => { setScreen('reviewQueue'); setMobileMenu(false); window.scrollTo(0, 0) }}
      />
      <main>
        {screen === 'profile' && (
          <ProfileBuilder profile={profile} setProfile={setProfile} onContinue={beginAssessment} />
        )}
        {screen === 'assessment' && (
          <Assessment
            questions={questions}
            currentIndex={questionIndex}
            answers={answers}
            roleName={role.name}
            industryName={industry.name}
            onAnswer={(questionId, answer) => setAnswers((current) => ({ ...current, [questionId]: answer }))}
            onBack={() => {
              if (questionIndex === 0) setScreen('profile')
              else setQuestionIndex((current) => current - 1)
            }}
            onNext={() => {
              if (questionIndex === questions.length - 1) {
                submitAssessment()
              } else {
                setQuestionIndex((current) => current + 1)
              }
            }}
          />
        )}
        {screen === 'submitted' && submission && (
          <SubmissionConfirmation
            profile={submission.profile}
            role={submission.role}
            industry={submission.industry}
            submissionId={submission.id}
            submittedAt={submission.submittedAt}
            review={review}
            onOpenReview={() => { setReviewIndex(0); setScreen('review') }}
            onViewResults={() => setScreen('results')}
          />
        )}
        {screen === 'reviewQueue' && (
          <ReviewQueue
            hasSubmission={Boolean(submission)}
            profile={submission?.profile ?? profile}
            role={submission?.role ?? role}
            industry={submission?.industry ?? industry}
            submissionId={submission?.id ?? '—'}
            submittedAt={submission?.submittedAt ?? new Date().toISOString()}
            review={review}
            totalQuestions={submission?.questions.length ?? 0}
            onOpen={() => { if (submission) { setReviewIndex(0); setScreen('review') } }}
          />
        )}
        {screen === 'review' && submission && (
          <ReviewWorkspace
            profile={submission.profile}
            role={submission.role}
            industry={submission.industry}
            questions={submission.questions}
            answers={submission.answers}
            review={review}
            currentIndex={reviewIndex}
            onSelect={setReviewIndex}
            onChange={setReview}
            onExit={() => setScreen('reviewQueue')}
            onFinalize={() => {
              setReview((current) => ({ ...current, status: 'completed', completedAt: new Date().toISOString() }))
              setScreen('submitted')
              window.scrollTo(0, 0)
            }}
          />
        )}
        {screen === 'results' && submission && review.status === 'completed' && (
          <Results
            profile={submission.profile}
            role={submission.role}
            industry={submission.industry}
            questions={submission.questions}
            answers={reviewedAnswers}
            reviewerName={review.reviewerName}
            onRetake={beginAssessment}
          />
        )}
      </main>
    </div>
  )
}

function Header({
  screen,
  mobileMenu,
  setMobileMenu,
  onReset,
  onReviewQueue,
}: {
  screen: Screen
  mobileMenu: boolean
  setMobileMenu: (open: boolean) => void
  onReset: () => void
  onReviewQueue: () => void
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onReset} aria-label="Zobology home">
        <span className="brand-mark"><TrendingUp size={19} strokeWidth={2.5} /></span>
        <span>Zobo<span>logy</span></span>
      </button>
      <nav className={mobileMenu ? 'topnav open' : 'topnav'} aria-label="Primary navigation">
        <button className={['profile', 'assessment', 'submitted', 'results'].includes(screen) ? 'active' : ''} onClick={onReset}>Assessment</button>
        <button className={['reviewQueue', 'review'].includes(screen) ? 'active' : ''} onClick={onReviewQueue}>Review queue</button>
        <button disabled>Benchmarks</button>
      </nav>
      <div className="header-actions">
        <span className="beta-badge"><CheckCircle2 size={12} /> Human reviewed</span>
        <button className="profile-button" aria-label="User profile"><CircleUserRound size={22} /></button>
        <button className="menu-button" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  )
}

export function ProfileBuilder({
  profile,
  setProfile,
  onContinue,
}: {
  profile: CandidateProfile
  setProfile: (profile: CandidateProfile) => void
  onContinue: () => void
}) {
  const role = roles.find((item) => item.id === profile.roleId)
  const industry = industries.find((item) => item.id === profile.industryId)
  const isValid = Boolean(profile.name.trim() && profile.education && profile.roleId && profile.industryId)

  function update<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile({ ...profile, [key]: value })
  }

  return (
    <div className="profile-page">
      <section className="profile-intro">
        <div className="eyebrow"><span /> Personalized assessment</div>
        <h1>Your target defines<br />your <em>readiness.</em></h1>
        <p>Tell us where you want to go. We’ll build an assessment around the exact capabilities employers expect for that role and industry.</p>

        <div className="architecture-line" aria-label="Assessment architecture">
          <div><span>01</span><strong>Core</strong><small>Workplace essentials</small></div>
          <i />
          <div><span>02</span><strong>Role</strong><small>Functional capability</small></div>
          <i />
          <div><span>03</span><strong>Industry</strong><small>Business context</small></div>
        </div>

        <div className="trust-note">
          <div className="trust-icon"><Target size={21} /></div>
          <div><strong>Not another generic aptitude test</strong><span>Every question is selected against your target job profile.</span></div>
        </div>
      </section>

      <section className="profile-card">
        <div className="card-heading">
          <div><span>Step 1 of 3</span><h2>Build your job profile</h2></div>
          <div className="step-dots"><i className="active" /><i /><i /></div>
        </div>

        <div className="form-grid">
          <label className="field full">
            <span>What should we call you?</span>
            <input value={profile.name} onChange={(event) => update('name', event.target.value)} placeholder="Enter your first name" />
          </label>

          <label className="field full">
            <span>Highest education</span>
            <div className="select-wrap">
              <select value={profile.education} onChange={(event) => update('education', event.target.value)}>
                <option value="" disabled>Select your qualification</option>
                {educationOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
              <ChevronDown size={18} />
            </div>
          </label>

          <fieldset className="field full">
            <legend>Where are you in your career?</legend>
            <div className="career-toggle">
              <button className={profile.experienceType === 'fresher' ? 'selected' : ''} onClick={() => update('experienceType', 'fresher')} type="button">
                <GraduationCap size={20} /><span><strong>Fresher</strong><small>0–1 year experience</small></span><i>{profile.experienceType === 'fresher' && <Check size={12} />}</i>
              </button>
              <button className={profile.experienceType === 'experienced' ? 'selected' : ''} onClick={() => update('experienceType', 'experienced')} type="button">
                <BriefcaseBusiness size={20} /><span><strong>Experienced</strong><small>1+ years experience</small></span><i>{profile.experienceType === 'experienced' && <Check size={12} />}</i>
              </button>
            </div>
          </fieldset>

          {profile.experienceType === 'experienced' && (
            <>
              <label className="field">
                <span>Years of experience</span>
                <input type="number" min="1" max="40" value={profile.experienceYears} onChange={(event) => update('experienceYears', event.target.value)} placeholder="e.g. 3" />
              </label>
              <label className="field upload-field">
                <span>Resume <small>Optional</small></span>
                <div className="upload-control">
                  <Upload size={17} />
                  <span>{profile.resumeName || 'Upload PDF or DOCX'}</span>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(event) => {
                    const file = event.target.files?.[0]
                    setProfile({ ...profile, resumeName: file?.name ?? '', resumeFile: file })
                  }} />
                </div>
              </label>
            </>
          )}

          <label className="field">
            <span>Target role family</span>
            <div className="select-wrap">
              <select value={profile.roleId} onChange={(event) => update('roleId', event.target.value)}>
                <option value="" disabled>Choose a role</option>
                {roles.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <ChevronDown size={18} />
            </div>
          </label>

          <label className="field">
            <span>Target industry</span>
            <div className="select-wrap">
              <select value={profile.industryId} onChange={(event) => update('industryId', event.target.value)}>
                <option value="" disabled>Choose an industry</option>
                {industries.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
              <ChevronDown size={18} />
            </div>
          </label>

          <label className="field full">
            <span>Target level</span>
            <div className="level-options">
              {levelOptions.map((level) => (
                <button key={level} type="button" className={profile.level === level ? 'selected' : ''} onClick={() => update('level', level)}>{level}</button>
              ))}
            </div>
          </label>
        </div>

        {role && industry && (
          <div className="profile-preview">
            <div className="preview-icon"><Zap size={18} /></div>
            <div><span>Your assessment</span><strong>{industry.name} · {role.name}</strong></div>
            <div className="weight-mini" title="Role-specific weights">
              <span style={{ width: `${role.coreWeight}%` }} />
              <span style={{ width: `${role.roleWeight}%` }} />
              <span style={{ width: `${role.industryWeight}%` }} />
            </div>
            <small>{role.coreWeight}% / {role.roleWeight}% / {role.industryWeight}%</small>
          </div>
        )}

        <button className="primary-button" disabled={!isValid} onClick={onContinue}>
          Build my assessment <ArrowRight size={18} />
        </button>
        <p className="privacy-copy">Your information is private and used only to personalize your assessment.</p>
      </section>
    </div>
  )
}

export function Assessment({
  questions,
  currentIndex,
  answers,
  roleName,
  industryName,
  onAnswer,
  onBack,
  onNext,
}: {
  questions: Question[]
  currentIndex: number
  answers: Record<string, AssessmentAnswer>
  roleName: string
  industryName: string
  onAnswer: (questionId: string, answer: AssessmentAnswer) => void
  onBack: () => void
  onNext: () => void
}) {
  const question = questions[currentIndex]
  const response = answers[question.id]
  const progress = ((currentIndex + 1) / questions.length) * 100
  const groupIndex = question.dimension === 'core' ? 1 : question.dimension === 'role' ? 2 : question.dimension === 'industry' ? 3 : 4

  return (
    <div className="assessment-page">
      <aside className="assessment-sidebar">
        <div className="assessment-meta">
          <span>Your assessment</span>
          <strong>{roleName}</strong>
          <small>{industryName} · Entry level</small>
        </div>
        <div className="section-list">
          {(['core', 'role', 'industry', 'simulation'] as Dimension[]).map((dimension, index) => {
            const groupQuestions = questions.filter((item) => item.dimension === dimension)
            const answered = groupQuestions.filter((item) => answers[item.id] !== undefined).length
            const isActive = question.dimension === dimension
            const isComplete = answered === groupQuestions.length
            return (
              <div className={isActive ? 'active' : isComplete ? 'complete' : ''} key={dimension}>
                <i>{isComplete ? <Check size={13} /> : index + 1}</i>
                <span><strong>{dimensionNames[dimension]}</strong><small>{answered} of {groupQuestions.length} complete</small></span>
              </div>
            )
          })}
        </div>
        <div className="sidebar-tip"><Lightbulb size={18} /><p><strong>Answer honestly.</strong> This is a diagnostic, not a pass-or-fail test.</p></div>
      </aside>

      <section className="question-stage">
        <div className="mobile-progress"><span>Section {groupIndex} of 4</span><strong>{Math.round(progress)}% complete</strong></div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        <div className="question-topline">
          <span className={`dimension-chip ${question.dimension}`}>{dimensionNames[question.dimension]}</span>
          <span>Question {currentIndex + 1} of {questions.length}</span>
        </div>

        <div className="question-card">
          <div className="question-context"><Sparkles size={14} /> {question.context}</div>
          <h1>{question.prompt}</h1>
          <p>{question.guidance}</p>

          {question.responseType === 'audio' ? (
            <AudioResponse
              question={question}
              value={response}
              onChange={(answer) => onAnswer(question.id, answer)}
            />
          ) : (
            <WrittenResponse
              question={question}
              value={response?.text ?? ''}
              onChange={(text) => onAnswer(question.id, evaluateWrittenResponse(question, text))}
            />
          )}

          <div className="analysis-rubric">
            <div><Sparkles size={15} /><span><strong>Expert review criteria</strong><small>Your response is evaluated as evidence—not against a fixed answer.</small></span></div>
            <div className="rubric-tags">
              {question.rubric.map((criterion) => <span key={criterion}>{criterion}</span>)}
            </div>
          </div>
        </div>

        <div className="question-navigation">
          <button className="secondary-button" onClick={onBack}><ArrowLeft size={17} /> Back</button>
          <span><Clock3 size={15} /> About {Math.max(1, Math.ceil((questions.length - currentIndex) * 0.6))} min left</span>
          <button className="primary-button compact" disabled={!isResponseComplete(question, response)} onClick={onNext}>
            {currentIndex === questions.length - 1 ? 'Submit assessment' : 'Next question'} <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  )
}

function WrittenResponse({
  question,
  value,
  onChange,
}: {
  question: Question
  value: string
  onChange: (value: string) => void
}) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0

  return (
    <div className="written-response">
      <div className="response-label"><span>Your response</span><small>{words} words</small></div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Write your ${question.competency.toLowerCase()} response here…`}
        rows={7}
      />
      <div className="writing-helper"><Lightbulb size={14} /> Focus on what you would do, why you would do it, and how you would measure success.</div>
    </div>
  )
}

function AudioResponse({ question, value, onChange }: { question: Question; value?: AssessmentAnswer; onChange: (answer: AssessmentAnswer) => void }) {
  const [recording, setRecording] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const secondsRef = useRef(0)

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => {
      secondsRef.current += 1
      setSeconds(secondsRef.current)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not supported in this browser. Try a current version of Chrome, Edge, or Safari.')
      return
    }
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      secondsRef.current = 0
      setSeconds(0)
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        const duration = Math.max(1, secondsRef.current)
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const audioUrl = URL.createObjectURL(blob)
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        try {
          onChange(await analyzeAudioResponse(blob, audioUrl, duration, question.competency, question.rubric))
        } finally {
          setAnalyzing(false)
        }
      }
      recorder.start()
      setRecording(true)
    } catch {
      setError('Microphone access was not granted. Allow microphone access in your browser and try again.')
    }
  }

  function stopRecording() {
    setAnalyzing(true)
    recorderRef.current?.stop()
    setRecording(false)
  }

  const displayedSeconds = recording ? seconds : value?.duration ?? 0
  const time = `${String(Math.floor(displayedSeconds / 60)).padStart(2, '0')}:${String(displayedSeconds % 60).padStart(2, '0')}`

  return (
    <div className={recording ? 'audio-response recording' : 'audio-response'}>
      <div className="audio-visual">
        <div className="mic-orb">{recording ? <Square size={18} fill="currentColor" /> : <Mic size={24} />}</div>
        <div className="waveform" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, index) => <i key={index} style={{ '--bar': `${8 + ((index * 7) % 22)}px` } as React.CSSProperties} />)}
        </div>
        <strong>{time}</strong>
      </div>
      <div className="audio-actions">
        {recording ? (
          <button type="button" className="stop-recording" onClick={stopRecording}><Square size={13} fill="currentColor" /> Stop recording</button>
        ) : analyzing ? (
          <button type="button" className="analyzing-recording" disabled><Sparkles size={14} /> Analyzing response…</button>
        ) : (
          <button type="button" className="start-recording" onClick={startRecording}><Mic size={15} /> {value?.audioUrl ? 'Record again' : 'Start recording'}</button>
        )}
        {value?.audioUrl && !recording && <audio controls src={value.audioUrl}>Your browser does not support audio playback.</audio>}
      </div>
      {error && <p className="recording-error">{error}</p>}
      <div className="audio-note"><Sparkles size={14} /><span><strong>{question.competency} review</strong>Your recording will be reviewed against the displayed competency rubric and response evidence.</span></div>
    </div>
  )
}

function isResponseComplete(question: Question, answer?: AssessmentAnswer) {
  if (!answer) return false
  return question.responseType === 'audio' ? Boolean(answer.audioUrl && (answer.duration ?? 0) >= 1) : (answer.text?.trim().split(/\s+/).length ?? 0) >= 8
}

async function analyzeAudioResponse(blob: Blob, audioUrl: string, duration: number, competency: string, rubric: string[]): Promise<AssessmentAnswer> {
  const endpoint = import.meta.env.VITE_ANALYSIS_API_URL as string | undefined
  if (endpoint) {
    try {
      const form = new FormData()
      form.append('audio', blob, `communication-response.${blob.type.includes('ogg') ? 'ogg' : 'webm'}`)
      form.append('duration', String(duration))
      form.append('competency', competency)
      form.append('rubric', JSON.stringify(rubric))
      const response = await fetch(`${endpoint.replace(/\/$/, '')}/audio`, { method: 'POST', body: form })
      if (!response.ok) throw new Error('Analysis request failed')
      const analysis = await response.json() as { score: number; feedback: string; transcript?: string }
      if (!Number.isFinite(analysis.score) || !analysis.feedback) throw new Error('Invalid analysis response')
      return { audioUrl, duration, transcript: analysis.transcript, score: Math.max(0, Math.min(100, Math.round(analysis.score))), feedback: analysis.feedback }
    } catch {
      const fallback = evaluateAudioFallback(audioUrl, duration)
      return { ...fallback, feedback: `${fallback.feedback} Live AI analysis was unavailable, so this is provisional feedback.` }
    }
  }
  return evaluateAudioFallback(audioUrl, duration)
}

function evaluateAudioFallback(audioUrl: string, duration: number): AssessmentAnswer {
  if (duration < 20) {
    return { audioUrl, duration, score: 48, feedback: 'Your response was captured, but it was too brief to demonstrate a complete situation–impact–action structure.' }
  }
  if (duration < 45) {
    return { audioUrl, duration, score: 66, feedback: 'You communicated the core message concisely. Add a clearer impact statement and explicit next step to strengthen the update.' }
  }
  if (duration <= 100) {
    return { audioUrl, duration, score: 82, feedback: 'Your response length supports a clear workplace update. The next analysis step should examine delivery, structure, and action language in the transcript.' }
  }
  return { audioUrl, duration, score: 70, feedback: 'Your response contains enough evidence, but is longer than the target. Prioritize the decision, impact, and next action earlier.' }
}

function evaluateWrittenResponse(question: Question, text: string): AssessmentAnswer {
  const normalized = text.toLowerCase()
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const hasStructure = /\b(first|then|next|finally|because|therefore|however|step)\b/.test(normalized)
  const hasEvidence = /\b(data|metric|measure|baseline|trend|compare|evidence|kpi|percent|rate)\b/.test(normalized)
  const hasAction = /\b(action|recommend|implement|test|review|prioritize|monitor|communicate|investigate)\b/.test(normalized)
  let score = words < 8 ? 15 : words < 35 ? 45 : words < 70 ? 62 : 72
  if (hasStructure) score += 7
  if (hasEvidence) score += 7
  if (hasAction) score += 7
  score = Math.min(94, score)

  const missing: string[] = []
  if (!hasStructure) missing.push('make the sequence of your reasoning clearer')
  if (!hasEvidence) missing.push('name the evidence or measures you would use')
  if (!hasAction) missing.push('state a concrete action or recommendation')
  const feedback = words < 35
    ? 'Your response needs more evidence to demonstrate independent workplace application.'
    : missing.length
      ? `Your approach is relevant. To strengthen it, ${missing.slice(0, 2).join(' and ')}.`
      : `Your response demonstrates a structured, evidence-led approach across ${question.rubric.slice(0, 2).join(' and ').toLowerCase()}.`

  return { text, score, feedback }
}

export function Results({
  profile,
  role,
  industry,
  questions,
  answers,
  reviewerName,
  onRetake,
}: {
  profile: CandidateProfile
  role: (typeof roles)[number]
  industry: (typeof industries)[number]
  questions: Question[]
  answers: Record<string, AssessmentAnswer>
  reviewerName: string
  onRetake: () => void
}) {
  const scores = useMemo(() => {
    const average = (dimension: Dimension) => {
      const items = questions.filter((item) => item.dimension === dimension)
      return Math.round(items.reduce((sum, item) => sum + (answers[item.id]?.score ?? 0), 0) / Math.max(items.length, 1))
    }
    const core = average('core')
    const roleScore = average('role')
    const industryScore = average('industry')
    const simulation = average('simulation')
    const base = (core * role.coreWeight + roleScore * role.roleWeight + industryScore * role.industryWeight) / 100
    const overall = Math.round(base * 0.9 + simulation * 0.1)
    return { core, role: roleScore, industry: industryScore, simulation, overall }
  }, [answers, questions, role])

  const benchmark = profile.level === 'Entry level' ? 70 : profile.level === 'Associate' ? 75 : profile.level === 'Mid-level' ? 80 : 85
  const competencyTotals = questions
    .filter((question) => question.dimension !== 'simulation')
    .reduce((totals, question) => {
      const dimension = question.dimension as Exclude<Dimension, 'simulation'>
      const key = `${question.dimension}-${question.competency}`
      const current = totals.get(key) ?? { name: question.competency, dimension, total: 0, count: 0 }
      totals.set(key, { ...current, total: current.total + (answers[question.id]?.score ?? 0), count: current.count + 1 })
      return totals
    }, new Map<string, { name: string; dimension: Exclude<Dimension, 'simulation'>; total: number; count: number }>())
  const itemScores = [...competencyTotals.values()].map((item) => ({
    name: item.name,
    dimension: item.dimension,
    score: Math.round(item.total / item.count),
  }))
  const strengths = [...itemScores].sort((a, b) => b.score - a.score).slice(0, 3)
  const strengthKeys = new Set(strengths.map((item) => `${item.dimension}-${item.name}`))
  const gaps = [...itemScores].sort((a, b) => a.score - b.score).filter((item) => !strengthKeys.has(`${item.dimension}-${item.name}`)).slice(0, 3)
  const hasBenchmarkGap = gaps.some((item) => item.score < benchmark)
  const benchmarkGap = benchmark - scores.overall
  const level = scores.overall >= benchmark + 10 ? 'Job ready' : scores.overall >= benchmark ? 'Nearly ready' : scores.overall >= 50 ? 'Developing' : 'Building foundations'
  const firstName = profile.name.trim().split(' ')[0] || 'there'
  const communicationQuestion = questions.find((question) => question.competency === 'Communication' && question.responseType === 'audio')
  const simulationQuestion = questions.find((question) => question.dimension === 'simulation')
  const communicationAnswer = communicationQuestion ? answers[communicationQuestion.id] : undefined
  const simulationAnswer = simulationQuestion ? answers[simulationQuestion.id] : undefined

  return (
    <div className="results-page">
      <section className="results-hero">
        <div className="results-title">
          <div className="eyebrow"><span /> Expert review complete</div>
          <h1>{firstName}, here’s your readiness snapshot.</h1>
          <p>{industry.name} · {role.name} · {profile.level}</p>
        </div>
        <button className="secondary-button" onClick={onRetake}><RotateCcw size={16} /> Retake</button>
      </section>

      <section className="score-overview">
        <div className="overall-card">
          <div className="score-ring" style={{ '--score': `${scores.overall * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{scores.overall}</strong><span>/100</span></div>
          </div>
          <div className="overall-copy">
            <span>Overall job readiness</span>
            <h2>{level}</h2>
            <p>{benchmarkGap > 0 ? <>You’re <strong>{benchmarkGap} points</strong> from the {profile.level.toLowerCase()} benchmark of {benchmark}.</> : benchmarkGap < 0 ? <>You’re <strong>{Math.abs(benchmarkGap)} points above</strong> the {profile.level.toLowerCase()} benchmark of {benchmark}.</> : <>You’ve <strong>met</strong> the {profile.level.toLowerCase()} benchmark of {benchmark}.</>}</p>
          </div>
          <div className="benchmark-marker"><Target size={16} /><span>Target benchmark<strong>{benchmark}/100</strong></span></div>
        </div>

        <div className="dimension-scores">
          <ScoreBar label="Core employability" score={scores.core} weight={role.coreWeight} color="teal" />
          <ScoreBar label="Role capability" score={scores.role} weight={role.roleWeight} color="orange" />
          <ScoreBar label="Industry context" score={scores.industry} weight={role.industryWeight} color="blue" />
          <div className="simulation-score"><Sparkles size={17} /><span>Job simulation signal</span><strong>{scores.simulation}</strong></div>
        </div>
      </section>

      <section className="insight-grid">
        <div className="insight-card strengths-card">
          <div className="insight-heading"><span><CheckCircle2 size={19} /></span><div><h3>Your strongest capabilities</h3><p>Skills you can build on immediately</p></div></div>
          <div className="ranked-list">
            {strengths.map((item, index) => (
              <div key={`${item.name}-${index}`}><i>{index + 1}</i><span><strong>{item.name}</strong><small>{dimensionNames[item.dimension]}</small></span><b>{item.score}</b></div>
            ))}
          </div>
        </div>
        <div className="insight-card gaps-card">
          <div className="insight-heading"><span><Target size={19} /></span><div><h3>{hasBenchmarkGap ? 'Your priority skill gaps' : 'Capabilities to strengthen'}</h3><p>{hasBenchmarkGap ? 'Closing these will move your score fastest' : 'Relative priorities for continued growth'}</p></div></div>
          <div className="ranked-list">
            {gaps.map((item, index) => (
              <div key={`${item.name}-${index}`}><i>{index + 1}</i><span><strong>{item.name}</strong><small>{item.dimension === 'core' ? 'Core employability' : item.dimension === 'industry' ? industry.name : role.name}</small></span><b>{item.score}</b></div>
            ))}
          </div>
        </div>
      </section>

      <section className="response-analysis-card">
        <div className="response-analysis-heading">
          <div><Sparkles size={20} /></div>
          <span><small>Human-reviewed evidence</small><h2>Expert assessment feedback</h2><p>Reviewed criterion by criterion by {reviewerName}.</p></span>
        </div>
        <div className="feedback-columns">
          <article>
            <div className="feedback-title"><Mic size={16} /><span><strong>Communication response</strong><small>{communicationAnswer?.duration ?? 0}s recorded · Score {communicationAnswer?.score ?? 0}</small></span></div>
            <p>{communicationAnswer?.feedback}</p>
            {communicationAnswer?.transcript && <blockquote>“{truncateResponse(communicationAnswer.transcript, 180)}”</blockquote>}
            {communicationAnswer?.audioUrl && <audio controls src={communicationAnswer.audioUrl}>Your browser does not support audio playback.</audio>}
          </article>
          <article>
            <div className="feedback-title"><FileResponseIcon /><span><strong>Job simulation response</strong><small>{simulationAnswer?.text?.trim().split(/\s+/).length ?? 0} words · Score {simulationAnswer?.score ?? 0}</small></span></div>
            <p>{simulationAnswer?.feedback}</p>
            <blockquote>“{truncateResponse(simulationAnswer?.text ?? '', 150)}”</blockquote>
          </article>
        </div>
      </section>

      <section className="benchmark-section">
        <div><span className="section-label">What “job ready” means here</span><h2>Your profile benchmark</h2><p>A job-ready {role.name.toLowerCase()} candidate in {industry.name} should independently demonstrate these capabilities.</p></div>
        <div className="benchmark-list">
          {role.competencies.slice(0, 4).map((item) => <span key={item}><Check size={14} /> {item}</span>)}
          {industry.contexts.slice(0, 2).map((item) => <span key={item}><Check size={14} /> {item} context</span>)}
        </div>
      </section>
    </div>
  )
}

function FileResponseIcon() {
  return <span className="text-response-icon">Aa</span>
}

function truncateResponse(value: string, length: number) {
  if (!value) return 'No response captured.'
  return value.length > length ? `${value.slice(0, length).trim()}…` : value
}

function ScoreBar({ label, score, weight, color }: { label: string; score: number; weight: number; color: string }) {
  return (
    <div className="score-bar-row">
      <div><span>{label}</span><small>{weight}% weight</small></div>
      <div className="bar"><span className={color} style={{ width: `${score}%` }} /></div>
      <strong>{score}</strong>
    </div>
  )
}

export default App
