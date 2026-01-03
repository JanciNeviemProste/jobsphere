import { readFileSync } from 'fs'

/**
 * Lighthouse Report Analyzer
 *
 * Analyzes Lighthouse JSON reports and displays key metrics
 *
 * Usage:
 *   tsx scripts/analyze-lighthouse.ts lighthouse-reports/*.json
 */

interface Report {
  categories: {
    performance: { score: number }
    accessibility: { score: number }
    'best-practices': { score: number }
    seo: { score: number }
  }
  audits: {
    'first-contentful-paint': { numericValue: number }
    'largest-contentful-paint': { numericValue: number }
    'cumulative-layout-shift': { numericValue: number }
    'total-blocking-time': { numericValue: number }
    'speed-index': { numericValue: number }
  }
}

function getScoreEmoji(score: number): string {
  if (score >= 0.9) return '🟢'
  if (score >= 0.5) return '🟡'
  return '🔴'
}

function getMetricStatus(metric: string, value: number): string {
  const thresholds: Record<string, { good: number; moderate: number }> = {
    FCP: { good: 1800, moderate: 3000 },
    LCP: { good: 2500, moderate: 4000 },
    TBT: { good: 200, moderate: 600 },
    SI: { good: 3400, moderate: 5800 },
    CLS: { good: 0.1, moderate: 0.25 }
  }

  const threshold = thresholds[metric]
  if (!threshold) return ''

  if (value <= threshold.good) return '🟢'
  if (value <= threshold.moderate) return '🟡'
  return '🔴'
}

function analyze(file: string) {
  try {
    const report: Report = JSON.parse(readFileSync(file, 'utf-8'))

    console.log(`\n${'='.repeat(70)}`)
    console.log(`📊 ${file}`)
    console.log('='.repeat(70))

    // Categories
    console.log('\n📈 Lighthouse Scores:')
    console.log(`   ${getScoreEmoji(report.categories.performance.score)} Performance:    ${(report.categories.performance.score * 100).toFixed(0)}/100`)
    console.log(`   ${getScoreEmoji(report.categories.accessibility.score)} Accessibility:  ${(report.categories.accessibility.score * 100).toFixed(0)}/100`)
    console.log(`   ${getScoreEmoji(report.categories['best-practices'].score)} Best Practices: ${(report.categories['best-practices'].score * 100).toFixed(0)}/100`)
    console.log(`   ${getScoreEmoji(report.categories.seo.score)} SEO:            ${(report.categories.seo.score * 100).toFixed(0)}/100`)

    // Core Web Vitals
    const fcp = report.audits['first-contentful-paint'].numericValue / 1000
    const lcp = report.audits['largest-contentful-paint'].numericValue / 1000
    const cls = report.audits['cumulative-layout-shift'].numericValue
    const tbt = report.audits['total-blocking-time'].numericValue
    const si = report.audits['speed-index'].numericValue / 1000

    console.log('\n⚡ Core Web Vitals:')
    console.log(`   ${getMetricStatus('FCP', fcp * 1000)} FCP (First Contentful Paint):     ${fcp.toFixed(2)}s`)
    console.log(`   ${getMetricStatus('LCP', lcp * 1000)} LCP (Largest Contentful Paint):   ${lcp.toFixed(2)}s`)
    console.log(`   ${getMetricStatus('CLS', cls)} CLS (Cumulative Layout Shift):    ${cls.toFixed(3)}`)
    console.log(`   ${getMetricStatus('TBT', tbt)} TBT (Total Blocking Time):        ${tbt.toFixed(0)}ms`)
    console.log(`   ${getMetricStatus('SI', si * 1000)} SI  (Speed Index):                 ${si.toFixed(2)}s`)

    // Recommendations
    console.log('\n💡 Status:')
    const perfScore = report.categories.performance.score
    if (perfScore >= 0.9) {
      console.log('   ✅ Excellent performance! Keep it up.')
    } else if (perfScore >= 0.75) {
      console.log('   🟡 Good performance, but room for improvement.')
    } else if (perfScore >= 0.5) {
      console.log('   🟠 Moderate performance. Consider optimizations.')
    } else {
      console.log('   🔴 Poor performance. Urgent optimization needed.')
    }

  } catch (error) {
    console.error(`\n❌ Error analyzing ${file}:`, error instanceof Error ? error.message : String(error))
  }
}

// Process all files from command line arguments
const files = process.argv.slice(2)

if (files.length === 0) {
  console.log('Usage: tsx scripts/analyze-lighthouse.ts <lighthouse-report.json> [...]')
  console.log('\nExample:')
  console.log('  tsx scripts/analyze-lighthouse.ts lighthouse-reports/*.json')
  process.exit(1)
}

console.log(`🔍 Analyzing ${files.length} Lighthouse report(s)...\n`)

files.forEach(analyze)

console.log(`\n${'='.repeat(70)}`)
console.log('✨ Analysis complete!')
console.log('='.repeat(70))
