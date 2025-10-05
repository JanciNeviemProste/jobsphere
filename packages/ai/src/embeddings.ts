/**
 * Embeddings Provider Interface
 * Podporuje viacero embedding modelov (OpenAI, Cohere, Anthropic)
 */

import type { EmbeddingProvider } from './types'

/**
 * Voyage AI Embeddings (multilingual, optimized for code + CV)
 * https://docs.voyageai.com/
 */
export class VoyageEmbeddings implements EmbeddingProvider {
  name = 'voyage'
  private apiKey: string
  private model: string

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey
    this.model = config.model || 'voyage-multilingual-2' // Multilingual support
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: [text],
        model: this.model,
      }),
    })

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.statusText}`)
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Voyage podporuje až 128 inputov naraz
    const batchSize = 128
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)

      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: batch,
          model: this.model,
        }),
      })

      if (!response.ok) {
        throw new Error(`Voyage API error: ${response.statusText}`)
      }

      const data = (await response.json()) as { data: Array<{ embedding: number[] }> }
      results.push(...data.data.map((d) => d.embedding))
    }

    return results
  }
}

/**
 * OpenAI Embeddings (text-embedding-3-small/large)
 */
export class OpenAIEmbeddings implements EmbeddingProvider {
  name = 'openai'
  private apiKey: string
  private model: string

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey
    this.model = config.model || 'text-embedding-3-small' // 1536 dim, lacnejší
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> }
    return data.data.map((d) => d.embedding)
  }
}

/**
 * Cohere Embeddings (multilingual, embed-multilingual-v3.0)
 */
export class CohereEmbeddings implements EmbeddingProvider {
  name = 'cohere'
  private apiKey: string
  private model: string

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey
    this.model = config.model || 'embed-multilingual-v3.0'
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        texts: [text],
        model: this.model,
        input_type: 'search_document',
      }),
    })

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`)
    }

    const data = (await response.json()) as { embeddings: number[][] }
    return data.embeddings[0]
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        texts,
        model: this.model,
        input_type: 'search_document',
      }),
    })

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`)
    }

    const data = (await response.json()) as { embeddings: number[][] }
    return data.embeddings
  }
}

/**
 * Factory funkcia na vyber embedding providera
 */
export function createEmbeddingProvider(
  provider: 'voyage' | 'openai' | 'cohere',
  config: { apiKey: string; model?: string }
): EmbeddingProvider {
  switch (provider) {
    case 'voyage':
      return new VoyageEmbeddings(config)
    case 'openai':
      return new OpenAIEmbeddings(config)
    case 'cohere':
      return new CohereEmbeddings(config)
    default:
      throw new Error(`Unknown embedding provider: ${provider}`)
  }
}

/**
 * Helper: Generuje embedding pre CV
 */
export async function embedCvSection(
  text: string,
  provider: EmbeddingProvider
): Promise<number[]> {
  // Normalizuj text (remove extra spaces, lowercase)
  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase()

  if (normalized.length === 0) {
    throw new Error('Cannot embed empty text')
  }

  return provider.embed(normalized)
}

/**
 * Helper: Batch embedding pre viacero CV sekcií
 */
export async function embedCvBatch(
  texts: string[],
  provider: EmbeddingProvider
): Promise<number[][]> {
  const normalized = texts.map((t) =>
    t.trim().replace(/\s+/g, ' ').toLowerCase()
  )

  return provider.embedBatch(normalized)
}
