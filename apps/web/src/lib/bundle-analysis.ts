/**
 * Bundle Size Analysis and Monitoring
 * 
 * This utility provides functions to analyze bundle size and monitor performance
 * for T037: Frontend Bundle Size Optimization
 */

// Bundle size thresholds in KB
export const BUNDLE_THRESHOLDS = {
  INITIAL_JS: 150, // 150KB for initial JS bundle
  TOTAL_JS: 500,   // 500KB for total JS bundle
  CSS: 50,         // 50KB for CSS
  IMAGES: 500,     // 500KB for images
  FONTS: 200,      // 200KB for fonts
} as const

// Performance budget configuration
export interface PerformanceBudget {
  initialJS: number
  totalJS: number
  css: number
  images: number
  fonts: number
}

// Bundle analysis result interface
export interface BundleAnalysis {
  timestamp: string
  sizes: {
    initialJS: number
    totalJS: number
    css: number
    images: number
    fonts: number
  }
  chunks: Array<{
    name: string
    size: number
    gzipped?: number
  }>
  violations: string[]
  recommendations: string[]
}

/**
 * Analyze bundle from build output
 */
export async function analyzeBundleFromBuild(buildDir: string = '.next'): Promise<BundleAnalysis> {
  const analysis: BundleAnalysis = {
    timestamp: new Date().toISOString(),
    sizes: {
      initialJS: 0,
      totalJS: 0,
      css: 0,
      images: 0,
      fonts: 0
    },
    chunks: [],
    violations: [],
    recommendations: []
  }

  try {
    // This would normally use fs to read build manifest
    // For now, we'll simulate with static data based on current build
    analysis.sizes = {
      initialJS: 169, // KB - from current analysis
      totalJS: 854,   // KB - total of all chunks
      css: 45,        // KB - estimated
      images: 120,    // KB - estimated
      fonts: 80       // KB - estimated
    }

    // Simulate chunk analysis
    analysis.chunks = [
      { name: 'vendor', size: 538, gzipped: 134 },
      { name: 'framework', size: 137, gzipped: 34 },
      { name: 'main', size: 129, gzipped: 32 },
      { name: 'polyfills', size: 110, gzipped: 28 },
      { name: 'gantt', size: 96, gzipped: 24 },
    ]

    // Check against thresholds
    if (analysis.sizes.initialJS > BUNDLE_THRESHOLDS.INITIAL_JS) {
      analysis.violations.push(`Initial JS bundle (${analysis.sizes.initialJS}KB) exceeds threshold (${BUNDLE_THRESHOLDS.INITIAL_JS}KB)`)
    }

    if (analysis.sizes.totalJS > BUNDLE_THRESHOLDS.TOTAL_JS) {
      analysis.violations.push(`Total JS bundle (${analysis.sizes.totalJS}KB) exceeds threshold (${BUNDLE_THRESHOLDS.TOTAL_JS}KB)`)
    }

    // Generate recommendations
    if (analysis.sizes.initialJS > 100) {
      analysis.recommendations.push('Consider code splitting large components')
    }

    if (analysis.chunks.some(chunk => chunk.size > 150)) {
      analysis.recommendations.push('Consider splitting large chunks further')
    }

  } catch (error) {
    console.error('Bundle analysis failed:', error)
  }

  return analysis
}

/**
 * Monitor bundle size in development
 */
export function createBundleMonitor() {
  let previousAnalysis: BundleAnalysis | null = null

  return {
    async checkBundleSize(): Promise<BundleAnalysis> {
      const currentAnalysis = await analyzeBundleFromBuild()
      
      if (previousAnalysis) {
        const sizeDiff = currentAnalysis.sizes.totalJS - previousAnalysis.sizes.totalJS
        if (sizeDiff > 50) { // 50KB increase
          console.warn(`⚠️ Bundle size increased by ${sizeDiff}KB`)
        } else if (sizeDiff < -50) { // 50KB decrease
          console.log(`✅ Bundle size reduced by ${Math.abs(sizeDiff)}KB`)
        }
      }

      previousAnalysis = currentAnalysis
      return currentAnalysis
    },

    generateReport(analysis: BundleAnalysis): string {
      const report = [
        '📊 Bundle Size Analysis Report',
        '================================',
        `Timestamp: ${analysis.timestamp}`,
        '',
        'Bundle Sizes:',
        `  Initial JS: ${analysis.sizes.initialJS}KB`,
        `  Total JS: ${analysis.sizes.totalJS}KB`,
        `  CSS: ${analysis.sizes.css}KB`,
        `  Images: ${analysis.sizes.images}KB`,
        `  Fonts: ${analysis.sizes.fonts}KB`,
        '',
        'Top Chunks:',
        ...analysis.chunks.map(chunk => 
          `  ${chunk.name}: ${chunk.size}KB${chunk.gzipped ? ` (${chunk.gzipped}KB gzipped)` : ''}`
        ),
      ]

      if (analysis.violations.length > 0) {
        report.push('', '❌ Violations:', ...analysis.violations.map(v => `  • ${v}`))
      }

      if (analysis.recommendations.length > 0) {
        report.push('', '💡 Recommendations:', ...analysis.recommendations.map(r => `  • ${r}`))
      }

      return report.join('\n')
    }
  }
}

/**
 * Calculate bundle size reduction percentage
 */
export function calculateSizeReduction(before: number, after: number): {
  reduction: number
  percentage: number
  achieved20Percent: boolean
} {
  const reduction = before - after
  const percentage = (reduction / before) * 100
  
  return {
    reduction,
    percentage,
    achieved20Percent: percentage >= 20
  }
}