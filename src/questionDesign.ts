export type DesignBand = 'entry' | 'associate' | 'mid' | 'senior'
export type DesignDimension = 'core' | 'role' | 'industry' | 'simulation'
export type DesignFormat = 'audio' | 'excel' | 'written_communication' | 'situational' | 'simulation'

type RoleLike = { code: string; name: string; description: string }
type IndustryLike = { code: string; name: string; focus: string; contexts: string[] }

export type LevelAuthority = {
  scope: string
  decisionBoundary: string
  escalationBoundary: string
  complexity: string
}

export type RoleTaskBlueprint = {
  id: string
  activity: string
  trigger: string
  audience: string
  record: string
  successEvidence: string
}

export type IndustrySituation = {
  id: string
  workflow: string
  event: string
  operatingConstraint: string
  evidenceSource: string
}

export type WorkProduct = {
  id: string
  name: string
  instruction: string
}

export type QuestionDesign = {
  roleTask: RoleTaskBlueprint
  industrySituation: IndustrySituation
  workProduct: WorkProduct
  authority: LevelAuthority
}

export type DesignedQuestionLike = {
  id: string
  dimension: DesignDimension
  competency: string
  scenario?: string
  task?: string
  format: DesignFormat
  tags: string[]
}

export type DesignIssue = {
  questionId?: string
  code: 'missing-design-tag' | 'authority-mismatch' | 'duplicate-work-sample' | 'generic-context' | 'missing-output'
  message: string
}

const levelAuthorities: Record<DesignBand, LevelAuthority> = {
  entry: {
    scope: 'Complete a defined task, handle a routine case, record accurate facts, and raise exceptions.',
    decisionBoundary: 'May take the next approved operational step but does not set policy, allocate cross-functional resources, or commit other teams.',
    escalationBoundary: 'Escalate when information is missing, the case falls outside the documented process, or approval is required.',
    complexity: 'One immediate problem, a limited number of facts, and a clear supervisor or process owner.',
  },
  associate: {
    scope: 'Own a routine workstream independently, investigate evidence, and recommend a practical team-level action.',
    decisionBoundary: 'May coordinate routine handoffs and propose owners, while wider commitments and exceptions require approval.',
    escalationBoundary: 'Escalate material risk, unresolved dependencies, or decisions beyond the team’s authority.',
    complexity: 'A complete task with some ambiguity, segment comparison, and coordination inside or adjacent to the team.',
  },
  mid: {
    scope: 'Diagnose a material problem, compare options, coordinate functions, and own implementation outcomes.',
    decisionBoundary: 'May prioritize work and assign agreed owners within the operating mandate.',
    escalationBoundary: 'Escalate strategic, policy, funding, or high-impact risk decisions.',
    complexity: 'Competing priorities, incomplete evidence, implementation risk, and measurable trade-offs.',
  },
  senior: {
    scope: 'Set direction, allocate resources, establish governance, and own organizational outcomes.',
    decisionBoundary: 'Makes or sponsors strategic decisions and establishes accountability across functions.',
    escalationBoundary: 'Escalates board, regulatory, enterprise-risk, or capital decisions where required.',
    complexity: 'Structural uncertainty, second-order consequences, portfolio choices, and enterprise impact.',
  },
}

export function authorityForLevel(level: string): LevelAuthority {
  if (/senior/i.test(level)) return levelAuthorities.senior
  if (/mid/i.test(level)) return levelAuthorities.mid
  if (/associate/i.test(level)) return levelAuthorities.associate
  return levelAuthorities.entry
}

export function designBand(level: string): DesignBand {
  if (/senior/i.test(level)) return 'senior'
  if (/mid/i.test(level)) return 'mid'
  if (/associate/i.test(level)) return 'associate'
  return 'entry'
}

function stableIndex(value: string, length: number) {
  let hash = 0
  for (const character of value) hash = ((hash * 31) + character.charCodeAt(0)) >>> 0
  return length ? hash % length : 0
}

function roleFamily(name: string) {
  if (/Legal|Compliance|\bRisk\b|Audit|Tax/i.test(name)) return 'governance'
  if (/Corporate Communications|Public Relations|Investor Relations|Content|Social Media/i.test(name)) return 'communications'
  if (/Consulting|Strategy|Transformation|Research \/ Advisory/i.test(name)) return 'advisory'
  if (/Administration|Project|PMO|Program|Implementation|Change Management/i.test(name)) return 'coordination'
  if (/HR|Talent|People|Recruit|Employee|Learning|Compensation|Education \/ Academic/i.test(name)) return 'people'
  if (/Software|Technology|Product|Cloud|Cyber|QA|Engineering|IT\b|IT Support|UI\/UX/i.test(name)) return 'technology'
  if (/Customer|Client|Service|Success|Relationship|Support|Contact Center/i.test(name)) return 'service'
  if (/Sales|Marketing|Brand|Growth|Account Management|Business Development|Market Research/i.test(name)) return 'commercial'
  if (/Operations Analyst/i.test(name)) return 'operations'
  if (/Data|Analyst|Finance|Accounting|Investment|Credit|Research/i.test(name)) return 'analytical'
  if (/Operations|Supply|Logistics|Procurement|Sourcing|Inventory|Planning|Warehouse|Manufacturing|Quality|Process|Workforce/i.test(name)) return 'operations'
  return 'general'
}

const roleTaskLibraries: Record<string, RoleTaskBlueprint[]> = {
  service: [
    { id: 'service-live-case', activity: 'handle and document a live customer case', trigger: 'a customer has made repeat contact after receiving inconsistent information', audience: 'the affected customer and the next internal owner', record: 'the customer reply, case note, and handoff record', successEvidence: 'the customer receives an accurate next step and the case has a named owner and update time' },
    { id: 'service-journey-break', activity: 'identify and address a broken customer-journey step', trigger: 'one journey stage is producing avoidable delay, effort, or repeat contact', audience: 'the customer and the team owning the failed step', record: 'a journey finding and corrective-action handoff', successEvidence: 'customer effort or repeat contact reduces at the affected step' },
    { id: 'service-feedback-pattern', activity: 'turn customer feedback into an operational finding', trigger: 'recent feedback contains recurring themes but the reason codes are incomplete', audience: 'the service or product owner who can act on the finding', record: 'a coded feedback summary with evidence and limitations', successEvidence: 'the priority theme is validated and an owner tests a measurable response' },
    { id: 'service-recovery', activity: 'coordinate service recovery within an explicit authority limit', trigger: 'a material service promise was missed and no reliable recovery path has been communicated', audience: 'the affected customer, service owner, and approval holder', record: 'the recovery message, action log, and closure check', successEvidence: 'the customer receives a controlled recovery and confirmation that the issue is closed' },
  ],
  commercial: [
    { id: 'commercial-discovery', activity: 'qualify a customer need before recommending an offer', trigger: 'a prospect has shown interest but need, authority, timing, and decision criteria are incomplete', audience: 'the prospect and the sales or marketing lead', record: 'discovery notes, qualification status, and agreed next step', successEvidence: 'the opportunity is responsibly advanced or disqualified using recorded evidence' },
    { id: 'commercial-pipeline', activity: 'prioritize a pipeline, campaign, or account action', trigger: 'activity volume is rising while conversion or value is falling in one segment', audience: 'the commercial owner deciding where to focus effort', record: 'a prioritized pipeline or campaign action list', successEvidence: 'effort shifts to the highest-supported opportunity and the target measure improves' },
    { id: 'commercial-proposition', activity: 'translate a confirmed need into a responsible value proposition', trigger: 'the audience questions the fit, value, evidence, or proposed terms', audience: 'the buyer, customer, or target audience', record: 'the finished pitch, response, or campaign message', successEvidence: 'the audience makes a clear next commitment without relying on an unsupported claim' },
    { id: 'commercial-performance', activity: 'diagnose a commercial performance gap', trigger: 'demand, conversion, cost, and retained value are moving in different directions', audience: 'the commercial manager and operational partners', record: 'an auditable performance analysis and action recommendation', successEvidence: 'the decision targets the supported driver and defines a measurable commercial outcome' },
  ],
  analytical: [
    { id: 'analytical-data-check', activity: 'validate source data before using it for a decision', trigger: 'two reported totals disagree or a material field is incomplete', audience: 'the data owner and decision maker', record: 'a validation log and reconciled analysis file', successEvidence: 'the decision uses a traceable dataset with material limitations disclosed' },
    { id: 'analytical-driver', activity: 'identify the segment and driver behind a reported movement', trigger: 'a headline measure changed but the total hides material segment differences', audience: 'the manager choosing the next investigation or action', record: 'an analysis workbook and decision note', successEvidence: 'the supported driver is separated from assumptions and linked to a testable action' },
    { id: 'analytical-forecast', activity: 'update a forecast or financial view using controlled assumptions', trigger: 'actual performance differs from plan and the current forecast no longer reconciles', audience: 'the planning, finance, or business owner', record: 'a versioned forecast, bridge, or model', successEvidence: 'the revised view is reproducible and shows sensitivity to the material assumption' },
    { id: 'analytical-brief', activity: 'translate analysis into a decision-ready recommendation', trigger: 'stakeholders have the figures but disagree about their implication', audience: 'the accountable business decision maker', record: 'a concise evidence-to-decision brief', successEvidence: 'the decision, uncertainty, and follow-up measure are explicit' },
  ],
  operations: [
    { id: 'operations-exception', activity: 'triage and control an operating exception', trigger: 'an exception threatens the next service, production, or fulfilment commitment', audience: 'the process owner and affected downstream team', record: 'an exception record, immediate containment, and handoff', successEvidence: 'impact is contained and closure evidence is recorded' },
    { id: 'operations-capacity', activity: 'match demand, capacity, and service priorities', trigger: 'demand exceeds available capacity and not all work can be completed as planned', audience: 'the operating lead and teams supplying or consuming capacity', record: 'a prioritized capacity or production plan', successEvidence: 'the highest-priority work is protected with explicit service and cost effects' },
    { id: 'operations-workforce-control', activity: 'translate a demand forecast into a workable staffing schedule', trigger: 'coverage, shrinkage, or adherence means the published schedule will miss the expected service requirement', audience: 'the workforce lead and frontline operations manager', record: 'a staffing view, schedule adjustment, and adherence follow-up', successEvidence: 'required coverage is restored and the effect on service, cost, and employee constraints is visible' },
    { id: 'operations-shrinkage', activity: 'reconcile planned staffing with productive capacity after shrinkage', trigger: 'scheduled headcount appears sufficient but meetings, leave, training, or absence reduce available operating hours', audience: 'the workforce planner and manager approving offline activity', record: 'a shrinkage calculation and revised coverage recommendation', successEvidence: 'the capacity plan reflects approved offline time and protects the required service interval' },
    { id: 'operations-adherence', activity: 'investigate and address a schedule-adherence gap', trigger: 'actual login or productive time differs materially from the published schedule in a defined interval', audience: 'the workforce lead and frontline manager responsible for the affected interval', record: 'an interval-level adherence analysis and controlled follow-up action', successEvidence: 'the supported source of the variance is addressed and service recovers without using an assumed cause' },
    { id: 'operations-performance-analysis', activity: 'turn operating KPI movement into a supported first diagnosis', trigger: 'the headline result hides which segment, process stage, or operating condition created the movement', audience: 'the operating manager deciding what to investigate or change', record: 'a segmented KPI analysis and evidence-led follow-up action', successEvidence: 'the next action targets the supported operating driver and has a defined before-and-after measure' },
    { id: 'operations-flow', activity: 'locate and address a process bottleneck', trigger: 'one handoff creates a disproportionate share of delay, rework, or failure', audience: 'the process owner and teams on either side of the handoff', record: 'a current-state map and controlled improvement experiment', successEvidence: 'the targeted delay or defect reduces without moving the failure downstream' },
    { id: 'operations-supplier', activity: 'resolve a supplier, inventory, or logistics shortfall', trigger: 'a supplier or stock constraint threatens an agreed operating outcome', audience: 'the supplier owner and affected operations or customer team', record: 'a recovery plan and supplier or inventory action log', successEvidence: 'continuity is restored within approved cost, quality, and risk limits' },
  ],
  technology: [
    { id: 'technology-incident', activity: 'triage a product or technology incident', trigger: 'a release or configuration change is followed by failures in a defined user segment', audience: 'the affected user and incident or product owner', record: 'the incident update, triage evidence, and next technical action', successEvidence: 'impact is contained and recovery or rollback criteria are met' },
    { id: 'technology-support-case', activity: 'diagnose and progress a user support request', trigger: 'a user cannot complete a time-sensitive task and the existing ticket lacks a confirmed diagnosis or owner', audience: 'the affected user and the next technical support owner', record: 'a user update, troubleshooting record, and controlled escalation', successEvidence: 'service is restored or the ticket reaches the correct owner with reproducible evidence and an update time' },
    { id: 'technology-requirement', activity: 'turn an incomplete request into testable requirements', trigger: 'the requested solution is broad and an important user or technical constraint is unresolved', audience: 'the requester and delivery team', record: 'a requirements brief with acceptance criteria', successEvidence: 'the team can build and test the agreed outcome without relying on hidden assumptions' },
    { id: 'technology-priority', activity: 'prioritize product or technical work under constrained capacity', trigger: 'the team cannot deliver every requested fix or feature in the next cycle', audience: 'the product, engineering, and business owners', record: 'a prioritized backlog and decision rationale', successEvidence: 'the highest-value and highest-risk work has an accountable release decision' },
    { id: 'technology-quality', activity: 'design and document a validation or quality check', trigger: 'the current change lacks evidence for a critical acceptance, reliability, or security condition', audience: 'the delivery owner and quality or security reviewer', record: 'test cases, results, defects, and release recommendation', successEvidence: 'release evidence covers the material failure mode and supports a controlled decision' },
    { id: 'technology-user-validation', activity: 'test a proposed experience with representative users', trigger: 'the design appears usable internally but evidence from the target user and critical journey is incomplete', audience: 'the product or design owner deciding the next iteration', record: 'a usability test plan, observed evidence, and prioritized design finding', successEvidence: 'the next design change addresses an observed user failure and is retested against a clear criterion' },
  ],
  people: [
    { id: 'people-case', activity: 'handle a candidate or employee case consistently and confidentially', trigger: 'the available record is incomplete and the person needs a fair next step', audience: 'the candidate or employee and the accountable manager', record: 'the finished communication and controlled case note', successEvidence: 'the person receives a clear process-consistent outcome and sensitive data remains protected' },
    { id: 'people-selection', activity: 'apply evidence-based selection or talent criteria', trigger: 'decision makers are using inconsistent evidence for the same requirement', audience: 'the hiring or talent decision maker', record: 'structured criteria, evidence notes, and decision recommendation', successEvidence: 'comparable evidence is assessed consistently and exceptions are documented' },
    { id: 'people-program', activity: 'diagnose a people or learning outcome gap', trigger: 'participation is reported but the intended workplace outcome has not improved', audience: 'the people-program owner and line managers', record: 'a diagnosis and targeted intervention plan', successEvidence: 'the intervention changes an observable behavior and business or employee outcome' },
    { id: 'people-workforce', activity: 'prioritize a workforce action from segmented evidence', trigger: 'vacancy, attrition, workload, or engagement differs materially between teams', audience: 'the people partner and accountable business manager', record: 'a segmented workforce analysis and action brief', successEvidence: 'the priority group receives an owned intervention with leading and outcome measures' },
    { id: 'people-reward', activity: 'evaluate a pay or benefit decision using consistent evidence', trigger: 'the current reward position differs across comparable roles or employee groups and the reason is not documented', audience: 'the reward owner and manager requesting the decision', record: 'a benchmarked reward analysis with decision and approval record', successEvidence: 'the recommendation is internally consistent, externally informed, affordable, and approved at the correct authority level' },
  ],
  governance: [
    { id: 'governance-exception', activity: 'assess and document a policy or control exception', trigger: 'a proposed action improves speed or value but required evidence or approval is missing', audience: 'the business owner and control or policy owner', record: 'an exception assessment and approval record', successEvidence: 'work proceeds, pauses, or changes under an explicit authorized decision' },
    { id: 'governance-control', activity: 'test whether a control operates as intended', trigger: 'reported compliance is high but sampled evidence shows an inconsistent decision path', audience: 'the control owner and independent reviewer', record: 'a test sheet with findings, evidence, and remediation', successEvidence: 'the exposure is quantified and remediation has an owner and verification date' },
    { id: 'governance-advice', activity: 'translate a requirement into an operational decision', trigger: 'teams interpret the same requirement differently and delivery is waiting for guidance', audience: 'the accountable business and policy owners', record: 'a reasoned advice note with assumptions and approval route', successEvidence: 'the decision is consistent, traceable, and operationally usable' },
    { id: 'governance-monitoring', activity: 'prioritize risk using current evidence and control effectiveness', trigger: 'incident volume is changing but the register does not show actual exposure or action priority', audience: 'the risk owner and operating leadership', record: 'an updated risk assessment and monitoring trigger', successEvidence: 'material exposure receives proportionate treatment and follow-up evidence' },
  ],
  communications: [
    { id: 'communications-response', activity: 'prepare an accurate external response under time pressure', trigger: 'a stakeholder asks for an explanation while one material fact is still being checked', audience: 'the external stakeholder and approving business owner', record: 'the finished response and approval trail', successEvidence: 'the message is timely, supported, and does not overstate certainty' },
    { id: 'communications-message', activity: 'adapt a message for audiences with different information needs', trigger: 'channels currently use inconsistent wording about the same business event', audience: 'the defined external and internal audiences', record: 'a message set with channel and approval choices', successEvidence: 'audiences receive consistent facts and a relevant action or expectation' },
    { id: 'communications-monitoring', activity: 'interpret audience response and recommend a communication action', trigger: 'reach or attention is rising while sentiment, trust, or response quality is falling', audience: 'the communications owner and accountable leader', record: 'an audience-response analysis and action brief', successEvidence: 'the response addresses the supported concern and improves a defined trust or engagement measure' },
    { id: 'communications-issue', activity: 'coordinate issue communication and escalation', trigger: 'an operational issue may become public and teams disagree about what can be confirmed', audience: 'affected stakeholders, Communications, and the accountable executive', record: 'a holding statement, Q&A, escalation, and monitoring plan', successEvidence: 'material stakeholders receive accurate updates while the issue moves toward resolution' },
  ],
  advisory: [
    { id: 'advisory-problem', activity: 'structure an ambiguous client or business problem', trigger: 'the desired outcome is clear but the boundary, baseline, and decision criteria are not', audience: 'the sponsor and functional owner', record: 'a problem statement, issue tree, and evidence plan', successEvidence: 'the next analysis tests the decision-critical hypotheses' },
    { id: 'advisory-options', activity: 'compare feasible options and their implementation consequences', trigger: 'the preferred option has attractive headline value but depends on an untested assumption', audience: 'the sponsor choosing a direction', record: 'an options assessment and recommendation', successEvidence: 'the decision reflects value, feasibility, risk, and implementation ownership' },
    { id: 'advisory-evidence', activity: 'synthesize incomplete evidence into a qualified recommendation', trigger: 'sources disagree and the decision cannot wait for every uncertainty to be resolved', audience: 'the client or senior decision maker', record: 'a decision brief with evidence, assumptions, and limitations', successEvidence: 'the recommendation is actionable and clear about what could change it' },
    { id: 'advisory-delivery', activity: 'turn a recommendation into an implementable first phase', trigger: 'stakeholders accept the direction but ownership, sequence, and adoption remain unclear', audience: 'the sponsor and implementation owners', record: 'a phased implementation roadmap and governance plan', successEvidence: 'the first phase has accountable owners, dependencies, measures, and review points' },
  ],
  coordination: [
    { id: 'coordination-dependency', activity: 'resolve and record a delivery dependency', trigger: 'a required input has no confirmed owner and threatens the next milestone', audience: 'the dependency owner and project or service lead', record: 'an updated action, dependency, or RAID record', successEvidence: 'the owner, due date, impact, and escalation trigger are confirmed' },
    { id: 'coordination-plan', activity: 'rebuild a practical short-term delivery plan', trigger: 'the current schedule cannot be met with available inputs or capacity', audience: 'the delivery contributors and accountable manager', record: 'a sequenced plan with owners and checkpoints', successEvidence: 'critical work has realistic dates, dependencies, and an agreed decision path' },
    { id: 'coordination-handoff', activity: 'complete a controlled handoff between teams', trigger: 'work is delayed because required information and acceptance are unclear at the handoff', audience: 'the sending and receiving teams', record: 'a handoff checklist, status message, and acceptance record', successEvidence: 'the receiving owner can act without repeat clarification' },
    { id: 'coordination-status', activity: 'produce a decision-oriented status update', trigger: 'stakeholders have activity updates but no shared view of impact, risk, or required decision', audience: 'the project or operating decision maker', record: 'a concise status report and decision log', successEvidence: 'the decision, owner, and next checkpoint are recorded' },
  ],
  general: [
    { id: 'general-case', activity: 'resolve a defined operational case', trigger: 'a routine request cannot progress because one fact, owner, or approval is missing', audience: 'the requester and accountable supervisor', record: 'a completed case note and next-action message', successEvidence: 'the request progresses or is appropriately escalated with a clear record' },
    { id: 'general-analysis', activity: 'identify the evidence behind a performance gap', trigger: 'a headline result is below target and the contributing segment is unclear', audience: 'the manager deciding the next action', record: 'a factual analysis and follow-up question', successEvidence: 'the next action is based on a supported pattern rather than an assumed cause' },
    { id: 'general-improvement', activity: 'recommend a controlled improvement to a recurring problem', trigger: 'the same exception has repeated and individual fixes are not preventing recurrence', audience: 'the process owner and affected team', record: 'an improvement proposal with a before-and-after measure', successEvidence: 'the recurring exception reduces without creating a new material risk' },
    { id: 'general-decision', activity: 'prepare a clear recommendation from incomplete evidence', trigger: 'the decision is due before every open question can be resolved', audience: 'the accountable decision maker', record: 'a recommendation with assumptions and escalation conditions', successEvidence: 'the decision can proceed with uncertainty and authority boundaries visible' },
  ],
}

function roleTask(role: RoleLike, competency: string, seed: string) {
  const family = roleFamily(role.name)
  const library = roleTaskLibraries[family] ?? roleTaskLibraries.general
  const value = competency.toLowerCase()
  const preferredId = family === 'service'
    ? (/journey|onboard|adoption|retention/.test(value) ? 'service-journey-break' : /voc|feedback|metric|insight|health scor|qbr/.test(value) ? 'service-feedback-pattern' : /recovery|escalat|empathy/.test(value) ? 'service-recovery' : 'service-live-case')
    : family === 'commercial'
      ? (/discover|qualif|need|research|market map/.test(value) ? 'commercial-discovery' : /pipeline|forecast|conversion|analytic|performance|attribution|service review/.test(value) ? 'commercial-performance' : /pitch|persuad|objection|negotiat|content|brand|proposition|position|messag|upsell|cross-sell/.test(value) ? 'commercial-proposition' : 'commercial-pipeline')
      : family === 'analytical'
        ? (/quality|reconcil|control|audit|validation/.test(value) ? 'analytical-data-check' : /forecast|budget|financial|valuation|cash|capital|ratio/.test(value) ? 'analytical-forecast' : /story|report|visual|dashboard|insight|recommend/.test(value) ? 'analytical-brief' : 'analytical-driver')
        : family === 'operations'
          ? (/Workforce Management/i.test(role.name) && /shrinkage/.test(value) ? 'operations-shrinkage' : /Workforce Management/i.test(role.name) && /adherence/.test(value) ? 'operations-adherence' : /Workforce Management/i.test(role.name) && /staffing|scheduling/.test(value) ? 'operations-workforce-control' : /root|lean|bottleneck|continuous/.test(value) ? 'operations-flow' : /kpi|analytic|report/.test(value) ? 'operations-performance-analysis' : /procurement process/.test(value) ? 'operations-flow' : /supplier|sourcing|procurement|logistics|inventory|warehouse|replenish/.test(value) ? 'operations-supplier' : /process|flow|productivity/.test(value) ? 'operations-flow' : /exception|quality|defect|safety/.test(value) ? 'operations-exception' : 'operations-capacity')
          : family === 'technology'
            ? (/service desk|support|knowledge|sla|communication/.test(value) ? 'technology-support-case' : /user research|usability/.test(value) ? 'technology-user-validation' : /incident|troubleshoot|availability|reliability|cloud|infrastructure/.test(value) ? 'technology-incident' : /test|quality|security|privacy|defect|qa/.test(value) ? 'technology-quality' : /roadmap|backlog|priority|portfolio/.test(value) ? 'technology-priority' : 'technology-requirement')
            : family === 'people'
              ? (/Compensation & Benefits/i.test(role.name) && /benefit/.test(value) ? 'people-program' : /Compensation & Benefits/i.test(role.name) && /pay|benchmark|job evaluation/.test(value) ? 'people-reward' : /sourc|screen|interview|select|recruit|candidate assessment|talent review/.test(value) ? 'people-selection' : /candidate|employee experience|case|relation|onboard/.test(value) ? 'people-case' : /learning|training|talent|performance|development|career/.test(value) ? 'people-program' : 'people-workforce')
              : family === 'governance'
                ? (/exception|policy|legal|advice|interpret/.test(value) ? 'governance-exception' : /test|audit|control|compliance/.test(value) ? 'governance-control' : /monitor|risk|incident/.test(value) ? 'governance-monitoring' : 'governance-advice')
                : family === 'communications'
                  ? (/monitor|sentiment|social|audience|analytic|reputation/.test(value) ? 'communications-monitoring' : /issue|crisis|escalat/.test(value) ? 'communications-issue' : /message|content|channel|brand|press|material/.test(value) ? 'communications-message' : 'communications-response')
                  : family === 'advisory'
                    ? (/implement|change|delivery|roadmap/.test(value) ? 'advisory-delivery' : /option|solution|design|recommend/.test(value) ? 'advisory-options' : /evidence|synth|research|analysis/.test(value) ? 'advisory-evidence' : 'advisory-problem')
                    : family === 'coordination'
                      ? (/depend|risk|raid|issue/.test(value) ? 'coordination-dependency' : /handoff|document|record|administration/.test(value) ? 'coordination-handoff' : /status|report|communicat|stakeholder/.test(value) ? 'coordination-status' : 'coordination-plan')
                      : undefined
  const familyPreferred = preferredId ? library.find((item) => item.id === preferredId) : undefined
  const preferred = familyPreferred
    ?? (family === 'technology' && value.match(/service desk|support|knowledge|sla|user communication/) ? library.find((item) => item.id === 'technology-support-case')
    : family === 'operations' && /Workforce Management/i.test(role.name) && value.match(/shrinkage/) ? library.find((item) => item.id === 'operations-shrinkage')
      : family === 'operations' && /Workforce Management/i.test(role.name) && value.match(/adherence/) ? library.find((item) => item.id === 'operations-adherence')
      : family === 'operations' && /Workforce Management/i.test(role.name) && value.match(/staffing|scheduling/) ? library.find((item) => item.id === 'operations-workforce-control')
    : value.match(/customer|journey|service|case|empathy|retention|onboard/) ? library.find((item) => /case|journey|recovery/.test(item.id))
    : value.match(/data|metric|analytic|report|financial|forecast|kpi|performance/) ? library.find((item) => /performance|driver|analysis|forecast|monitoring/.test(item.id))
      : value.match(/risk|control|quality|audit|compliance|test|security/) ? library.find((item) => /control|quality|exception|incident/.test(item.id))
        : value.match(/plan|capacity|project|schedule|dependency|process|supplier|inventory/) ? library.find((item) => /plan|capacity|dependency|flow|supplier/.test(item.id))
          : value.match(/communication|content|message|stakeholder|relationship|pitch|objection|discovery/) ? library.find((item) => /response|message|discovery|proposition|case/.test(item.id))
            : undefined)
  return preferred ?? library[stableIndex(`${role.code}-${competency}-${seed}`, library.length)]
}

type IndustryPack = {
  id: string
  match: RegExp
  workflows: string[]
  events: string[]
  constraints: string[]
  evidence: string[]
}

const industryPacks: IndustryPack[] = [
  { id: 'regulated-finance', match: /Banking|NBFC|Insurance|FinTech|Capital Markets|Investment|Payments/i, workflows: ['customer onboarding and eligibility', 'payment, account, claim, or transaction servicing', 'credit, investment, or policy decisioning'], events: ['a required consent or eligibility record is missing from a sampled case', 'a customer-facing decision differs across two channels', 'transaction volume rose while exceptions and complaints concentrated in one segment'], constraints: ['the action must meet approval, suitability, privacy, and audit-trail requirements', 'no unapproved exception or customer outcome may be promised'], evidence: ['case and transaction records', 'eligibility, consent, and approval logs', 'channel, complaint, and outcome data'] },
  { id: 'healthcare', match: /Hospital|Health|Diagnostics|Pharma|Medical/i, workflows: ['appointment, admission, or patient-service coordination', 'diagnostic, treatment, or product-quality follow-up', 'patient billing, access, or support'], events: ['turnaround is delayed for a time-sensitive patient case', 'a proposed shortcut conflicts with the approved quality or safety process', 'demand rose while one patient group experienced more delay or repeat contact'], constraints: ['patient safety, privacy, clinical authority, and approved procedures take priority', 'the candidate may not make a clinical promise or override an authorized decision'], evidence: ['patient-service records with protected data minimized', 'quality, turnaround, and escalation logs', 'approved procedure and ownership records'] },
  { id: 'consumer-commerce', match: /E-commerce|Retail|FMCG|Consumer|Fashion|Beauty|Food & Beverage/i, workflows: ['product discovery, order, payment, and fulfilment', 'delivery, exchange, return, and refund', 'campaign, inventory, and store or marketplace coordination'], events: ['a promotion increased orders but one channel produced more cancellations, returns, or complaints', 'a customer received conflicting delivery or refund updates after a failed handoff', 'stock availability and the customer promise no longer match for a high-demand item'], constraints: ['customer promises must reflect actual inventory, fulfilment, policy, and approval limits', 'the response must balance customer recovery with margin, fraud, and stock controls'], evidence: ['order and fulfilment records', 'return, refund, and contact reasons', 'channel, product, inventory, and campaign performance'] },
  { id: 'technology-services', match: /Software|IT Services|AI \/ Data|Cybersecurity|Cloud|Hardware/i, workflows: ['user onboarding, subscription, and product adoption', 'release, incident, defect, and support management', 'requirements, configuration, and change delivery'], events: ['a release improved one usage measure but increased failures for a defined user segment', 'support contacts rose after a configuration or workflow change', 'a requested feature lacks acceptance evidence for a critical constraint'], constraints: ['security, privacy, reliability, rollback, and change-control conditions must remain explicit', 'unsupported technical certainty or delivery commitments are not permitted'], evidence: ['event, incident, and support logs', 'release, test, and change records', 'usage funnel and segment data'] },
  { id: 'industrial', match: /Manufacturing|Automotive|Chemicals|Engineering|Construction/i, workflows: ['production, inspection, and release', 'supplier, material, and inventory coordination', 'site, equipment, and quality operations'], events: ['output is behind plan and the fastest recovery would bypass a quality or safety control', 'one supplier or process step creates most delay or rework', 'a defect pattern is concentrated in one shift, line, site, or material batch'], constraints: ['safety, specification, traceability, and release authority cannot be bypassed', 'recovery must not transfer an uncontrolled defect downstream'], evidence: ['production, inspection, and defect records', 'supplier, batch, and traceability data', 'capacity, downtime, cost, and rework reports'] },
  { id: 'infrastructure-energy', match: /Infrastructure|Energy|Oil & Gas|Renewable/i, workflows: ['project milestone and contractor delivery', 'asset reliability, maintenance, and outage response', 'commercial, environmental, and regulatory approval'], events: ['a critical milestone is at risk and the fastest recovery increases cost or reliability exposure', 'asset performance has deteriorated while planned capacity is constrained', 'contractor evidence is incomplete for a required approval'], constraints: ['safety, environmental, regulatory, reliability, and delegated approval limits apply', 'the recommendation must show lifecycle and downstream operational impact'], evidence: ['milestone, contractor, and change records', 'asset, outage, maintenance, and reliability data', 'cost, permit, safety, and environmental evidence'] },
  { id: 'mobility-logistics', match: /Logistics|Courier|Aviation|Rail|Shipping|Travel/i, workflows: ['booking, routing, shipment, and delivery', 'capacity, network, and disruption management', 'delay, cancellation, claim, and customer recovery'], events: ['volume shifted unexpectedly and one route or customer segment is missing its commitment', 'a delayed booking or shipment has received conflicting status updates', 'an expedited recovery improves service but materially increases cost or compliance exposure'], constraints: ['network capacity, safety, cut-off times, documentation, and compensation authority apply', 'status and recovery promises must match confirmed operational evidence'], evidence: ['booking, scan, route, and delivery events', 'capacity, delay, exception, and claims data', 'customer contacts and service commitments'] },
  { id: 'media-attention', match: /Advertising|Media|Entertainment|Gaming|Telecom/i, workflows: ['audience acquisition, content, and campaign delivery', 'subscription, usage, and customer support', 'publication, moderation, and reputation response'], events: ['reach or usage increased while complaints, opt-outs, or negative sentiment rose in one segment', 'a material claim or content decision is under review before publication', 'one channel produces attention but weak downstream completion or retained value'], constraints: ['claims, consent, brand safety, moderation, and publication approval must be respected', 'reach alone cannot be treated as a successful customer or commercial outcome'], evidence: ['channel, audience, and conversion data', 'content, moderation, complaint, and opt-out records', 'approval and claim-support evidence'] },
  { id: 'professional-services', match: /Consulting|Accounting \/ Audit|Legal Services|Recruitment|BPO/i, workflows: ['client scoping, evidence collection, and delivery', 'professional review, approval, and quality control', 'case, candidate, or service handoff'], events: ['a client deliverable is due but one material limitation is unresolved', 'the client requests wording or treatment that the available evidence does not support', 'teams hold inconsistent versions of the scope, evidence, or approval record'], constraints: ['professional standards, confidentiality, scope, evidence, and reviewer authority apply', 'limitations must be disclosed rather than removed to protect the deadline'], evidence: ['engagement scope and working papers', 'client communications and approval history', 'quality-review, case, or delivery records'] },
  { id: 'education', match: /Higher Education|K-12|EdTech|Vocational/i, workflows: ['learner enquiry, admission, and enrolment', 'learning access, assessment, and academic support', 'placement, outcome, refund, and learner-service follow-up'], events: ['a learner received conflicting guidance about access, eligibility, outcome, or refund', 'participation is high but completion or demonstrated learning fell for one group', 'a learner-facing claim promises more than the approved evidence supports'], constraints: ['learner welfare, accessibility, academic integrity, privacy, and truthful outcome claims apply, and no guaranteed outcome may be invented', 'no guaranteed outcome for admission, placement, learning, or refund may be invented'], evidence: ['enrolment, attendance, assessment, and support records', 'learner contacts, access events, and feedback', 'approved policy, claim, and outcome evidence'] },
  { id: 'hospitality', match: /Hotel|Restaurant|Hospitality|Sports/i, workflows: ['reservation, arrival, and guest or member service', 'capacity, staffing, inventory, and peak-period delivery', 'complaint, cancellation, and service recovery'], events: ['peak demand exceeds confirmed capacity and service failures are concentrated in one period', 'a guest or member has repeated an unresolved request across two channels', 'a revenue-protection action would create an avoidable fairness or trust problem'], constraints: ['availability, food or facility safety, service policy, fairness, and compensation authority apply', 'the response must protect the immediate guest without inventing capacity'], evidence: ['reservation, order, attendance, and service records', 'capacity, staffing, complaint, and recovery logs', 'revenue, cancellation, and satisfaction data'] },
  { id: 'public-impact', match: /Government|NGO/i, workflows: ['citizen or beneficiary access and case handling', 'program delivery, procurement, and partner coordination', 'outcome reporting and public accountability'], events: ['pressure to show rapid results could exclude a high-need group', 'a beneficiary case is delayed because ownership and evidence are split across partners', 'reported activity is rising but the intended public outcome is not yet demonstrated'], constraints: ['fairness, accessibility, procurement, safeguarding, evidence, and public accountability apply', 'speed or visibility cannot replace eligibility and outcome evidence'], evidence: ['case and beneficiary records', 'program, procurement, partner, and referral logs', 'activity, reach, outcome, and equity measures'] },
]

function industrySituation(industry: IndustryLike, role: RoleLike, seed: string): IndustrySituation {
  const pack = industryPacks.find((candidate) => candidate.match.test(industry.name))
  if (!pack) {
    const fallback = industry.contexts.length ? industry.contexts : [industry.focus]
    return {
      id: 'industry-specific-fallback',
      workflow: fallback[stableIndex(`${seed}-workflow`, fallback.length)],
      event: `performance in ${fallback[stableIndex(`${seed}-event`, fallback.length)]} differs materially between two operating segments`,
      operatingConstraint: `the response must stay within the documented ${industry.name} process and approval limits`,
      evidenceSource: `the relevant ${industry.name} operating, customer, and outcome records`,
    }
  }
  const selected = {
    id: pack.id,
    workflow: pack.workflows[stableIndex(`${seed}-workflow`, pack.workflows.length)],
    event: pack.events[stableIndex(`${seed}-event`, pack.events.length)],
    operatingConstraint: pack.constraints[stableIndex(`${seed}-constraint`, pack.constraints.length)],
    evidenceSource: pack.evidence[stableIndex(`${seed}-evidence`, pack.evidence.length)],
  }
  const family = roleFamily(role.name)
  if (family === 'people') return { ...selected, workflow: `workforce supporting ${selected.workflow}`, event: `vacancy, candidate flow, or employee outcomes are below plan for a team supporting ${selected.workflow}`, evidenceSource: `candidate, employee, and workforce records linked to the requirements of ${selected.workflow}`, operatingConstraint: `role eligibility, privacy, fairness, and delegated approval requirements must be followed for work supporting ${selected.workflow}` }
  if (family === 'technology') return { ...selected, workflow: `technology supporting ${selected.workflow}`, event: `a system or product change supporting ${selected.workflow} improved one measure but increased incidents, failures, or user effort in one segment`, evidenceSource: `incident, change, user, and service records for ${selected.workflow}`, operatingConstraint: `security, reliability, change control, and continuity requirements for ${selected.workflow} must remain explicit` }
  if (family === 'service') return { ...selected, event: `customers using ${selected.workflow} are experiencing repeat contact, inconsistent status, or an unresolved handoff`, evidenceSource: `customer contacts, case history, and operating records for ${selected.workflow}` }
  if (family === 'commercial') return { ...selected, event: `demand for ${selected.workflow} increased while conversion, retained value, or customer quality fell in one segment`, evidenceSource: `customer, channel, conversion, and outcome records for ${selected.workflow}` }
  if (family === 'analytical') return { ...selected, event: `two reports about ${selected.workflow} disagree and one segment may explain most of the movement`, evidenceSource: `source transactions, definitions, and reconciliations for ${selected.workflow}`, operatingConstraint: `metric definitions, data lineage, confidentiality, and decision approvals for ${selected.workflow} must be preserved` }
  if (family === 'communications') return { ...selected, event: `stakeholders need an update about ${selected.workflow}, but one material fact or claim is still being validated`, evidenceSource: `approved facts, audience response, and channel records for ${selected.workflow}`, operatingConstraint: `claims, confidentiality, channel ownership, and approval status for ${selected.workflow} must remain clear` }
  if (family === 'governance') return { ...selected, event: `an action affecting ${selected.workflow} is ready to proceed but a material requirement, control, or approval is incomplete`, evidenceSource: `the requirement, control evidence, exception, and approval record for ${selected.workflow}` }
  if (family === 'coordination') return { ...selected, event: `a dependency or handoff in ${selected.workflow} has no confirmed owner and threatens the next commitment`, evidenceSource: `the delivery plan, action log, dependency record, and current status for ${selected.workflow}` }
  if (family === 'advisory') return { ...selected, event: `the sponsor must decide how to improve ${selected.workflow}, but the baseline and one critical assumption remain unresolved`, evidenceSource: `the baseline, stakeholder evidence, options, and constraints for ${selected.workflow}` }
  return selected
}

const workProducts: Record<DesignFormat, WorkProduct> = {
  audio: { id: 'spoken-work-sample', name: 'the actual spoken interaction or decision update', instruction: 'Record the words you would actually deliver to the named audience.' },
  excel: { id: 'auditable-workbook', name: 'an auditable workbook and short decision note', instruction: 'Show formulas or pivot logic, checks, assumptions, and the finding supported by the data.' },
  written_communication: { id: 'finished-communication', name: 'the finished audience-ready email or message', instruction: 'Submit the communication itself with its subject or opening, evidence, request, owner, and timing.' },
  situational: { id: 'operational-artifact', name: 'the operational decision and system record', instruction: 'Give the immediate decision, the exact first action, the record or handoff created, and the closure condition.' },
  simulation: { id: 'integrated-work-sample', name: 'an integrated job simulation output', instruction: 'Produce the linked artifacts needed to take the case from initial evidence through decision, action, and measurable follow-through.' },
}

export function composeQuestionDesign(role: RoleLike, industry: IndustryLike, level: string, competency: string, format: DesignFormat, seed: string): QuestionDesign {
  return {
    roleTask: roleTask(role, competency, seed),
    industrySituation: industrySituation(industry, role, `${role.code}-${competency}-${seed}`),
    workProduct: workProducts[format],
    authority: authorityForLevel(level),
  }
}

export function designTags(design: QuestionDesign, level: string) {
  return [
    `task-${design.roleTask.id}`,
    `industry-situation-${design.industrySituation.id}`,
    `work-product-${design.workProduct.id}`,
    `authority-${designBand(level)}`,
  ]
}

function normalizedTokens(value: string) {
  const ignored = new Set(['the', 'and', 'that', 'this', 'with', 'from', 'your', 'into', 'before', 'after', 'would', 'should', 'could', 'must', 'have', 'what', 'when', 'where', 'using', 'role', 'industry'])
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((word) => word.length > 3 && !ignored.has(word)))
}

function similarity(left: string, right: string) {
  const a = normalizedTokens(left)
  const b = normalizedTokens(right)
  const intersection = [...a].filter((token) => b.has(token)).length
  const union = new Set([...a, ...b]).size
  return union ? intersection / union : 0
}

export function validateQuestionDesign(questions: DesignedQuestionLike[], role: RoleLike, industry: IndustryLike, level: string): DesignIssue[] {
  const issues: DesignIssue[] = []
  const band = designBand(level)
  for (const question of questions) {
    const text = `${question.scenario ?? ''} ${question.task ?? ''}`
    for (const prefix of ['task-', 'industry-situation-', 'work-product-', 'authority-']) {
      if (!question.tags.some((tag) => tag.startsWith(prefix))) issues.push({ questionId: question.id, code: 'missing-design-tag', message: `${question.id} is missing ${prefix} design metadata.` })
    }
    const hasStructuredIndustryContext = question.tags.some((tag) => tag.startsWith('industry-situation-') && tag !== 'industry-situation-industry-specific-fallback')
    if (!question.scenario?.includes(industry.name) && !hasStructuredIndustryContext) {
      issues.push({ questionId: question.id, code: 'generic-context', message: `${question.id} does not identify the ${industry.name} operating context.` })
    }
    if (!question.task || !/(record|write|draft|submit|produce|create|calculate|analy[sz]e|build|complete|handle|make|give|prepare|use|recommend|state|explain|identify|prioritize|present|assess|define|frame)/i.test(question.task)) {
      issues.push({ questionId: question.id, code: 'missing-output', message: `${question.id} does not request an observable work product.` })
    }
    if (band === 'entry' && /(set enterprise strategy|allocate cross-functional resources|approve policy|assign accountable owners|establish governance|make the final approval)/i.test(text)) {
      issues.push({ questionId: question.id, code: 'authority-mismatch', message: `${question.id} gives an entry-level candidate management or governance authority.` })
    }
    if (band === 'senior' && /(only report the facts|wait for your supervisor to decide|do not recommend)/i.test(text)) {
      issues.push({ questionId: question.id, code: 'authority-mismatch', message: `${question.id} does not provide senior-level decision scope.` })
    }
  }
  for (let left = 0; left < questions.length; left += 1) {
    for (let right = left + 1; right < questions.length; right += 1) {
      const a = questions[left]
      const b = questions[right]
      if (a.dimension === b.dimension && similarity(`${a.scenario} ${a.task}`, `${b.scenario} ${b.task}`) >= 0.84) {
        issues.push({ questionId: `${a.id},${b.id}`, code: 'duplicate-work-sample', message: `${a.id} and ${b.id} are too similar to test distinct evidence.` })
      }
    }
  }
  return issues
}
