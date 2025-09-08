/// <reference types="cypress" />

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
      mockApiResponse(method: string, url: string, response: any): Chainable<Element>

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
      simulateWebSocketMessage(type: string, data: any): Chainable<Element>

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

Cypress.Commands.add('mockApiResponse', (method: string, url: string, response: any) => {
  cy.intercept(method as any, url, response)
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

Cypress.Commands.add('simulateWebSocketMessage', (type: string, data: any) => {
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
  })
})

// Handle uncaught exceptions to prevent test failures from application errors
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test
  // for certain types of application errors
  if (err.message.includes('Network Error') || 
      err.message.includes('ResizeObserver loop limit exceeded') ||
      err.message.includes('WebSocket connection failed') ||
      err.message.includes('Non-Error promise rejection captured')) {
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
})

export {}