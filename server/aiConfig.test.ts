import assert from 'node:assert/strict'
import test from 'node:test'
import { runReviewProviderFallback, type ReviewProviderConfig } from './aiConfig.js'

const claude: ReviewProviderConfig = { provider: 'anthropic', model: 'claude-test', modelId: 'anthropic/claude-test', apiKey: 'test' }
const openAi: ReviewProviderConfig = { provider: 'openai', model: 'gpt-test', modelId: 'openai/gpt-test', apiKey: 'test' }

test('uses the primary provider without calling the fallback', async () => {
  const called: string[] = []
  const result = await runReviewProviderFallback([claude, openAi], async (provider) => {
    called.push(provider.provider)
    return 'primary-result'
  })
  assert.equal(result.provider.provider, 'anthropic')
  assert.equal(result.result, 'primary-result')
  assert.deepEqual(result.failedProviders, [])
  assert.deepEqual(called, ['anthropic'])
})

test('falls back to OpenAI when Claude fails', async () => {
  const called: string[] = []
  const result = await runReviewProviderFallback([claude, openAi], async (provider) => {
    called.push(provider.provider)
    if (provider.provider === 'anthropic') throw new Error('Claude unavailable')
    return 'fallback-result'
  })
  assert.equal(result.provider.provider, 'openai')
  assert.equal(result.result, 'fallback-result')
  assert.deepEqual(result.failedProviders, ['anthropic/claude-test'])
  assert.deepEqual(called, ['anthropic', 'openai'])
})

test('reports a combined error when every configured provider fails', async () => {
  await assert.rejects(
    runReviewProviderFallback([claude, openAi], async (provider) => {
      throw new Error(`${provider.provider} unavailable`)
    }),
    /anthropic\/claude-test.*openai\/gpt-test/,
  )
})
