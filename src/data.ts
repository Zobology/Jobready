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
  context: string
  responseType: 'written' | 'audio'
  guidance: string
  rubric: string[]
  assessmentModes: AssessmentMode[]
  proficiency: ProficiencyLevel
  diagnosticTags: DiagnosticTag[]
  tags: string[]
  followUp?: QuestionBankItem['followUp']
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
}))

export const industries: Industry[] = masterIndustries.map((industry) => ({
  id: `industry-${industry.id}`,
  code: `I${String(industry.id).padStart(3, '0')}`,
  name: industry.name,
  description: `Business context covering ${industry.focus}.`,
  contexts: [...industry.contexts],
  focus: industry.focus,
}))

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

function selectMixed(items: QuestionBankItem[], total: number, applicationCount: number, profile: AssessmentProfile) {
  const groups = [...items.reduce((map, item) => {
    const group = map.get(item.competency) ?? []
    group.push(item)
    map.set(item.competency, group)
    return map
  }, new Map<string, QuestionBankItem[]>()).values()].sort((a, b) => Number(Boolean(resumeMatch(b[0], profile))) - Number(Boolean(resumeMatch(a[0], profile))))
  const selected: QuestionBankItem[] = []
  groups.forEach((group, index) => {
    const preferApplication = index < applicationCount
    const preferred = group.find((item) => isApplicationItem(item) === preferApplication)
    const item = preferred ?? group[0]
    if (item && selected.length < total) selected.push(item)
  })
  const applicationSelected = selected.filter(isApplicationItem).length
  const remaining = items
    .filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id))
    .sort((a, b) => {
      const aNeeded = applicationSelected < applicationCount && isApplicationItem(a) ? 1 : 0
      const bNeeded = applicationSelected < applicationCount && isApplicationItem(b) ? 1 : 0
      return bNeeded - aNeeded
    })
  return [...selected, ...remaining].slice(0, total)
}

const levelComplexity: Record<TargetBand, string> = {
  entry: 'Work within a familiar situation, make reasonable assumptions, and explain the immediate next steps.',
  associate: 'Assume you own the task independently and must align at least one stakeholder before acting.',
  mid: 'Address incomplete evidence, competing cross-functional priorities, implementation risk, and measurable trade-offs.',
  senior: 'Frame the decision for senior leadership, including strategic trade-offs, governance, second-order consequences, and organizational impact.',
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

export function buildAssessment(role: RoleFamily, industry: Industry, profile: AssessmentProfile): Question[] {
  const bank = getAssessmentBank(role.code, industry.code)
  const core = selectMixed(bank.core, 10, applicationTarget('core', 10, profile), profile)
  const roleItems = selectMixed(bank.role, 8, applicationTarget('role', 8, profile), profile)
  const industryItems = selectMixed(bank.industry, 5, applicationTarget('industry', 5, profile), profile)
  const items = [...core, ...roleItems, ...industryItems, ...(bank.simulation ? [bank.simulation] : [])]
  return items.map((item) => adaptItem(item, profile)).map(toQuestion)
}

export const educationOptions = [
  'Bachelor’s degree',
  'Master’s degree / MBA',
  'Diploma / professional qualification',
  'Other',
]

export const levelOptions = ['Entry level', 'Associate', 'Mid-level', 'Senior']
