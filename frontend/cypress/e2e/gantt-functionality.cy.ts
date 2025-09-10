/// <reference types="cypress" />

/**
 * Frontend ガント機能 E2E テスト
 * 
 * このテストファイルは、ガントチャート機能の包括的なE2E（End-to-End）テストを提供します。
 * 以下の主要機能をテストします：
 * 
 * 1. ガントチャート基本機能E2Eテスト
 * 2. 依存関係管理E2Eテスト
 * 3. リアルタイム機能E2Eテスト
 * 4. 統合シナリオテスト
 * 5. パフォーマンス・UI応答性テスト
 * 6. アクセシビリティ・キーボード操作テスト
 */

describe('Gantt Chart Functionality E2E Tests', () => {
  const TEST_PROJECT_ID = 'test-gantt-project-123'
  const TEST_PARENT_ISSUE_ID = 'gantt-task-1'
  const TEST_CHILD_ISSUE_ID = 'gantt-task-2'
  const TEST_MILESTONE_ID = 'gantt-milestone-1'

  beforeEach(() => {
    cy.cleanupTestData()
    cy.setUserRole('editor')
  })

  describe('1. ガントチャート基本機能E2Eテスト', () => {
    
    it('should navigate to Gantt chart view and display task bars', () => {
      // Setup test data using custom command
      cy.createGanttTestData(TEST_PROJECT_ID, 3).then((tasks) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      // Navigate to Gantt chart
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify basic display
      cy.verifyGanttChartState(3, 0)

      // Check individual task bars
      cy.selectTaskBar(TEST_PARENT_ISSUE_ID)
      cy.selectTaskBar(TEST_CHILD_ISSUE_ID)
      cy.selectMilestone(TEST_MILESTONE_ID)

      // Verify task bar positions and progress
      cy.verifyTaskBarPosition(TEST_PARENT_ISSUE_ID, '2024-01-01', '2024-03-31')
      cy.verifyProgressBar(TEST_PARENT_ISSUE_ID, 60)
    })

    it('should display dependency lines correctly', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, data.dependencies)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify dependency display
      cy.verifyGanttChartState(3, 1)
      cy.selectDependencyLine('gantt-dep-1')
      cy.verifyDependencyDetails('gantt-dep-1', 'Finish-to-Start', 0)
    })

    it('should support drag and drop task scheduling', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])

        // Mock successful update
        const updatedTask = {
          ...data.tasks[1],
          start_date: '2024-01-20',
          end_date: '2024-02-20',
          version: 2
        }
        cy.mockApiResponse('PUT', `**/issues/${TEST_CHILD_ISSUE_ID}`, updatedTask)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Perform drag and drop
      cy.dragTaskBar(TEST_CHILD_ISSUE_ID, 50) // Move 50px right
      cy.verifyDragDropSuccess()
    })
  })

  describe('2. 依存関係管理E2Eテスト', () => {

    it('should create dependency via right-click context menu', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
        cy.mockApiResponse('POST', `**/dependencies`, { fixture: 'dependency-success' })
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      cy.createDependencyViaRightClick(TEST_PARENT_ISSUE_ID, TEST_CHILD_ISSUE_ID)
    })

    it('should delete dependency and handle confirmation', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, data.dependencies)
        cy.mockApiResponse('DELETE', `**/dependencies/gantt-dep-1`, { success: true })
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      cy.deleteDependency('gantt-dep-1')
    })

    it('should detect and prevent circular dependencies', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, data.dependencies)
        cy.mockApiResponse('POST', `**/dependencies`, 
          { error: 'Circular dependency detected' }, 400)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Try to create circular dependency
      cy.createDependencyViaRightClick(TEST_MILESTONE_ID, TEST_CHILD_ISSUE_ID)
      cy.verifyCircularDependencyError('循環依存が検出されました')
    })
  })

  describe('3. リアルタイム機能E2Eテスト', () => {

    it('should receive and display real-time dependency notifications', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()
      cy.verifyWebSocketConnection('connected')

      // Simulate WebSocket notification
      cy.simulateGanttWebSocketNotification('dependency_created', {
        projectId: TEST_PROJECT_ID,
        dependency: {
          id: 'realtime-dep-123',
          predecessor_issue_id: TEST_PARENT_ISSUE_ID,
          successor_issue_id: TEST_CHILD_ISSUE_ID,
          dependency_type: 'finish_to_start',
          lag_days: 0,
          is_active: true
        },
        author: 'other-user@example.com'
      })

      cy.verifyRealtimeNotification('dependency_created', 'other-user@example.com')
    })

    it('should handle real-time issue updates', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Simulate issue update via WebSocket
      cy.simulateGanttWebSocketNotification('issue_updated', {
        projectId: TEST_PROJECT_ID,
        issue: {
          id: TEST_CHILD_ISSUE_ID,
          progress_pct: 75,
          status: 'in_progress',
          version: 2
        },
        author: 'team-member@example.com'
      })

      cy.verifyRealtimeNotification('issue_updated', 'team-member@example.com')
    })

    it('should handle schedule adjustment notifications', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, data.dependencies)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Simulate schedule adjustment
      cy.simulateGanttWebSocketNotification('schedule_adjusted', {
        projectId: TEST_PROJECT_ID,
        affectedIssues: [TEST_MILESTONE_ID],
        reason: 'dependency_change',
        triggerIssue: TEST_CHILD_ISSUE_ID,
        author: 'system'
      })

      cy.verifyScheduleAdjustmentNotification([TEST_MILESTONE_ID])
    })

    it('should show connection status and handle reconnection', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Initial connection
      cy.verifyWebSocketConnection('connected')

      // Simulate disconnection
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('websocket-disconnect'))
      })
      cy.verifyWebSocketConnection('disconnected')

      // Simulate reconnection
      cy.window().then((win) => {
        win.dispatchEvent(new CustomEvent('websocket-connect'))
      })
      cy.verifyWebSocketConnection('connected')
    })
  })

  describe('4. 統合シナリオテスト', () => {

    it('should complete full workflow: Create → Dependency → Drag&Drop → WebSocket', () => {
      // Start with basic tasks
      cy.createGanttTestData(TEST_PROJECT_ID, 2).then((tasks) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Step 1: Create new issue (inline)
      const newTask = {
        id: 'integration-task-123',
        project_id: TEST_PROJECT_ID,
        title: 'Integration Test Task',
        status: 'open',
        progress_pct: 0,
        start_date: '2024-03-01',
        end_date: '2024-03-15'
      }
      cy.mockApiResponse('POST', `**/issues`, newTask)

      // Step 2: Create dependency
      cy.mockApiResponse('POST', `**/dependencies`, {
        id: 'integration-dep-123',
        predecessor_issue_id: TEST_CHILD_ISSUE_ID,
        successor_issue_id: 'integration-task-123',
        dependency_type: 'finish_to_start'
      })

      cy.createDependencyViaRightClick(TEST_CHILD_ISSUE_ID, 'integration-task-123')

      // Step 3: Drag and drop adjustment
      cy.mockApiResponse('PUT', `**/issues/integration-task-123`, {
        ...newTask,
        start_date: '2024-03-05',
        end_date: '2024-03-19',
        version: 2
      })

      cy.dragTaskBar('integration-task-123', 50)
      cy.verifyDragDropSuccess()

      // Step 4: Verify WebSocket notification
      cy.simulateGanttWebSocketNotification('issue_updated', {
        projectId: TEST_PROJECT_ID,
        issue: { ...newTask, version: 2 },
        author: 'integration-test@example.com'
      })

      cy.verifyRealtimeNotification('issue_updated', 'integration-test@example.com')
    })

    it('should handle dependency chain operations', () => {
      cy.createDependencyChainData(TEST_PROJECT_ID, 4).then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, data.dependencies)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify chain is displayed
      cy.verifyGanttChartState(4, 3)

      // Move a task in the middle of chain
      cy.mockApiResponse('PUT', `**/issues/test-task-2`, {
        id: 'test-task-2',
        start_date: '2024-01-10',
        end_date: '2024-01-15',
        version: 2
      })

      cy.dragTaskBar('test-task-2', 30)
      cy.verifyCascadeAdjustmentNotification()
    })

    it('should recover gracefully from error states', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Simulate API error
      cy.intercept('POST', `**/dependencies`, {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      })

      cy.openDependencyContextMenu(TEST_PARENT_ISSUE_ID)
      cy.get('[data-testid="create-dependency-btn"]').click()
      cy.get(`[data-testid="task-bar-${TEST_CHILD_ISSUE_ID}"]`).click()

      // Test error recovery
      cy.testErrorRecovery()
    })

    it('should handle concurrent editing scenarios', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Simulate version conflict
      cy.intercept('PUT', `**/issues/${TEST_CHILD_ISSUE_ID}`, {
        statusCode: 409,
        body: { error: 'Version conflict' }
      })

      cy.dragTaskBar(TEST_CHILD_ISSUE_ID, 50)
      cy.verifyVersionConflictDialog()

      // Resolve conflict
      cy.get('[data-testid="reload-and-retry"]').click()
    })
  })

  describe('5. パフォーマンス・UI応答性テスト', () => {

    it('should handle large datasets efficiently', () => {
      // Generate large dataset
      cy.createGanttTestData(TEST_PROJECT_ID, 50).then((tasks) => {
        // Create dependencies chain
        const dependencies = Array.from({ length: 40 }, (_, i) => ({
          id: `perf-dep-${i}`,
          predecessor_issue_id: tasks[i].id,
          successor_issue_id: tasks[i + 1].id,
          dependency_type: 'finish_to_start'
        }))

        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, dependencies)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.measureGanttRenderingPerformance(50, 40)
      cy.waitForGanttChartLoad()

      // Test scrolling performance
      cy.scrollGanttChart('right', 500)
      cy.scrollGanttChart('down', 300)
      cy.scrollGanttChart('left', 500)

      // Test zoom performance
      cy.zoomGanttChart('in')
      cy.zoomGanttChart('out')
      cy.zoomGanttChart('reset')
    })

    it('should provide responsive UI feedback during operations', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      // Mock slow API response
      cy.intercept('POST', `**/dependencies`, (req) => {
        req.reply((res) => {
          res.delay(2000) // 2 second delay
          res.send({ fixture: 'dependency-success' })
        })
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Start operation and verify loading feedback
      cy.openDependencyContextMenu(TEST_PARENT_ISSUE_ID)
      cy.get('[data-testid="create-dependency-btn"]').click()
      cy.get(`[data-testid="task-bar-${TEST_CHILD_ISSUE_ID}"]`).click()

      cy.verifyLoadingFeedback('dependency-creation-loading')
    })

    it('should handle network errors gracefully', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      cy.simulateNetworkErrorAndRecover()
    })
  })

  describe('6. アクセシビリティ・キーボード操作テスト', () => {

    it('should support keyboard navigation', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      cy.verifyGanttKeyboardNavigation()
    })

    it('should provide proper ARIA labels and screen reader support', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, data.dependencies)
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      cy.verifyGanttAccessibilityLabels()
      cy.verifyScreenReaderAnnouncements()
    })

    it('should support dependency creation with keyboard shortcuts', () => {
      cy.fixture('gantt-test-data').then((data) => {
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, data.tasks)
        cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
        cy.mockApiResponse('POST', `**/dependencies`, { fixture: 'dependency-success' })
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Enter dependency creation mode via keyboard
      cy.get(`[data-testid="task-bar-${TEST_PARENT_ISSUE_ID}"]`).focus()
      cy.focused().type('{ctrl}{d}') // Ctrl+D to start dependency creation

      // ESC should cancel
      cy.get('body').type('{esc}')
      cy.get('[data-testid="dependency-creation-mode"]').should('not.exist')
    })
  })

  describe('7. エラーハンドリング・エッジケース', () => {

    it('should handle invalid dependency types gracefully', () => {
      const invalidData = {
        tasks: [
          {
            id: 'invalid-task-1',
            project_id: TEST_PROJECT_ID,
            title: 'Invalid Task 1',
            status: 'open',
            progress_pct: 0,
            start_date: '2024-01-01',
            end_date: '2023-12-31' // End before start
          }
        ],
        dependencies: []
      }

      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, invalidData.tasks)
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, invalidData.dependencies)

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should show validation warning
      cy.get('[data-testid="validation-warnings"]').should('be.visible')
      cy.get('[data-testid="validation-warnings"]').should('contain', '日付の不整合')
    })

    it('should handle missing task data gracefully', () => {
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, [])
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])

      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should show empty state
      cy.get('[data-testid="gantt-empty-state"]').should('be.visible')
      cy.get('[data-testid="gantt-empty-state"]').should('contain', '表示するタスクがありません')
    })

    it('should handle API timeouts appropriately', () => {
      // Mock timeout scenario
      cy.intercept('GET', `**/projects/${TEST_PROJECT_ID}/issues`, (req) => {
        req.reply((res) => {
          res.delay(30000) // 30 second delay to trigger timeout
        })
      })

      cy.navigateToGanttChart(TEST_PROJECT_ID)

      // Should show timeout error and retry option
      cy.get('[data-testid="api-timeout-error"]', { timeout: 35000 }).should('be.visible')
      cy.get('[data-testid="retry-load-gantt"]').should('be.visible')
    })
  })
})