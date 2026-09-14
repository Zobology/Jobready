export const coachingHours = [2, 4, 8, 16, 24] as const
export type CoachingHours = typeof coachingHours[number]
export type CoachingMode = 'ai' | 'expert'

export interface ExpertPreference {
  date: string
  time: string
}

export interface CoachingFocusArea {
  competency: string
  score: number
  rationale: string
}

export interface CoachingSession {
  id: string
  sequence: number
  mode: CoachingMode
  durationHours: 1
  title: string
  objective: string
  activities: string[]
  preferredDate?: string
  preferredTime?: string
}

export interface CoachingPlan {
  id: string
  assessmentId: string
  totalHours: CoachingHours
  aiHours: number
  expertHours: number
  summary: string
  focusAreas: CoachingFocusArea[]
  sessions: CoachingSession[]
  status: 'under_review' | 'published'
  curatedBy: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export interface CoachingPlanInput {
  totalHours: CoachingHours
  expertHours: number
  expertPreferences: ExpertPreference[]
}

export function coachingProgressStatus(progressPercent: number): 'not_started' | 'in_progress' | 'completed' {
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) throw new Error('Progress must be a whole number from 0 to 100.')
  return progressPercent === 100 ? 'completed' : progressPercent > 0 ? 'in_progress' : 'not_started'
}

interface CoachingEvidence {
  assessmentId: string
  roleName: string
  industryName: string
  questions: Array<{ id: string; competency: string }>
  finalAnswers: Record<string, { score: number; feedback: string } | undefined>
}

export function validateCoachingSelection(input: CoachingPlanInput) {
  if (!coachingHours.includes(input.totalHours)) return 'Choose a valid coaching plan.'
  if (!Number.isInteger(input.expertHours) || input.expertHours < 0 || input.expertHours > input.totalHours) return 'Choose a valid AI and expert-hour split.'
  if (input.totalHours === 2 && input.expertHours !== 1) return 'The 2-hour interview plan includes exactly one industry-expert hour.'
  if (input.totalHours > 2 && (input.expertHours < 1 || input.expertHours >= input.totalHours)) return 'Each roadmap must include at least one AI self-paced module and one industry-expert session.'
  if (input.expertPreferences.length !== input.expertHours) return 'Choose one preferred date and time for every expert hour.'
  if (new Set(input.expertPreferences.map((preference) => preference.date)).size !== input.expertPreferences.length) return 'Industry-expert sessions must be scheduled on different dates.'
  if (input.expertPreferences.some((preference) => !/^\d{4}-\d{2}-\d{2}$/.test(preference.date) || !/^\d{2}:\d{2}$/.test(preference.time))) return 'Choose a valid date and time for every expert session.'
  const today = new Date().toISOString().slice(0, 10)
  if (input.expertPreferences.some((preference) => preference.date < today)) return 'Expert-session preferences must use future dates.'
  return null
}

function focusAreas(evidence: CoachingEvidence) {
  const weakest = [...evidence.questions]
    .map((question) => ({ question, answer: evidence.finalAnswers[question.id], score: evidence.finalAnswers[question.id]?.score ?? 0 }))
    .sort((left, right) => left.score - right.score)
  const seen = new Set<string>()
  return weakest.reduce<CoachingFocusArea[]>((areas, item) => {
    if (seen.has(item.question.competency) || areas.length >= 5) return areas
    seen.add(item.question.competency)
    areas.push({
      competency: item.question.competency,
      score: item.score,
      rationale: item.answer?.feedback || `Build stronger evidence and job-ready application in ${item.question.competency.toLowerCase()}.`,
    })
    return areas
  }, [])
}

function sessionActivities(mode: CoachingMode, roleName: string, industryName: string) {
  return mode === 'expert'
    ? [`Discuss real ${industryName} expectations`, `Rehearse a realistic ${roleName} challenge`, 'Receive targeted feedback and agree next actions']
    : ['Complete the self-paced concept module', 'Work through a guided role-specific exercise', 'Practice, self-check, and record an improvement action']
}

export function buildCoachingPlan(evidence: CoachingEvidence, input: CoachingPlanInput, curatedBy = 'Zobology coaching engine'): CoachingPlan {
  const validationError = validateCoachingSelection(input)
  if (validationError) throw new Error(validationError)
  const areas = focusAreas(evidence)
  const aiHours = input.totalHours - input.expertHours
  const sessions: CoachingSession[] = []
  const addSession = (mode: CoachingMode, preference?: ExpertPreference) => {
    const focus = areas[sessions.length % Math.max(areas.length, 1)]
    const interview = input.totalHours === 2
    sessions.push({
      id: `COACH-${evidence.assessmentId}-${sessions.length + 1}`,
      sequence: sessions.length + 1,
      mode,
      durationHours: 1,
      title: interview
        ? mode === 'expert' ? 'Industry expert interview rehearsal' : 'AI interview preparation'
        : `${mode === 'expert' ? 'Industry expert coaching' : 'AI self-paced module'} · ${focus?.competency ?? evidence.roleName}`,
      objective: interview
        ? `Prepare for a ${evidence.roleName} interview in ${evidence.industryName} with evidence-led answers and realistic practice.`
        : `Improve ${focus?.competency ?? 'job readiness'} from the assessment baseline through role-specific application.`,
      activities: sessionActivities(mode, evidence.roleName, evidence.industryName),
      ...(preference ? { preferredDate: preference.date, preferredTime: preference.time } : {}),
    })
  }
  for (let index = 0; index < aiHours; index += 1) addSession('ai')
  for (let index = 0; index < input.expertHours; index += 1) addSession('expert', input.expertPreferences[index])
  const now = new Date().toISOString()
  return {
    id: `CP-${evidence.assessmentId}`,
    assessmentId: evidence.assessmentId,
    totalHours: input.totalHours,
    aiHours,
    expertHours: input.expertHours,
    summary: `A ${input.totalHours}-hour coaching pathway for ${evidence.roleName} in ${evidence.industryName}, prioritized from the candidate’s lowest-scoring assessment evidence and mentor-validated feedback.`,
    focusAreas: areas,
    sessions,
    status: input.totalHours === 2 ? 'published' : 'under_review',
    curatedBy,
    createdAt: now,
    updatedAt: now,
  }
}
