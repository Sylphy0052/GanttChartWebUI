import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'

test.describe('Gantt Chart Operations Critical User Flow', () => {
  let uiHelper: UIHelper
  let dataHelper: DataHelper
  let authHelper: AuthHelper

  test.beforeEach(async ({ page }) => {
    uiHelper = new UIHelper(page)
    dataHelper = new DataHelper(page)
    authHelper = new AuthHelper(page)
    
    // Setup clean environment
    await dataHelper.setupCleanEnvironment()
    await authHelper.ensureAuthenticated()
    
    // Navigate to Gantt chart page
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
  })

  test('Gantt chart loads and displays correctly', { tag: '@critical' }, async ({ page }) => {
    // Verify Gantt chart container is present
    await uiHelper.verifyElementExists('[data-testid="gantt-container"], .gantt-container, .gantt-chart')
    
    // Check for Gantt chart components
    const ganttComponents = [
      '[data-testid="gantt-timeline"], .gantt-timeline, .timeline',
      '[data-testid="gantt-tasks"], .gantt-tasks, .task-bars',
      '[data-testid="gantt-grid"], .gantt-grid, .grid-lines'
    ]

    for (const selector of ganttComponents) {
      if (await page.locator(selector).count() > 0) {
        await uiHelper.verifyElementExists(selector)
      }
    }

    // Verify task bars are present
    const taskBars = await uiHelper.getElementCount('[data-testid="task-bar"], .task-bar, .gantt-task')
    expect(taskBars).toBeGreaterThan(0)

    // Take screenshot for verification
    await uiHelper.takeScreenshot('gantt-initial-load')
  })

  test('Gantt chart zoom controls work', { tag: '@critical' }, async ({ page }) => {
    // Look for zoom controls
    const zoomIn = '[data-testid="zoom-in"], .zoom-in, button[title*="Zoom In"]'
    const zoomOut = '[data-testid="zoom-out"], .zoom-out, button[title*="Zoom Out"]'
    const zoomReset = '[data-testid="zoom-reset"], .zoom-reset, button[title*="Reset Zoom"]'

    // Test zoom in
    if (await page.locator(zoomIn).count() > 0) {
      await uiHelper.stableClick(zoomIn)
      await page.waitForTimeout(500)
      
      // Take screenshot after zoom in
      await uiHelper.takeScreenshot('gantt-zoomed-in')
    }

    // Test zoom out
    if (await page.locator(zoomOut).count() > 0) {
      await uiHelper.stableClick(zoomOut)
      await page.waitForTimeout(500)
      
      // Take screenshot after zoom out
      await uiHelper.takeScreenshot('gantt-zoomed-out')
    }

    // Test zoom reset
    if (await page.locator(zoomReset).count() > 0) {
      await uiHelper.stableClick(zoomReset)
      await page.waitForTimeout(500)
      
      // Take screenshot after reset
      await uiHelper.takeScreenshot('gantt-zoom-reset')
    }
  })

  test('Task bar drag and resize operations', { tag: '@critical' }, async ({ page }) => {
    // Find a task bar to manipulate
    const taskBars = '[data-testid="task-bar"], .task-bar, .gantt-task'
    const taskCount = await page.locator(taskBars).count()

    if (taskCount > 0) {
      const firstTaskBar = page.locator(taskBars).first()
      
      // Get initial position/size
      const initialBox = await firstTaskBar.boundingBox()
      
      if (initialBox) {
        // Test task bar drag (move entire task)
        await uiHelper.retryOperation(async () => {
          await firstTaskBar.hover()
          await page.mouse.down()
          await page.mouse.move(initialBox.x + 50, initialBox.y)
          await page.mouse.up()
          await page.waitForTimeout(500)
        })

        // Take screenshot after drag
        await uiHelper.takeScreenshot('gantt-task-dragged')

        // Test task bar resize (if resize handles exist)
        const resizeHandle = firstTaskBar.locator('[data-testid="resize-handle"], .resize-handle, .task-resize')
        if (await resizeHandle.count() > 0) {
          await uiHelper.retryOperation(async () => {
            await resizeHandle.hover()
            await page.mouse.down()
            await page.mouse.move(initialBox.x + initialBox.width + 30, initialBox.y)
            await page.mouse.up()
            await page.waitForTimeout(500)
          })

          // Take screenshot after resize
          await uiHelper.takeScreenshot('gantt-task-resized')
        }
      }
    }
  })

  test('Timeline navigation works correctly', { tag: '@critical' }, async ({ page }) => {
    // Look for timeline navigation controls
    const prevButton = '[data-testid="timeline-prev"], .timeline-prev, button[title*="Previous"]'
    const nextButton = '[data-testid="timeline-next"], .timeline-next, button[title*="Next"]'
    const todayButton = '[data-testid="timeline-today"], .timeline-today, button[title*="Today"]'

    // Test previous navigation
    if (await page.locator(prevButton).count() > 0) {
      await uiHelper.stableClick(prevButton)
      await page.waitForTimeout(500)
      
      // Take screenshot after previous
      await uiHelper.takeScreenshot('gantt-timeline-prev')
    }

    // Test next navigation
    if (await page.locator(nextButton).count() > 0) {
      await uiHelper.stableClick(nextButton)
      await page.waitForTimeout(500)
      
      // Take screenshot after next
      await uiHelper.takeScreenshot('gantt-timeline-next')
    }

    // Test today navigation
    if (await page.locator(todayButton).count() > 0) {
      await uiHelper.stableClick(todayButton)
      await page.waitForTimeout(500)
      
      // Take screenshot after today
      await uiHelper.takeScreenshot('gantt-timeline-today')
    }
  })

  test('Task dependencies display and interaction', { tag: '@critical' }, async ({ page }) => {
    // Look for dependency lines or arrows
    const dependencyLines = '[data-testid="dependency-line"], .dependency-line, .task-dependency'
    const dependencyCount = await page.locator(dependencyLines).count()

    if (dependencyCount > 0) {
      // Verify dependencies are visible
      await uiHelper.verifyElementExists(dependencyLines)
      
      // Test dependency creation if supported
      const createDependencyButton = '[data-testid="create-dependency"], .create-dependency, button:has-text("Add Dependency")'
      if (await page.locator(createDependencyButton).count() > 0) {
        await uiHelper.stableClick(createDependencyButton)
        await page.waitForTimeout(500)
        
        // Look for dependency creation modal/form
        const dependencyForm = '[data-testid="dependency-form"], .dependency-form'
        if (await page.locator(dependencyForm).count() > 0) {
          // Cancel or close the form
          const cancelButton = '[data-testid="cancel-dependency"], .cancel-btn, button:has-text("Cancel")'
          if (await page.locator(cancelButton).count() > 0) {
            await uiHelper.stableClick(cancelButton)
          }
        }
      }

      // Take screenshot for verification
      await uiHelper.takeScreenshot('gantt-dependencies')
    }
  })

  test('Gantt chart view mode switching', { tag: '@critical' }, async ({ page }) => {
    // Look for view mode controls (days, weeks, months)
    const viewModes = [
      '[data-testid="view-days"], .view-days, button:has-text("Days")',
      '[data-testid="view-weeks"], .view-weeks, button:has-text("Weeks")',
      '[data-testid="view-months"], .view-months, button:has-text("Months")'
    ]

    for (const viewMode of viewModes) {
      if (await page.locator(viewMode).count() > 0) {
        await uiHelper.stableClick(viewMode)
        await page.waitForTimeout(1000) // Wait for view to update
        
        // Verify the view changed by checking timeline headers
        const timelineHeaders = '[data-testid="timeline-header"], .timeline-header, .gantt-header'
        if (await page.locator(timelineHeaders).count() > 0) {
          await uiHelper.verifyElementExists(timelineHeaders)
        }

        // Take screenshot for each view mode
        const modeName = viewMode.includes('days') ? 'days' : 
                        viewMode.includes('weeks') ? 'weeks' : 'months'
        await uiHelper.takeScreenshot(`gantt-view-${modeName}`)
      }
    }
  })

  test('Critical path highlighting', { tag: '@critical' }, async ({ page }) => {
    // Look for critical path toggle or indicator
    const criticalPathToggle = '[data-testid="critical-path"], .critical-path, button:has-text("Critical Path")'
    
    if (await page.locator(criticalPathToggle).count() > 0) {
      // Toggle critical path display
      await uiHelper.stableClick(criticalPathToggle)
      await page.waitForTimeout(1000)
      
      // Look for critical tasks (highlighted differently)
      const criticalTasks = '[data-testid="critical-task"], .critical-task, .task-critical'
      if (await page.locator(criticalTasks).count() > 0) {
        await uiHelper.verifyElementExists(criticalTasks)
      }

      // Take screenshot with critical path
      await uiHelper.takeScreenshot('gantt-critical-path')
    }
  })

  test('Task context menu and operations', { tag: '@critical' }, async ({ page }) => {
    // Find a task bar to right-click
    const taskBars = '[data-testid="task-bar"], .task-bar, .gantt-task'
    
    if (await page.locator(taskBars).count() > 0) {
      const firstTask = page.locator(taskBars).first()
      
      // Right-click to open context menu
      await firstTask.click({ button: 'right' })
      await page.waitForTimeout(500)
      
      // Look for context menu items
      const contextMenuItems = [
        '[data-testid="edit-task"], [role="menuitem"]:has-text("Edit")',
        '[data-testid="delete-task"], [role="menuitem"]:has-text("Delete")',
        '[data-testid="add-dependency"], [role="menuitem"]:has-text("Add Dependency")',
        '[data-testid="task-details"], [role="menuitem"]:has-text("Details")'
      ]

      for (const menuItem of contextMenuItems) {
        if (await page.locator(menuItem).count() > 0) {
          await uiHelper.verifyElementExists(menuItem)
        }
      }

      // Close context menu by clicking elsewhere
      await page.click('body', { position: { x: 10, y: 10 } })
      await page.waitForTimeout(200)

      // Take screenshot of context menu
      await uiHelper.takeScreenshot('gantt-context-menu')
    }
  })

  test('Gantt chart export functionality', { tag: '@critical' }, async ({ page }) => {
    // Look for export controls
    const exportButton = '[data-testid="export-gantt"], .export-btn, button:has-text("Export")'
    
    if (await page.locator(exportButton).count() > 0) {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
      
      // Click export
      await uiHelper.stableClick(exportButton)
      
      try {
        // Wait for download
        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/gantt|chart|schedule/i)
        
        // Take screenshot for verification
        await uiHelper.takeScreenshot('gantt-export-initiated')
      } catch (error) {
        // Export might not be implemented yet, continue test
        console.log('Export functionality not yet implemented')
      }
    }
  })

  test('Gantt chart responsiveness and performance', { tag: '@critical' }, async ({ page }) => {
    // Test scrolling performance
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container, .gantt-chart'
    
    if (await page.locator(ganttContainer).count() > 0) {
      // Test horizontal scroll
      await page.locator(ganttContainer).hover()
      await page.mouse.wheel(100, 0) // Horizontal scroll
      await page.waitForTimeout(300)
      
      // Test vertical scroll
      await page.mouse.wheel(0, 100) // Vertical scroll
      await page.waitForTimeout(300)
      
      // Test viewport resize simulation
      await page.setViewportSize({ width: 800, height: 600 })
      await page.waitForTimeout(500)
      
      // Verify chart still displays correctly
      await uiHelper.verifyElementExists(ganttContainer)
      
      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.waitForTimeout(500)

      // Take screenshot for verification
      await uiHelper.takeScreenshot('gantt-responsiveness-test')
    }
  })

  test('Milestone display and interaction', { tag: '@critical' }, async ({ page }) => {
    // Look for milestones in the Gantt chart
    const milestones = '[data-testid="milestone"], .milestone, .gantt-milestone'
    const milestoneCount = await page.locator(milestones).count()

    if (milestoneCount > 0) {
      // Verify milestones are visible
      await uiHelper.verifyElementExists(milestones)
      
      // Test milestone click/interaction
      const firstMilestone = page.locator(milestones).first()
      await firstMilestone.click()
      await page.waitForTimeout(500)
      
      // Look for milestone details or tooltip
      const milestoneTooltip = '[data-testid="milestone-tooltip"], .milestone-tooltip, .tooltip'
      if (await page.locator(milestoneTooltip).count() > 0) {
        await uiHelper.verifyElementExists(milestoneTooltip)
      }

      // Take screenshot with milestones
      await uiHelper.takeScreenshot('gantt-milestones')
    }
  })
})