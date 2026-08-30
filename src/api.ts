import type { HumanReview } from './reviewTypes'
import type { PortalDatabase, PortalSubmission } from './portalTypes'

interface StateResponse { state: PortalDatabase; user: { id: string; email: string; firstName: string; lastName: string; role: 'candidate' | 'reviewer' | 'admin' } }

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: init.body instanceof FormData ? init.headers : { 'content-type': 'application/json', ...init.headers },
  })
  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'Request failed')
  return payload
}

export const backendEnabled = import.meta.env.VITE_BACKEND_MODE === 'render'

export const api = {
  async state() {
    const response = await fetch('/api/state', { credentials: 'include' })
    if (response.status === 401) return null
    const payload = await response.json() as StateResponse & { error?: string }
    if (!response.ok) throw new Error(payload.error || 'Unable to load your account')
    return payload
  },
  signup(input: { firstName: string; lastName: string; email: string; password: string; confirmPassword: string; role: 'candidate' | 'reviewer'; linkedinProfile?: string; roleIds?: string[]; industryIds?: string[] }) {
    return request<StateResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(input) })
  },
  signin(email: string, password: string) {
    return request<StateResponse>('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) })
  },
  forgotPassword(email: string) {
    return request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
  },
  resetPassword(token: string, password: string) {
    return request<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) })
  },
  signout() { return request<void>('/auth/signout', { method: 'POST' }) },
  saveProfile(profile: Record<string, unknown>) { return request<void>('/candidate/profile', { method: 'PUT', body: JSON.stringify(profile) }) },
  async upload(kind: 'audio' | 'resume' | 'answer_spreadsheet', blob: Blob, filename: string) {
    const form = new FormData()
    form.append('file', blob, filename)
    return request<{ key: string; url: string }>(`/uploads/${kind}`, { method: 'POST', body: form })
  },
  async analyzeResume(file: File) {
    const form = new FormData()
    form.append('file', file, file.name)
    return request<{ key: string; signals: string[] }>('/candidate/resume-analysis', { method: 'POST', body: form })
  },
  submitAssessment(submission: Pick<PortalSubmission, 'profile' | 'role' | 'industry' | 'questions' | 'answers'>) {
    return request<{ id: string; state: PortalDatabase; user: StateResponse['user'] }>('/candidate/assessments', { method: 'POST', body: JSON.stringify(submission) })
  },
  saveReview(review: HumanReview) {
    return request<StateResponse>(`/reviewer/reviews/${review.id}`, { method: 'PUT', body: JSON.stringify({ status: review.status, questionReviews: review.questionReviews }) })
  },
  startAdminReview(assessmentId: string) {
    return request<StateResponse & { reviewId: string }>(`/admin/assessments/${assessmentId}/review`, { method: 'POST' })
  },
  saveAdminReview(review: HumanReview) {
    return request<StateResponse>(`/admin/reviews/${review.id}`, { method: 'PUT', body: JSON.stringify({ status: review.status, questionReviews: review.questionReviews }) })
  },
  decideReview(reviewId: string, decision: 'accept' | 'decline') {
    return request<StateResponse>(`/reviewer/reviews/${reviewId}/decision`, { method: 'POST', body: JSON.stringify({ decision }) })
  },
  decideReviewer(userId: string, status: 'approved' | 'rejected') {
    return request<StateResponse>(`/admin/reviewers/${userId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
  },
  publish(assessmentId: string, choice: string) {
    return request<StateResponse>(`/admin/assessments/${assessmentId}/publish`, { method: 'POST', body: JSON.stringify({ choice }) })
  },
  updateAiGovernance(input: { mode?: 'human_required' | 'ai_only'; minimumReviews?: number; maximumMae?: number; minimumExactAgreement?: number }) {
    return request<StateResponse>('/admin/ai-governance', { method: 'PATCH', body: JSON.stringify(input) })
  },
}
