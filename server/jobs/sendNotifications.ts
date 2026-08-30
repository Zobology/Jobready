import { pool } from '../db.js'

const apiKey = process.env.RESEND_API_KEY
const from = process.env.EMAIL_FROM ?? 'Zobology <noreply@zobology.in>'
const appUrl = (process.env.APP_URL ?? 'https://www.zobology.in').replace(/\/$/, '')
const resendApiUrl = process.env.RESEND_API_URL ?? 'https://api.resend.com/emails'

if (!apiKey) throw new Error('RESEND_API_KEY is required')

interface NotificationRow {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  event_type: string
  payload: Record<string, string> | null
  candidate_name: string | null
  role_name: string | null
  industry_name: string | null
  submitted_at: string | null
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

function button(label: string, url: string) {
  return `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;color:#fff;background:#176b58;border-radius:8px;font-weight:700;text-decoration:none">${escapeHtml(label)}</a></p>`
}

function signature() {
  return '<p style="margin-top:26px">Best regards,<br><strong>Team Zobology</strong><br><span style="color:#176b58;font-weight:700">Assess. Improve. Get Hired.</span></p>'
}

function layout(content: string) {
  return `<div style="margin:0;padding:30px 14px;background:#f4f7f5"><div style="max-width:640px;margin:auto;overflow:hidden;background:#fff;border:1px solid #e0e8e4;border-radius:14px;font-family:Arial,sans-serif;color:#17312b;line-height:1.65"><div style="padding:16px 30px;background:#fff;border-bottom:1px solid #e0e8e4"><img src="${escapeHtml(appUrl)}/zobology-logo-header.png" alt="Zobology" width="210" style="display:block;width:210px;max-width:100%;height:auto"></div><div style="padding:28px 30px">${content}</div></div></div>`
}

function templateFor(notification: NotificationRow) {
  const firstName = escapeHtml(notification.first_name?.trim() || 'there')
  const fullName = escapeHtml([notification.first_name, notification.last_name].filter(Boolean).join(' ').trim() || 'there')
  const assessmentName = escapeHtml([notification.role_name, notification.industry_name].filter(Boolean).join(' · ') || 'Zobology Job Readiness Assessment')
  const submittedOn = notification.submitted_at
    ? new Date(notification.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Recently'

  switch (notification.event_type) {
    case 'candidate_welcome':
      return {
        subject: 'Welcome to Zobology — You’re One Step Closer to Your Goals',
        html: layout(`<p>Hi ${fullName},</p><p><strong>You’re one step closer to achieving your career goals!</strong></p><p>Your Zobology Job Readiness Assessment is now ready.</p><p>This assessment is designed to help you understand:</p><ul><li>Where you stand today</li><li>What you’re doing well</li><li>Where your improvement opportunities lie</li><li>Which skills you need to strengthen to become job ready</li></ul><p>There are no right or wrong career journeys—the goal is to give you an honest, personalized view of your current readiness and help you identify what to work on next.</p><p><strong>Ready to discover where you stand?</strong></p>${button('Start my Assessment', `${appUrl}/assessment`)}<p>Take the assessment seriously, be yourself, and don’t worry about getting everything right. Your results are the starting point for your growth journey.</p><p>Once you complete it, we’ll help you understand your results and identify the next steps to become more confident, capable, and job ready.</p><p><strong>Your goal. Your potential. Your journey.<br>Let’s get you job ready.</strong></p>${signature()}`),
      }
    case 'password_reset': {
      const token = notification.payload?.token ?? ''
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
      return {
        subject: 'Reset Your Zobology Password',
        html: layout(`<p>Hi ${firstName},</p><p>We received a request to reset the password for your Zobology account.</p>${button('Reset my password', resetUrl)}<p>This link will expire in 60 minutes and can only be used once.</p><p>If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.</p>${signature()}`),
      }
    }
    case 'assessment_submitted':
      return {
        subject: 'Assessment Received — Now Wait for the Evaluation',
        html: layout(`<p>Hi ${firstName},</p><p><strong>Congratulations! 🎉 You’ve successfully completed your Zobology Job Readiness Assessment.</strong></p><p>This is a significant step toward your career goals. You’re no longer guessing where you stand—you’ve taken the first step to discovering your strengths and the opportunities that will make you truly job ready.</p><p><strong>What happens next?</strong></p><p>Our assessment engine and industry mentors are now evaluating your responses across communication, problem-solving, analytical thinking, and role-specific skills. Soon, you’ll receive a personalized report that will show:</p><ul><li>Your overall Job Readiness Score</li><li>Your strongest capabilities</li><li>Key improvement opportunities</li><li>A personalized roadmap to help you become job ready</li></ul><p>Thank you for investing in your future. We’re excited to help you take the next step with confidence.</p><p><strong>Your potential is the starting point. Your journey to becoming job ready begins now.</strong></p>${signature()}`),
      }
    case 'results_ready':
      return {
        subject: 'Your Assessment Results Are Ready',
        html: layout(`<p>Hi ${fullName},</p><p>You’ve completed your assessment. Now it’s time to see what it tells you.</p><p>Your Job Readiness Assessment Report is ready, giving you a clear view of your current strengths and the areas that need attention.</p><p>Your report includes:</p><ul><li>Your overall job-readiness score</li><li>Key strengths you can leverage</li><li>Areas that need improvement</li><li>Specific opportunities to help you perform better</li></ul>${button('View your result', appUrl)}<p>Don’t just look at your score—use the insights to understand what’s working, what’s missing, and what to focus on next.</p>${signature()}`),
      }
    case 'reviewer_application_received':
      return {
        subject: 'Welcome to Zobology — Your Mentor Registration Is Complete',
        html: layout(`<p>Hi ${fullName},</p><p><strong>Welcome to Zobology.</strong></p><p>Your mentor registration is complete, and we’re excited to have you join a community focused on helping candidates become more confident, capable, and job ready.</p><p>As a mentor, you’ll have the opportunity to:</p><ul><li>Share your experience and industry perspective</li><li>Help candidates identify and work on their development areas</li><li>Provide practical guidance based on real-world experience</li><li>Make a meaningful impact on their career journey</li></ul>${button('Dashboard', appUrl)}<p>Please complete your mentor profile so candidates can get to know your expertise and experience.</p><p>We look forward to having you on board!</p>${signature()}`),
      }
    case 'review_assigned': {
      const assignmentId = notification.payload?.assignment_id ?? ''
      const reviewUrl = assignmentId ? `${appUrl}/?review=${encodeURIComponent(assignmentId)}` : appUrl
      return {
        subject: 'New Assessment Ready for Your Review',
        html: layout(`<p>Hi ${fullName},</p><p>A matching candidate assessment is available for you to review.</p><p>Your feedback will help the candidate understand their strengths, identify improvement areas, and take the right next steps toward becoming job ready.</p><p><strong>Assessment Details</strong></p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;border-bottom:1px solid #e4ebe7;color:#667872">Candidate</td><td style="padding:8px;border-bottom:1px solid #e4ebe7;font-weight:700">Details available after acceptance</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e4ebe7;color:#667872">Assessment</td><td style="padding:8px;border-bottom:1px solid #e4ebe7;font-weight:700">${assessmentName}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #e4ebe7;color:#667872">Submitted On</td><td style="padding:8px;border-bottom:1px solid #e4ebe7;font-weight:700">${escapeHtml(submittedOn)}</td></tr></table>${button('View opportunity', reviewUrl)}<p>Accept the opportunity from your mentor dashboard to open the candidate’s responses and scoring rubric.</p><p>Thank you for helping candidates turn their potential into progress.</p>${signature()}`),
      }
    }
    case 'reviewer_approved':
      return { subject: 'Your Zobology Mentor Profile Is Approved', html: layout(`<p>Hi ${fullName},</p><p>Your mentor profile is approved. You can now receive assessments matched to your role and industry expertise.</p>${button('Open Mentor Dashboard', appUrl)}${signature()}`) }
    case 'reviewer_rejected':
      return { subject: 'Update on Your Zobology Mentor Application', html: layout(`<p>Hi ${fullName},</p><p>Your mentor application was not approved at this time. Please contact the Zobology team if you would like further information.</p>${signature()}`) }
    default:
      throw new Error(`Unknown notification event: ${notification.event_type}`)
  }
}

async function run() {
  await pool.query('delete from user_sessions where expires_at < now()')
  const pending = await pool.query<NotificationRow>(
    `select n.id, u.email::text, u.first_name, u.last_name, n.event_type, n.payload,
       a.profile_snapshot->>'name' candidate_name, a.role_snapshot->>'name' role_name,
       a.industry_snapshot->>'name' industry_name, a.submitted_at
     from notification_outbox n
     join users u on u.id=n.recipient_id
     left join assessments a on a.id=(n.payload->>'assessment_id')::uuid
     where n.sent_at is null and n.attempt_count < 5
     order by n.created_at limit 100`,
  )
  let sent = 0
  let failed = 0
  for (const notification of pending.rows) {
    try {
      const template = templateFor(notification)
      const result = await fetch(resendApiUrl, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [notification.email], subject: template.subject, html: template.html }),
      })
      if (!result.ok) throw new Error(await result.text())
      await pool.query('update notification_outbox set sent_at=now(), attempt_count=attempt_count+1, last_error=null where id=$1', [notification.id])
      sent += 1
    } catch (error) {
      const message = String(error).slice(0, 2000)
      failed += 1
      console.error(`Notification ${notification.id} (${notification.event_type}) failed: ${message}`)
      await pool.query('update notification_outbox set attempt_count=attempt_count+1, last_error=$2 where id=$1', [notification.id, message])
    }
  }
  console.log(`Processed ${pending.rowCount ?? 0} notifications: ${sent} sent, ${failed} failed`)
  await pool.end()
}

run().catch((error) => { console.error(error); process.exitCode = 1 })
