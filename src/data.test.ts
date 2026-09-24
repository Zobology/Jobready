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

test('builds distinct role-and-industry-specific Core audio, Excel, and written evidence', () => {
  const role = roles.find((item) => item.name === 'Customer Experience')!
  const industry = industries.find((item) => item.name === 'Fashion / Apparel')!
  const core = buildAssessment(role, industry, profile).filter((question) => question.dimension === 'core')

  assert.deepEqual(core.map((question) => question.format), ['audio', 'excel', 'written_communication'])
  assert.ok(core.every((question) => /Customer Experience/i.test(question.scenario ?? '')))
  assert.ok(core.every((question) => /Fashion \/ Apparel/i.test(question.scenario ?? '')))
  assert.equal(new Set(core.map((question) => `${question.scenario}\n${question.task}`)).size, 3)
  assert.match(core[0].task!, /update you would actually deliver/i)
  assert.match(core[0].guidance, /do not describe a communication framework/i)
  assert.match(core[1].task!, /resolution rate, escalation rate, contacts per unit of capacity/i)
  assert.ok(core[1].sampleData)
  assert.match(core[2].task!, /finished follow-up email/i)
  assert.match(core[2].task!, /evidence-to-impact storyline/i)

  const coreExcelTask = (roleName: string) => {
    const selectedRole = roles.find((item) => item.name === roleName)!
    return buildAssessment(selectedRole, industry, profile).find((question) => question.dimension === 'core' && question.format === 'excel')!.task!
  }
  assert.match(coreExcelTask('Talent Acquisition'), /applicant-to-hire rate/i)
  assert.match(coreExcelTask('Software Development'), /defects or incidents per completed item/i)
  assert.match(coreExcelTask('Supply Chain'), /capacity utilization, exception rate/i)
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

test('tests direct customer-handling skills for entry-level Customer Experience in Fashion/Apparel', () => {
  const role = roles.find((item) => item.name === 'Customer Experience')!
  const industry = industries.find((item) => item.name === 'Fashion / Apparel')!
  const roleQuestions = buildAssessment(role, industry, profile).filter((question) => question.dimension === 'role')
  const byCompetency = Object.fromEntries(roleQuestions.map((question) => [question.competency, question]))

  assert.deepEqual(Object.fromEntries(roleQuestions.map((question) => [question.competency, question.format])), {
    'Customer journey': 'written_communication',
    VOC: 'situational',
    'Service recovery': 'situational',
    'CX metrics': 'excel',
    empathy: 'audio',
  })
  assert.match(byCompetency['Customer journey'].task!, /reply you would send to the customer/i)
  assert.match(byCompetency.VOC.scenario!, /50 post-return comments/i)
  assert.match(byCompetency.VOC.task!, /voice-of-customer finding/i)
  assert.match(byCompetency['Service recovery'].scenario!, /refund has now been pending for eight days/i)
  assert.match(byCompetency['Service recovery'].task!, /what you would say to the customer/i)
  assert.match(byCompetency['CX metrics'].task!, /resolution rate, escalation rate/i)
  assert.match(byCompetency.empathy.task!, /response directly to the customer/i)
  assert.match(byCompetency.empathy.guidance, /not an internal briefing/i)
  assert.deepEqual(byCompetency.empathy.rubric, ['Listening and acknowledgement', 'Empathy', 'Clarifying question', 'Ownership and action', 'Expectation setting'])
  assert.ok(roleQuestions.every((question) => !/discovery brief|analysis note|customer experience briefing/i.test(question.task ?? '')))
})

test('requires direct role-play instead of internal briefings for interaction competencies', () => {
  const industry = industries.find((item) => item.name === 'Fashion / Apparel')!
  const questionFor = (roleName: string, competency: RegExp) => {
    const role = roles.find((item) => item.name === roleName)!
    return buildAssessment(role, industry, profile).find((question) => question.dimension === 'role' && competency.test(question.competency))!
  }
  const salesPitch = questionFor('Inside Sales', /pitching/i)
  const candidateInterview = questionFor('Talent Acquisition', /interviewing/i)
  const customerCommunication = questionFor('Customer Service', /^communication$/i)

  assert.equal(salesPitch.format, 'audio')
  assert.match(salesPitch.task!, /speaking directly to the prospect or customer/i)
  assert.match(salesPitch.task!, /do not describe what you would say/i)
  assert.equal(candidateInterview.format, 'audio')
  assert.match(candidateInterview.task!, /speaking directly to the candidate/i)
  assert.equal(customerCommunication.format, 'audio')
  assert.match(customerCommunication.task!, /speaking directly to the customer or client/i)
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
        const tailored = questions
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
