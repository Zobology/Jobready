import { pool } from '../db.js'

const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM ?? 'Zobology <noreply@zobology.in>'
const appUrl = process.env.APP_URL ?? 'https://www.zobology.in'

if (!apiKey) throw new Error('RESEND_API_KEY is required')

const templates: Record<string, { subject: string; message: string }> = {
  candidate_welcome: { subject: 'Welcome to Zobology', message: 'Welcome to Zobology. Your account is ready, and you can now build your target job profile and begin your job readiness assessment.' },
  assessment_submitted: { subject: 'We received your Zobology assessment', message: 'Your assessment has been submitted successfully. Our industry experts will complete the evaluation within 24 hours.' },
  review_assigned: { subject: 'New Zobology assessment assigned', message: 'A matched assessment is waiting in your mentor queue. Please complete it within 24 hours.' },
  reviewer_application_received: { subject: 'We received your Zobology mentor application', message: 'Thank you for registering as an industry mentor. Our team will review your profile and notify you when it is approved.' },
  reviewer_approved: { subject: 'Your Zobology mentor profile is approved', message: 'Your mentor account is approved. You can now receive matched assessments.' },
  reviewer_rejected: { subject: 'Update on your Zobology mentor application', message: 'Your mentor application was not approved at this time. You can contact the Zobology team if you would like further information.' },
  results_ready: { subject: 'Your Zobology results are ready', message: 'Your expert-reviewed job readiness results are ready.' },
}

async function run() {
  await pool.query('delete from user_sessions where expires_at < now()')
  const pending = await pool.query<{ id: string; email: string; first_name: string | null; last_name: string | null; event_type: string; attempt_count: number }>(
    `select n.id, u.email::text, u.first_name, u.last_name, n.event_type, n.attempt_count
     from notification_outbox n join users u on u.id=n.recipient_id
     where n.sent_at is null and n.attempt_count < 5
     order by n.created_at limit 100`,
  )
  for (const notification of pending.rows) {
    const template = templates[notification.event_type]
    const firstName = notification.first_name?.trim() || 'there'
    try {
      const result = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [notification.email],
          subject: template.subject,
          html: `<div style="font-family:Arial,sans-serif;color:#17312b"><h2>Zobology</h2><p>Hi ${firstName.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)},</p><p>${template.message}</p><p><a href="${appUrl}">Open Zobology</a></p></div>`,
        }),
      })
      if (!result.ok) throw new Error(await result.text())
      await pool.query('update notification_outbox set sent_at=now(), attempt_count=attempt_count+1, last_error=null where id=$1', [notification.id])
    } catch (error) {
      await pool.query('update notification_outbox set attempt_count=attempt_count+1, last_error=$2 where id=$1', [notification.id, String(error).slice(0, 2000)])
    }
  }
  console.log(`Processed ${pending.rowCount ?? 0} notifications`)
  await pool.end()
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
