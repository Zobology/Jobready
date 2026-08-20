import ExcelJS from 'exceljs'

type DataVariant = 'commercial' | 'operations' | 'people' | 'customer' | 'technology' | 'general'

interface DatasetContext {
  role: string
  industry: string
  level: string
  education: string
  experienceType: 'fresher' | 'experienced'
  variant: DataVariant
}

const regions = ['North', 'South', 'East', 'West']
const channels = ['Digital', 'Partner', 'Direct']

function seedFor(value: string) {
  return [...value].reduce((seed, character) => (seed * 31 + character.charCodeAt(0)) % 100_003, 7919)
}

function metric(seed: number, row: number, offset: number, minimum: number, spread: number) {
  return minimum + ((seed + row * (37 + offset * 11) + offset * 97) % spread)
}

function columnsFor(variant: DataVariant) {
  const common = [
    { header: 'Period', key: 'period', width: 14 },
    { header: 'Region', key: 'region', width: 13 },
    { header: 'Channel / Unit', key: 'channel', width: 18 },
  ]
  const variants = {
    commercial: [
      { header: 'Leads / Visits', key: 'demand', width: 16 }, { header: 'Orders / Conversions', key: 'completed', width: 20 },
      { header: 'Revenue (INR)', key: 'revenue', width: 17 }, { header: 'Cost (INR)', key: 'cost', width: 15 },
      { header: 'Returns / Cancellations', key: 'exceptions', width: 22 }, { header: 'Customer Score', key: 'score', width: 16 },
    ],
    operations: [
      { header: 'Demand Volume', key: 'demand', width: 16 }, { header: 'Completed Volume', key: 'completed', width: 18 },
      { header: 'Capacity', key: 'capacity', width: 13 }, { header: 'Operating Cost (INR)', key: 'cost', width: 21 },
      { header: 'Defects / SLA Breaches', key: 'exceptions', width: 22 }, { header: 'Turnaround Hours', key: 'turnaround', width: 18 },
    ],
    people: [
      { header: 'Headcount', key: 'demand', width: 13 }, { header: 'Applicants', key: 'completed', width: 13 },
      { header: 'Hires', key: 'capacity', width: 11 }, { header: 'People Cost (INR)', key: 'cost', width: 18 },
      { header: 'Exits', key: 'exceptions', width: 10 }, { header: 'Engagement Score', key: 'score', width: 18 },
    ],
    customer: [
      { header: 'Customer Contacts', key: 'demand', width: 18 }, { header: 'Resolved Contacts', key: 'completed', width: 18 },
      { header: 'Available Capacity', key: 'capacity', width: 18 }, { header: 'Service Cost (INR)', key: 'cost', width: 18 },
      { header: 'Escalations', key: 'exceptions', width: 13 }, { header: 'Customer Score', key: 'score', width: 16 },
    ],
    technology: [
      { header: 'Tickets / Requirements', key: 'demand', width: 22 }, { header: 'Completed Items', key: 'completed', width: 17 },
      { header: 'Team Capacity', key: 'capacity', width: 15 }, { header: 'Delivery Cost (INR)', key: 'cost', width: 19 },
      { header: 'Defects / Incidents', key: 'exceptions', width: 18 }, { header: 'Adoption / Quality Score', key: 'score', width: 23 },
    ],
    general: [
      { header: 'Demand / Requests', key: 'demand', width: 18 }, { header: 'Completed', key: 'completed', width: 13 },
      { header: 'Capacity', key: 'capacity', width: 13 }, { header: 'Cost (INR)', key: 'cost', width: 15 },
      { header: 'Exceptions', key: 'exceptions', width: 13 }, { header: 'Outcome Score', key: 'score', width: 15 },
    ],
  }
  return [...common, ...variants[variant]]
}

function rowCount(level: string) {
  if (/senior/i.test(level)) return 60
  if (/mid/i.test(level)) return 48
  if (/associate/i.test(level)) return 36
  return 24
}

function tasksFor(context: DatasetContext) {
  const base = [
    'Check the data for completeness and state any assumptions.',
    'Calculate at least three relevant KPIs using formulas, a pivot table, or another auditable method.',
    'Identify the two most important patterns or anomalies and support each with evidence.',
    'Recommend one action and define how its impact should be measured.',
  ]
  if (/mid|senior/i.test(context.level)) base.push('Compare segments, explain trade-offs, and identify a risk that could change your conclusion.')
  if (/senior/i.test(context.level)) base.push('Add an executive summary covering strategic implications, governance, and the decision you recommend.')
  if (/Master|MBA/i.test(context.education)) base.push('Connect the evidence to customer, revenue, cost, or stakeholder impact.')
  if (context.experienceType === 'experienced') base.push('State how you would validate the finding in a real workplace before implementation.')
  return base
}

function unitsFor(industry: string) {
  if (/e-?commerce/i.test(industry)) return ['Marketplace', 'Website', 'Mobile App']
  if (/BFSI|bank|financial/i.test(industry)) return ['Branch', 'Mobile Banking', 'Partner']
  if (/health/i.test(industry)) return ['Hospital', 'Clinic', 'Digital Care']
  if (/retail/i.test(industry)) return ['Store', 'Online', 'Distributor']
  if (/telecom/i.test(industry)) return ['Prepaid', 'Postpaid', 'Enterprise']
  if (/education|edtech/i.test(industry)) return ['Admissions', 'Learning App', 'Institution']
  if (/travel|hospitality/i.test(industry)) return ['Direct Booking', 'OTA', 'Corporate']
  return channels
}

export async function buildSampleWorkbook(context: DatasetContext) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Zobology'
  workbook.created = new Date('2026-01-01T00:00:00Z')
  const instructions = workbook.addWorksheet('Instructions', { views: [{ showGridLines: false }] })
  instructions.columns = [{ width: 4 }, { width: 105 }]
  instructions.mergeCells('B2:B3')
  instructions.getCell('B2').value = 'Zobology Core Data Understanding Exercise'
  instructions.getCell('B2').font = { bold: true, size: 18, color: { argb: 'FF123C32' } }
  instructions.getCell('B5').value = `Target profile: ${context.role} · ${context.industry} · ${context.level} · ${context.education}`
  instructions.getCell('B5').font = { bold: true, color: { argb: 'FF2E6657' } }
  instructions.getCell('B7').value = 'Complete the analysis in this workbook. Preserve the Raw Data sheet, show your calculations, and upload the completed .xlsx file with your written explanation in Zobology.'
  instructions.getCell('B7').alignment = { wrapText: true, vertical: 'top' }
  tasksFor(context).forEach((task, index) => {
    instructions.getCell(`B${9 + index}`).value = `${index + 1}. ${task}`
    instructions.getCell(`B${9 + index}`).alignment = { wrapText: true }
  })

  const raw = workbook.addWorksheet('Raw Data', { views: [{ state: 'frozen', ySplit: 1 }] })
  raw.columns = columnsFor(context.variant)
  const seed = seedFor(`${context.role}|${context.industry}|${context.level}`)
  const count = rowCount(context.level)
  const units = unitsFor(context.industry)
  for (let index = 0; index < count; index += 1) {
    const demand = metric(seed, index, 1, 85, 190)
    const completionRate = index === Math.floor(count * 0.58) ? 54 : 68 + metric(seed, index, 2, 0, 30)
    const completed = Math.round(demand * completionRate / 100)
    const exceptions = Math.max(1, Math.round((demand - completed) * (0.25 + (index % 4) * 0.08)))
    const monthIndex = Math.floor(index / 4)
    const year = 2026 + Math.floor(monthIndex / 12)
    const month = 1 + monthIndex % 12
    raw.addRow({
      period: `${year}-${String(month).padStart(2, '0')}`,
      region: regions[index % regions.length],
      channel: units[(index + Math.floor(index / 4)) % units.length],
      demand,
      completed,
      capacity: metric(seed, index, 3, 90, 210),
      revenue: completed * metric(seed, index, 4, 850, 1650),
      cost: Math.round(demand * metric(seed, index, 5, 260, 620) * (index % 17 === 9 ? 1.55 : 1)),
      exceptions,
      turnaround: Number((8 + metric(seed, index, 6, 0, 170) / 10).toFixed(1)),
      score: Number((3.1 + metric(seed, index, 7, 0, 18) / 10).toFixed(1)),
    })
  }
  raw.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  raw.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17624F' } }
  raw.autoFilter = { from: 'A1', to: raw.getCell(1, raw.columnCount).address }
  raw.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7F5' } }
  })

  const analysis = workbook.addWorksheet('Your Analysis', { views: [{ showGridLines: false }] })
  analysis.columns = [{ width: 4 }, { width: 30 }, { width: 75 }]
  analysis.getCell('B2').value = 'Candidate Analysis'
  analysis.getCell('B2').font = { bold: true, size: 16, color: { argb: 'FF123C32' } }
  ;['KPIs and calculations', 'Patterns and anomalies', 'Recommendation', 'Assumptions and limitations'].forEach((heading, index) => {
    const row = 5 + index * 5
    analysis.getCell(row, 2).value = heading
    analysis.getCell(row, 2).font = { bold: true, color: { argb: 'FF17624F' } }
    analysis.mergeCells(row, 3, row + 3, 3)
    analysis.getCell(row, 3).value = 'Enter your analysis here or add separate calculation sheets.'
    analysis.getCell(row, 3).alignment = { wrapText: true, vertical: 'top' }
    analysis.getCell(row, 3).border = { top: { style: 'thin', color: { argb: 'FFB9CCC5' } }, left: { style: 'thin', color: { argb: 'FFB9CCC5' } }, bottom: { style: 'thin', color: { argb: 'FFB9CCC5' } }, right: { style: 'thin', color: { argb: 'FFB9CCC5' } } }
  })

  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export type { DataVariant, DatasetContext }
