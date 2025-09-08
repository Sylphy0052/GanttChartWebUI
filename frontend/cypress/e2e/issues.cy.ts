/// <reference types="cypress" />

describe('Issue Management E2E Tests', () => {
  const TEST_API_URL = Cypress.env('backendUrl') || 'http://localhost:3001'
  const TEST_PROJECT_ID = 'test-project-123'
  const TEST_ISSUE_TITLE = 'Test Issue E2E'
  const TEST_ISSUE_DESCRIPTION = 'This is a test issue description with **markdown** formatting'
  const TEST_UPDATED_ISSUE_TITLE = 'Updated Test Issue'
  const TEST_ISSUE_ASSIGNEE = 'test-user@example.com'

  beforeEach(() => {
    // Clean up test data before each test
    cy.cleanupTestData()
    
    // Intercept Issue API calls for monitoring
    cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`).as('getIssues')
    cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/*/detail`).as('getIssueDetail')
    cy.intercept('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`).as('createIssue')
    cy.intercept('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/*`).as('updateIssue')
    cy.intercept('DELETE', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/*`).as('deleteIssue')
    
    // WebSocket interceptions for real-time notifications
    cy.intercept('GET', `${TEST_API_URL}/ws`, { fixture: 'websocket-connection.json' }).as('wsConnection')
    
    // Mock project authentication
    cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
      success: true, 
      role: 'editor' 
    })
  })

  describe('Issue List Page', () => {
    it('should display issue list page correctly', () => {
      const mockIssues = [
        {
          id: 'issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'First Issue',
          description_md: 'First issue description',
          status: 'open',
          assignee: TEST_ISSUE_ASSIGNEE,
          progress_pct: 0,
          is_blocked: false,
          labels: ['bug', 'high-priority'],
          sort_order: 1,
          version: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'issue-2',
          project_id: TEST_PROJECT_ID,
          title: 'Second Issue',
          description_md: 'Second issue description',
          status: 'in_progress',
          assignee: null,
          progress_pct: 50,
          is_blocked: false,
          labels: ['feature'],
          sort_order: 2,
          version: 1,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      cy.waitForApi('@getIssues')

      // Check page structure
      cy.contains('Issues').should('be.visible')
      cy.get('[data-testid="issue-list"]').should('be.visible')
      cy.get('[data-testid="create-issue-btn"]').should('be.visible')

      // Check issue items are displayed
      cy.get('[data-testid="issue-item"]').should('have.length', 2)
      cy.contains('First Issue').should('be.visible')
      cy.contains('Second Issue').should('be.visible')

      // Check status labels
      cy.get('[data-testid="issue-status-open"]').should('contain', 'オープン')
      cy.get('[data-testid="issue-status-in_progress"]').should('contain', '進行中')

      // Check labels
      cy.get('[data-testid="issue-label-bug"]').should('be.visible')
      cy.get('[data-testid="issue-label-high-priority"]').should('be.visible')
      cy.get('[data-testid="issue-label-feature"]').should('be.visible')
    })

    it('should handle empty issue list', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, [])
      
      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      cy.waitForApi('@getIssues')

      cy.contains('Issueがありません').should('be.visible')
      cy.get('[data-testid="create-issue-btn"]').should('be.visible')
    })

    it('should filter issues by status', () => {
      const allIssues = [
        { id: '1', status: 'open', title: 'Open Issue', project_id: TEST_PROJECT_ID, progress_pct: 0, is_blocked: false, labels: [], sort_order: 1, version: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
        { id: '2', status: 'done', title: 'Done Issue', project_id: TEST_PROJECT_ID, progress_pct: 100, is_blocked: false, labels: [], sort_order: 2, version: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, allIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      cy.waitForApi('@getIssues')

      // Initially show all issues
      cy.get('[data-testid="issue-item"]').should('have.length', 2)

      // Filter by 'open' status
      cy.get('[data-testid="status-filter-dropdown"]').click()
      cy.get('[data-testid="status-filter-open"]').click()

      cy.get('[data-testid="issue-item"]').should('have.length', 1)
      cy.contains('Open Issue').should('be.visible')
      cy.contains('Done Issue').should('not.exist')
    })

    it('should sort issues by different criteria', () => {
      const issues = [
        { id: '1', title: 'A Issue', created_at: '2024-01-02T00:00:00Z', project_id: TEST_PROJECT_ID, status: 'open', progress_pct: 0, is_blocked: false, labels: [], sort_order: 1, version: 1, updated_at: '2024-01-01T00:00:00Z' },
        { id: '2', title: 'B Issue', created_at: '2024-01-01T00:00:00Z', project_id: TEST_PROJECT_ID, status: 'open', progress_pct: 0, is_blocked: false, labels: [], sort_order: 2, version: 1, updated_at: '2024-01-01T00:00:00Z' }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, issues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      cy.waitForApi('@getIssues')

      // Test sorting by title
      cy.get('[data-testid="sort-dropdown"]').click()
      cy.get('[data-testid="sort-by-title"]').click()

      cy.get('[data-testid="issue-item"]').first().should('contain', 'A Issue')
      cy.get('[data-testid="issue-item"]').last().should('contain', 'B Issue')
    })
  })

  describe('Issue Creation', () => {
    it('should create a new issue successfully', () => {
      const newIssue = {
        id: 'new-issue-123',
        project_id: TEST_PROJECT_ID,
        title: TEST_ISSUE_TITLE,
        description_md: TEST_ISSUE_DESCRIPTION,
        status: 'open',
        assignee: TEST_ISSUE_ASSIGNEE,
        progress_pct: 0,
        is_blocked: false,
        labels: ['feature', 'high-priority'],
        sort_order: 1,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, newIssue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/create`)

      // Fill in the issue form
      cy.get('[data-testid="issue-title-input"]').type(TEST_ISSUE_TITLE)
      cy.get('[data-testid="issue-description-textarea"]').type(TEST_ISSUE_DESCRIPTION)
      cy.get('[data-testid="issue-assignee-input"]').type(TEST_ISSUE_ASSIGNEE)
      
      // Set status
      cy.get('[data-testid="issue-status-select"]').select('open')
      
      // Add labels
      cy.get('[data-testid="add-label-btn"]').click()
      cy.get('[data-testid="label-input"]').type('feature{enter}')
      cy.get('[data-testid="add-label-btn"]').click()
      cy.get('[data-testid="label-input"]').type('high-priority{enter}')

      // Submit form
      cy.get('[data-testid="create-issue-submit"]').click()

      cy.waitForApi('@createIssue')
      cy.get('[data-testid="issue-created-success"]').should('be.visible')
      cy.url().should('include', `/projects/${TEST_PROJECT_ID}/issues/new-issue-123`)
    })

    it('should create child issue', () => {
      const parentIssue = {
        id: 'parent-issue-123',
        title: 'Parent Issue',
        project_id: TEST_PROJECT_ID,
        status: 'open',
        progress_pct: 0,
        is_blocked: false,
        labels: [],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const childIssue = {
        id: 'child-issue-123',
        parent_id: 'parent-issue-123',
        project_id: TEST_PROJECT_ID,
        title: 'Child Issue',
        status: 'open',
        progress_pct: 0,
        is_blocked: false,
        labels: [],
        sort_order: 1,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/parent-issue-123`, parentIssue)
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, childIssue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/parent-issue-123`)
      
      cy.get('[data-testid="add-child-issue-btn"]').click()
      cy.get('[data-testid="issue-title-input"]').type('Child Issue')
      cy.get('[data-testid="create-issue-submit"]').click()

      cy.waitForApi('@createIssue')
      cy.get('[data-testid="child-issue-created-success"]').should('be.visible')
    })

    it('should validate required fields', () => {
      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/create`)

      // Try to submit empty form
      cy.get('[data-testid="create-issue-submit"]').click()
      cy.get('[data-testid="title-error"]').should('contain', 'タイトルは必須です')

      // Enter title but invalid data
      cy.get('[data-testid="issue-title-input"]').type('a')
      cy.get('[data-testid="create-issue-submit"]').click()
      cy.get('[data-testid="title-error"]').should('contain', 'タイトルは2文字以上で入力してください')
    })
  })

  describe('Issue Detail and Edit', () => {
    it('should display issue detail correctly', () => {
      const issueDetail = {
        id: 'detail-issue-123',
        project_id: TEST_PROJECT_ID,
        title: 'Detailed Issue',
        description_md: 'This is a **detailed** issue with `code` and *emphasis*',
        status: 'in_progress',
        assignee: TEST_ISSUE_ASSIGNEE,
        progress_pct: 75,
        effort_hours: 8,
        is_blocked: false,
        labels: ['bug', 'urgent'],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        start_date: '2024-01-01',
        end_date: '2024-01-05',
        comments: [],
        changeLog: [],
        uploadedFiles: []
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/detail-issue-123/detail`, issueDetail)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/detail-issue-123`)
      cy.waitForApi('@getIssueDetail')

      // Check issue details are displayed
      cy.contains('Detailed Issue').should('be.visible')
      cy.get('[data-testid="issue-description"]').should('contain', 'detailed')
      cy.get('[data-testid="issue-status"]').should('contain', '進行中')
      cy.get('[data-testid="issue-assignee"]').should('contain', TEST_ISSUE_ASSIGNEE)
      cy.get('[data-testid="issue-progress"]').should('contain', '75%')
      cy.get('[data-testid="issue-effort"]').should('contain', '8時間')

      // Check labels
      cy.get('[data-testid="issue-label-bug"]').should('be.visible')
      cy.get('[data-testid="issue-label-urgent"]').should('be.visible')

      // Check dates
      cy.get('[data-testid="issue-start-date"]').should('contain', '2024/1/1')
      cy.get('[data-testid="issue-end-date"]').should('contain', '2024/1/5')

      // Check action buttons
      cy.get('[data-testid="edit-issue-btn"]').should('be.visible')
      cy.get('[data-testid="delete-issue-btn"]').should('be.visible')
    })

    it('should update issue successfully', () => {
      const originalIssue = {
        id: 'update-issue-123',
        project_id: TEST_PROJECT_ID,
        title: TEST_ISSUE_TITLE,
        description_md: TEST_ISSUE_DESCRIPTION,
        status: 'open',
        assignee: TEST_ISSUE_ASSIGNEE,
        progress_pct: 0,
        is_blocked: false,
        labels: ['feature'],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const updatedIssue = {
        ...originalIssue,
        title: TEST_UPDATED_ISSUE_TITLE,
        status: 'in_progress',
        progress_pct: 50,
        version: 2,
        updated_at: new Date().toISOString()
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/update-issue-123`, originalIssue)
      cy.mockApiResponse('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/update-issue-123`, updatedIssue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/update-issue-123/edit`)

      // Update issue fields
      cy.get('[data-testid="issue-title-input"]').clear().type(TEST_UPDATED_ISSUE_TITLE)
      cy.get('[data-testid="issue-status-select"]').select('in_progress')
      cy.get('[data-testid="issue-progress-slider"]').invoke('val', 50).trigger('change')

      // Submit update
      cy.get('[data-testid="update-issue-submit"]').click()

      cy.waitForApi('@updateIssue')
      cy.get('[data-testid="issue-updated-success"]').should('be.visible')
      cy.url().should('include', `/projects/${TEST_PROJECT_ID}/issues/update-issue-123`)
    })

    it('should delete issue with confirmation', () => {
      const issueToDelete = {
        id: 'delete-issue-123',
        project_id: TEST_PROJECT_ID,
        title: 'Issue to Delete',
        status: 'open',
        progress_pct: 0,
        is_blocked: false,
        labels: [],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/delete-issue-123/detail`, issueToDelete)
      cy.mockApiResponse('DELETE', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/delete-issue-123`, { success: true })

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/delete-issue-123`)

      cy.get('[data-testid="delete-issue-btn"]').click()
      
      // Confirm deletion
      cy.get('[data-testid="delete-confirmation-modal"]').should('be.visible')
      cy.get('[data-testid="confirm-delete-input"]').type('Issue to Delete')
      cy.get('[data-testid="confirm-delete-btn"]').click()

      cy.waitForApi('@deleteIssue')
      cy.url().should('include', `/projects/${TEST_PROJECT_ID}/issues`)
      cy.get('[data-testid="issue-deleted-success"]').should('be.visible')
    })
  })

  describe('Issue Hierarchical Structure', () => {
    it('should display parent-child relationships correctly', () => {
      const parentIssue = {
        id: 'parent-123',
        project_id: TEST_PROJECT_ID,
        title: 'Parent Issue',
        status: 'open',
        progress_pct: 25,
        is_blocked: false,
        labels: [],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        children: [
          {
            id: 'child-1',
            parent_id: 'parent-123',
            project_id: TEST_PROJECT_ID,
            title: 'Child Issue 1',
            status: 'done',
            progress_pct: 100,
            is_blocked: false,
            labels: [],
            sort_order: 1,
            version: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 'child-2',
            parent_id: 'parent-123',
            project_id: TEST_PROJECT_ID,
            title: 'Child Issue 2',
            status: 'open',
            progress_pct: 0,
            is_blocked: false,
            labels: [],
            sort_order: 2,
            version: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ]
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, [parentIssue])

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      cy.waitForApi('@getIssues')

      // Check parent issue is displayed
      cy.contains('Parent Issue').should('be.visible')
      cy.get('[data-testid="parent-issue-parent-123"]').should('be.visible')

      // Check child issues are indented
      cy.get('[data-testid="child-issue-child-1"]').should('be.visible')
      cy.get('[data-testid="child-issue-child-1"]').should('have.css', 'margin-left')
      cy.contains('Child Issue 1').should('be.visible')
      cy.contains('Child Issue 2').should('be.visible')

      // Check expand/collapse functionality
      cy.get('[data-testid="toggle-children-parent-123"]').click()
      cy.get('[data-testid="child-issue-child-1"]').should('not.be.visible')
      cy.get('[data-testid="child-issue-child-2"]').should('not.be.visible')

      cy.get('[data-testid="toggle-children-parent-123"]').click()
      cy.get('[data-testid="child-issue-child-1"]').should('be.visible')
      cy.get('[data-testid="child-issue-child-2"]').should('be.visible')
    })
  })

  describe('Permission-based Features', () => {
    it('should show editor features for editor role', () => {
      const issue = {
        id: 'editor-test-123',
        project_id: TEST_PROJECT_ID,
        title: 'Editor Test Issue',
        status: 'open',
        progress_pct: 0,
        is_blocked: false,
        labels: [],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        comments: [],
        changeLog: [],
        uploadedFiles: []
      }

      // Mock editor role
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
        success: true, 
        role: 'editor' 
      })
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/editor-test-123/detail`, issue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/editor-test-123`)
      cy.waitForApi('@getIssueDetail')

      // Editor should see all action buttons
      cy.get('[data-testid="edit-issue-btn"]').should('be.visible')
      cy.get('[data-testid="delete-issue-btn"]').should('be.visible')
      cy.get('[data-testid="add-comment-btn"]').should('be.visible')
      cy.get('[data-testid="upload-file-btn"]').should('be.visible')
    })

    it('should restrict viewer features for viewer role', () => {
      const issue = {
        id: 'viewer-test-123',
        project_id: TEST_PROJECT_ID,
        title: 'Viewer Test Issue',
        status: 'open',
        progress_pct: 0,
        is_blocked: false,
        labels: [],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        comments: [],
        changeLog: [],
        uploadedFiles: []
      }

      // Mock viewer role
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
        success: true, 
        role: 'viewer' 
      })
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/viewer-test-123/detail`, issue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/viewer-test-123`)
      cy.waitForApi('@getIssueDetail')

      // Viewer should not see edit/delete buttons
      cy.get('[data-testid="edit-issue-btn"]').should('not.exist')
      cy.get('[data-testid="delete-issue-btn"]').should('not.exist')
      
      // But should see read-only elements
      cy.contains('Viewer Test Issue').should('be.visible')
      cy.get('[data-testid="issue-status"]').should('be.visible')

      // Should show viewer-only message for restricted actions
      cy.get('[data-testid="viewer-restriction-message"]').should('contain', '閲覧者権限では編集できません')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('getIssuesError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      cy.waitForApi('@getIssuesError')

      cy.get('[data-testid="error-message"]').should('contain', 'Issueの読み込みに失敗しました')
      cy.get('[data-testid="retry-btn"]').should('be.visible')
    })

    it('should handle network errors', () => {
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, { forceNetworkError: true }).as('networkError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      cy.waitForApi('@networkError')

      cy.get('[data-testid="network-error"]').should('be.visible')
      cy.get('[data-testid="retry-btn"]').should('be.visible')
    })

    it('should handle issue not found', () => {
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/nonexistent/detail`, {
        statusCode: 404,
        body: { error: 'Issue not found' }
      }).as('issueNotFound')

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/nonexistent`)
      cy.waitForApi('@issueNotFound')

      cy.get('[data-testid="not-found-error"]').should('contain', 'Issueが見つかりません')
      cy.get('[data-testid="back-to-issues-btn"]').should('be.visible')
    })
  })

  describe('Real-time Updates via WebSocket', () => {
    it('should receive real-time issue updates', () => {
      const initialIssue = {
        id: 'realtime-test-123',
        project_id: TEST_PROJECT_ID,
        title: 'Realtime Test Issue',
        status: 'open',
        progress_pct: 0,
        is_blocked: false,
        labels: [],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        comments: [],
        changeLog: [],
        uploadedFiles: []
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/realtime-test-123/detail`, initialIssue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/realtime-test-123`)
      cy.waitForApi('@getIssueDetail')

      // Initial state
      cy.get('[data-testid="issue-status"]').should('contain', 'オープン')
      cy.get('[data-testid="issue-progress"]').should('contain', '0%')

      // Simulate WebSocket update
      cy.window().then((win) => {
        const wsEvent = new MessageEvent('message', {
          data: JSON.stringify({
            type: 'issue_updated',
            data: {
              ...initialIssue,
              status: 'in_progress',
              progress_pct: 25,
              version: 2,
              updated_at: new Date().toISOString()
            }
          })
        })
        
        // Trigger WebSocket message event
        win.dispatchEvent(new CustomEvent('websocket-message', { detail: wsEvent.data }))
      })

      // Check updated state
      cy.get('[data-testid="issue-status"]').should('contain', '進行中')
      cy.get('[data-testid="issue-progress"]').should('contain', '25%')
      cy.get('[data-testid="realtime-update-indicator"]').should('be.visible')
    })

    it('should show notification for new comments', () => {
      const issue = {
        id: 'comment-notification-test',
        project_id: TEST_PROJECT_ID,
        title: 'Comment Notification Test',
        status: 'open',
        progress_pct: 0,
        is_blocked: false,
        labels: [],
        sort_order: 1,
        version: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        comments: [],
        changeLog: [],
        uploadedFiles: []
      }

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/comment-notification-test/detail`, issue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues/comment-notification-test`)
      cy.waitForApi('@getIssueDetail')

      // Simulate new comment via WebSocket
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('websocket-message', {
          detail: JSON.stringify({
            type: 'comment_added',
            data: {
              id: 'new-comment-123',
              issue_id: 'comment-notification-test',
              author: 'other-user@example.com',
              body_md: 'This is a new comment from another user',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_edited: false
            }
          })
        }))
      })

      // Should show notification
      cy.get('[data-testid="new-comment-notification"]').should('be.visible')
      cy.get('[data-testid="new-comment-notification"]').should('contain', 'other-user@example.com')
      cy.get('[data-testid="refresh-comments-btn"]').should('be.visible')
    })
  })

  describe('Search and Advanced Filtering', () => {
    it('should search issues by title and description', () => {
      const searchResults = [
        {
          id: 'search-1',
          project_id: TEST_PROJECT_ID,
          title: 'Bug in search functionality',
          description_md: 'Users cannot search for items',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: ['bug'],
          sort_order: 1,
          version: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, searchResults)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      
      cy.get('[data-testid="issue-search-input"]').type('search')
      cy.get('[data-testid="search-btn"]').click()

      cy.waitForApi('@getIssues')
      cy.get('[data-testid="issue-item"]').should('have.length', 1)
      cy.contains('Bug in search functionality').should('be.visible')
    })

    it('should filter issues by multiple labels', () => {
      const issues = [
        { id: '1', labels: ['bug', 'high'], title: 'High Priority Bug', project_id: TEST_PROJECT_ID, status: 'open', progress_pct: 0, is_blocked: false, sort_order: 1, version: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
        { id: '2', labels: ['feature'], title: 'New Feature', project_id: TEST_PROJECT_ID, status: 'open', progress_pct: 0, is_blocked: false, sort_order: 2, version: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
        { id: '3', labels: ['bug', 'low'], title: 'Low Priority Bug', project_id: TEST_PROJECT_ID, status: 'open', progress_pct: 0, is_blocked: false, sort_order: 3, version: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, issues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/issues`)
      cy.waitForApi('@getIssues')

      // Filter by 'bug' label
      cy.get('[data-testid="label-filter-dropdown"]').click()
      cy.get('[data-testid="label-filter-bug"]').click()

      cy.get('[data-testid="issue-item"]').should('have.length', 2)
      cy.contains('High Priority Bug').should('be.visible')
      cy.contains('Low Priority Bug').should('be.visible')
      cy.contains('New Feature').should('not.exist')
    })
  })
})