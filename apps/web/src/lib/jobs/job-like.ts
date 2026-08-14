/**
 * The part of a BullMQ `Job` that our processors actually touch.
 *
 * Every processor in `src/workers/` reads exactly three things off the job:
 * `data` (the payload), and `id`/`name` for logging. Nothing else. Typing them
 * against this instead of `Job<T>` means the same function can be driven by a
 * BullMQ worker *or* called directly — which is what the Vercel cron routes do,
 * since serverless has nowhere to keep a long-lived worker process alive.
 *
 * `Job<T>` satisfies this structurally, so the existing `new Worker(...)` wiring
 * keeps type-checking with no change at the call site. That is the whole point:
 * the queue path and the cron path run the *same* code, so a fix to one is a fix
 * to both, and neither can quietly drift into being the untested one.
 */
export interface JobLike<T = unknown> {
  /** Present on real queue jobs; absent when invoked inline. Logging only. */
  id?: string
  name: string
  data: T
}

/**
 * Wrap a payload so a queue processor can be called directly.
 *
 * The `name` matters: dispatchers branch on it (e.g. `'daily-scan'` vs
 * `'send-reminder'`), so passing the wrong one silently routes to the wrong
 * handler.
 */
export function inlineJob<T>(name: string, data: T): JobLike<T> {
  return { name, data }
}
