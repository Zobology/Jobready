import { masterCoreCompetencies, masterIndustries, masterRoles } from './masterMatrix'
import { getAssessmentBank, type AssessmentMode, type DiagnosticTag, type ProficiencyLevel, type QuestionBankItem } from './questionBank'
import type { CandidateProfile } from './reviewTypes'

export type Dimension = 'core' | 'role' | 'industry' | 'simulation'
export type QuestionFormat = 'audio' | 'excel' | 'written_communication' | 'situational' | 'simulation'
type StandardQuestionFormat = Exclude<QuestionFormat, 'simulation'>

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
  format: QuestionFormat
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
  id: string
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
  entry: 'Focus on actions within an entry-level employee’s authority, identify what you would ask your manager to approve or escalate, and state any assumptions you make.',
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
  if (/Legal|Compliance|\bRisk\b|Audit|Tax/i.test(roleName)) return 'governance'
  if (/Corporate Communications|Public Relations|Investor Relations/i.test(roleName)) return 'communications'
  if (/Consulting|Strategy|Transformation|Research \/ Advisory/i.test(roleName)) return 'advisory'
  if (/Administration/i.test(roleName)) return 'coordination'
  if (/HR|Talent|People|Recruit|Employee|Learning|Compensation/i.test(roleName)) return 'people'
  if (/Software|Technology|Product|Cloud|Cyber|QA|Engineering|IT\b|IT Service/i.test(roleName)) return 'technology'
  if (/Customer|Client|Service|Success|Relationship|Support|Contact Center/i.test(roleName)) return 'service'
  if (/Sales|Marketing|Brand|Growth|Account Management|Business Development/i.test(roleName)) return 'commercial'
  if (/Data|Analyst|Finance|Accounting|Audit|Tax|Investment|Credit|Research/i.test(roleName)) return 'analytical'
  if (/Operations|Supply|Logistics|Procurement|Inventory|Warehouse|Manufacturing|Quality|Project|Process/i.test(roleName)) return 'operations'
  return 'general'
}

const workContexts: Record<string, WorkContext[]> = {
  governance: [
    { businessEvidence: 'a control exception affects 17% of sampled cases, supporting evidence is missing for one decision path, and the issue has not been assigned a remediation owner', stakeholders: 'the business owner, Legal/Compliance, and Internal Audit or Quality', deadline: 'the next control review in five working days' },
    { businessEvidence: 'a proposed policy interpretation would speed delivery, but two comparable cases were handled differently and the approval record is incomplete', stakeholders: 'the policy owner, Operations, and Risk or Legal', deadline: 'an approval decision this Friday' },
    { businessEvidence: 'reported incidents are up 23%, one process stage creates most exceptions, and current monitoring would detect the issue only after customer or financial impact', stakeholders: 'the control owner, Technology/Operations, and senior management', deadline: 'the monthly risk review next week' },
  ],
  communications: [
    { businessEvidence: 'a draft public claim is not fully supported, stakeholder questions have doubled, and different channels currently use inconsistent wording', stakeholders: 'Communications, Legal/Compliance, and the accountable business leader', deadline: 'publication approval tomorrow' },
    { businessEvidence: 'sentiment has declined after a service issue, one unverified explanation is circulating externally, and customer-facing teams need an approved response', stakeholders: 'the business owner, Customer Service, and Communications', deadline: 'the next external update in four working days' },
    { businessEvidence: 'performance is below guidance, one variance is temporary while another may persist, and the supporting analysis is still being validated', stakeholders: 'Finance, executive leadership, and Communications or Investor Relations', deadline: 'the scheduled stakeholder briefing next week' },
  ],
  advisory: [
    { businessEvidence: 'the client’s target is 12% above current performance, one segment creates more than half of the gap, and two proposed explanations conflict', stakeholders: 'the client sponsor, the functional owner, and the analysis team', deadline: 'the steering discussion in five working days' },
    { businessEvidence: 'the preferred option has the fastest payback but depends on an untested customer assumption and a constrained implementation team', stakeholders: 'the decision owner, Finance, and Operations or Technology', deadline: 'the option review next week' },
    { businessEvidence: 'the baseline is incomplete, teams define success differently, and only one of three initiatives can be funded this cycle', stakeholders: 'the executive sponsor, initiative owners, and Finance', deadline: 'the prioritization workshop this Friday' },
  ],
  coordination: [
    { businessEvidence: 'two executive meetings overlap, one decision pack is incomplete, and a critical external participant has not confirmed availability', stakeholders: 'the meeting owners, contributors, and the external participant', deadline: 'the final schedule and pack release tomorrow' },
    { businessEvidence: 'a workplace vendor has missed two service commitments, invoices differ from the agreed scope, and an upcoming event depends on resolution', stakeholders: 'the vendor, Finance or Procurement, and the internal service owner', deadline: 'the event-readiness review in four working days' },
    { businessEvidence: 'records are stored in inconsistent locations, one approval cannot be traced, and teams are working from different document versions', stakeholders: 'document owners, the approving manager, and affected users', deadline: 'the compliance and handover check next week' },
  ],
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

function workContext(item: Pick<QuestionBankItem, 'id'>, role: RoleFamily, industry: Industry) {
  const family = roleContextFamily(role.name)
  const contexts = workContexts[roleContextFamily(role.name)] ?? workContexts.general
  const selected = contexts[stableIndex(`${item.id}-${role.code}`, contexts.length)]
  return { ...selected, stakeholders: contextualStakeholders(family, industry, selected.stakeholders) }
}

function industryAreas(industry: Industry, item: Pick<QuestionBankItem, 'id'>) {
  const first = industry.contexts[stableIndex(item.id, industry.contexts.length)] ?? industry.focus
  const second = industry.contexts[stableIndex(`${item.id}-secondary`, industry.contexts.length)] ?? industry.focus
  return first === second ? first : `${first} and ${second}`
}

type WorkDefinition = {
  setup: string
  output: string
  actions: string
}

function competencyProof(competency: string, roleName = '') {
  const value = competency.toLowerCase()
  if (value === 'sourcing' && /Talent|Recruit|HR|People/i.test(roleName)) return {
    detail: 'The current source mix produces applicant volume but not enough qualified candidates.',
    requirement: 'name the priority candidate source, search or outreach logic, qualification screen, and source-quality measure',
  }
  const matches: Array<[RegExp, string, string]> = [
    [/\bsql\b/, 'A sample extract and the KPI definition are available, but the join and filter logic have not been validated.', 'include the query or pseudocode, join keys, filters, aggregation logic, and validation checks'],
    [/\bexcel\b/, 'The source workbook contains raw rows but no controlled calculation or summary view.', 'include the formulas, lookup or pivot logic, error checks, and a decision-ready summary'],
    [/statistic|experiment|model evaluation/, 'The observed movement may reflect normal variation, selection bias, or a real effect.', 'select and justify the analytical method, quantify uncertainty, and state what the result can and cannot support'],
    [/visual|dashboard/, 'The current chart hides the segment driving the result and gives no indication of data quality.', 'specify the chart or dashboard layout, measures, filters, annotations, and the decision each view supports'],
    [/screening/, 'The existing screen is applied inconsistently and rejects some potentially suitable cases.', 'write the screening criteria, evidence threshold, decision record, and rule for borderline cases'],
    [/interview/, 'Interviewers use different questions and scoring standards for the same requirement.', 'write structured questions, evidence probes, scoring anchors, and the method for combining interviewer evidence'],
    [/seo/, 'Organic traffic is rising on informational pages but not on the pages tied to the target outcome.', 'identify the search intent, target page, on-page or technical change, and ranking-to-outcome measure'],
    [/\bsem\b|paid media|roas/, 'Spend is concentrated in a campaign with high clicks but weak downstream completion.', 'specify the campaign or ad-group change, keyword or audience control, budget rule, and conversion measure'],
    [/social|community/, 'One content theme has strong reach but also the highest negative-comment and opt-out rate.', 'draft the post or response approach, moderation rule, publishing choice, and engagement-quality measure'],
    [/content|storytelling/, 'The audience has seen the facts but does not understand the implication or next action.', 'provide the headline, narrative structure, proof points, call to action, and channel or editorial choice'],
    [/forecast|demand planning/, 'Recent actuals show bias and a recurring seasonal or event-driven pattern.', 'show the forecast logic, baseline, adjustment, error measure, and assumption that would trigger a revision'],
    [/inventory|safety stock|replenish/, 'Fast-moving items face stock-out risk while slow-moving stock ties up capacity or cash.', 'segment the items, calculate the relevant stock measure, set the replenishment action, and define the exception rule'],
    [/logistics|routing|shipment|transport/, 'One route or hand-off creates most late deliveries and avoidable cost.', 'identify the route or hand-off change, carrier or capacity decision, operational constraint, and cost-versus-SLA measure'],
    [/procurement|supplier|sourcing|rfx/, 'The lowest-price option has weaker service, quality, or continuity evidence.', 'build the evaluation criteria and weights, compare the options, document the negotiation point, and state the award condition'],
    [/programming|algorithm|debug/, 'A reproducible failure occurs for one input pattern while the normal path still works.', 'show the logic or pseudocode, isolate the failure, propose the change, and list regression and edge-case tests'],
    [/\bapis?\b|integration/, 'The producer and consumer disagree on required fields, error behavior, and retry ownership.', 'define the request and response contract, validation, error handling, security check, and integration test'],
    [/version control/, 'A release contains overlapping changes and the team needs a safe correction path with traceability.', 'specify the branch and review approach, commit or rollback sequence, conflict control, and release evidence'],
    [/test|qa|defect/, 'The happy path passes, but a high-impact edge case is not covered by the current suite.', 'write test cases with preconditions, steps and expected results, set defect severity, and state release impact'],
    [/requirement|business analysis/, 'Stakeholders use the same term for different outcomes and acceptance is not defined.', 'write the requirement, business rule, acceptance criteria, dependency, and open question'],
    [/process map|workflow|lean|six sigma|rca|root.cause/, 'The same exception enters through more than one path and is corrected manually downstream.', 'show the relevant process steps, failure point, root-cause evidence, future-state change, and control measure'],
    [/policy interpretation|legal research|compliance/, 'The rule is clear in principle but its application to one case is disputed.', 'cite the governing requirement, map facts to criteria, document the interpretation and limitation, and identify approval or escalation'],
    [/accounting|reconcil|bookkeep/, 'The ledger and supporting record differ and the timing or classification is unclear.', 'show the reconciliation, supporting evidence, proposed treatment or entry, control impact, and reviewer sign-off'],
    [/valuation|capital budgeting|cash flow|funding/, 'The preferred option changes when one commercial assumption moves within a plausible range.', 'show cash flows and assumptions, calculate the decision measure, test sensitivity, and state the approval recommendation'],
    [/credit|underwriting/, 'The applicant meets the headline threshold but cash-flow or documentation evidence creates a material exception.', 'calculate the relevant capacity or risk measure, list exceptions and mitigants, and record the approve-decline-refer recommendation'],
    [/audit planning|audits|sampling|evidence/, 'The review population is large, but the highest-risk items and the evidence standard have not been agreed.', 'define scope and material risk, select and justify the sample or test, list evidence required, and write the finding and follow-up rule'],
    [/tax fundamentals|tax analysis/, 'A transaction has more than one plausible treatment and the supporting documentation is incomplete.', 'map the facts to the applicable rule, show the calculation or exposure, list documentation required, and draft the treatment and review note'],
    [/kpi|metric|reporting|analytics|data interpretation|financial analysis|ratios|insight/, 'The current report shows a result but not its definition, driver, reliability, or decision use.', 'define the measure, show its calculation and source, segment the result, explain the driver, and state the decision or action it supports'],
    [/planning|roadmap|budgeting|capacity|staffing|workforce|scheduling|material planning|scenario planning|seasonality|consensus planning|end-to-end planning/, 'The agreed objective exceeds available time, people, money, or capacity under the current assumptions.', 'show demand and capacity assumptions, prioritize the allocation, sequence dependencies, model one alternative, and state the replanning trigger'],
    [/customer journey|employee journey|student lifecycle|onboarding|adoption|retention|health scoring|qbr|service delivery|service quality|service recovery|issue resolution|case management|candidate experience|engagement/, 'One stage of the journey creates most delay, drop-off, or dissatisfaction, but ownership crosses team boundaries.', 'map the relevant journey stage, identify the failure and affected segment, draft the intervention and communication, assign ownership, and define recovery evidence'],
    [/strategy|strategic|competitive analysis|market analysis|market sizing|portfolio|business case|hypothesis|structured thinking|business diagnosis/, 'The decision owner has several plausible options but no agreed basis for choosing among them.', 'frame the decision, size or test the key assumption, compare options against explicit criteria, identify downside and dependencies, and recommend a direction'],
    [/communicat|messag|briefing|executive writing|media relations|press material|disclosure|reputation|crisis|advisory writing|client communication|financial communication/, 'The same facts must be communicated to audiences with different knowledge, concerns, and disclosure needs.', 'draft the audience-specific message, identify the approved proof points and prohibited or uncertain claims, set the call to action, and map approval and response handling'],
    [/execution|dependency|issue management|coordination|governance|readiness|implementation|cutover|launch readiness|transformation|change impact|tom\b/, 'A milestone depends on unresolved ownership, readiness, or a decision outside the delivery team.', 'update the action, dependency, risk, or readiness record, show impact on scope and timing, recommend a recovery choice, and draft the owner escalation'],
    [/hr process|hris|employee lifecycle|succession|career development|potential|talent review|pay structure|benchmarking|benefits|people data|workforce analytics/, 'The people decision affects employees differently and the current record or criteria are not consistently applied.', 'define the employee population and decision criteria, analyze fairness and impact, document the recommendation and approval, and specify the HR record and communication required'],
    [/research design|secondary research|qualitative research|survey|data collection|synthesis|research\b|industry research|audience research|consumer insights/, 'The stakeholder needs an answer, but source quality, sample coverage, and conflicting evidence could change the conclusion.', 'write the research question, source or sampling plan, evaluation criteria, synthesis table, limitations, and decision-oriented conclusion'],
    [/cloud|network|reliability|monitoring|threat|incident|troubleshoot|service desk|architecture awareness|technology assessment/, 'A user-visible or control-relevant technology failure is reproducible, but the affected component and safe recovery step are not confirmed.', 'write the triage evidence, likely fault domain, diagnostic sequence, containment or recovery step, escalation record, and monitoring or prevention check'],
    [/product metric|product process|funnel|cohort|user behaviour|prioritization|roadmap|growth loop|conversion optimization|acquisition economics/, 'Users enter the journey but one segment does not reach the intended outcome, and several possible changes compete for capacity.', 'define the user and business problem, quantify the funnel or cohort gap, rank hypotheses or opportunities, write the experiment or requirement, and set success and guardrail metrics'],
    [/\bcac\b|attribution|segmentation|bias|demand sensing|variance analysis|cost analysis/, 'The overall result masks a material difference in source, segment, timing, or cost efficiency.', 'define and calculate the measure, segment the result, test bias or attribution assumptions, explain the driver, and state the budget or operating decision'],
    [/brand|campaign|positioning|gtm|platform strategy|audience|editorial|enablement/, 'The target audience, proposition, and channel plan are not aligned to the same customer insight.', 'write the audience and insight, positioning or message, channel and content choice, execution brief, and brand or performance measure'],
    [/receiving|putaway|picking|packing|warehouse|stock accuracy|shrinkage|adherence|aht|fcr|sla|productivity|workforce coordination/, 'A specific operating step creates most delay or error and the team is compensating with manual effort.', 'map the step and standard, calculate volume and performance gap, redesign allocation or flow, define the supervisor control, and set the shift-level measure'],
    [/property|leasing|transaction support|real estate/, 'Two property options differ on total cost, utilization, obligations, and execution risk.', 'build the option comparison, show commercial assumptions and obligations, identify due diligence, recommend the transaction or management action, and state approval conditions'],
    [/vendor management|workplace service|administration|coordination/, 'A supplier or internal service commitment is at risk and the supporting schedule, scope, or approval record is incomplete.', 'update the schedule or service log, reconcile scope and evidence, coordinate the affected parties, recommend the recovery or vendor action, and record approval and closure'],
    [/quality framework|corrective action|quality\b|kaizen|waste elimination|improvement design|benefits tracking/, 'A recurring defect is being corrected after occurrence, but prevention and effectiveness checks are not defined.', 'write the defect or waste statement, root-cause evidence, containment and corrective action, owner and due date, and effectiveness measure'],
    [/account planning|account research|strategic account|relationship building|relationship mapping|service review|cross-sell|upsell|prospecting|lead generation|qualification|pipeline/, 'The opportunity or account has incomplete need, stakeholder, value, and next-step information.', 'map the account or lead, identify decision roles and needs, set qualification and priority, draft the outreach or review action, and record the pipeline or account-plan update'],
    [/consultative selling|negotiation|outreach|market mapping|partnership/, 'The opportunity appears attractive, but fit, decision authority, value exchange, and terms are not yet aligned.', 'map the prospect or partner, write discovery and value questions, prepare the proposal or outreach, define negotiation boundaries, and record the next commitment'],
    [/solution understanding|proposal support|demo|rfp\/rfi|solution design|solution thinking|prototyping|information architecture|interaction design|usability/, 'The requested solution is described at a high level, but fit, evidence, and acceptance are not yet demonstrated.', 'translate needs into solution criteria, produce the outline, demo, prototype, or response section, address a limitation, and define validation and acceptance'],
    [/case solving|problem solving|\banalysis\b|constraint|scope/, 'The requested outcome is clear, but the problem boundary, constraints, and decision criteria are not.', 'structure the problem, separate facts and assumptions, prioritize hypotheses or options, test the critical evidence, and make the decision recommendation'],
    [/contact handling|empathy|listening|expectation management|stakeholder service/, 'The person affected has described an urgent symptom, but the underlying need, impact, and acceptable resolution are not confirmed.', 'write the opening and clarification questions, acknowledge impact, set an accurate expectation, choose resolution or escalation, and document the interaction'],
    [/dependenc|stakeholder impact|stakeholder management|stakeholders|facilitation|escalation/, 'Progress depends on people with different authority, impact, and information needs.', 'map stakeholders and dependencies, define the decision and owner, prepare the alignment conversation, document commitments, and set the escalation trigger'],
    [/financial statement|financial modelling|financial analysis|performance/, 'The reported result and underlying business movement do not reconcile without an additional driver or timing assumption.', 'reconcile the financial views, show the model or bridge, test the key assumption, explain cash or value impact, and recommend the management action'],
    [/needs analysis|learning design|training|assessment|intervention/, 'The requested learning solution has been chosen before the performance need and transfer conditions were validated.', 'define the performance gap and audience, identify whether learning is the cause, design the learning and practice activity, plan transfer support, and measure behavior and outcome'],
    [/patient operations|academic process|process management|process analysis|process performance|process redesign|\bsops?\b/, 'The documented process and the way work is actually completed differ at a high-volume step.', 'map current and required practice, quantify the gap, rewrite the critical process or SOP step, assign the control and training, and measure compliance and outcome'],
    [/python|data preparation|data modelling|modelling fundamentals|automation basics|configuration|tooling/, 'The current manual or technical approach is not reproducible and does not handle an important data or operating exception.', 'provide the code, configuration, data model, or automation logic, document inputs and controls, handle the exception, and define test and monitoring evidence'],
    [/spend analysis/, 'Spend is fragmented across suppliers and categories, with inconsistent price and service evidence.', 'clean and classify spend, identify concentration and variance, select the sourcing opportunity, quantify value, and define supplier or negotiation action'],
    [/documentation|\bpolicy\b|standards/, 'The current record does not make the requirement, decision, owner, and version history auditable.', 'draft the policy, procedure, or decision record section, cite the source requirement, define owner and approval, and specify version and retention controls'],
    [/experience design/, 'The current journey solves the process requirement but creates avoidable effort or uncertainty for the user.', 'map the user moment and need, identify the friction, sketch the improved interaction or service, define accessibility or constraint checks, and set usability evidence'],
    [/media\b|investor material/, 'External stakeholders need a timely message, but one proof point is incomplete and the likely follow-up questions are known.', 'draft the headline and supporting messages, qualify the uncertain point, prepare the Q&A or material section, map approval, and define response monitoring'],
    [/thesis building/, 'The positive case is visible, but valuation, catalyst, and downside evidence are not yet connected.', 'state the thesis, supporting evidence and valuation view, identify catalysts and disconfirming evidence, quantify downside, and define the recommendation'],
    [/\babc\b/, 'Items with very different value and demand behavior currently follow the same inventory policy.', 'perform the ABC segmentation, show the basis and exceptions, set service and review rules by class, and quantify the inventory and availability impact'],
    [/discovery|voc|user research/, 'The requester has described a desired solution but not the underlying need or success condition.', 'write the question sequence, evidence source, synthesis method, and decision the discovery will inform'],
    [/objection/, 'The stated concern may be about price, risk, authority, timing, or fit and has not yet been clarified.', 'write the exact response, clarification question, evidence-based value point, and next-step or disqualification rule'],
    [/pitch|persuasion|solution selling/, 'The proposed value has not yet been connected to the audience’s confirmed priority.', 'write the audience-specific opening, need-to-benefit link, proof point, responsible claim, and requested commitment'],
    [/risk|control|security|privacy|safety|mitigation/, 'The risk register names the issue but does not show exposure, control effectiveness, or action priority.', 'score likelihood and impact, test the control evidence, define treatment and owner, and set a monitoring trigger'],
    [/project|raid|dependency|milestone|schedule/, 'A critical dependency has no confirmed owner and now threatens the agreed milestone.', 'update the action or RAID record, show schedule impact, propose recovery options, and draft the escalation decision'],
  ]
  const matched = matches.find(([pattern]) => pattern.test(value))
  return matched
    ? { detail: matched[1], requirement: matched[2] }
    : {
        detail: `The reviewer needs a concrete ${value} artifact rather than a definition of the capability.`,
        requirement: `include the actual checklist, decision table, calculation, draft, system entry, or other job artifact that best demonstrates ${value}`,
      }
}

function competencyWorkDefinition(competency: string): WorkDefinition {
  const value = competency.toLowerCase()
  if (/discover|research|requirement|insight|voice of|voc|user need|market map/.test(value)) return {
    setup: 'The request is still broad and the available evidence is incomplete.',
    output: 'a discovery brief',
    actions: 'define the decision, list the questions and sources in priority order, separate facts from assumptions, and state how the findings will change the next action',
  }
  if (/pitch|persuasion|objection|negotiat|outreach|cross-sell|upsell|solution sell|consultative sell/.test(value)) return {
    setup: 'The audience has expressed interest but has challenged the value, fit, or proposed terms.',
    output: 'a customer or stakeholder conversation plan',
    actions: 'write the opening, the questions you would ask, the value case you would make, the response to the concern, and the next commitment you would seek',
  }
  if (/communicat|story|content|copy|messag|media|report|advisory writing|investor material/.test(value)) return {
    setup: 'Different audiences need an accurate update before they take action.',
    output: 'an audience-ready communication',
    actions: 'lead with the purpose, distinguish evidence from uncertainty, tailor the message, and make the requested decision or next action explicit',
  }
  if (/data|analytic|metric|kpi|statistics|excel|sql|dashboard|visual|variance|financial statement|ratio|attribution/.test(value)) return {
    setup: 'The headline result does not explain which segment or driver created the change.',
    output: 'an analysis note with an auditable calculation',
    actions: 'validate the data, calculate the relevant measures, compare meaningful segments, identify the strongest supported driver, and translate it into a decision',
  }
  if (/forecast|planning|schedule|capacity|staffing|workforce|inventory|replenish|roadmap|portfolio|pipeline|budget/.test(value)) return {
    setup: 'Demand and available capacity no longer align, so the current plan cannot be completed as written.',
    output: 'a prioritized operating plan',
    actions: 'quantify the gap, rank the work, allocate constrained capacity, identify dependencies, and define the trigger for replanning or escalation',
  }
  if (/risk|control|audit|compliance|tax|security|privacy|quality|test|defect|safety|underwriting|credit/.test(value)) return {
    setup: 'A proposed action may improve the headline result but creates an unresolved control, quality, or compliance concern.',
    output: 'a risk-and-control review',
    actions: 'identify the exposure, verify the requirement, assess likelihood and impact, test the relevant control or evidence, and recommend treatment and ownership',
  }
  if (/process|lean|six sigma|root.cause|rca|workflow|sop|continuous improvement|productivity|turnaround|sla|aht|fcr/.test(value)) return {
    setup: 'The team is treating repeated exceptions individually, but the pattern suggests a process problem.',
    output: 'a current-state diagnosis and improvement experiment',
    actions: 'map the failure point, quantify the pattern, test likely root causes, propose the smallest safe change, and define the before-and-after measure',
  }
  if (/design|develop|programming|api|model|experiment|prototype|architecture|configuration|automation|algorithm|interaction/.test(value)) return {
    setup: 'The requested solution must be delivered with incomplete requirements and at least one material technical or user constraint.',
    output: 'a solution outline and validation plan',
    actions: 'clarify requirements, compare feasible options, show the proposed design or logic, identify failure modes, and specify how you would test acceptance',
  }
  if (/journey|onboard|adoption|retention|service|case|issue|empathy|relationship|experience|engagement/.test(value)) return {
    setup: 'A customer or user is at risk of a poor outcome unless the team coordinates a timely intervention.',
    output: 'a case-resolution and follow-up plan',
    actions: 'confirm the need and impact, prioritize the immediate response, coordinate the correct owner, communicate expectations, and record the measure that confirms resolution',
  }
  if (/campaign|brand|seo|sem|social|position|go.to.market|gtm|segment|consumer/.test(value)) return {
    setup: 'Performance differs sharply by audience or channel and the team must decide where to focus the next cycle.',
    output: 'a campaign or market action brief',
    actions: 'identify the audience insight, connect it to the proposition and channel, recommend one testable action, define the control or comparison, and set success and stop criteria',
  }
  if (/accounting|reconcil|valuation|cash flow|capital|funding|bookkeep|pay structure|benefit|commercial planning/.test(value)) return {
    setup: 'The reported position contains a material variance or assumption that must be resolved before approval.',
    output: 'a decision-ready financial workpaper',
    actions: 'reconcile the figures, show the calculation and assumptions, explain the business impact, test the downside, and recommend the entry, decision, or approval required',
  }
  if (/stakeholder|change|facilitat|coordination|governance|expectation|resistance|readiness|dependency/.test(value)) return {
    setup: 'Teams agree on the goal but not on ownership, sequence, or the acceptable trade-off.',
    output: 'an alignment and execution brief',
    actions: 'map interests and decisions, propose owners and sequence, surface the trade-off, define the escalation path, and record how agreement and adoption will be measured',
  }
  return {
    setup: 'The team needs a usable first recommendation rather than a general discussion of the issue.',
    output: `a practical ${competency.toLowerCase()} work product`,
    actions: 'identify the relevant evidence, complete the core work, make a justified recommendation, assign the next action, and define an observable result',
  }
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
    scenario = `You are ${targetWithArticle}. In work affecting ${areas}, ${context.businessEvidence}. The situation involves ${context.stakeholders} and requires a decision before ${context.deadline}.`
    task = item.prompt
    prompt = `${scenario} ${task}`
    guidance = `${guidance} Make your response specific to the stated role, industry context, stakeholders, and decision deadline.`
  } else if (item.dimension === 'role') {
    const work = competencyWorkDefinition(item.competency)
    const proof = competencyProof(item.competency, role.name)
    scenario = `You are ${targetWithArticle}. In work involving ${areas}, ${context.businessEvidence}. ${work.setup} ${proof.detail} Your immediate responsibility is ${work.output} focused on ${item.competency.toLowerCase()}; ${context.stakeholders} are involved, and it is due before ${context.deadline}.`
    task = `Produce ${work.output}: ${work.actions}.`
    guidance = 'Submit the actual workplace output requested, using the scenario evidence and clearly marking assumptions or information that still needs validation.'
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
    format: dimension === 'simulation' ? 'simulation' : item.responseType === 'audio' ? 'audio' : 'situational',
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

function sampleDataTask(question: Question, role: RoleFamily, industry: Industry, profile: AssessmentProfile): SampleDataTask {
  const variant = dataVariant(role.name)
  const query = new URLSearchParams({
    role: role.name,
    industry: industry.name,
    level: profile.level,
    education: profile.education,
    experienceType: profile.experienceType,
    variant,
    exercise: question.dimension,
  })
  return {
    id: `${question.dimension}-${question.bankId}`,
    title: `${industry.name} ${role.name} ${question.dimension} data exercise`,
    description: 'Download the source workbook, complete your analysis in the file, then upload the completed workbook and explain your approach below.',
    fileName: `zobology-${role.code.toLowerCase()}-${industry.code.toLowerCase()}-${question.dimension}-data-exercise.xlsx`,
    downloadUrl: `/api/assessment-data/core-data-understanding?${query.toString()}`,
  }
}

const formatByDimension: Record<Exclude<Dimension, 'simulation'>, StandardQuestionFormat[]> = {
  core: ['audio', 'excel', 'written_communication'],
  role: ['audio', 'excel', 'written_communication', 'situational', 'situational'],
  industry: ['excel', 'situational'],
}

const formatSignals: Record<StandardQuestionFormat, RegExp[]> = {
  audio: [/pitch/i, /persuasion/i, /presentation/i, /negotiation/i, /facilitation/i, /interview/i, /communication/i, /stakeholder/i, /relationship/i, /service recovery/i, /empathy/i, /escalation/i],
  excel: [/conversion/i, /pipeline/i, /forecast/i, /analytics?/i, /reporting/i, /financial/i, /budget/i, /measurement/i, /planning/i, /data/i, /metric/i, /kpi/i, /capacity/i, /productivity/i, /inventory/i, /valuation/i, /attribution/i, /testing/i, /quality/i, /monitor/i, /defect/i, /incident/i, /audit/i, /control/i, /risk/i, /compliance/i, /performance/i, /spend/i, /schedule/i, /adoption/i],
  written_communication: [/customer communication/i, /stakeholder communication/i, /documentation/i, /copy/i, /content/i, /reporting/i, /outreach/i, /research/i, /policy/i, /requirements/i, /messaging/i, /briefing/i],
  situational: [/discovery/i, /objection/i, /problem/i, /decision/i, /risk/i, /service/i, /relationship/i, /incident/i, /quality/i, /control/i, /adoption/i, /process/i],
}

function assignRoleFormats(questions: Question[]) {
  const formats = formatByDimension.role
  let bestScore = Number.NEGATIVE_INFINITY
  let bestOrder = questions.map((_question, index) => index)
  const score = (question: Question, format: StandardQuestionFormat) => {
    const evidence = `${question.competency} ${question.tags.join(' ')}`
    return formatSignals[format].reduce((total, signal, signalIndex) => total + (signal.test(evidence) ? 30 - signalIndex : 0), 0)
  }
  const search = (order: number[], remaining: number[], total: number) => {
    if (!remaining.length) {
      if (total > bestScore) {
        bestScore = total
        bestOrder = order
      }
      return
    }
    const format = formats[order.length]
    remaining.forEach((questionIndex, index) => {
      search([...order, questionIndex], [...remaining.slice(0, index), ...remaining.slice(index + 1)], total + score(questions[questionIndex], format))
    })
  }
  search([], questions.map((_question, index) => index), 0)
  return new Map(bestOrder.map((questionIndex, slotIndex) => [questions[questionIndex].id, formats[slotIndex]]))
}

function coreExcelMeasures(role: RoleFamily) {
  const variant = dataVariant(role.name)
  if (variant === 'commercial') return 'conversion rate, exception or cancellation rate, cost per completed outcome, and revenue per completed outcome'
  if (variant === 'operations') return 'completion rate, capacity utilization, exception rate, and cost per completed unit'
  if (variant === 'people') return 'applicant-to-hire rate, exits as a share of headcount, cost per hire, and engagement by segment'
  if (variant === 'customer') return 'resolution rate, escalation rate, contacts per unit of capacity, and cost per resolved contact'
  if (variant === 'technology') return 'completion rate, defects or incidents per completed item, capacity utilization, and cost per completed item'
  return 'completion rate, exception rate, capacity utilization, and cost per completed outcome'
}

function coreSpokenAudience(role: RoleFamily) {
  const family = roleContextFamily(role.name)
  if (family === 'commercial') return 'your team lead before a customer or commercial decision'
  if (family === 'service') return 'the service lead coordinating the customer response'
  if (family === 'people') return 'the manager responsible for the employee or candidate decision'
  if (family === 'technology') return 'the product or incident lead deciding the next action'
  if (family === 'operations') return 'the operations lead running the next review'
  if (family === 'governance') return 'the control or policy owner deciding whether work may proceed'
  if (family === 'communications') return 'the accountable leader approving the stakeholder message'
  if (family === 'advisory') return 'the project lead preparing the client recommendation'
  return 'the manager who must coordinate the next action'
}

function contextualCoreWorkSample(question: Question, format: QuestionFormat, role: RoleFamily, industry: Industry, profile: AssessmentProfile) {
  if (question.dimension !== 'core') return question
  const levelNote = levelComplexity[targetBand(profile.level)]
  if (format === 'audio') {
    const context = workContext({ id: `${question.bankId}-core-audio` }, role, industry)
    const scenario = `During ${role.name} work in ${industry.name}, ${context.businessEvidence}. The available report has been checked, but one cause is still unconfirmed. You must update ${coreSpokenAudience(role)} before ${context.deadline}; you own the initial fact check and escalation, not the final approval.`
    const task = `Record the 60–90 second update you would actually deliver. Lead with the issue and its customer or business impact, use two relevant facts, distinguish what is confirmed from what still needs validation, state the action you have taken, ask for the specific decision or support required, and give the next update time. ${levelNote}`
    return {
      ...question,
      scenario,
      task,
      prompt: `${scenario} ${task}`,
      guidance: 'Speak in role to the named audience. Do not describe a communication framework; deliver the update clearly and concisely.',
      rubric: ['Spoken clarity and structure', 'Fact and uncertainty handling', 'Role and industry relevance', 'Ownership', 'Decision ask and next update'],
    }
  }
  if (format === 'excel') {
    const scenario = `The attached workbook contains ${industry.name} performance data by period, region, and operating channel for a ${role.name} team. Volume, completion, capacity, cost, exceptions, and outcome quality do not move in the same direction, and the manager needs a defensible first analysis before deciding where to intervene.`
    const task = `Use the workbook to calculate ${coreExcelMeasures(role)}. Check totals and formulas, compare at least two channels or regions, identify one pattern and one exception, and recommend the first follow-up question or action supported by the data. ${levelNote}`
    return {
      ...question,
      scenario,
      task,
      prompt: `${scenario} ${task}`,
      guidance: 'Submit the completed workbook and a short explanation of your formulas, findings, assumptions, and recommendation.',
      rubric: ['Formula accuracy', 'Data checks', 'Comparison and pattern recognition', 'Role and industry interpretation', 'Evidence-based next action'],
    }
  }
  const context = workContext({ id: `${question.bankId}-core-written` }, role, industry)
  const scenario = `After a ${role.name} review in ${industry.name}, ${context.businessEvidence}. The discussion ended without a clear written record of the implication, owner, immediate action, or unresolved evidence. The people who need the follow-up are ${context.stakeholders}, and the next decision is due before ${context.deadline}.`
  const task = `Draft the finished follow-up email. Include a useful subject line, turn the data points into a short evidence-to-impact storyline, state the agreed or recommended action, assign owners and timing, identify the one point still requiring validation, and close with the response or confirmation needed. ${levelNote}`
  return {
    ...question,
    scenario,
    task,
    prompt: `${scenario} ${task}`,
    guidance: 'Write 120–180 words in an audience-appropriate tone. Submit the email itself, not an explanation of how you would write it.',
    rubric: ['Purpose and audience', 'Evidence-to-impact storyline', 'Role and industry relevance', 'Ownership and timing', 'Clear call to action'],
  }
}

function consumerOffering(industry: Industry) {
  if (/education|edtech|learning/i.test(industry.name)) return 'a ₹48,000, 16-week data-analytics certificate with weekend classes and career support'
  if (/bank|financial|fintech|insurance/i.test(industry.name)) return 'a consumer financial product with a monthly fee and eligibility conditions'
  if (/health|wellness|fitness/i.test(industry.name)) return 'a six-month consumer health and wellness plan'
  if (/travel|hospitality/i.test(industry.name)) return 'a five-night family travel package with optional add-ons'
  if (/retail|e-?commerce/i.test(industry.name)) return 'a premium consumer product with delivery, warranty, and return conditions'
  return `a consumer ${industry.name} product with multiple plans and eligibility conditions`
}

function b2cSalesWorkSample(question: Question, format: QuestionFormat, role: RoleFamily, industry: Industry, profile: AssessmentProfile) {
  if (role.name !== 'B2C Sales' || question.dimension !== 'role') return question
  const offering = consumerOffering(industry)
  const levelNote = levelComplexity[targetBand(profile.level)]
  let scenario: string
  let task: string
  let guidance: string

  if (format === 'audio') {
    scenario = `An inbound prospect is considering ${offering}. They want a better career outcome, can only commit time on weekends, and say the price is higher than a competing option. You have not yet confirmed their decision criteria or whether the program is suitable.`
    task = 'Record the next 60–90 seconds of the sales conversation. Acknowledge the concern, ask focused discovery questions, connect only the relevant benefits to the stated need, and agree a specific next step without inventing claims or offering an unauthorized discount.'
    guidance = 'Respond as if the prospect is on the call. We assess listening, question quality, relevance of the pitch, responsible persuasion, and the clarity of the next step.'
  } else if (format === 'excel') {
    scenario = `Your team lead gives you a workbook showing monthly leads, conversions, revenue, acquisition cost, cancellations, and customer score by channel and region for ${offering}. The next week’s follow-up capacity is limited, so the team cannot pursue every channel equally.`
    task = 'Use the workbook to calculate conversion rate, cost per conversion, revenue per conversion, and cancellation rate. Identify the strongest and weakest channel or region, show the formulas or pivot logic you used, and recommend where the team should focus next week and one issue it should investigate.'
    guidance = 'Submit the completed workbook plus a concise explanation. Your recommendation must cite calculated evidence and must not treat high lead volume alone as strong sales performance.'
  } else if (format === 'written_communication') {
    scenario = `A prospect completed a counselling call about ${offering}. They care most about weekend availability and career support, asked for the total fee and cancellation terms, and said they need to discuss the decision with their family tonight. They asked you to send the details in writing.`
    task = 'Draft the follow-up email you would send. Summarize the prospect’s priorities, explain the relevant offer accurately, address the requested fee and cancellation information without pressure, and propose one clear next step with timing.'
    guidance = 'Write 120–180 words with a useful subject line. We assess personalization, accuracy, tone, structure, and whether the call to action fits the customer’s buying stage.'
  } else if (/objection/i.test(question.competency)) {
    scenario = `A qualified prospect says, “This option looks useful, but a competitor is 20% cheaper and promises faster results. Unless you match the price, I will choose them.” They are considering ${offering}. You may not approve discounts and you cannot verify the competitor’s outcome claim.`
    task = 'Write exactly what you would say next, followed by a short note explaining your reasoning. Clarify the objection, compare value without criticizing the competitor, avoid unsupported promises, and either advance the sale appropriately or record a valid reason not to proceed.'
    guidance = 'Provide the customer-facing response first, then your rationale and CRM next step. We assess judgement and objection handling, not aggressive closing.'
  } else {
    scenario = `A new prospect asks which option they should buy. They mention wanting a career change but have not explained their current skills, target role, timeline, available study time, budget, or who else is involved in the decision. Your manager expects a useful CRM note after the conversation.`
    task = 'Plan the first five minutes of the conversation: list the questions you would ask in sequence, explain what each answer would help you determine, state when you would disqualify or escalate the lead, and write the CRM note you could complete from the facts currently available.'
    guidance = 'Do not jump to a recommendation before establishing fit. We assess discovery sequence, listening logic, qualification judgement, and accurate documentation.'
  }

  task = `${task} ${levelNote}`
  return { ...question, scenario, task, prompt: `${scenario} ${task}`, guidance }
}

function customerExperienceWorkSample(question: Question, role: RoleFamily, industry: Industry, profile: AssessmentProfile) {
  if (role.name !== 'Customer Experience' || question.dimension !== 'role') return question
  const fashion = /fashion|apparel/i.test(industry.name)
  const levelNote = levelComplexity[targetBand(profile.level)]
  let scenario: string
  let task: string
  let guidance: string
  let rubric: string[]

  if (/customer journey/i.test(question.competency)) {
    scenario = fashion
      ? 'A customer ordered two outfits in the mobile app for a family event. The parcel arrived three days late, one item’s size label does not match the order, and a store refused the exchange because it was purchased online. The customer has already repeated the details in chat and by phone, and the event is four days away.'
      : `A customer using ${industry.contexts[0]?.toLowerCase() ?? industry.focus} received conflicting guidance in two channels, repeated the same information twice, and still has no confirmed resolution. The customer has a time-sensitive need in four days.`
    task = `Write the reply you would send to the customer now, then add a short internal handoff note. The reply must acknowledge the experience, confirm what you understand, avoid an unsupported promise, and give a specific next update time. The handoff must identify the broken journey step, the team that should act next, the information they need, and how you will close the loop with the customer. ${levelNote}`
    guidance = 'Write the finished customer message first and the internal handoff second, using no more than 200 words in total.'
    rubric = ['Customer acknowledgement', 'Accurate issue summary', 'Ownership and expectation setting', 'Cross-functional handoff', 'Closed-loop follow-up']
  } else if (/^voc$/i.test(question.competency)) {
    scenario = fashion
      ? 'In the latest 50 post-return comments, 18 customers mention inconsistent sizing, 12 say product colour or fabric differed from the online description, 9 mention poor refund updates, and 11 describe other issues. The return rate increased from 16% to 23%, but return-reason codes are incomplete and no conclusion has been validated.'
      : `The latest 50 customer comments about ${industry.contexts[0]?.toLowerCase() ?? industry.focus} contain three recurring themes, while the negative-outcome rate has risen by 7 percentage points. Reason codes are incomplete and the team has not validated whether the loudest theme causes the largest impact.`
    task = `Turn this feedback into a usable voice-of-customer finding. Prioritize the themes, identify what you can and cannot conclude, state the customer or transaction data you would request, propose one immediate low-risk response and one hypothesis to test, and show how the insight should be shared back with the team that owns the experience. ${levelNote}`
    guidance = 'Use a compact table or bullets for theme, evidence, affected customer need, validation required, owner, and proposed response.'
    rubric = ['Theme prioritization', 'Evidence and limitations', 'Customer-need interpretation', 'Validation quality', 'Action and feedback loop']
  } else if (/service recovery/i.test(question.competency)) {
    scenario = fashion
      ? 'A customer paid ₹6,800 for an outfit that arrived damaged. A promised replacement was not dispatched, the return was collected, and the refund has now been pending for eight days. The customer has posted publicly and says this is their final attempt before filing a complaint. You can expedite an existing refund request but need manager approval for goodwill above ₹1,000.'
      : `A customer affected by ${industry.contexts[1]?.toLowerCase() ?? industry.focus} received an unusable service, a promised correction did not happen, and the financial or service reversal is overdue by eight days. The customer has contacted the company publicly. You can expedite the existing resolution but need approval for an additional goodwill exception.`
    task = `Handle the recovery as the employee receiving the case. Write what you would say to the customer, list the actions you would take in the first 30 minutes, identify the cross-functional owners and evidence required, state what you can authorize versus escalate, and define the update cadence and closure check. ${levelNote}`
    guidance = 'Put the customer-facing response first. Demonstrate ownership without blaming another team or promising an outcome you cannot control.'
    rubric = ['Empathy and ownership', 'Recovery judgement', 'Cross-functional coordination', 'Authority and escalation', 'Follow-through and closure']
  } else if (/cx metrics/i.test(question.competency)) {
    scenario = fashion
      ? 'The attached workbook contains customer contacts, resolved contacts, available capacity, service cost, escalations, and customer score by period, region, and channel for a Fashion/Apparel customer-service operation. Leadership wants to know where customers experience the greatest avoidable effort.'
      : `The attached workbook contains customer contacts, resolutions, capacity, service cost, escalations, and customer score by period, region, and channel for ${industry.name}. Leadership wants to know where customers experience the greatest avoidable effort.`
    task = `Use the workbook to calculate resolution rate, escalation rate, contacts per unit of capacity, and cost per resolved contact. Compare at least two channels or regions, identify the segment that needs attention first, and recommend one customer-experience action with an owner and a measure that would confirm improvement. ${levelNote}`
    guidance = 'Show formulas or pivot logic in the workbook and submit a concise recommendation that connects operational performance to customer impact.'
    rubric = ['Calculation accuracy', 'Segment comparison', 'Customer-impact interpretation', 'Prioritization', 'Measurable recommendation']
  } else {
    scenario = fashion
      ? 'An upset customer calls and says: “This is the third time I have explained this. My outfit arrived damaged, nobody can tell me where my refund is, and the event I bought it for has already passed. Why should I ever shop with you again?” The account confirms the return was collected, but the refund status has not updated.'
      : `An upset customer says: “This is the third time I have explained this. The issue with ${industry.contexts[0]?.toLowerCase() ?? industry.focus} is still unresolved, nobody can tell me what happens next, and I no longer trust your company.” The account confirms the request exists, but its status has not updated.`
    task = `Record the first 60–90 seconds of your response directly to the customer. Acknowledge the impact, reflect the issue in your own words, ask one useful clarification question, explain the action you can take now, set an honest update expectation, and check whether the proposed next step addresses the customer’s immediate concern. ${levelNote}`
    guidance = 'Speak as if the customer is on the call. We assess listening, empathy, clarity, ownership, and expectation-setting—not an internal briefing.'
    rubric = ['Listening and acknowledgement', 'Empathy', 'Clarifying question', 'Ownership and action', 'Expectation setting']
  }

  return { ...question, scenario, task, prompt: `${scenario} ${task}`, guidance, rubric }
}

function isDirectInteractionCompetency(competency: string) {
  return /pitch|persuasion|objection|negotiat|interview|communication|empathy|service recovery|issue resolution|relationship|facilitat|outreach|discovery|expectation|client|stakeholder|contact handling/i.test(competency)
}

function interactionAudience(role: RoleFamily, competency: string) {
  if (/Talent Acquisition|Recruit/i.test(role.name) && /interview|communication/i.test(competency)) return 'the candidate'
  if (/Sales|Business Development|Pre-sales/i.test(role.name)) return 'the prospect or customer'
  if (/Customer|Client|Relationship|Contact Center|Service/i.test(role.name)) return 'the customer or client'
  if (/Public Relations|Communications|Investor Relations/i.test(role.name)) return 'the external stakeholder'
  return 'the stakeholder who must respond or act'
}

function industryInteractionContext(industry: Industry) {
  if (/fashion|apparel/i.test(industry.name)) return { customerIssue: 'an online order, size exchange, or return', businessNeed: 'reducing seasonal stock and markdown risk without harming customer experience', candidateArea: 'e-commerce and store operations' }
  if (/Banking|NBFC|Insurance|FinTech|Payments/i.test(industry.name)) return { customerIssue: 'a payment, account, policy, or claim request', businessNeed: 'improving customer conversion and service while meeting eligibility and control requirements', candidateArea: 'customer operations and regulated service' }
  if (/Software|IT Services|AI \/ Data|Cloud|Cybersecurity/i.test(industry.name)) return { customerIssue: 'subscription access, onboarding, or a product incident', businessNeed: 'improving adoption and reliability while controlling implementation effort', candidateArea: 'product and customer operations' }
  if (/Hospital|Pharma|Medical|Health|Diagnostic/i.test(industry.name)) return { customerIssue: 'an appointment, report, service, or billing concern', businessNeed: 'improving access and turnaround without compromising quality, privacy, or safety', candidateArea: 'patient and service operations' }
  if (/E-commerce|Retail|FMCG|Consumer|Beauty|Food/i.test(industry.name)) return { customerIssue: 'an order, delivery, product, or return', businessNeed: 'improving conversion and repeat purchase while reducing returns and fulfilment failures', candidateArea: 'consumer and channel operations' }
  if (/Logistics|Courier|Aviation|Rail|Shipping|Travel/i.test(industry.name)) return { customerIssue: 'a booking, shipment, delay, or cancellation', businessNeed: 'improving service reliability and capacity without creating avoidable cost', candidateArea: 'service and network operations' }
  if (/Higher Education|K-12|EdTech|Vocational/i.test(industry.name)) return { customerIssue: 'admission, learning-platform access, assessment, or learner support', businessNeed: 'improving learner acquisition and outcomes without overstating promises', candidateArea: 'learner and academic operations' }
  if (/Hotel|Restaurant|Hospitality|Sports/i.test(industry.name)) return { customerIssue: 'a reservation, service failure, membership, or refund', businessNeed: 'improving utilization and revenue while protecting service quality', candidateArea: 'guest and service operations' }
  return { customerIssue: `a request involving ${industry.contexts[0]?.toLowerCase() ?? industry.focus}`, businessNeed: `improving ${industry.contexts[0]?.toLowerCase() ?? industry.focus} performance`, candidateArea: industry.contexts[0]?.toLowerCase() ?? industry.focus }
}

function directInteractionScenario(role: RoleFamily, industry: Industry, competency: string) {
  const context = industryInteractionContext(industry)
  if (/Talent Acquisition|Recruit/i.test(role.name) && /interview/i.test(competency)) {
    return `You are interviewing a candidate for an entry-level role supporting ${context.candidateArea} in ${industry.name}. Their resume says they “improved team performance,” but gives no scale, baseline, or personal contribution. In their first answer they describe what the team did without explaining their own decisions. The hiring rubric requires evidence of ownership, problem solving, and clear communication.`
  }
  if (/Sales|Business Development|Pre-sales/i.test(role.name)) {
    return `A prospect in ${industry.name} is interested in ${context.businessNeed}, but says the proposed option appears more expensive than their current approach and they are unsure it fits their immediate priority. You have not confirmed the decision criteria, budget authority, implementation timing, or cost of leaving the problem unresolved.`
  }
  if (/Customer|Contact Center|Service/i.test(role.name)) {
    return `A customer contacts you for the third time about ${context.customerIssue}. Two earlier agents gave different timelines, the promised update was missed, and the case record shows that a cross-functional handoff is still pending. You can confirm the current status and coordinate the next action, but you cannot promise the final outcome yet.`
  }
  if (/Client|Relationship|Account Management/i.test(role.name)) {
    return `A client responsible for ${context.candidateArea} says the expected value has not been demonstrated and an unresolved delivery issue is affecting confidence in the relationship. Renewal or expansion will be discussed next week, but the client first wants a clear explanation, accountable recovery action, and evidence that the issue will not repeat.`
  }
  if (/Public Relations|Communications|Investor Relations/i.test(role.name)) {
    return `An external stakeholder asks for an immediate explanation of a disputed ${industry.name} claim affecting ${context.candidateArea}. One fact is confirmed, one is still being validated, and an earlier internal message used wording that could overstate certainty. You must respond without speculating or creating a new commitment.`
  }
  return `A cross-functional stakeholder responsible for ${context.candidateArea} challenges your recommendation because its impact on their team is unclear. They agree the underlying issue matters but want evidence, a practical next step, and clarity about what decision or commitment you need from them today.`
}

function directInteractionRequirement(role: RoleFamily, competency: string) {
  if (/Talent Acquisition|Recruit/i.test(role.name) && /interview/i.test(competency)) return 'Open the interview, ask one relevant behavioral question, use two evidence-seeking probes, and explain the next step to the candidate.'
  if (/pitch|persuasion|solution selling/i.test(competency)) return 'Open the conversation, ask focused discovery questions, connect one relevant benefit to the confirmed need, support it responsibly, address the stated concern, and seek an appropriate next commitment.'
  if (/objection|negotiat/i.test(competency)) return 'Acknowledge and clarify the concern, test what is driving it, respond with relevant evidence or options, protect your authority boundary, and agree the next decision step.'
  if (/empathy|service recovery|issue resolution|contact handling|communication/i.test(competency) && /Customer|Client|Service|Contact Center|Relationship/i.test(role.name)) return 'Acknowledge the impact, summarize the issue to show understanding, ask one useful clarification, state what you can do now, set an honest update expectation, and check that the next step addresses the immediate concern.'
  return `Demonstrate ${competency.toLowerCase()} by acknowledging the other person’s position, using the relevant facts, asking or answering the critical question, proposing a workable next step, and confirming the decision or commitment.`
}

function realisticRoleWorkSample(question: Question, format: QuestionFormat, role: RoleFamily, industry: Industry, profile: AssessmentProfile, writtenIndex = 0) {
  if (question.dimension !== 'role') return question
  if (role.name === 'Customer Experience') return customerExperienceWorkSample(question, role, industry, profile)
  if (role.name === 'B2C Sales') return b2cSalesWorkSample(question, format, role, industry, profile)
  const work = competencyWorkDefinition(question.competency)
  const proof = competencyProof(question.competency, role.name)
  const levelNote = levelComplexity[targetBand(profile.level)]
  const directInteraction = format !== 'excel' && isDirectInteractionCompetency(question.competency)
  const scenario = directInteraction ? directInteractionScenario(role, industry, question.competency) : question.scenario
  let task: string
  let guidance: string

  if (format === 'audio') {
    if (directInteraction) {
      task = `Record the first 60–90 seconds as if you are speaking directly to ${interactionAudience(role, question.competency)}. Do not describe what you would say: deliver the interaction. ${directInteractionRequirement(role, question.competency)} ${levelNote}`
      guidance = `Stay in role throughout the recording. We assess the actual ${question.competency.toLowerCase()} performance, listening or audience response, judgement, and next-step clarity.`
    } else {
      task = `Record a 60–90 second ${role.name} briefing that delivers ${work.output}. Lead with the decision or issue, use the most relevant scenario evidence, summarize how you would ${proof.requirement}, address uncertainty, and close with the action or commitment you need. ${levelNote}`
      guidance = 'Speak to the stakeholder who must act next. We assess job judgement, message structure, evidence use, audience awareness, and a clear close.'
    }
  } else if (format === 'excel') {
    task = `Use the attached workbook to produce ${work.output}. Validate the data, calculate at least three role-relevant measures, compare two meaningful segments, identify the main driver or exception, and ${proof.requirement}. Recommend one action with an owner and success measure. ${levelNote}`
    guidance = `Submit an auditable workbook and a concise ${role.name} recommendation. Show formulas or pivot logic and distinguish calculated evidence from assumptions.`
  } else if (format === 'written_communication') {
    const communicationTask = writtenIndex === 0 || /communicat|client|customer|employee|stakeholder|media|investor/i.test(question.competency)
      ? `Draft the email or stakeholder message that communicates ${work.output}. Use the scenario facts, state what is known and unresolved, ${proof.requirement}, tailor the tone, and make the requested action, owner, and timing explicit.`
      : `Write a concise decision memo that turns the scenario evidence into ${work.output}. Structure it as situation, evidence, insight, implication, recommendation, and next action; ${proof.requirement}.`
    task = `${communicationTask} ${levelNote}`
    guidance = 'Write 120–200 words as the finished workplace communication, not a description of how you would write it.'
  } else {
    if (directInteraction) {
      task = `Handle the interaction as the ${role.name} professional receiving it. Start with the exact words or action you would use with ${interactionAudience(role, question.competency)}, then ${proof.requirement}. Add the system record or handoff you would create, the decision or commitment you seek, and the condition that would make you escalate or change course. ${levelNote}`
      guidance = `Give the actual response and job artifact, not a description of your approach. We assess ${question.competency.toLowerCase()}, judgement, ownership, and follow-through.`
    } else {
      task = `Produce ${work.output} for this situation. ${work.actions[0].toUpperCase()}${work.actions.slice(1)}; ${proof.requirement}. Include the first action you would take, the artifact or system record you would create, and the condition that would make you escalate or change course. ${levelNote}`
      guidance = `Answer as a ${role.name} work sample. We assess the usability of the output, role-specific judgement, prioritization, and measurable follow-through.`
    }
  }
  return { ...question, scenario, task, prompt: `${scenario} ${task}`, guidance }
}

function industryRiskScenario(industry: Industry, competency: string) {
  const areas = industry.contexts.slice(0, 3).join(', ')
  if (/Banking|NBFC|Insurance|FinTech|Investment|Capital Markets|Payments/i.test(industry.name)) return `A growth action affecting ${areas} is ready to launch, but a sample of customer records contains missing eligibility, consent, or control evidence. The commercial target is due this week and the control owner has not approved an exception.`
  if (/Hospital|Pharma|Medical|Health|Diagnostic/i.test(industry.name)) return `Demand in ${areas} is above plan, but a proposed shortcut could affect patient safety, privacy, quality, or an approved procedure. A frontline stakeholder wants an answer before the next service cycle begins.`
  if (/Software|IT Services|AI \/ Data|Cybersecurity|Hardware|Cloud/i.test(industry.name)) return `A recent release affecting ${areas} improved adoption, but incidents and support contacts increased in one user segment. The team must decide whether to continue, limit, or reverse the change before the next release window.`
  if (/E-commerce|Retail|FMCG|Consumer|Fashion|Beauty|Food/i.test(industry.name)) return `A promotion affecting ${areas} increased demand, but returns, complaints, or fulfilment exceptions are concentrated in one channel. The team must decide whether to scale, change, or stop the activity before the next campaign cycle.`
  if (/Manufacturing|Automotive|Chemicals|Engineering|Construction/i.test(industry.name)) return `Output involving ${areas} is behind plan, and a proposed recovery step would reduce delay but bypass a quality, safety, or supplier control. The next production or site decision is due within five working days.`
  if (/Infrastructure|Energy|Oil|Renewable/i.test(industry.name)) return `A milestone involving ${areas} is at risk, and the fastest recovery option changes cost, reliability, environmental, or regulatory exposure. Leadership needs a documented recommendation before approving the revised plan.`
  if (/Logistics|Courier|Aviation|Rail|Shipping|Travel/i.test(industry.name)) return `Volume across ${areas} has shifted unexpectedly, creating service failures in one route or customer segment. An expedited recovery option improves the immediate SLA but increases cost or compliance risk.`
  if (/Telecom|Media|Entertainment|Advertising|Gaming/i.test(industry.name)) return `An activity involving ${areas} is generating strong reach or usage, but complaints and opt-outs have increased and one claim or content decision is under review. The next publication or campaign decision is due this week.`
  if (/Consulting|Accounting|Legal|Recruitment|BPO/i.test(industry.name)) return `A client deliverable involving ${areas} is due shortly, but the available evidence contains a material limitation that the client would prefer to omit. Delivery, accuracy, and professional obligations now conflict.`
  if (/Higher Education|K-12|EdTech|Vocational/i.test(industry.name)) return `A learner-facing claim affecting ${areas} promises a guaranteed outcome, while the approved evidence supports assistance or an expected range rather than a guarantee. A prospective learner has requested written confirmation before paying.`
  if (/Hotel|Restaurant|Hospitality|Sports/i.test(industry.name)) return `Demand involving ${areas} is above capacity for a peak period, and the proposed response could protect revenue but worsen service recovery, fairness, or customer trust.`
  if (/Government|NGO/i.test(industry.name)) return `A program affecting ${areas} is under pressure to show rapid results, but the proposed prioritization may exclude a high-need group or weaken procurement, evidence, or public-accountability requirements.`
  return `A proposed action involving ${areas || industry.focus} improves the headline result but creates an unresolved customer, operational, or governance risk related to ${competency.toLowerCase()}.`
}

function contextualIndustryWorkSample(question: Question, format: QuestionFormat, role: RoleFamily, industry: Industry, profile: AssessmentProfile) {
  const levelNote = levelComplexity[targetBand(profile.level)]
  if (format === 'excel') {
    const scenario = `The attached ${industry.name} workbook shows performance by period, region, and operating channel for ${industry.contexts.slice(0, 3).join(', ')}. Volume has changed, but cost, completion, exceptions, and outcome quality do not move in the same direction, so the headline total is not enough for a decision.`
    const task = `Analyze the workbook and recommend one ${industry.name} action. Calculate at least three relevant measures, compare two segments, identify the most decision-relevant exception, and explain how ${question.competency.toLowerCase()} changes your conclusion. ${levelNote}`
    return { ...question, scenario, task, prompt: `${scenario} ${task}`, guidance: `Submit an auditable workbook and a short recommendation that connects ${industry.name} operating context to a measurable customer, service, risk, or business outcome.` }
  }
  const scenario = industryRiskScenario(industry, question.competency)
  const task = `Make the immediate decision for this situation: state what may continue, pause, or change; identify the evidence or requirement you would verify; draft the message to the affected stakeholder; record the issue and owner; and define the condition for closure. Relate the decision to ${question.competency.toLowerCase()}. ${levelNote}`
  return { ...question, scenario, task, prompt: `${scenario} ${task}`, guidance: `Balance the operating objective with the customer, quality, regulatory, safety, or trust considerations that matter in ${industry.name}.` }
}

function b2cSalesSimulation(question: Question, role: RoleFamily, industry: Industry, profile: AssessmentProfile) {
  if (role.name !== 'B2C Sales') return question
  const offering = consumerOffering(industry)
  const scenario = `You begin a shift with three uncontacted leads for ${offering}: (A) a career switcher who requested a callback today and has weekend availability, (B) a student who downloaded a brochure but gave no timeline or budget, and (C) a parent who attended a webinar, asked about outcomes, and is comparing two providers. You have 45 minutes before a scheduled follow-up with an existing prospect who previously objected to price. You cannot promise placement outcomes or approve a discount.`
  const task = `Create your working plan for the shift. Prioritize the leads and explain why; write the discovery questions for your first conversation; give a short, needs-based pitch for one suitable lead; respond to the price objection; and specify the CRM fields, follow-up actions, and daily measures you would record. ${levelComplexity[targetBand(profile.level)]}`
  return {
    ...question,
    scenario,
    task,
    prompt: `${scenario} ${task}`,
    guidance: 'Treat this as one integrated job simulation. Show lead prioritization, discovery, ethical persuasion, objection handling, time management, and accurate sales-process documentation.',
    rubric: ['Lead prioritization', 'Discovery quality', 'Needs-based pitch', 'Objection handling', 'Sales-process discipline', 'Customer trust and accuracy'],
  }
}

function realisticSimulation(question: Question, role: RoleFamily, industry: Industry, profile: AssessmentProfile) {
  if (role.name === 'B2C Sales') return b2cSalesSimulation(question, role, industry, profile)
  const areas = industry.contexts.slice(0, 3).join(', ')
  const levelNote = levelComplexity[targetBand(profile.level)]
  let scenario: string
  let task: string

  if (/Sales|Business Development|Account Management|Pre-sales/i.test(role.name)) {
    scenario = `You start the week with three opportunities in ${industry.name}: one high-value prospect with unclear decision authority, one existing account reporting a service issue, and one time-sensitive opportunity requesting a concession. Pipeline coverage is below target, delivery capacity is constrained, and all activity must be recorded accurately.`
    task = 'Prioritize the opportunities, prepare discovery questions for the first conversation, write the value pitch, respond to the concession or objection, define the CRM updates and follow-ups, and state the daily measures you would use.'
  } else if (/Marketing|Market Research/i.test(role.name)) {
    scenario = `A ${industry.name} campaign across three channels generated more traffic but fewer completed outcomes, acquisition cost increased, and one audience segment has a higher complaint or opt-out rate. Only one material experiment can launch next cycle.`
    task = 'Diagnose the funnel, select the audience and channel to prioritize, draft the proposition or message, design one controlled experiment, allocate the available effort, and define success and stop criteria.'
  } else if (/Data|Analyst|Finance|Accounting|Audit|Tax|Credit|Investment|Research|Strategy|Consulting/i.test(role.name)) {
    scenario = `Leadership must decide how to respond to a performance gap in ${areas}. Two reports disagree, one segment explains most of the movement, several records are incomplete, and the requested decision is due before every uncertainty can be resolved.`
    task = 'Define the decision, reconcile or qualify the evidence, show the core analysis, identify the supported driver, compare two options, and produce the recommendation and stakeholder-ready summary.'
  } else if (/HR|Talent|People|Employee|Learning|Compensation/i.test(role.name)) {
    scenario = `A ${industry.name} team has rising vacancies or attrition, uneven manager participation, and a measurable performance or experience gap. The available budget supports only one intervention this cycle, and sensitive employee information must be handled appropriately.`
    task = 'Diagnose the people issue, segment the evidence, choose the priority group, design the intervention and manager communication, define ownership and safeguards, and specify leading and outcome measures.'
  } else if (/Supply|Logistics|Procurement|Sourcing|Inventory|Demand Planning|Warehouse|Operations|Process|Quality|Workforce/i.test(role.name)) {
    scenario = `Demand affecting ${areas} is above plan while capacity is constrained. Backlog and exceptions are increasing, one hand-off or supplier creates a disproportionate share of delay, and the fastest recovery option increases cost or quality risk.`
    task = 'Quantify the gap, identify the bottleneck, build the next-cycle operating plan, assign capacity and owners, address the quality or supplier risk, and define the control points and recovery measures.'
  } else if (/Software|QA|Product|UI\/UX|Cloud|Cybersecurity|IT Support|Technology/i.test(role.name)) {
    scenario = `A recent ${industry.name} product or technology change improved one adoption measure but increased incidents, defects, or user drop-off in a specific segment. The next release window is close and the team cannot deliver every requested fix.`
    task = 'Frame the user and technical problem, triage the evidence, prioritize the response, outline requirements or test cases, address reliability and security risk, and define release and rollback criteria.'
  } else if (/Project|PMO|Program|Implementation|Transformation|Change Management/i.test(role.name)) {
    scenario = `A cross-functional ${industry.name} initiative is behind one milestone, has two unresolved dependencies, and faces uneven stakeholder readiness. Recovering the date without changing scope would increase delivery or adoption risk.`
    task = 'Rebuild the critical action plan, update the dependency and risk log, recommend the scope/date trade-off, assign owners, draft the status communication, and define readiness and escalation checkpoints.'
  } else if (/Customer|Client|Relationship|Contact Center|Service/i.test(role.name)) {
    scenario = `Three ${industry.name} customer issues arrive together: a high-impact unresolved case, a repeat-contact pattern affecting many users, and an urgent request with limited evidence. SLA capacity allows the team to address only two immediately.`
    task = 'Triage the cases, write the first customer response, diagnose the repeat-contact cause, coordinate the recovery, document the case and escalation, and define service and customer-outcome measures.'
  } else if (/Legal|Compliance|Communications|Public Relations|Investor Relations/i.test(role.name)) {
    scenario = `A public or stakeholder-facing ${industry.name} message is due today, but one material claim is not fully supported and different audiences face different risks if the wording is wrong. Approval and disclosure responsibilities must remain clear.`
    task = 'Identify the material issue, verify the governing evidence, recommend what can be communicated, draft the message, map approvals and records, and prepare the response if the issue is challenged.'
  } else {
    scenario = `A ${industry.name} team must resolve a performance and service gap involving ${areas}. Demand, cost, and quality signals conflict, ownership is unclear, and only two significant actions can be completed this cycle.`
    task = `Complete the core ${role.name} work: ${role.description[0].toLowerCase()}${role.description.slice(1)} Prioritize two actions, assign owners and timing, document risks and assumptions, and define measurable results.`
  }

  task = `${task} ${levelNote}`
  return {
    ...question,
    scenario,
    task,
    prompt: `${scenario} ${task}`,
    guidance: `Submit one integrated ${role.name} work sample grounded in ${industry.name}. We assess diagnosis, functional execution, industry judgement, prioritization, communication, and measurable follow-through.`,
  }
}

function applyQuestionFormat(question: Question, format: QuestionFormat, role: RoleFamily, industry: Industry, profile: AssessmentProfile, writtenIndex: number): Question {
  const tags = [...new Set([...question.tags, `format-${format}`])]
  if (format === 'audio') {
    const configured: Question = {
      ...question,
      format,
      responseType: 'audio',
      assessmentModes: [...new Set<AssessmentMode>([...question.assessmentModes, 'application', 'audio'])],
      task: `${question.task ?? question.prompt} Record the response as a concise workplace briefing or pitch tailored to a ${role.name}.`,
      guidance: 'Speak for 60–90 seconds. Lead with the decision or recommendation, support it with the relevant facts, address the audience appropriately, and close with a clear next step.',
      rubric: [...new Set([...question.rubric, 'Spoken structure', 'Clarity and delivery', 'Audience awareness'])],
      tags,
    }
    return question.dimension === 'core'
      ? contextualCoreWorkSample(configured, format, role, industry, profile)
      : realisticRoleWorkSample(configured, format, role, industry, profile, writtenIndex)
  }
  if (format === 'excel') {
    const configured: Question = {
      ...question,
      format,
      responseType: 'written',
      task: `${question.task ?? question.prompt} Use the attached Excel dataset as evidence: show your calculations or analysis in the workbook, identify the most important patterns, and recommend the next action.`,
      guidance: 'Submit the completed workbook and a concise written explanation of your method, assumptions, findings, and recommendation.',
      rubric: [...new Set([...question.rubric, 'Spreadsheet accuracy', 'Data interpretation', 'Method transparency'])],
      tags: [...new Set([...tags, 'excel-work-sample', `data-variant-${dataVariant(role.name)}`])],
      sampleData: sampleDataTask(question, role, industry, profile),
    }
    if (question.dimension === 'core') return contextualCoreWorkSample(configured, format, role, industry, profile)
    return question.dimension === 'industry'
      ? contextualIndustryWorkSample(configured, format, role, industry, profile)
      : realisticRoleWorkSample(configured, format, role, industry, profile, writtenIndex)
  }
  if (format === 'written_communication') {
    const isEmail = writtenIndex === 0
    const configured: Question = {
      ...question,
      format,
      responseType: 'written',
      task: isEmail
        ? `Draft a professional email to the key stakeholders in this scenario. Explain the issue using the available facts, state your recommendation, and make the required actions, owners, and timing unmistakably clear.`
        : `Turn the data points in this scenario into a concise business storyline for leadership: explain what changed, why it matters, the most likely driver, and the decision or action you recommend.`,
      guidance: isEmail
        ? 'Write 120–180 words with a useful subject line, audience-appropriate tone, evidence-led message, and explicit call to action.'
        : 'Write 150–220 words. Build a clear narrative from evidence to insight to business impact and recommendation; do not merely repeat the figures.',
      rubric: [...new Set([...question.rubric, isEmail ? 'Professional email structure' : 'Data storytelling', 'Audience awareness', 'Action clarity'])],
      tags,
    }
    return question.dimension === 'core'
      ? contextualCoreWorkSample(configured, format, role, industry, profile)
      : realisticRoleWorkSample(configured, format, role, industry, profile, writtenIndex)
  }
  const configured: Question = {
    ...question,
    format,
    responseType: 'written',
    assessmentModes: [...new Set<AssessmentMode>([...question.assessmentModes, 'application'])],
    task: `${question.task ?? question.prompt} Respond as you would in the real job: make a decision, use the supplied facts, explain your problem-solving approach, and present the recommendation or pitch expected from a ${role.name}.`,
    guidance: 'Treat this as a role-specific workplace situation. State assumptions, prioritize actions, explain trade-offs, and define a measurable result.',
    rubric: [...new Set([...question.rubric, 'Role-specific judgement', 'Problem solving', 'Practical recommendation'])],
    tags,
  }
  if (question.dimension === 'core') return contextualCoreWorkSample(configured, format, role, industry, profile)
  return question.dimension === 'industry'
    ? contextualIndustryWorkSample(configured, format, role, industry, profile)
    : realisticRoleWorkSample(configured, format, role, industry, profile, writtenIndex)
}

function configureQuestionFormats(questions: Question[], role: RoleFamily, industry: Industry, profile: AssessmentProfile) {
  let writtenIndex = 0
  const roleFormats = assignRoleFormats(questions.filter((question) => question.dimension === 'role'))
  return questions.map((question) => {
    if (question.dimension === 'simulation') {
      const configured = { ...question, format: 'simulation' as const, tags: [...new Set([...question.tags, 'format-simulation'])] }
      return realisticSimulation(configured, role, industry, profile)
    }
    const dimensionQuestions = questions.filter((item) => item.dimension === question.dimension)
    const position = dimensionQuestions.findIndex((item) => item.id === question.id)
    const format = question.dimension === 'role'
      ? roleFormats.get(question.id) ?? 'situational'
      : formatByDimension[question.dimension][position]
    const configured = applyQuestionFormat(question, format, role, industry, profile, writtenIndex)
    if (format === 'written_communication') writtenIndex += 1
    return configured
  })
}

export function buildAssessment(role: RoleFamily, industry: Industry, profile: AssessmentProfile, options: { previousCoreBankIds?: string[] } = {}): Question[] {
  const bank = getAssessmentBank(role.code, industry.code)
  const core = selectMixed(bank.core, 3, applicationTarget('core', 3, profile), profile, new Set(options.previousCoreBankIds ?? []))
  const roleItems = selectMixed(bank.role, 5, applicationTarget('role', 5, profile), profile)
  const industryItems = selectMixed(bank.industry, 2, applicationTarget('industry', 2, profile), profile)
  const items = [...core, ...roleItems, ...industryItems, ...(bank.simulation ? [bank.simulation] : [])]
  const questions = items
    .map((item) => contextualizeItem(item, role, industry, profile))
    .map((item) => adaptItem(item, profile))
    .map(toQuestion)
  return configureQuestionFormats(questions, role, industry, profile)
}

export const educationOptions = [
  'Bachelor’s degree',
  'Master’s degree / MBA',
  'Diploma / professional qualification',
  'Other',
]

export const levelOptions = ['Entry level', 'Associate', 'Mid-level', 'Senior']
