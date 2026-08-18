import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import multer from 'multer'
import { z } from 'zod'
import { authenticate, createSession, destroySession, requireRole, requireUser } from './auth.js'
import { pool, transaction } from './db.js'
import { assignBestReviewers, loadPortalState } from './state.js'
import { readFile, storageConfigured, uploadFile } from './storage.js'

const app = express()
const port = Number(process.env.PORT ?? 10000)
const appUrl = process.env.APP_URL?.replace(/\/$/, '')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const allowed = /^(audio\/(webm|ogg|mpeg|mp4)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/
    if (allowed.test(file.mimetype)) callback(null, true)
    else callback(new Error('Unsupported file type'))
  },
})

app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json({ limit: '12mb' }))
app.use(cookieParser())
app.use(authenticate)
app.use((request, response, next) => {
  if (process.env.NODE_ENV !== 'production' || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next()
  const allowedOrigins = new Set([appUrl, process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, '')].filter(Boolean))
  if (!allowedOrigins.size || allowedOrigins.has(request.get('origin'))) return next()
  response.status(403).json({ error: 'Invalid request origin' })
})

const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false })
const credentialsSchema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) })
const signupSchema = credentialsSchema.extend({
  role: z.enum(['candidate', 'reviewer']),
  roleIds: z.array(z.string()).min(1).max(5).optional(),
  industryIds: z.array(z.string()).min(1).max(5).optional(),
})

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('select 1')
    response.json({ status: 'ok', database: 'connected', storage: storageConfigured() })
  } catch (error) { next(error) }
})

app.post('/api/auth/signup', authLimit, async (request, response, next) => {
  try {
    const input = signupSchema.parse(request.body)
    if (input.role === 'reviewer' && (!input.roleIds?.length || !input.industryIds?.length)) {
      return response.status(400).json({ error: 'Reviewer expertise is required' })
    }
    const passwordHash = await bcrypt.hash(input.password, 12)
    const userId = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        'insert into users (email, password_hash, role) values ($1, $2, $3) returning id',
        [input.email.toLowerCase(), passwordHash, input.role],
      )
      if (input.role === 'reviewer') {
        await client.query('insert into reviewer_profiles (user_id, role_ids, industry_ids) values ($1, $2, $3)', [inserted.rows[0].id, input.roleIds, input.industryIds])
        await client.query(
          `insert into notification_outbox (recipient_id, event_type, payload)
           values ($1, 'reviewer_application_received', jsonb_build_object('subject', 'We received your reviewer application'))`,
          [inserted.rows[0].id],
        )
      }
      return inserted.rows[0].id
    })
    await createSession(userId, response)
    const user = { id: userId, email: input.email.toLowerCase(), role: input.role }
    response.status(201).json({ state: await loadPortalState(user), user })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return response.status(409).json({ error: 'An account with this email already exists' })
    next(error)
  }
})

app.post('/api/auth/signin', authLimit, async (request, response, next) => {
  try {
    const input = credentialsSchema.parse(request.body)
    const result = await pool.query<{ id: string; email: string; password_hash: string; role: 'candidate' | 'reviewer' | 'admin' }>(
      'select id, email::text, password_hash, role from users where email = $1',
      [input.email.toLowerCase()],
    )
    const user = result.rows[0]
    if (!user || !await bcrypt.compare(input.password, user.password_hash)) return response.status(401).json({ error: 'Email or password is incorrect' })
    await createSession(user.id, response)
    response.json({ state: await loadPortalState(user), user: { id: user.id, email: user.email, role: user.role } })
  } catch (error) { next(error) }
})

app.post('/api/auth/signout', requireUser, async (request, response, next) => {
  try { await destroySession(request, response); response.status(204).end() } catch (error) { next(error) }
})

app.get('/api/state', requireUser, async (request, response, next) => {
  try { response.json({ state: await loadPortalState(request.user!), user: request.user }) } catch (error) { next(error) }
})

const profileSchema = z.object({
  name: z.string().min(1).max(120), education: z.string().min(1).max(160),
  experienceType: z.enum(['fresher', 'experienced']), experienceYears: z.string().max(10),
  roleId: z.string().min(1), industryId: z.string().min(1), level: z.string().min(1).max(80),
  resumeName: z.string().max(255), resumeKey: z.string().max(1000).optional(),
})

app.put('/api/candidate/profile', requireRole('candidate'), async (request, response, next) => {
  try {
    const profile = profileSchema.parse(request.body)
    await pool.query(
      `insert into candidate_profiles (user_id, full_name, education, experience_type, experience_years, target_role_id, target_industry_id, target_level, resume_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (user_id) do update set full_name=excluded.full_name, education=excluded.education,
       experience_type=excluded.experience_type, experience_years=excluded.experience_years,
       target_role_id=excluded.target_role_id, target_industry_id=excluded.target_industry_id,
       target_level=excluded.target_level, resume_key=excluded.resume_key, updated_at=now()`,
      [request.user!.id, profile.name, profile.education, profile.experienceType, profile.experienceYears || null, profile.roleId, profile.industryId, profile.level, profile.resumeKey ?? null],
    )
    response.status(204).end()
  } catch (error) { next(error) }
})

app.post('/api/uploads/:kind', requireRole('candidate'), upload.single('file'), async (request, response, next) => {
  try {
    const kind = z.enum(['audio', 'resume']).parse(request.params.kind)
    if (!request.file) return response.status(400).json({ error: 'File is required' })
    const key = await uploadFile(request.user!.id, kind, request.file)
    await pool.query(
      'insert into stored_files (owner_id, object_key, kind, content_type, original_name, size_bytes) values ($1,$2,$3,$4,$5,$6)',
      [request.user!.id, key, kind, request.file.mimetype, request.file.originalname, request.file.size],
    )
    response.status(201).json({ key, url: `/api/files/${encodeURIComponent(key)}` })
  } catch (error) { next(error) }
})

app.get('/api/files/:key', requireUser, async (request, response, next) => {
  try {
    const key = decodeURIComponent(String(request.params.key))
    const access = await pool.query(
      `select sf.content_type from stored_files sf
       where sf.object_key = $1 and (
         sf.owner_id = $2 or $3 = 'admin' or exists (
           select 1 from review_assignments ra where ra.assessment_id = sf.assessment_id and ra.reviewer_id = $2
         )
       )`,
      [key, request.user!.id, request.user!.role],
    )
    if (!access.rows[0]) return response.status(404).json({ error: 'File not found' })
    const object = await readFile(key)
    response.type(access.rows[0].content_type)
    if (object.ContentLength) response.setHeader('content-length', String(object.ContentLength))
    if (!object.Body) return response.status(404).end()
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) response.write(chunk)
    response.end()
  } catch (error) { next(error) }
})

const assessmentSchema = z.object({ profile: profileSchema, role: z.record(z.string(), z.unknown()), industry: z.record(z.string(), z.unknown()), questions: z.array(z.record(z.string(), z.unknown())).min(1).max(100), answers: z.record(z.string(), z.unknown()) })

app.post('/api/candidate/assessments', requireRole('candidate'), async (request, response, next) => {
  try {
    const input = assessmentSchema.parse(request.body)
    const result = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into assessments (candidate_id, profile_snapshot, role_snapshot, industry_snapshot, questions, answers)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [request.user!.id, JSON.stringify(input.profile), JSON.stringify(input.role), JSON.stringify(input.industry), JSON.stringify(input.questions), JSON.stringify(input.answers)],
      )
      const assessmentId = inserted.rows[0].id
      const roleId = String(input.role.id ?? '')
      const industryId = String(input.industry.id ?? '')
      await assignBestReviewers(client, assessmentId, roleId, industryId)
      const storageKeys = [...JSON.stringify(input.answers).matchAll(/\/api\/files\/([^"\\]+)/g)].map((match) => decodeURIComponent(match[1]))
      if (storageKeys.length) await client.query('update stored_files set assessment_id = $1 where owner_id = $2 and object_key = any($3)', [assessmentId, request.user!.id, storageKeys])
      await client.query(
        `insert into notification_outbox (recipient_id, event_type, payload)
         values ($1, 'assessment_submitted', jsonb_build_object('assessment_id', $2::uuid, 'subject', 'We received your Zobology assessment'))`,
        [request.user!.id, assessmentId],
      )
      await client.query(`insert into audit_log (actor_id, action, entity_type, entity_id) values ($1,'assessment_submitted','assessment',$2)`, [request.user!.id, assessmentId])
      return assessmentId
    })
    response.status(201).json({ id: result, state: await loadPortalState(request.user!), user: request.user })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return response.status(409).json({ error: 'You already have an assessment awaiting completion' })
    next(error)
  }
})

const reviewSchema = z.object({ questionReviews: z.record(z.string(), z.unknown()), status: z.enum(['pending', 'in_review', 'completed']) })

app.put('/api/reviewer/reviews/:id', requireRole('reviewer'), async (request, response, next) => {
  try {
    const input = reviewSchema.parse(request.body)
    await transaction(async (client) => {
      const updated = await client.query<{ assessment_id: string }>(
        `update review_assignments set rubric_scores=$1, status=$2,
          started_at=coalesce(started_at, now()), completed_at=case when $2='completed' then now() else completed_at end
         where id=$3 and reviewer_id=$4 and status <> 'completed' returning assessment_id`,
        [JSON.stringify(input.questionReviews), input.status, request.params.id, request.user!.id],
      )
      if (!updated.rows[0]) throw Object.assign(new Error('Review not found'), { status: 404 })
      if (input.status === 'completed') {
        const count = await client.query<{ count: string }>('select count(*) from review_assignments where assessment_id=$1 and status=\'completed\'', [updated.rows[0].assessment_id])
        if (Number(count.rows[0].count) >= 2) await client.query('update assessments set status=\'adjudication\' where id=$1', [updated.rows[0].assessment_id])
      }
    })
    response.json({ state: await loadPortalState(request.user!), user: request.user })
  } catch (error) { next(error) }
})

app.patch('/api/admin/reviewers/:id', requireRole('admin'), async (request, response, next) => {
  try {
    const status = z.enum(['approved', 'rejected']).parse(request.body.status)
    await transaction(async (client) => {
      const updated = await client.query(
        `update reviewer_profiles set status=$1, approved_at=case when $1='approved' then now() else null end,
         approved_by=$2 where user_id=$3 returning user_id`,
        [status, request.user!.id, request.params.id],
      )
      if (!updated.rows[0]) throw Object.assign(new Error('Reviewer not found'), { status: 404 })
      if (status === 'approved') {
        await client.query(
          `insert into notification_outbox (recipient_id,event_type,payload)
           values ($1,'reviewer_approved',jsonb_build_object('subject','Your reviewer profile is approved'))`,
          [request.params.id],
        )
        const profile = (await client.query<{ role_ids: string[]; industry_ids: string[] }>('select role_ids, industry_ids from reviewer_profiles where user_id=$1', [request.params.id])).rows[0]
        const openAssessments = await client.query<{ id: string; role_id: string; industry_id: string; match_score: number }>(
          `select a.id, a.role_snapshot->>'id' role_id, a.industry_snapshot->>'id' industry_id,
            ((case when a.role_snapshot->>'id'=any($2) then 2 else 0 end) + (case when a.industry_snapshot->>'id'=any($3) then 1 else 0 end))::int match_score
           from assessments a
           where a.status in ('awaiting_review','under_review')
             and (a.role_snapshot->>'id'=any($2) or a.industry_snapshot->>'id'=any($3))
             and (select count(*) from review_assignments where assessment_id=a.id) < 2
             and not exists(select 1 from review_assignments where assessment_id=a.id and reviewer_id=$1)
           order by a.review_due_at asc limit 25`,
          [request.params.id, profile.role_ids, profile.industry_ids],
        )
        for (const assessment of openAssessments.rows) {
          const assignment = await client.query<{ id: string }>(
            'insert into review_assignments(assessment_id,reviewer_id,match_score) values($1,$2,$3) returning id',
            [assessment.id, request.params.id, assessment.match_score],
          )
          await client.query(`update assessments set status='under_review' where id=$1`, [assessment.id])
          await client.query(
            `insert into notification_outbox(recipient_id,event_type,payload) values($1,'review_assigned',jsonb_build_object('assessment_id',$2::uuid,'assignment_id',$3::uuid,'subject','New Zobology assessment assigned'))`,
            [request.params.id, assessment.id, assignment.rows[0].id],
          )
        }
      } else {
        await client.query(
          `insert into notification_outbox (recipient_id,event_type,payload)
           values ($1,'reviewer_rejected',jsonb_build_object('subject','Update on your reviewer application'))`,
          [request.params.id],
        )
      }
      await client.query(`insert into audit_log(actor_id,action,entity_type,entity_id,metadata) values($1,'reviewer_decision','reviewer',$2,jsonb_build_object('status',$3::text))`, [request.user!.id, request.params.id, status])
    })
    response.json({ state: await loadPortalState(request.user!), user: request.user })
  } catch (error) { next(error) }
})

function scoreReview(questions: Array<{ id: string; rubric: string[] }>, originalAnswers: Record<string, Record<string, unknown>>, rubricScores: Record<string, { criteria?: Record<string, { score?: number }>; comment?: string }>) {
  return Object.fromEntries(questions.map((question) => {
    const evaluation = rubricScores[question.id]
    const values = question.rubric.map((criterion) => evaluation?.criteria?.[criterion]?.score).filter((score): score is number => Number.isFinite(score))
    return [question.id, { ...originalAnswers[question.id], score: values.length ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length * 25) : 0, feedback: evaluation?.comment || 'Reviewed against the job-specific rubric.' }]
  }))
}

app.post('/api/admin/assessments/:id/publish', requireRole('admin'), async (request, response, next) => {
  try {
    const choice = z.string().min(1).parse(request.body.choice)
    await transaction(async (client) => {
      const assessment = (await client.query('select * from assessments where id=$1 and status=\'adjudication\' for update', [request.params.id])).rows[0]
      if (!assessment) throw Object.assign(new Error('Assessment is not awaiting adjudication'), { status: 409 })
      const reviews = (await client.query('select * from review_assignments where assessment_id=$1 and status=\'completed\' order by completed_at', [assessment.id])).rows
      if (reviews.length < 2) throw Object.assign(new Error('Two completed reviews are required'), { status: 409 })
      const scored = reviews.map((review) => ({ id: review.id, answers: scoreReview(assessment.questions, assessment.answers, review.rubric_scores) }))
      let finalAnswers = scored.find((review) => review.id === choice)?.answers
      if (choice === 'average') {
        finalAnswers = Object.fromEntries(assessment.questions.map((question: { id: string }) => {
          const entries = scored.map((review) => review.answers[question.id])
          return [question.id, { ...assessment.answers[question.id], score: Math.round(entries.reduce((sum, answer) => sum + Number(answer.score), 0) / entries.length), feedback: entries.map((answer) => answer.feedback).filter(Boolean).join(' · ') }]
        }))
      }
      if (!finalAnswers) throw Object.assign(new Error('Invalid adjudication choice'), { status: 400 })
      await client.query('update assessments set status=\'published\', final_answers=$1, adjudicated_at=now(), adjudicated_by=$2 where id=$3', [JSON.stringify(finalAnswers), request.user!.id, assessment.id])
      await client.query(`insert into notification_outbox(recipient_id,event_type,payload) values($1,'results_ready',jsonb_build_object('assessment_id',$2::uuid,'subject','Your Zobology results are ready'))`, [assessment.candidate_id, assessment.id])
      await client.query(`insert into audit_log(actor_id,action,entity_type,entity_id,metadata) values($1,'result_published','assessment',$2,jsonb_build_object('choice',$3::text))`, [request.user!.id, assessment.id, choice])
    })
    response.json({ state: await loadPortalState(request.user!), user: request.user })
  } catch (error) { next(error) }
})

app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found' }))

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.resolve(currentDirectory, '../../dist')
app.use(express.static(distDirectory, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }))
app.use((_request, response) => response.sendFile(path.join(distDirectory, 'index.html')))

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  void next
  const status = (error as { status?: number }).status ?? (error instanceof z.ZodError ? 400 : 500)
  if (status >= 500) console.error(error)
  response.status(status).json({ error: status >= 500 ? 'Unexpected server error' : (error as Error).message })
})

const server = app.listen(port, '0.0.0.0', () => console.log(`Zobology listening on ${port}`))
process.on('SIGTERM', () => server.close(() => pool.end().finally(() => process.exit(0))))
