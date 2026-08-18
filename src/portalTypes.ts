import type { Industry, Question, RoleFamily } from './data'
import type { AssessmentAnswer, CandidateProfile, HumanReview } from './reviewTypes'

export type AccountRole = 'candidate' | 'reviewer' | 'admin'
export type ReviewerStatus = 'pending' | 'approved' | 'rejected'
export type SubmissionStatus = 'awaiting_review' | 'under_review' | 'adjudication' | 'published'

export interface PortalAccount {
  id: string
  email: string
  passwordHash: string
  role: AccountRole
  createdAt: string
}

export interface ReviewerProfile {
  userId: string
  roleIds: string[]
  industryIds: string[]
  status: ReviewerStatus
  appliedAt: string
  approvedAt?: string
}

export interface PortalSubmission {
  id: string
  candidateId: string
  submittedAt: string
  profile: CandidateProfile
  role: RoleFamily
  industry: Industry
  questions: Question[]
  answers: Record<string, AssessmentAnswer>
  status: SubmissionStatus
  assignedReviewerIds: string[]
  finalAnswers?: Record<string, AssessmentAnswer>
  adjudicatedAt?: string
}

export interface AssignedReview extends HumanReview {
  submissionId: string
  reviewerId: string
}

export interface NotificationRecord {
  id: string
  recipientId: string
  type: 'review_assigned' | 'results_ready' | 'reviewer_approved'
  subject: string
  createdAt: string
  sentAt?: string
}

export interface PortalDatabase {
  accounts: PortalAccount[]
  reviewers: ReviewerProfile[]
  submissions: PortalSubmission[]
  reviews: AssignedReview[]
  notifications: NotificationRecord[]
}

export interface PortalSession {
  userId: string
}
