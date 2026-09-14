import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAssessment, industries, roles, type Dimension, type QuestionFormat } from './data'

const profile = {
  education: 'Bachelor’s degree',
  experienceType: 'fresher' as const,
  experienceYears: '',
  level: 'Entry level',
  resumeName: '',
  resumeSignals: [],
}

test('builds ten questions plus a separate job simulation', () => {
  const questions = buildAssessment(roles[0], industries[0], profile)
  const dimensionCounts = questions.reduce<Record<Dimension, number>>((counts, question) => {
    counts[question.dimension] += 1
    return counts
  }, { core: 0, role: 0, industry: 0, simulation: 0 })

  assert.equal(questions.length, 11)
  assert.deepEqual(dimensionCounts, { core: 3, role: 5, industry: 2, simulation: 1 })
  assert.equal(questions.at(-1)?.format, 'simulation')
})

test('uses the required format mix across the ten standard questions', () => {
  const questions = buildAssessment(roles[0], industries[0], profile)
  const standardQuestions = questions.filter((question) => question.dimension !== 'simulation')
  const formatCounts = standardQuestions.reduce<Partial<Record<QuestionFormat, number>>>((counts, question) => {
    counts[question.format] = (counts[question.format] ?? 0) + 1
    return counts
  }, {})

  assert.deepEqual(formatCounts, {
    audio: 2,
    excel: 3,
    written_communication: 2,
    situational: 3,
  })
  assert.equal(standardQuestions.filter((question) => question.responseType === 'audio').length, 2)
  assert.equal(standardQuestions.filter((question) => question.sampleData).length, 3)
})

test('provides distinct core, role, and industry Excel exercises', () => {
  const questions = buildAssessment(roles[0], industries[0], profile)
  const excelQuestions = questions.filter((question) => question.format === 'excel')

  assert.deepEqual(excelQuestions.map((question) => question.dimension), ['core', 'role', 'industry'])
  assert.deepEqual(excelQuestions.map((question) => new URL(question.sampleData!.downloadUrl, 'https://example.test').searchParams.get('exercise')), ['core', 'role', 'industry'])
  assert.equal(new Set(excelQuestions.map((question) => question.sampleData!.id)).size, 3)
})

test('allocates each response format to the requested dimensions', () => {
  const standardQuestions = buildAssessment(roles[0], industries[0], profile).filter((question) => question.dimension !== 'simulation')
  const dimensionsFor = (format: QuestionFormat) => standardQuestions.filter((question) => question.format === format).map((question) => question.dimension)

  assert.deepEqual(dimensionsFor('audio'), ['core', 'role'])
  assert.deepEqual(dimensionsFor('excel'), ['core', 'role', 'industry'])
  assert.deepEqual(dimensionsFor('written_communication'), ['core', 'role'])
  assert.deepEqual(dimensionsFor('situational'), ['role', 'role', 'industry'])
})
