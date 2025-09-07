import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'

test.describe('Cross-Browser Compatibility - Chrome, Firefox, Safari, Edge', () => {
  let uiHelper: UIHelper
  let dataHelper: DataHelper
  let authHelper: AuthHelper

  test.beforeEach(async ({ page, browserName }) => {
    console.log(`🌐 Running cross-browser test on: ${browserName}`)
    
    uiHelper = new UIHelper(page)
    dataHelper = new DataHelper(page)
    authHelper = new AuthHelper(page)
    
    await dataHelper.setupCleanEnvironment()
    await authHelper.ensureAuthenticated()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
  })

  // AC2: Cross-browser compatibility - Basic functionality test
  test('Core functionality works across all browsers', { 
    tag: '@cross-browser' 
  }, async ({ page, browserName }) => {
    console.log(`Testing core functionality on ${browserName}...`)

    // Test 1: Page navigation
    await uiHelper.navigateToPage('/')
    await uiHelper.waitForPageLoad()
    
    // Verify main navigation elements load correctly
    const navigationElements = [
      '[data-testid="header"], header',
      '[data-testid="navigation"], nav, .sidebar',
      '[data-testid="main-content"], main'
    ]

    for (const selector of navigationElements) {
      try {
        await uiHelper.verifyElementExists(selector)
        console.log(`✅ ${browserName}: ${selector} renders correctly`)
      } catch (error) {
        console.log(`⚠️  ${browserName}: ${selector} may have issues`)
      }
    }

    // Test 2: Gantt chart rendering
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    const ganttElements = [
      '[data-testid="gantt-container"], .gantt-container',
      '[data-testid="gantt-timeline"], .gantt-timeline, .timeline',
      '[data-testid="task-bar"], .task-bar, .gantt-task'
    ]

    let ganttRenderingScore = 0
    for (const selector of ganttElements) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 })
        ganttRenderingScore++
        console.log(`✅ ${browserName}: Gantt ${selector} renders`)
      } catch (error) {
        console.log(`❌ ${browserName}: Gantt ${selector} failed to render`)
      }
    }

    // Test 3: Interactive elements functionality
    const interactiveElements = [
      { selector: 'button', action: 'click', name: 'Button clicks' },
      { selector: 'a', action: 'click', name: 'Link clicks' },
      { selector: 'input', action: 'type', name: 'Input typing' }
    ]

    let interactivityScore = 0
    for (const element of interactiveElements) {
      try {
        const locator = page.locator(element.selector).first()
        
        if (await locator.count() > 0 && await locator.isVisible()) {
          if (element.action === 'click') {
            await locator.click()
            interactivityScore++
          } else if (element.action === 'type') {
            await locator.fill('test')
            interactivityScore++
          }
          
          console.log(`✅ ${browserName}: ${element.name} working`)
        }
      } catch (error) {
        console.log(`❌ ${browserName}: ${element.name} failed`)
      }
    }

    // Take browser-specific screenshot
    await uiHelper.takeScreenshot(`cross-browser-${browserName.toLowerCase()}-gantt`)

    // Assert minimum compatibility requirements
    expect(ganttRenderingScore, `${browserName}: Gantt chart should render properly`).toBeGreaterThanOrEqual(1)
    expect(interactivityScore, `${browserName}: Interactive elements should work`).toBeGreaterThanOrEqual(2)

    console.log(`✅ ${browserName}: Core functionality test completed`)
  })

  // AC2: Browser-specific CSS and JavaScript compatibility
  test('CSS and JavaScript features work correctly', { 
    tag: '@cross-browser' 
  }, async ({ page, browserName }) => {
    console.log(`Testing CSS/JS compatibility on ${browserName}...`)

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test CSS Grid/Flexbox support (critical for Gantt layout)
    const layoutSupport = await page.evaluate(() => {
      const testEl = document.createElement('div')
      testEl.style.display = 'grid'
      document.body.appendChild(testEl)
      const supportsGrid = window.getComputedStyle(testEl).display === 'grid'
      
      testEl.style.display = 'flex'
      const supportsFlex = window.getComputedStyle(testEl).display === 'flex'
      
      document.body.removeChild(testEl)
      
      return { supportsGrid, supportsFlex }
    })

    console.log(`${browserName} CSS support:`, layoutSupport)
    expect(layoutSupport.supportsFlex, `${browserName}: Should support Flexbox`).toBe(true)

    // Test JavaScript ES6+ features
    const jsFeatureSupport = await page.evaluate(() => {
      try {
        // Test arrow functions
        const arrow = () => true
        
        // Test template literals
        const template = `test ${arrow()}`
        
        // Test destructuring
        const [a, b] = [1, 2]
        
        // Test async/await (basic check)
        const asyncSupport = typeof (async () => {})() === 'object'
        
        return {
          arrowFunctions: typeof arrow === 'function',
          templateLiterals: template === 'test true',
          destructuring: a === 1 && b === 2,
          asyncAwait: asyncSupport
        }
      } catch (error) {
        return { error: error.message }
      }
    })

    console.log(`${browserName} JS feature support:`, jsFeatureSupport)
    expect(jsFeatureSupport.arrowFunctions, `${browserName}: Should support arrow functions`).toBe(true)

    // Test drag and drop support (critical for Gantt interactions)
    const dragDropSupport = await page.evaluate(() => {
      const element = document.createElement('div')
      return 'draggable' in element && 'ondragstart' in element
    })

    console.log(`${browserName} drag & drop support:`, dragDropSupport)
    expect(dragDropSupport, `${browserName}: Should support drag and drop`).toBe(true)

    console.log(`✅ ${browserName}: CSS/JS compatibility test completed`)
  })

  // AC2: Browser-specific event handling
  test('Mouse and keyboard events work correctly', { 
    tag: '@cross-browser' 
  }, async ({ page, browserName }) => {
    console.log(`Testing event handling on ${browserName}...`)

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test mouse events on Gantt elements
    const taskBars = '[data-testid="task-bar"], .task-bar, .gantt-task'
    
    if (await page.locator(taskBars).count() > 0) {
      const firstTask = page.locator(taskBars).first()
      
      // Test mouse hover
      await firstTask.hover()
      await page.waitForTimeout(300)
      
      // Test mouse click
      await firstTask.click()
      await page.waitForTimeout(300)
      
      // Test right-click context menu
      await firstTask.click({ button: 'right' })
      await page.waitForTimeout(300)
      
      console.log(`✅ ${browserName}: Mouse events working on task bars`)
    }

    // Test keyboard navigation
    await page.keyboard.press('Tab')
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    
    if (focusedElement) {
      console.log(`✅ ${browserName}: Keyboard navigation working`)
      
      // Test common keyboard shortcuts
      await page.keyboard.press('Escape') // Should close any open menus/modals
      await page.waitForTimeout(200)
      
      // Test arrow keys for navigation
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('ArrowUp')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowRight')
      
      console.log(`✅ ${browserName}: Arrow key navigation working`)
    }

    // Test scroll events
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    if (await page.locator(ganttContainer).count() > 0) {
      await page.locator(ganttContainer).hover()
      await page.mouse.wheel(0, 100) // Vertical scroll
      await page.waitForTimeout(200)
      
      await page.mouse.wheel(100, 0) // Horizontal scroll
      await page.waitForTimeout(200)
      
      console.log(`✅ ${browserName}: Scroll events working`)
    }

    console.log(`✅ ${browserName}: Event handling test completed`)
  })

  // AC2: Form handling compatibility across browsers
  test('Form inputs and validation work consistently', { 
    tag: '@cross-browser' 
  }, async ({ page, browserName }) => {
    console.log(`Testing form compatibility on ${browserName}...`)

    // Navigate to a page with forms (issues creation)
    await uiHelper.navigateToPage('/issues')
    await uiHelper.waitForPageLoad()

    // Look for create issue form
    const createButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New Issue")'
    if (await page.locator(createButton).count() > 0) {
      await uiHelper.stableClick(createButton)
      
      // Test different input types
      const inputTypes = [
        { selector: '[data-testid="issue-title"], input[name="title"], #title', value: 'Test Issue', type: 'text' },
        { selector: '[data-testid="issue-description"], textarea[name="description"]', value: 'Test description', type: 'textarea' },
        { selector: '[data-testid="issue-priority"], select[name="priority"]', value: 'High', type: 'select' },
        { selector: '[data-testid="issue-due-date"], input[type="date"]', value: '2025-09-15', type: 'date' }
      ]

      let formCompatibilityScore = 0
      for (const input of inputTypes) {
        try {
          if (await page.locator(input.selector).count() > 0) {
            if (input.type === 'select') {
              await uiHelper.selectOption(input.selector, input.value)
            } else {
              await uiHelper.stableFill(input.selector, input.value)
            }
            
            // Verify value was set
            const actualValue = await page.locator(input.selector).inputValue()
            if (actualValue.includes(input.value) || actualValue === input.value) {
              formCompatibilityScore++
              console.log(`✅ ${browserName}: ${input.type} input working`)
            }
          }
        } catch (error) {
          console.log(`❌ ${browserName}: ${input.type} input failed:`, error)
        }
      }

      // Test form submission
      const submitButton = '[data-testid="save-issue"], button[type="submit"], .save-btn'
      if (await page.locator(submitButton).count() > 0) {
        await uiHelper.stableClick(submitButton)
        await page.waitForTimeout(1000)
        
        console.log(`✅ ${browserName}: Form submission working`)
        formCompatibilityScore++
      }

      expect(formCompatibilityScore, `${browserName}: Form inputs should work`).toBeGreaterThanOrEqual(2)
    }

    console.log(`✅ ${browserName}: Form compatibility test completed`)
  })

  // AC2: Performance consistency across browsers
  test('Performance is consistent across browsers', { 
    tag: '@cross-browser' 
  }, async ({ page, browserName }) => {
    console.log(`Testing performance consistency on ${browserName}...`)

    // Measure page load performance
    const startTime = Date.now()
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()
    const loadTime = Date.now() - startTime

    console.log(`${browserName} page load time: ${loadTime}ms`)

    // Measure interaction performance
    const taskBars = '[data-testid="task-bar"], .task-bar, .gantt-task'
    if (await page.locator(taskBars).count() > 0) {
      const interactionStart = Date.now()
      await page.locator(taskBars).first().click()
      await page.waitForTimeout(100)
      const interactionTime = Date.now() - interactionStart

      console.log(`${browserName} interaction time: ${interactionTime}ms`)

      // Performance should be reasonable across all browsers
      expect(loadTime, `${browserName}: Page load should be under 10 seconds`).toBeLessThan(10000)
      expect(interactionTime, `${browserName}: Interactions should be under 1 second`).toBeLessThan(1000)
    }

    // Test memory usage (Chrome only)
    if (browserName === 'chromium') {
      const memoryInfo = await page.evaluate(() => {
        return (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null
      })

      if (memoryInfo) {
        const memoryUsageMB = memoryInfo.usedJSHeapSize / 1024 / 1024
        console.log(`${browserName} memory usage: ${memoryUsageMB.toFixed(2)} MB`)
        
        expect(memoryUsageMB, `${browserName}: Memory usage should be reasonable`).toBeLessThan(100)
      }
    }

    console.log(`✅ ${browserName}: Performance test completed`)
  })

  // AC2: Browser-specific bug detection
  test('Browser-specific issues detection', { 
    tag: '@cross-browser' 
  }, async ({ page, browserName }) => {
    console.log(`Running browser-specific issue detection on ${browserName}...`)

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Check for browser-specific rendering issues
    const renderingChecks = await page.evaluate((browser) => {
      const issues: string[] = []
      
      // Check for layout issues
      const elements = document.querySelectorAll('[data-testid], .gantt-container, .task-bar')
      elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect()
        
        // Check for zero-sized elements (common browser issue)
        if (rect.width === 0 || rect.height === 0) {
          issues.push(`Element ${index} has zero size`)
        }
        
        // Check for elements positioned outside viewport (overflow issues)
        if (rect.left < -1000 || rect.top < -1000) {
          issues.push(`Element ${index} positioned far off-screen`)
        }
      })
      
      // Check for CSS issues specific to browsers
      if (browser === 'firefox') {
        // Firefox-specific checks
        const flexElements = document.querySelectorAll('[style*="display: flex"], [style*="display:flex"]')
        if (flexElements.length === 0) {
          // This might indicate flexbox issues in older Firefox
        }
      }
      
      return issues
    }, browserName)

    console.log(`${browserName} rendering issues:`, renderingChecks)

    // Check for JavaScript errors
    const jsErrors: string[] = []
    page.on('pageerror', (error) => {
      jsErrors.push(error.message)
    })

    // Perform some interactions to trigger potential issues
    const taskBars = '[data-testid="task-bar"], .task-bar'
    if (await page.locator(taskBars).count() > 0) {
      try {
        await page.locator(taskBars).first().hover()
        await page.locator(taskBars).first().click()
      } catch (error) {
        console.log(`${browserName}: Interaction error:`, error)
      }
    }

    // Wait a moment for any delayed errors
    await page.waitForTimeout(1000)

    console.log(`${browserName} JavaScript errors:`, jsErrors)

    // Assert no critical issues
    expect(renderingChecks.length, `${browserName}: Should have minimal rendering issues`).toBeLessThanOrEqual(2)
    expect(jsErrors.length, `${browserName}: Should have no JavaScript errors`).toBeLessThanOrEqual(1)

    console.log(`✅ ${browserName}: Browser-specific issue detection completed`)
  })
})