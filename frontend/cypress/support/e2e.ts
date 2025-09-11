/// <reference types="cypress" />

// Import WBS-specific custom commands
import './wbs-commands'

// Import Gantt Chart-specific custom commands
import './gantt-commands'

// Import Extended Gantt Chart commands for comprehensive testing
import './gantt-commands-extended'

// Import Cross-browser compatibility utilities
import './browser-utils'

// Add custom commands and support utilities here

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to authenticate with a project password
       * @example cy.authenticateProject('password')
       */
      authenticateProject(password: string): Chainable<Element>

      /**
       * Custom command to create a test project
       * @example cy.createTestProject('Test Project', 'password123')
       */
      createTestProject(name: string, password?: string): Chainable<Element>

      /**
       * Custom command to clean up test data
       * @example cy.cleanupTestData()
       */
      cleanupTestData(): Chainable<Element>

      /**
       * Custom command to mock API responses
       * @example cy.mockApiResponse('GET', '/api/projects', fixture)
       */
      mockApiResponse(method: string, url: string, response: unknown): Chainable<Element>

      /**
       * Custom command to wait for API call completion
       * @example cy.waitForApi('@getProjects')
       */
      waitForApi(alias: string): Chainable<Element>

      /**
       * Custom command to create a test issue
       * @example cy.createTestIssue('Test Issue', 'Bug description')
       */
      createTestIssue(title: string, description?: string, projectId?: string): Chainable<Element>

      /**
       * Custom command to add a comment to an issue
       * @example cy.addIssueComment('This is a test comment')
       */
      addIssueComment(body: string, issueId?: string): Chainable<Element>

      /**
       * Custom command to upload a test file to an issue
       * @example cy.uploadTestFile('test-image.png', 'image/png')
       */
      uploadTestFile(filename: string, mimeType: string, size?: number): Chainable<Element>

      /**
       * Custom command to set user role for testing
       * @example cy.setUserRole('editor')
       */
      setUserRole(role: 'editor' | 'viewer'): Chainable<Element>

      /**
       * Custom command to simulate WebSocket message
       * @example cy.simulateWebSocketMessage('issue_updated', issueData)
       */
      simulateWebSocketMessage(type: string, data: unknown): Chainable<Element>

      /**
       * Custom command to verify issue status display
       * @example cy.verifyIssueStatus('open', 'オープン')
       */
      verifyIssueStatus(status: string, displayText: string): Chainable<Element>

      /**
       * Custom command to check file type validation
       * @example cy.checkFileTypeValidation('malware.exe', false)
       */
      checkFileTypeValidation(filename: string, shouldAllow: boolean): Chainable<Element>

      /**
       * Custom command to measure initial render performance
       * @example cy.measureRenderPerformance('projects-list')
       */
      measureRenderPerformance(target: string): Chainable<number>

      /**
       * Custom command to measure drag operation performance
       * @example cy.measureDragPerformance('wbs-tree-item', () => { cy.drag(...) })
       */
      measureDragPerformance(target: string, dragOperation: () => void): Chainable<number>

      /**
       * Custom command to collect Web Vitals metrics
       * @example cy.collectWebVitals()
       */
      collectWebVitals(): Chainable<unknown>

      /**
       * Custom command to calculate performance statistics
       * @example cy.calculatePerformanceStats(measurements)
       */
      calculatePerformanceStats(measurements: number[]): Chainable<unknown>
    }
  }
}

// Custom command implementations
Cypress.Commands.add('authenticateProject', (password: string) => {
  cy.get('[data-testid="password-input"]').type(password)
  cy.get('[data-testid="password-submit"]').click()
  cy.get('[data-testid="auth-success"]').should('be.visible')
})

Cypress.Commands.add('createTestProject', (name: string, password?: string) => {
  cy.get('[data-testid="create-project-btn"]').click()
  cy.get('[data-testid="project-name-input"]').type(name)
  
  if (password) {
    cy.get('[data-testid="project-password-input"]').type(password)
  }
  
  cy.get('[data-testid="create-project-submit"]').click()
  cy.get('[data-testid="project-created-success"]').should('be.visible')
})

Cypress.Commands.add('cleanupTestData', () => {
  // Implementation would depend on the test data cleanup strategy
  cy.request({
    method: 'DELETE',
    url: `${Cypress.env('backendUrl')}/api/test/cleanup`,
    failOnStatusCode: false
  })
})

Cypress.Commands.add('mockApiResponse', (method: string, url: string, response: unknown) => {
  cy.intercept(method as Cypress.HttpMethod, url, response)
})

Cypress.Commands.add('waitForApi', (alias: string) => {
  cy.wait(alias)
})

// Issue-specific commands
Cypress.Commands.add('createTestIssue', (title: string, description?: string, projectId?: string) => {
  const pid = projectId || 'test-project-123'
  
  cy.visit(`/projects/${pid}/issues/create`)
  cy.get('[data-testid="issue-title-input"]').type(title)
  
  if (description) {
    cy.get('[data-testid="issue-description-textarea"]').type(description)
  }
  
  cy.get('[data-testid="create-issue-submit"]').click()
  cy.get('[data-testid="issue-created-success"]').should('be.visible')
})

Cypress.Commands.add('addIssueComment', (body: string, issueId?: string) => {
  // Assumes we're already on an issue page
  cy.get('[data-testid="new-comment-textarea"]').type(body)
  cy.get('[data-testid="submit-comment-btn"]').click()
  cy.get('[data-testid="comment-created-success"]').should('be.visible')
})

Cypress.Commands.add('uploadTestFile', (filename: string, mimeType: string, size: number = 1024) => {
  const content = 'x'.repeat(size)
  const file = {
    contents: Cypress.Buffer.from(content),
    fileName: filename,
    mimeType: mimeType,
    lastModified: Date.now()
  }
  
  cy.get('[data-testid="file-upload-input"]').selectFile(file, { force: true })
})

Cypress.Commands.add('setUserRole', (role: 'editor' | 'viewer') => {
  cy.window().then((win) => {
    win.localStorage.setItem('userRole', role)
  })
  
  // Mock the authentication API to return the specified role
  cy.mockApiResponse('POST', '*/api/auth/project/*/authenticate', {
    success: true,
    role: role
  })
})

Cypress.Commands.add('simulateWebSocketMessage', (type: string, data: unknown) => {
  cy.window().then((win) => {
    const message = JSON.stringify({ type, data })
    win.dispatchEvent(new CustomEvent('websocket-message', { detail: message }))
  })
})

Cypress.Commands.add('verifyIssueStatus', (status: string, displayText: string) => {
  cy.get(`[data-testid="issue-status-${status}"]`).should('contain', displayText)
})

Cypress.Commands.add('checkFileTypeValidation', (filename: string, shouldAllow: boolean) => {
  const extension = filename.split('.').pop()
  const mimeType = getMimeTypeFromExtension(extension || '')
  
  const file = {
    contents: Cypress.Buffer.from('test content'),
    fileName: filename,
    mimeType: mimeType,
    lastModified: Date.now()
  }
  
  cy.get('[data-testid="file-upload-input"]').selectFile(file, { force: true })
  
  if (shouldAllow) {
    cy.get('[data-testid="file-type-error"]').should('not.exist')
  } else {
    cy.get('[data-testid="file-type-error"]').should('be.visible')
  }
})

// Performance Testing Commands
Cypress.Commands.add('measureRenderPerformance', (target: string) => {
  return cy.window().then((win) => {
    // Performance monitoring setup
    win.performance.clearMarks()
    win.performance.clearMeasures()
    
    const startTime = win.performance.now()
    win.performance.mark(`render-start-${target}`)
    
    return cy.then(() => {
      const endTime = win.performance.now()
      win.performance.mark(`render-end-${target}`)
      win.performance.measure(
        `render-duration-${target}`,
        `render-start-${target}`,
        `render-end-${target}`
      )
      
      const renderTime = endTime - startTime
      cy.log(`Render Performance [${target}]: ${renderTime.toFixed(2)}ms`)
      
      // Store in window object for test access
      const metrics = win.performanceMetrics || []
      metrics.push({
        type: 'render',
        target: target,
        duration: renderTime,
        timestamp: Date.now()
      })
      win.performanceMetrics = metrics
      
      return renderTime
    })
  })
})

Cypress.Commands.add('measureDragPerformance', (target: string, dragOperation: () => void) => {
  return cy.window().then((win) => {
    win.performance.clearMarks()
    win.performance.clearMeasures()
    
    const startTime = win.performance.now()
    win.performance.mark(`drag-start-${target}`)
    
    // Execute the drag operation
    dragOperation()
    
    return cy.then(() => {
      const endTime = win.performance.now()
      win.performance.mark(`drag-end-${target}`)
      win.performance.measure(
        `drag-duration-${target}`,
        `drag-start-${target}`,
        `drag-end-${target}`
      )
      
      const dragLatency = endTime - startTime
      cy.log(`Drag Performance [${target}]: ${dragLatency.toFixed(2)}ms`)
      
      // Store in window object for test access
      const metrics = win.performanceMetrics || []
      metrics.push({
        type: 'drag',
        target: target,
        duration: dragLatency,
        timestamp: Date.now()
      })
      win.performanceMetrics = metrics
      
      return dragLatency
    })
  })
})

Cypress.Commands.add('collectWebVitals', () => {
  return cy.window().then((win) => {
    const webVitals = {
      lcp: null as number | null,
      fid: null as number | null,
      cls: null as number | null,
      ttfb: null as number | null
    }
    
    // LCP (Largest Contentful Paint)
    try {
      const lcpEntries = win.performance.getEntriesByType('largest-contentful-paint')
      if (lcpEntries.length > 0) {
        webVitals.lcp = lcpEntries[lcpEntries.length - 1].startTime
      }
    } catch (error) {
      console.warn('LCP collection failed:', error)
    }
    
    // TTFB (Time to First Byte)
    try {
      const navigationEntry = win.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigationEntry) {
        webVitals.ttfb = navigationEntry.responseStart - navigationEntry.requestStart
      }
    } catch (error) {
      console.warn('TTFB collection failed:', error)
    }
    
    cy.log('Web Vitals:', webVitals)
    return webVitals
  })
})

Cypress.Commands.add('calculatePerformanceStats', (measurements: number[]) => {
  return cy.then(() => {
    if (measurements.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p95: 0,
        std_dev: 0
      }
    }
    
    const sorted = measurements.slice().sort((a, b) => a - b)
    const count = measurements.length
    const sum = measurements.reduce((acc, val) => acc + val, 0)
    const mean = sum / count
    
    // Calculate standard deviation
    const variance = measurements.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count
    const std_dev = Math.sqrt(variance)
    
    const stats = {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      mean,
      median: sorted[Math.floor(count / 2)],
      p95: sorted[Math.floor(count * 0.95)],
      std_dev
    }
    
    cy.log('Performance Statistics:', stats)
    return stats
  })
})

// Helper function to get MIME type from file extension
function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'exe': 'application/x-executable',
    'zip': 'application/zip'
  }
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
}

// Global test hooks
beforeEach(() => {
  // Reset any test state before each test
  cy.clearLocalStorage()
  cy.clearCookies()
  
  // Set default user for tests
  cy.window().then((win) => {
    win.localStorage.setItem('currentUser', 'test-user@example.com')
    // Initialize performance metrics storage
    win.performanceMetrics = []
  })
})

// Handle uncaught exceptions to prevent test failures from application errors
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test
  // for certain types of application errors
  if (err.message.includes('Network Error') || 
      err.message.includes('ResizeObserver loop limit exceeded') ||
      err.message.includes('WebSocket connection failed') ||
      err.message.includes('Non-Error promise rejection captured') ||
      err.message.includes('Canvas2D') ||
      err.message.includes('SVG animation') ||
      err.message.includes('Performance measurement')) {
    return false
  }
})

// Global intercepts for common API endpoints
beforeEach(() => {
  // Intercept WebSocket connections to prevent real connections during tests
  cy.intercept('GET', '**/ws', { fixture: 'websocket-connection.json' })
  
  // Default project authentication mock
  cy.intercept('POST', '**/api/auth/project/*/authenticate', {
    success: true,
    role: 'editor'
  })
  
  // Default user info mock
  cy.intercept('GET', '**/api/user/current', {
    email: 'test-user@example.com',
    name: 'Test User'
  })

  // Health check endpoint
  cy.intercept('GET', '**/api/health', {
    statusCode: 200,
    body: { status: 'OK', timestamp: new Date().toISOString() }
  })
})

export {}