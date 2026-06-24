/**
 * Vision OCR fallback for CV parsing.
 *
 * When the Node text parser (pdf-parse) extracts no usable text — e.g. a scanned
 * or image-only PDF exported by design tools — we ask a multimodal model (Gemini
 * via OpenRouter) to transcribe the document directly. This replaces the legacy
 * Python/Tesseract OCR service, which does not run in the Vercel serverless
 * environment. The transcribed text is then fed into the normal CV-parse step.
 */

import { logger } from './logger'

const OCR_PROMPT =
  'You are an OCR engine. Transcribe ALL text from this CV/résumé document VERBATIM ' +
  'and completely, preserving reading order and section structure (contact info, ' +
  'summary, work experience with companies/titles/dates, education, skills, languages). ' +
  'Output ONLY the transcribed text with no commentary. If the document contains no ' +
  'readable text at all, output exactly CANNOT_READ.'

export interface VisionOcrResult {
  success: boolean
  text?: string
  confidence?: number
  error?: string
}

/**
 * Extract text from a PDF or image buffer using a multimodal model.
 * Returns { success:false } on any failure so the caller can degrade gracefully.
 */
export async function visionExtractText(
  buffer: ArrayBuffer,
  mimeType: string,
  traceId: string,
): Promise<VisionOcrResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { success: false, error: 'OPENROUTER_API_KEY not configured' }
  }

  const isPdf = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')
  if (!isPdf && !isImage) {
    return { success: false, error: `unsupported mime for vision OCR: ${mimeType}` }
  }

  try {
    const dataUrl = `data:${mimeType};base64,${Buffer.from(buffer).toString('base64')}`

    // PDFs go through OpenRouter's file content part (+ native parser plugin); images
    // use the standard image_url part. Both are read directly by the multimodal model.
    const content = isPdf
      ? [
          { type: 'text', text: OCR_PROMPT },
          { type: 'file', file: { filename: 'cv.pdf', file_data: dataUrl } },
        ]
      : [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ]

    const body: Record<string, unknown> = {
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content }],
      max_tokens: 4096,
      temperature: 0,
    }
    if (isPdf) {
      body.plugins = [{ id: 'file-parser', pdf: { engine: 'native' } }]
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      logger.warn('Vision OCR HTTP error', {
        traceId,
        status: res.status,
        detail: errText.slice(0, 200),
      })
      return { success: false, error: `vision OCR HTTP ${res.status}` }
    }

    const json: any = await res.json()
    const text: string = (json?.choices?.[0]?.message?.content || '').trim()

    if (!text || text.length < 20 || /^CANNOT_READ\b/i.test(text)) {
      logger.info('Vision OCR returned no usable text', { traceId, length: text.length })
      return { success: false, error: 'no readable text' }
    }

    logger.info('Vision OCR succeeded', { traceId, extractedLength: text.length })
    return { success: true, text, confidence: 0.6 }
  } catch (error) {
    logger.error('Vision OCR exception', {
      traceId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'vision OCR exception' }
  }
}
