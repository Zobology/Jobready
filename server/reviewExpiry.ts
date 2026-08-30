import { transaction } from './db.js'

export async function expireOverdueMentorReviews() {
  return transaction(async (client) => {
    const expired = await client.query<{ id: string; assessment_id: string }>(
      `update review_assignments
       set status='expired'
       where review_type='mentor'
         and status in ('accepted','in_review')
         and accepted_at <= now() - interval '12 hours'
       returning id,assessment_id`,
    )
    if (!expired.rowCount) return 0

    const assessmentIds = [...new Set(expired.rows.map((row) => row.assessment_id))]
    await client.query(
      `update review_assignments
       set status='declined'
       where assessment_id=any($1::uuid[])
         and review_type='mentor'
         and status='available'`,
      [assessmentIds],
    )
    for (const review of expired.rows) {
      await client.query(
        `insert into audit_log(action,entity_type,entity_id,metadata)
         values('mentor_review_expired','assessment',$1,jsonb_build_object('review_id',$2::text,'deadline_hours',12))`,
        [review.assessment_id, review.id],
      )
    }
    return expired.rowCount
  })
}
