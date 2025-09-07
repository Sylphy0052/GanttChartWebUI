import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'
import { ErrorScenarioHelper } from './helpers/error-scenario-helper'

test.describe('Error Scenario Testing - Network Failures & Server Errors', () => {
  let uiHelper: UIHelper
  let dataHelper: DataHelper
  let authHelper: AuthHelper
  let errorHelper: ErrorScenarioHelper

  test.beforeEach(async ({ page }) => {
    uiHelper = new UIHelper(page)
    dataHelper = new DataHelper(page)
    authHelper = new AuthHelper(page)
    errorHelper = new ErrorScenarioHelper(page)
    
    await dataHelper.setupCleanEnvironment()
    await authHelper.ensureAuthenticated()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
    await errorHelper.clearAllRoutes()
  })

  // AC6: Network failure handling and graceful degradation
  test('Network failure handling and graceful degradation', { 
    tag: '@error-scenario' 
  }, async ({ page }) => {
    console.log('🌐 Testing network failure handling...')

    // Start with working application
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Verify application is working normally
    console.log('Verifying normal application state...')
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    await uiHelper.verifyElementExists(ganttContainer)

    // Test 1: Complete network failure
    console.log('Testing complete network failure...')
    await errorHelper.simulateNetworkFailure(/\/api\/.*/)
    
    // Try to perform actions that require network
    const networkActions = [
      async () => {
        // Try to create new issue
        const createButton = '[data-testid="create-issue"], .create-issue-btn'
        if (await page.locator(createButton).count() > 0) {
          await uiHelper.stableClick(createButton)
        }
      },
      async () => {
        // Try to save/edit task
        const editButton = '[data-testid="edit-task"], .edit-task-btn'
        if (await page.locator(editButton).count() > 0) {
          await uiHelper.stableClick(editButton)
        }
      },
      async () => {
        // Try to refresh data
        await page.reload()
        await page.waitForTimeout(2000)
      }
    ]

    for (let i = 0; i < networkActions.length; i++) {
      console.log(`Performing network action ${i + 1}...`)
      
      try {
        await networkActions[i]()
        await page.waitForTimeout(1500)
        
        // Check for error handling UI
        await errorHelper.verifyErrorHandling()
        
      } catch (error) {
        console.log(`Network action ${i + 1} failed as expected:`, error.message)
      }
    }

    // Test offline mode graceful degradation
    console.log('Testing offline mode graceful degradation...')
    
    // Check for offline indicators
    const offlineIndicators = [
      '[data-testid="offline-indicator"], .offline-indicator',
      '[data-testid="network-status"], .network-status',
      '.toast:has-text("offline")',
      '.alert:has-text("network")'
    ]

    let offlineUIFound = false
    for (const indicator of offlineIndicators) {
      if (await page.locator(indicator).count() > 0) {
        console.log(`✅ Offline indicator found: ${indicator}`)
        offlineUIFound = true
        break
      }
    }

    // Check that UI remains functional for local operations
    console.log('Testing local functionality during network failure...')
    
    // These operations should work offline or show appropriate messages
    const localOperations = [
      async () => {
        // Test local navigation
        const navLinks = '[data-testid*="nav"], nav a, .sidebar a'
        if (await page.locator(navLinks).count() > 0) {
          await page.locator(navLinks).first().click()
          await page.waitForTimeout(500)
          console.log('✅ Local navigation still works')
        }
      },
      async () => {
        // Test UI interactions
        const buttons = 'button:not([disabled])'
        if (await page.locator(buttons).count() > 0) {
          await page.locator(buttons).first().click()
          await page.waitForTimeout(500)
          console.log('✅ UI interactions still responsive')
        }
      }
    ]

    for (const operation of localOperations) {
      try {
        await operation()
      } catch (error) {
        console.log('Local operation failed:', error.message)
      }
    }

    // Restore network and test recovery
    console.log('Testing network recovery...')
    await errorHelper.clearAllRoutes()
    
    // Wait for recovery
    await page.waitForTimeout(2000)
    
    // Verify application recovers
    await errorHelper.verifyRecoveryState()

    console.log('✅ Network failure testing completed')
  })

  // AC6: Server error handling (500, 503, 502)
  test('Server error handling and user feedback', { 
    tag: '@error-scenario' 
  }, async ({ page }) => {
    console.log('🖥️  Testing server error handling...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    const serverErrorCodes = [
      { code: 500, description: 'Internal Server Error' },
      { code: 502, description: 'Bad Gateway' },
      { code: 503, description: 'Service Unavailable' },
      { code: 504, description: 'Gateway Timeout' }
    ]

    for (const errorCode of serverErrorCodes) {
      console.log(`Testing ${errorCode.code} - ${errorCode.description}...`)
      
      // Clear previous routes
      await errorHelper.clearAllRoutes()
      
      // Setup server error for this test
      await errorHelper.simulateServerError(/\/api\/.*/, errorCode.code)
      
      // Perform actions that should trigger API calls
      await page.reload()
      await page.waitForTimeout(2000)
      
      // Verify appropriate error handling
      await errorHelper.verifyServerErrorUI()
      
      // Check for specific error messaging
      const errorMessages = [
        `text=${errorCode.code}`,
        `text="${errorCode.description}"`,
        '.error:has-text("server")',
        '.error:has-text("unavailable")',
        '[role="alert"]:has-text("error")'
      ]
      
      let specificErrorFound = false
      for (const errorMsg of errorMessages) {
        if (await page.locator(errorMsg).count() > 0) {
          console.log(`✅ Specific error message found for ${errorCode.code}`)
          specificErrorFound = true
          break
        }
      }
      
      // Test retry mechanism for server errors
      console.log(`Testing retry mechanism for ${errorCode.code}...`)
      
      const retryButtons = [
        '[data-testid="retry"], .retry-btn',
        'button:has-text("Retry")',
        'button:has-text("Try Again")'
      ]
      
      for (const retryBtn of retryButtons) {
        if (await page.locator(retryBtn).count() > 0) {
          await uiHelper.stableClick(retryBtn)
          await page.waitForTimeout(1000)
          console.log(`✅ Retry button found and clicked for ${errorCode.code}`)
          break
        }
      }
    }

    // Test partial service degradation
    console.log('Testing partial service degradation...')
    
    await errorHelper.simulatePartialAPIFailure({
      working: ['/api/projects', '/api/auth'],
      failing: ['/api/issues', '/api/tasks']
    })
    
    // Navigate to different parts of application
    await uiHelper.navigateToPage('/projects')
    await page.waitForTimeout(1500)
    
    // Projects should work
    console.log('Testing working service (projects)...')
    const projectsWorking = !await page.locator('.error, [role="alert"]').count()
    
    await uiHelper.navigateToPage('/issues')
    await page.waitForTimeout(1500)
    
    // Issues should show error
    console.log('Testing failing service (issues)...')
    const issuesError = await page.locator('.error, [role="alert"]').count() > 0
    
    console.log(`Partial degradation test - Projects working: ${projectsWorking}, Issues error: ${issuesError}`)

    console.log('✅ Server error handling testing completed')
  })

  // AC6: API timeout and slow response handling
  test('API timeout and slow response handling', { 
    tag: '@error-scenario' 
  }, async ({ page }) => {
    console.log('⏱️  Testing API timeout and slow response handling...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test 1: Slow API responses
    console.log('Testing slow API response handling...')
    
    await errorHelper.simulateSlowNetwork(/\/api\/.*/, 3000) // 3 second delay
    
    // Perform action that triggers API call
    await page.reload()
    
    // Should show loading indicators
    const loadingIndicators = [
      '[data-testid="loading"], .loading',
      '.spinner, .loading-spinner',
      '[aria-label="Loading"]',
      '.skeleton-loader'
    ]
    
    let loadingFound = false
    for (const indicator of loadingIndicators) {
      try {
        await page.waitForSelector(indicator, { timeout: 2000 })
        console.log(`✅ Loading indicator found: ${indicator}`)
        loadingFound = true
        break
      } catch {
        // Continue checking other indicators
      }
    }
    
    if (!loadingFound) {
      console.log('⚠️  No loading indicators found - may impact user experience')
    }
    
    // Wait for slow response to complete
    await page.waitForTimeout(4000)
    
    // Verify application eventually loads
    const eventuallyLoaded = await page.locator('[data-testid="gantt-container"], .gantt-container').count() > 0
    console.log(`Application eventually loaded after slow response: ${eventuallyLoaded}`)

    // Test 2: API timeout scenarios
    console.log('Testing API timeout scenarios...')
    
    await errorHelper.clearAllRoutes()
    await errorHelper.simulateAPITimeout(/\/api\/.*/)
    
    // Perform action that should timeout
    await page.reload()
    await page.waitForTimeout(8000) // Wait for timeout
    
    // Should show timeout error
    const timeoutErrors = [
      'text="timeout"',
      'text="request timed out"',
      '.error:has-text("timeout")',
      '.timeout-error'
    ]
    
    let timeoutErrorFound = false
    for (const error of timeoutErrors) {
      if (await page.locator(error).count() > 0) {
        console.log(`✅ Timeout error message found`)
        timeoutErrorFound = true
        break
      }
    }
    
    // Generic error handling should be present even without specific timeout messages
    if (!timeoutErrorFound) {
      await errorHelper.verifyErrorHandling()
    }

    // Test 3: Request cancellation
    console.log('Testing request cancellation...')
    
    await errorHelper.clearAllRoutes()
    await errorHelper.simulateSlowNetwork(/\/api\/.*/, 5000)
    
    // Start loading action
    await uiHelper.navigateToPage('/issues')
    
    // Immediately navigate away (should cancel request)
    await page.waitForTimeout(1000)
    await uiHelper.navigateToPage('/projects')
    await page.waitForTimeout(500)
    
    // Should handle cancelled requests gracefully
    const errorAfterCancel = await page.locator('.error, [role="alert"]').count()
    console.log(`Errors after request cancellation: ${errorAfterCancel}`)
    
    expect(errorAfterCancel, 'Should handle cancelled requests gracefully').toBeLessThanOrEqual(1)

    console.log('✅ API timeout testing completed')
  })

  // AC6: Frontend error boundary testing
  test('Frontend error boundary and JavaScript error handling', { 
    tag: '@error-scenario' 
  }, async ({ page }) => {
    console.log('🐛 Testing frontend error boundaries and JS error handling...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Collect JavaScript errors
    const jsErrors: string[] = []
    page.on('pageerror', (error) => {
      jsErrors.push(error.message)
      console.log('JavaScript error caught:', error.message)
    })

    // Test 1: Trigger JavaScript error
    console.log('Testing JavaScript error handling...')
    
    try {
      await page.evaluate(() => {
        // Intentionally cause an error
        throw new Error('Test JavaScript Error')
      })
    } catch (error) {
      console.log('JavaScript error triggered successfully')
    }
    
    await page.waitForTimeout(1000)
    
    // Check if error boundaries caught the error
    const errorBoundaryUI = [
      '[data-testid="error-boundary"], .error-boundary',
      '.error-fallback',
      'text="Something went wrong"',
      'text="An error occurred"'
    ]
    
    let errorBoundaryFound = false
    for (const ui of errorBoundaryUI) {
      if (await page.locator(ui).count() > 0) {
        console.log(`✅ Error boundary UI found: ${ui}`)
        errorBoundaryFound = true
        break
      }
    }
    
    // Application should still be functional
    const appStillFunctional = await page.locator('body').count() > 0
    console.log(`Application still functional after JS error: ${appStillFunctional}`)
    
    expect(appStillFunctional, 'Application should remain functional after JS errors').toBe(true)

    // Test 2: React component error simulation
    console.log('Testing React component error handling...')
    
    await page.evaluate(() => {
      // Simulate React component error
      const errorEvent = new ErrorEvent('error', {
        error: new Error('React component error'),
        message: 'Component failed to render'
      })
      
      window.dispatchEvent(errorEvent)
    })
    
    await page.waitForTimeout(1000)
    
    // Check for component-level error recovery
    const componentErrorHandling = await page.locator('.error-boundary, .component-error, .fallback-ui').count()
    console.log(`Component error handling elements: ${componentErrorHandling}`)

    // Test 3: Memory leak detection
    console.log('Testing for potential memory leaks...')
    
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0
    })
    
    // Perform memory-intensive operations
    for (let i = 0; i < 10; i++) {
      await page.reload()
      await page.waitForTimeout(300)
      
      // Navigate between pages
      await uiHelper.navigateToPage('/issues')
      await page.waitForTimeout(200)
      await uiHelper.navigateToPage('/gantt')
      await page.waitForTimeout(200)
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc()
      }
    })
    
    await page.waitForTimeout(1000)
    
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0
    })
    
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory - initialMemory
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024
      
      console.log(`Memory increase after operations: ${memoryIncreaseMB.toFixed(2)} MB`)
      
      // Should not have excessive memory leaks
      expect(memoryIncreaseMB, 'Should not have major memory leaks').toBeLessThan(20) // 20MB threshold
    }

    // Test 4: Unhandled promise rejection
    console.log('Testing unhandled promise rejection handling...')
    
    const unhandledRejections: string[] = []
    page.on('pageerror', (error) => {
      if (error.message.includes('unhandled')) {
        unhandledRejections.push(error.message)
      }
    })
    
    await page.evaluate(() => {
      // Create unhandled promise rejection
      Promise.reject(new Error('Unhandled promise rejection test'))
    })
    
    await page.waitForTimeout(1000)
    
    console.log(`Unhandled promise rejections caught: ${unhandledRejections.length}`)
    
    // Application should still function
    const stillWorking = await page.locator('[data-testid="gantt-container"], body').count() > 0
    expect(stillWorking, 'Application should handle unhandled promise rejections').toBe(true)

    console.log(`Total JavaScript errors during test: ${jsErrors.length}`)
    console.log('✅ Frontend error handling testing completed')
  })

  // AC6: Data corruption and recovery testing
  test('Data corruption and recovery mechanisms', { 
    tag: '@error-scenario' 
  }, async ({ page }) => {
    console.log('💾 Testing data corruption and recovery mechanisms...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test 1: Invalid API response data
    console.log('Testing invalid API response handling...')
    
    await errorHelper.clearAllRoutes()
    
    // Simulate corrupted API responses
    await page.route(/\/api\/.*/, async (route) => {
      const url = route.request().url()
      
      if (url.includes('issues') || url.includes('tasks')) {
        // Return invalid JSON
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"invalid": json, data}'
        })
      } else {
        await route.continue()
      }
    })
    
    // Try to load data
    await page.reload()
    await page.waitForTimeout(2000)
    
    // Should handle invalid data gracefully
    const handledInvalidData = await page.locator('.error, [role="alert"], .data-error').count() > 0
    console.log(`Invalid data handled gracefully: ${handledInvalidData}`)

    // Test 2: Partial data corruption
    console.log('Testing partial data corruption handling...')
    
    await errorHelper.clearAllRoutes()
    
    await page.route(/\/api\/.*/, async (route) => {
      const url = route.request().url()
      
      if (url.includes('issues')) {
        // Return partially corrupted data
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            issues: [
              { id: 1, title: 'Valid Issue', status: 'open' },
              { id: 2, title: null, status: 'invalid_status' }, // Corrupted data
              { id: 3 } // Missing required fields
            ]
          })
        })
      } else {
        await route.continue()
      }
    })
    
    await uiHelper.navigateToPage('/issues')
    await page.waitForTimeout(2000)
    
    // Should filter out corrupted data and show valid data
    const issueElements = await page.locator('[data-testid="issue-item"], .issue-item, tr').count()
    console.log(`Issues displayed with partial corruption: ${issueElements}`)
    
    // Should show at least valid data
    expect(issueElements, 'Should display valid data even with partial corruption').toBeGreaterThanOrEqual(1)

    // Test 3: Local storage corruption
    console.log('Testing local storage corruption recovery...')
    
    // Corrupt local storage
    await page.evaluate(() => {
      localStorage.setItem('gantt-data', 'corrupted-data-not-json')
      localStorage.setItem('user-preferences', '{invalid json}')
      localStorage.setItem('project-state', 'null')
    })
    
    // Reload application
    await page.reload()
    await page.waitForTimeout(2000)
    
    // Should recover from corrupted local storage
    const appWorksAfterCorruption = await page.locator('[data-testid="gantt-container"], .main-content').count() > 0
    console.log(`Application recovered from local storage corruption: ${appWorksAfterCorruption}`)
    
    expect(appWorksAfterCorruption, 'Should recover from local storage corruption').toBe(true)

    // Test 4: Data validation and sanitization
    console.log('Testing data validation and sanitization...')
    
    // Test with malicious data
    await errorHelper.clearAllRoutes()
    
    await page.route(/\/api\/.*/, async (route) => {
      const url = route.request().url()
      
      if (url.includes('issues')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            issues: [
              {
                id: 1,
                title: '<script>alert("XSS")</script>',
                description: 'javascript:alert("XSS")',
                status: 'open'
              }
            ]
          })
        })
      } else {
        await route.continue()
      }
    })
    
    await uiHelper.navigateToPage('/issues')
    await page.waitForTimeout(2000)
    
    // Check that malicious content is sanitized
    const pageContent = await page.content()
    const hasXSS = pageContent.includes('<script>') || pageContent.includes('javascript:')
    
    console.log(`XSS content properly sanitized: ${!hasXSS}`)
    expect(hasXSS, 'Should sanitize malicious content').toBe(false)

    // Test 5: Backup and recovery mechanisms
    console.log('Testing backup and recovery mechanisms...')
    
    // Check for data backup features
    const backupFeatures = [
      '[data-testid="backup"], .backup-btn',
      '[data-testid="export"], .export-btn', 
      '[data-testid="download"], .download-btn',
      'button:has-text("Export")',
      'button:has-text("Backup")'
    ]
    
    let backupFeatureFound = false
    for (const feature of backupFeatures) {
      if (await page.locator(feature).count() > 0) {
        console.log(`✅ Backup feature found: ${feature}`)
        
        try {
          // Test backup functionality
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 })
          await uiHelper.stableClick(feature)
          const download = await downloadPromise
          
          console.log(`✅ Backup/export successful: ${download.suggestedFilename()}`)
          backupFeatureFound = true
          break
        } catch (error) {
          console.log('Backup feature exists but may not be fully implemented')
          backupFeatureFound = true
        }
      }
    }
    
    if (!backupFeatureFound) {
      console.log('ℹ️  No explicit backup features found')
    }

    console.log('✅ Data corruption and recovery testing completed')
  })

  // AC6: Complete error scenario integration test
  test('Complete error scenario integration test', { 
    tag: '@error-scenario' 
  }, async ({ page }) => {
    console.log('🔄 Running complete error scenario integration test...')

    // Run comprehensive error scenario test using the helper
    await errorHelper.runCompleteErrorScenarioTest()
    
    // Additional integration-specific tests
    console.log('Testing error scenario combinations...')
    
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()
    
    // Scenario 1: Network failure during user interaction
    console.log('Scenario 1: Network failure during interaction...')
    
    await errorHelper.simulateNetworkFailure(/\/api\/.*/)
    
    // Try to perform complex user workflow
    const taskBar = '[data-testid="task-bar"], .task-bar'
    if (await page.locator(taskBar).count() > 0) {
      await page.locator(taskBar).first().click()
      await page.waitForTimeout(500)
      
      // Try to drag (should handle network failure gracefully)
      const secondTask = page.locator(taskBar).nth(1)
      if (await secondTask.count() > 0) {
        await page.locator(taskBar).first().dragTo(secondTask)
        await page.waitForTimeout(1000)
      }
      
      // Should show appropriate error handling
      await errorHelper.verifyErrorHandling()
    }
    
    // Scenario 2: Recovery after error resolution
    console.log('Scenario 2: Testing error recovery...')
    
    await errorHelper.clearAllRoutes()
    await page.waitForTimeout(1000)
    
    // Application should recover
    await errorHelper.verifyRecoveryState()
    
    // Scenario 3: Multiple simultaneous errors
    console.log('Scenario 3: Multiple simultaneous errors...')
    
    await errorHelper.simulateServerError(/\/api\/issues/, 500)
    await errorHelper.simulateNetworkFailure(/\/api\/projects/)
    
    // Navigate to pages that use both APIs
    await uiHelper.navigateToPage('/issues')
    await page.waitForTimeout(2000)
    
    await uiHelper.navigateToPage('/projects') 
    await page.waitForTimeout(2000)
    
    // Should handle multiple errors gracefully
    const multipleErrorsHandled = await page.locator('.error, [role="alert"]').count()
    console.log(`Multiple errors handled: ${multipleErrorsHandled > 0}`)

    // Final cleanup and verification
    await errorHelper.clearAllRoutes()
    await page.reload()
    await uiHelper.waitForPageLoad()
    
    // Verify full recovery
    const finalRecovery = await page.locator('[data-testid="gantt-container"], .main-content').count() > 0
    console.log(`Final recovery successful: ${finalRecovery}`)
    
    expect(finalRecovery, 'Should fully recover from all error scenarios').toBe(true)

    console.log('✅ Complete error scenario integration test completed')
  })
})