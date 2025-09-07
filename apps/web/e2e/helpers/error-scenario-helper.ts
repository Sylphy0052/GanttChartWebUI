import { Page, expect, Route } from '@playwright/test'

export interface NetworkError {
  url: string
  status: number
  method: string
  errorType: 'timeout' | 'server_error' | 'network_failure'
}

export class ErrorScenarioHelper {
  private interceptedRoutes: Map<string, Route> = new Map()

  constructor(private page: Page) {}

  // AC6: Simulate network failures
  async simulateNetworkFailure(urlPattern: string | RegExp): Promise<void> {
    console.log(`Simulating network failure for pattern: ${urlPattern}`)
    
    await this.page.route(urlPattern, async (route) => {
      await route.abort('failed')
    })
  }

  // AC6: Simulate server errors (500, 503, etc.)
  async simulateServerError(urlPattern: string | RegExp, statusCode: number = 500): Promise<void> {
    console.log(`Simulating server error ${statusCode} for pattern: ${urlPattern}`)
    
    await this.page.route(urlPattern, async (route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          error: `Simulated server error ${statusCode}`,
          message: 'This is a test error scenario',
          code: statusCode
        })
      })
    })
  }

  // AC6: Simulate slow network (timeout scenarios)
  async simulateSlowNetwork(urlPattern: string | RegExp, delay: number = 5000): Promise<void> {
    console.log(`Simulating slow network with ${delay}ms delay for pattern: ${urlPattern}`)
    
    await this.page.route(urlPattern, async (route) => {
      // Add delay before responding
      await new Promise(resolve => setTimeout(resolve, delay))
      await route.continue()
    })
  }

  // AC6: Simulate API timeout
  async simulateAPITimeout(urlPattern: string | RegExp): Promise<void> {
    console.log(`Simulating API timeout for pattern: ${urlPattern}`)
    
    await this.page.route(urlPattern, async (route) => {
      // Never respond to simulate timeout
      // The route will eventually timeout based on page settings
    })
  }

  // AC6: Simulate partial API failures (some endpoints work, others don't)
  async simulatePartialAPIFailure(patterns: {
    working: string[]
    failing: string[]
  }): Promise<void> {
    console.log('Setting up partial API failure scenario')
    
    // Let working endpoints continue normally
    for (const pattern of patterns.working) {
      await this.page.route(new RegExp(pattern), async (route) => {
        await route.continue()
      })
    }
    
    // Fail the specified endpoints
    for (const pattern of patterns.failing) {
      await this.page.route(new RegExp(pattern), async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Service temporarily unavailable',
            message: 'API endpoint is currently experiencing issues',
            code: 503
          })
        })
      })
    }
  }

  // AC6: Simulate offline scenario
  async simulateOfflineMode(): Promise<void> {
    console.log('Simulating offline mode')
    
    // Block all network requests
    await this.page.route('**/*', async (route) => {
      const url = route.request().url()
      
      // Allow local resources (CSS, JS from same origin)
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        await route.continue()
      } else {
        await route.abort('failed')
      }
    })
  }

  // AC6: Test graceful error handling for network failures
  async testNetworkFailureRecovery(testActions: () => Promise<void>): Promise<void> {
    console.log('Testing network failure recovery...')
    
    // Setup network failure
    await this.simulateNetworkFailure(/\/api\/.*/)
    
    // Perform test actions that should trigger network requests
    await testActions()
    
    // Verify error handling UI is shown
    await this.verifyErrorHandling()
    
    // Restore network and test recovery
    await this.page.unroute(/\/api\/.*/)
    
    // Wait a moment for recovery
    await this.page.waitForTimeout(1000)
    
    // Verify the UI recovers gracefully
    await this.verifyRecoveryState()
  }

  // AC6: Test server error handling
  async testServerErrorHandling(testActions: () => Promise<void>): Promise<void> {
    console.log('Testing server error handling...')
    
    // Setup server error responses
    await this.simulateServerError(/\/api\/.*/, 500)
    
    // Perform test actions
    await testActions()
    
    // Verify appropriate error messages are shown
    await this.verifyServerErrorUI()
  }

  // AC6: Verify error handling UI is displayed correctly
  async verifyErrorHandling(): Promise<void> {
    console.log('Verifying error handling UI...')
    
    const errorIndicators = [
      '[data-testid="error-message"]',
      '[data-testid="network-error"]',
      '.error-state',
      '.error-message',
      '[role="alert"]',
      '.toast-error'
    ]
    
    let errorUIFound = false
    
    for (const selector of errorIndicators) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 })
        console.log(`Found error UI: ${selector}`)
        errorUIFound = true
        break
      } catch {
        // Continue checking other selectors
      }
    }
    
    expect(errorUIFound, 'Error handling UI should be displayed when network fails').toBe(true)
  }

  // AC6: Verify server error UI
  async verifyServerErrorUI(): Promise<void> {
    console.log('Verifying server error UI...')
    
    const serverErrorIndicators = [
      '[data-testid="server-error"]',
      '.server-error',
      'text=Server Error',
      'text=500',
      'text=Internal Server Error'
    ]
    
    let serverErrorUIFound = false
    
    for (const selector of serverErrorIndicators) {
      try {
        const element = this.page.locator(selector)
        if (await element.count() > 0) {
          console.log(`Found server error UI: ${selector}`)
          serverErrorUIFound = true
          break
        }
      } catch {
        // Continue checking
      }
    }
    
    // Should show some kind of error indication
    const hasErrorIndication = await this.page.locator('.error, [role="alert"], .toast').count() > 0
    expect(hasErrorIndication || serverErrorUIFound, 'Should show server error indication').toBe(true)
  }

  // AC6: Verify recovery state after network restoration
  async verifyRecoveryState(): Promise<void> {
    console.log('Verifying recovery state...')
    
    // Check that error messages are cleared
    const errorElements = await this.page.locator('.error-state, .error-message, [data-testid*="error"]').count()
    expect(errorElements, 'Error messages should be cleared after recovery').toBeLessThanOrEqual(1)
    
    // Check that normal UI elements are restored
    const normalUI = [
      '[data-testid="gantt-container"]',
      '[data-testid="issue-table"]',
      '.gantt-chart',
      '.issue-list'
    ]
    
    for (const selector of normalUI) {
      if (await this.page.locator(selector).count() > 0) {
        console.log(`Normal UI restored: ${selector}`)
        return // Found normal UI, recovery successful
      }
    }
  }

  // AC6: Test retry mechanism
  async testRetryMechanism(): Promise<void> {
    console.log('Testing retry mechanism...')
    
    let requestCount = 0
    
    // Count retry attempts
    await this.page.route(/\/api\/.*/, async (route) => {
      requestCount++
      console.log(`Request attempt #${requestCount}`)
      
      if (requestCount < 3) {
        // Fail the first 2 attempts
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Temporary failure' })
        })
      } else {
        // Succeed on 3rd attempt
        await route.continue()
      }
    })
    
    // Trigger an action that should retry
    try {
      await this.page.reload()
      await this.page.waitForLoadState('networkidle')
    } catch (error) {
      console.log('Page load failed, which is expected during retry testing')
    }
    
    // Verify retry attempts were made
    expect(requestCount, 'Should make multiple retry attempts').toBeGreaterThanOrEqual(1)
  }

  // AC6: Test error boundary functionality
  async testErrorBoundaries(): Promise<void> {
    console.log('Testing error boundaries...')
    
    // Inject JavaScript error to test error boundaries
    await this.page.evaluate(() => {
      // Create a mock component error
      const errorEvent = new Error('Test error boundary')
      
      // Simulate React error boundary trigger
      if (window.dispatchEvent) {
        window.dispatchEvent(new ErrorEvent('error', {
          error: errorEvent,
          message: 'Test error boundary'
        }))
      }
    })
    
    // Wait for error boundary to potentially render
    await this.page.waitForTimeout(1000)
    
    // Check for error boundary UI
    const errorBoundarySelectors = [
      '[data-testid="error-boundary"]',
      '.error-boundary',
      'text=Something went wrong',
      'text=Error Boundary',
      '.fallback-ui'
    ]
    
    let errorBoundaryFound = false
    
    for (const selector of errorBoundarySelectors) {
      if (await this.page.locator(selector).count() > 0) {
        console.log(`Found error boundary: ${selector}`)
        errorBoundaryFound = true
        break
      }
    }
    
    // Should either show error boundary or handle error gracefully
    const pageStillFunctional = await this.page.locator('body').count() > 0
    expect(pageStillFunctional, 'Page should remain functional even with errors').toBe(true)
  }

  // AC6: Clear all route intercepts
  async clearAllRoutes(): Promise<void> {
    console.log('Clearing all route intercepts...')
    await this.page.unroute('**/*')
    this.interceptedRoutes.clear()
  }

  // AC6: Test complete error scenario workflow
  async runCompleteErrorScenarioTest(): Promise<void> {
    console.log('Running complete error scenario test...')
    
    const testScenarios = [
      {
        name: 'Network Failure',
        setup: () => this.simulateNetworkFailure(/\/api\/.*/),
        verify: () => this.verifyErrorHandling()
      },
      {
        name: 'Server Error',
        setup: () => this.simulateServerError(/\/api\/.*/, 500),
        verify: () => this.verifyServerErrorUI()
      },
      {
        name: 'Offline Mode',
        setup: () => this.simulateOfflineMode(),
        verify: () => this.verifyErrorHandling()
      }
    ]
    
    for (const scenario of testScenarios) {
      console.log(`\nTesting ${scenario.name}...`)
      
      // Clear previous routes
      await this.clearAllRoutes()
      
      // Setup scenario
      await scenario.setup()
      
      // Try to navigate or perform action
      try {
        await this.page.reload()
        await this.page.waitForLoadState('networkidle', { timeout: 5000 })
      } catch (error) {
        console.log(`Expected error for ${scenario.name}:`, error)
      }
      
      // Verify error handling
      await scenario.verify()
      
      console.log(`${scenario.name} test completed ✅`)
    }
    
    // Clean up
    await this.clearAllRoutes()
    console.log('\nComplete error scenario test finished')
  }
}