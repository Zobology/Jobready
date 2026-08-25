import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { Assessment, ProfileBuilder, Results } from './App'
import { api, backendEnabled } from './api'
import { ReviewWorkspace } from './HumanReview'
import { buildAssessment, industries, roles } from './data'
import type { AssessmentAnswer, CandidateProfile, HumanReview } from './reviewTypes'
import {
  assignSubmission,
  bootstrapDatabase,
  createId,
  hashPassword,
  loadDatabase,
  loadSession,
  saveDatabase,
  saveSession,
} from './portalStore'
import type { AssignedReview, PortalAccount, PortalDatabase, PortalSubmission, ReviewerProfile } from './portalTypes'

type PublicView = 'landing' | 'signin' | 'signup' | 'reviewer-signup' | 'forgot-password' | 'reset-password'
type CandidateView = 'profile' | 'assessment' | 'waiting' | 'results'
type ReviewerView = 'queue' | 'review' | 'evaluation'
type AdminView = 'dashboard' | 'reviewers' | 'candidates' | 'assessments' | 'adjudication' | 'ai-calibration'

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

function scoreReview(submission: PortalSubmission, review: AssignedReview) {
  return Object.fromEntries(submission.questions.map((question) => {
    const original = submission.answers[question.id]
    const evaluation = review.questionReviews[question.id]
    const values = question.rubric.map((criterion) => evaluation?.criteria[criterion]?.score).filter((score): score is 1 | 2 | 3 | 4 => Boolean(score))
    const score = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 25) : 0
    return [question.id, { ...original, score, feedback: evaluation?.comment || 'Reviewed against the job-specific rubric.' }]
  }))
}

function averageReviews(submission: PortalSubmission, reviews: AssignedReview[]) {
  const scored = reviews.map((review) => scoreReview(submission, review))
  return Object.fromEntries(submission.questions.map((question) => {
    const answers = scored.map((result) => result[question.id])
    return [question.id, {
      ...submission.answers[question.id],
      score: Math.round(answers.reduce((sum, answer) => sum + answer.score, 0) / answers.length),
      feedback: answers.map((answer) => answer.feedback).filter(Boolean).join(' · '),
    }]
  }))
}

function overallScore(submission: PortalSubmission, answers: Record<string, AssessmentAnswer>) {
  const scores = submission.questions.map((question) => answers[question.id]?.score ?? 0)
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1))
}

function accountName(database: PortalDatabase, userId: string) {
  const account = database.accounts.find((item) => item.id === userId)
  return account ? `${account.firstName || ''} ${account.lastName || ''}`.trim() : ''
}

export default function Portal() {
  const initialPath = window.location.pathname.replace(/\/+$/, '')
  const [requestedReviewId] = useState(() => new URLSearchParams(window.location.search).get('review'))
  const [requestedAssessment] = useState(() => initialPath === '/assessment')
  const [requestedMentorRegistration] = useState(() => initialPath === '/mentor/register')
  const [requestedResetToken] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '')
  const [database, setDatabase] = useState<PortalDatabase>(() => loadDatabase())
  const [ready, setReady] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(() => loadSession())
  const [publicView, setPublicView] = useState<PublicView>(initialPath === '/reset-password' ? 'reset-password' : initialPath === '/forgot-password' ? 'forgot-password' : requestedMentorRegistration ? 'reviewer-signup' : requestedReviewId || requestedAssessment ? 'signin' : 'landing')
  const [candidateView, setCandidateView] = useState<CandidateView>('profile')
  const [reviewerView, setReviewerView] = useState<ReviewerView>(requestedReviewId ? 'review' : 'queue')
  const [adminView, setAdminView] = useState<AdminView>('dashboard')
  const [profile, setProfile] = useState<CandidateProfile>(initialProfile)
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({})
  const [questionIndex, setQuestionIndex] = useState(0)
  const [startingNewAssessment, setStartingNewAssessment] = useState(false)
  const [activeReviewId, setActiveReviewId] = useState<string | null>(requestedReviewId)
  const [reviewQuestionIndex, setReviewQuestionIndex] = useState(0)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [preparingAssessment, setPreparingAssessment] = useState(false)
  const reviewSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingReviewSave = useRef<HumanReview | null>(null)
  const reviewSaveQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (backendEnabled) {
      api.state()
        .then((result) => {
          if (result) {
            setDatabase(result.state)
            setSessionId(result.user.id)
            const name = accountName(result.state, result.user.id)
            if (name) setProfile((current) => current.name ? current : { ...current, name })
          } else {
            setDatabase(emptyPortalDatabase())
            setSessionId(null)
          }
        })
        .catch((error: Error) => setOperationError(error.message))
        .finally(() => setReady(true))
    } else {
      bootstrapDatabase(loadDatabase()).then((seeded) => {
        setDatabase(seeded)
        saveDatabase(seeded)
        setReady(true)
      })
    }
  }, [])

  useEffect(() => {
    if (ready && !backendEnabled) saveDatabase(database)
  }, [database, ready])

  const account = database.accounts.find((item) => item.id === sessionId) ?? null
  const candidateSubmission = account?.role === 'candidate'
    ? [...database.submissions].reverse().find((item) => item.candidateId === account.id)
    : undefined
  const activeReview = database.reviews.find((item) => item.id === activeReviewId)
  const activeSubmission = activeReview ? database.submissions.find((item) => item.id === activeReview.submissionId) : undefined
  const role = roles.find((item) => item.id === profile.roleId) ?? roles[0]
  const industry = industries.find((item) => item.id === profile.industryId) ?? industries[0]
  const assessment = useMemo(
    () => buildAssessment(role, industry, {
      education: profile.education,
      experienceType: profile.experienceType,
      experienceYears: profile.experienceYears,
      level: profile.level,
      resumeName: profile.resumeName,
      resumeSignals: profile.resumeSignals,
    }),
    [role, industry, profile.education, profile.experienceType, profile.experienceYears, profile.level, profile.resumeName, profile.resumeSignals],
  )

  function updateDatabase(next: PortalDatabase) {
    setDatabase(next)
    if (!backendEnabled) saveDatabase(next)
  }

  function navigatePublic(view: PublicView) {
    const path = view === 'reviewer-signup' ? '/mentor/register' : view === 'forgot-password' ? '/forgot-password' : '/'
    window.history.pushState({}, '', path)
    setPublicView(view)
    window.scrollTo(0, 0)
  }

  async function signOut() {
    if (backendEnabled) await api.signout().catch(() => undefined)
    saveSession(null)
    window.history.replaceState({}, '', '/')
    setSessionId(null)
    setPublicView('landing')
    setStartingNewAssessment(false)
    setMobileMenu(false)
  }

  async function submitAssessment() {
    if (!account) return
    setOperationError('')
    let submittedProfile = { ...profile, resumeFile: undefined }
    const submittedAnswers = { ...answers }
    try {
      if (backendEnabled) {
        let resumeKey = profile.resumeKey
        if (profile.resumeFile && !resumeKey) {
          const uploaded = await api.upload('resume', profile.resumeFile, profile.resumeFile.name)
          resumeKey = uploaded.key
        }
        for (const [questionId, answer] of Object.entries(submittedAnswers)) {
          if (answer.audioUrl?.startsWith('blob:')) {
            const blob = await fetch(answer.audioUrl).then((response) => response.blob())
            const uploaded = await api.upload('audio', blob, `${questionId}.webm`)
            submittedAnswers[questionId] = { ...answer, audioUrl: uploaded.url }
          }
          if (answer.workbookFile) {
            const uploaded = await api.upload('answer_spreadsheet', answer.workbookFile, answer.workbookName || `${questionId}.xlsx`)
            submittedAnswers[questionId] = { ...submittedAnswers[questionId], workbookFile: undefined, workbookUrl: uploaded.url, workbookName: answer.workbookName || 'completed-analysis.xlsx' }
          }
        }
        submittedProfile = { ...submittedProfile, resumeName: profile.resumeName, resumeKey }
        await api.saveProfile({ ...submittedProfile, resumeKey })
        const result = await api.submitAssessment({ profile: submittedProfile, role, industry, questions: assessment, answers: submittedAnswers })
        updateDatabase(result.state)
      }
    } catch (error) {
      setOperationError((error as Error).message)
      return
    }
    const submission: PortalSubmission = {
      id: createId('ZOB'),
      candidateId: account.id,
      submittedAt: new Date().toISOString(),
      profile: submittedProfile,
      role,
      industry,
      questions: assessment,
      answers: submittedAnswers,
      status: 'awaiting_review',
      assignedReviewerIds: [],
    }
    if (!backendEnabled) updateDatabase(assignSubmission(database, submission))
    setStartingNewAssessment(false)
    setCandidateView('waiting')
    window.scrollTo(0, 0)
  }

  async function beginCandidateAssessment() {
    setOperationError('')
    setPreparingAssessment(true)
    try {
      let nextProfile = profile
      if (backendEnabled && profile.resumeFile) {
        const analyzed = await api.analyzeResume(profile.resumeFile)
        nextProfile = {
          ...profile,
          resumeFile: undefined,
          resumeKey: analyzed.key,
          resumeSignals: analyzed.signals,
        }
        setProfile(nextProfile)
      }
      if (backendEnabled) await api.saveProfile({ ...nextProfile, resumeFile: undefined })
      setAnswers({})
      setQuestionIndex(0)
      setCandidateView('assessment')
      window.scrollTo(0, 0)
    } catch (error) {
      setOperationError((error as Error).message)
    } finally {
      setPreparingAssessment(false)
    }
  }

  function enqueueReviewSave(review: HumanReview) {
    reviewSaveQueue.current = reviewSaveQueue.current
      .catch(() => undefined)
      .then(async () => { await api.saveReview(review) })
    reviewSaveQueue.current.catch((error: Error) => setOperationError(error.message))
  }

  function flushReviewSave() {
    if (reviewSaveTimer.current) {
      clearTimeout(reviewSaveTimer.current)
      reviewSaveTimer.current = null
    }
    if (pendingReviewSave.current) {
      enqueueReviewSave(pendingReviewSave.current)
      pendingReviewSave.current = null
    }
    return reviewSaveQueue.current
  }

  function updateActiveReview(review: HumanReview) {
    if (!activeReview) return
    updateDatabase({
      ...database,
      reviews: database.reviews.map((item) => item.id === activeReview.id ? { ...item, ...review } : item),
    })
    if (backendEnabled) {
      pendingReviewSave.current = review
      if (reviewSaveTimer.current) clearTimeout(reviewSaveTimer.current)
      reviewSaveTimer.current = setTimeout(() => {
        reviewSaveTimer.current = null
        if (!pendingReviewSave.current) return
        enqueueReviewSave(pendingReviewSave.current)
        pendingReviewSave.current = null
      }, 400)
    }
  }

  async function finalizeReview(validatedReview?: HumanReview) {
    if (!activeReview || !activeSubmission) return
    const completedReview: AssignedReview = { ...activeReview, ...(validatedReview ?? {}), status: 'completed', completedAt: new Date().toISOString() }
    if (backendEnabled) {
      try {
        await flushReviewSave()
        const result = await api.saveReview(completedReview)
        reviewSaveQueue.current = Promise.resolve()
        updateDatabase(result.state)
      } catch (error) {
        setOperationError((error as Error).message)
        return
      }
    }
    let reviews = database.reviews.map((item) => item.id === activeReview.id ? completedReview : item)
    const assessmentReviews = reviews.filter((item) => item.submissionId === activeSubmission.id)
    const completeCount = assessmentReviews.filter((item) => item.status === 'completed').length
    const activeCount = assessmentReviews.filter((item) => ['accepted', 'in_review', 'completed'].includes(item.status)).length
    const singleReviewComplete = completeCount === 1 && activeCount === 1
    if (singleReviewComplete) reviews = reviews.map((item) => item.submissionId === activeSubmission.id && item.status === 'available' ? { ...item, status: 'declined' as const } : item)
    const submissions = database.submissions.map((item) => item.id === activeSubmission.id
      ? completeCount >= 2
        ? { ...item, status: 'adjudication' as const }
        : singleReviewComplete
          ? { ...item, status: 'published' as const, finalAnswers: scoreReview(activeSubmission, completedReview), adjudicatedAt: new Date().toISOString() }
          : { ...item, status: 'under_review' as const }
      : item)
    const notifications = singleReviewComplete
      ? [...database.notifications, { id: createId('NTF'), recipientId: activeSubmission.candidateId, type: 'results_ready' as const, subject: 'Your Zobology results are ready', createdAt: new Date().toISOString() }]
      : database.notifications
    if (!backendEnabled) updateDatabase({ ...database, reviews, submissions, notifications })
    setActiveReviewId(null)
    setReviewerView('queue')
    window.scrollTo(0, 0)
  }

  async function decideReview(reviewId: string, decision: 'accept' | 'decline') {
    setOperationError('')
    if (backendEnabled) {
      try {
        const result = await api.decideReview(reviewId, decision)
        updateDatabase(result.state)
        if (decision === 'accept') {
          setActiveReviewId(reviewId)
          setReviewQuestionIndex(0)
          setReviewerView('review')
        }
      } catch (error) { setOperationError((error as Error).message) }
      return
    }
    const selected = database.reviews.find((item) => item.id === reviewId)
    if (!selected || selected.status !== 'available') return
    const activeCount = database.reviews.filter((item) => item.submissionId === selected.submissionId && ['accepted', 'in_review', 'completed'].includes(item.status)).length
    if (decision === 'accept' && activeCount >= 2) {
      setOperationError('Two mentors have already accepted this assessment')
      return
    }
    const newStatus = decision === 'accept' ? 'accepted' as const : 'declined' as const
    let reviews = database.reviews.map((item) => item.id === reviewId ? { ...item, status: newStatus } : item)
    if (decision === 'accept' && activeCount + 1 >= 2) {
      reviews = reviews.map((item) => item.submissionId === selected.submissionId && item.status === 'available' ? { ...item, status: 'declined' as const } : item)
    }
    const submissions = decision === 'accept'
      ? database.submissions.map((item) => item.id === selected.submissionId ? { ...item, status: 'under_review' as const, assignedReviewerIds: [...new Set([...item.assignedReviewerIds, selected.reviewerId])] } : item)
      : database.submissions
    updateDatabase({ ...database, reviews, submissions })
    if (decision === 'accept') {
      setActiveReviewId(reviewId)
      setReviewQuestionIndex(0)
      setReviewerView('review')
    }
  }

  if (!ready) return <div className="portal-loader"><span className="brand-mark"><TrendingUp /></span><p>Preparing Zobology…</p></div>

  if (!account) {
    if (publicView === 'landing') return <Landing onSignIn={() => navigatePublic('signin')} onSignUp={() => navigatePublic('signup')} onReviewer={() => navigatePublic('reviewer-signup')} />
    if (publicView === 'forgot-password' || publicView === 'reset-password') return <PasswordRecoveryScreen mode={publicView} token={requestedResetToken} onBack={() => navigatePublic('signin')} />
    return (
      <AuthScreen
        mode={publicView}
        database={database}
        onBack={() => navigatePublic('landing')}
        onSwitch={navigatePublic}
        onAuthenticated={(nextDatabase, userId) => {
          window.history.replaceState({}, '', '/')
          updateDatabase(nextDatabase)
          saveSession(userId)
          setSessionId(userId)
          const name = accountName(nextDatabase, userId)
          if (name) setProfile((current) => current.name ? current : { ...current, name })
        }}
        onServerAuthenticated={(nextDatabase, userId) => {
          window.history.replaceState({}, '', '/')
          updateDatabase(nextDatabase)
          setSessionId(userId)
          const name = accountName(nextDatabase, userId)
          if (name) setProfile((current) => current.name ? current : { ...current, name })
        }}
      />
    )
  }

  const reviewerProfile = database.reviewers.find((item) => item.userId === account.id)
  const resolvedCandidateView: CandidateView = startingNewAssessment
    ? candidateView
    : candidateView === 'assessment'
    ? 'assessment'
    : candidateSubmission
      ? candidateSubmission.status === 'published' ? 'results' : 'waiting'
      : 'profile'
  const activeReviewCanOpen = activeReview && ['accepted', 'in_review', 'completed'].includes(activeReview.status)
  const resolvedReviewerView: ReviewerView = reviewerView === 'evaluation' && activeReview?.status === 'completed'
    ? 'evaluation'
    : reviewerView === 'review' && activeReviewCanOpen ? 'review' : 'queue'
  const navItems = account.role === 'candidate'
    ? [{ id: 'assessment', label: 'Assessment' }, { id: 'results', label: 'Results' }]
    : account.role === 'reviewer'
      ? [{ id: 'queue', label: 'Assessment queue' }]
      : [{ id: 'dashboard', label: 'Overview' }, { id: 'reviewers', label: 'Mentors' }, { id: 'candidates', label: 'Candidates' }, { id: 'assessments', label: 'Assessments' }, { id: 'ai-calibration', label: 'AI Calibration' }, { id: 'adjudication', label: 'Adjudication' }]

  return (
    <div className="portal-shell">
      <PortalHeader
        account={account}
        items={navItems}
        active={account.role === 'candidate' ? resolvedCandidateView : account.role === 'reviewer' ? resolvedReviewerView : adminView}
        mobileMenu={mobileMenu}
        onMenu={() => setMobileMenu(!mobileMenu)}
        onNavigate={(id) => {
          if (account.role === 'candidate') {
            if (id === 'assessment') {
              if (candidateSubmission?.status === 'published') {
                setStartingNewAssessment(true)
                setCandidateView('profile')
              } else setCandidateView(candidateSubmission ? 'waiting' : 'profile')
            }
            if (id === 'results' && candidateSubmission?.status === 'published') setCandidateView('results')
          } else if (account.role === 'reviewer') setReviewerView('queue')
          else setAdminView(id as AdminView)
          setMobileMenu(false)
        }}
        onSignOut={signOut}
      />
      <main>
        {operationError && <div className="portal-error-banner" role="alert">{operationError}<button onClick={() => setOperationError('')}>Dismiss</button></div>}
        {account.role === 'candidate' && (
          <>
            {resolvedCandidateView === 'profile' && <ProfileBuilder profile={profile} setProfile={setProfile} onContinue={beginCandidateAssessment} isPreparing={preparingAssessment} />}
            {resolvedCandidateView === 'assessment' && (
              <Assessment
                questions={assessment}
                currentIndex={questionIndex}
                answers={answers}
                roleName={role.name}
                industryName={industry.name}
                onAnswer={(questionId, answer) => setAnswers((current) => ({ ...current, [questionId]: answer }))}
                onBack={() => questionIndex ? setQuestionIndex(questionIndex - 1) : setCandidateView('profile')}
                onNext={() => questionIndex === assessment.length - 1 ? submitAssessment() : setQuestionIndex(questionIndex + 1)}
              />
            )}
            {resolvedCandidateView === 'waiting' && candidateSubmission && <CandidateWaiting submission={candidateSubmission} />}
            {resolvedCandidateView === 'results' && candidateSubmission?.finalAnswers && (
              <Results
                profile={candidateSubmission.profile}
                role={candidateSubmission.role}
                industry={candidateSubmission.industry}
                questions={candidateSubmission.questions}
                answers={candidateSubmission.finalAnswers}
                reviewerName={candidateSubmission.assignedReviewerIds.length > 1 ? 'Zobology expert panel' : 'Zobology industry mentor'}
                onRetake={() => { setStartingNewAssessment(true); setProfile({ ...initialProfile, name: `${account.firstName || ''} ${account.lastName || ''}`.trim() }); setCandidateView('profile'); window.scrollTo(0, 0) }}
              />
            )}
          </>
        )}

        {account.role === 'reviewer' && reviewerProfile && (
          <>
            {resolvedReviewerView === 'queue' && (
              <ReviewerDashboard
                account={account}
                database={database}
                onDecision={decideReview}
                onOpen={(reviewId) => { setActiveReviewId(reviewId); setReviewQuestionIndex(0); setReviewerView('review'); window.scrollTo(0, 0) }}
                onEvaluation={(reviewId) => { setActiveReviewId(reviewId); setReviewerView('evaluation'); window.scrollTo(0, 0) }}
              />
            )}
            {resolvedReviewerView === 'review' && activeReview && activeSubmission && (
              <ReviewWorkspace
                profile={activeSubmission.profile}
                role={activeSubmission.role}
                industry={activeSubmission.industry}
                questions={activeSubmission.questions}
                answers={activeSubmission.answers}
                review={activeReview}
                currentIndex={reviewQuestionIndex}
                onSelect={setReviewQuestionIndex}
                onChange={updateActiveReview}
                onExit={() => setReviewerView('queue')}
                onFinalize={finalizeReview}
              />
            )}
            {resolvedReviewerView === 'evaluation' && activeReview?.status === 'completed' && activeSubmission && (
              <Results
                profile={activeSubmission.profile}
                role={activeSubmission.role}
                industry={activeSubmission.industry}
                questions={activeSubmission.questions}
                answers={scoreReview(activeSubmission, activeReview)}
                reviewerName={activeReview.reviewerName}
                audience="mentor"
                onBack={() => { setReviewerView('queue'); window.scrollTo(0, 0) }}
              />
            )}
          </>
        )}

        {account.role === 'admin' && (
          <AdminPanel
            view={adminView}
            database={database}
            onView={setAdminView}
            onUpdate={updateDatabase}
            onReviewerDecision={backendEnabled ? async (userId, status) => {
              try {
                const result = await api.decideReviewer(userId, status)
                updateDatabase(result.state)
              } catch (error) { setOperationError((error as Error).message) }
            } : undefined}
            onPublish={backendEnabled ? async (submissionId, choice) => {
              try {
                const result = await api.publish(submissionId, choice)
                updateDatabase(result.state)
              } catch (error) { setOperationError((error as Error).message) }
            } : undefined}
            onAiGovernance={backendEnabled ? async (input) => {
              try {
                const result = await api.updateAiGovernance(input)
                updateDatabase(result.state)
              } catch (error) { setOperationError((error as Error).message) }
            } : undefined}
          />
        )}
      </main>
    </div>
  )
}

function emptyPortalDatabase(): PortalDatabase {
  return { accounts: [], reviewers: [], submissions: [], reviews: [], notifications: [], aiGovernance: { mode: 'human_required', model: 'anthropic/claude-opus-5', minimumReviews: 100, maximumMae: 0.35, minimumExactAgreement: 0.75, reviews: 0, criteria: 0, mae: 0, exactAgreement: 0, eligible: false } }
}

function Brand() {
  return <span className="portal-brand"><span className="brand-mark"><TrendingUp size={19} /></span><strong>Zobo<span>logy</span></strong></span>
}

function Landing({ onSignIn, onSignUp, onReviewer }: { onSignIn: () => void; onSignUp: () => void; onReviewer: () => void }) {
  return (
    <div className="landing-page">
      <header className="landing-nav"><Brand /><div><button className="text-button" onClick={onSignIn}>Sign in</button><button className="primary-button compact" onClick={onSignUp}>Get started <ArrowRight size={16} /></button></div></header>
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-copy">
            <h1>Zobology</h1>
            <h2>Assess. Improve.<br /><em>Get Hired.</em></h2>
            <p>Know exactly where you stand for the role you want. Take a job-specific assessment and receive evidence-based insights powered by AI and governed by industry experts.</p>
            <div className="landing-actions"><button className="primary-button compact" onClick={onSignUp}>Start your assessment <ArrowRight size={17} /></button><button className="secondary-button" onClick={onSignIn}>Sign in</button></div>
            <div className="trust-row"><span><Sparkles size={16} /> AI powered</span><span><ShieldCheck size={16} /> Industry Expert Governed</span><span><Target size={16} /> Role specific</span></div>
          </div>
          <div className="readiness-visual">
            <div className="visual-top"><span>JOB READINESS PROFILE</span><b>Operations · E-commerce</b></div>
            <div className="visual-score"><div><strong>76</strong><span>/100</span></div><p><b>Nearly job ready</b><span>AI-powered evidence analysis</span></p></div>
            <div className="visual-bars">
              <ScorePreview label="Core employability" score={82} />
              <ScorePreview label="Role capability" score={74} />
              <ScorePreview label="Industry context" score={68} />
            </div>
            <div className="expert-stamp"><UserCheck size={18} /><span><b>Industry Expert Governed</b><small>Calibrated for consistency</small></span><CheckCircle2 size={18} /></div>
          </div>
        </section>
        <section className="landing-pillars">
          <article><span>01</span><h3>Built for your target</h3><p>Questions adapt to your education, experience, role, industry, and target level.</p></article>
          <article><span>02</span><h3>Show, don’t select</h3><p>Written responses, audio communication, and realistic job simulations—not a psychometric quiz.</p></article>
          <article><span>03</span><h3>Evaluated with intelligence</h3><p>AI analyzes every response against expert-governed, job-specific scoring rubrics.</p></article>
        </section>
      </main>
      <footer className="landing-footer"><Brand /><p>© 2026 Zobology. Job readiness, made visible.</p><button onClick={onReviewer}>Register as a Mentor <ArrowRight size={13} /></button></footer>
    </div>
  )
}

function ScorePreview({ label, score }: { label: string; score: number }) {
  return <div><span><b>{label}</b><strong>{score}</strong></span><i><em style={{ width: `${score}%` }} /></i></div>
}

function AuthScreen({
  mode,
  database,
  onBack,
  onSwitch,
  onAuthenticated,
  onServerAuthenticated,
}: {
  mode: PublicView
  database: PortalDatabase
  onBack: () => void
  onSwitch: (view: PublicView) => void
  onAuthenticated: (database: PortalDatabase, userId: string) => void
  onServerAuthenticated: (database: PortalDatabase, userId: string) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [linkedinProfile, setLinkedinProfile] = useState('')
  const [mentorResume, setMentorResume] = useState<File | null>(null)
  const [registeredResult, setRegisteredResult] = useState<Awaited<ReturnType<typeof api.signup>> | null>(null)
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [industryIds, setIndustryIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const reviewerMode = mode === 'reviewer-signup'
  const signInMode = mode === 'signin'

  function toggle(items: string[], value: string, update: (items: string[]) => void) {
    if (items.includes(value)) update(items.filter((item) => item !== value))
    else if (items.length < 5) update([...items, value])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!email.trim() || password.length < 8) {
      setError('Use a valid email and a password of at least 8 characters.')
      return
    }
    if (!signInMode && (!firstName.trim() || !lastName.trim())) {
      setError('Enter your first name and last name.')
      return
    }
    if (!signInMode && password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    if (reviewerMode && (!roleIds.length || !industryIds.length)) {
      setError('Select at least one role and one industry you can assess.')
      return
    }
    if (reviewerMode) {
      try {
        const hostname = new URL(linkedinProfile.trim()).hostname.toLowerCase()
        if (hostname !== 'linkedin.com' && !hostname.endsWith('.linkedin.com')) throw new Error()
      } catch {
        setError('Enter a valid LinkedIn profile URL, including https://.')
        return
      }
      if (mentorResume && mentorResume.size > 25 * 1024 * 1024) {
        setError('The résumé must be 25 MB or smaller.')
        return
      }
    }
    setBusy(true)
    const normalizedEmail = email.trim().toLowerCase()
    if (backendEnabled) {
      try {
        const result = signInMode
          ? await api.signin(normalizedEmail, password)
          : registeredResult ?? await api.signup(reviewerMode
            ? { firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, password, confirmPassword, role: 'reviewer', linkedinProfile: linkedinProfile.trim(), roleIds, industryIds }
            : { firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, password, confirmPassword, role: 'candidate' })
        if (!signInMode && !registeredResult) setRegisteredResult(result)
        if (!signInMode && reviewerMode && mentorResume) {
          await api.upload('resume', mentorResume, mentorResume.name)
          const refreshed = await api.state()
          if (refreshed) return onServerAuthenticated(refreshed.state, refreshed.user.id)
        }
        onServerAuthenticated(result.state, result.user.id)
      } catch (serverError) {
        setError(registeredResult ? `Your account was created, but the résumé upload failed: ${(serverError as Error).message}. Submit again to retry.` : (serverError as Error).message)
      } finally {
        setBusy(false)
      }
      return
    }
    const passwordHash = await hashPassword(password)
    if (signInMode) {
      const account = database.accounts.find((item) => item.email === normalizedEmail && item.passwordHash === passwordHash)
      if (!account) setError('Email or password is incorrect.')
      else onAuthenticated(database, account.id)
      setBusy(false)
      return
    }
    if (database.accounts.some((item) => item.email === normalizedEmail)) {
      setError('An account with this email already exists. Sign in instead.')
      setBusy(false)
      return
    }
    const account: PortalAccount = {
      id: createId('USR'),
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      passwordHash,
      role: reviewerMode ? 'reviewer' : 'candidate',
      createdAt: new Date().toISOString(),
    }
    const reviewer: ReviewerProfile | undefined = reviewerMode ? {
      userId: account.id,
      roleIds,
      industryIds,
      linkedinProfile: linkedinProfile.trim(),
      resumeKey: mentorResume?.name,
      status: 'pending',
      appliedAt: new Date().toISOString(),
    } : undefined
    onAuthenticated({ ...database, accounts: [...database.accounts, account], reviewers: reviewer ? [...database.reviewers, reviewer] : database.reviewers }, account.id)
    setBusy(false)
  }

  return (
    <div className="auth-page">
      <aside className="auth-story"><button className="back-link" onClick={onBack}>← Back to home</button><Brand /><div><span className="eyebrow"><i /> Zobology intelligence engine</span><h1>{reviewerMode ? 'Help talent become job ready.' : 'Your next role starts with knowing your readiness.'}</h1><p>{reviewerMode ? 'Apply your industry experience to structured, evidence-based candidate evaluations.' : 'Personalized assessments. AI-powered evaluation. Actionable readiness insights.'}</p></div><blockquote>“What does job-ready mean for this exact role?”<small>That is the question every Zobology assessment answers.</small></blockquote></aside>
      <main className={reviewerMode ? 'auth-card reviewer-auth-card' : 'auth-card'}>
        <div className="auth-card-heading"><span>{reviewerMode ? <UserCheck /> : <ShieldCheck />}</span><h2>{signInMode ? 'Welcome back' : reviewerMode ? 'Register as a mentor' : 'Create your account'}</h2><p>{signInMode ? 'Sign in to continue to your workspace.' : reviewerMode ? 'Tell us where your expertise is strongest.' : 'Start with your name and email. Your profile comes next.'}</p></div>
        <form onSubmit={submit}>
          {!signInMode && <div className="field-grid"><label className="field"><span>First name</span><input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" autoComplete="given-name" maxLength={80} /></label><label className="field"><span>Last name</span><input type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" autoComplete="family-name" maxLength={80} /></label></div>}
          <label className="field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label className="field"><span>{signInMode ? 'Password' : 'Set password'}</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" autoComplete={signInMode ? 'current-password' : 'new-password'} /></label>
          {!signInMode && <label className="field"><span>Re-enter password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the same password again" autoComplete="new-password" /></label>}
          {signInMode && <button type="button" className="forgot-password-link" onClick={() => onSwitch('forgot-password')}>Forgot password?</button>}
          {reviewerMode && (
            <>
              <label className="field"><span>LinkedIn profile <small>Required</small></span><input type="url" value={linkedinProfile} onChange={(event) => setLinkedinProfile(event.target.value)} placeholder="https://www.linkedin.com/in/your-profile" autoComplete="url" maxLength={500} /></label>
              <label className="field file-field"><span>Résumé <small>Optional · PDF, DOC or DOCX · max 25 MB</small></span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setMentorResume(event.target.files?.[0] ?? null)} /></label>
              <MultiSelect label="Roles you can assess" hint={`${roleIds.length}/5 selected`} options={roles.map((item) => ({ id: item.id, label: item.name }))} selected={roleIds} onToggle={(id) => toggle(roleIds, id, setRoleIds)} />
              <MultiSelect label="Industries you know" hint={`${industryIds.length}/5 selected`} options={industries.map((item) => ({ id: item.id, label: item.name }))} selected={industryIds} onToggle={(id) => toggle(industryIds, id, setIndustryIds)} />
            </>
          )}
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : signInMode ? 'Sign in' : reviewerMode ? 'Submit application' : 'Create account'} <ArrowRight size={16} /></button>
        </form>
        <p className="auth-switch">{signInMode ? <>New to Zobology? <button onClick={() => onSwitch('signup')}>Create an account</button></> : <>Already have an account? <button onClick={() => onSwitch('signin')}>Sign in</button></>}</p>
        {signInMode && !backendEnabled && <div className="demo-access"><strong>Preview accounts</strong><span>Admin: admin@zobology.in / Admin@123</span><span>Mentor: expert1@zobology.in / Mentor@123</span></div>}
      </main>
    </div>
  )
}

function PasswordRecoveryScreen({ mode, token, onBack }: { mode: 'forgot-password' | 'reset-password'; token: string; onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const resetMode = mode === 'reset-password'

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!backendEnabled) {
      setError('Password reset is available when connected to the Zobology server.')
      return
    }
    if (resetMode) {
      if (!token) {
        setError('This password reset link is invalid or incomplete.')
        return
      }
      if (password.length < 8) {
        setError('Use a password of at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('The passwords do not match.')
        return
      }
    } else if (!email.trim()) {
      setError('Enter your email address.')
      return
    }
    setBusy(true)
    try {
      if (resetMode) {
        await api.resetPassword(token, password)
        setMessage('Your password has been reset. You can now sign in with your new password.')
      } else {
        const result = await api.forgotPassword(email.trim().toLowerCase())
        setMessage(result.message)
      }
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-story"><button className="back-link" onClick={onBack}>← Back to sign in</button><Brand /><div><span className="eyebrow"><i /> Secure account recovery</span><h1>Get back to your Zobology journey.</h1><p>Reset access securely and continue from where you left off.</p></div><blockquote>“Your assessment progress stays with your account.”<small>Changing your password will sign out any existing sessions.</small></blockquote></aside>
      <main className="auth-card">
        <div className="auth-card-heading"><span><ShieldCheck /></span><h2>{resetMode ? 'Set a new password' : 'Forgot your password?'}</h2><p>{resetMode ? 'Choose a new password for your account.' : 'Enter the email used for your candidate or mentor account.'}</p></div>
        <form onSubmit={submit}>
          {resetMode ? <><label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" /></label><label className="field"><span>Re-enter password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the same password again" autoComplete="new-password" /></label></> : <label className="field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>}
          {error && <p className="auth-error">{error}</p>}
          {message && <p className="auth-success">{message}</p>}
          {!message && <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : resetMode ? 'Reset password' : 'Send reset link'} <ArrowRight size={16} /></button>}
        </form>
        <p className="auth-switch"><button onClick={onBack}>Return to sign in</button></p>
      </main>
    </div>
  )
}

function MultiSelect({ label, hint, options, selected, onToggle }: { label: string; hint: string; options: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="multi-field"><div className="multi-label"><span>{label}</span><small>{hint}</small></div><button type="button" className="multi-trigger" onClick={() => setOpen(!open)}><span>{selected.length ? `${selected.length} selected` : 'Choose up to 5'}</span><ChevronDown size={16} /></button>{open && <div className="multi-options">{options.map((option) => <button type="button" key={option.id} className={selected.includes(option.id) ? 'selected' : ''} onClick={() => onToggle(option.id)}><i>{selected.includes(option.id) && <Check size={11} />}</i><span>{option.label}</span></button>)}</div>}</div>
  )
}

function PortalHeader({ account, items, active, mobileMenu, onMenu, onNavigate, onSignOut }: { account: PortalAccount; items: { id: string; label: string }[]; active: string; mobileMenu: boolean; onMenu: () => void; onNavigate: (id: string) => void; onSignOut: () => void }) {
  const displayName = `${account.firstName || ''} ${account.lastName || ''}`.trim() || account.email
  const roleLabel = account.role === 'reviewer' ? 'mentor' : account.role
  return (
    <header className="portal-header"><button className="brand-button" onClick={() => onNavigate(items[0].id)}><Brand /></button><nav className={mobileMenu ? 'portal-nav open' : 'portal-nav'}>{items.map((item) => <button key={item.id} className={active === item.id || (item.id === 'assessment' && ['profile', 'assessment', 'waiting'].includes(active)) ? 'active' : ''} onClick={() => onNavigate(item.id)}>{item.label}</button>)}</nav><div className="portal-account"><button className="notification-button" aria-label="Notifications"><Bell size={18} /></button><span><i>{displayName[0].toUpperCase()}</i><b>{displayName}</b><small>{roleLabel} · {account.email}</small></span><button className="logout-button" onClick={onSignOut} title="Sign out"><LogOut size={17} /></button><button className="menu-button" onClick={onMenu}>{mobileMenu ? <X /> : <Menu />}</button></div></header>
  )
}

function CandidateWaiting({ submission }: { submission: PortalSubmission }) {
  const target = new Date(new Date(submission.submittedAt).getTime() + 24 * 60 * 60 * 1000)
  const completed = submission.status === 'published'
  return (
    <div className="status-page"><section className="status-card"><div className="status-icon"><CheckCircle2 size={32} /></div><div className="eyebrow"><span /> Assessment submitted</div><h1>Thank you, {submission.profile.name}.</h1><p className="status-lead">Please wait while Zobology’s AI evaluates your responses against the benchmark for your target role and industry.</p><div className="status-timeline"><div className="done"><i><Check size={13} /></i><span><b>Assessment completed</b><small>{new Date(submission.submittedAt).toLocaleString()}</small></span></div><div className={submission.aiReviewStatus === 'completed' ? 'done' : 'active'}><i>{submission.aiReviewStatus === 'completed' ? <Check size={13} /> : 2}</i><span><b>AI evidence analysis</b><small>{submission.aiReviewStatus === 'completed' ? 'Evaluation prepared' : submission.aiReviewStatus === 'unavailable' ? 'Quality safeguards in progress' : 'Analyzing responses and work samples'}</small></span></div><div className={submission.status === 'under_review' ? 'active' : ''}><i>3</i><span><b>Quality governance</b><small>Expert-governed scoring standards are applied</small></span></div><div className={completed ? 'done' : ''}><i>{completed ? <Check size={13} /> : 4}</i><span><b>Results published</b><small>Expected by {target.toLocaleString()}</small></span></div></div><div className="submission-reference"><span><small>Submission ID</small><b>{submission.id}</b></span><span><small>Target profile</small><b>{submission.role.name} · {submission.industry.name}</b></span><span><small>Status</small><b>{submission.status.replace('_', ' ')}</b></span></div><div className="human-review-note"><ShieldCheck size={20} /><span><strong>AI Powered · Industry Expert Governed</strong>Your evaluation follows structured, job-specific rubrics designed and calibrated for consistent readiness insights.</span></div></section></div>
  )
}

function ReviewerDashboard({ account, database, onOpen, onEvaluation, onDecision }: { account: PortalAccount; database: PortalDatabase; onOpen: (reviewId: string) => void; onEvaluation: (reviewId: string) => void; onDecision: (reviewId: string, decision: 'accept' | 'decline') => void }) {
  const reviews = database.reviews.filter((item) => item.reviewerId === account.id && item.status !== 'declined')
  const available = reviews.filter((item) => item.status === 'available')
  const active = reviews.filter((item) => ['accepted', 'in_review'].includes(item.status))
  const completed = reviews.filter((item) => item.status === 'completed')
  return (
    <div className="workspace-page"><div className="workspace-heading"><div><div className="eyebrow"><span /> Mentor workspace</div><h1>Mentor dashboard</h1><p>Validate AI-drafted assessments against the candidate evidence and job-specific rubric.</p></div><div className="workspace-stats"><Stat icon={<ClipboardCheck />} label="Available" value={available.length} /><Stat icon={<Clock3 />} label="In progress" value={active.length} /><Stat icon={<CheckCircle2 />} label="Completed" value={completed.length} /></div></div><div className="review-type-note"><ClipboardCheck size={18} /><span><strong>AI-assisted assessment reviews</strong><small>Mentor validation required</small></span><div /><Sparkles size={18} /><span><strong>Coaching plan reviews</strong><small>Coming soon</small></span></div><div className="queue-table portal-queue"><div className="queue-table-head"><span>Review</span><span>Target profile</span><span>Received</span><span>Progress</span><span>Status</span><span>Action</span></div>{reviews.length === 0 ? <div className="empty-queue"><ClipboardCheck size={28} /><strong>No reviews available right now</strong><span>AI-drafted matching opportunities will appear here when ready.</span></div> : reviews.map((review) => { const submission = database.submissions.find((item) => item.id === review.submissionId); if (!submission) return null; const progress = Object.values(review.questionReviews).filter((item) => item.validated).length; const accepted = review.status !== 'available'; const total = accepted ? submission.questions.length : 0; return <div className="queue-row" key={review.id}><div className="candidate-cell"><i>{accepted ? submission.profile.name[0] : 'A'}</i><span><strong>AI-assisted review</strong><small>{accepted ? submission.profile.name : 'Candidate details unlock after acceptance'}</small></span></div><div><strong>{submission.role.name}</strong><small>{submission.industry.name} · {submission.profile.level}</small></div><div><strong>{new Date(submission.submittedAt).toLocaleDateString()}</strong><small>Complete within 24 hours of acceptance</small></div><div className="queue-progress"><strong>{accepted ? `${progress}/${total}` : '—'}</strong>{accepted && <span><i style={{ width: `${total ? progress / total * 100 : 0}%` }} /></span>}</div><div><span className={`review-status ${review.status}`}>{review.status.replace('_', ' ')}</span></div>{review.status === 'available' ? <div className="review-opportunity-actions"><button className="decline-review" onClick={() => onDecision(review.id, 'decline')}>Decline</button><button className="accept-review" onClick={() => onDecision(review.id, 'accept')}>Accept</button></div> : review.status === 'completed' ? <button className="review-action evaluation-action" onClick={() => onEvaluation(review.id)}>Evaluation Result <ArrowRight size={14} /></button> : <button className="review-action" onClick={() => onOpen(review.id)}>{progress ? 'Continue' : 'Start'} <ArrowRight size={14} /></button>}</div> })}</div></div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="workspace-stat"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>
}

function AdminPanel({ view, database, onView, onUpdate, onReviewerDecision, onPublish, onAiGovernance }: { view: AdminView; database: PortalDatabase; onView: (view: AdminView) => void; onUpdate: (database: PortalDatabase) => void; onReviewerDecision?: (userId: string, status: 'approved' | 'rejected') => Promise<void>; onPublish?: (submissionId: string, choice: string) => Promise<void>; onAiGovernance?: (input: { mode?: 'human_required' | 'ai_only'; minimumReviews?: number; maximumMae?: number; minimumExactAgreement?: number }) => Promise<void> }) {
  const pendingReviewers = database.reviewers.filter((item) => item.status === 'pending')
  const candidates = database.accounts.filter((item) => item.role === 'candidate')
  const pendingAssessments = database.submissions.filter((item) => ['awaiting_review', 'under_review'].includes(item.status))
  const adjudications = database.submissions.filter((item) => item.status === 'adjudication')
  const headings: Record<AdminView, { title: string; description: string }> = {
    dashboard: { title: 'Operations overview', description: 'Monitor registrations, mentor access, assessment reviews, and final scoring.' },
    reviewers: { title: 'Mentor registrations', description: 'Approve mentor profiles before they can receive matching review opportunities.' },
    candidates: { title: 'Candidate registrations', description: 'Track every registered candidate and whether their assessment is pending or completed.' },
    assessments: { title: 'Assessments with mentors', description: 'Monitor matching, acceptance, and scoring progress for submitted assessments.' },
    adjudication: { title: 'Score adjudication', description: 'Resolve independently completed mentor reviews and publish the final result.' },
    'ai-calibration': { title: 'AI calibration governance', description: 'Measure AI–mentor agreement and control when automated publication becomes eligible.' },
  }

  function approveReviewer(userId: string, status: 'approved' | 'rejected') {
    if (onReviewerDecision) {
      void onReviewerDecision(userId, status)
      return
    }
    const reviewers = database.reviewers.map((item) => item.userId === userId ? { ...item, status, approvedAt: status === 'approved' ? new Date().toISOString() : undefined } : item)
    let next = { ...database, reviewers }
    if (status === 'approved') {
      const reviewer = reviewers.find((item) => item.userId === userId)
      if (reviewer) {
        const openSubmissions = next.submissions.filter((submission) => submission.status !== 'published' && submission.assignedReviewerIds.length < 2 && (reviewer.roleIds.includes(submission.role.id) || reviewer.industryIds.includes(submission.industry.id)))
        openSubmissions.forEach((submission) => {
          if (next.reviews.some((review) => review.submissionId === submission.id && review.reviewerId === userId)) return
          const mentorAccount = next.accounts.find((account) => account.id === userId)
          const review: AssignedReview = { id: createId('REV'), submissionId: submission.id, reviewerId: userId, reviewerName: mentorAccount ? `${mentorAccount.firstName || ''} ${mentorAccount.lastName || ''}`.trim() || mentorAccount.email.split('@')[0] : 'Industry mentor', status: 'available', questionReviews: {} }
          next = { ...next, reviews: [...next.reviews, review] }
        })
      }
    }
    onUpdate(next)
  }

  function publish(submission: PortalSubmission, choice: string) {
    if (onPublish) {
      void onPublish(submission.id, choice)
      return
    }
    const completed = database.reviews.filter((review) => review.submissionId === submission.id && review.status === 'completed')
    const selected = choice === 'average' ? averageReviews(submission, completed) : scoreReview(submission, completed.find((review) => review.id === choice) ?? completed[0])
    const candidateNotification = { id: createId('NTF'), recipientId: submission.candidateId, type: 'results_ready' as const, subject: 'Your Zobology results are ready', createdAt: new Date().toISOString() }
    onUpdate({ ...database, submissions: database.submissions.map((item) => item.id === submission.id ? { ...item, status: 'published', finalAnswers: selected, adjudicatedAt: new Date().toISOString() } : item), notifications: [...database.notifications, candidateNotification] })
  }

  return (
    <div className="admin-page"><div className="workspace-heading"><div><div className="eyebrow"><span /> Admin control centre</div><h1>{headings[view].title}</h1><p>{headings[view].description}</p></div></div>
      {view === 'dashboard' && <><div className="admin-metrics"><Metric label="Registered mentors" value={database.reviewers.length} icon={<UserCheck />} /><Metric label="Registered candidates" value={candidates.length} icon={<Users />} /><Metric label="Pending mentor approvals" value={pendingReviewers.length} icon={<Clock3 />} alert={pendingReviewers.length > 0} /><Metric label="With mentors" value={pendingAssessments.length} icon={<ClipboardCheck />} alert={pendingAssessments.length > 0} /></div><div className="admin-actions"><button onClick={() => onView('reviewers')}><UserCheck /><span><b>Mentor registrations</b><small>{pendingReviewers.length} awaiting an approval decision</small></span><ArrowRight /></button><button onClick={() => onView('candidates')}><Users /><span><b>Candidate registrations</b><small>{candidates.length} candidates · assessment status tracking</small></span><ArrowRight /></button><button onClick={() => onView('assessments')}><ClipboardCheck /><span><b>Assessments with mentors</b><small>{pendingAssessments.length} currently awaiting or under review</small></span><ArrowRight /></button><button onClick={() => onView('ai-calibration')}><Bot /><span><b>AI calibration</b><small>{database.aiGovernance.reviews}/{database.aiGovernance.minimumReviews} mentor-validated reviews · {Math.round(database.aiGovernance.exactAgreement * 100)}% exact agreement</small></span><ArrowRight /></button><button onClick={() => onView('adjudication')}><ScaleIcon /><span><b>Resolve dual reviews</b><small>{adjudications.length} assessments need a final decision</small></span><ArrowRight /></button></div></>}
      {view === 'reviewers' && <ReviewerApprovals database={database} onDecision={approveReviewer} />}
      {view === 'candidates' && <CandidateRegistrations database={database} />}
      {view === 'assessments' && <PendingAssessments database={database} />}
      {view === 'ai-calibration' && <AiCalibrationPanel database={database} onUpdate={onAiGovernance} />}
      {view === 'adjudication' && <AdjudicationQueue database={database} onPublish={publish} />}
    </div>
  )
}

function Metric({ label, value, icon, alert }: { label: string; value: number; icon: React.ReactNode; alert?: boolean }) {
  return <article className={alert ? 'metric-card alert' : 'metric-card'}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></article>
}

function AiCalibrationPanel({ database, onUpdate }: { database: PortalDatabase; onUpdate?: (input: { mode?: 'human_required' | 'ai_only'; minimumReviews?: number; maximumMae?: number; minimumExactAgreement?: number }) => Promise<void> }) {
  const governance = database.aiGovernance
  const [minimumReviews, setMinimumReviews] = useState(governance.minimumReviews)
  const [maximumMae, setMaximumMae] = useState(governance.maximumMae)
  const [minimumAgreement, setMinimumAgreement] = useState(Math.round(governance.minimumExactAgreement * 100))
  const [saving, setSaving] = useState(false)

  async function update(input: Parameters<NonNullable<typeof onUpdate>>[0]) {
    if (!onUpdate) return
    setSaving(true)
    try { await onUpdate(input) } finally { setSaving(false) }
  }

  return <div className="ai-governance-page"><div className={`ai-mode-card ${governance.mode}`}><Bot size={28} /><div><small>Current publication mode · {governance.model}</small><h2>{governance.mode === 'human_required' ? 'AI draft + mandatory mentor validation' : 'AI-only publication enabled'}</h2><p>{governance.mode === 'human_required' ? 'No candidate score is published until a mentor validates every AI recommendation.' : 'Eligible, high-confidence assessments may publish automatically. Low-confidence evidence still routes to mentors.'}</p></div><span>{governance.mode.replace('_', ' ')}</span></div><div className="calibration-metrics"><article><small>Validated reviews</small><b>{governance.reviews}</b><span>Target {governance.minimumReviews}</span></article><article><small>Criterion comparisons</small><b>{governance.criteria}</b><span>AI vs mentor</span></article><article><small>Mean absolute difference</small><b>{governance.mae.toFixed(2)}</b><span>Target ≤ {governance.maximumMae.toFixed(2)}</span></article><article><small>Exact score agreement</small><b>{Math.round(governance.exactAgreement * 100)}%</b><span>Target ≥ {Math.round(governance.minimumExactAgreement * 100)}%</span></article></div><section className="calibration-controls"><div><h3>Calibration gate (“X”)</h3><p>Threshold changes are audited. AI-only mode remains locked until all three conditions pass.</p></div><label><span>Minimum mentor reviews</span><input type="number" min="20" max="10000" value={minimumReviews} onChange={(event) => setMinimumReviews(Number(event.target.value))} /></label><label><span>Maximum mean difference</span><input type="number" min="0" max="3" step="0.05" value={maximumMae} onChange={(event) => setMaximumMae(Number(event.target.value))} /></label><label><span>Minimum exact agreement (%)</span><input type="number" min="0" max="100" value={minimumAgreement} onChange={(event) => setMinimumAgreement(Number(event.target.value))} /></label><button className="secondary-button" disabled={saving} onClick={() => void update({ minimumReviews, maximumMae, minimumExactAgreement: minimumAgreement / 100 })}>Save thresholds</button></section><div className={`calibration-decision ${governance.eligible ? 'eligible' : ''}`}><ShieldCheck size={20} /><span><b>{governance.eligible ? 'Calibration gate passed' : 'Human validation remains mandatory'}</b><small>{governance.eligible ? 'An admin may now enable AI-only publication. This action is reversible.' : 'More mentor-reviewed evidence or stronger agreement is required before AI-only mode can be enabled.'}</small></span>{governance.mode === 'human_required' ? <button disabled={!governance.eligible || saving} onClick={() => void update({ mode: 'ai_only' })}>Enable AI-only</button> : <button onClick={() => void update({ mode: 'human_required' })}>Require mentors again</button>}</div></div>
}

function ScaleIcon() { return <span className="scale-icon">⚖</span> }

function ReviewerApprovals({ database, onDecision }: { database: PortalDatabase; onDecision: (userId: string, status: 'approved' | 'rejected') => void }) {
  const profiles = [...database.reviewers].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.appliedAt.localeCompare(a.appliedAt))
  return <><div className="admin-rule-note"><ShieldCheck size={18} /><span><b>Approval controls matching access</b><small>Only approved mentors are included when Zobology generates assessment review opportunities.</small></span></div><div className="approval-list">{profiles.length === 0 ? <div className="empty-admin">No mentor registrations.</div> : profiles.map((profile) => { const account = database.accounts.find((item) => item.id === profile.userId); const name = account ? `${account.firstName || ''} ${account.lastName || ''}`.trim() : ''; return <article key={profile.userId}><div className="reviewer-identity"><i>{(name || account?.email || 'M')[0].toUpperCase()}</i><span><b>{name || account?.email}</b><small>{account?.email} · Registered {new Date(profile.appliedAt).toLocaleDateString()}</small></span><em className={`approval-status ${profile.status}`}>{profile.status}</em></div><div className="mentor-credentials">{profile.linkedinProfile ? <a href={profile.linkedinProfile} target="_blank" rel="noreferrer">View LinkedIn profile ↗</a> : <span>LinkedIn not provided</span>}{profile.resumeKey ? backendEnabled ? <a href={`/api/files/${encodeURIComponent(profile.resumeKey)}`} target="_blank" rel="noreferrer">View résumé ↗</a> : <span>Résumé attached</span> : <span>No résumé provided</span>}</div><div className="expertise-tags"><div><small>Roles</small><p>{profile.roleIds.map((id) => roles.find((item) => item.id === id)?.name).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</p></div><div><small>Industries</small><p>{profile.industryIds.map((id) => industries.find((item) => item.id === id)?.name).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</p></div></div>{profile.status === 'pending' && <div className="approval-actions"><button className="reject-button" onClick={() => onDecision(profile.userId, 'rejected')}>Reject</button><button className="approve-button" onClick={() => onDecision(profile.userId, 'approved')}><Check size={15} /> Approve mentor</button></div>}</article> })}</div></>
}

function candidateAssessmentStatus(submission?: PortalSubmission) {
  if (!submission) return { label: 'Assessment pending', detail: 'Not submitted', tone: 'pending' }
  if (submission.status === 'awaiting_review') return { label: 'Assessment done', detail: 'Waiting for mentor', tone: 'active' }
  if (submission.status === 'under_review') return { label: 'Assessment done', detail: 'Mentor review in progress', tone: 'active' }
  if (submission.status === 'adjudication') return { label: 'Assessment done', detail: 'Admin decision pending', tone: 'decision' }
  return { label: 'Assessment complete', detail: 'Result published', tone: 'done' }
}

function CandidateRegistrations({ database }: { database: PortalDatabase }) {
  const candidates = database.accounts.filter((item) => item.role === 'candidate').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <div className="admin-data-table candidate-admin-table"><div className="admin-data-head"><span>Candidate</span><span>Registered</span><span>Target profile</span><span>Assessment status</span></div>{candidates.length === 0 ? <div className="empty-admin">No candidate registrations.</div> : candidates.map((candidate) => { const submission = database.submissions.filter((item) => item.candidateId === candidate.id).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]; const status = candidateAssessmentStatus(submission); const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email; return <div className="admin-data-row" key={candidate.id}><div className="admin-person"><i>{name[0].toUpperCase()}</i><span><b>{name}</b><small>{candidate.email}</small></span></div><div><b>{new Date(candidate.createdAt).toLocaleDateString()}</b><small>{candidate.id}</small></div><div><b>{submission?.role.name ?? 'Not selected'}</b><small>{submission ? `${submission.industry.name} · ${submission.profile.level}` : 'Profile or assessment not submitted'}</small></div><div><em className={`admin-status ${status.tone}`}>{status.label}</em><small>{status.detail}</small></div></div> })}</div>
}

function PendingAssessments({ database }: { database: PortalDatabase }) {
  const submissions = database.submissions.filter((item) => ['awaiting_review', 'under_review'].includes(item.status)).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  return <div className="assessment-monitor-list">{submissions.length === 0 ? <div className="empty-admin"><CheckCircle2 size={26} /><b>No assessments pending with mentors</b><span>Newly submitted and active mentor reviews will appear here.</span></div> : submissions.map((submission) => { const reviews = database.reviews.filter((item) => item.submissionId === submission.id && item.status !== 'declined'); const active = reviews.filter((item) => ['accepted', 'in_review', 'completed'].includes(item.status)); const available = reviews.filter((item) => item.status === 'available'); const completed = reviews.filter((item) => item.status === 'completed'); return <article key={submission.id} className="assessment-monitor-card"><div className="assessment-monitor-head"><div><small>{submission.id}</small><h3>{submission.profile.name}</h3><p>{submission.role.name} · {submission.industry.name} · {submission.profile.level}</p></div><em className={`admin-status ${submission.status === 'awaiting_review' ? 'pending' : 'active'}`}>{submission.status === 'awaiting_review' ? 'Waiting for mentor' : 'Under review'}</em></div><div className="assessment-monitor-metrics"><span><small>Submitted</small><b>{new Date(submission.submittedAt).toLocaleString()}</b></span><span><small>Mentors accepted</small><b>{active.length}/2</b></span><span><small>Reviews completed</small><b>{completed.length}/2</b></span><span><small>Open opportunities</small><b>{available.length}</b></span></div><div className="mentor-progress"><small>Mentor progress</small>{reviews.length === 0 ? <p>No approved mentor match is currently available.</p> : <div>{reviews.slice(0, 8).map((review) => <span key={review.id}><b>{review.reviewerName}</b><em className={`review-status ${review.status}`}>{review.status.replace('_', ' ')}</em></span>)}{reviews.length > 8 && <span><b>+{reviews.length - 8} more matching mentors</b></span>}</div>}</div></article> })}</div>
}

function AdjudicationQueue({ database, onPublish }: { database: PortalDatabase; onPublish: (submission: PortalSubmission, choice: string) => void }) {
  const submissions = database.submissions.filter((item) => item.status === 'adjudication')
  return <div className="adjudication-list">{submissions.length === 0 ? <div className="empty-admin"><CheckCircle2 size={26} /><b>No scores awaiting approval</b><span>Assessments appear here after two independent reviews are complete.</span></div> : submissions.map((submission) => { const reviews = database.reviews.filter((item) => item.submissionId === submission.id && item.status === 'completed'); return <AdjudicationCard key={submission.id} submission={submission} reviews={reviews} onPublish={onPublish} /> })}</div>
}

function AdjudicationCard({ submission, reviews, onPublish }: { submission: PortalSubmission; reviews: AssignedReview[]; onPublish: (submission: PortalSubmission, choice: string) => void }) {
  const [choice, setChoice] = useState('average')
  const scores = reviews.map((review) => ({ review, score: overallScore(submission, scoreReview(submission, review)) }))
  const average = Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length)
  return <article className="adjudication-card"><div className="adjudication-head"><div><small>{submission.id}</small><h3>{submission.profile.name}</h3><p>{submission.role.name} · {submission.industry.name}</p></div><span className="review-status in_review">Admin decision</span></div><div className="score-comparison">{scores.map((item, index) => <label key={item.review.id} className={choice === item.review.id ? 'selected' : ''}><input type="radio" name={submission.id} value={item.review.id} checked={choice === item.review.id} onChange={() => setChoice(item.review.id)} /><span><small>Mentor {index + 1}</small><b>{item.score}</b><em>{item.review.reviewerName}</em></span></label>)}<label className={choice === 'average' ? 'selected average' : 'average'}><input type="radio" name={submission.id} checked={choice === 'average'} onChange={() => setChoice('average')} /><span><small>Panel average</small><b>{average}</b><em>Recommended</em></span></label></div><div className="variance-note"><Sparkles size={16} /><span><b>Score variance: {Math.abs((scores[0]?.score ?? 0) - (scores[1]?.score ?? 0))} points</b><small>Review individual evidence and select the defensible final outcome.</small></span></div><button className="primary-button compact" onClick={() => onPublish(submission, choice)}>Approve and publish result <ArrowRight size={16} /></button></article>
}
