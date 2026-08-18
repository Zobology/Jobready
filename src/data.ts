import { masterCoreCompetencies, masterIndustries, masterRoles } from './masterMatrix'
import { getAssessmentBank, type AssessmentMode, type DiagnosticTag, type ProficiencyLevel, type QuestionBankItem } from './questionBank'

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

const selectedCoreIndexes = [0, 2, 3, 5, 6, 7, 9, 11, 13, 15]

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

export function buildAssessment(role: RoleFamily, industry: Industry): Question[] {
  const bank = getAssessmentBank(role.code, industry.code)
  const core = selectedCoreIndexes.map((index) => bank.core[index]).filter(Boolean)
  const roleItems = bank.role.filter((item) => item.assessmentModes.includes('application')).slice(0, 8)
  const industryItems = bank.industry.filter((item) => item.assessmentModes.includes('application')).slice(0, 5)
  const items = [...core, ...roleItems, ...industryItems, ...(bank.simulation ? [bank.simulation] : [])]
  return items.map(toQuestion)
}

export const educationOptions = [
  'Bachelor’s degree',
  'Master’s degree / MBA',
  'Diploma / professional qualification',
  'Other',
]

export const levelOptions = ['Entry level', 'Associate', 'Mid-level', 'Senior']
