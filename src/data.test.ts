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

test('builds distinct and realistic entry-level B2C Sales work samples for EdTech', () => {
  const role = roles.find((item) => item.name === 'B2C Sales')!
  const industry = industries.find((item) => item.name === 'EdTech')!
  const questions = buildAssessment(role, industry, profile)
  const roleQuestions = questions.filter((question) => question.dimension === 'role')
  const industryQuestions = questions.filter((question) => question.dimension === 'industry')
  const simulation = questions.find((question) => question.dimension === 'simulation')!

  assert.deepEqual(Object.fromEntries(roleQuestions.map((question) => [question.competency, question.format])), {
    'Need discovery': 'situational',
    persuasion: 'audio',
    'objection handling': 'situational',
    conversion: 'excel',
    'customer communication': 'written_communication',
  })
  assert.equal(new Set([...roleQuestions, ...industryQuestions, simulation].map((question) => question.scenario)).size, 8)
  assert.ok(roleQuestions.every((question) => !/stakeholders.+different views/i.test(question.scenario ?? '')))
  assert.match(roleQuestions.find((question) => question.competency === 'Need discovery')!.task!, /first five minutes/i)
  assert.match(roleQuestions.find((question) => question.competency === 'conversion')!.task!, /cost per conversion/i)
  assert.match(roleQuestions.find((question) => question.competency === 'customer communication')!.task!, /follow-up email/i)
  assert.match(industryQuestions.find((question) => question.format === 'situational')!.scenario!, /guaranteed outcome/i)
  assert.match(simulation.task!, /prioritize the leads/i)
  assert.ok([...roleQuestions, ...industryQuestions, simulation].every((question) => /entry-level employee’s authority/i.test(question.task ?? '')))
})

test('generates usable, distinct work samples for every role, industry, and level', () => {
  const levels = ['Entry level', 'Associate', 'Mid-level', 'Senior']
  const expectedLevelLanguage = [/entry-level employee’s authority/i, /own the task independently/i, /competing cross-functional priorities/i, /senior leadership/i]
  const bannedGenericLanguage = [
    /stakeholders.+different views on the cause and priority/i,
    /using .+ explain how you would diagnose the situation/i,
    /respond as you would in the real job/i,
    /primary performance indicator fell/i,
    /reviewer needs a concrete/i,
  ]
  const failures: string[] = []

  for (const role of roles) {
    for (const industry of industries) {
      levels.forEach((level, levelIndex) => {
        const questions = buildAssessment(role, industry, { ...profile, level })
        const standard = questions.filter((question) => question.dimension !== 'simulation')
        const tailored = questions.filter((question) => question.dimension !== 'core')
        const label = `${role.name} × ${industry.name} × ${level}`
        const formatCounts = standard.reduce<Partial<Record<QuestionFormat, number>>>((counts, question) => {
          counts[question.format] = (counts[question.format] ?? 0) + 1
          return counts
        }, {})

        if (questions.length !== 11) failures.push(`${label}: expected 11 questions`)
        if (JSON.stringify(formatCounts) !== JSON.stringify({ audio: 2, excel: 3, written_communication: 2, situational: 3 })) failures.push(`${label}: incorrect format mix`)
        if (new Set(tailored.map((question) => `${question.scenario}\n${question.task}`)).size !== tailored.length) failures.push(`${label}: repeated tailored work sample`)
        for (const question of tailored) {
          const text = `${question.scenario} ${question.task}`
          if (!question.scenario || question.scenario.length < 100) failures.push(`${label}: ${question.bankId} lacks a concrete scenario`)
          if (!question.task || question.task.length < 100) failures.push(`${label}: ${question.bankId} lacks a concrete task`)
          if (!expectedLevelLanguage[levelIndex].test(question.task ?? '')) failures.push(`${label}: ${question.bankId} lacks level boundary`)
          if (bannedGenericLanguage.some((pattern) => pattern.test(text))) failures.push(`${label}: ${question.bankId} uses banned generic wording`)
          if (question.prompt !== `${question.scenario} ${question.task}`) failures.push(`${label}: ${question.bankId} prompt is not synchronized`)
        }
      })
    }
  }

  assert.deepEqual(failures.slice(0, 30), [])
})
