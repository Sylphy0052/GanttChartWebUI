/// <reference types="cypress" />

/**
 * Dependency Management E2E Tests
 * 
 * 依存関係作成・削除・線表示のテスト
 * ドラッグ&ドロップ日程変更と依存関係制約のテスト
 */

describe('Dependency Management E2E Tests', () => {
  const TEST_PROJECT_ID = 'dependency-test-project-456'
  const PREDECESSOR_TASK = {
    id: 'predecessor-task-1',
    project_id: TEST_PROJECT_ID,
    title: 'Predecessor Task',
    description_md: 'Task that comes before others',
    status: 'in_progress',
    assignee: 'lead@example.com',
    progress_pct: 60,
    is_blocked: false,
    labels: ['predecessor'],
    sort_order: 100,
    version: 1,
    start_date: '2024-01-01',
    end_date: '2024-01-15',
    wbs_number: '1',
    parent_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    children: []
  }
  
  const SUCCESSOR_TASK = {
    id: 'successor-task-1',
    project_id: TEST_PROJECT_ID,
    title: 'Successor Task',
    description_md: 'Task that depends on predecessor',
    status: 'open',
    assignee: 'dev@example.com',
    progress_pct: 20,
    is_blocked: false,
    labels: ['successor'],
    sort_order: 200,
    version: 1,
    start_date: '2024-01-16',
    end_date: '2024-01-31',
    wbs_number: '2',
    parent_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    children: []
  }
  
  const INDEPENDENT_TASK = {
    id: 'independent-task-1',
    project_id: TEST_PROJECT_ID,
    title: 'Independent Task',
    description_md: 'Task with no dependencies',
    status: 'open',
    assignee: 'contractor@example.com',
    progress_pct: 0,
    is_blocked: false,
    labels: ['independent'],
    sort_order: 300,
    version: 1,
    start_date: '2024-01-05',
    end_date: '2024-01-12',
    wbs_number: '3',
    parent_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    children: []
  }

  const TEST_TASKS = [PREDECESSOR_TASK, SUCCESSOR_TASK, INDEPENDENT_TASK]

  beforeEach(() => {
    cy.cleanupTestData()
    cy.setUserRole('editor')
    
    // Mock project data
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}`, {
      id: TEST_PROJECT_ID,
      name: 'Dependency Management Test Project',
      description: 'Test project for dependency management',
      role: 'editor'
    })
    
    // Mock tasks data
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, TEST_TASKS)
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
  })

  describe('Dependency Creation via Right-Click Context Menu', () => {
    it('should open context menu on task right-click', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Right-click on predecessor task
      cy.openDependencyContextMenu('predecessor-task-1')
      
      // Verify context menu appears
      cy.get('[data-testid="dependency-context-menu"]').should('be.visible')
      cy.get('[data-testid="create-dependency-btn"]').should('be.visible')
      cy.get('[data-testid="create-dependency-btn"]').should('contain', '依存関係を作成')
    })

    it('should create dependency via right-click workflow', () => {
      // Mock successful dependency creation
      const newDependency = {
        id: 'new-dependency-123',
        predecessor_issue_id: 'predecessor-task-1',
        successor_issue_id: 'successor-task-1',
        dependency_type: 'finish_to_start',
        lag_days: 0,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      
      cy.mockApiResponse('POST', '**/dependencies', newDependency)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Create dependency using right-click workflow
      cy.createDependencyViaRightClick('predecessor-task-1', 'successor-task-1')
      
      // Verify dependency creation success notification
      cy.get('[data-testid="dependency-created-success"]').should('be.visible')
      cy.get('[data-testid="dependency-created-success"]').should('contain', '依存関係が作成されました')
    })

    it('should enter dependency creation mode', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Right-click and enter creation mode
      cy.openDependencyContextMenu('predecessor-task-1')
      cy.get('[data-testid="create-dependency-btn"]').click()
      
      // Verify creation mode is active
      cy.get('[data-testid="dependency-creation-mode"]').should('be.visible')
      cy.get('[data-testid="creation-mode-instructions"]').should('contain', '後続タスクをクリックしてください')
      
      // Cursor should change to indicate creation mode
      cy.get('[data-testid="gantt-container"]').should('have.class', 'dependency-creation-mode')
    })

    it('should cancel dependency creation with escape key', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Enter creation mode
      cy.openDependencyContextMenu('predecessor-task-1')
      cy.get('[data-testid="create-dependency-btn"]').click()
      cy.get('[data-testid="dependency-creation-mode"]').should('be.visible')
      
      // Cancel with escape key
      cy.get('body').type('{esc}')
      
      // Verify creation mode is cancelled
      cy.get('[data-testid="dependency-creation-mode"]').should('not.exist')
      cy.get('[data-testid="gantt-container"]').should('not.have.class', 'dependency-creation-mode')
    })

    it('should validate dependency creation rules', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Try to create self-dependency (should be prevented)
      cy.openDependencyContextMenu('predecessor-task-1')
      cy.get('[data-testid="create-dependency-btn"]').click()
      cy.get('[data-testid="task-bar-predecessor-task-1"]').click()
      
      // Should show validation error
      cy.get('[data-testid="dependency-validation-error"]').should('be.visible')
      cy.get('[data-testid="dependency-validation-error"]').should('contain', '自己依存は作成できません')
    })
  })

  describe('Dependency Line Display and Interaction', () => {
    beforeEach(() => {
      // Mock existing dependency
      const existingDependency = {
        id: 'existing-dep-123',
        predecessor_issue_id: 'predecessor-task-1',
        successor_issue_id: 'successor-task-1',
        dependency_type: 'finish_to_start',
        lag_days: 0,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [existingDependency])
    })

    it('should display dependency lines correctly', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify dependency line exists
      cy.get('[data-testid="dependency-line-existing-dep-123"]').should('be.visible')
      
      // Verify line connects correct tasks
      cy.get('[data-testid="dependency-line-existing-dep-123"]')
        .should('have.attr', 'data-predecessor', 'predecessor-task-1')
        .should('have.attr', 'data-successor', 'successor-task-1')
      
      // Verify arrow direction (finish-to-start)
      cy.get('[data-testid="dependency-arrow-existing-dep-123"]')
        .should('be.visible')
        .should('have.class', 'arrow-finish-to-start')
    })

    it('should highlight dependency line on hover', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Hover over dependency line
      cy.get('[data-testid="dependency-line-existing-dep-123"]').trigger('mouseover')
      
      // Should highlight line and connected tasks
      cy.get('[data-testid="dependency-line-existing-dep-123"]').should('have.class', 'highlighted')
      cy.get('[data-testid="task-bar-predecessor-task-1"]').should('have.class', 'dependency-highlighted')
      cy.get('[data-testid="task-bar-successor-task-1"]').should('have.class', 'dependency-highlighted')
      
      // Should show dependency tooltip
      cy.get('[data-testid="dependency-tooltip"]').should('be.visible')
      cy.get('[data-testid="dependency-tooltip"]').should('contain', 'Finish-to-Start')
    })

    it('should select dependency line on click', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Click on dependency line
      cy.selectDependencyLine('existing-dep-123')
      
      // Verify selection
      cy.get('[data-testid="dependency-line-existing-dep-123"]').should('have.class', 'selected')
      
      // Should show dependency details panel
      cy.get('[data-testid="dependency-details-panel"]').should('be.visible')
      cy.verifyDependencyDetails('existing-dep-123', 'finish_to_start', 0)
    })

    it('should display different dependency types correctly', () => {
      // Mock different dependency types
      const dependencies = [
        {
          id: 'fs-dep',
          predecessor_issue_id: 'predecessor-task-1',
          successor_issue_id: 'successor-task-1',
          dependency_type: 'finish_to_start',
          lag_days: 0,
          is_active: true
        },
        {
          id: 'ss-dep',
          predecessor_issue_id: 'predecessor-task-1',
          successor_issue_id: 'independent-task-1',
          dependency_type: 'start_to_start',
          lag_days: 2,
          is_active: true
        }
      ]
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, dependencies)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify different line styles
      cy.get('[data-testid="dependency-line-fs-dep"]')
        .should('have.class', 'type-finish-to-start')
      
      cy.get('[data-testid="dependency-line-ss-dep"]')
        .should('have.class', 'type-start-to-start')
      
      // Verify lag days indicator
      cy.get('[data-testid="lag-indicator-ss-dep"]')
        .should('be.visible')
        .should('contain', '+2日')
    })
  })

  describe('Dependency Deletion', () => {
    beforeEach(() => {
      const existingDependency = {
        id: 'deletable-dep-123',
        predecessor_issue_id: 'predecessor-task-1',
        successor_issue_id: 'successor-task-1',
        dependency_type: 'finish_to_start',
        lag_days: 0,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [existingDependency])
      cy.mockApiResponse('DELETE', '**/dependencies/deletable-dep-123', { success: true })
    })

    it('should open deletion context menu on dependency right-click', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Right-click on dependency line
      cy.openDependencyDeleteMenu('deletable-dep-123')
      
      // Verify deletion menu
      cy.get('[data-testid="dependency-context-menu"]').should('be.visible')
      cy.get('[data-testid="delete-dependency-btn"]').should('be.visible')
      cy.get('[data-testid="delete-dependency-btn"]').should('contain', '依存関係を削除')
    })

    it('should delete dependency with confirmation', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Delete dependency
      cy.deleteDependency('deletable-dep-123')
      
      // Verify deletion success
      cy.get('[data-testid="dependency-deleted-success"]').should('be.visible')
      cy.get('[data-testid="dependency-line-deletable-dep-123"]').should('not.exist')
    })

    it('should show confirmation dialog before deletion', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Start deletion process
      cy.openDependencyDeleteMenu('deletable-dep-123')
      cy.get('[data-testid="delete-dependency-btn"]').click()
      
      // Verify confirmation dialog
      cy.get('[data-testid="delete-dependency-confirmation"]').should('be.visible')
      cy.get('[data-testid="delete-dependency-confirmation"]').should('contain', '依存関係を削除しますか？')
      
      // Should show impact information
      cy.get('[data-testid="deletion-impact-info"]').should('contain', 'Predecessor Task → Successor Task')
      
      // Verify buttons
      cy.get('[data-testid="confirm-delete-dependency"]').should('be.visible')
      cy.get('[data-testid="cancel-delete-dependency"]').should('be.visible')
    })

    it('should cancel deletion', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Start and cancel deletion
      cy.openDependencyDeleteMenu('deletable-dep-123')
      cy.get('[data-testid="delete-dependency-btn"]').click()
      cy.get('[data-testid="cancel-delete-dependency"]').click()
      
      // Verify dependency still exists
      cy.get('[data-testid="dependency-line-deletable-dep-123"]').should('be.visible')
      cy.get('[data-testid="delete-dependency-confirmation"]').should('not.exist')
    })
  })

  describe('Circular Dependency Detection', () => {
    beforeEach(() => {
      // Mock chain of dependencies that could create a cycle
      const chainDependencies = [
        {
          id: 'chain-dep-1',
          predecessor_issue_id: 'predecessor-task-1',
          successor_issue_id: 'successor-task-1',
          dependency_type: 'finish_to_start',
          lag_days: 0,
          is_active: true
        },
        {
          id: 'chain-dep-2',
          predecessor_issue_id: 'successor-task-1',
          successor_issue_id: 'independent-task-1',
          dependency_type: 'finish_to_start',
          lag_days: 0,
          is_active: true
        }
      ]
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, chainDependencies)
    })

    it('should detect circular dependency creation attempt', () => {
      // Mock circular dependency error
      cy.mockApiResponse('POST', '**/dependencies', {
        error: 'Circular dependency detected: independent-task-1 → predecessor-task-1 would create a cycle',
        details: {
          cycle: ['predecessor-task-1', 'successor-task-1', 'independent-task-1', 'predecessor-task-1']
        }
      }, 400)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Try to create circular dependency
      cy.createDependencyViaRightClick('independent-task-1', 'predecessor-task-1')
      
      // Verify error message
      cy.verifyCircularDependencyError('循環依存が検出されました')
      
      // Should show cycle path
      cy.get('[data-testid="cycle-path-visualization"]').should('be.visible')
      cy.get('[data-testid="cycle-path-visualization"]').should('contain', 'predecessor-task-1 → successor-task-1 → independent-task-1')
    })

    it('should highlight cycle path in gantt chart', () => {
      // Simulate circular dependency detection
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Trigger cycle detection
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('circular-dependency-detected', {
          detail: {
            cycle: ['predecessor-task-1', 'successor-task-1', 'independent-task-1'],
            attemptedDependency: {
              predecessor: 'independent-task-1',
              successor: 'predecessor-task-1'
            }
          }
        }))
      })
      
      // Verify cycle highlighting
      cy.get('[data-testid="task-bar-predecessor-task-1"]').should('have.class', 'cycle-highlighted')
      cy.get('[data-testid="task-bar-successor-task-1"]').should('have.class', 'cycle-highlighted')
      cy.get('[data-testid="task-bar-independent-task-1"]').should('have.class', 'cycle-highlighted')
    })

    it('should provide cycle resolution suggestions', () => {
      cy.mockApiResponse('POST', '**/dependencies', {
        error: 'Circular dependency detected',
        suggestions: [
          'Remove dependency: successor-task-1 → independent-task-1',
          'Change dependency type from finish_to_start to start_to_start'
        ]
      }, 400)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      cy.createDependencyViaRightClick('independent-task-1', 'predecessor-task-1')
      
      // Verify suggestions
      cy.get('[data-testid="cycle-resolution-suggestions"]').should('be.visible')
      cy.get('[data-testid="suggestion-1"]').should('contain', 'Remove dependency')
      cy.get('[data-testid="suggestion-2"]').should('contain', 'Change dependency type')
    })
  })

  describe('Task Bar Drag and Drop with Dependency Constraints', () => {
    beforeEach(() => {
      const dependency = {
        id: 'constraint-dep-123',
        predecessor_issue_id: 'predecessor-task-1',
        successor_issue_id: 'successor-task-1',
        dependency_type: 'finish_to_start',
        lag_days: 0,
        is_active: true
      }
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [dependency])
    })

    it('should allow valid drag and drop operations', () => {
      // Mock successful task update
      const updatedTask = {
        ...SUCCESSOR_TASK,
        start_date: '2024-01-20',
        end_date: '2024-02-05',
        version: 2
      }
      
      cy.mockApiResponse('PUT', '**/issues/successor-task-1', updatedTask)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Drag successor task to later date (valid move)
      cy.dragTaskBar('successor-task-1', 50) // Move right (later date)
      
      // Should succeed
      cy.verifyDragDropSuccess()
      cy.get('[data-testid="constraint-violation-warning"]').should('not.exist')
    })

    it('should prevent constraint violation drag operations', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Try to drag successor task before predecessor (violation)
      cy.dragTaskBar('successor-task-1', -200) // Move left (earlier date)
      
      // Should show constraint violation
      cy.verifyDragConstraintViolation('依存関係制約に違反します')
      
      // Should revert to original position
      cy.verifyTaskBarPosition('successor-task-1', '2024-01-16', '2024-01-31')
    })

    it('should show constraint preview during drag', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Start dragging
      cy.get('[data-testid="draggable-task-bar-successor-task-1"]')
        .trigger('mousedown', { button: 0, clientX: 300, clientY: 200 })
      
      // Should show constraint indicators
      cy.get('[data-testid="constraint-preview"]').should('be.visible')
      cy.get('[data-testid="valid-drop-zone"]').should('be.visible')
      cy.get('[data-testid="invalid-drop-zone"]').should('be.visible')
      
      // Move to invalid position
      cy.get('[data-testid="draggable-task-bar-successor-task-1"]')
        .trigger('mousemove', { clientX: 100, clientY: 200 })
      
      // Should show violation warning
      cy.get('[data-testid="drag-violation-preview"]').should('be.visible')
      cy.get('[data-testid="drag-violation-preview"]').should('contain', '制約違反')
      
      // Cancel drag
      cy.get('body').type('{esc}')
    })

    it('should cascade schedule adjustments', () => {
      // Mock cascade adjustment response
      cy.mockApiResponse('PUT', '**/issues/predecessor-task-1', {
        ...PREDECESSOR_TASK,
        end_date: '2024-01-20',
        version: 2
      })
      
      // Mock cascade notification
      cy.intercept('PUT', '**/issues/predecessor-task-1').as('updatePredecessor')
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Drag predecessor task to extend its end date
      cy.dragTaskBar('predecessor-task-1', 100)
      
      cy.wait('@updatePredecessor')
      
      // Should trigger cascade adjustment notification
      cy.verifyCascadeAdjustmentNotification()
      
      // Should show affected tasks
      cy.verifyScheduleAdjustmentNotification(['successor-task-1'])
    })

    it('should handle lag days in constraint calculations', () => {
      // Mock dependency with lag days
      const dependencyWithLag = {
        id: 'lag-dep-123',
        predecessor_issue_id: 'predecessor-task-1',
        successor_issue_id: 'successor-task-1',
        dependency_type: 'finish_to_start',
        lag_days: 5,
        is_active: true
      }
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [dependencyWithLag])
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Drag successor to position that respects lag
      cy.dragTaskBar('successor-task-1', -50)
      
      // Should calculate constraint with lag days
      cy.verifyDragConstraintViolation('5日のラグを考慮した制約違反')
    })
  })

  describe('Viewer Role Restrictions', () => {
    beforeEach(() => {
      cy.setUserRole('viewer')
      
      const existingDependency = {
        id: 'readonly-dep-123',
        predecessor_issue_id: 'predecessor-task-1',
        successor_issue_id: 'successor-task-1',
        dependency_type: 'finish_to_start',
        lag_days: 0,
        is_active: true
      }
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [existingDependency])
    })

    it('should disable dependency creation for viewers', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Right-click should not show creation option
      cy.get('[data-testid="task-bar-predecessor-task-1"]').rightclick()
      
      // Context menu should not have dependency creation
      cy.get('[data-testid="create-dependency-btn"]').should('not.exist')
      
      // Should show view-only message
      cy.get('[data-testid="viewer-mode-message"]').should('be.visible')
      cy.get('[data-testid="viewer-mode-message"]').should('contain', '閲覧専用モード')
    })

    it('should disable dependency deletion for viewers', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Right-click on dependency should not show delete option
      cy.get('[data-testid="dependency-line-readonly-dep-123"]').rightclick()
      
      cy.get('[data-testid="delete-dependency-btn"]').should('not.exist')
    })

    it('should disable task dragging for viewers', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Task bars should not be draggable
      cy.get('[data-testid="task-bar-predecessor-task-1"]').should('not.have.class', 'draggable')
      
      // Drag attempt should not work
      cy.get('[data-testid="task-bar-predecessor-task-1"]')
        .trigger('mousedown', { button: 0 })
      
      cy.get('[data-testid="drag-disabled-message"]').should('be.visible')
    })

    it('should still allow dependency line selection and viewing', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should be able to select and view dependency details
      cy.selectDependencyLine('readonly-dep-123')
      
      cy.get('[data-testid="dependency-details-panel"]').should('be.visible')
      cy.verifyDependencyDetails('readonly-dep-123', 'finish_to_start', 0)
      
      // But edit controls should be disabled
      cy.get('[data-testid="edit-dependency-btn"]').should('be.disabled')
    })
  })

  describe('WebSocket Real-time Dependency Updates', () => {
    it('should receive real-time dependency creation notifications', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()
      cy.verifyWebSocketConnection('connected')

      // Simulate dependency creation by another user
      cy.simulateGanttWebSocketNotification('dependency_created', {
        projectId: TEST_PROJECT_ID,
        dependency: {
          id: 'realtime-dep-456',
          predecessor_issue_id: 'predecessor-task-1',
          successor_issue_id: 'independent-task-1',
          dependency_type: 'finish_to_start',
          lag_days: 1,
          is_active: true
        },
        author: 'colleague@example.com'
      })

      // Should show real-time notification
      cy.verifyRealtimeNotification('dependency_created', 'colleague@example.com')
      
      // Dependency line should appear
      cy.get('[data-testid="dependency-line-realtime-dep-456"]').should('be.visible')
    })

    it('should receive real-time dependency deletion notifications', () => {
      // Start with existing dependency
      const existingDependency = {
        id: 'realtime-delete-dep',
        predecessor_issue_id: 'predecessor-task-1',
        successor_issue_id: 'successor-task-1',
        dependency_type: 'finish_to_start',
        lag_days: 0,
        is_active: true
      }
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [existingDependency])
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Simulate dependency deletion by another user
      cy.simulateGanttWebSocketNotification('dependency_deleted', {
        projectId: TEST_PROJECT_ID,
        dependencyId: 'realtime-delete-dep',
        author: 'manager@example.com'
      })

      // Should show deletion notification
      cy.verifyRealtimeNotification('dependency_deleted', 'manager@example.com')
      
      // Dependency line should disappear
      cy.get('[data-testid="dependency-line-realtime-delete-dep"]').should('not.exist')
    })

    it('should handle concurrent dependency modifications', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Simulate version conflict scenario
      cy.intercept('POST', '**/dependencies', {
        statusCode: 409,
        body: { 
          error: 'Dependency was modified by another user',
          latestVersion: {
            id: 'conflict-dep',
            version: 2
          }
        }
      })

      // Try to create dependency
      cy.createDependencyViaRightClick('predecessor-task-1', 'successor-task-1')
      
      // Should show conflict resolution dialog
      cy.verifyVersionConflictDialog()
      
      // Should offer to reload and retry
      cy.get('[data-testid="reload-and-retry"]').should('be.visible')
      cy.get('[data-testid="reload-and-retry"]').click()
      
      // Should reload dependencies
      cy.get('[data-testid="dependencies-reloaded"]').should('be.visible')
    })
  })

  describe('Performance with Many Dependencies', () => {
    it('should handle large number of dependencies efficiently', () => {
      // Create many dependencies
      const manyDependencies = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-dep-${i}`,
        predecessor_issue_id: i % 2 === 0 ? 'predecessor-task-1' : 'successor-task-1',
        successor_issue_id: i % 2 === 0 ? 'successor-task-1' : 'independent-task-1',
        dependency_type: 'finish_to_start',
        lag_days: i % 5,
        is_active: true
      }))
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, manyDependencies)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.measureGanttRenderingPerformance(3, 100)
      cy.waitForGanttChartLoad()

      // Should render all dependencies
      cy.verifyGanttChartState(3, 100)
      
      // Interaction should remain responsive
      cy.measureOperationResponseTime(() => {
        cy.selectDependencyLine('perf-dep-50')
      })
    })

    it('should optimize dependency line rendering', () => {
      // Test with complex dependency network
      const complexDependencies = Array.from({ length: 50 }, (_, i) => ({
        id: `complex-dep-${i}`,
        predecessor_issue_id: 'predecessor-task-1',
        successor_issue_id: ['successor-task-1', 'independent-task-1'][i % 2],
        dependency_type: ['finish_to_start', 'start_to_start'][i % 2],
        lag_days: i % 3,
        is_active: true
      }))
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, complexDependencies)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Scrolling should remain smooth
      cy.scrollGanttChart('right', 300)
      cy.scrollGanttChart('left', 300)
      
      // Line selection should be responsive
      cy.selectDependencyLine('complex-dep-25')
      cy.get('[data-testid="dependency-details-panel"]').should('be.visible')
    })
  })
})