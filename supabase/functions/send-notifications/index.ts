import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (request) => {
  if (request.headers.get('authorization') !== `Bearer ${Deno.env.get('NOTIFICATION_CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: notifications, error } = await supabase
    .from('notification_outbox')
    .select('id,event_type,payload,attempt_count,profiles!notification_outbox_recipient_id_fkey(email)')
    .is('sent_at', null)
    .lt('attempt_count', 5)
    .order('created_at')
    .limit(50)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  for (const notification of notifications ?? []) {
    const email = (notification.profiles as unknown as { email: string })?.email
    const content = notification.event_type === 'review_assigned'
      ? { subject: 'New Zobology assessment assigned', html: '<p>A matched assessment is waiting in your reviewer queue. Please complete it within 24 hours.</p>' }
      : notification.event_type === 'reviewer_approved'
        ? { subject: 'Your Zobology reviewer profile is approved', html: '<p>Your reviewer account is approved. You can now receive matched assessments.</p>' }
        : { subject: 'Your Zobology results are ready', html: '<p>Your expert-reviewed job readiness results are ready. Sign in to view them.</p>' }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM') ?? 'Zobology <noreply@zobology.in>', to: [email], ...content }),
    })

    await supabase.from('notification_outbox').update(response.ok
      ? { sent_at: new Date().toISOString(), attempt_count: notification.attempt_count + 1, last_error: null }
      : { attempt_count: notification.attempt_count + 1, last_error: await response.text() }
    ).eq('id', notification.id)
  }

  return Response.json({ processed: notifications?.length ?? 0 })
})
