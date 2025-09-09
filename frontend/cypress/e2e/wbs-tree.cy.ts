/// <reference types="cypress" />

describe('WBS Tree View E2E Tests', () => {
  const TEST_API_URL = Cypress.env('backendUrl') || 'http://localhost:3001'
  const TEST_PROJECT_ID = 'test-wbs-project-123'
  const TEST_PARENT_ISSUE = 'parent-issue-wbs'
  const TEST_CHILD_ISSUE = 'child-issue-wbs'

  beforeEach(() => {
    // Clean up test data before each test
    cy.cleanupTestData()
    
    // Intercept WBS Tree API calls
    cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`).as('getIssues')
    cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/wbs-tree`).as('getWBSTree')
    
    // WebSocket interceptions for real-time notifications
    cy.intercept('GET', `${TEST_API_URL}/ws`, { fixture: 'websocket-connection.json' }).as('wsConnection')
    
    // Mock project authentication
    cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
      success: true, 
      role: 'editor' 
    })
  })

  describe('WBS Tree Display', () => {
    it('should display WBS tree with hierarchical structure', () => {
      const mockHierarchicalIssues = [
        {
          id: TEST_PARENT_ISSUE,
          project_id: TEST_PROJECT_ID,
          title: 'Parent Task - Development Phase',
          description_md: 'Main development phase',
          status: 'in_progress',
          assignee: 'dev-lead@example.com',
          progress_pct: 60,
          is_blocked: false,
          labels: ['phase', 'development'],
          sort_order: 100,
          version: 1,
          start_date: '2024-01-01',
          end_date: '2024-03-31',
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: [
            {
              id: TEST_CHILD_ISSUE,
              project_id: TEST_PROJECT_ID,
              title: 'Child Task - Frontend Implementation',
              description_md: 'Frontend development tasks',
              status: 'open',
              assignee: 'frontend-dev@example.com',
              progress_pct: 30,
              is_blocked: false,
              labels: ['frontend', 'implementation'],
              sort_order: 100,
              version: 1,
              start_date: '2024-01-15',
              end_date: '2024-02-15',
              wbs_number: '1.1',
              parent_id: TEST_PARENT_ISSUE,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            },
            {
              id: 'grandchild-issue-wbs',
              project_id: TEST_PROJECT_ID,
              title: 'Grandchild Task - Component Development',
              description_md: 'Specific component development',
              status: 'done',
              assignee: 'component-dev@example.com',
              progress_pct: 100,
              is_blocked: false,
              labels: ['component', 'ui'],
              sort_order: 200,
              version: 1,
              start_date: '2024-01-20',
              end_date: '2024-01-30',
              wbs_number: '1.2',
              parent_id: TEST_PARENT_ISSUE,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            }
          ]
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockHierarchicalIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Check WBS tree view is displayed
      cy.get('[data-testid="wbs-tree-view"]').should('be.visible')
      cy.contains('WBS ツリービュー').should('be.visible')

      // Check hierarchical structure
      cy.get('[data-testid="wbs-tree-table"]').should('be.visible')
      cy.get('[data-testid="wbs-tree-header"]').should('be.visible')

      // Check parent issue is displayed with correct WBS number
      cy.get('[data-testid="wbs-node-parent-issue-wbs"]').should('be.visible')
      cy.get('[data-testid="wbs-number-parent-issue-wbs"]').should('contain', '1')
      cy.contains('Parent Task - Development Phase').should('be.visible')

      // Check child issues are displayed with correct indentation
      cy.get('[data-testid="wbs-node-child-issue-wbs"]').should('be.visible')
      cy.get('[data-testid="wbs-number-child-issue-wbs"]').should('contain', '1.1')
      cy.contains('Child Task - Frontend Implementation').should('be.visible')

      // Check indentation for child nodes
      cy.get('[data-testid="wbs-node-child-issue-wbs"]')
        .should('have.class', 'level-1')

      // Check status badges
      cy.get('[data-testid="issue-status-in_progress"]').should('contain', '進行中')
      cy.get('[data-testid="issue-status-open"]').should('contain', 'オープン')
      cy.get('[data-testid="issue-status-done"]').should('contain', '完了')

      // Check progress indicators
      cy.get('[data-testid="progress-bar-parent-issue-wbs"]')
        .should('be.visible')
        .should('contain', '60%')
      
      cy.get('[data-testid="progress-bar-child-issue-wbs"]')
        .should('be.visible')
        .should('contain', '30%')

      // Check dates display
      cy.get('[data-testid="start-date-parent-issue-wbs"]').should('contain', '2024/1/1')
      cy.get('[data-testid="end-date-parent-issue-wbs"]').should('contain', '2024/3/31')
    })

    it('should expand and collapse tree nodes correctly', () => {
      const mockExpandableIssues = [
        {
          id: TEST_PARENT_ISSUE,
          project_id: TEST_PROJECT_ID,
          title: 'Expandable Parent Issue',
          status: 'open',
          progress_pct: 50,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: [
            {
              id: TEST_CHILD_ISSUE,
              project_id: TEST_PROJECT_ID,
              title: 'Collapsible Child Issue',
              status: 'open',
              progress_pct: 25,
              is_blocked: false,
              labels: [],
              sort_order: 100,
              version: 1,
              wbs_number: '1.1',
              parent_id: TEST_PARENT_ISSUE,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            }
          ]
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockExpandableIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Initially, child should not be visible (collapsed by default)
      cy.get('[data-testid="wbs-node-parent-issue-wbs"]').should('be.visible')
      cy.get('[data-testid="wbs-node-child-issue-wbs"]').should('not.be.visible')

      // Check expand button is visible
      cy.get('[data-testid="expand-toggle-parent-issue-wbs"]').should('be.visible')
      cy.get('[data-testid="expand-toggle-parent-issue-wbs"]')
        .should('have.attr', 'aria-expanded', 'false')

      // Click to expand
      cy.get('[data-testid="expand-toggle-parent-issue-wbs"]').click()

      // Child should now be visible
      cy.get('[data-testid="wbs-node-child-issue-wbs"]').should('be.visible')
      cy.get('[data-testid="expand-toggle-parent-issue-wbs"]')
        .should('have.attr', 'aria-expanded', 'true')

      // Click to collapse
      cy.get('[data-testid="expand-toggle-parent-issue-wbs"]').click()

      // Child should be hidden again
      cy.get('[data-testid="wbs-node-child-issue-wbs"]').should('not.be.visible')
      cy.get('[data-testid="expand-toggle-parent-issue-wbs"]')
        .should('have.attr', 'aria-expanded', 'false')
    })

    it('should use expand all and collapse all controls', () => {
      const mockMultiLevelIssues = [
        {
          id: 'root-1',
          project_id: TEST_PROJECT_ID,
          title: 'Root Issue 1',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: [
            {
              id: 'child-1-1',
              project_id: TEST_PROJECT_ID,
              title: 'Child 1.1',
              status: 'open',
              progress_pct: 0,
              is_blocked: false,
              labels: [],
              sort_order: 100,
              version: 1,
              wbs_number: '1.1',
              parent_id: 'root-1',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            }
          ]
        },
        {
          id: 'root-2',
          project_id: TEST_PROJECT_ID,
          title: 'Root Issue 2',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 200,
          version: 1,
          wbs_number: '2',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: [
            {
              id: 'child-2-1',
              project_id: TEST_PROJECT_ID,
              title: 'Child 2.1',
              status: 'open',
              progress_pct: 0,
              is_blocked: false,
              labels: [],
              sort_order: 100,
              version: 1,
              wbs_number: '2.1',
              parent_id: 'root-2',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            }
          ]
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockMultiLevelIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Initially all nodes should be collapsed
      cy.get('[data-testid="wbs-node-child-1-1"]').should('not.be.visible')
      cy.get('[data-testid="wbs-node-child-2-1"]').should('not.be.visible')

      // Check expand all button
      cy.get('[data-testid="expand-all-btn"]').should('be.visible')
      cy.get('[data-testid="collapse-all-btn"]').should('be.visible')

      // Click expand all
      cy.get('[data-testid="expand-all-btn"]').click()

      // All child nodes should now be visible
      cy.get('[data-testid="wbs-node-child-1-1"]').should('be.visible')
      cy.get('[data-testid="wbs-node-child-2-1"]').should('be.visible')

      // Click collapse all
      cy.get('[data-testid="collapse-all-btn"]').click()

      // All child nodes should be hidden
      cy.get('[data-testid="wbs-node-child-1-1"]').should('not.be.visible')
      cy.get('[data-testid="wbs-node-child-2-1"]').should('not.be.visible')
    })

    it('should display correct WBS numbers in hierarchical format', () => {
      const mockWBSNumberedIssues = [
        {
          id: 'wbs-root',
          project_id: TEST_PROJECT_ID,
          title: 'Root WBS Issue',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: [
            {
              id: 'wbs-level-1',
              project_id: TEST_PROJECT_ID,
              title: 'Level 1 Child',
              status: 'open',
              progress_pct: 0,
              is_blocked: false,
              labels: [],
              sort_order: 100,
              version: 1,
              wbs_number: '1.1',
              parent_id: 'wbs-root',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: [
                {
                  id: 'wbs-level-2',
                  project_id: TEST_PROJECT_ID,
                  title: 'Level 2 Child',
                  status: 'open',
                  progress_pct: 0,
                  is_blocked: false,
                  labels: [],
                  sort_order: 100,
                  version: 1,
                  wbs_number: '1.1.1',
                  parent_id: 'wbs-level-1',
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                  children: []
                }
              ]
            },
            {
              id: 'wbs-level-1-sibling',
              project_id: TEST_PROJECT_ID,
              title: 'Level 1 Sibling',
              status: 'open',
              progress_pct: 0,
              is_blocked: false,
              labels: [],
              sort_order: 200,
              version: 1,
              wbs_number: '1.2',
              parent_id: 'wbs-root',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            }
          ]
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockWBSNumberedIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Expand all to see all WBS numbers
      cy.get('[data-testid="expand-all-btn"]').click()

      // Check WBS number display
      cy.get('[data-testid="wbs-number-wbs-root"]').should('contain', '1')
      cy.get('[data-testid="wbs-number-wbs-level-1"]').should('contain', '1.1')
      cy.get('[data-testid="wbs-number-wbs-level-1-sibling"]').should('contain', '1.2')
      cy.get('[data-testid="wbs-number-wbs-level-2"]').should('contain', '1.1.1')
    })
  })

  describe('WBS Tree Navigation and Interaction', () => {
    it('should navigate to issue detail when clicking on issue title', () => {
      const mockClickableIssue = [
        {
          id: TEST_PARENT_ISSUE,
          project_id: TEST_PROJECT_ID,
          title: 'Clickable Issue',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: []
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockClickableIssue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Click on issue title
      cy.get('[data-testid="issue-title-link-parent-issue-wbs"]').click()

      // Should navigate to issue detail page
      cy.url().should('include', `/projects/${TEST_PROJECT_ID}/issues/${TEST_PARENT_ISSUE}`)
    })

    it('should highlight selected issue in tree view', () => {
      const mockSelectableIssues = [
        {
          id: 'selectable-1',
          project_id: TEST_PROJECT_ID,
          title: 'Selectable Issue 1',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: []
        },
        {
          id: 'selectable-2',
          project_id: TEST_PROJECT_ID,
          title: 'Selectable Issue 2',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 200,
          version: 1,
          wbs_number: '2',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: []
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockSelectableIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs?selected=selectable-1`)
      cy.waitForApi('@getIssues')

      // Check that the selected issue is highlighted
      cy.get('[data-testid="wbs-node-selectable-1"]')
        .should('have.class', 'selected')
        .should('have.class', 'bg-blue-50')

      // Check that non-selected issues are not highlighted
      cy.get('[data-testid="wbs-node-selectable-2"]')
        .should('not.have.class', 'selected')
        .should('not.have.class', 'bg-blue-50')
    })
  })

  describe('Empty States and Loading', () => {
    it('should display empty state when no issues exist', () => {
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, [])

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Check empty state is displayed
      cy.get('[data-testid="wbs-tree-empty-state"]').should('be.visible')
      cy.contains('Issueがありません').should('be.visible')
      cy.get('[data-testid="wbs-tree-empty-icon"]').should('be.visible')
    })

    it('should display loading state correctly', () => {
      // Delay API response to test loading state
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, {
        delay: 2000,
        body: []
      }).as('getIssuesDelayed')

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)

      // Check loading state is displayed
      cy.get('[data-testid="wbs-tree-loading"]').should('be.visible')
      cy.get('[data-testid="loading-spinner"]').should('be.visible')
      cy.contains('読み込み中...').should('be.visible')

      cy.waitForApi('@getIssuesDelayed')

      // Loading state should disappear
      cy.get('[data-testid="wbs-tree-loading"]').should('not.exist')
    })
  })

  describe('WBS Tree Footer Information', () => {
    it('should display correct item counts in footer', () => {
      const mockCountableIssues = [
        {
          id: 'count-root',
          project_id: TEST_PROJECT_ID,
          title: 'Root for Counting',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: [
            {
              id: 'count-child-1',
              project_id: TEST_PROJECT_ID,
              title: 'Child 1 for Counting',
              status: 'open',
              progress_pct: 0,
              is_blocked: false,
              labels: [],
              sort_order: 100,
              version: 1,
              wbs_number: '1.1',
              parent_id: 'count-root',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            },
            {
              id: 'count-child-2',
              project_id: TEST_PROJECT_ID,
              title: 'Child 2 for Counting',
              status: 'open',
              progress_pct: 0,
              is_blocked: false,
              labels: [],
              sort_order: 200,
              version: 1,
              wbs_number: '1.2',
              parent_id: 'count-root',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            }
          ]
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockCountableIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Initially only root visible (children collapsed)
      cy.get('[data-testid="wbs-tree-footer"]').should('be.visible')
      cy.get('[data-testid="visible-count"]').should('contain', '1件 表示中')
      cy.get('[data-testid="total-count"]').should('contain', '全3件')

      // Expand to show all children
      cy.get('[data-testid="expand-all-btn"]').click()

      // All items should now be visible
      cy.get('[data-testid="visible-count"]').should('contain', '3件 表示中')
      cy.get('[data-testid="total-count"]').should('contain', '全3件')
    })

    it('should show hierarchical structure indicator in footer', () => {
      const mockHierarchicalFooter = [
        {
          id: 'footer-parent',
          project_id: TEST_PROJECT_ID,
          title: 'Parent for Footer',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: [
            {
              id: 'footer-child',
              project_id: TEST_PROJECT_ID,
              title: 'Child for Footer',
              status: 'open',
              progress_pct: 0,
              is_blocked: false,
              labels: [],
              sort_order: 100,
              version: 1,
              wbs_number: '1.1',
              parent_id: 'footer-parent',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            }
          ]
        }
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockHierarchicalFooter)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Check hierarchical structure indicator
      cy.get('[data-testid="wbs-tree-footer"]').should('be.visible')
      cy.get('[data-testid="hierarchy-indicator"]')
        .should('be.visible')
        .should('contain', '階層構造あり - クリックして展開/折りたたみ')
    })
  })

  describe('Permission-based WBS Tree Features', () => {
    it('should show editor features for editor role', () => {
      const mockPermissionIssue = [
        {
          id: 'permission-test',
          project_id: TEST_PROJECT_ID,
          title: 'Permission Test Issue',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: []
        }
      ]

      // Mock editor role
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
        success: true, 
        role: 'editor' 
      })
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockPermissionIssue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Editor should see expansion controls
      cy.get('[data-testid="expand-all-btn"]').should('be.visible')
      cy.get('[data-testid="collapse-all-btn"]').should('be.visible')
      
      // Editor should be able to click issue titles
      cy.get('[data-testid="issue-title-link-permission-test"]').should('be.visible')
    })

    it('should restrict viewer features for viewer role', () => {
      const mockViewerIssue = [
        {
          id: 'viewer-test',
          project_id: TEST_PROJECT_ID,
          title: 'Viewer Test Issue',
          status: 'open',
          progress_pct: 0,
          is_blocked: false,
          labels: [],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: []
        }
      ]

      // Mock viewer role
      cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
        success: true, 
        role: 'viewer' 
      })
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockViewerIssue)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Viewer should still see WBS tree content
      cy.get('[data-testid="wbs-tree-view"]').should('be.visible')
      cy.contains('Viewer Test Issue').should('be.visible')
      
      // But should see view-only indicators if any exist
      cy.get('[data-testid="view-only-indicator"]').should('be.visible', { timeout: 1000 })
    })
  })

  describe('Error Handling in WBS Tree', () => {
    it('should handle API errors gracefully', () => {
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('getIssuesError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssuesError')

      cy.get('[data-testid="wbs-error-message"]').should('contain', 'WBSツリーの読み込みに失敗しました')
      cy.get('[data-testid="retry-wbs-btn"]').should('be.visible')
    })

    it('should handle network errors', () => {
      cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, { forceNetworkError: true }).as('networkError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@networkError')

      cy.get('[data-testid="wbs-network-error"]').should('be.visible')
      cy.get('[data-testid="retry-wbs-btn"]').should('be.visible')
    })
  })
})