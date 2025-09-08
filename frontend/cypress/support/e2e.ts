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

// Global test hooks
beforeEach(() => {
  // Reset any test state before each test
  cy.clearLocalStorage()
  cy.clearCookies()
})

// Handle uncaught exceptions to prevent test failures from application errors
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false to prevent Cypress from failing the test
  // for certain types of application errors
  if (err.message.includes('Network Error') || 
      err.message.includes('ResizeObserver loop limit exceeded')) {
    return false
  }
})

export {}