import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import multer from 'multer'
import { z } from 'zod'
import { authenticate, createSession, destroySession, requireRole, requireUser } from './auth.js'
import type { AuthenticatedUser } from './auth.js'
import { pool, transaction } from './db.js'
import { loadPortalState } from './state.js'
import { readFile, storageConfigured, uploadFile } from './storage.js'
import { extractResumeSignals } from './resume.js'
import { buildSampleWorkbook, type DataVariant } from './sampleData.js'
import { calibrationSummary, processAssessmentAiReview, processPendingAiReviews, recordHumanCalibration, type RubricScores } from './aiReview.js'

const app = express()
const port = Number(process.env.PORT ?? 10000)
const appUrl = process.env.APP_URL?.replace(/\/$/, '')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    const allowed = /^(audio\/(webm|ogg|mpeg|mp4)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)))$/
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
const passwordResetLimit = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false })
const dataDownloadLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false })
const credentialsSchema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) })
const publicUser = (user: AuthenticatedUser) => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name ?? '',
  lastName: user.last_name ?? '',
  role: user.role,
})
const linkedinProfileSchema = z.string().trim().url().max(500).refine((value) => {
  const hostname = new URL(value).hostname.toLowerCase()
  return hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')
}, 'Enter a valid LinkedIn profile URL')
const signupBaseSchema = credentialsSchema.extend({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  confirmPassword: z.string().min(8).max(128),
})
const signupSchema = z.discriminatedUnion('role', [
  signupBaseSchema.extend({ role: z.literal('candidate') }),
  signupBaseSchema.extend({
    role: z.literal('reviewer'),
    linkedinProfile: linkedinProfileSchema,
    roleIds: z.array(z.string()).min(1).max(5),
    industryIds: z.array(z.string()).min(1).max(5),
  }),
]).superRefine((input, context) => {
  if (input.password !== input.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'The passwords do not match' })
})

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('select 1')
    response.json({ status: 'ok', database: 'connected', storage: storageConfigured() })
  } catch (error) { next(error) }
})

app.get('/api/assessment-data/core-data-understanding', requireUser, dataDownloadLimit, async (request, response, next) => {
  try {
    const query = z.object({
      role: z.string().trim().min(1).max(120),
      industry: z.string().trim().min(1).max(120),
      level: z.string().trim().min(1).max(80),
      education: z.string().trim().min(1).max(160),
      experienceType: z.enum(['fresher', 'experienced']),
      variant: z.enum(['commercial', 'operations', 'people', 'customer', 'technology', 'general']),
    }).parse(request.query)
    const workbook = await buildSampleWorkbook({ ...query, variant: query.variant as DataVariant })
    const fileName = `zobology-${query.role}-${query.industry}-data-exercise.xlsx`.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-')
    response.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response.setHeader('content-disposition', `attachment; filename="${fileName}"`)
    response.setHeader('cache-control', 'private, max-age=300')
    response.send(workbook)
  } catch (error) { next(error) }
})

app.post('/api/auth/signup', authLimit, async (request, response, next) => {
  try {
    const input = signupSchema.parse(request.body)
    const passwordHash = await bcrypt.hash(input.password, 12)
    const userId = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        'insert into users (email, password_hash, first_name, last_name, role) values ($1, $2, $3, $4, $5) returning id',
        [input.email.toLowerCase(), passwordHash, input.firstName, input.lastName, input.role],
      )
      if (input.role === 'reviewer') {
        await client.query(
          'insert into reviewer_profiles (user_id, role_ids, industry_ids, linkedin_url) values ($1, $2, $3, $4)',
          [inserted.rows[0].id, input.roleIds, input.industryIds, input.linkedinProfile],
        )
        await client.query(
          `insert into notification_outbox (recipient_id, event_type, payload)
           values ($1, 'reviewer_application_received', jsonb_build_object('subject', 'We received your mentor application'))`,
          [inserted.rows[0].id],
        )
      } else {
        await client.query(
          `insert into notification_outbox (recipient_id, event_type, payload)
           values ($1, 'candidate_welcome', jsonb_build_object('subject', 'Welcome to Zobology'))`,
          [inserted.rows[0].id],
        )
      }
      return inserted.rows[0].id
    })
    await createSession(userId, response)
    const user: AuthenticatedUser = { id: userId, email: input.email.toLowerCase(), first_name: input.firstName, last_name: input.lastName, role: input.role }
    response.status(201).json({ state: await loadPortalState(user), user: publicUser(user) })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return response.status(409).json({ error: 'An account with this email already exists' })
    next(error)
  }
})

app.post('/api/auth/signin', authLimit, async (request, response, next) => {
  try {
    const input = credentialsSchema.parse(request.body)
    const result = await pool.query<{ id: string; email: string; first_name: string | null; last_name: string | null; password_hash: string; role: 'candidate' | 'reviewer' | 'admin' }>(
      'select id, email::text, first_name, last_name, password_hash, role from users where email = $1',
      [input.email.toLowerCase()],
    )
    const user = result.rows[0]
    if (!user || !await bcrypt.compare(input.password, user.password_hash)) return response.status(401).json({ error: 'Email or password is incorrect' })
    await createSession(user.id, response)
    response.json({ state: await loadPortalState(user), user: publicUser(user) })
  } catch (error) { next(error) }
})

const resetRequestSchema = z.object({ email: z.string().email().max(254) })
const resetPasswordSchema = z.object({
  token: z.string().min(20).max(500),
  password: z.string().min(8).max(128),
})
const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex')

app.post('/api/auth/forgot-password', passwordResetLimit, async (request, response, next) => {
  try {
    const input = resetRequestSchema.parse(request.body)
    const user = (await pool.query<{ id: string }>(
      `select id from users where email=$1 and role in ('candidate','reviewer')`,
      [input.email.toLowerCase()],
    )).rows[0]
    if (user) {
      const token = randomBytes(32).toString('base64url')
      await transaction(async (client) => {
        await client.query('update password_reset_tokens set used_at=now() where user_id=$1 and used_at is null', [user.id])
        await client.query(
          `insert into password_reset_tokens(user_id,token_hash,expires_at) values($1,$2,now()+interval '60 minutes')`,
          [user.id, hashResetToken(token)],
        )
        await client.query(
          `insert into notification_outbox(recipient_id,event_type,payload)
           values($1,'password_reset',jsonb_build_object('token',$2::text,'subject','Reset your Zobology password'))`,
          [user.id, token],
        )
      })
    }
    response.status(202).json({ message: 'If an eligible account exists for this email, a reset link will be sent shortly.' })
  } catch (error) { next(error) }
})

app.post('/api/auth/reset-password', passwordResetLimit, async (request, response, next) => {
  try {
    const input = resetPasswordSchema.parse(request.body)
    const passwordHash = await bcrypt.hash(input.password, 12)
    const reset = await transaction(async (client) => {
      const record = (await client.query<{ id: string; user_id: string }>(
        `select id,user_id from password_reset_tokens
         where token_hash=$1 and used_at is null and expires_at > now()
         for update`,
        [hashResetToken(input.token)],
      )).rows[0]
      if (!record) return false
      await client.query('update users set password_hash=$1,updated_at=now() where id=$2', [passwordHash, record.user_id])
      await client.query('update password_reset_tokens set used_at=now() where user_id=$1 and used_at is null', [record.user_id])
      await client.query('delete from user_sessions where user_id=$1', [record.user_id])
      await client.query(
        `insert into audit_log(action,entity_type,entity_id,metadata)
         values('password_reset_completed','user',$1,jsonb_build_object('reset_token_id',$2::uuid))`,
        [record.user_id, record.id],
      )
      return true
    })
    if (!reset) return response.status(400).json({ error: 'This password reset link is invalid or has expired.' })
    response.status(204).end()
  } catch (error) { next(error) }
})

app.post('/api/auth/signout', requireUser, async (request, response, next) => {
  try { await destroySession(request, response); response.status(204).end() } catch (error) { next(error) }
})

app.get('/api/state', requireUser, async (request, response, next) => {
  try { response.json({ state: await loadPortalState(request.user!), user: publicUser(request.user!) }) } catch (error) { next(error) }
})

const profileSchema = z.object({
  name: z.string().min(1).max(120), education: z.string().min(1).max(160),
  experienceType: z.enum(['fresher', 'experienced']), experienceYears: z.string().max(10),
  roleId: z.string().min(1), industryId: z.string().min(1), level: z.string().min(1).max(80),
  resumeName: z.string().max(255), resumeKey: z.string().max(1000).optional(),
  resumeSignals: z.array(z.string().max(100)).max(20).optional(),
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

app.post('/api/uploads/:kind', requireRole('candidate', 'reviewer'), upload.single('file'), async (request, response, next) => {
  try {
    const kind = z.enum(['audio', 'resume', 'answer_spreadsheet']).parse(request.params.kind)
    if (request.user!.role === 'reviewer' && kind !== 'resume') return response.status(403).json({ error: 'Mentors can only upload a resume' })
    if (!request.file) return response.status(400).json({ error: 'File is required' })
    const validContentType = kind === 'audio'
      ? request.file.mimetype.startsWith('audio/')
      : kind === 'answer_spreadsheet'
        ? request.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(request.file.mimetype)
    if (!validContentType) return response.status(400).json({ error: `The uploaded file is not valid for ${kind.replace('_', ' ')}` })
    if (kind === 'answer_spreadsheet' && (request.file.buffer[0] !== 0x50 || request.file.buffer[1] !== 0x4b)) {
      return response.status(400).json({ error: 'The uploaded workbook is not a valid .xlsx file' })
    }
    const key = await uploadFile(request.user!.id, kind, request.file)
    await pool.query(
      'insert into stored_files (owner_id, object_key, kind, content_type, original_name, size_bytes) values ($1,$2,$3,$4,$5,$6)',
      [request.user!.id, key, kind, request.file.mimetype, request.file.originalname, request.file.size],
    )
    if (request.user!.role === 'reviewer') await pool.query('update reviewer_profiles set resume_key=$1 where user_id=$2', [key, request.user!.id])
    response.status(201).json({ key, url: `/api/files/${encodeURIComponent(key)}` })
  } catch (error) { next(error) }
})

app.post('/api/candidate/resume-analysis', requireRole('candidate'), upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file) return response.status(400).json({ error: 'Resume is required' })
    const analysis = await extractResumeSignals(request.file)
    const key = await uploadFile(request.user!.id, 'resume', request.file)
    await pool.query(
      'insert into stored_files (owner_id, object_key, kind, content_type, original_name, size_bytes) values ($1,$2,$3,$4,$5,$6)',
      [request.user!.id, key, 'resume', request.file.mimetype, request.file.originalname, request.file.size],
    )
    response.status(201).json({ key, signals: analysis.signals })
  } catch (error) { next(error) }
})

app.get('/api/files/:key', requireUser, async (request, response, next) => {
  try {
    const key = decodeURIComponent(String(request.params.key))
    const access = await pool.query(
      `select sf.content_type from stored_files sf
       where sf.object_key = $1 and (
         sf.owner_id = $2 or $3 = 'admin' or exists (
           select 1 from review_assignments ra
           where ra.assessment_id = sf.assessment_id and ra.reviewer_id = $2
             and ra.status in ('accepted', 'in_review', 'completed')
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
      const storageKeys = [...JSON.stringify(input.answers).matchAll(/\/api\/files\/([^"\\]+)/g)].map((match) => decodeURIComponent(match[1]))
      if (input.profile.resumeKey) storageKeys.push(input.profile.resumeKey)
      if (storageKeys.length) await client.query('update stored_files set assessment_id = $1 where owner_id = $2 and object_key = any($3)', [assessmentId, request.user!.id, storageKeys])
      await client.query(
        `insert into notification_outbox (recipient_id, event_type, payload)
         values ($1, 'assessment_submitted', jsonb_build_object('assessment_id', $2::uuid, 'subject', 'We received your Zobology assessment'))`,
        [request.user!.id, assessmentId],
      )
      await client.query(`insert into audit_log (actor_id, action, entity_type, entity_id) values ($1,'assessment_submitted','assessment',$2)`, [request.user!.id, assessmentId])
      return assessmentId
    })
    void processAssessmentAiReview(result).catch((error) => console.error('AI assessment review failed:', error))
    response.status(201).json({ id: result, state: await loadPortalState(request.user!), user: publicUser(request.user!) })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return response.status(409).json({ error: 'You already have an assessment awaiting completion' })
    next(error)
  }
})

const reviewSchema = z.object({ questionReviews: z.record(z.string(), z.unknown()), status: z.enum(['in_review', 'completed']) })

app.post('/api/reviewer/reviews/:id/decision', requireRole('reviewer'), async (request, response, next) => {
  try {
    const decision = z.enum(['accept', 'decline']).parse(request.body.decision)
    await transaction(async (client) => {
      const assignment = (await client.query<{ id: string; assessment_id: string; status: string; ai_review_status: string }>(
        `select ra.id, ra.assessment_id, ra.status, a.ai_review_status
         from review_assignments ra
         join assessments a on a.id = ra.assessment_id
         where ra.id = $1 and ra.reviewer_id = $2
         for update of ra, a`,
        [request.params.id, request.user!.id],
      )).rows[0]
      if (!assignment) throw Object.assign(new Error('Review opportunity not found'), { status: 404 })
      if (assignment.status !== 'available') throw Object.assign(new Error('This review opportunity is no longer available'), { status: 409 })
      if (!['completed', 'unavailable'].includes(assignment.ai_review_status)) throw Object.assign(new Error('The AI draft is still being prepared'), { status: 409 })

      if (decision === 'decline') {
        await client.query(`update review_assignments set status = 'declined' where id = $1`, [assignment.id])
        await client.query(
          `insert into audit_log(actor_id,action,entity_type,entity_id)
           values($1,'review_opportunity_declined','review_assignment',$2)`,
          [request.user!.id, assignment.id],
        )
        return
      }

      const active = await client.query<{ count: string }>(
        `select count(*) from review_assignments
         where assessment_id = $1 and status in ('accepted', 'in_review', 'completed')`,
        [assignment.assessment_id],
      )
      if (Number(active.rows[0].count) >= 2) {
        await client.query(`update review_assignments set status = 'declined' where id = $1`, [assignment.id])
        throw Object.assign(new Error('Two mentors have already accepted this assessment'), { status: 409 })
      }

      await client.query(`update review_assignments set status = 'accepted' where id = $1`, [assignment.id])
      await client.query(`update assessments set status = 'under_review' where id = $1 and status = 'awaiting_review'`, [assignment.assessment_id])
      const accepted = await client.query<{ count: string }>(
        `select count(*) from review_assignments
         where assessment_id = $1 and status in ('accepted', 'in_review', 'completed')`,
        [assignment.assessment_id],
      )
      if (Number(accepted.rows[0].count) >= 2) {
        await client.query(
          `update review_assignments set status = 'declined'
           where assessment_id = $1 and status = 'available'`,
          [assignment.assessment_id],
        )
      }
      await client.query(
        `insert into audit_log(actor_id,action,entity_type,entity_id)
         values($1,'review_opportunity_accepted','review_assignment',$2)`,
        [request.user!.id, assignment.id],
      )
    })
    response.json({ state: await loadPortalState(request.user!), user: publicUser(request.user!) })
  } catch (error) { next(error) }
})

app.put('/api/reviewer/reviews/:id', requireRole('reviewer'), async (request, response, next) => {
  try {
    const input = reviewSchema.parse(request.body)
    await transaction(async (client) => {
      if (input.status === 'completed') {
        const assessment = await client.query<{ questions: Array<{ id: string; rubric: string[] }>; ai_review_status: string }>(
          `select a.questions,a.ai_review_status from assessments a join review_assignments ra on ra.assessment_id=a.id
           where ra.id=$1 and ra.reviewer_id=$2`,
          [request.params.id, request.user!.id],
        )
        const row = assessment.rows[0]
        if (!row || !['completed', 'unavailable'].includes(row.ai_review_status)) throw Object.assign(new Error('AI evaluation is not ready for mentor validation'), { status: 409 })
        const reviews = input.questionReviews as Record<string, { validated?: boolean; criteria?: Record<string, { score?: number }> }>
        const complete = row.questions.every((question) => reviews[question.id]?.validated && question.rubric.every((criterion) => {
          const score = reviews[question.id]?.criteria?.[criterion]?.score
          return Number.isInteger(score) && Number(score) >= 1 && Number(score) <= 4
        }))
        if (!complete) throw Object.assign(new Error('Validate every AI recommendation and rubric criterion before finalizing'), { status: 400 })
      }
      const updated = await client.query<{ assessment_id: string; rubric_scores: Record<string, { criteria?: Record<string, { score?: number }>; comment?: string }> }>(
        `update review_assignments set rubric_scores=$1, status=$2,
          started_at=coalesce(started_at, now()), completed_at=case when $2='completed' then now() else completed_at end
         where id=$3 and reviewer_id=$4 and status in ('accepted', 'in_review') returning assessment_id, rubric_scores`,
        [JSON.stringify(input.questionReviews), input.status, request.params.id, request.user!.id],
      )
      if (!updated.rows[0]) {
        const existing = await client.query<{ status: string }>(
          'select status from review_assignments where id=$1 and reviewer_id=$2',
          [request.params.id, request.user!.id],
        )
        if (existing.rows[0]?.status === 'completed') return
        if (existing.rows[0]) throw Object.assign(new Error('Accept this review before entering scores'), { status: 409 })
        throw Object.assign(new Error('Review not found'), { status: 404 })
      }
      if (input.status === 'completed') {
        await recordHumanCalibration(client, updated.rows[0].assessment_id, String(request.params.id), updated.rows[0].rubric_scores as RubricScores)
        const counts = await client.query<{ active: string; completed: string }>(
          `select
             count(*) filter (where status in ('accepted','in_review','completed')) active,
             count(*) filter (where status='completed') completed
           from review_assignments where assessment_id=$1`,
          [updated.rows[0].assessment_id],
        )
        const activeCount = Number(counts.rows[0].active)
        const completedCount = Number(counts.rows[0].completed)
        if (completedCount >= 2) {
          await client.query(`update assessments set status='adjudication' where id=$1`, [updated.rows[0].assessment_id])
        } else if (activeCount >= 2) {
          await client.query(`update assessments set status='under_review' where id=$1`, [updated.rows[0].assessment_id])
        } else {
          const assessment = (await client.query<{
            candidate_id: string
            questions: Array<{ id: string; rubric: string[] }>
            answers: Record<string, Record<string, unknown>>
          }>('select candidate_id,questions,answers from assessments where id=$1 for update', [updated.rows[0].assessment_id])).rows[0]
          const finalAnswers = scoreReview(assessment.questions, assessment.answers, updated.rows[0].rubric_scores)
          await client.query(
            `update assessments set status='published',final_answers=$1,adjudicated_at=now() where id=$2`,
            [JSON.stringify(finalAnswers), updated.rows[0].assessment_id],
          )
          await client.query(
            `update review_assignments set status='declined'
             where assessment_id=$1 and status='available'`,
            [updated.rows[0].assessment_id],
          )
          await client.query(
            `insert into notification_outbox(recipient_id,event_type,payload)
             values($1,'results_ready',jsonb_build_object('assessment_id',$2::uuid,'subject','Your Zobology results are ready'))`,
            [assessment.candidate_id, updated.rows[0].assessment_id],
          )
          await client.query(
            `insert into audit_log(actor_id,action,entity_type,entity_id)
             values($1,'single_review_result_published','assessment',$2)`,
            [request.user!.id, updated.rows[0].assessment_id],
          )
        }
      }
    })
    response.json({ state: await loadPortalState(request.user!), user: publicUser(request.user!) })
  } catch (error) { next(error) }
})

app.patch('/api/admin/ai-governance', requireRole('admin'), async (request, response, next) => {
  try {
    const input = z.object({
      mode: z.enum(['human_required', 'ai_only']).optional(),
      minimumReviews: z.number().int().min(20).max(10000).optional(),
      maximumMae: z.number().min(0).max(3).optional(),
      minimumExactAgreement: z.number().min(0).max(1).optional(),
    }).refine((value) => Object.keys(value).length > 0).parse(request.body)
    await transaction(async (client) => {
      const summary = await calibrationSummary(client)
      const eligible = summary.reviews >= (input.minimumReviews ?? summary.minimumReviews)
        && summary.mae <= (input.maximumMae ?? summary.maximumMae)
        && summary.exactAgreement >= (input.minimumExactAgreement ?? summary.minimumExactAgreement)
      if (input.mode === 'ai_only' && !eligible) {
        throw Object.assign(new Error('AI-only mode cannot be enabled until the calibration thresholds are met'), { status: 409 })
      }
      await client.query(
        `update ai_governance set mode=coalesce($1,mode),minimum_reviews=coalesce($2,minimum_reviews),maximum_mae=coalesce($3,maximum_mae),minimum_exact_agreement=coalesce($4,minimum_exact_agreement),updated_at=now(),updated_by=$5 where singleton=true`,
        [input.mode ?? null, input.minimumReviews ?? null, input.maximumMae ?? null, input.minimumExactAgreement ?? null, request.user!.id],
      )
      await client.query(`insert into audit_log(actor_id,action,entity_type,entity_id,metadata) values($1,'ai_governance_updated','ai_governance','singleton',$2)`, [request.user!.id, JSON.stringify(input)])
    })
    response.json({ state: await loadPortalState(request.user!), user: publicUser(request.user!) })
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
      if (!updated.rows[0]) throw Object.assign(new Error('Mentor not found'), { status: 404 })
      if (status === 'approved') {
        await client.query(
          `insert into notification_outbox (recipient_id,event_type,payload)
           values ($1,'reviewer_approved',jsonb_build_object('subject','Your mentor profile is approved'))`,
          [request.params.id],
        )
        const profile = (await client.query<{ role_ids: string[]; industry_ids: string[] }>('select role_ids, industry_ids from reviewer_profiles where user_id=$1', [request.params.id])).rows[0]
        const openAssessments = await client.query<{ id: string; role_id: string; industry_id: string; match_score: number; rubric_scores: Record<string, unknown> }>(
          `select a.id, a.role_snapshot->>'id' role_id, a.industry_snapshot->>'id' industry_id,coalesce(a.ai_review->'rubricScores','{}'::jsonb) rubric_scores,
            ((case when a.role_snapshot->>'id'=any($2) then 2 else 0 end) + (case when a.industry_snapshot->>'id'=any($3) then 1 else 0 end))::int match_score
           from assessments a
           where a.status in ('awaiting_review','under_review')
             and a.ai_review_status in ('completed','unavailable')
             and (a.role_snapshot->>'id'=any($2) or a.industry_snapshot->>'id'=any($3))
             and (select count(*) from review_assignments where assessment_id=a.id and status in ('accepted','in_review','completed')) < 2
             and not exists(select 1 from review_assignments where assessment_id=a.id and reviewer_id=$1)
           order by a.review_due_at asc limit 25`,
          [request.params.id, profile.role_ids, profile.industry_ids],
        )
        for (const assessment of openAssessments.rows) {
          const assignment = await client.query<{ id: string }>(
            `insert into review_assignments(assessment_id,reviewer_id,match_score,status,rubric_scores)
             values($1,$2,$3,'available',$4) returning id`,
            [assessment.id, request.params.id, assessment.match_score, JSON.stringify(assessment.rubric_scores)],
          )
          await client.query(
            `insert into notification_outbox(recipient_id,event_type,payload) values($1,'review_assigned',jsonb_build_object('assessment_id',$2::uuid,'assignment_id',$3::uuid,'subject','New Assessment Ready for Your Review'))`,
            [request.params.id, assessment.id, assignment.rows[0].id],
          )
        }
      } else {
        await client.query(
          `insert into notification_outbox (recipient_id,event_type,payload)
           values ($1,'reviewer_rejected',jsonb_build_object('subject','Update on your mentor application'))`,
          [request.params.id],
        )
      }
      await client.query(`insert into audit_log(actor_id,action,entity_type,entity_id,metadata) values($1,'reviewer_decision','reviewer',$2,jsonb_build_object('status',$3::text))`, [request.user!.id, request.params.id, status])
    })
    response.json({ state: await loadPortalState(request.user!), user: publicUser(request.user!) })
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
    response.json({ state: await loadPortalState(request.user!), user: publicUser(request.user!) })
  } catch (error) { next(error) }
})

app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found' }))

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.resolve(currentDirectory, '../../dist')
app.use(express.static(distDirectory, {
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders: (response, filePath) => {
    if (filePath.endsWith('zobology-social-card.png')) {
      response.setHeader('cache-control', 'public, max-age=86400, immutable')
      response.setHeader('cross-origin-resource-policy', 'cross-origin')
      response.setHeader('access-control-allow-origin', '*')
    }
  },
}))
app.use((_request, response) => response.sendFile(path.join(distDirectory, 'index.html')))

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  void next
  const status = (error as { status?: number }).status ?? (error instanceof z.ZodError ? 400 : 500)
  if (status >= 500) console.error(error)
  response.status(status).json({ error: status >= 500 ? 'Unexpected server error' : (error as Error).message })
})

const server = app.listen(port, '0.0.0.0', () => console.log(`Zobology listening on ${port}`))
const aiReviewPollMs = Math.max(30_000, Number(process.env.AI_REVIEW_POLL_MS ?? 60_000))
const aiReviewTimer = setInterval(() => {
  void processPendingAiReviews(Math.max(1, Math.min(10, Number(process.env.AI_REVIEW_BATCH_SIZE ?? 3))))
    .catch((error) => console.error('AI review worker failed:', error))
}, aiReviewPollMs)
aiReviewTimer.unref()
process.on('SIGTERM', () => {
  clearInterval(aiReviewTimer)
  server.close(() => pool.end().finally(() => process.exit(0)))
})
