import type { PoolClient } from 'pg'
import { pool } from './db.js'
import type { AuthenticatedUser } from './auth.js'

function account(row: Record<string, unknown>) {
  return { id: row.id, email: row.email, passwordHash: '', role: row.role, createdAt: row.created_at }
}

function reviewer(row: Record<string, unknown>) {
  return {
    userId: row.user_id,
    roleIds: row.role_ids,
    industryIds: row.industry_ids,
    status: row.status,
    appliedAt: row.applied_at,
    approvedAt: row.approved_at ?? undefined,
  }
}

function submission(row: Record<string, unknown>) {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    submittedAt: row.submitted_at,
    profile: row.profile_snapshot,
    role: row.role_snapshot,
    industry: row.industry_snapshot,
    questions: row.questions,
    answers: row.answers,
    status: row.status,
    assignedReviewerIds: row.assigned_reviewer_ids ?? [],
    finalAnswers: row.final_answers ?? undefined,
    adjudicatedAt: row.adjudicated_at ?? undefined,
  }
}

function review(row: Record<string, unknown>) {
  return {
    id: row.id,
    submissionId: row.assessment_id,
    reviewerId: row.reviewer_id,
    reviewerName: String(row.reviewer_email ?? 'Industry expert').split('@')[0],
    status: row.status,
    questionReviews: row.rubric_scores ?? {},
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  }
}

const submissionSelect = `
  select a.*,
    coalesce(array_agg(ra.reviewer_id) filter (where ra.reviewer_id is not null), '{}') as assigned_reviewer_ids
  from assessments a left join review_assignments ra on ra.assessment_id = a.id
`

export async function loadPortalState(user: AuthenticatedUser) {
  const accounts = user.role === 'admin'
    ? (await pool.query('select id, email::text, role, created_at from users order by created_at')).rows.map(account)
    : [account({ ...user, created_at: new Date().toISOString() })]

  const reviewerRows = user.role === 'admin'
    ? (await pool.query('select * from reviewer_profiles order by applied_at desc')).rows
    : user.role === 'reviewer'
      ? (await pool.query('select * from reviewer_profiles where user_id = $1', [user.id])).rows
      : []

  const submissionQuery = user.role === 'admin'
    ? `${submissionSelect} group by a.id order by a.submitted_at desc`
    : user.role === 'candidate'
      ? `${submissionSelect} where a.candidate_id = $1 group by a.id order by a.submitted_at desc`
      : `${submissionSelect} where exists (
          select 1 from review_assignments own where own.assessment_id = a.id and own.reviewer_id = $1
        ) group by a.id order by a.submitted_at desc`
  const submissionRows = (await pool.query(submissionQuery, user.role === 'admin' ? [] : [user.id])).rows

  const reviewQuery = user.role === 'admin'
    ? `select ra.*, u.email::text reviewer_email from review_assignments ra join users u on u.id = ra.reviewer_id order by ra.assigned_at desc`
    : user.role === 'reviewer'
      ? `select ra.*, u.email::text reviewer_email from review_assignments ra join users u on u.id = ra.reviewer_id where ra.reviewer_id = $1 order by ra.assigned_at desc`
      : null
  const reviewRows = reviewQuery ? (await pool.query(reviewQuery, user.role === 'admin' ? [] : [user.id])).rows : []

  const notifications = (await pool.query(
    `select id, recipient_id, event_type, payload, created_at, sent_at from notification_outbox
     where recipient_id = $1 order by created_at desc limit 50`,
    [user.id],
  )).rows.map((row) => ({
    id: row.id,
    recipientId: row.recipient_id,
    type: row.event_type,
    subject: row.payload?.subject ?? row.event_type.replaceAll('_', ' '),
    createdAt: row.created_at,
    sentAt: row.sent_at ?? undefined,
  }))

  return {
    accounts,
    reviewers: reviewerRows.map(reviewer),
    submissions: submissionRows.map(submission),
    reviews: reviewRows.map(review),
    notifications,
  }
}

export async function assignBestReviewers(client: PoolClient, assessmentId: string, roleId: string, industryId: string) {
  const candidates = await client.query<{ user_id: string; match_score: number }>(
    `select rp.user_id,
      ((case when $1 = any(rp.role_ids) then 2 else 0 end) +
       (case when $2 = any(rp.industry_ids) then 1 else 0 end))::int match_score
     from reviewer_profiles rp
     left join review_assignments ra on ra.reviewer_id = rp.user_id and ra.status <> 'completed'
     where rp.status = 'approved' and ($1 = any(rp.role_ids) or $2 = any(rp.industry_ids))
     group by rp.user_id, rp.role_ids, rp.industry_ids, rp.applied_at
     order by match_score desc, count(ra.id) asc, rp.applied_at asc
     limit 2`,
    [roleId, industryId],
  )
  for (const match of candidates.rows) {
    const assignment = await client.query<{ id: string }>(
      `insert into review_assignments (assessment_id, reviewer_id, match_score)
       values ($1, $2, $3) on conflict do nothing returning id`,
      [assessmentId, match.user_id, match.match_score],
    )
    if (assignment.rows[0]) {
      await client.query(
        `insert into notification_outbox (recipient_id, event_type, payload)
         values ($1, 'review_assigned', jsonb_build_object('assessment_id', $2::uuid, 'assignment_id', $3::uuid, 'subject', 'New Zobology assessment assigned'))`,
        [match.user_id, assessmentId, assignment.rows[0].id],
      )
    }
  }
  await client.query(
    `update assessments set status = case when exists(select 1 from review_assignments where assessment_id = $1)
      then 'under_review' else 'awaiting_review' end where id = $1`,
    [assessmentId],
  )
}
