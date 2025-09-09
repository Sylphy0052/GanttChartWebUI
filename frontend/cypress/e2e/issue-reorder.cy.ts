/// <reference types="cypress" />

describe('Issue Reorder (Drag & Drop) E2E Tests', () => {
  const TEST_API_URL = Cypress.env('backendUrl') || 'http://localhost:3001'
  const TEST_PROJECT_ID = 'test-reorder-project-123'
  
  beforeEach(() => {
    // Clean up test data before each test
    cy.cleanupTestData()
    
    // Intercept Issue and Reorder API calls
    cy.intercept('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`).as('getIssues')
    cy.intercept('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/reorder`).as('reorderIssues')
    cy.intercept('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/*/hierarchy`).as('changeHierarchy')
    
    // WebSocket interceptions for real-time notifications
    cy.intercept('GET', `${TEST_API_URL}/ws`, { fixture: 'websocket-connection.json' }).as('wsConnection')
    
    // Mock project authentication with editor role (needed for reordering)
    cy.mockApiResponse('POST', `${TEST_API_URL}/api/auth/project/${TEST_PROJECT_ID}/authenticate`, { 
      success: true, 
      role: 'editor' 
    })
  })

  describe('Drag & Drop Functionality', () => {
    it('should enable drag & drop for same-level issues', () => {
      const mockReorderableIssues = [
        {
          id: 'issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'First Issue - Reorderable',
          description_md: 'This is the first issue',
          status: 'open',
          assignee: null,
          progress_pct: 0,
          is_blocked: false,
          labels: ['task'],
          sort_order: 100,
          version: 1,
          wbs_number: '1',
          parent_id: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          children: []
        },
        {
          id: 'issue-2',
          project_id: TEST_PROJECT_ID,
          title: 'Second Issue - Reorderable',
          description_md: 'This is the second issue',
          status: 'in_progress',
          assignee: 'user@example.com',
          progress_pct: 50,
          is_blocked: false,
          labels: ['task'],
          sort_order: 200,
          version: 1,
          wbs_number: '2',
          parent_id: null,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          children: []
        },
        {
          id: 'issue-3',
          project_id: TEST_PROJECT_ID,
          title: 'Third Issue - Reorderable',
          description_md: 'This is the third issue',
          status: 'done',
          assignee: 'admin@example.com',
          progress_pct: 100,
          is_blocked: false,
          labels: ['task'],
          sort_order: 300,
          version: 1,
          wbs_number: '3',
          parent_id: null,
          created_at: '2024-01-03T00:00:00Z',
          updated_at: '2024-01-03T00:00:00Z',
          children: []
        }
      ]

      const reorderedIssues = [
        { ...mockReorderableIssues[1], sort_order: 100, wbs_number: '1' }, // issue-2 moved to first
        { ...mockReorderableIssues[0], sort_order: 200, wbs_number: '2' }, // issue-1 moved to second
        { ...mockReorderableIssues[2], sort_order: 300, wbs_number: '3' }  // issue-3 stays third
      ]

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockReorderableIssues)
      cy.mockApiResponse('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/reorder`, reorderedIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Check initial order
      cy.get('[data-testid="draggable-wbs-tree"]').should('be.visible')
      cy.get('[data-testid="drag-drop-indicator"]').should('contain', 'ドラッグ&ドロップ対応')

      // Verify initial sort order
      cy.get('[data-testid="wbs-tree-table"] tbody tr').eq(0)
        .should('contain', 'First Issue - Reorderable')
      cy.get('[data-testid="wbs-tree-table"] tbody tr').eq(1)
        .should('contain', 'Second Issue - Reorderable')
      cy.get('[data-testid="wbs-tree-table"] tbody tr').eq(2)
        .should('contain', 'Third Issue - Reorderable')

      // Check drag handles are present
      cy.get('[data-testid="drag-handle-issue-1"]').should('be.visible')
      cy.get('[data-testid="drag-handle-issue-2"]').should('be.visible')
      cy.get('[data-testid="drag-handle-issue-3"]').should('be.visible')

      // Perform drag and drop: drag issue-2 to the top
      cy.get('[data-testid="draggable-row-issue-2"]')
        .trigger('dragstart', { dataTransfer: new DataTransfer() })

      cy.get('[data-testid="draggable-row-issue-1"]')
        .trigger('dragover')
        .trigger('drop')

      // Wait for API call
      cy.waitForApi('@reorderIssues')

      // Check success notification
      cy.get('[data-testid="reorder-success-notification"]')
        .should('be.visible')
        .should('contain', '並び替えが完了しました')

      // Verify new order (if the component re-renders with new data)
      cy.get('[data-testid="wbs-tree-table"] tbody tr').eq(0)
        .should('contain', 'Second Issue - Reorderable')
      cy.get('[data-testid="wbs-tree-table"] tbody tr').eq(1)
        .should('contain', 'First Issue - Reorderable')
    })

    it('should show visual feedback during drag operation', () => {
      const mockDragIssues = [
        {
          id: 'drag-visual-1',
          project_id: TEST_PROJECT_ID,
          title: 'Visual Feedback Issue 1',
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
          id: 'drag-visual-2',
          project_id: TEST_PROJECT_ID,
          title: 'Visual Feedback Issue 2',
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

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockDragIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Start drag operation
      cy.get('[data-testid="draggable-row-drag-visual-1"]')
        .trigger('dragstart', { dataTransfer: new DataTransfer() })

      // Check drag preview is shown
      cy.get('[data-testid="drag-preview"]').should('be.visible')
      cy.get('[data-testid="drag-preview"]').should('contain', 'Visual Feedback Issue 1')

      // Check drop zone highlighting
      cy.get('[data-testid="draggable-row-drag-visual-2"]')
        .trigger('dragover')

      cy.get('[data-testid="draggable-row-drag-visual-2"]')
        .should('have.class', 'drag-over')
        .should('have.class', 'bg-blue-50')

      // End drag operation
      cy.get('[data-testid="draggable-row-drag-visual-2"]')
        .trigger('drop')
        .trigger('dragend')

      // Drag preview should disappear
      cy.get('[data-testid="drag-preview"]').should('not.exist')
    })

    it('should prevent cross-hierarchy drag and drop with error message', () => {
      const mockHierarchyIssues = [
        {
          id: 'parent-issue',
          project_id: TEST_PROJECT_ID,
          title: 'Parent Issue',
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
              id: 'child-issue',
              project_id: TEST_PROJECT_ID,
              title: 'Child Issue',
              status: 'open',
              progress_pct: 0,
              is_blocked: false,
              labels: [],
              sort_order: 100,
              version: 1,
              wbs_number: '1.1',
              parent_id: 'parent-issue',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              children: []
            }
          ]
        },
        {
          id: 'other-parent',
          project_id: TEST_PROJECT_ID,
          title: 'Other Parent Issue',
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

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockHierarchyIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Expand to see child issue
      cy.get('[data-testid="expand-all-btn"]').click()

      // Try to drag child issue to different parent level
      cy.get('[data-testid="draggable-row-child-issue"]')
        .trigger('dragstart', { dataTransfer: new DataTransfer() })

      cy.get('[data-testid="draggable-row-other-parent"]')
        .trigger('dragover')
        .trigger('drop')

      // Should show error message
      cy.get('[data-testid="reorder-error-notification"]')
        .should('be.visible')
        .should('contain', '同一階層内でのみ並び替えが可能です')

      // Error should auto-dismiss after 5 seconds
      cy.get('[data-testid="reorder-error-notification"]', { timeout: 6000 })
        .should('not.exist')
    })

    it('should handle reorder API errors gracefully', () => {
      const mockErrorIssues = [
        {
          id: 'error-issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'Error Test Issue 1',
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
          id: 'error-issue-2',
          project_id: TEST_PROJECT_ID,
          title: 'Error Test Issue 2',
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

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockErrorIssues)
      
      // Mock API error response
      cy.intercept('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/reorder`, {
        statusCode: 409,
        body: { error: 'Version conflict: The issue has been modified by another user' }
      }).as('reorderError')

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Perform drag and drop
      cy.get('[data-testid="draggable-row-error-issue-2"]')
        .trigger('dragstart', { dataTransfer: new DataTransfer() })

      cy.get('[data-testid="draggable-row-error-issue-1"]')
        .trigger('dragover')
        .trigger('drop')

      cy.waitForApi('@reorderError')

      // Should show specific error message
      cy.get('[data-testid="reorder-error-notification"]')
        .should('be.visible')
        .should('contain', 'Version conflict')

      // Should have retry or refresh option
      cy.get('[data-testid="reorder-retry-btn"]').should('be.visible')
    })
  })

  describe('Reorder Loading States', () => {
    it('should show loading indicator during reorder operation', () => {
      const mockLoadingIssues = [
        {
          id: 'loading-issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'Loading Test Issue 1',
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
          id: 'loading-issue-2',
          project_id: TEST_PROJECT_ID,
          title: 'Loading Test Issue 2',
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

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockLoadingIssues)
      
      // Mock delayed API response
      cy.intercept('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/reorder`, {
        delay: 2000,
        body: mockLoadingIssues
      }).as('reorderDelayed')

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Perform drag and drop
      cy.get('[data-testid="draggable-row-loading-issue-2"]')
        .trigger('dragstart', { dataTransfer: new DataTransfer() })

      cy.get('[data-testid="draggable-row-loading-issue-1"]')
        .trigger('dragover')
        .trigger('drop')

      // Should show loading indicator in header
      cy.get('[data-testid="reorder-loading-indicator"]')
        .should('be.visible')
        .should('contain', '並び替え中...')

      // Should disable further drag operations during loading
      cy.get('[data-testid="draggable-row-loading-issue-1"]')
        .should('have.class', 'pointer-events-none')

      cy.waitForApi('@reorderDelayed')

      // Loading indicator should disappear
      cy.get('[data-testid="reorder-loading-indicator"]').should('not.exist')
    })
  })

  describe('Keyboard Accessibility for Reordering', () => {
    it('should support keyboard navigation for reordering', () => {
      const mockKeyboardIssues = [
        {
          id: 'keyboard-issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'Keyboard Accessible Issue 1',
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
          id: 'keyboard-issue-2',
          project_id: TEST_PROJECT_ID,
          title: 'Keyboard Accessible Issue 2',
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

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockKeyboardIssues)
      cy.mockApiResponse('PUT', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues/reorder`, mockKeyboardIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Focus on first drag handle
      cy.get('[data-testid="drag-handle-keyboard-issue-1"]').focus()

      // Check keyboard hints are shown
      cy.get('[data-testid="keyboard-reorder-hint"]')
        .should('be.visible')
        .should('contain', 'Space + 矢印キーで並び替え')

      // Activate drag mode with Space
      cy.get('[data-testid="drag-handle-keyboard-issue-1"]').type(' ')

      // Should enter keyboard drag mode
      cy.get('[data-testid="keyboard-drag-mode"]').should('be.visible')
      cy.get('[data-testid="keyboard-drag-mode"]').should('contain', 'キーボード並び替えモード')

      // Move down with arrow key
      cy.get('[data-testid="drag-handle-keyboard-issue-1"]').type('{downarrow}')

      // Confirm with Space
      cy.get('[data-testid="drag-handle-keyboard-issue-1"]').type(' ')

      // Should show success message
      cy.get('[data-testid="reorder-success-notification"]')
        .should('be.visible')
        .should('contain', 'キーボードで並び替えが完了しました')
    })
  })

  describe('Reorder with Real-time WebSocket Updates', () => {
    it('should show notification when other users reorder issues', () => {
      const mockInitialIssues = [
        {
          id: 'ws-issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'WebSocket Test Issue 1',
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
          id: 'ws-issue-2',
          project_id: TEST_PROJECT_ID,
          title: 'WebSocket Test Issue 2',
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

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockInitialIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Initial state
      cy.get('[data-testid="wbs-tree-table"] tbody tr').eq(0)
        .should('contain', 'WebSocket Test Issue 1')

      // Simulate WebSocket notification for reorder
      cy.simulateWebSocketMessage('issues_reordered', {
        projectId: TEST_PROJECT_ID,
        affectedIssues: [
          { ...mockInitialIssues[1], sort_order: 100, wbs_number: '1' },
          { ...mockInitialIssues[0], sort_order: 200, wbs_number: '2' }
        ],
        reorderedBy: 'other-user@example.com'
      })

      // Should show real-time notification
      cy.get('[data-testid="realtime-reorder-notification"]')
        .should('be.visible')
        .should('contain', 'other-user@example.com')
        .should('contain', 'がIssueの順序を変更しました')

      // Should update the tree view automatically
      cy.get('[data-testid="wbs-tree-table"] tbody tr').eq(0)
        .should('contain', 'WebSocket Test Issue 2')

      // Should show refresh indicator
      cy.get('[data-testid="realtime-update-indicator"]')
        .should('be.visible')
        .should('contain', 'リアルタイム更新')
    })

    it('should handle hierarchy change notifications', () => {
      const mockHierarchyChangeIssues = [
        {
          id: 'hierarchy-issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'Hierarchy Change Issue 1',
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

      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockHierarchyChangeIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Simulate hierarchy change notification
      cy.simulateWebSocketMessage('issue_hierarchy_changed', {
        projectId: TEST_PROJECT_ID,
        changedIssueId: 'hierarchy-issue-1',
        newParentId: 'new-parent-id',
        changedBy: 'hierarchy-user@example.com'
      })

      // Should show hierarchy change notification
      cy.get('[data-testid="realtime-hierarchy-notification"]')
        .should('be.visible')
        .should('contain', 'hierarchy-user@example.com')
        .should('contain', 'が階層構造を変更しました')

      // Should provide option to refresh
      cy.get('[data-testid="refresh-after-hierarchy-change"]').should('be.visible')
    })
  })

  describe('Permission-based Reordering', () => {
    it('should disable reordering for viewer role', () => {
      const mockViewerIssues = [
        {
          id: 'viewer-issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'Viewer Issue 1',
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
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockViewerIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Should show read-only WBS tree
      cy.get('[data-testid="wbs-tree-view"]').should('be.visible')
      
      // Drag handles should not exist
      cy.get('[data-testid="drag-handle-viewer-issue-1"]').should('not.exist')
      
      // Drag & drop indicator should not be shown
      cy.get('[data-testid="drag-drop-indicator"]').should('not.exist')
      
      // Should show viewer restriction message
      cy.get('[data-testid="viewer-reorder-restriction"]')
        .should('be.visible')
        .should('contain', '閲覧者権限では並び替えできません')
    })

    it('should enable full reordering for editor role', () => {
      const mockEditorIssues = [
        {
          id: 'editor-issue-1',
          project_id: TEST_PROJECT_ID,
          title: 'Editor Issue 1',
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
      cy.mockApiResponse('GET', `${TEST_API_URL}/api/projects/${TEST_PROJECT_ID}/issues`, mockEditorIssues)

      cy.visit(`/projects/${TEST_PROJECT_ID}/wbs`)
      cy.waitForApi('@getIssues')

      // Should show draggable WBS tree
      cy.get('[data-testid="draggable-wbs-tree"]').should('be.visible')
      
      // Drag handles should exist
      cy.get('[data-testid="drag-handle-editor-issue-1"]').should('be.visible')
      
      // Drag & drop indicator should be shown
      cy.get('[data-testid="drag-drop-indicator"]')
        .should('be.visible')
        .should('contain', 'ドラッグ&ドロップ対応')
    })
  })
})