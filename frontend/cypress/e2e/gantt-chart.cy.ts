/// <reference types="cypress" />

/**
 * Gantt Chart Display and WBS Integration E2E Tests
 * 
 * ガントチャート表示・WBS連動表示のテスト
 * 新しいテストケースを既存のgantt-functionality.cy.tsに追加せず、
 * 機能別に分離したテストファイル
 */

describe('Gantt Chart Display and WBS Integration Tests', () => {
  const TEST_PROJECT_ID = 'gantt-display-project-123'
  const TEST_TASKS = [
    {
      id: 'task-1',
      project_id: TEST_PROJECT_ID,
      title: 'Parent Task',
      description_md: 'Parent task for WBS hierarchy',
      status: 'in_progress',
      assignee: 'lead@example.com',
      progress_pct: 75,
      is_blocked: false,
      labels: ['parent'],
      sort_order: 100,
      version: 1,
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      wbs_number: '1',
      parent_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      children: []
    },
    {
      id: 'task-2',
      project_id: TEST_PROJECT_ID,
      title: 'Child Task',
      description_md: 'Child task under parent',
      status: 'open',
      assignee: 'dev@example.com',
      progress_pct: 40,
      is_blocked: false,
      labels: ['child'],
      sort_order: 200,
      version: 1,
      start_date: '2024-01-05',
      end_date: '2024-01-20',
      wbs_number: '1.1',
      parent_id: 'task-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      children: []
    },
    {
      id: 'milestone-1',
      project_id: TEST_PROJECT_ID,
      title: 'Project Milestone',
      description_md: 'Important milestone',
      status: 'open',
      assignee: null,
      progress_pct: 0,
      is_blocked: false,
      labels: ['milestone'],
      sort_order: 300,
      version: 1,
      start_date: '2024-02-01',
      end_date: '2024-02-01',
      wbs_number: '2',
      parent_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      children: []
    }
  ]

  beforeEach(() => {
    cy.cleanupTestData()
    cy.setUserRole('editor')
    
    // Mock project data
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}`, {
      id: TEST_PROJECT_ID,
      name: 'Gantt Display Test Project',
      description: 'Test project for gantt display functionality',
      role: 'editor'
    })
    
    // Mock issues data
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, TEST_TASKS)
    cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/dependencies`, [])
  })

  describe('Basic Gantt Chart Display', () => {
    it('should display gantt chart with proper layout structure', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify layout structure
      cy.get('[data-testid="gantt-chart"]').should('be.visible')
      cy.get('[data-testid="gantt-container"]').should('be.visible')
      
      // Verify timeline header
      cy.get('[data-testid="gantt-timeline-header"]').should('be.visible')
      
      // Verify task rows
      cy.get('[data-testid="gantt-task-rows"]').should('be.visible')
      
      // Verify all tasks are displayed
      cy.verifyGanttChartState(3, 0)
    })

    it('should display task bars with correct visual properties', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Regular task bar
      cy.get('[data-testid="task-bar-task-1"]')
        .should('be.visible')
        .should('have.attr', 'data-task-type', 'task')
      
      // Child task bar with hierarchy indication
      cy.get('[data-testid="task-bar-task-2"]')
        .should('be.visible')
        .should('have.attr', 'data-parent-id', 'task-1')
      
      // Milestone marker (diamond shape)
      cy.get('[data-testid="milestone-marker-milestone-1"]')
        .should('be.visible')
        .should('have.attr', 'data-task-type', 'milestone')
    })

    it('should show progress bars with correct percentages', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify progress bars
      cy.verifyProgressBar('task-1', 75)
      cy.verifyProgressBar('task-2', 40)
      
      // Milestones should not have progress bars
      cy.get('[data-testid="progress-bar-milestone-1"]').should('not.exist')
    })

    it('should display task labels and status indicators', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Task labels
      cy.get('[data-testid="task-label-task-1"]')
        .should('contain', 'Parent Task')
        .should('contain', 'lead@example.com')
      
      // Status indicators
      cy.get('[data-testid="status-indicator-task-1"]')
        .should('have.class', 'status-in_progress')
      
      cy.get('[data-testid="status-indicator-task-2"]')
        .should('have.class', 'status-open')
    })
  })

  describe('WBS Tree and Gantt Synchronization', () => {
    it('should synchronize selection between WBS tree and gantt chart', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Select task in WBS tree
      cy.get('[data-testid="wbs-node-task-1"]').click()
      
      // Verify gantt chart selection
      cy.get('[data-testid="task-bar-task-1"]')
        .should('have.class', 'selected')
      
      // Select task in gantt chart
      cy.selectTaskBar('task-2')
      
      // Verify WBS tree selection
      cy.get('[data-testid="wbs-node-task-2"]')
        .should('have.class', 'selected')
    })

    it('should maintain hierarchy visualization in both views', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // WBS tree hierarchy
      cy.get('[data-testid="wbs-node-task-1"]')
        .should('have.attr', 'data-level', '0')
      
      cy.get('[data-testid="wbs-node-task-2"]')
        .should('have.attr', 'data-level', '1')
        .should('have.attr', 'data-parent-id', 'task-1')
      
      // Gantt chart hierarchy indicators
      cy.get('[data-testid="task-bar-task-2"]')
        .should('have.class', 'child-task')
        .should('have.attr', 'data-indent-level', '1')
    })

    it('should expand/collapse hierarchy in both views', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Collapse parent in WBS tree
      cy.get('[data-testid="wbs-expand-toggle-task-1"]').click()
      
      // Verify child is hidden in both views
      cy.get('[data-testid="wbs-node-task-2"]').should('not.be.visible')
      cy.get('[data-testid="task-bar-task-2"]').should('not.be.visible')
      
      // Expand again
      cy.get('[data-testid="wbs-expand-toggle-task-1"]').click()
      
      // Verify child is visible again
      cy.get('[data-testid="wbs-node-task-2"]').should('be.visible')
      cy.get('[data-testid="task-bar-task-2"]').should('be.visible')
    })
  })

  describe('Timeline and Date Display', () => {
    it('should display timeline with proper date ranges', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Timeline should cover task date ranges
      cy.get('[data-testid="timeline-header"]').should('be.visible')
      
      // Check date range covers all tasks (Jan 1 - Feb 1)
      cy.get('[data-testid="timeline-date-2024-01-01"]').should('be.visible')
      cy.get('[data-testid="timeline-date-2024-02-01"]').should('be.visible')
    })

    it('should position task bars correctly on timeline', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Verify task positions
      cy.verifyTaskBarPosition('task-1', '2024-01-01', '2024-01-31')
      cy.verifyTaskBarPosition('task-2', '2024-01-05', '2024-01-20')
      cy.verifyTaskBarPosition('milestone-1', '2024-02-01', '2024-02-01')
    })

    it('should show weekend and holiday indicators', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Weekend columns should be highlighted differently
      cy.get('[data-testid="timeline-weekend"]').should('exist')
      
      // Holiday markers if any
      cy.get('[data-testid="timeline-holiday"]').should('exist').or('not.exist')
    })
  })

  describe('Zoom and Scroll Functionality', () => {
    it('should support timeline zoom operations', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Test zoom in
      cy.zoomGanttChart('in')
      cy.get('[data-testid="zoom-level-indicator"]').should('contain', 'Day')
      
      // Test zoom out
      cy.zoomGanttChart('out')
      cy.get('[data-testid="zoom-level-indicator"]').should('contain', 'Week')
      
      // Test zoom reset
      cy.zoomGanttChart('reset')
      cy.get('[data-testid="zoom-level-indicator"]').should('contain', 'Week')
    })

    it('should support horizontal and vertical scrolling', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Test horizontal scroll
      cy.scrollGanttChart('right', 200)
      cy.get('[data-testid="gantt-container"]').should('have.prop', 'scrollLeft').and('be.greaterThan', 0)
      
      // Test vertical scroll
      cy.scrollGanttChart('down', 100)
      cy.get('[data-testid="gantt-container"]').should('have.prop', 'scrollTop').and('be.greaterThan', 0)
      
      // Scroll back to origin
      cy.scrollGanttChart('left', 200)
      cy.scrollGanttChart('up', 100)
    })

    it('should maintain task visibility during scroll operations', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Scroll horizontally
      cy.scrollGanttChart('right', 300)
      
      // Tasks should still be visible (or appropriate ones for current view)
      cy.get('[data-testid^="task-bar-"]').should('have.length.greaterThan', 0)
      
      // WBS tree should remain fixed
      cy.get('[data-testid="wbs-tree-container"]').should('be.visible')
    })
  })

  describe('Interactive Features', () => {
    it('should highlight tasks on hover', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Hover over task bar
      cy.get('[data-testid="task-bar-task-1"]').trigger('mouseover')
      
      // Should show highlight
      cy.get('[data-testid="task-bar-task-1"]').should('have.class', 'hovered')
      
      // Should show tooltip
      cy.get('[data-testid="task-tooltip"]').should('be.visible')
      cy.get('[data-testid="task-tooltip"]').should('contain', 'Parent Task')
    })

    it('should show task details in tooltip', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Hover over task
      cy.get('[data-testid="task-bar-task-1"]').trigger('mouseover')
      
      // Verify tooltip content
      cy.get('[data-testid="task-tooltip"]').within(() => {
        cy.contains('Parent Task')
        cy.contains('75%') // progress
        cy.contains('lead@example.com') // assignee
        cy.contains('2024-01-01') // start date
        cy.contains('2024-01-31') // end date
      })
    })

    it('should handle task selection and deselection', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Select task
      cy.selectTaskBar('task-1')
      cy.get('[data-testid="task-bar-task-1"]').should('have.class', 'selected')
      
      // Select different task
      cy.selectTaskBar('task-2')
      cy.get('[data-testid="task-bar-task-1"]').should('not.have.class', 'selected')
      cy.get('[data-testid="task-bar-task-2"]').should('have.class', 'selected')
      
      // Deselect by clicking empty area
      cy.get('[data-testid="gantt-background"]').click()
      cy.get('[data-testid="task-bar-task-2"]').should('not.have.class', 'selected')
    })
  })

  describe('Milestone Display', () => {
    it('should display milestones with diamond shape', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Milestone should be diamond-shaped
      cy.get('[data-testid="milestone-marker-milestone-1"]')
        .should('be.visible')
        .should('have.class', 'milestone-diamond')
    })

    it('should position milestones correctly on timeline', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Milestone should be positioned at exact date
      cy.get('[data-testid="milestone-marker-milestone-1"]')
        .should('have.attr', 'data-date', '2024-02-01')
    })

    it('should handle milestone selection and interaction', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Select milestone
      cy.selectMilestone('milestone-1')
      cy.get('[data-testid="milestone-marker-milestone-1"]').should('have.class', 'selected')
      
      // Show milestone tooltip
      cy.get('[data-testid="milestone-marker-milestone-1"]').trigger('mouseover')
      cy.get('[data-testid="milestone-tooltip"]').should('be.visible')
      cy.get('[data-testid="milestone-tooltip"]').should('contain', 'Project Milestone')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty task list gracefully', () => {
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, [])
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should show empty state
      cy.get('[data-testid="gantt-empty-state"]').should('be.visible')
      cy.get('[data-testid="gantt-empty-state"]').should('contain', 'タスクがありません')
    })

    it('should handle tasks with invalid dates', () => {
      const invalidTasks = [
        {
          ...TEST_TASKS[0],
          start_date: '2024-01-31',
          end_date: '2024-01-01' // End before start
        }
      ]
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, invalidTasks)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Should show validation warning
      cy.get('[data-testid="validation-warnings"]').should('be.visible')
      cy.get('[data-testid="validation-warnings"]').should('contain', '日付が無効')
    })

    it('should handle API loading states', () => {
      // Mock slow API response
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
      
      // Wait for load completion
      cy.waitForGanttChartLoad()
      cy.get('[data-testid="gantt-loading"]').should('not.exist')
    })
  })

  describe('Responsive Layout', () => {
    it('should adjust layout for different screen sizes', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Test mobile viewport
      cy.viewport(768, 1024)
      cy.get('[data-testid="gantt-layout"]').should('have.class', 'mobile-layout')
      
      // Test desktop viewport
      cy.viewport(1280, 720)
      cy.get('[data-testid="gantt-layout"]').should('have.class', 'desktop-layout')
    })

    it('should handle panel resizing', () => {
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Get initial split position
      cy.get('[data-testid="wbs-panel"]').invoke('width').then((initialWidth) => {
        // Drag resize handle
        cy.get('[data-testid="resize-handle"]')
          .trigger('mousedown', { button: 0 })
          .trigger('mousemove', { clientX: 400 })
          .trigger('mouseup')
        
        // Verify panel size changed
        cy.get('[data-testid="wbs-panel"]').invoke('width').should('not.equal', initialWidth)
      })
    })
  })

  describe('Performance and Rendering', () => {
    it('should render efficiently with multiple tasks', () => {
      // Create large dataset
      const largeTasks = Array.from({ length: 50 }, (_, i) => ({
        ...TEST_TASKS[0],
        id: `task-${i}`,
        title: `Task ${i + 1}`,
        start_date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
        end_date: new Date(2024, 0, i + 7).toISOString().split('T')[0]
      }))
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, largeTasks)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.measureGanttRenderingPerformance(50, 0)
      cy.waitForGanttChartLoad()

      // Should render all tasks
      cy.verifyGanttChartState(50, 0)
    })

    it('should maintain smooth scrolling with large datasets', () => {
      // Create large dataset
      const largeTasks = Array.from({ length: 100 }, (_, i) => ({
        ...TEST_TASKS[0],
        id: `task-${i}`,
        title: `Task ${i + 1}`,
        start_date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
        end_date: new Date(2024, 0, i + 7).toISOString().split('T')[0]
      }))
      
      cy.mockApiResponse('GET', `**/projects/${TEST_PROJECT_ID}/issues`, largeTasks)
      
      cy.navigateToGanttChart(TEST_PROJECT_ID)
      cy.waitForGanttChartLoad()

      // Test scrolling performance
      cy.measureOperationResponseTime(() => {
        cy.scrollGanttChart('down', 500)
      })
    })
  })
})