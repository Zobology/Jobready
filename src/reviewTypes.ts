export interface CandidateProfile {
  name: string
  education: string
  experienceType: 'fresher' | 'experienced'
  experienceYears: string
  roleId: string
  industryId: string
  level: string
  resumeName: string
  resumeKey?: string
  resumeSignals?: string[]
  resumeFile?: File
}

export interface AssessmentAnswer {
  text?: string
  audioUrl?: string
  duration?: number
  transcript?: string
  workbookUrl?: string
  workbookName?: string
  workbookFile?: File
  score: number
  feedback: string
}

export type RubricScore = 1 | 2 | 3 | 4

export interface CriterionReview {
  score: RubricScore
  aiScore?: RubricScore
  rationale?: string
  confidence?: number
}

export interface QuestionReview {
  criteria: Record<string, CriterionReview>
  comment: string
  validated?: boolean
}

export interface HumanReview {
  id: string
  reviewerName: string
  status: 'available' | 'accepted' | 'declined' | 'expired' | 'in_review' | 'completed'
  questionReviews: Record<string, QuestionReview>
  acceptedAt?: string
  startedAt?: string
  completedAt?: string
}
