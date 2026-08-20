import mammoth from 'mammoth'
import pdf from 'pdf-parse'

const skillSignals = [
  'Excel', 'SQL', 'Python', 'Statistics', 'Data visualization', 'Power BI', 'Tableau',
  'Data interpretation', 'Data quality', 'Financial analysis', 'Financial modelling',
  'Accounting', 'Budgeting', 'Risk management', 'Project management', 'Stakeholder management',
  'Process management', 'KPI management', 'Root cause analysis', 'Capacity planning',
  'Quality management', 'Continuous improvement', 'Inventory', 'Forecasting', 'Logistics',
  'Procurement', 'Marketing analytics', 'Digital marketing', 'Campaign planning', 'Segmentation',
  'Sales', 'Prospecting', 'Negotiation', 'CRM', 'Customer journey', 'Customer experience',
  'Service recovery', 'Employee lifecycle', 'Talent management', 'HR analytics',
  'Communication', 'Problem solving', 'Analytical thinking', 'Business acumen',
  'Agile', 'SaaS', 'Cybersecurity', 'E-commerce', 'Retail', 'Healthcare', 'Telecom',
  'Manufacturing', 'FMCG', 'Supply chain', 'Consulting', 'Hospitality', 'EdTech',
] as const

const signalAliases: Partial<Record<(typeof skillSignals)[number], string[]>> = {
  'Data visualization': ['data visualisation'],
  'Financial modelling': ['financial modeling'],
  'Project management': ['project manager', 'project delivery'],
  'Root cause analysis': ['rca', 'root-cause'],
  'KPI management': ['kpi', 'key performance indicator'],
  'Customer experience': ['cx'],
  'Customer journey': ['journey mapping'],
  'Power BI': ['powerbi'],
  'Supply chain': ['supply-chain'],
}

export async function extractResumeSignals(file: Express.Multer.File) {
  let text: string
  if (file.mimetype === 'application/pdf') {
    text = (await pdf(file.buffer)).text
  } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    text = (await mammoth.extractRawText({ buffer: file.buffer })).value
  } else {
    throw Object.assign(new Error('Resume analysis supports PDF and DOCX files'), { status: 400 })
  }

  const normalized = text.toLowerCase().replace(/[^a-z0-9+#./-]+/g, ' ')
  if (normalized.trim().length < 40) {
    throw Object.assign(new Error('We could not read enough text from this resume. Please upload a text-based PDF or DOCX file.'), { status: 400 })
  }

  const signals = skillSignals.filter((signal) => {
    const terms = [signal.toLowerCase(), ...(signalAliases[signal] ?? [])]
    return terms.some((term) => normalized.includes(term))
  })

  return { signals: signals.slice(0, 20), textLength: normalized.length }
}
