/// <reference types="cypress" />

describe('Project Management E2E Tests', () => {
  const TEST_API_URL = Cypress.env('backendUrl') || 'http://localhost:3001'
  const TEST_PROJECT_NAME = 'Test Project E2E'
  const TEST_PROJECT_PASSWORD = 'test123'
  const TEST_UPDATED_PROJECT_NAME = 'Updated Test Project'

  beforeEach(() => {
    // Clean up test data before each test
    cy.cleanupTestData()
    
    // Intercept API calls for monitoring
    cy.intercept('GET', `${TEST_API_URL}/api/projects`).as('getProjects')
    cy.intercept('POST', `${TEST_API_URL}/api/projects`).as('createProject')
    cy.intercept('PUT', `${TEST_API_URL}/api/projects/*`).as('updateProject')
    cy.intercept('DELETE', `${TEST_API_URL}/api/projects/*`).as('deleteProject')
    cy.intercept('POST', `${TEST_API_URL}/api/auth/project/*/authenticate`).as('authenticateProject')
    cy.intercept('GET', `${TEST_API_URL}/api/settings/holidays`).as('getSettings')
    cy.intercept('PUT', `${TEST_API_URL}/api/settings/holidays`).as('updateSettings')
  })

  describe('Project List Page', () => {
    it('should display project list page correctly', () => {
      cy.visit('/projects')
      cy.contains('ガントチャート WebUI').should('be.visible')
      cy.contains('プロジェクトを選択してガントチャート管理を開始してください').should('be.visible')
      cy.get('[data-testid="project-list"]').should('be.visible')
      cy.waitForApi('@getProjects')
    })

    it('should handle empty project list', () => {
      // Mock empty response
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects`, [])
      
      cy.visit('/projects')
      cy.contains('プロジェクトがありません').should('be.visible')
      cy.contains('新規作成').should('be.visible')
    })

    it('should handle API error gracefully', () => {
      // Mock API error
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects`, { statusCode: 500, body: { error: 'Server Error' } })
      
      cy.visit('/projects')
      cy.contains('プロジェクトの読み込みに失敗しました').should('be.visible')
      cy.contains('再試行').should('be.visible')
    })
  })

  describe('Project Creation', () => {
    it('should create a new project without password', () => {
      cy.visit('/projects')
      
      // Click create button
      cy.get('[data-testid="create-project-btn"]').click()
      
      // Should navigate to project creation page (mocked behavior)
      cy.url().should('include', '/projects/new')
      
      // Mock successful creation
      const newProject = {
        id: '1',
        name: TEST_PROJECT_NAME,
        description: 'Test project description',
        shared_password_hash: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/projects`, newProject)
      
      // Fill form
      cy.get('[data-testid="project-name-input"]').type(TEST_PROJECT_NAME)
      cy.get('[data-testid="project-description-input"]').type('Test project description')
      cy.get('[data-testid="create-project-submit"]').click()
      
      cy.waitForApi('@createProject')
      cy.get('[data-testid="project-created-success"]').should('be.visible')
    })

    it('should create a password-protected project', () => {
      cy.visit('/projects/new')
      
      const newProject = {
        id: '2',
        name: TEST_PROJECT_NAME,
        description: 'Password protected project',
        shared_password_hash: 'hashed_password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/projects`, newProject)
      
      cy.get('[data-testid="project-name-input"]').type(TEST_PROJECT_NAME)
      cy.get('[data-testid="project-description-input"]').type('Password protected project')
      cy.get('[data-testid="enable-password-checkbox"]').check()
      cy.get('[data-testid="project-password-input"]').type(TEST_PROJECT_PASSWORD)
      cy.get('[data-testid="confirm-password-input"]').type(TEST_PROJECT_PASSWORD)
      cy.get('[data-testid="create-project-submit"]').click()
      
      cy.waitForApi('@createProject')
      cy.get('[data-testid="project-created-success"]').should('be.visible')
    })

    it('should validate form inputs', () => {
      cy.visit('/projects/new')
      
      // Try to submit empty form
      cy.get('[data-testid="create-project-submit"]').click()
      cy.get('[data-testid="project-name-error"]').should('be.visible')
      
      // Test password confirmation mismatch
      cy.get('[data-testid="project-name-input"]').type(TEST_PROJECT_NAME)
      cy.get('[data-testid="enable-password-checkbox"]').check()
      cy.get('[data-testid="project-password-input"]').type(TEST_PROJECT_PASSWORD)
      cy.get('[data-testid="confirm-password-input"]').type('different_password')
      cy.get('[data-testid="create-project-submit"]').click()
      cy.get('[data-testid="password-mismatch-error"]').should('be.visible')
    })
  })

  describe('Project Authentication', () => {
    it('should authenticate with correct password', () => {
      const protectedProject = {
        id: '3',
        name: 'Protected Project',
        shared_password_hash: 'hashed_password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects`, [protectedProject])
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/3/authenticate`, { 
        success: true, 
        role: 'editor' 
      })

      cy.visit('/projects')
      cy.waitForApi('@getProjects')
      
      // Click on protected project
      cy.contains('Protected Project').click()
      
      // Password modal should appear
      cy.get('[data-testid="password-modal"]').should('be.visible')
      cy.get('[data-testid="password-input"]').type(TEST_PROJECT_PASSWORD)
      cy.get('[data-testid="password-submit"]').click()
      
      cy.waitForApi('@authenticateProject')
      cy.get('[data-testid="auth-success"]').should('be.visible')
      
      // Should navigate to project dashboard
      cy.url().should('include', '/projects/3/dashboard')
    })

    it('should handle incorrect password', () => {
      const protectedProject = {
        id: '4',
        name: 'Protected Project 2',
        shared_password_hash: 'hashed_password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects`, [protectedProject])
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/4/authenticate`, { 
        statusCode: 401,
        body: { error: 'Invalid password' }
      })

      cy.visit('/projects')
      cy.contains('Protected Project 2').click()
      
      cy.get('[data-testid="password-input"]').type('wrong_password')
      cy.get('[data-testid="password-submit"]').click()
      
      cy.waitForApi('@authenticateProject')
      cy.get('[data-testid="auth-error"]').should('contain', 'パスワードが正しくありません')
    })

    it('should allow viewer access with viewer password', () => {
      const protectedProject = {
        id: '5',
        name: 'Protected Project 3',
        shared_password_hash: 'hashed_password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects`, [protectedProject])
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/5/authenticate`, { 
        success: true, 
        role: 'viewer' 
      })

      cy.visit('/projects')
      cy.contains('Protected Project 3').click()
      
      cy.get('[data-testid="password-input"]').type('viewer_password')
      cy.get('[data-testid="password-submit"]').click()
      
      cy.waitForApi('@authenticateProject')
      cy.get('[data-testid="auth-success"]').should('be.visible')
      cy.get('[data-testid="role-indicator"]').should('contain', '閲覧者')
    })
  })

  describe('Project Settings', () => {
    it('should update project settings', () => {
      const project = {
        id: '6',
        name: TEST_PROJECT_NAME,
        description: 'Original description',
        shared_password_hash: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const updatedProject = {
        ...project,
        name: TEST_UPDATED_PROJECT_NAME,
        description: 'Updated description',
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/6`, project)
      cy.mockApiResponse('PUT', `${TEST_API_URL}/api/projects/6`, updatedProject)

      cy.visit('/projects/6/settings')
      
      // Update project details
      cy.get('[data-testid="project-name-input"]').clear().type(TEST_UPDATED_PROJECT_NAME)
      cy.get('[data-testid="project-description-input"]').clear().type('Updated description')
      cy.get('[data-testid="save-settings-btn"]').click()
      
      cy.waitForApi('@updateProject')
      cy.get('[data-testid="settings-saved-success"]').should('be.visible')
    })

    it('should update project password', () => {
      const project = {
        id: '7',
        name: 'Project for Password Update',
        shared_password_hash: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const updatedProject = {
        ...project,
        shared_password_hash: 'new_hashed_password',
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/7`, project)
      cy.mockApiResponse('PUT', `${TEST_API_URL}/api/projects/7`, updatedProject)

      cy.visit('/projects/7/settings')
      
      // Enable password protection
      cy.get('[data-testid="enable-password-checkbox"]').check()
      cy.get('[data-testid="new-password-input"]').type('new_password123')
      cy.get('[data-testid="confirm-new-password-input"]').type('new_password123')
      cy.get('[data-testid="save-password-btn"]').click()
      
      cy.waitForApi('@updateProject')
      cy.get('[data-testid="password-updated-success"]').should('be.visible')
    })

    it('should delete project with confirmation', () => {
      const project = {
        id: '8',
        name: 'Project to Delete',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/8`, project)
      cy.mockApiResponse('DELETE', `${TEST_API_URL}/api/projects/8`, { success: true })

      cy.visit('/projects/8/settings')
      
      // Delete project
      cy.get('[data-testid="delete-project-btn"]').click()
      
      // Confirm deletion
      cy.get('[data-testid="delete-confirmation-modal"]').should('be.visible')
      cy.get('[data-testid="confirm-delete-input"]').type('Project to Delete')
      cy.get('[data-testid="confirm-delete-btn"]').click()
      
      cy.waitForApi('@deleteProject')
      cy.url().should('eq', Cypress.config().baseUrl + '/projects')
      cy.get('[data-testid="project-deleted-success"]').should('be.visible')
    })
  })

  describe('Global Settings', () => {
    it('should display and update global settings', () => {
      const currentSettings = {
        is_weekend_saturday_holiday: true,
        is_weekend_sunday_holiday: true,
        fixed_holidays: [
          { date: '2024-01-01', name: '元日' },
          { date: '2024-12-31', name: '大晦日' }
        ]
      }

      const updatedSettings = {
        ...currentSettings,
        is_weekend_saturday_holiday: false,
        fixed_holidays: [
          ...currentSettings.fixed_holidays,
          { date: '2024-07-04', name: 'Independence Day' }
        ]
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/settings/holidays`, currentSettings)
      cy.mockApiResponse('PUT', `${TEST_API_URL}/api/settings/holidays`, updatedSettings)

      cy.visit('/settings')
      cy.waitForApi('@getSettings')
      
      // Verify settings are loaded
      cy.get('[data-testid="saturday-holiday-checkbox"]').should('be.checked')
      cy.get('[data-testid="sunday-holiday-checkbox"]').should('be.checked')
      cy.get('[data-testid="fixed-holidays-list"]').should('contain', '元日')
      
      // Update settings
      cy.get('[data-testid="saturday-holiday-checkbox"]').uncheck()
      
      // Add new holiday
      cy.get('[data-testid="add-holiday-btn"]').click()
      cy.get('[data-testid="holiday-date-input"]').type('2024-07-04')
      cy.get('[data-testid="holiday-name-input"]').type('Independence Day')
      cy.get('[data-testid="confirm-add-holiday-btn"]').click()
      
      // Save settings
      cy.get('[data-testid="save-settings-btn"]').click()
      
      cy.waitForApi('@updateSettings')
      cy.get('[data-testid="settings-saved-success"]').should('be.visible')
    })

    it('should reset settings to defaults', () => {
      const defaultSettings = {
        is_weekend_saturday_holiday: true,
        is_weekend_sunday_holiday: true,
        fixed_holidays: []
      }

      cy.mockApiResponse('PUT', `${TEST_API_URL}/api/settings/holidays`, defaultSettings)

      cy.visit('/settings')
      
      cy.get('[data-testid="reset-settings-btn"]').click()
      cy.get('[data-testid="confirm-reset-modal"]').should('be.visible')
      cy.get('[data-testid="confirm-reset-btn"]').click()
      
      cy.waitForApi('@updateSettings')
      cy.get('[data-testid="settings-reset-success"]').should('be.visible')
    })
  })

  describe('Backup and Restore', () => {
    it('should export project data', () => {
      const project = {
        id: '9',
        name: 'Project for Export',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Mock export endpoint
      cy.intercept('POST', `${TEST_API_URL}/api/backup/export/9`, {
        statusCode: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': 'attachment; filename=project_backup.zip'
        },
        body: 'mock zip content'
      }).as('exportProject')

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/9`, project)

      cy.visit('/projects/9/backup')
      
      cy.get('[data-testid="export-btn"]').click()
      cy.get('[data-testid="export-progress"]').should('be.visible')
      
      cy.waitForApi('@exportProject')
      cy.get('[data-testid="export-success"]').should('be.visible')
      cy.get('[data-testid="download-link"]').should('be.visible')
    })

    it('should import project data', () => {
      // Mock import endpoint
      cy.intercept('POST', `${TEST_API_URL}/api/backup/import`, {
        statusCode: 200,
        body: { success: true, projectId: '10', message: 'Import successful' }
      }).as('importProject')

      cy.visit('/projects/backup')
      
      // Select file for import
      const fileName = 'test_backup.zip'
      cy.get('[data-testid="import-file-input"]').selectFile({
        contents: Cypress.Buffer.from('mock zip content'),
        fileName,
        mimeType: 'application/zip'
      })
      
      cy.get('[data-testid="import-btn"]').click()
      cy.get('[data-testid="import-progress"]').should('be.visible')
      
      cy.waitForApi('@importProject')
      cy.get('[data-testid="import-success"]').should('be.visible')
      cy.get('[data-testid="imported-project-link"]').should('be.visible')
    })

    it('should handle import errors', () => {
      cy.intercept('POST', `${TEST_API_URL}/api/backup/import`, {
        statusCode: 400,
        body: { error: 'Invalid backup file format' }
      }).as('importProjectError')

      cy.visit('/projects/backup')
      
      cy.get('[data-testid="import-file-input"]').selectFile({
        contents: Cypress.Buffer.from('invalid content'),
        fileName: 'invalid.txt',
        mimeType: 'text/plain'
      })
      
      cy.get('[data-testid="import-btn"]').click()
      
      cy.waitForApi('@importProjectError')
      cy.get('[data-testid="import-error"]').should('contain', 'Invalid backup file format')
    })
  })

  describe('Navigation and UI Interactions', () => {
    it('should navigate between pages correctly', () => {
      cy.visit('/')
      
      // Navigate to projects
      cy.get('[data-testid="nav-projects"]').click()
      cy.url().should('include', '/projects')
      
      // Navigate to settings
      cy.get('[data-testid="nav-settings"]').click()
      cy.url().should('include', '/settings')
      
      // Navigate back to home
      cy.get('[data-testid="nav-home"]').click()
      cy.url().should('eq', Cypress.config().baseUrl + '/')
    })

    it('should handle responsive design', () => {
      cy.visit('/projects')
      
      // Test mobile viewport
      cy.viewport('iphone-x')
      cy.get('[data-testid="mobile-menu-btn"]').should('be.visible')
      cy.get('[data-testid="mobile-menu-btn"]').click()
      cy.get('[data-testid="mobile-nav"]').should('be.visible')
      
      // Test tablet viewport
      cy.viewport('ipad-2')
      cy.get('[data-testid="project-grid"]').should('have.class', 'tablet-layout')
      
      // Test desktop viewport
      cy.viewport(1280, 720)
      cy.get('[data-testid="project-grid"]').should('have.class', 'desktop-layout')
    })

    it('should show loading states appropriately', () => {
      // Mock slow API response
      cy.intercept('GET', `${TEST_API_URL}/api/projects`, {
        delay: 2000,
        statusCode: 200,
        body: []
      }).as('slowGetProjects')

      cy.visit('/projects')
      
      cy.get('[data-testid="loading-spinner"]').should('be.visible')
      cy.waitForApi('@slowGetProjects')
      cy.get('[data-testid="loading-spinner"]').should('not.exist')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network failures gracefully', () => {
      // Simulate network failure
      cy.intercept('GET', `${TEST_API_URL}/api/projects`, { forceNetworkError: true }).as('networkError')

      cy.visit('/projects')
      
      cy.waitForApi('@networkError')
      cy.get('[data-testid="network-error"]').should('be.visible')
      cy.get('[data-testid="retry-btn"]').should('be.visible')
    })

    it('should handle session timeout', () => {
      // Mock 401 Unauthorized response
      cy.intercept('GET', `${TEST_API_URL}/api/projects`, {
        statusCode: 401,
        body: { error: 'Session expired' }
      }).as('sessionExpired')

      cy.visit('/projects')
      
      cy.waitForApi('@sessionExpired')
      cy.get('[data-testid="session-expired-modal"]').should('be.visible')
      cy.get('[data-testid="login-again-btn"]').should('be.visible')
    })

    it('should validate file uploads', () => {
      cy.visit('/projects/backup')
      
      // Try to upload invalid file type
      cy.get('[data-testid="import-file-input"]').selectFile({
        contents: Cypress.Buffer.from('not a zip file'),
        fileName: 'test.txt',
        mimeType: 'text/plain'
      })
      
      cy.get('[data-testid="file-type-error"]').should('be.visible')
      
      // Try to upload oversized file
      const largeContent = 'x'.repeat(100 * 1024 * 1024) // 100MB
      cy.get('[data-testid="import-file-input"]').selectFile({
        contents: Cypress.Buffer.from(largeContent),
        fileName: 'large.zip',
        mimeType: 'application/zip'
      })
      
      cy.get('[data-testid="file-size-error"]').should('be.visible')
    })
  })

  // Accessibility tests
  describe('Accessibility', () => {
    it('should be navigable with keyboard', () => {
      cy.visit('/projects')
      
      // Tab through interactive elements
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid', 'create-project-btn')
      
      cy.focused().tab()
      cy.focused().should('have.attr', 'data-testid', 'project-item-1')
      
      // Test ARIA labels and roles
      cy.get('[data-testid="project-list"]').should('have.attr', 'role', 'list')
      cy.get('[data-testid="project-item"]').should('have.attr', 'role', 'listitem')
    })

    it('should have proper focus management in modals', () => {
      const project = {
        id: '11',
        name: 'Focus Test Project',
        shared_password_hash: 'hashed_password',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects`, [project])

      cy.visit('/projects')
      cy.contains('Focus Test Project').click()
      
      // Focus should be trapped in modal
      cy.get('[data-testid="password-modal"]').should('have.attr', 'aria-modal', 'true')
      cy.get('[data-testid="password-input"]').should('be.focused')
      
      // Escape should close modal
      cy.get('body').type('{esc}')
      cy.get('[data-testid="password-modal"]').should('not.exist')
    })
  })
})