export interface CandidateProfile {
  name: string
  education: string
  experienceType: 'fresher' | 'experienced'
  experienceYears: string
  roleId: string
  industryId: string
  level: string
  resumeName: string
  resumeFile?: File
}

export interface AssessmentAnswer {
  text?: string
  audioUrl?: string
  duration?: number
  transcript?: string
  score: number
  feedback: string
}

export type RubricScore = 1 | 2 | 3 | 4

export interface CriterionReview {
  score: RubricScore
}

export interface QuestionReview {
  criteria: Record<string, CriterionReview>
  comment: string
}

export interface HumanReview {
  id: string
  reviewerName: string
  status: 'available' | 'accepted' | 'declined' | 'in_review' | 'completed'
  questionReviews: Record<string, QuestionReview>
  startedAt?: string
  completedAt?: string
}
