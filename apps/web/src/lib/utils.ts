import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strip common Markdown markers from a string and collapse whitespace,
 * producing a plain-text preview. Optionally truncates to `maxLength`.
 * Used for job description previews on list/cards (not the detail page).
 */
export function stripMarkdown(input: string, maxLength = 150): string {
  if (!input) return ''

  const plain = input
    // fenced code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // inline code
    .replace(/`([^`]+)`/g, '$1')
    // images ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // links [text](url) -> text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // headings, blockquotes, list markers at line start
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    // bold / italic / strikethrough markers
    .replace(/(\*\*|__|\*|_|~~)/g, '')
    // horizontal rules
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, ' ')
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()

  if (plain.length <= maxLength) return plain
  return plain.slice(0, maxLength).trimEnd() + '…'
}
