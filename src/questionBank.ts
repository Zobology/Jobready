import { masterCoreCompetencies, masterIndustries, masterRoles } from './masterMatrix'

export type BankDimension = 'core' | 'role' | 'industry' | 'role_industry'
export type AssessmentMode = 'knowledge' | 'application' | 'subjective' | 'audio' | 'simulation'
export type ResponseType = 'written' | 'audio'
export type ProficiencyLevel = 'foundation' | 'developing' | 'job_ready' | 'advanced'
export type DiagnosticTag =
  | 'knowledge_gap'
  | 'skill_gap'
  | 'application_gap'
  | 'communication_gap'
  | 'industry_exposure_gap'

export interface QuestionBankItem {
  id: string
  dimension: BankDimension
  competency: string
  roleId?: string
  role?: string
  industryId?: string
  industry?: string
  proficiency: ProficiencyLevel
  assessmentModes: AssessmentMode[]
  responseType: ResponseType
  prompt: string
  guidance: string
  rubric: string[]
  diagnosticTags: DiagnosticTag[]
  sourceTab: string
  tags: string[]
  followUp?: {
    responseType: ResponseType
    prompt: string
  }
}

const corePrompts: Record<string, Array<Pick<QuestionBankItem, 'assessmentModes' | 'responseType' | 'prompt' | 'guidance' | 'rubric' | 'diagnosticTags'>>> = {
  Communication: [
    {
      assessmentModes: ['application', 'audio'], responseType: 'audio',
      prompt: 'A key weekly report will be delayed because two data sources are incomplete. Record an update to your manager explaining the situation and what should happen next.',
      guidance: 'Speak for 45–90 seconds. Address the impact, action, ownership, and expected timeline.',
      rubric: ['Clarity and articulation', 'Logical structure', 'Conciseness', 'Ownership and next steps'],
      diagnosticTags: ['communication_gap', 'application_gap'],
    },
    {
      assessmentModes: ['application', 'subjective'], responseType: 'written',
      prompt: 'A cross-functional stakeholder has misunderstood your recommendation and is about to act on incomplete information. Draft a short message that corrects the misunderstanding without damaging the relationship.',
      guidance: 'Write 80–120 words in a professional workplace tone.',
      rubric: ['Purpose and audience', 'Clarity', 'Tone and empathy', 'Call to action'],
      diagnosticTags: ['communication_gap', 'skill_gap'],
    },
  ],
  'Problem Solving': [
    {
      assessmentModes: ['knowledge', 'subjective'], responseType: 'written',
      prompt: 'Explain the difference between a symptom and a root cause. Describe how acting on the wrong one affects a workplace decision.',
      guidance: 'Use a brief example and explain the consequence.',
      rubric: ['Conceptual accuracy', 'Example quality', 'Cause-and-effect reasoning'],
      diagnosticTags: ['knowledge_gap', 'skill_gap'],
    },
    {
      assessmentModes: ['application', 'subjective'], responseType: 'written',
      prompt: 'A recurring process issue is affecting your team. Explain how you would diagnose the cause, decide what to fix, and verify that the solution worked.',
      guidance: 'Write 80–150 words and make your reasoning sequence explicit.',
      rubric: ['Problem framing', 'Root-cause logic', 'Decision quality', 'Validation approach'],
      diagnosticTags: ['application_gap', 'skill_gap'],
    },
  ],
  'Analytical Thinking': [
    {
      assessmentModes: ['knowledge', 'subjective'], responseType: 'written',
      prompt: 'A performance metric improved immediately after a new initiative launched. Explain why this alone does not prove the initiative caused the improvement.',
      guidance: 'Identify alternative explanations and the evidence needed.',
      rubric: ['Evidence awareness', 'Alternative hypotheses', 'Causal reasoning'],
      diagnosticTags: ['knowledge_gap', 'skill_gap'],
    },
    {
      assessmentModes: ['application', 'subjective'], responseType: 'written',
      prompt: 'A metric improved overall but declined for one customer segment. Explain how you would investigate the pattern and decide whether action is required.',
      guidance: 'State the comparisons, checks, and decision criteria you would use.',
      rubric: ['Segmentation logic', 'Evidence quality', 'Pattern interpretation', 'Decision criteria'],
      diagnosticTags: ['application_gap', 'skill_gap'],
    },
  ],
  'Numerical Ability': [
    {
      assessmentModes: ['knowledge', 'subjective'], responseType: 'written',
      prompt: 'A conversion rate moves from 20% to 24%. Explain the difference between percentage increase and percentage-point increase, and calculate both.',
      guidance: 'Show your calculation and interpretation.',
      rubric: ['Calculation accuracy', 'Conceptual distinction', 'Interpretation'],
      diagnosticTags: ['knowledge_gap', 'skill_gap'],
    },
    {
      assessmentModes: ['application', 'subjective'], responseType: 'written',
      prompt: 'A team completes 240 cases per week. Demand rises by 15% while capacity stays unchanged. Calculate the gap and explain what information you need before recommending action.',
      guidance: 'Show the calculation and explain the operational implication.',
      rubric: ['Calculation accuracy', 'Interpretation', 'Relevant assumptions', 'Recommendation'],
      diagnosticTags: ['application_gap', 'skill_gap'],
    },
  ],
  'Digital Fluency': [
    {
      assessmentModes: ['knowledge', 'subjective'], responseType: 'written',
      prompt: 'A team tracks the same work across email, spreadsheets, and chat. Explain the risks this creates and the principles you would use to design a better digital workflow.',
      guidance: 'Focus on information quality, ownership, collaboration, and security.',
      rubric: ['Digital-workplace understanding', 'Risk awareness', 'Workflow principles'],
      diagnosticTags: ['knowledge_gap', 'skill_gap'],
    },
    {
      assessmentModes: ['application', 'subjective'], responseType: 'written',
      prompt: 'You receive a spreadsheet containing duplicated records, inconsistent dates, and missing values. Describe how you would make it reliable before using it for a business decision.',
      guidance: 'Explain the checks, tools, and validation steps you would use.',
      rubric: ['Tool selection', 'Data hygiene', 'Validation', 'Responsible use'],
      diagnosticTags: ['application_gap', 'skill_gap'],
    },
  ],
  'Business Acumen': [
    {
      assessmentModes: ['knowledge', 'subjective'], responseType: 'written',
      prompt: 'Revenue grew this quarter, but profit declined. Explain at least three business reasons why both statements can be true.',
      guidance: 'Connect revenue, cost, customer, and commercial drivers.',
      rubric: ['Business-model understanding', 'Driver identification', 'Commercial reasoning'],
      diagnosticTags: ['knowledge_gap', 'skill_gap'],
    },
    {
      assessmentModes: ['application', 'subjective'], responseType: 'written',
      prompt: 'A business can improve customer satisfaction through a costly service enhancement. Explain how you would decide whether the investment creates business value.',
      guidance: 'Identify customer, revenue, cost, risk, and measurement considerations.',
      rubric: ['Value-driver logic', 'Trade-off judgement', 'Customer perspective', 'Measurement'],
      diagnosticTags: ['application_gap', 'skill_gap'],
    },
  ],
  'Professional Effectiveness': [
    {
      assessmentModes: ['knowledge', 'subjective'], responseType: 'written',
      prompt: 'You receive two urgent requests from different managers that cannot both be completed on time. Explain the professional principles that should guide your response.',
      guidance: 'Address prioritization, transparency, ownership, and stakeholder alignment.',
      rubric: ['Prioritization principles', 'Ownership', 'Stakeholder awareness'],
      diagnosticTags: ['knowledge_gap', 'skill_gap'],
    },
    {
      assessmentModes: ['application', 'audio'], responseType: 'audio',
      prompt: 'A deliverable you own is at risk because a dependency was missed. Record how you would raise the issue with the project lead and propose a recovery plan.',
      guidance: 'Speak for 45–90 seconds and demonstrate accountability without assigning blame.',
      rubric: ['Ownership', 'Prioritization', 'Collaboration', 'Recovery planning'],
      diagnosticTags: ['application_gap', 'communication_gap'],
    },
  ],
  'Adaptability & Learning Agility': [
    {
      assessmentModes: ['knowledge', 'subjective'], responseType: 'written',
      prompt: 'Explain what learning agility looks like in the workplace and how it differs from simply attending training.',
      guidance: 'Use an example involving unfamiliar work or changing requirements.',
      rubric: ['Conceptual understanding', 'Workplace relevance', 'Example quality'],
      diagnosticTags: ['knowledge_gap', 'skill_gap'],
    },
    {
      assessmentModes: ['application', 'subjective'], responseType: 'written',
      prompt: 'You are assigned a task using an unfamiliar tool and the requirements are still changing. Explain how you would make progress without creating avoidable risk.',
      guidance: 'Describe how you would learn, test, seek feedback, and adapt.',
      rubric: ['Learning approach', 'Ambiguity management', 'Feedback use', 'Risk awareness'],
      diagnosticTags: ['application_gap', 'skill_gap'],
    },
  ],
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function roleCode(id: number) {
  return `R${String(id).padStart(3, '0')}`
}

function industryCode(id: number) {
  return `I${String(id).padStart(3, '0')}`
}

export const coreQuestionBank: QuestionBankItem[] = masterCoreCompetencies.flatMap((competency, competencyIndex) =>
  corePrompts[competency].map((item, itemIndex) => ({
    id: `C${String(competencyIndex + 1).padStart(2, '0')}-${itemIndex + 1}`,
    dimension: 'core' as const,
    competency,
    proficiency: itemIndex === 0 ? 'foundation' as const : 'job_ready' as const,
    ...item,
    sourceTab: 'Core Competencies',
    tags: ['universal', slug(competency), ...item.assessmentModes],
  })),
)

export const roleQuestionBank: QuestionBankItem[] = masterRoles.flatMap((role) =>
  role.competencies.flatMap((competency, competencyIndex) => {
    const base = `${roleCode(role.id)}-${String(competencyIndex + 1).padStart(2, '0')}`
    return [
      {
        id: `${base}-K`, dimension: 'role' as const, competency, roleId: roleCode(role.id), role: role.name,
        proficiency: 'foundation' as const, assessmentModes: ['knowledge', 'subjective'] as AssessmentMode[], responseType: 'written' as const,
        prompt: `Explain the purpose of ${competency.toLowerCase()} in ${role.name}. What decision or outcome does it support, and what common mistake should a new professional avoid?`,
        guidance: 'Write 60–100 words and demonstrate functional understanding.',
        rubric: ['Conceptual accuracy', 'Role relevance', 'Decision linkage', 'Risk awareness'],
        diagnosticTags: ['knowledge_gap', 'skill_gap'] as DiagnosticTag[], sourceTab: 'Role Competencies',
        tags: ['role', roleCode(role.id), slug(role.name), slug(competency), 'knowledge'],
      },
      {
        id: `${base}-A`, dimension: 'role' as const, competency, roleId: roleCode(role.id), role: role.name,
        proficiency: 'job_ready' as const, assessmentModes: ['application', 'subjective'] as AssessmentMode[], responseType: 'written' as const,
        prompt: `${role.directive} Explain specifically how you would use ${competency.toLowerCase()}, which information you would require, and how you would measure the outcome.`,
        guidance: 'Write 100–160 words as a practical role work sample.',
        rubric: ['Functional application', 'Structured approach', 'Quality of judgement', 'Outcome measurement'],
        diagnosticTags: ['application_gap', 'skill_gap'] as DiagnosticTag[], sourceTab: 'Role Competencies',
        tags: ['role', roleCode(role.id), slug(role.name), slug(competency), 'application'],
      },
    ]
  }),
)

export const industryQuestionBank: QuestionBankItem[] = masterIndustries.flatMap((industry) =>
  industry.contexts.flatMap((context, contextIndex) => {
    const base = `${industryCode(industry.id)}-${String(contextIndex + 1).padStart(2, '0')}`
    return [
      {
        id: `${base}-K`, dimension: 'industry' as const, competency: context, industryId: industryCode(industry.id), industry: industry.name,
        proficiency: 'foundation' as const, assessmentModes: ['knowledge', 'subjective'] as AssessmentMode[], responseType: 'written' as const,
        prompt: `Explain why ${context.toLowerCase()} matters in ${industry.name}. Which business stakeholders, risks, or outcomes does it affect?`,
        guidance: 'Write 50–90 words. Industry terminology matters less than sound contextual understanding.',
        rubric: ['Industry awareness', 'Stakeholder understanding', 'Risk or outcome linkage'],
        diagnosticTags: ['knowledge_gap', 'industry_exposure_gap'] as DiagnosticTag[], sourceTab: 'Industry Competencies',
        tags: ['industry', industryCode(industry.id), slug(industry.name), slug(context), 'knowledge'],
      },
      {
        id: `${base}-A`, dimension: 'industry' as const, competency: context, industryId: industryCode(industry.id), industry: industry.name,
        proficiency: 'developing' as const, assessmentModes: ['application', 'subjective'] as AssessmentMode[], responseType: 'written' as const,
        prompt: `A ${industry.name} organization is investigating performance across ${industry.focus}. Which signals would you examine to understand ${context.toLowerCase()}, and how would they influence your recommendation?`,
        guidance: 'Write 70–120 words and connect industry context to a decision.',
        rubric: ['Relevant industry signals', 'Contextual reasoning', 'Decision linkage', 'Recommendation quality'],
        diagnosticTags: ['application_gap', 'industry_exposure_gap'] as DiagnosticTag[], sourceTab: 'Industry Competencies',
        tags: ['industry', industryCode(industry.id), slug(industry.name), slug(context), 'application'],
      },
    ]
  }),
)

export const simulationQuestionBank: QuestionBankItem[] = masterRoles.flatMap((role) =>
  masterIndustries.map((industry) => ({
    id: `${roleCode(role.id)}-${industryCode(industry.id)}-SIM-01`,
    dimension: 'role_industry' as const,
    competency: `${role.name} × ${industry.name}`,
    roleId: roleCode(role.id),
    role: role.name,
    industryId: industryCode(industry.id),
    industry: industry.name,
    proficiency: 'job_ready' as const,
    assessmentModes: ['application', 'subjective', 'simulation', 'audio'] as AssessmentMode[],
    responseType: 'written' as const,
    prompt: `You are supporting ${role.name} within the ${industry.name} sector. During the last quarter, the primary performance indicator fell 14%, exceptions increased 26%, and one segment now accounts for 46% of the gap. The issue involves ${industry.focus}. ${role.directive} Prioritize two or three actions, justify your recommendation, and define success KPIs.`,
    guidance: 'Write 180–280 words. State assumptions, diagnose the issue, prioritize action, and define measurable outcomes.',
    rubric: ['Problem diagnosis', 'Role capability', 'Industry application', 'Prioritization and judgement', 'KPI definition'],
    diagnosticTags: ['application_gap', 'skill_gap', 'communication_gap', 'industry_exposure_gap'] as DiagnosticTag[],
    sourceTab: 'Role x Industry Matrix',
    tags: ['role-industry', roleCode(role.id), industryCode(industry.id), slug(role.name), slug(industry.name), 'simulation', 'job-ready'],
    followUp: {
      responseType: 'audio' as const,
      prompt: 'Deliver a 60–90 second executive summary of your diagnosis, recommendation, and expected impact.',
    },
  })),
)

export const questionBank: QuestionBankItem[] = [
  ...coreQuestionBank,
  ...roleQuestionBank,
  ...industryQuestionBank,
  ...simulationQuestionBank,
]

export const questionBankStats = {
  core: coreQuestionBank.length,
  role: roleQuestionBank.length,
  industry: industryQuestionBank.length,
  roleIndustry: simulationQuestionBank.length,
  total: questionBank.length,
  roles: masterRoles.length,
  industries: masterIndustries.length,
}

export function getAssessmentBank(roleId: string, industryId: string) {
  return {
    core: coreQuestionBank,
    role: roleQuestionBank.filter((item) => item.roleId === roleId),
    industry: industryQuestionBank.filter((item) => item.industryId === industryId),
    simulation: simulationQuestionBank.find((item) => item.roleId === roleId && item.industryId === industryId),
  }
}
