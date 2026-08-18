import { industries, roles } from './data'
import type { AssignedReview, PortalAccount, PortalDatabase, PortalSubmission, ReviewerProfile } from './portalTypes'

const DATABASE_KEY = 'zobology.portal.database.v1'
const SESSION_KEY = 'zobology.portal.session.v1'

export const emptyDatabase: PortalDatabase = {
  accounts: [],
  reviewers: [],
  submissions: [],
  reviews: [],
  notifications: [],
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase()
}

export async function hashPassword(password: string) {
  const bytes = new TextEncoder().encode(`zobology-v1:${password}`)
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  bytes.forEach((byte) => {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  })
  return `preview-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function loadDatabase(): PortalDatabase {
  try {
    const stored = localStorage.getItem(DATABASE_KEY)
    return stored ? { ...emptyDatabase, ...JSON.parse(stored) as PortalDatabase } : { ...emptyDatabase }
  } catch {
    return { ...emptyDatabase }
  }
}

export function saveDatabase(database: PortalDatabase) {
  localStorage.setItem(DATABASE_KEY, JSON.stringify(database))
}

export function loadSession() {
  return localStorage.getItem(SESSION_KEY)
}

export function saveSession(userId: string | null) {
  if (userId) localStorage.setItem(SESSION_KEY, userId)
  else localStorage.removeItem(SESSION_KEY)
}

export async function bootstrapDatabase(database: PortalDatabase) {
  if (database.accounts.some((account) => account.role === 'admin')) return database
  const createdAt = new Date().toISOString()
  const admin: PortalAccount = {
    id: 'USR-ADMIN-DEMO',
    email: 'admin@zobology.in',
    passwordHash: await hashPassword('Admin@123'),
    role: 'admin',
    createdAt,
  }
  const expertAccounts: PortalAccount[] = [1, 2].map((number) => ({
    id: `USR-EXPERT-0${number}`,
    email: `expert${number}@zobology.in`,
    passwordHash: '',
    role: 'reviewer' as const,
    createdAt,
  }))
  const expertPasswordHash = await hashPassword('Reviewer@123')
  expertAccounts.forEach((account) => { account.passwordHash = expertPasswordHash })
  const broadRoleIds = roles.slice(0, 5).map((role) => role.id)
  const broadIndustryIds = industries.slice(0, 5).map((industry) => industry.id)
  const reviewers: ReviewerProfile[] = expertAccounts.map((account) => ({
    userId: account.id,
    roleIds: broadRoleIds,
    industryIds: broadIndustryIds,
    status: 'approved',
    appliedAt: createdAt,
    approvedAt: createdAt,
  }))
  return { ...database, accounts: [admin, ...expertAccounts, ...database.accounts], reviewers: [...reviewers, ...database.reviewers] }
}

export function assignSubmission(database: PortalDatabase, submission: PortalSubmission) {
  const eligible = database.reviewers
    .filter((reviewer) => reviewer.status === 'approved')
    .map((reviewer) => ({
      reviewer,
      score: (reviewer.roleIds.includes(submission.role.id) ? 2 : 0) + (reviewer.industryIds.includes(submission.industry.id) ? 1 : 0),
      workload: database.reviews.filter((review) => review.reviewerId === reviewer.userId && review.status !== 'completed').length,
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || a.workload - b.workload || a.reviewer.appliedAt.localeCompare(b.reviewer.appliedAt))
    .slice(0, 2)

  const assignedReviewerIds = eligible.map((match) => match.reviewer.userId)
  const reviews: AssignedReview[] = assignedReviewerIds.map((reviewerId) => ({
    id: createId('REV'),
    submissionId: submission.id,
    reviewerId,
    reviewerName: database.accounts.find((account) => account.id === reviewerId)?.email.split('@')[0] ?? 'Industry expert',
    status: 'pending',
    questionReviews: {},
  }))
  const notifications = assignedReviewerIds.map((reviewerId) => ({
    id: createId('NTF'),
    recipientId: reviewerId,
    type: 'review_assigned' as const,
    subject: `New ${submission.role.name} assessment assigned`,
    createdAt: new Date().toISOString(),
  }))
  return {
    ...database,
    submissions: [...database.submissions, { ...submission, assignedReviewerIds, status: assignedReviewerIds.length ? 'under_review' as const : 'awaiting_review' as const }],
    reviews: [...database.reviews, ...reviews],
    notifications: [...database.notifications, ...notifications],
  }
}
