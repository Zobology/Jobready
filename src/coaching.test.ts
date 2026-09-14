import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCoachingPlan, coachingProgressStatus, validateCoachingSelection } from './coaching'
import { buildAssessment, industries, roles } from './data'

const questions = buildAssessment(roles[0], industries[0], {
  education: 'Bachelor’s degree', experienceType: 'fresher', experienceYears: '', level: 'Entry level', resumeName: '', resumeSignals: [],
})
const evidence = {
  assessmentId: 'assessment-1',
  roleName: roles[0].name,
  industryName: industries[0].name,
  questions,
  finalAnswers: Object.fromEntries(questions.map((question, index) => [question.id, { score: 45 + index, feedback: `Feedback for ${question.competency}` }])),
}

function futureDate(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

test('requires one expert hour in the two-hour interview plan', () => {
  assert.match(validateCoachingSelection({ totalHours: 2, expertHours: 0, expertPreferences: [] }) ?? '', /exactly one/i)
  assert.equal(validateCoachingSelection({ totalHours: 2, expertHours: 1, expertPreferences: [{ date: futureDate(1), time: '10:00' }] }), null)
})

test('requires expert sessions on separate dates', () => {
  assert.match(validateCoachingSelection({
    totalHours: 8,
    expertHours: 2,
    expertPreferences: [{ date: futureDate(1), time: '10:00' }, { date: futureDate(1), time: '15:00' }],
  }) ?? '', /different dates/i)
})

test('requires both AI and expert learning in every roadmap above two hours', () => {
  assert.match(validateCoachingSelection({ totalHours: 4, expertHours: 0, expertPreferences: [] }) ?? '', /at least one AI/i)
  assert.match(validateCoachingSelection({ totalHours: 4, expertHours: 4, expertPreferences: [1, 2, 3, 4].map((day) => ({ date: futureDate(day), time: '10:00' })) }) ?? '', /at least one AI/i)
})

test('builds one-hour sessions using the selected AI and expert ratio', () => {
  const plan = buildCoachingPlan(evidence, {
    totalHours: 8,
    expertHours: 3,
    expertPreferences: [{ date: futureDate(1), time: '10:00' }, { date: futureDate(2), time: '11:00' }, { date: futureDate(3), time: '12:00' }],
  })
  assert.equal(plan.aiHours, 5)
  assert.equal(plan.expertHours, 3)
  assert.equal(plan.sessions.length, 8)
  assert.equal(plan.status, 'under_review')
  assert.ok(plan.sessions.every((session) => session.durationHours === 1))
  assert.deepEqual(plan.sessions.filter((session) => session.mode === 'expert').map((session) => session.preferredDate), [futureDate(1), futureDate(2), futureDate(3)])
  assert.ok(plan.focusAreas.length > 0)
})

test('publishes only the two-hour interview plan without roadmap review', () => {
  const plan = buildCoachingPlan(evidence, { totalHours: 2, expertHours: 1, expertPreferences: [{ date: futureDate(1), time: '10:00' }] })
  assert.equal(plan.status, 'published')
  assert.equal(plan.aiHours, 1)
  assert.equal(plan.expertHours, 1)
})

test('maps saved AI module progress to resumable states', () => {
  assert.equal(coachingProgressStatus(0), 'not_started')
  assert.equal(coachingProgressStatus(40), 'in_progress')
  assert.equal(coachingProgressStatus(100), 'completed')
  assert.throws(() => coachingProgressStatus(101), /0 to 100/)
})
