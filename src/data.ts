import { masterCoreCompetencies, masterIndustries, masterRoles } from './masterMatrix'
import { getAssessmentBank, type AssessmentMode, type DiagnosticTag, type ProficiencyLevel, type QuestionBankItem } from './questionBank'
import type { CandidateProfile } from './reviewTypes'

export type Dimension = 'core' | 'role' | 'industry' | 'simulation'

export interface Competency {
  name: string
  description: string
}

export interface RoleFamily {
  id: string
  code: string
  name: string
  description: string
  competencies: string[]
  coreWeight: number
  roleWeight: number
  industryWeight: number
}

export interface Industry {
  id: string
  code: string
  name: string
  description: string
  contexts: string[]
  focus: string
}

export interface Question {
  id: string
  bankId: string
  dimension: Dimension
  competency: string
  prompt: string
  scenario?: string
  task?: string
  context: string
  responseType: 'written' | 'audio'
  guidance: string
  rubric: string[]
  assessmentModes: AssessmentMode[]
  proficiency: ProficiencyLevel
  diagnosticTags: DiagnosticTag[]
  tags: string[]
  followUp?: QuestionBankItem['followUp']
  sampleData?: SampleDataTask
}

export interface SampleDataTask {
  id: 'core-data-understanding'
  title: string
  description: string
  fileName: string
  downloadUrl: string
}

const competencyDescriptions: Record<string, string> = {
  Communication: 'Clear, purposeful workplace communication',
  'Problem Solving': 'Structured thinking and sound decisions',
  'Analytical Thinking': 'Patterns, evidence, and interpretation',
  'Numerical Ability': 'Quantitative reasoning and basic statistics',
  'Digital Fluency': 'Productivity tools and technology awareness',
  'Business Acumen': 'Customer, revenue, cost, and competition',
  'Professional Effectiveness': 'Ownership, priorities, and collaboration',
  'Adaptability & Learning Agility': 'Learning quickly and navigating ambiguity',
}

export const coreCompetencies: Competency[] = masterCoreCompetencies.map((name) => ({
  name,
  description: competencyDescriptions[name],
}))

function roleWeights(name: string) {
  const analytical = /Analyst|Data Science|Finance|Accounting|Audit|Tax|Credit|Investment|Software|QA|Cloud|Cybersecurity/i.test(name)
  const peopleLed = /Customer|Client|Relationship|Sales|Account|HR|Talent|Employee|Communications|Public Relations|Investor Relations/i.test(name)
  const contextual = /Operations|Supply|Logistics|Procurement|Sourcing|Inventory|Planning|Warehouse|Healthcare|Real Estate/i.test(name)
  if (analytical) return { coreWeight: 35, roleWeight: 50, industryWeight: 15 }
  if (peopleLed) return { coreWeight: 40, roleWeight: 40, industryWeight: 20 }
  if (contextual) return { coreWeight: 35, roleWeight: 45, industryWeight: 20 }
  return { coreWeight: 40, roleWeight: 45, industryWeight: 15 }
}

export const roles: RoleFamily[] = masterRoles.map((role) => ({
  id: `role-${role.id}`,
  code: `R${String(role.id).padStart(3, '0')}`,
  name: role.name,
  description: role.directive,
  competencies: [...role.competencies],
  ...roleWeights(role.name),
})).sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }))

export const industries: Industry[] = masterIndustries.map((industry) => ({
  id: `industry-${industry.id}`,
  code: `I${String(industry.id).padStart(3, '0')}`,
  name: industry.name,
  description: `Business context covering ${industry.focus}.`,
  contexts: [...industry.contexts],
  focus: industry.focus,
})).sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }))

type AssessmentProfile = Pick<CandidateProfile, 'education' | 'experienceType' | 'experienceYears' | 'level' | 'resumeName' | 'resumeSignals'>
type TargetBand = 'entry' | 'associate' | 'mid' | 'senior'

function targetBand(level: string): TargetBand {
  if (/senior/i.test(level)) return 'senior'
  if (/mid/i.test(level)) return 'mid'
  if (/associate/i.test(level)) return 'associate'
  return 'entry'
}

function experienceBand(profile: AssessmentProfile) {
  if (profile.experienceType === 'fresher') return 'fresher'
  const years = Number.parseFloat(profile.experienceYears)
  if (!Number.isFinite(years) || years < 4) return 'early-career'
  if (years < 8) return 'experienced'
  return 'highly-experienced'
}

function applicationTarget(dimension: 'core' | 'role' | 'industry', total: number, profile: AssessmentProfile) {
  const levelTargets: Record<TargetBand, Record<typeof dimension, number>> = {
    entry: { core: 5, role: 4, industry: 2 },
    associate: { core: 7, role: 6, industry: 4 },
    mid: { core: 9, role: 7, industry: 5 },
    senior: { core: 10, role: 8, industry: 5 },
  }
  const educationAdjustment = /Master|MBA/i.test(profile.education) ? 1 : 0
  const experienceAdjustment = profile.experienceType === 'experienced' ? 1 : 0
  return Math.min(total, levelTargets[targetBand(profile.level)][dimension] + educationAdjustment + experienceAdjustment)
}

function isApplicationItem(item: QuestionBankItem) {
  return item.proficiency !== 'foundation' && item.assessmentModes.includes('application')
}

function normalizedWords(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function resumeMatch(item: QuestionBankItem, profile: AssessmentProfile) {
  const itemEvidence = normalizedWords([item.competency, ...item.tags].join(' '))
  return profile.resumeSignals?.find((signal) => {
    const normalizedSignal = normalizedWords(signal)
    return normalizedSignal && (itemEvidence.includes(normalizedSignal) || normalizedSignal.includes(normalizedWords(item.competency)))
  })
}

function selectMixed(items: QuestionBankItem[], total: number, applicationCount: number, profile: AssessmentProfile, previouslyUsed = new Set<string>()) {
  const groups = [...items.reduce((map, item) => {
    const group = map.get(item.competency) ?? []
    group.push(item)
    map.set(item.competency, group)
    return map
  }, new Map<string, QuestionBankItem[]>()).values()].sort((a, b) => Number(Boolean(resumeMatch(b[0], profile))) - Number(Boolean(resumeMatch(a[0], profile))))
  const selected: QuestionBankItem[] = []
  groups.forEach((group, index) => {
    const preferApplication = index < applicationCount
    const unused = group.filter((item) => !previouslyUsed.has(item.id))
    const preferred = unused.find((item) => isApplicationItem(item) === preferApplication)
      ?? group.find((item) => isApplicationItem(item) === preferApplication && !previouslyUsed.has(item.id))
    const item = preferred ?? unused[0] ?? group[0]
    if (item && selected.length < total) selected.push(item)
  })
  const historicalCompetencyUses = new Map<string, number>()
  items.forEach((item) => {
    if (previouslyUsed.has(item.id)) historicalCompetencyUses.set(item.competency, (historicalCompetencyUses.get(item.competency) ?? 0) + 1)
  })
  const remaining = items.filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id))
  while (selected.length < total && remaining.length) {
    const applicationSelected = selected.filter(isApplicationItem).length
    remaining.sort((a, b) => {
      const reuseDifference = Number(previouslyUsed.has(a.id)) - Number(previouslyUsed.has(b.id))
      if (reuseDifference) return reuseDifference
      const aCompetencyUses = (historicalCompetencyUses.get(a.competency) ?? 0) + selected.filter((item) => item.competency === a.competency).length
      const bCompetencyUses = (historicalCompetencyUses.get(b.competency) ?? 0) + selected.filter((item) => item.competency === b.competency).length
      if (aCompetencyUses !== bCompetencyUses) return aCompetencyUses - bCompetencyUses
      const aNeeded = applicationSelected < applicationCount && isApplicationItem(a) ? 1 : 0
      const bNeeded = applicationSelected < applicationCount && isApplicationItem(b) ? 1 : 0
      return bNeeded - aNeeded || a.id.localeCompare(b.id)
    })
    selected.push(remaining.shift()!)
  }
  return selected
}

const levelComplexity: Record<TargetBand, string> = {
  entry: 'Limit your plan to actions you could complete or escalate during the next five working days, and state any assumptions you make because information is missing.',
  associate: 'Assume you own the task independently: identify who you would align, what you would decide, and what you would complete during the next two weeks.',
  mid: 'Address incomplete evidence, competing cross-functional priorities, implementation risk, and measurable trade-offs.',
  senior: 'Frame the decision for senior leadership, including strategic trade-offs, governance, second-order consequences, and organizational impact.',
}

type WorkContext = {
  businessEvidence: string
  stakeholders: string
  deadline: string
}

function stableIndex(value: string, length: number) {
  let hash = 0
  for (const character of value) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0
  return length ? hash % length : 0
}

function roleContextFamily(roleName: string) {
  if (/HR|Talent|People|Recruit|Employee|Learning|Compensation/i.test(roleName)) return 'people'
  if (/Software|Technology|Product|Cloud|Cyber|QA|Engineering|IT\b|IT Service/i.test(roleName)) return 'technology'
  if (/Customer|Client|Service|Success|Relationship|Support|Contact Center/i.test(roleName)) return 'service'
  if (/Sales|Marketing|Brand|Growth|Account Management|Business Development/i.test(roleName)) return 'commercial'
  if (/Data|Analyst|Finance|Accounting|Audit|Tax|Investment|Credit|Research/i.test(roleName)) return 'analytical'
  if (/Operations|Supply|Logistics|Procurement|Inventory|Warehouse|Manufacturing|Quality|Project|Process/i.test(roleName)) return 'operations'
  return 'general'
}

const workContexts: Record<string, WorkContext[]> = {
  operations: [
    { businessEvidence: 'work volume has risen 18%, average turnaround time has increased from 22 to 31 hours, and exceptions are up 27%', stakeholders: 'Operations, Customer Experience, and Finance', deadline: 'the weekly operating review in five working days' },
    { businessEvidence: 'output is 11% below plan, rework has increased from 6% to 10%, and one hand-off accounts for almost half of all delays', stakeholders: 'the process owner, Quality, and the downstream business team', deadline: 'a recovery-plan meeting next Monday' },
    { businessEvidence: 'demand is running 16% above forecast, service-level performance has fallen by 9 percentage points, and overtime cost is up 21%', stakeholders: 'Planning, Operations, and the commercial team', deadline: 'the next capacity decision in seven days' },
  ],
  analytical: [
    { businessEvidence: 'two dashboards report totals that differ by 12%, 9% of records have a missing key field, and the reported performance trend has reversed this month', stakeholders: 'the business owner, Data/Technology, and Finance', deadline: 'a decision meeting this Friday' },
    { businessEvidence: 'the headline KPI is down 8%, one segment contributes 54% of the decline, and the team has only six months of comparable data', stakeholders: 'the functional lead, Finance, and the data owner', deadline: 'the monthly performance review in four working days' },
    { businessEvidence: 'revenue is 7% below plan while activity volume is up 13%, and teams disagree about whether price, mix, or execution is the main driver', stakeholders: 'Commercial, Operations, and Finance', deadline: 'the forecast revision due next week' },
  ],
  service: [
    { businessEvidence: 'customer complaints are up 31%, first-contact resolution has fallen from 74% to 63%, and one issue category creates 42% of repeat contacts', stakeholders: 'Customer Service, Operations, and Product/Technology', deadline: 'a service-recovery review in five working days' },
    { businessEvidence: 'the backlog has grown by 24%, response time is above the promised service level, and satisfaction has fallen by 8 points', stakeholders: 'the service team, the process owner, and Customer Experience', deadline: 'the next customer-performance review' },
    { businessEvidence: 'new-customer volume is up 20%, onboarding completion is down 11 percentage points, and avoidable escalations have doubled', stakeholders: 'Customer Success, Sales, and Operations', deadline: 'a corrective-action meeting next Tuesday' },
  ],
  commercial: [
    { businessEvidence: 'qualified demand is up 14%, conversion has fallen by 5 percentage points, and acquisition cost is 19% above plan', stakeholders: 'Sales, Marketing, and Finance', deadline: 'the next commercial review in one week' },
    { businessEvidence: 'revenue is 9% below target, one customer segment has declined for three consecutive months, and discounting has increased by 6 percentage points', stakeholders: 'Sales, Product/Service, and Finance', deadline: 'the monthly business review this Friday' },
    { businessEvidence: 'campaign response is above benchmark but completed purchases are down 12%, and the teams disagree about lead quality versus follow-up execution', stakeholders: 'Marketing, Sales, and Operations', deadline: 'a budget-allocation decision in five working days' },
  ],
  people: [
    { businessEvidence: 'voluntary attrition has risen by 6 percentage points, time to fill is up 18 days, and one team accounts for 48% of open roles', stakeholders: 'HR, the hiring manager, and the business leader', deadline: 'the workforce review next week' },
    { businessEvidence: 'training completion is 91% but post-training quality has not improved, manager participation varies widely, and employee feedback is mixed', stakeholders: 'Learning, line managers, and Quality/Operations', deadline: 'a program decision in ten days' },
    { businessEvidence: 'engagement is down 9 points, absence is increasing, and exit feedback repeatedly mentions workload and manager communication', stakeholders: 'HR, functional managers, and senior leadership', deadline: 'the quarterly people review' },
  ],
  technology: [
    { businessEvidence: 'critical incidents are up 28%, service availability has fallen below the agreed target, and 43% of failures follow recent releases', stakeholders: 'Product, Engineering, and Customer Support', deadline: 'the reliability review in five working days' },
    { businessEvidence: 'feature adoption is 17% below target, support tickets are up 22%, and user drop-off is concentrated at one step', stakeholders: 'Product, Engineering, and Customer Success', deadline: 'the next release-planning meeting' },
    { businessEvidence: 'delivery is three weeks behind plan, unresolved dependencies have doubled, and the available team capacity cannot cover every requested feature', stakeholders: 'Product, Technology, and the business sponsor', deadline: 'a scope decision this Friday' },
  ],
  general: [
    { businessEvidence: 'performance is 10% below target, operating exceptions are up 23%, and one process stage contributes 45% of the gap', stakeholders: 'the functional owner, Operations, and Finance', deadline: 'the monthly performance review in five working days' },
    { businessEvidence: 'cost is 12% above plan, delivery is slipping, and teams have different views of the root cause and priority', stakeholders: 'the business owner, Finance, and the delivery team', deadline: 'an executive update next week' },
    { businessEvidence: 'demand has increased but quality and turnaround time have both worsened for three consecutive weeks', stakeholders: 'the commercial team, Operations, and Quality', deadline: 'a corrective-action review this Friday' },
  ],
}

function contextualStakeholders(family: string, industry: Industry, fallback: string) {
  if (/Hospital|Healthcare|HealthTech|Diagnostics|Pharma/i.test(industry.name)) {
    if (family === 'people') return 'HR, clinical/functional managers, and Quality'
    if (family === 'service') return 'Patient Services, Clinical Operations, and Quality & Safety'
    if (family === 'technology') return 'Product/Technology, Clinical Operations, and Privacy & Security'
  }
  if (/Banking|NBFC|Insurance|FinTech|Capital Markets/i.test(industry.name)) {
    if (family === 'analytical') return 'the business owner, Data Governance, and Risk & Compliance'
    if (family === 'service') return 'Customer Service, Operations, and Risk & Compliance'
  }
  return fallback
}

function workContext(item: QuestionBankItem, role: RoleFamily, industry: Industry) {
  const family = roleContextFamily(role.name)
  const contexts = workContexts[roleContextFamily(role.name)] ?? workContexts.general
  const selected = contexts[stableIndex(`${item.id}-${role.code}`, contexts.length)]
  return { ...selected, stakeholders: contextualStakeholders(family, industry, selected.stakeholders) }
}

function industryAreas(industry: Industry, item: QuestionBankItem) {
  const first = industry.contexts[stableIndex(item.id, industry.contexts.length)] ?? industry.focus
  const second = industry.contexts[stableIndex(`${item.id}-secondary`, industry.contexts.length)] ?? industry.focus
  return first === second ? first : `${first} and ${second}`
}

function contextualizeItem(item: QuestionBankItem, role: RoleFamily, industry: Industry, profile: AssessmentProfile): QuestionBankItem {
  const context = workContext(item, role, industry)
  const areas = industryAreas(industry, item)
  const level = profile.level.toLowerCase().replace(/ level$/, '-level')
  const target = `${level} ${role.name} professional in a mid-sized ${industry.name} organization`
  const targetWithArticle = `${/^[aeiou]/i.test(target) ? 'an' : 'a'} ${target}`
  let prompt: string
  let scenario: string
  let task: string
  let guidance = item.guidance

  if (item.dimension === 'core') {
    scenario = `You are ${targetWithArticle}. This situation affects ${areas}, involves ${context.stakeholders}, and requires a decision before ${context.deadline}.`
    task = item.prompt
    prompt = `${scenario} ${task}`
    guidance = `${guidance} Make your response specific to the stated role, industry context, stakeholders, and decision deadline.`
  } else if (item.dimension === 'role') {
    scenario = `You are ${targetWithArticle}. In work involving ${areas}, ${context.businessEvidence}. The stakeholders—${context.stakeholders}—have different views on the cause and priority, and you must prepare a recommendation before ${context.deadline}.`
    if (isApplicationItem(item)) {
      task = `Using ${item.competency.toLowerCase()}, explain how you would diagnose the situation, what information you would request from each relevant team, how you would align priorities and owners, and which measures would show that your plan worked.`
      guidance = 'Structure your answer as: diagnosis, evidence required, stakeholder coordination, prioritized actions with owners/timing, and success measures.'
    } else {
      task = `Before the team acts, explain the purpose of ${item.competency.toLowerCase()} in this situation, the decision it should support, and one common mistake that could lead to a poor outcome.`
      guidance = 'Connect the concept directly to the evidence, stakeholders, decision, and business outcome in the scenario.'
    }
    prompt = `${scenario} ${task}`
  } else if (item.dimension === 'industry') {
    scenario = `You are supporting ${role.name} in a mid-sized ${industry.name} organization. In an area covering ${areas}, ${context.businessEvidence}. A recommendation is required before ${context.deadline}.`
    if (isApplicationItem(item)) {
      task = `Using your understanding of ${item.competency.toLowerCase()}, identify the signals you would examine, explain what each could reveal, and recommend the first two actions. Include the industry risk or customer/business impact you would monitor.`
      guidance = 'Link the industry context to evidence, interpretation, a practical decision, and measurable impact.'
    } else {
      task = `Explain why ${item.competency.toLowerCase()} matters here, which stakeholders and risks it affects, and how misunderstanding it could change the decision.`
      guidance = 'Demonstrate contextual understanding by referring to the facts and decision in the scenario; specialist terminology alone is not sufficient.'
    }
    prompt = `${scenario} ${task}`
  } else {
    scenario = `You are ${targetWithArticle} responsible for work involving ${areas}. Over the last six weeks, ${context.businessEvidence}. The stakeholders—${context.stakeholders}—disagree on the primary cause, the available team can implement no more than two major actions this cycle, and leadership needs your plan before ${context.deadline}.`
    task = 'Diagnose the most likely drivers, identify the additional evidence you need, prioritize two actions, assign stakeholders and timing, explain key risks or trade-offs, and define three KPIs that would confirm whether the plan succeeded.'
    prompt = `${scenario} ${task}`
    guidance = 'Present an executive-ready response with: assumptions, diagnosis, evidence, prioritized action plan, coordination approach, risks/trade-offs, and three measurable KPIs.'
  }

  return {
    ...item,
    prompt,
    scenario,
    task,
    guidance,
    followUp: item.followUp ? {
      ...item.followUp,
      prompt: `Give a 60–90 second executive update for the ${context.deadline}: summarize your diagnosis, the two actions you recommend, the stakeholders you need to align, and the expected measurable impact.`,
    } : undefined,
  }
}

function educationExpectation(education: string) {
  if (/Master|MBA/i.test(education)) return 'Integrate commercial impact and stakeholder implications where relevant.'
  if (/Diploma|professional/i.test(education)) return 'Emphasize practical tools, process steps, and observable outcomes.'
  if (/Bachelor/i.test(education)) return 'Translate relevant concepts into a practical workplace response.'
  return 'Make assumptions explicit and explain your reasoning in practical workplace terms.'
}

function experienceExpectation(profile: AssessmentProfile) {
  if (profile.experienceType === 'fresher') return 'Where relevant, you may draw evidence from internships, academic projects, volunteering, or other structured responsibilities.'
  const years = profile.experienceYears.trim()
  return `Where relevant, connect your answer to an anonymized example from ${years ? `${years} years of` : 'your'} professional experience and distinguish your own contribution.`
}

function adaptItem(item: QuestionBankItem, profile: AssessmentProfile): QuestionBankItem {
  const band = targetBand(profile.level)
  const matchedResumeSignal = resumeMatch(item, profile)
  const evidenceCriterion = profile.experienceType === 'fresher' ? 'Transferability of evidence' : 'Professional evidence and ownership'
  const levelCriteria = band === 'senior'
    ? ['Strategic judgement', 'Governance and second-order impact']
    : band === 'mid'
      ? ['Stakeholder trade-offs', 'Ambiguity and risk management']
      : band === 'associate' ? ['Independent application'] : []
  return {
    ...item,
    proficiency: band === 'mid' || band === 'senior' ? 'advanced' : band === 'associate' ? 'job_ready' : item.proficiency,
    prompt: `${item.prompt} ${levelComplexity[band]}${matchedResumeSignal ? ` Your resume references ${matchedResumeSignal}; use this response to demonstrate the depth of that capability.` : ''}`,
    task: item.task ? `${item.task} ${levelComplexity[band]}${matchedResumeSignal ? ` Your resume references ${matchedResumeSignal}; use this response to demonstrate the depth of that capability.` : ''}` : undefined,
    guidance: `${item.guidance} ${educationExpectation(profile.education)} ${experienceExpectation(profile)}${profile.resumeName ? ' Keep examples consistent with the responsibilities and outcomes represented in your resume.' : ''}`,
    rubric: [...new Set([...item.rubric, ...levelCriteria, evidenceCriterion, ...(matchedResumeSignal ? ['Resume-claim validation'] : [])])],
    tags: [...new Set([...item.tags, `target-${band}`, `education-${profile.education.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, `experience-${experienceBand(profile)}`, ...(matchedResumeSignal ? [`resume-evidence-${normalizedWords(matchedResumeSignal).replace(/ /g, '-')}`] : [])])],
  }
}

function toQuestion(item: QuestionBankItem, occurrence: number): Question {
  const dimension: Dimension = item.dimension === 'role_industry' ? 'simulation' : item.dimension
  const contextLabels: Record<Dimension, string> = {
    core: item.responseType === 'audio' ? 'Spoken workplace evidence' : 'Core workplace evidence',
    role: `${item.role} work sample`,
    industry: `${item.industry} context`,
    simulation: 'Integrated role × industry simulation',
  }
  return {
    id: `${item.id}-${occurrence}`,
    bankId: item.id,
    dimension,
    competency: item.competency,
    prompt: item.prompt,
    scenario: item.scenario,
    task: item.task,
    context: contextLabels[dimension],
    responseType: item.responseType,
    guidance: item.guidance,
    rubric: item.rubric,
    assessmentModes: item.assessmentModes,
    proficiency: item.proficiency,
    diagnosticTags: item.diagnosticTags,
    tags: item.tags,
    followUp: item.followUp,
  }
}

function dataVariant(roleName: string) {
  if (/HR|Talent|People|Recruit|Employee/i.test(roleName)) return 'people'
  if (/Operations|Supply|Logistics|Procurement|Inventory|Warehouse|Manufacturing|Quality/i.test(roleName)) return 'operations'
  if (/Software|Technology|Product|Cloud|Cyber|QA|Engineering/i.test(roleName)) return 'technology'
  if (/Customer|Client|Service|Success|Relationship|Support/i.test(roleName)) return 'customer'
  if (/Data|Analyst|Finance|Accounting|Audit|Tax|Investment|Credit|Marketing|Sales/i.test(roleName)) return 'commercial'
  return 'general'
}

function addSampleDataTask(questions: Question[], role: RoleFamily, industry: Industry, profile: AssessmentProfile) {
  const preferredCompetency = /Data|Analyst|Finance|Accounting|Operations|Supply|Marketing|Sales/i.test(role.name)
    ? 'Analytical Thinking'
    : 'Numerical Ability'
  const question = questions.find((item) => item.dimension === 'core' && item.competency === preferredCompetency && item.assessmentModes.includes('application'))
    ?? questions.find((item) => item.dimension === 'core' && ['Analytical Thinking', 'Numerical Ability'].includes(item.competency))
  if (!question) return questions

  const variant = dataVariant(role.name)
  const query = new URLSearchParams({
    role: role.name,
    industry: industry.name,
    level: profile.level,
    education: profile.education,
    experienceType: profile.experienceType,
    variant,
  })
  const sampleData: SampleDataTask = {
    id: 'core-data-understanding',
    title: `${industry.name} ${role.name} data exercise`,
    description: 'Download the source workbook, complete your analysis in the file, then upload the completed workbook and explain your approach below.',
    fileName: `zobology-${role.code.toLowerCase()}-${industry.code.toLowerCase()}-data-exercise.xlsx`,
    downloadUrl: `/api/assessment-data/core-data-understanding?${query.toString()}`,
  }
  return questions.map((item) => item.id === question.id ? {
    ...item,
    prompt: `${item.prompt} Use the attached Excel dataset as your source. Show your calculations or analysis in the workbook, identify the most important patterns, and recommend the next action.`,
    task: `${item.task ?? item.prompt} Use the attached Excel dataset as your source. Show your calculations or analysis in the workbook, identify the most important patterns, and recommend the next action.`,
    guidance: `${item.guidance} Submit both the completed workbook and a concise written explanation of your approach, assumptions, findings, and recommendation.`,
    rubric: [...new Set([...item.rubric, 'Spreadsheet accuracy', 'Data interpretation', 'Method transparency'])],
    tags: [...new Set([...item.tags, 'excel-work-sample', `data-variant-${variant}`])],
    sampleData,
  } : item)
}

export function buildAssessment(role: RoleFamily, industry: Industry, profile: AssessmentProfile, options: { previousCoreBankIds?: string[] } = {}): Question[] {
  const bank = getAssessmentBank(role.code, industry.code)
  const core = selectMixed(bank.core, 10, applicationTarget('core', 10, profile), profile, new Set(options.previousCoreBankIds ?? []))
  const roleItems = selectMixed(bank.role, 8, applicationTarget('role', 8, profile), profile)
  const industryItems = selectMixed(bank.industry, 5, applicationTarget('industry', 5, profile), profile)
  const items = [...core, ...roleItems, ...industryItems, ...(bank.simulation ? [bank.simulation] : [])]
  const questions = items
    .map((item) => contextualizeItem(item, role, industry, profile))
    .map((item) => adaptItem(item, profile))
    .map(toQuestion)
  return addSampleDataTask(questions, role, industry, profile)
}

export const educationOptions = [
  'Bachelor’s degree',
  'Master’s degree / MBA',
  'Diploma / professional qualification',
  'Other',
]

export const levelOptions = ['Entry level', 'Associate', 'Mid-level', 'Senior']
