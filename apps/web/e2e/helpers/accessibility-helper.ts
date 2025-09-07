import { Page, expect } from '@playwright/test'
import { injectAxe, checkA11y, getViolations } from '@axe-core/playwright'

export interface AccessibilityViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  help: string
  helpUrl: string
  nodes: Array<{
    target: string
    html: string
    failureSummary: string
  }>
}

export interface AccessibilityCheckOptions {
  // Selector to limit the scope of accessibility testing
  include?: string[]
  exclude?: string[]
  // Tags to run specific accessibility rules
  tags?: string[]
  // Rules to disable during testing
  disableRules?: string[]
  // Severity threshold - violations below this level will be ignored
  threshold?: 'minor' | 'moderate' | 'serious' | 'critical'
}

/**
 * Enhanced accessibility helper with comprehensive testing capabilities
 */
export class AccessibilityHelper {
  private page: Page
  private isAxeInjected = false

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Initialize axe-core on the current page
   */
  async initialize(): Promise<void> {
    if (!this.isAxeInjected) {
      await injectAxe(this.page)
      this.isAxeInjected = true
    }
  }

  /**
   * Run comprehensive accessibility checks on the current page
   */
  async runAccessibilityCheck(options: AccessibilityCheckOptions = {}): Promise<AccessibilityViolation[]> {
    await this.initialize()

    const axeOptions = {
      include: options.include || [],
      exclude: options.exclude || [],
      tags: options.tags || ['wcag2a', 'wcag2aa', 'wcag21aa'],
      rules: {} as Record<string, { enabled: boolean }>
    }

    // Disable specific rules if requested
    if (options.disableRules) {
      options.disableRules.forEach(rule => {
        axeOptions.rules[rule] = { enabled: false }
      })
    }

    try {
      await checkA11y(this.page, undefined, axeOptions)
      return [] // No violations found
    } catch (error) {
      // Extract violations from the error
      const violations = await getViolations(this.page)
      
      // Filter by severity threshold if specified
      let filteredViolations = violations
      if (options.threshold) {
        const severityOrder = ['minor', 'moderate', 'serious', 'critical']
        const thresholdIndex = severityOrder.indexOf(options.threshold)
        
        filteredViolations = violations.filter(violation => {
          const violationIndex = severityOrder.indexOf(violation.impact)
          return violationIndex >= thresholdIndex
        })
      }

      return filteredViolations.map(violation => ({
        id: violation.id,
        impact: violation.impact as AccessibilityViolation['impact'],
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map(node => ({
          target: node.target.join(', '),
          html: node.html,
          failureSummary: node.failureSummary
        }))
      }))
    }
  }

  /**
   * Check accessibility with detailed reporting
   */
  async checkWithReport(options: AccessibilityCheckOptions = {}): Promise<{
    passed: boolean
    violations: AccessibilityViolation[]
    report: string
  }> {
    const violations = await this.runAccessibilityCheck(options)
    const passed = violations.length === 0

    const report = this.generateReport(violations)
    
    return { passed, violations, report }
  }

  /**
   * Assert that the page has no accessibility violations
   */
  async assertNoViolations(options: AccessibilityCheckOptions = {}): Promise<void> {
    const violations = await this.runAccessibilityCheck(options)
    
    if (violations.length > 0) {
      const report = this.generateReport(violations)
      throw new Error(`Accessibility violations found:\n${report}`)
    }
  }

  /**
   * Check specific elements for accessibility issues
   */
  async checkElement(selector: string, options: Omit<AccessibilityCheckOptions, 'include'> = {}): Promise<AccessibilityViolation[]> {
    return this.runAccessibilityCheck({
      ...options,
      include: [selector]
    })
  }

  /**
   * Check form accessibility
   */
  async checkFormAccessibility(formSelector = 'form'): Promise<AccessibilityViolation[]> {
    return this.checkElement(formSelector, {
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
      threshold: 'moderate'
    })
  }

  /**
   * Check navigation accessibility
   */
  async checkNavigationAccessibility(navSelector = 'nav'): Promise<AccessibilityViolation[]> {
    return this.checkElement(navSelector, {
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      threshold: 'moderate'
    })
  }

  /**
   * Check modal/dialog accessibility
   */
  async checkModalAccessibility(modalSelector: string): Promise<AccessibilityViolation[]> {
    return this.checkElement(modalSelector, {
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      disableRules: ['color-contrast'], // Modals often have different contrast requirements
      threshold: 'serious'
    })
  }

  /**
   * Generate a human-readable accessibility report
   */
  private generateReport(violations: AccessibilityViolation[]): string {
    if (violations.length === 0) {
      return '✅ No accessibility violations found'
    }

    const report = [
      `❌ Found ${violations.length} accessibility violation(s):`,
      ''
    ]

    violations.forEach((violation, index) => {
      report.push(`${index + 1}. ${violation.id} (${violation.impact.toUpperCase()})`)
      report.push(`   Description: ${violation.description}`)
      report.push(`   Help: ${violation.help}`)
      report.push(`   Learn more: ${violation.helpUrl}`)
      
      if (violation.nodes.length > 0) {
        report.push('   Affected elements:')
        violation.nodes.slice(0, 3).forEach(node => { // Limit to first 3 nodes
          report.push(`     • ${node.target}`)
          if (node.failureSummary) {
            report.push(`       Issue: ${node.failureSummary}`)
          }
        })
        if (violation.nodes.length > 3) {
          report.push(`     ... and ${violation.nodes.length - 3} more elements`)
        }
      }
      report.push('')
    })

    return report.join('\n')
  }

  /**
   * Get accessibility insights for the current page
   */
  async getAccessibilityInsights(): Promise<{
    totalElements: number
    checkedElements: number
    passedRules: number
    failedRules: number
    summary: string
  }> {
    await this.initialize()
    
    // Run a comprehensive check to get detailed results
    const violations = await this.runAccessibilityCheck({
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice', 'experimental']
    })

    // Get page statistics
    const totalElements = await this.page.evaluate(() => {
      return document.querySelectorAll('*').length
    })

    const checkedElements = await this.page.evaluate(() => {
      // Approximate count of elements that axe typically checks
      return document.querySelectorAll('input, button, a, img, form, label, h1, h2, h3, h4, h5, h6, nav, main, section, article').length
    })

    const failedRules = violations.length
    const passedRules = Math.max(0, 50 - failedRules) // Approximate based on common axe rules

    const summary = failedRules === 0 
      ? '✅ Page passes all accessibility checks'
      : `⚠️ Page has ${failedRules} accessibility issue(s) that need attention`

    return {
      totalElements,
      checkedElements,
      passedRules,
      failedRules,
      summary
    }
  }
}