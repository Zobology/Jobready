export type ReviewProvider = 'anthropic' | 'openai'

export interface ReviewProviderConfig {
  provider: ReviewProvider
  model: string
  modelId: string
  apiKey?: string
}

export function primaryReviewProvider(): ReviewProvider {
  return process.env.AI_PRIMARY_PROVIDER === 'openai' ? 'openai' : 'anthropic'
}

export function reviewProviderConfigs(): ReviewProviderConfig[] {
  const providers: Record<ReviewProvider, ReviewProviderConfig> = {
    anthropic: {
      provider: 'anthropic',
      model: process.env.ANTHROPIC_REVIEW_MODEL ?? 'claude-opus-5',
      modelId: `anthropic/${process.env.ANTHROPIC_REVIEW_MODEL ?? 'claude-opus-5'}`,
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    openai: {
      provider: 'openai',
      model: process.env.OPENAI_REVIEW_MODEL ?? 'gpt-5.6-sol',
      modelId: `openai/${process.env.OPENAI_REVIEW_MODEL ?? 'gpt-5.6-sol'}`,
      apiKey: process.env.OPENAI_API_KEY,
    },
  }
  const primary = primaryReviewProvider()
  const fallback: ReviewProvider = primary === 'anthropic' ? 'openai' : 'anthropic'
  return [providers[primary], providers[fallback]]
}

export function activeAiModel() {
  return reviewProviderConfigs()[0].modelId
}

export async function runReviewProviderFallback<T>(
  providers: ReviewProviderConfig[],
  request: (provider: ReviewProviderConfig) => Promise<T>,
) {
  const configuredProviders = providers.filter((provider) => provider.apiKey)
  if (!configuredProviders.length) {
    throw Object.assign(new Error('Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is configured'), { unavailable: true })
  }
  const failedProviders: string[] = []
  const providerErrors: string[] = []
  for (const provider of configuredProviders) {
    try {
      return { provider, result: await request(provider), failedProviders, providerErrors }
    } catch (error) {
      failedProviders.push(provider.modelId)
      providerErrors.push(`${provider.modelId}: ${(error as Error).message}`)
    }
  }
  throw new Error(`All configured AI review providers failed. ${providerErrors.join(' | ')}`)
}
