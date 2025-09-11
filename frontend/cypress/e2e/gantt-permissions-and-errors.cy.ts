/// <reference types="cypress" />

/**
 * Gantt Chart Permissions and Error Handling E2E Tests
 * 
 * 権限による操作制限とエラーハンドリングのテスト
 */

describe('Gantt Chart Permissions and Error Handling Tests', () => {
  const TEST_PROJECT_ID = 'permissions-test-project-789'
  const TEST_TASKS = [
    {
      id: 'perm-task-1',
      project_id: TEST_PROJECT_ID,
      title: 'Editable Task',
      description_md: 'Task for testing edit permissions',
      status: 'open',
      assignee: 'editor@example.com',
      progress_pct: 30,
      is_blocked: false,
      labels: ['editable'],
      sort_order: 100,
      version: 1,
      start_date: '2024-01-01',
      end_date: '2024-01-15',
      wbs_number: '1',
      parent_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      children: []
    },
    {
      id: 'perm-task-2',
      project_id: TEST_PROJECT_ID,
      title: 'Readonly Task',
      description_md: 'Task for testing view-only permissions',
      status: 'in_progress',
      assignee: 'viewer@example.com',
      progress_pct: 75,
      is_blocked: false,
      labels: ['readonly'],
      sort_order: 200,
      version: 1,
      start_date: '2024-01-16',
      end_date: '2024-01-31',
      wbs_number: '2',
      parent_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-16T00:00:00Z',
      children: []
    }
  ]

  const TEST_DEPENDENCY = {
    id: 'perm-dep-1',
    predecessor_issue_id: 'perm-task-1',
    successor_issue_id: 'perm-task-2',
    dependency_type: 'finish_to_start',
    lag_days: 0,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }

  beforeEach(() => {
    cy.cleanupTestData()
    
    // Mock project data
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}`, {
      id: TEST_PROJECT_ID,
      name: 'Permissions Test Project',
      description: 'Test project for permission validation',
      role: 'editor' // Will be overridden per test
    })
    
    // Mock tasks and dependencies
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, TEST_TASKS)
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [TEST_DEPENDENCY])
  })

  describe('Editor Role Permissions', () => {
    beforeEach(() => {
      cy.setUserRole('editor')
    })

    it('should allow all editing operations for editors', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Editor role indicator should be visible
      cy.get('[data-testid="user-role-indicator"]').should('contain', 'Editor')
      
      // All editing controls should be enabled
      cy.get('[data-testid^="task-bar-"]').should('have.class', 'draggable')
      
      // Right-click should show dependency creation option
      cy.openDependencyContextMenu('perm-task-1')
      cy.get('[data-testid="create-dependency-btn"]').should('be.visible')
      cy.get('[data-testid="create-dependency-btn"]').should('not.be.disabled')
      
      // Dependency deletion should be available
      cy.get('body').click() // Close context menu
      cy.openDependencyDeleteMenu('perm-dep-1')
      cy.get('[data-testid="delete-dependency-btn"]').should('be.visible')
      cy.get('[data-testid="delete-dependency-btn"]').should('not.be.disabled')
    })

    it('should allow task dragging for editors', () => {
      // Mock successful task update
      const updatedTask = {
        ...TEST_TASKS[0],
        start_date: '2024-01-05',
        end_date: '2024-01-20',
        version: 2
      }
      cy.mockApiResponse('PUT', '**/issues/perm-task-1', updatedTask)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Drag operation should work
      cy.dragTaskBar('perm-task-1', 50)
      cy.verifyDragDropSuccess()
    })

    it('should allow dependency creation for editors', () => {
      // Mock successful dependency creation
      const newDependency = {
        id: 'new-perm-dep',
        predecessor_issue_id: 'perm-task-2',
        successor_issue_id: 'perm-task-1',
        dependency_type: 'finish_to_start',
        lag_days: 1,
        is_active: true
      }
      cy.mockApiResponse('POST', '**/dependencies', newDependency)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Create dependency should work
      cy.createDependencyViaRightClick('perm-task-2', 'perm-task-1')
      cy.get('[data-testid="dependency-created-success"]').should('be.visible')
    })

    it('should allow dependency deletion for editors', () => {
      cy.mockApiResponse('DELETE', '**/dependencies/perm-dep-1', { success: true })
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Delete dependency should work
      cy.deleteDependency('perm-dep-1')
      cy.get('[data-testid="dependency-deleted-success"]').should('be.visible')
    })
  })

  describe('Viewer Role Restrictions', () => {
    beforeEach(() => {
      cy.setUserRole('viewer')
      
      // Update project mock to reflect viewer role
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}`, {
        id: TEST_PROJECT_ID,
        name: 'Permissions Test Project',
        description: 'Test project for permission validation',
        role: 'viewer'
      })
    })

    it('should show viewer role indicator and restrictions', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Viewer role indicator should be visible
      cy.get('[data-testid="user-role-indicator"]').should('contain', '閲覧専用')
      
      // Permission notice should be visible
      cy.get('[data-testid="permission-notice"]').should('be.visible')
      cy.get('[data-testid="permission-notice"]').should('contain', '閲覧専用モードです')
    })

    it('should disable task dragging for viewers', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify permission restrictions
      cy.verifyPermissionRestrictions('viewer', ['create', 'edit', 'delete', 'drag'])
      
      // Task bars should not be draggable
      cy.get('[data-testid^="task-bar-"]').should('not.have.class', 'draggable')
      
      // Drag attempt should show disabled message
      cy.get('[data-testid="task-bar-perm-task-1"]').trigger('mousedown', { button: 0 })
      cy.get('[data-testid="drag-disabled-message"]').should('be.visible')
      cy.get('[data-testid="drag-disabled-message"]').should('contain', '編集権限が必要です')
    })

    it('should disable dependency creation for viewers', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Right-click should not show creation option
      cy.get('[data-testid="task-bar-perm-task-1"]').rightclick()
      
      // Context menu should not have dependency creation option
      cy.get('[data-testid="create-dependency-btn"]').should('not.exist')
      
      // Should show view-only message instead
      cy.get('[data-testid="viewer-mode-message"]').should('be.visible')
      cy.get('[data-testid="viewer-mode-message"]').should('contain', '閲覧専用モード')
    })

    it('should disable dependency deletion for viewers', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Right-click on dependency should not show delete option
      cy.get('[data-testid="dependency-line-perm-dep-1"]').rightclick()
      
      // Delete option should not exist
      cy.get('[data-testid="delete-dependency-btn"]').should('not.exist')
      
      // Should show permission message
      cy.get('[data-testid="readonly-dependency-message"]').should('be.visible')
    })

    it('should still allow viewing dependency details for viewers', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should be able to select and view dependency details
      cy.selectDependencyLine('perm-dep-1')
      
      cy.get('[data-testid="dependency-details-panel"]').should('be.visible')
      cy.verifyDependencyDetails('perm-dep-1', 'finish_to_start', 0)
      
      // But edit controls should be disabled
      cy.get('[data-testid="edit-dependency-btn"]').should('be.disabled')
      cy.get('[data-testid="delete-dependency-btn"]').should('not.exist')
    })

    it('should allow navigation and viewing for viewers', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Basic viewing operations should work
      cy.selectTaskBar('perm-task-1')
      cy.get('[data-testid="task-bar-perm-task-1"]').should('have.class', 'selected')
      
      // Zoom and scroll should work
      cy.zoomGanttChart('in')
      cy.scrollGanttChart('right', 100)
      
      // Task details should be viewable
      cy.get('[data-testid="task-bar-perm-task-1"]').trigger('mouseover')
      cy.get('[data-testid="task-tooltip"]').should('be.visible')
    })
  })

  describe('Network Error Handling', () => {
    beforeEach(() => {
      cy.setUserRole('editor')
    })

    it('should handle API timeouts gracefully', () => {
      // Mock timeout scenario
      cy.intercept('GET', `**/projects/${TEST_PROJECT_ID}/issues`, (req) => {
        req.reply((res) => {
          res.delay(30000) // 30 second delay to trigger timeout
        })
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)

      // Should show timeout error and retry option
      cy.get('[data-testid="api-timeout-error"]', { timeout: 35000 }).should('be.visible')
      cy.get('[data-testid="api-timeout-error"]').should('contain', 'リクエストがタイムアウトしました')
      cy.get('[data-testid="retry-load-gantt"]').should('be.visible')
    })

    it('should handle network connectivity issues', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Test network error recovery flow
      cy.simulateNetworkErrorAndRecover()
    })

    it('should handle server errors during dependency operations', () => {
      // Mock server error
      cy.intercept('POST', '**/dependencies', {
        statusCode: 500,
        body: { error: 'Internal Server Error', message: 'Database connection failed' }
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Attempt to create dependency
      cy.openDependencyContextMenu('perm-task-1')
      cy.get('[data-testid="create-dependency-btn"]').click()
      cy.get('[data-testid="task-bar-perm-task-2"]').click()

      // Should show server error message
      cy.get('[data-testid="server-error"]').should('be.visible')
      cy.get('[data-testid="server-error"]').should('contain', 'サーバーエラーが発生しました')
      
      // Should offer error recovery options
      cy.verifyErrorRecoveryFlow('server_error', 'retry_operation')
    })

    it('should handle authentication errors', () => {
      // Mock authentication failure
      cy.intercept('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, {
        statusCode: 401,
        body: { error: 'Unauthorized', message: 'Session expired' }
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)

      // Should redirect to authentication
      cy.get('[data-testid="auth-expired-error"]').should('be.visible')
      cy.get('[data-testid="reauth-required"]').should('contain', '再認証が必要です')
      cy.get('[data-testid="reauth-button"]').should('be.visible')
    })
  })

  describe('Data Validation and Error States', () => {
    beforeEach(() => {
      cy.setUserRole('editor')
    })

    it('should handle tasks with invalid dates', () => {
      // Use invalid date fixture
      cy.fixture('gantt-comprehensive-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, 
          data.error_scenarios.invalid_dates.tasks)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should show validation warnings
      cy.verifyValidationMessages(['start_date_invalid', 'end_date_before_start'])
      
      // Invalid tasks should be highlighted
      cy.get('[data-testid="task-bar-invalid-date-task"]').should('have.class', 'validation-error')
      
      // Should show detailed error information
      cy.get('[data-testid="validation-details"]').should('contain', '終了日が開始日より前に設定されています')
    })

    it('should handle missing required data', () => {
      // Use missing data fixture
      cy.fixture('gantt-comprehensive-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, 
          data.error_scenarios.missing_data.tasks)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should show data integrity warnings
      cy.get('[data-testid="data-integrity-warning"]').should('be.visible')
      cy.get('[data-testid="missing-required-fields"]').should('be.visible')
      
      // Should handle missing data gracefully
      cy.get('[data-testid="task-bar-missing-data-task"]').should('be.visible')
      cy.get('[data-testid="task-bar-missing-data-task"]').should('contain', 'Untitled Task')
    })

    it('should handle circular dependency validation', () => {
      // Mock circular dependency error
      cy.mockApiResponse('POST', '**/dependencies', {
        error: 'Circular dependency detected',
        details: {
          cycle: ['perm-task-1', 'perm-task-2', 'perm-task-1'],
          violatingDependency: {
            predecessor: 'perm-task-2',
            successor: 'perm-task-1'
          }
        }
      }, 400)

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Try to create circular dependency
      cy.createDependencyViaRightClick('perm-task-2', 'perm-task-1')
      
      // Should show circular dependency error
      cy.verifyCircularDependencyError('循環依存が検出されました')
      
      // Should highlight the cycle path
      cy.get('[data-testid="cycle-path-visualization"]').should('be.visible')
      cy.get('[data-testid="task-bar-perm-task-1"]').should('have.class', 'cycle-highlighted')
      cy.get('[data-testid="task-bar-perm-task-2"]').should('have.class', 'cycle-highlighted')
    })

    it('should handle version conflicts during concurrent editing', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Mock version conflict
      cy.intercept('PUT', '**/issues/perm-task-1', {
        statusCode: 409,
        body: { 
          error: 'Version conflict',
          message: 'Task was modified by another user',
          currentVersion: 2,
          attemptedVersion: 1
        }
      })

      // Attempt to update task
      cy.dragTaskBar('perm-task-1', 50)
      
      // Should show version conflict dialog
      cy.verifyVersionConflictDialog()
      
      // Should provide resolution options
      cy.get('[data-testid="conflict-resolution-options"]').should('be.visible')
      cy.get('[data-testid="reload-and-retry"]').should('be.visible')
      cy.get('[data-testid="override-changes"]').should('be.visible')
      cy.get('[data-testid="discard-changes"]').should('be.visible')
    })
  })

  describe('Loading States and Performance', () => {
    beforeEach(() => {
      cy.setUserRole('editor')
    })

    it('should show appropriate loading states', () => {
      // Mock slow loading
      cy.intercept('GET', `**/projects/${TEST_PROJECT_ID}/issues`, (req) => {
        req.reply((res) => {
          res.delay(2000)
          res.send(TEST_TASKS)
        })
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)

      // Should show loading state
      cy.get('[data-testid="gantt-loading"]').should('be.visible')
      cy.get('[data-testid="gantt-loading"]').should('contain', 'ガントチャートを読み込み中')
      
      // Loading spinner should be animated
      cy.get('[data-testid="loading-spinner"]').should('have.class', 'animate-spin')
      
      // Should show progress if available
      cy.get('[data-testid="loading-progress"]').should('be.visible')
      
      // Wait for completion
      cy.waitForGanttChartLoad()
      cy.get('[data-testid="gantt-loading"]').should('not.exist')
    })

    it('should provide loading feedback during operations', () => {
      // Mock slow API response for dependency creation
      cy.intercept('POST', '**/dependencies', (req) => {
        req.reply((res) => {
          res.delay(2000) // 2 second delay
          res.send({ 
            id: 'slow-dep',
            predecessor_issue_id: 'perm-task-1',
            successor_issue_id: 'perm-task-2',
            dependency_type: 'finish_to_start'
          })
        })
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Start operation and verify loading feedback
      cy.openDependencyContextMenu('perm-task-1')
      cy.get('[data-testid="create-dependency-btn"]').click()
      cy.get('[data-testid="task-bar-perm-task-2"]').click()

      // Should show operation-specific loading
      cy.verifyLoadingFeedback('dependency-creation-loading')
      
      // Should allow cancellation during loading
      cy.get('[data-testid="cancel-operation"]').should('be.visible').and('not.be.disabled')
    })

    it('should handle graceful degradation with partial data', () => {
      // Mock partial success scenario
      cy.intercept('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, {
        statusCode: 206, // Partial Content
        body: [TEST_DEPENDENCY] // Only some dependencies loaded
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should show partial data warning
      cy.get('[data-testid="partial-data-warning"]').should('be.visible')
      cy.get('[data-testid="partial-data-warning"]').should('contain', '一部のデータが読み込めませんでした')
      
      // Should offer to retry loading missing data
      cy.get('[data-testid="retry-missing-data"]').should('be.visible')
      
      // Available data should still be functional
      cy.verifyGanttChartState(2, 1)
    })
  })

  describe('Accessibility and Error Communication', () => {
    beforeEach(() => {
      cy.setUserRole('editor')
    })

    it('should provide accessible error messages', () => {
      // Mock API error
      cy.intercept('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, {
        statusCode: 500,
        body: { error: 'Database unavailable' }
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)

      // Error message should be accessible
      cy.get('[data-testid="error-message"]').should('have.attr', 'role', 'alert')
      cy.get('[data-testid="error-message"]').should('have.attr', 'aria-live', 'assertive')
      
      // Screen reader announcements
      cy.get('[data-testid="sr-announcements"]').should('contain', 'エラーが発生しました')
    })

    it('should provide keyboard navigation for error recovery', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Simulate error state
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('gantt-error', {
          detail: { type: 'network_error', recoverable: true }
        }))
      })

      // Error dialog should be keyboard navigable
      cy.get('[data-testid="error-dialog"]').should('be.visible')
      cy.get('[data-testid="error-dialog"]').should('have.attr', 'role', 'dialog')
      
      // Tab navigation should work
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid', 'retry-button')
      
      // Enter should activate retry
      cy.focused().type('{enter}')
      cy.get('[data-testid="retry-in-progress"]').should('be.visible')
    })

    it('should provide clear visual indicators for different error types', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Test different error indicators
      const errorTypes = [
        { type: 'network_error', color: 'red', icon: 'wifi-off' },
        { type: 'permission_error', color: 'orange', icon: 'lock' },
        { type: 'validation_error', color: 'yellow', icon: 'warning' }
      ]

      errorTypes.forEach(errorType => {
        cy.window().then((win) => {
          win.dispatchEvent(new CustomEvent('gantt-error', {
            detail: { type: errorType.type }
          }))
        })

        cy.get(`[data-testid="${errorType.type}-indicator"]`)
          .should('be.visible')
          .should('have.class', `error-${errorType.color}`)
          .should('contain', errorType.icon)
      })
    })
  })
})