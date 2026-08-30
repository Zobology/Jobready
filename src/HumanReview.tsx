import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  FileSpreadsheet,
  Inbox,
  Mic,
  Bot,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import type { Industry, Question, RoleFamily } from './data'
import type { AssessmentAnswer, CandidateProfile, HumanReview, RubricScore } from './reviewTypes'

const scoreLevels: Array<{ score: RubricScore; label: string; short: string }> = [
  { score: 1, label: 'Awareness', short: 'Limited evidence' },
  { score: 2, label: 'Foundation', short: 'Needs guidance' },
  { score: 3, label: 'Job ready', short: 'Independent' },
  { score: 4, label: 'Advanced', short: 'Handles complexity' },
]

export function SubmissionConfirmation({
  profile,
  role,
  industry,
  submissionId,
  submittedAt,
  review,
  onOpenReview,
  onViewResults,
}: {
  profile: CandidateProfile
  role: RoleFamily
  industry: Industry
  submissionId: string
  submittedAt: string
  review: HumanReview
  onOpenReview: () => void
  onViewResults: () => void
}) {
  const completed = review.status === 'completed'
  return (
    <div className="submission-page">
      <section className="submission-card">
        <div className={completed ? 'submission-icon completed' : 'submission-icon'}>
          {completed ? <CheckCircle2 size={31} /> : <ClipboardCheck size={31} />}
        </div>
        <div className="eyebrow"><span /> {completed ? 'AI evaluation complete' : 'Assessment submitted'}</div>
        <h1>{completed ? `${profile.name}, your results are ready.` : `Thank you, ${profile.name}.`}</h1>
        <p>{completed
          ? 'Your readiness scores reflect evidence-based evaluation against job-specific competency rubrics.'
          : 'Zobology’s AI is analyzing your responses against the benchmark for your target role and industry.'}</p>

        <div className="submission-summary">
          <div><small>Target profile</small><strong>{role.name}</strong><span>{industry.name} · {profile.level}</span></div>
          <div><small>Submission ID</small><strong>{submissionId}</strong><span>{new Date(submittedAt).toLocaleString()}</span></div>
          <div><small>Evaluation status</small><strong className={`status-${review.status}`}>{review.status.replace('_', ' ')}</strong><span>{completed ? 'Evaluation complete' : 'Quality checks in progress'}</span></div>
        </div>

        <div className="human-review-note"><ShieldCheck size={19} /><span><strong>AI Powered · Industry Expert Governed</strong>Your evidence is evaluated criterion by criterion against the target role benchmark.</span></div>
        <div className="submission-actions">
          {completed
            ? <button className="primary-button compact" onClick={onViewResults}>View results <ArrowRight size={17} /></button>
            : <button className="secondary-button" onClick={onOpenReview}><UserCheck size={17} /> Open mentor workspace</button>}
        </div>
      </section>
    </div>
  )
}

export function ReviewQueue({
  hasSubmission,
  profile,
  role,
  industry,
  submissionId,
  submittedAt,
  review,
  totalQuestions,
  onOpen,
}: {
  hasSubmission: boolean
  profile: CandidateProfile
  role: RoleFamily
  industry: Industry
  submissionId: string
  submittedAt: string
  review: HumanReview
  totalQuestions: number
  onOpen: () => void
}) {
  const reviewed = Object.keys(review.questionReviews).length
  return (
    <div className="queue-page">
      <div className="queue-heading">
        <div><div className="eyebrow"><span /> Expert workspace</div><h1>Assessment review queue</h1><p>Evaluate candidate evidence against standardized, job-specific rubrics.</p></div>
        <div className="queue-stat"><Inbox size={19} /><span><small>Open reviews</small><strong>{hasSubmission && review.status !== 'completed' ? 1 : 0}</strong></span></div>
      </div>

      <div className="queue-filters"><button className="active">All submissions</button><button>Pending</button><button>In review</button><button>Completed</button></div>
      <div className="queue-table">
        <div className="queue-table-head"><span>Candidate</span><span>Target job profile</span><span>Submitted</span><span>Progress</span><span>Status</span><span /></div>
        {!hasSubmission ? (
          <div className="empty-queue"><Inbox size={28} /><strong>No assessments submitted yet</strong><span>Completed candidate assessments will appear here.</span></div>
        ) : (
          <div className="queue-row">
            <div className="candidate-cell"><i>{profile.name.slice(0, 1).toUpperCase()}</i><span><strong>{profile.name}</strong><small>{submissionId}</small></span></div>
            <div><strong>{role.name}</strong><small>{industry.name} · {profile.level}</small></div>
            <div><strong>{new Date(submittedAt).toLocaleDateString()}</strong><small>{new Date(submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
            <div className="queue-progress"><strong>{reviewed}/{totalQuestions}</strong><span><i style={{ width: `${(reviewed / totalQuestions) * 100}%` }} /></span></div>
            <div><span className={`review-status ${review.status}`}>{review.status.replace('_', ' ')}</span></div>
            <button className="review-action" onClick={onOpen}>{review.status === 'completed' ? 'View review' : reviewed ? 'Continue' : 'Start review'} <ArrowRight size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ReviewWorkspace({
  profile,
  role,
  industry,
  questions,
  answers,
  review,
  currentIndex,
  onSelect,
  onChange,
  onExit,
  onFinalize,
  audience = 'mentor',
}: {
  profile: CandidateProfile
  role: RoleFamily
  industry: Industry
  questions: Question[]
  answers: Record<string, AssessmentAnswer>
  review: HumanReview
  currentIndex: number
  onSelect: (index: number) => void
  onChange: (review: HumanReview) => void
  onExit: () => void
  onFinalize: (review: HumanReview) => void
  audience?: 'mentor' | 'admin'
}) {
  const question = questions[currentIndex]
  const answer = answers[question.id]
  const questionReview = review.questionReviews[question.id] ?? { criteria: {}, comment: '' }
  const reviewedCount = questions.filter((item) => {
    const itemReview = review.questionReviews[item.id]
    return itemReview?.validated && item.rubric.every((criterion) => itemReview.criteria[criterion]?.score)
  }).length
  const currentComplete = question.rubric.every((criterion) => questionReview.criteria[criterion]?.score)
  const readOnly = review.status === 'completed'
  const hasAiDraft = Object.values(questionReview.criteria).some((criterion) => criterion.aiScore)

  function updateCriterion(criterion: string, score: RubricScore) {
    if (readOnly) return
    onChange({
      ...review,
      status: 'in_review',
      startedAt: review.startedAt ?? new Date().toISOString(),
      questionReviews: {
        ...review.questionReviews,
        [question.id]: {
          ...questionReview,
          validated: false,
          criteria: { ...questionReview.criteria, [criterion]: { ...questionReview.criteria[criterion], score } },
        },
      },
    })
  }

  function updateComment(comment: string) {
    if (readOnly) return
    onChange({
      ...review,
      status: 'in_review',
      startedAt: review.startedAt ?? new Date().toISOString(),
      questionReviews: { ...review.questionReviews, [question.id]: { ...questionReview, comment, validated: false } },
    })
  }

  function validatedReview() {
    return {
      ...review,
      status: 'in_review' as const,
      questionReviews: {
        ...review.questionReviews,
        [question.id]: { ...questionReview, validated: true },
      },
    }
  }

  return (
    <div className="review-workspace">
      <aside className="review-sidebar">
        <button className="back-to-queue" onClick={onExit}><ArrowLeft size={15} /> {audience === 'admin' ? 'All assessments' : 'Review queue'}</button>
        <div className="review-candidate"><i>{profile.name.slice(0, 1).toUpperCase()}</i><span><strong>{profile.name}</strong><small>{role.name}<br />{industry.name} · {profile.level}</small>{profile.resumeKey && <a href={`/api/files/${encodeURIComponent(profile.resumeKey)}`} target="_blank" rel="noreferrer">View candidate résumé ↗</a>}</span></div>
        <div className="review-progress-summary"><span><strong>{reviewedCount}</strong> of {questions.length} reviewed</span><div><i style={{ width: `${(reviewedCount / questions.length) * 100}%` }} /></div></div>
        <div className="review-question-list">
          {questions.map((item, index) => {
            const itemReview = review.questionReviews[item.id]
            const complete = itemReview?.validated && item.rubric.every((criterion) => itemReview.criteria[criterion]?.score)
            return <button key={item.id} className={index === currentIndex ? 'active' : ''} onClick={() => onSelect(index)}><i>{complete ? <Check size={12} /> : index + 1}</i><span><strong>{item.competency}</strong><small>{item.dimension.replace('_', ' ')}</small></span></button>
          })}
        </div>
      </aside>

      <section className="review-stage">
        <div className="review-topline"><span>Question {currentIndex + 1} of {questions.length}</span><span className={`review-status ${review.status}`}>{review.status.replace('_', ' ')}</span></div>
        {hasAiDraft && <div className="ai-review-banner"><Bot size={19} /><span><strong>AI draft—{audience === 'admin' ? 'admin calibration' : 'mentor validation'} required</strong><small>Review the evidence, confirm or change every suggested score, and edit the feedback before finalizing.</small></span></div>}
        <article className="review-evidence-card">
          <div className="evidence-label"><FileText size={15} /> Candidate evidence · {question.bankId}</div>
          <h1>{question.prompt}</h1>
          {question.sampleData && <a className="source-workbook" href={question.sampleData.downloadUrl} target="_blank" rel="noreferrer"><FileSpreadsheet size={15} /> Download source dataset</a>}
          <div className="candidate-response">
            <div><span>{question.responseType === 'audio' ? <Mic size={16} /> : <FileText size={16} />}<strong>{question.responseType === 'audio' ? 'Audio response' : 'Written response'}</strong></span><small>{question.responseType === 'audio' ? `${answer?.duration ?? 0}s` : `${answer?.text?.trim().split(/\s+/).length ?? 0} words`}</small></div>
            {question.responseType === 'audio' ? (
              <>{answer?.audioUrl && <audio controls src={answer.audioUrl} />}<p>{answer?.transcript || 'Transcript unavailable. Review the original recording.'}</p></>
            ) : <p>{answer?.text || 'No written response was captured.'}</p>}
            {answer?.workbookUrl && <a className="submitted-workbook" href={answer.workbookUrl} target="_blank" rel="noreferrer"><FileSpreadsheet size={16} /><span><strong>Open completed workbook</strong><small>{answer.workbookName || 'Candidate Excel analysis'}</small></span></a>}
          </div>
        </article>

        <section className="rubric-review-card">
          <div className="rubric-review-heading"><div><ClipboardCheck size={19} /><span><strong>Score against the rubric</strong><small>Select the demonstrated proficiency for every criterion.</small></span></div><span>{Object.keys(questionReview.criteria).length}/{question.rubric.length} scored</span></div>
          <div className="criterion-list">
            {question.rubric.map((criterion) => (
              <div className="criterion-row" key={criterion}>
                <strong>{criterion}{questionReview.criteria[criterion]?.aiScore && <small>AI suggested {questionReview.criteria[criterion].aiScore}/4 · {Math.round((questionReview.criteria[criterion].confidence ?? 0) * 100)}% confidence</small>}</strong>
                {questionReview.criteria[criterion]?.rationale && <p className="ai-rationale">{questionReview.criteria[criterion].rationale}</p>}
                <div>{scoreLevels.map((level) => <button key={level.score} disabled={readOnly} title={level.short} className={questionReview.criteria[criterion]?.score === level.score ? 'selected' : ''} onClick={() => updateCriterion(criterion, level.score)}><i>{level.score}</i><span>{level.label}</span></button>)}</div>
              </div>
            ))}
          </div>
          <label className="review-comment"><span>{audience === 'admin' ? 'Admin calibration note' : 'Mentor feedback'} <small>{readOnly ? 'Final' : 'Recommended'}</small></span><textarea disabled={readOnly} rows={3} value={questionReview.comment} onChange={(event) => updateComment(event.target.value)} placeholder="Record evidence, strengths, gaps, and actionable feedback…" /></label>
        </section>

        <div className="review-navigation">
          <button className="secondary-button" disabled={currentIndex === 0} onClick={() => onSelect(currentIndex - 1)}><ArrowLeft size={16} /> Previous</button>
          <span><Clock3 size={14} /> Review saved automatically</span>
          {readOnly
            ? <button className="primary-button compact" onClick={onExit}><CheckCircle2 size={16} /> Review complete</button>
            : currentIndex < questions.length - 1
            ? <button className="primary-button compact" disabled={!currentComplete} onClick={() => { onChange(validatedReview()); onSelect(currentIndex + 1) }}>Confirm & next <ArrowRight size={16} /></button>
            : <button className="primary-button compact" disabled={!currentComplete || reviewedCount < questions.length - 1} onClick={() => onFinalize(validatedReview())}><CheckCircle2 size={16} /> {audience === 'admin' ? 'Complete calibration review' : 'Validate and finalize'}</button>}
        </div>
      </section>
    </div>
  )
}
