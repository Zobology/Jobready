import { createHash, randomBytes } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { pool } from './db.js'

export interface AuthenticatedUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: 'candidate' | 'reviewer' | 'admin'
}

/* eslint-disable @typescript-eslint/no-namespace -- Express request augmentation requires its global namespace. */
declare global {
  namespace Express {
    interface Request { user?: AuthenticatedUser }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

const cookieName = 'zobology_session'
const sessionDays = 14

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string, response: Response) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sessionDays * 86_400_000)
  await pool.query('insert into user_sessions (user_id, token_hash, expires_at) values ($1, $2, $3)', [userId, tokenHash(token), expiresAt])
  response.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession(request: Request, response: Response) {
  const token = request.cookies?.[cookieName]
  if (token) await pool.query('delete from user_sessions where token_hash = $1', [tokenHash(token)])
  response.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
}

export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[cookieName]
    if (!token) return next()
    const result = await pool.query<AuthenticatedUser>(
      `select u.id, u.email::text, u.first_name, u.last_name, u.role from user_sessions s
       join users u on u.id = s.user_id
       where s.token_hash = $1 and s.expires_at > now()`,
      [tokenHash(token)],
    )
    request.user = result.rows[0]
    next()
  } catch (error) { next(error) }
}

export function requireUser(request: Request, response: Response, next: NextFunction) {
  if (!request.user) return response.status(401).json({ error: 'Authentication required' })
  next()
}

export function requireRole(...roles: AuthenticatedUser['role'][]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) return response.status(401).json({ error: 'Authentication required' })
    if (!roles.includes(request.user.role)) return response.status(403).json({ error: 'Access denied' })
    next()
  }
}
