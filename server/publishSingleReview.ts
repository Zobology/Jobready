import { pool, transaction } from './db.js'

const candidateEmail = process.env.CANDIDATE_EMAIL?.trim().toLowerCase()

if (!candidateEmail) throw new Error('CANDIDATE_EMAIL is required')

type AssessmentRow = {
  id: string
  candidate_id: string
  status: string
  questions: Array<{ id: string; rubric: string[] }>
  answers: Record<string, Record<string, unknown>>
}

type ReviewRow = {
  id: string
  reviewer_id: string
  status: string
  rubric_scores: Record<string, { criteria?: Record<string, { score?: number }>; comment?: string }>
}

function scoreReview(assessment: AssessmentRow, review: ReviewRow) {
  return Object.fromEntries(assessment.questions.map((question) => {
    const evaluation = review.rubric_scores[question.id]
    const values = question.rubric
      .map((criterion) => evaluation?.criteria?.[criterion]?.score)
      .filter((score): score is number => Number.isFinite(score))
    return [question.id, {
      ...assessment.answers[question.id],
      score: values.length ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length * 25) : 0,
      feedback: evaluation?.comment || 'Reviewed against the job-specific rubric.',
    }]
  }))
}

async function publishSingleReview() {
  const result = await transaction(async (client) => {
    const candidate = (await client.query<{ id: string }>(
      `select id from users where lower(email::text)=$1 and role='candidate'`,
      [candidateEmail],
    )).rows[0]
    if (!candidate) throw new Error(`Candidate account not found: ${candidateEmail}`)

    const assessment = (await client.query<AssessmentRow>(
      `select a.id,a.candidate_id,a.status,a.questions,a.answers
       from assessments a
       where a.candidate_id=$1
         and exists(select 1 from review_assignments ra where ra.assessment_id=a.id and ra.review_type='mentor' and ra.status='completed')
       order by a.submitted_at desc limit 1 for update`,
      [candidate.id],
    )).rows[0]
    if (!assessment) throw new Error(`No assessment with a completed review found for ${candidateEmail}`)

    if (assessment.status !== 'published') {
      const activeReviews = (await client.query<ReviewRow>(
        `select id,reviewer_id,status,rubric_scores from review_assignments
         where assessment_id=$1 and review_type='mentor' and status in ('accepted','in_review','completed')
         order by completed_at nulls last,assigned_at`,
        [assessment.id],
      )).rows
      const completedReviews = activeReviews.filter((review) => review.status === 'completed')
      if (completedReviews.length !== 1) throw new Error(`Expected exactly one completed review; found ${completedReviews.length}`)
      if (activeReviews.length !== 1) throw new Error(`A second mentor is active on this assessment; admin adjudication is required`)

      const finalAnswers = scoreReview(assessment, completedReviews[0])
      await client.query(
        `update assessments set status='published',final_answers=$1,adjudicated_at=now() where id=$2`,
        [JSON.stringify(finalAnswers), assessment.id],
      )
      await client.query(
        `update review_assignments set status='declined' where assessment_id=$1 and review_type='mentor' and status='available'`,
        [assessment.id],
      )
      await client.query(
        `insert into audit_log(action,entity_type,entity_id,metadata)
         values('historic_single_review_published','assessment',$1,jsonb_build_object('candidate_email',$2::text,'review_id',$3::text))`,
        [assessment.id, candidateEmail, completedReviews[0].id],
      )
    }

    const notification = await client.query<{ id: string }>(
      `insert into notification_outbox(recipient_id,event_type,payload)
       select $1,'results_ready',jsonb_build_object('assessment_id',$2::uuid,'subject','Your Zobology results are ready')
       where not exists(
         select 1 from notification_outbox
         where recipient_id=$1 and event_type='results_ready' and payload->>'assessment_id'=($2::uuid)::text
       ) returning id`,
      [candidate.id, assessment.id],
    )
    return { assessmentId: assessment.id, emailQueued: Boolean(notification.rows[0]) }
  })
  console.log(`Assessment ${result.assessmentId} is published for ${candidateEmail}. Results email ${result.emailQueued ? 'queued' : 'was already queued'}.`)
}

publishSingleReview()
  .catch((error) => { console.error(error); process.exitCode = 1 })
  .finally(() => pool.end())
