/**
 * Assessment Grading using AI
 */

import Anthropic from '@anthropic-ai/sdk'

export async function gradeAssessmentAnswer(
  question: string,
  answer: string,
  rubric: string | null,
  maxScore: number,
): Promise<{ score: number; rationale: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { score: 0, rationale: 'No API key configured' }
  }

  const anthropic = new Anthropic({ apiKey })

  const prompt = `Grade this assessment answer.

Question: ${question}
Answer: ${answer}
${rubric ? `Rubric: ${rubric}` : ''}
Max Score: ${maxScore}

Return ONLY valid JSON:
{
  "score": <0 to ${maxScore}>,
  "rationale": "brief explanation"
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return { score: 0, rationale: 'Unexpected response format' }
  }

  try {
    const result = JSON.parse(content.text)
    return {
      score: Math.min(maxScore, Math.max(0, result.score)),
      rationale: result.rationale || 'No rationale provided',
    }
  } catch {
    return { score: 0, rationale: 'Failed to parse AI response' }
  }
}
