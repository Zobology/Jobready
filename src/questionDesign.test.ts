import assert from 'node:assert/strict'
import test from 'node:test'
import { composeQuestionDesign, designTags, validateQuestionDesign, type DesignedQuestionLike } from './questionDesign'

const role = { code: 'R001', name: 'Customer Experience', description: 'Resolve customer problems.' }
const industry = { code: 'I001', name: 'E-commerce', focus: 'online retail', contexts: ['orders', 'delivery', 'returns'] }

test('composes job evidence from role, industry, level, and response format', () => {
  const design = composeQuestionDesign(role, industry, 'Entry level', 'Service recovery', 'audio', 'sample')

  assert.match(design.roleTask.activity, /customer|service/i)
  assert.match(design.industrySituation.workflow, /order|delivery|return|payment|fulfilment|inventory|campaign/i)
  assert.match(design.authority.decisionBoundary, /does not set policy/i)
  assert.equal(design.workProduct.id, 'spoken-work-sample')
  assert.deepEqual(designTags(design, 'Entry level').map((tag) => tag.split('-')[0]), ['task', 'industry', 'work', 'authority'])
})

test('rejects entry-level management authority and near-duplicate work samples', () => {
  const baseTags = ['task-service-recovery', 'industry-situation-consumer-commerce', 'work-product-operational-artifact', 'authority-entry']
  const questions: DesignedQuestionLike[] = [
    {
      id: 'one', dimension: 'role', competency: 'Service recovery', format: 'situational', tags: baseTags,
      scenario: 'In E-commerce, a customer has contacted the team three times about an unresolved delivery and needs an update today.',
      task: 'Produce the recovery record, assign accountable owners across teams, and make the final approval for compensation.',
    },
    {
      id: 'two', dimension: 'role', competency: 'Escalation', format: 'situational', tags: baseTags,
      scenario: 'In E-commerce, a customer has contacted the team three times about an unresolved delivery and needs an update today.',
      task: 'Produce the recovery record, assign accountable owners across teams, and make the final approval for compensation.',
    },
  ]
  const issues = validateQuestionDesign(questions, role, industry, 'Entry level')

  assert.ok(issues.some((issue) => issue.code === 'authority-mismatch'))
  assert.ok(issues.some((issue) => issue.code === 'duplicate-work-sample'))
})
