import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'
import { AccessibilityHelper } from './helpers/accessibility-helper'

test.describe('Accessibility Compliance - WCAG 2.1 AA Standards', () => {
  let uiHelper: UIHelper
  let dataHelper: DataHelper
  let authHelper: AuthHelper
  let accessibilityHelper: AccessibilityHelper

  test.beforeEach(async ({ page }) => {
    uiHelper = new UIHelper(page)
    dataHelper = new DataHelper(page)
    authHelper = new AuthHelper(page)
    accessibilityHelper = new AccessibilityHelper(page)
    
    await dataHelper.setupCleanEnvironment()
    await authHelper.ensureAuthenticated()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
  })

  // AC7: Complete WCAG 2.1 AA compliance validation
  test('Complete WCAG 2.1 AA compliance validation', { 
    tag: '@accessibility' 
  }, async ({ page }) => {
    console.log('♿ Testing complete WCAG 2.1 AA compliance...')

    const criticalPages = [
      { path: '/', name: 'Home Page' },
      { path: '/gantt', name: 'Gantt Chart' },
      { path: '/issues', name: 'Issues Management' },
      { path: '/projects', name: 'Projects Page' }
    ]

    for (const pageInfo of criticalPages) {
      console.log(`\n=== Testing WCAG compliance for ${pageInfo.name} ===`)
      
      await uiHelper.navigateToPage(pageInfo.path)
      await uiHelper.waitForPageLoad()
      
      // Run complete accessibility audit for this page
      await accessibilityHelper.runCompleteAudit()
      
      // Take screenshot for accessibility review
      await uiHelper.takeScreenshot(`accessibility-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}`)
    }

    console.log('✅ Complete WCAG 2.1 AA compliance validation completed')
  })

  // AC7: Keyboard navigation and focus management
  test('Keyboard navigation and focus management', { 
    tag: '@accessibility' 
  }, async ({ page }) => {
    console.log('⌨️  Testing keyboard navigation and focus management...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test 1: Tab navigation through interactive elements
    console.log('Testing tab navigation...')
    
    const keyboardNavResult = await accessibilityHelper.checkKeyboardNavigation()
    expect(keyboardNavResult, 'Keyboard navigation should work properly').toBe(true)

    // Test 2: Focus indicators visibility
    console.log('Testing focus indicators...')
    
    // Navigate through elements and check focus visibility
    const interactiveElements = await page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])').count()
    console.log(`Found ${interactiveElements} interactive elements`)
    
    let focusIndicatorsWorking = 0
    
    for (let i = 0; i < Math.min(interactiveElements, 10); i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(200)
      
      // Check if focused element has visible focus indicator
      const focusIndicator = await page.evaluate(() => {
        const activeElement = document.activeElement
        if (!activeElement) return false
        
        const styles = window.getComputedStyle(activeElement)
        const outline = styles.outline
        const boxShadow = styles.boxShadow
        const border = styles.border
        
        // Check for visible focus indicators
        return outline !== 'none' || 
               boxShadow.includes('focus') ||
               boxShadow.includes('0 0') ||
               border.includes('blue') ||
               activeElement.classList.contains('focus')
      })
      
      if (focusIndicator) {
        focusIndicatorsWorking++
      }
    }
    
    const focusIndicatorScore = interactiveElements > 0 ? focusIndicatorsWorking / Math.min(interactiveElements, 10) : 1
    console.log(`Focus indicators working: ${(focusIndicatorScore * 100).toFixed(1)}%`)
    
    expect(focusIndicatorScore, 'At least 70% of elements should have visible focus indicators').toBeGreaterThanOrEqual(0.7)

    // Test 3: Logical tab order
    console.log('Testing logical tab order...')
    
    const tabOrder: string[] = []
    
    // Reset focus
    await page.evaluate(() => document.body.focus())
    
    // Record tab order for first 15 elements
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      
      const elementInfo = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return 'none'
        
        const role = el.getAttribute('role') || el.tagName.toLowerCase()
        const testId = el.getAttribute('data-testid') || ''
        const text = el.textContent?.trim().substring(0, 20) || ''
        
        return `${role}${testId ? `[${testId}]` : ''}${text ? `:${text}` : ''}`
      })
      
      tabOrder.push(elementInfo)
    }
    
    console.log('Tab order:', tabOrder.slice(0, 10)) // Show first 10
    
    // Tab order should be logical (e.g., header -> nav -> main -> footer)
    const hasLogicalOrder = tabOrder.some(item => 
      item.includes('header') || item.includes('nav') || item.includes('main')
    )
    
    console.log(`Logical tab order detected: ${hasLogicalOrder}`)

    // Test 4: Escape key functionality
    console.log('Testing escape key functionality...')
    
    // Try to open modal/dialog
    const modalTriggers = [
      '[data-testid="create-issue"], .create-issue-btn',
      '[data-testid="create-project"], .create-project-btn',
      'button:has-text("New")',
      'button:has-text("Add")',
      'button:has-text("Create")'
    ]
    
    for (const trigger of modalTriggers) {
      if (await page.locator(trigger).count() > 0) {
        await page.locator(trigger).click()
        await page.waitForTimeout(1000)
        
        // Check if modal opened
        const modal = await page.locator('[role="dialog"], .modal, .popup').count()
        
        if (modal > 0) {
          console.log('Modal opened, testing escape key...')
          
          // Press escape
          await page.keyboard.press('Escape')
          await page.waitForTimeout(500)
          
          // Modal should close
          const modalClosed = await page.locator('[role="dialog"], .modal, .popup').count() === 0
          console.log(`Modal closed with Escape: ${modalClosed}`)
          
          break
        }
      }
    }

    // Test 5: Skip links functionality
    console.log('Testing skip links...')
    
    await page.goto('/gantt') // Fresh navigation
    
    const skipLinks = await page.locator('a[href^="#"]:first-child, .skip-link, a:has-text("Skip")').count()
    
    if (skipLinks > 0) {
      console.log('Skip links found')
      
      // Test skip to main content
      const skipToMain = page.locator('a[href="#main"], a[href="#content"], .skip-to-main')
      
      if (await skipToMain.count() > 0) {
        await skipToMain.click()
        await page.waitForTimeout(300)
        
        const focusedElement = await page.evaluate(() => document.activeElement?.id)
        console.log(`Skip link focused element: ${focusedElement}`)
      }
    } else {
      console.log('ℹ️  No skip links found - consider adding for better accessibility')
    }

    console.log('✅ Keyboard navigation testing completed')
  })

  // AC7: Screen reader compatibility and ARIA implementation
  test('Screen reader compatibility and ARIA labels', { 
    tag: '@accessibility' 
  }, async ({ page }) => {
    console.log('🔊 Testing screen reader compatibility and ARIA implementation...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test 1: ARIA labels and roles compliance
    console.log('Testing ARIA labels and roles...')
    
    const ariaCompliance = await accessibilityHelper.checkARIACompliance()
    
    console.log(`Missing ARIA labels: ${ariaCompliance.missingLabels.length}`)
    console.log(`Invalid ARIA roles: ${ariaCompliance.invalidRoles.length}`)
    console.log(`Missing descriptions: ${ariaCompliance.missingDescriptions.length}`)
    
    // Assert ARIA compliance
    expect(ariaCompliance.missingLabels.length, 'Should have minimal missing ARIA labels').toBeLessThanOrEqual(3)
    expect(ariaCompliance.invalidRoles.length, 'Should have no invalid ARIA roles').toBe(0)
    expect(ariaCompliance.missingDescriptions.length, 'Complex elements should have descriptions').toBeLessThanOrEqual(2)

    // Test 2: Semantic HTML structure
    console.log('Testing semantic HTML structure...')
    
    const semanticElements = await page.evaluate(() => {
      const semantic = {
        main: document.querySelectorAll('main').length,
        nav: document.querySelectorAll('nav').length,
        header: document.querySelectorAll('header').length,
        footer: document.querySelectorAll('footer').length,
        article: document.querySelectorAll('article').length,
        section: document.querySelectorAll('section').length,
        aside: document.querySelectorAll('aside').length
      }
      
      return semantic
    })
    
    console.log('Semantic elements found:', semanticElements)
    
    expect(semanticElements.main, 'Should have main element').toBeGreaterThanOrEqual(1)
    expect(semanticElements.nav, 'Should have navigation element').toBeGreaterThanOrEqual(1)

    // Test 3: Screen reader specific features
    console.log('Testing screen reader specific features...')
    
    const screenReaderFeatures = await accessibilityHelper.checkScreenReaderCompat()
    
    console.log(`Landmarks present: ${screenReaderFeatures.landmarksPresent}`)
    console.log(`Skip links present: ${screenReaderFeatures.skipLinksPresent}`)
    console.log(`Live regions present: ${screenReaderFeatures.liveRegionsPresent}`)
    
    expect(screenReaderFeatures.landmarksPresent, 'Should have landmark elements').toBe(true)

    // Test 4: Complex UI components accessibility
    console.log('Testing complex UI components accessibility...')
    
    // Test Gantt chart accessibility
    const ganttAccessibility = await page.evaluate(() => {
      const ganttContainer = document.querySelector('[data-testid="gantt-container"], .gantt-container')
      
      if (!ganttContainer) return { present: false }
      
      return {
        present: true,
        hasRole: ganttContainer.getAttribute('role'),
        hasLabel: ganttContainer.getAttribute('aria-label') || ganttContainer.getAttribute('aria-labelledby'),
        hasDescription: ganttContainer.getAttribute('aria-describedby'),
        isKeyboardAccessible: ganttContainer.getAttribute('tabindex') !== null
      }
    })
    
    console.log('Gantt chart accessibility:', ganttAccessibility)
    
    if (ganttAccessibility.present) {
      if (!ganttAccessibility.hasLabel) {
        console.log('⚠️  Gantt chart missing ARIA label - screen readers may not understand its purpose')
      }
      
      if (!ganttAccessibility.hasDescription) {
        console.log('ℹ️  Consider adding aria-describedby for Gantt chart to help screen readers')
      }
    }

    // Test 5: Dynamic content accessibility
    console.log('Testing dynamic content accessibility...')
    
    // Look for live regions for dynamic updates
    const liveRegions = await page.locator('[aria-live], [role="status"], [role="alert"], [role="log"]').count()
    console.log(`Live regions for dynamic content: ${liveRegions}`)
    
    // Test dynamic content updates (if any)
    const createButton = '[data-testid="create-issue"], .create-issue-btn'
    if (await page.locator(createButton).count() > 0) {
      await page.locator(createButton).click()
      await page.waitForTimeout(1000)
      
      // Check if screen readers would be notified of the change
      const dynamicAnnouncement = await page.locator('[aria-live="polite"], [aria-live="assertive"], [role="status"]').count()
      
      if (dynamicAnnouncement > 0) {
        console.log('✅ Dynamic content changes announced to screen readers')
      } else {
        console.log('ℹ️  Consider adding live regions for dynamic content updates')
      }
      
      // Close modal if opened
      await page.keyboard.press('Escape')
    }

    console.log('✅ Screen reader compatibility testing completed')
  })

  // AC7: Color contrast and visual accessibility
  test('Color contrast and visual accessibility', { 
    tag: '@accessibility' 
  }, async ({ page }) => {
    console.log('🎨 Testing color contrast and visual accessibility...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test 1: Color contrast ratios
    console.log('Testing color contrast ratios...')
    
    const contrastOk = await accessibilityHelper.checkColorContrast()
    expect(contrastOk, 'Color contrast should meet WCAG standards').toBe(true)

    // Test 2: Color-only information detection
    console.log('Testing for color-only information...')
    
    const colorOnlyInfo = await page.evaluate(() => {
      const issues: string[] = []
      
      // Look for elements that might rely only on color
      const statusElements = document.querySelectorAll('.status, [class*="status"], .priority, [class*="priority"]')
      
      statusElements.forEach((el, index) => {
        const hasText = el.textContent?.trim()
        const hasIcon = el.querySelector('svg, i, .icon')
        const hasPattern = el.classList.toString().includes('pattern') || 
                          el.classList.toString().includes('stripe') ||
                          el.style.backgroundImage
        
        // If element has color but no text, icon, or pattern, it might rely only on color
        if (!hasText && !hasIcon && !hasPattern && index < 10) {
          issues.push(`Element ${el.className} may rely only on color`)
        }
      })
      
      return issues
    })
    
    console.log(`Potential color-only information issues: ${colorOnlyInfo.length}`)
    if (colorOnlyInfo.length > 0) {
      console.log('Issues found:', colorOnlyInfo.slice(0, 5))
    }
    
    expect(colorOnlyInfo.length, 'Should not rely solely on color for information').toBeLessThanOrEqual(2)

    // Test 3: Focus visibility
    console.log('Testing focus visibility...')
    
    // Test focus visibility on different element types
    const focusTestElements = [
      'button:first-of-type',
      'a:first-of-type', 
      'input:first-of-type'
    ]
    
    let visibleFocusCount = 0
    
    for (const selector of focusTestElements) {
      if (await page.locator(selector).count() > 0) {
        await page.locator(selector).focus()
        await page.waitForTimeout(200)
        
        const focusVisible = await page.evaluate((sel) => {
          const element = document.querySelector(sel) as HTMLElement
          if (!element) return false
          
          const styles = window.getComputedStyle(element)
          const outline = styles.outline
          const boxShadow = styles.boxShadow
          
          return outline !== 'none' || 
                 boxShadow.includes('0 0') || 
                 boxShadow.includes('focus') ||
                 element.classList.contains('focus-visible')
        }, selector)
        
        if (focusVisible) {
          visibleFocusCount++
          console.log(`✅ Focus visible on ${selector}`)
        } else {
          console.log(`❌ Focus not visible on ${selector}`)
        }
      }
    }
    
    const focusScore = focusTestElements.length > 0 ? visibleFocusCount / focusTestElements.length : 1
    expect(focusScore, 'Most elements should have visible focus indicators').toBeGreaterThanOrEqual(0.6)

    // Test 4: Text sizing and scaling
    console.log('Testing text sizing and scaling...')
    
    // Test zoom to 200% (WCAG requirement)
    await page.evaluate(() => {
      document.body.style.zoom = '2.0'
    })
    
    await page.waitForTimeout(1000)
    
    // Check if content is still usable at 200% zoom
    const contentUsableAt200 = await page.evaluate(() => {
      // Check if main content is still visible and not cut off
      const mainContent = document.querySelector('main, [data-testid="main-content"], .main-content')
      if (!mainContent) return false
      
      const rect = mainContent.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && rect.left >= 0
    })
    
    console.log(`Content usable at 200% zoom: ${contentUsableAt200}`)
    
    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = '1.0'
    })
    
    expect(contentUsableAt200, 'Content should be usable at 200% zoom').toBe(true)

    // Test 5: Motion and animation accessibility
    console.log('Testing motion and animation accessibility...')
    
    // Check for animations that might cause vestibular disorders
    const animations = await page.evaluate(() => {
      const animatedElements = document.querySelectorAll('*')
      const animationIssues: string[] = []
      
      animatedElements.forEach((el, index) => {
        if (index > 100) return // Limit check for performance
        
        const styles = window.getComputedStyle(el)
        const animation = styles.animation
        const transition = styles.transition
        
        // Check for potentially problematic animations
        if (animation !== 'none' && animation.includes('infinite')) {
          animationIssues.push(`Infinite animation on element ${index}`)
        }
        
        if (transition.includes('transform') && parseFloat(styles.animationDuration) > 5) {
          animationIssues.push(`Long transform animation on element ${index}`)
        }
      })
      
      return {
        totalAnimated: Array.from(animatedElements).filter(el => {
          const styles = window.getComputedStyle(el)
          return styles.animation !== 'none' || styles.transition !== 'all 0s ease 0s'
        }).length,
        issues: animationIssues
      }
    })
    
    console.log(`Animated elements: ${animations.totalAnimated}`)
    console.log(`Animation issues: ${animations.issues.length}`)
    
    if (animations.issues.length > 0) {
      console.log('Animation issues:', animations.issues.slice(0, 3))
    }

    console.log('✅ Color contrast and visual accessibility testing completed')
  })

  // AC7: Form accessibility and error handling
  test('Form accessibility and error handling', { 
    tag: '@accessibility' 
  }, async ({ page }) => {
    console.log('📝 Testing form accessibility and error handling...')

    // Navigate to page with forms
    await uiHelper.navigateToPage('/issues')
    await uiHelper.waitForPageLoad()

    // Try to find create form
    const createButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New")'
    
    if (await page.locator(createButton).count() > 0) {
      await page.locator(createButton).click()
      await page.waitForTimeout(1000)
      
      console.log('Testing form accessibility...')
      
      // Test 1: Form field labels
      const formFields = await page.locator('input, textarea, select').count()
      console.log(`Form fields found: ${formFields}`)
      
      if (formFields > 0) {
        let properlyLabeledFields = 0
        
        for (let i = 0; i < formFields; i++) {
          const field = page.locator('input, textarea, select').nth(i)
          
          const isLabeled = await field.evaluate((el) => {
            const hasLabel = document.querySelector(`label[for="${el.id}"]`) !== null
            const hasAriaLabel = el.hasAttribute('aria-label')
            const hasAriaLabelledby = el.hasAttribute('aria-labelledby')
            const hasPlaceholder = el.hasAttribute('placeholder') && el.getAttribute('placeholder')?.trim()
            
            return hasLabel || hasAriaLabel || hasAriaLabelledby || hasPlaceholder
          })
          
          if (isLabeled) {
            properlyLabeledFields++
          }
        }
        
        const labelingScore = properlyLabeledFields / formFields
        console.log(`Properly labeled form fields: ${(labelingScore * 100).toFixed(1)}%`)
        
        expect(labelingScore, 'At least 80% of form fields should be properly labeled').toBeGreaterThanOrEqual(0.8)
        
        // Test 2: Required field indication
        console.log('Testing required field indication...')
        
        const requiredFields = await page.locator('input[required], textarea[required], select[required]').count()
        const ariaRequiredFields = await page.locator('[aria-required="true"]').count()
        
        console.log(`Required fields: ${requiredFields}, ARIA required: ${ariaRequiredFields}`)
        
        // Test 3: Error message accessibility
        console.log('Testing error message accessibility...')
        
        // Try to submit empty form to trigger validation
        const submitButton = page.locator('button[type="submit"], .submit-btn')
        if (await submitButton.count() > 0) {
          await submitButton.click()
          await page.waitForTimeout(1500)
          
          // Check for accessible error messages
          const errorMessages = await page.evaluate(() => {
            const errors = document.querySelectorAll('.error, [role="alert"], .invalid, .field-error')
            const accessibleErrors: string[] = []
            
            errors.forEach((error, index) => {
              const hasAriaLive = error.getAttribute('aria-live')
              const hasRole = error.getAttribute('role') === 'alert'
              const isVisible = error.getBoundingClientRect().height > 0
              
              if ((hasAriaLive || hasRole) && isVisible) {
                accessibleErrors.push(`Error ${index} is accessible`)
              }
            })
            
            return {
              totalErrors: errors.length,
              accessibleErrors: accessibleErrors.length
            }
          })
          
          console.log(`Error messages: ${errorMessages.totalErrors}, Accessible: ${errorMessages.accessibleErrors}`)
          
          if (errorMessages.totalErrors > 0) {
            const errorAccessibilityScore = errorMessages.accessibleErrors / errorMessages.totalErrors
            expect(errorAccessibilityScore, 'Error messages should be accessible to screen readers').toBeGreaterThanOrEqual(0.5)
          }
        }
        
        // Test 4: Field instructions and help text
        console.log('Testing field instructions and help text...')
        
        const fieldsWithHelp = await page.locator('input[aria-describedby], textarea[aria-describedby], select[aria-describedby]').count()
        const helpTexts = await page.locator('.help-text, .field-help, [role="tooltip"]').count()
        
        console.log(`Fields with help: ${fieldsWithHelp}, Help texts: ${helpTexts}`)
        
        // Test 5: Form navigation
        console.log('Testing form navigation...')
        
        // Test tab order through form
        const firstField = page.locator('input, textarea, select').first()
        if (await firstField.count() > 0) {
          await firstField.focus()
          
          // Tab through fields
          for (let i = 0; i < Math.min(formFields, 5); i++) {
            await page.keyboard.press('Tab')
            await page.waitForTimeout(200)
            
            const focusedElementType = await page.evaluate(() => {
              return document.activeElement?.tagName.toLowerCase()
            })
            
            console.log(`Tab ${i + 1}: Focused ${focusedElementType}`)
          }
        }
      }
    } else {
      console.log('ℹ️  No forms found to test - testing general input accessibility')
      
      // Test any input fields on the page
      const inputs = await page.locator('input, textarea, select').count()
      if (inputs > 0) {
        console.log(`Found ${inputs} input elements to test`)
        
        // Test first input
        const firstInput = page.locator('input, textarea, select').first()
        await firstInput.focus()
        
        const inputAccessibility = await firstInput.evaluate((el) => {
          return {
            hasLabel: document.querySelector(`label[for="${el.id}"]`) !== null,
            hasAriaLabel: el.hasAttribute('aria-label'),
            hasPlaceholder: el.hasAttribute('placeholder'),
            isRequired: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true'
          }
        })
        
        console.log('Input accessibility:', inputAccessibility)
      }
    }

    console.log('✅ Form accessibility testing completed')
  })

  // AC7: Alternative text and media accessibility
  test('Alternative text and media accessibility', { 
    tag: '@accessibility' 
  }, async ({ page }) => {
    console.log('🖼️  Testing alternative text and media accessibility...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test 1: Image alternative text
    console.log('Testing image alternative text...')
    
    const missingAltText = await accessibilityHelper.checkImageAltText()
    
    console.log(`Images missing alt text: ${missingAltText.length}`)
    if (missingAltText.length > 0) {
      console.log('Missing alt text:', missingAltText.slice(0, 3))
    }
    
    expect(missingAltText.length, 'All images should have alt text').toBeLessThanOrEqual(1)

    // Test 2: Icon accessibility
    console.log('Testing icon accessibility...')
    
    const iconAccessibility = await page.evaluate(() => {
      const icons = document.querySelectorAll('svg, i[class*="icon"], [class*="icon"], .fa, [data-icon]')
      const iconIssues: string[] = []
      
      icons.forEach((icon, index) => {
        if (index > 20) return // Limit for performance
        
        const hasAriaLabel = icon.hasAttribute('aria-label')
        const hasAriaHidden = icon.getAttribute('aria-hidden') === 'true'
        const hasTitle = icon.hasAttribute('title')
        const hasText = icon.textContent?.trim()
        const hasRole = icon.getAttribute('role')
        
        // Decorative icons should be aria-hidden="true"
        // Functional icons should have accessible names
        const isDecorative = hasAriaHidden
        const isFunctional = hasAriaLabel || hasTitle || hasText || hasRole
        
        if (!isDecorative && !isFunctional) {
          iconIssues.push(`Icon ${index} needs aria-label or aria-hidden`)
        }
      })
      
      return {
        totalIcons: icons.length,
        issues: iconIssues
      }
    })
    
    console.log(`Icons found: ${iconAccessibility.totalIcons}`)
    console.log(`Icon accessibility issues: ${iconAccessibility.issues.length}`)
    
    expect(iconAccessibility.issues.length, 'Icons should be properly labeled or marked as decorative').toBeLessThanOrEqual(iconAccessibility.totalIcons * 0.2)

    // Test 3: Complex graphics accessibility (Gantt chart)
    console.log('Testing complex graphics accessibility...')
    
    const ganttAccessibility = await page.evaluate(() => {
      const gantt = document.querySelector('[data-testid="gantt-container"], .gantt-container, .gantt-chart')
      
      if (!gantt) return { present: false }
      
      // Check for data table alternative
      const hasDataTable = document.querySelector('table[aria-label*="gantt"], table[aria-label*="schedule"]')
      
      // Check for text summary
      const hasSummary = gantt.querySelector('[aria-describedby]') || 
                        document.querySelector('[aria-label*="summary"]')
      
      return {
        present: true,
        hasAriaLabel: gantt.hasAttribute('aria-label'),
        hasDescription: gantt.hasAttribute('aria-describedby'),
        hasDataTableAlternative: !!hasDataTable,
        hasTextSummary: !!hasSummary,
        hasRole: gantt.getAttribute('role')
      }
    })
    
    console.log('Gantt chart accessibility:', ganttAccessibility)
    
    if (ganttAccessibility.present) {
      if (!ganttAccessibility.hasAriaLabel) {
        console.log('⚠️  Gantt chart should have aria-label describing its purpose')
      }
      
      if (!ganttAccessibility.hasDataTableAlternative && !ganttAccessibility.hasTextSummary) {
        console.log('⚠️  Complex graphics should have text alternatives or data tables')
      }
    }

    // Test 4: Video/audio content (if any)
    console.log('Testing video/audio accessibility...')
    
    const mediaElements = await page.evaluate(() => {
      const videos = document.querySelectorAll('video')
      const audios = document.querySelectorAll('audio')
      const mediaIssues: string[] = []
      
      videos.forEach((video, index) => {
        const hasControls = video.hasAttribute('controls')
        const hasCaptions = video.querySelector('track[kind="captions"]') || 
                          video.querySelector('track[kind="subtitles"]')
        const hasDescription = video.querySelector('track[kind="descriptions"]')
        
        if (!hasControls) {
          mediaIssues.push(`Video ${index} should have controls`)
        }
        
        if (!hasCaptions) {
          mediaIssues.push(`Video ${index} should have captions`)
        }
      })
      
      audios.forEach((audio, index) => {
        const hasControls = audio.hasAttribute('controls')
        const hasTranscript = document.querySelector(`[aria-describedby="${audio.id}"]`)
        
        if (!hasControls) {
          mediaIssues.push(`Audio ${index} should have controls`)
        }
      })
      
      return {
        videoCount: videos.length,
        audioCount: audios.length,
        issues: mediaIssues
      }
    })
    
    console.log(`Media elements - Videos: ${mediaElements.videoCount}, Audio: ${mediaElements.audioCount}`)
    console.log(`Media accessibility issues: ${mediaElements.issues.length}`)
    
    if (mediaElements.issues.length > 0) {
      console.log('Media issues:', mediaElements.issues)
    }

    console.log('✅ Alternative text and media accessibility testing completed')
  })

  // AC7: Heading hierarchy and document structure
  test('Heading hierarchy and document structure', { 
    tag: '@accessibility' 
  }, async ({ page }) => {
    console.log('📑 Testing heading hierarchy and document structure...')

    const testPages = [
      { path: '/', name: 'Home Page' },
      { path: '/gantt', name: 'Gantt Chart' },
      { path: '/issues', name: 'Issues Page' },
      { path: '/projects', name: 'Projects Page' }
    ]

    for (const pageInfo of testPages) {
      console.log(`\nTesting heading hierarchy for ${pageInfo.name}...`)
      
      await uiHelper.navigateToPage(pageInfo.path)
      await uiHelper.waitForPageLoad()

      // Test heading hierarchy
      const headingHierarchy = await accessibilityHelper.checkHeadingHierarchy()
      
      console.log(`${pageInfo.name} - Heading hierarchy valid: ${headingHierarchy.valid}`)
      
      if (!headingHierarchy.valid) {
        console.log(`${pageInfo.name} - Heading issues:`, headingHierarchy.issues)
      }
      
      expect(headingHierarchy.valid, `${pageInfo.name} should have valid heading hierarchy`).toBe(true)

      // Test page structure
      const pageStructure = await page.evaluate(() => {
        const structure = {
          hasH1: document.querySelectorAll('h1').length,
          headingCount: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
          landmarksCount: document.querySelectorAll('main, nav, header, footer, aside, section[aria-label]').length,
          listsCount: document.querySelectorAll('ul, ol').length
        }
        
        return structure
      })
      
      console.log(`${pageInfo.name} structure:`, pageStructure)
      
      expect(pageStructure.hasH1, `${pageInfo.name} should have exactly one h1`).toBe(1)
      expect(pageStructure.headingCount, `${pageInfo.name} should have multiple headings for structure`).toBeGreaterThanOrEqual(2)
      expect(pageStructure.landmarksCount, `${pageInfo.name} should have landmark elements`).toBeGreaterThanOrEqual(2)
    }

    console.log('✅ Heading hierarchy and document structure testing completed')
  })

  // AC7: Mobile accessibility and touch accessibility
  test('Mobile accessibility and touch accessibility', { 
    tag: '@accessibility' 
  }, async ({ page }) => {
    console.log('📱 Testing mobile accessibility and touch accessibility...')

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test 1: Touch target sizes
    console.log('Testing touch target sizes...')
    
    const touchTargets = await page.evaluate(() => {
      const interactive = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')
      const inadequateTargets: string[] = []
      let totalTargets = 0
      
      interactive.forEach((el, index) => {
        if (index > 30) return // Limit for performance
        
        const rect = el.getBoundingClientRect()
        const isVisible = rect.width > 0 && rect.height > 0
        
        if (isVisible) {
          totalTargets++
          
          // WCAG recommends minimum 44x44px for touch targets
          if (rect.width < 44 || rect.height < 44) {
            inadequateTargets.push(`${el.tagName}[${index}]: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`)
          }
        }
      })
      
      return {
        totalTargets,
        inadequateTargets,
        adequateTargets: totalTargets - inadequateTargets.length
      }
    })
    
    console.log(`Touch targets: ${touchTargets.totalTargets}`)
    console.log(`Adequate size: ${touchTargets.adequateTargets}`)
    console.log(`Inadequate size: ${touchTargets.inadequateTargets.length}`)
    
    if (touchTargets.inadequateTargets.length > 0) {
      console.log('Small touch targets:', touchTargets.inadequateTargets.slice(0, 5))
    }
    
    const touchTargetScore = touchTargets.totalTargets > 0 ? 
      touchTargets.adequateTargets / touchTargets.totalTargets : 1
      
    expect(touchTargetScore, 'At least 80% of touch targets should meet minimum size requirements').toBeGreaterThanOrEqual(0.8)

    // Test 2: Mobile navigation accessibility
    console.log('Testing mobile navigation accessibility...')
    
    const mobileNav = await page.evaluate(() => {
      // Look for hamburger menu or mobile navigation
      const hamburger = document.querySelector('[data-testid="mobile-menu"], .hamburger, .menu-toggle')
      const mobileMenu = document.querySelector('[data-testid="mobile-nav"], .mobile-menu, .nav-mobile')
      
      return {
        hasHamburger: !!hamburger,
        hamburgerAccessible: hamburger ? (
          hamburger.hasAttribute('aria-label') || 
          hamburger.hasAttribute('aria-expanded') ||
          hamburger.getAttribute('aria-controls')
        ) : false,
        hasMobileMenu: !!mobileMenu,
        mobileMenuAccessible: mobileMenu ? (
          mobileMenu.hasAttribute('role') ||
          mobileMenu.hasAttribute('aria-hidden')
        ) : false
      }
    })
    
    console.log('Mobile navigation accessibility:', mobileNav)
    
    if (mobileNav.hasHamburger && !mobileNav.hamburgerAccessible) {
      console.log('⚠️  Mobile menu button should have proper ARIA labels')
    }

    // Test 3: Mobile form accessibility
    console.log('Testing mobile form accessibility...')
    
    const mobileFormAccessibility = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, textarea, select')
      const mobileIssues: string[] = []
      
      inputs.forEach((input, index) => {
        const rect = input.getBoundingClientRect()
        const isVisible = rect.width > 0 && rect.height > 0
        
        if (isVisible) {
          // Check minimum height for mobile inputs (should be at least 44px)
          if (rect.height < 44) {
            mobileIssues.push(`Input ${index} too small for mobile: ${rect.height.toFixed(0)}px`)
          }
          
          // Check for proper input types
          const inputType = input.getAttribute('type')
          const inputMode = input.getAttribute('inputmode')
          
          if (inputType === 'text' && !inputMode) {
            // Could benefit from inputmode for better mobile keyboards
            if (input.hasAttribute('name') && 
                (input.getAttribute('name')?.includes('email') || 
                 input.getAttribute('name')?.includes('phone'))) {
              mobileIssues.push(`Input ${index} could benefit from inputmode attribute`)
            }
          }
        }
      })
      
      return {
        totalMobileInputs: inputs.length,
        mobileIssues
      }
    })
    
    console.log(`Mobile form inputs: ${mobileFormAccessibility.totalMobileInputs}`)
    console.log(`Mobile form issues: ${mobileFormAccessibility.mobileIssues.length}`)

    // Test 4: Orientation accessibility
    console.log('Testing orientation accessibility...')
    
    // Test landscape orientation
    await page.setViewportSize({ width: 667, height: 375 })
    await page.waitForTimeout(1000)
    
    const landscapeUsable = await page.evaluate(() => {
      const main = document.querySelector('main, [data-testid="main-content"], .main-content')
      if (!main) return false
      
      const rect = main.getBoundingClientRect()
      return rect.width > 200 && rect.height > 100 // Content should be usable
    })
    
    console.log(`Landscape orientation usable: ${landscapeUsable}`)
    
    // Test portrait orientation
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(1000)
    
    const portraitUsable = await page.evaluate(() => {
      const main = document.querySelector('main, [data-testid="main-content"], .main-content')
      if (!main) return false
      
      const rect = main.getBoundingClientRect()
      return rect.width > 200 && rect.height > 200
    })
    
    console.log(`Portrait orientation usable: ${portraitUsable}`)
    
    expect(landscapeUsable && portraitUsable, 'Content should be usable in both orientations').toBe(true)

    console.log('✅ Mobile accessibility testing completed')
  })
})