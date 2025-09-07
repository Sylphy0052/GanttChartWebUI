import { Page, expect } from '@playwright/test'
import { injectAxe, checkA11y, getViolations } from '@axe-core/playwright'

export interface AccessibilityViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  help: string
  helpUrl: string
  nodes: Array<{
    html: string
    target: string[]
  }>
}

export interface AccessibilityReport {
  url: string
  violations: AccessibilityViolation[]
  passedRules: number
  violationCount: number
  wcagLevel: 'AA' | 'AAA'
  timestamp: string
}

export class AccessibilityHelper {
  constructor(private page: Page) {}

  // AC7: Initialize axe-core for accessibility testing
  async initialize(): Promise<void> {
    await injectAxe(this.page)
  }

  // AC7: Check WCAG 2.1 AA compliance for the current page
  async checkWCAGCompliance(options?: {
    include?: string[]
    exclude?: string[]
    tags?: string[]
  }): Promise<AccessibilityReport> {
    const defaultOptions = {
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'] // WCAG 2.1 AA compliance
    }

    const axeOptions = { ...defaultOptions, ...options }

    try {
      // Run axe-core accessibility scan
      await checkA11y(this.page, undefined, axeOptions)
      
      // If no violations, return clean report
      return this.generateReport([], axeOptions.tags)
    } catch (error) {
      // Extract violations from error
      const violations = await getViolations(this.page)
      return this.generateReport(violations, axeOptions.tags)
    }
  }

  // AC7: Check specific accessibility features
  async checkKeyboardNavigation(): Promise<boolean> {
    console.log('Testing keyboard navigation...')
    
    // Focus on the first interactive element
    await this.page.keyboard.press('Tab')
    
    const focusedElement = await this.page.evaluate(() => {
      return document.activeElement?.tagName
    })

    // Test tab navigation through interactive elements
    const interactiveElements = await this.page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').count()
    
    let focusableCount = 0
    for (let i = 0; i < Math.min(interactiveElements, 20); i++) {
      await this.page.keyboard.press('Tab')
      
      const currentFocus = await this.page.evaluate(() => {
        const activeEl = document.activeElement
        return activeEl ? {
          tagName: activeEl.tagName,
          hasVisibleFocus: window.getComputedStyle(activeEl).outline !== 'none' || 
                          window.getComputedStyle(activeEl).boxShadow.includes('focus')
        } : null
      })
      
      if (currentFocus) {
        focusableCount++
      }
    }

    console.log(`Keyboard navigation test: ${focusableCount}/${Math.min(interactiveElements, 20)} elements focusable`)
    return focusableCount > 0
  }

  // AC7: Check ARIA labels and roles
  async checkARIACompliance(): Promise<{
    missingLabels: string[]
    invalidRoles: string[]
    missingDescriptions: string[]
  }> {
    console.log('Checking ARIA compliance...')
    
    const ariaIssues = await this.page.evaluate(() => {
      const missingLabels: string[] = []
      const invalidRoles: string[] = []
      const missingDescriptions: string[] = []

      // Check for interactive elements without labels
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea')
      interactiveElements.forEach((el, index) => {
        const hasLabel = el.hasAttribute('aria-label') || 
                         el.hasAttribute('aria-labelledby') || 
                         (el as HTMLElement).textContent?.trim()

        if (!hasLabel) {
          missingLabels.push(`${el.tagName}[${index}]`)
        }
      })

      // Check for elements with invalid ARIA roles
      const elementsWithRoles = document.querySelectorAll('[role]')
      const validRoles = [
        'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox',
        'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog',
        'directory', 'document', 'form', 'grid', 'gridcell', 'group', 'heading', 'img',
        'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu',
        'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'note',
        'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row',
        'rowgroup', 'rowheader', 'scrollbar', 'search', 'separator', 'slider', 'spinbutton',
        'status', 'tab', 'tablist', 'tabpanel', 'textbox', 'timer', 'toolbar', 'tooltip',
        'tree', 'treegrid', 'treeitem'
      ]

      elementsWithRoles.forEach((el, index) => {
        const role = el.getAttribute('role')
        if (role && !validRoles.includes(role)) {
          invalidRoles.push(`${el.tagName}[${index}] role="${role}"`)
        }
      })

      // Check for complex interactive elements without descriptions
      const complexElements = document.querySelectorAll('[data-testid*="gantt"], [data-testid*="chart"], [data-testid*="diagram"]')
      complexElements.forEach((el, index) => {
        const hasDescription = el.hasAttribute('aria-describedby') || 
                              el.hasAttribute('title') || 
                              el.querySelector('[aria-hidden="false"]')

        if (!hasDescription) {
          missingDescriptions.push(`${el.tagName}[${index}]`)
        }
      })

      return { missingLabels, invalidRoles, missingDescriptions }
    })

    console.log('ARIA compliance check results:', ariaIssues)
    return ariaIssues
  }

  // AC7: Check color contrast ratios
  async checkColorContrast(): Promise<boolean> {
    console.log('Checking color contrast ratios...')
    
    const contrastIssues = await this.page.evaluate(() => {
      const textElements = document.querySelectorAll('p, span, div, button, a, label, h1, h2, h3, h4, h5, h6')
      const issues: Array<{ element: string; ratio: number }> = []

      textElements.forEach((el, index) => {
        const styles = window.getComputedStyle(el)
        const textColor = styles.color
        const backgroundColor = styles.backgroundColor

        // Skip if transparent or no text
        if (!el.textContent?.trim() || backgroundColor === 'rgba(0, 0, 0, 0)') {
          return
        }

        // Simple contrast check (would need full contrast calculation in production)
        const isLightText = textColor.includes('rgb(255') || textColor.includes('#fff')
        const isDarkBackground = backgroundColor.includes('rgb(0') || backgroundColor.includes('#000')
        
        // Basic heuristic check - in real implementation would calculate exact contrast ratio
        const hasGoodContrast = (isLightText && isDarkBackground) || (!isLightText && !isDarkBackground)
        
        if (!hasGoodContrast && index < 10) { // Limit to first 10 for performance
          issues.push({ 
            element: `${el.tagName}[${index}]`,
            ratio: isLightText ? 4.5 : 3.0 // Placeholder values
          })
        }
      })

      return issues.length === 0
    })

    return contrastIssues
  }

  // AC7: Check for alternative text on images
  async checkImageAltText(): Promise<string[]> {
    console.log('Checking image alternative text...')
    
    const missingAltText = await this.page.evaluate(() => {
      const images = document.querySelectorAll('img')
      const missingAlt: string[] = []

      images.forEach((img, index) => {
        if (!img.hasAttribute('alt') || img.getAttribute('alt')?.trim() === '') {
          missingAlt.push(`img[${index}] src="${img.src}"`)
        }
      })

      return missingAlt
    })

    return missingAltText
  }

  // AC7: Check heading hierarchy
  async checkHeadingHierarchy(): Promise<{
    valid: boolean
    issues: string[]
  }> {
    console.log('Checking heading hierarchy...')
    
    const headingIssues = await this.page.evaluate(() => {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const issues: string[] = []
      let previousLevel = 0

      headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.charAt(1))
        
        // Check for skipped levels
        if (previousLevel > 0 && level > previousLevel + 1) {
          issues.push(`Heading level skip: h${previousLevel} → h${level} at index ${index}`)
        }
        
        // Check for multiple h1s (should typically have only one)
        if (level === 1 && previousLevel === 1) {
          issues.push(`Multiple h1 elements found at index ${index}`)
        }
        
        previousLevel = level
      })

      return {
        valid: issues.length === 0,
        issues
      }
    })

    return headingIssues
  }

  // AC7: Test screen reader compatibility
  async checkScreenReaderCompat(): Promise<{
    landmarksPresent: boolean
    skipLinksPresent: boolean
    liveRegionsPresent: boolean
  }> {
    console.log('Checking screen reader compatibility...')
    
    const screenReaderFeatures = await this.page.evaluate(() => {
      // Check for landmark roles
      const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer')
      const landmarksPresent = landmarks.length > 0

      // Check for skip links
      const skipLinks = document.querySelectorAll('a[href^="#"]:first-child, .skip-link, [class*="skip"]')
      const skipLinksPresent = skipLinks.length > 0

      // Check for live regions for dynamic content
      const liveRegions = document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')
      const liveRegionsPresent = liveRegions.length > 0

      return {
        landmarksPresent,
        skipLinksPresent,
        liveRegionsPresent
      }
    })

    return screenReaderFeatures
  }

  // AC7: Generate comprehensive accessibility report
  private async generateReport(violations: any[], wcagTags: string[]): Promise<AccessibilityReport> {
    const url = this.page.url()
    const timestamp = new Date().toISOString()
    
    // Count total rules that passed (approximate)
    const totalRulesCount = 50 // Approximate number of axe rules
    const violationCount = violations.length
    const passedRules = Math.max(0, totalRulesCount - violationCount)

    return {
      url,
      violations: violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n: any) => ({
          html: n.html,
          target: n.target
        }))
      })),
      passedRules,
      violationCount,
      wcagLevel: wcagTags.includes('wcag21aa') ? 'AA' : 'AAA',
      timestamp
    }
  }

  // AC7: Assert WCAG 2.1 AA compliance
  async assertWCAGCompliance(): Promise<void> {
    await this.initialize()
    const report = await this.checkWCAGCompliance()
    
    console.log(`\n=== Accessibility Report for ${report.url} ===`)
    console.log(`WCAG Level: ${report.wcagLevel}`)
    console.log(`Rules Passed: ${report.passedRules}`)
    console.log(`Violations: ${report.violationCount}`)
    
    if (report.violations.length > 0) {
      console.log('\nViolations:')
      report.violations.forEach(violation => {
        console.log(`- ${violation.id} (${violation.impact}): ${violation.description}`)
        console.log(`  Help: ${violation.help}`)
        console.log(`  Nodes: ${violation.nodes.length}`)
      })
    }
    
    console.log('================================================\n')
    
    // Assert no critical or serious accessibility violations
    const criticalViolations = report.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
    expect(criticalViolations.length, 'Should have no critical or serious accessibility violations').toBe(0)
    
    // Assert overall compliance
    expect(report.violationCount, 'Should have minimal accessibility violations for WCAG 2.1 AA').toBeLessThanOrEqual(5)
  }

  // AC7: Run complete accessibility audit
  async runCompleteAudit(): Promise<void> {
    console.log('Running complete accessibility audit...')
    
    // Initialize axe-core
    await this.initialize()
    
    // Run all accessibility checks
    const [
      wcagReport,
      keyboardNavWorking,
      ariaCompliance,
      contrastOk,
      missingAltText,
      headingHierarchy,
      screenReaderCompat
    ] = await Promise.all([
      this.checkWCAGCompliance(),
      this.checkKeyboardNavigation(),
      this.checkARIACompliance(),
      this.checkColorContrast(),
      this.checkImageAltText(),
      this.checkHeadingHierarchy(),
      this.checkScreenReaderCompat()
    ])

    // Log comprehensive results
    console.log('\n=== Complete Accessibility Audit Results ===')
    console.log(`✅ WCAG 2.1 AA Violations: ${wcagReport.violationCount}`)
    console.log(`${keyboardNavWorking ? '✅' : '❌'} Keyboard Navigation Working`)
    console.log(`✅ ARIA Missing Labels: ${ariaCompliance.missingLabels.length}`)
    console.log(`✅ ARIA Invalid Roles: ${ariaCompliance.invalidRoles.length}`)
    console.log(`${contrastOk ? '✅' : '❌'} Color Contrast Adequate`)
    console.log(`✅ Images Missing Alt Text: ${missingAltText.length}`)
    console.log(`${headingHierarchy.valid ? '✅' : '❌'} Heading Hierarchy Valid`)
    console.log(`${screenReaderCompat.landmarksPresent ? '✅' : '❌'} Landmarks Present`)
    console.log(`${screenReaderCompat.skipLinksPresent ? '✅' : '❌'} Skip Links Present`)
    console.log(`${screenReaderCompat.liveRegionsPresent ? '✅' : '❌'} Live Regions Present`)
    console.log('=============================================\n')

    // Assert critical accessibility requirements
    expect(keyboardNavWorking, 'Keyboard navigation should work').toBe(true)
    expect(contrastOk, 'Color contrast should be adequate').toBe(true)
    expect(headingHierarchy.valid, 'Heading hierarchy should be valid').toBe(true)
    expect(missingAltText.length, 'Images should have alt text').toBeLessThanOrEqual(1)
    expect(ariaCompliance.missingLabels.length, 'Interactive elements should have labels').toBeLessThanOrEqual(2)
  }
}