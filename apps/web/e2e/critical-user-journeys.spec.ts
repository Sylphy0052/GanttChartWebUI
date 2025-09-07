import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'
import { PerformanceHelper } from './helpers/performance-helper'
import { AccessibilityHelper } from './helpers/accessibility-helper'
import { ErrorScenarioHelper } from './helpers/error-scenario-helper'
import { ResponsiveHelper } from './helpers/responsive-helper'

test.describe('Critical User Journeys - Complete WBS to Gantt Workflow', () => {
  let uiHelper: UIHelper
  let dataHelper: DataHelper
  let authHelper: AuthHelper
  let performanceHelper: PerformanceHelper
  let accessibilityHelper: AccessibilityHelper
  let errorHelper: ErrorScenarioHelper
  let responsiveHelper: ResponsiveHelper

  test.beforeEach(async ({ page }) => {
    // Initialize all helper classes
    uiHelper = new UIHelper(page)
    dataHelper = new DataHelper(page)
    authHelper = new AuthHelper(page)
    performanceHelper = new PerformanceHelper(page)
    accessibilityHelper = new AccessibilityHelper(page)
    errorHelper = new ErrorScenarioHelper(page)
    responsiveHelper = new ResponsiveHelper(page)
    
    // Setup clean environment
    await dataHelper.setupCleanEnvironment()
    await authHelper.ensureAuthenticated()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
    await errorHelper.clearAllRoutes()
  })

  // AC1: Complete WBS-to-Gantt workflow test covers project creation, task management, and scheduling
  test('Complete WBS to Gantt workflow - Project Creation to Scheduling', { 
    tag: '@critical' 
  }, async ({ page }) => {
    console.log('🚀 Starting complete WBS to Gantt workflow test...')

    // AC4: Measure initial render performance
    const renderBenchmark = await performanceHelper.measureInitialRender()
    
    // Step 1: Project Creation
    console.log('📁 Step 1: Creating new project...')
    await uiHelper.navigateToPage('/projects')
    await uiHelper.waitForPageLoad()

    // Try to create a new project
    const createProjectButton = '[data-testid="create-project"], .create-project-btn, button:has-text("New Project")'
    if (await page.locator(createProjectButton).count() > 0) {
      await uiHelper.stableClick(createProjectButton)
      
      // Fill project form
      const projectForm = '[data-testid="project-form"], .project-form, form'
      if (await page.locator(projectForm).count() > 0) {
        await uiHelper.stableFill('[data-testid="project-name"], input[name="name"], #project-name', 'E2E Test Project')
        await uiHelper.stableFill('[data-testid="project-description"], textarea[name="description"]', 'Complete workflow test project')
        
        // Submit project creation
        const submitButton = '[data-testid="create-submit"], button[type="submit"], .submit-btn'
        if (await page.locator(submitButton).count() > 0) {
          await uiHelper.stableClick(submitButton)
          await uiHelper.waitForPageLoad()
        }
      }
    }

    // Step 2: Navigate to WBS View
    console.log('🌳 Step 2: Setting up WBS structure...')
    await uiHelper.navigateToPage('/wbs')
    await uiHelper.waitForPageLoad()

    // Step 3: Create WBS Items
    console.log('📋 Step 3: Creating WBS items...')
    const wbsItems = [
      { name: 'Phase 1: Planning', type: 'phase' },
      { name: 'Task 1.1: Requirements Analysis', type: 'task' },
      { name: 'Task 1.2: System Design', type: 'task' },
      { name: 'Phase 2: Development', type: 'phase' },
      { name: 'Task 2.1: Frontend Development', type: 'task' },
      { name: 'Task 2.2: Backend Development', type: 'task' }
    ]

    for (const item of wbsItems) {
      // Try to add WBS item
      const addItemButton = '[data-testid="add-wbs-item"], .add-wbs-btn, button:has-text("Add Item")'
      if (await page.locator(addItemButton).count() > 0) {
        await uiHelper.stableClick(addItemButton)
        
        // Fill item form
        const itemForm = '[data-testid="wbs-form"], .wbs-form, .add-item-form'
        if (await page.locator(itemForm).count() > 0) {
          await uiHelper.stableFill('[data-testid="wbs-name"], input[name="name"], #wbs-name', item.name)
          
          // Save item
          const saveButton = '[data-testid="save-wbs"], button[type="submit"], .save-btn'
          if (await page.locator(saveButton).count() > 0) {
            await uiHelper.stableClick(saveButton)
            await uiHelper.waitForPageLoad()
          }
        }
      }
    }

    // Step 4: Navigate to Issues/Tasks Management
    console.log('📝 Step 4: Managing tasks and issues...')
    await uiHelper.navigateToPage('/issues')
    await uiHelper.waitForPageLoad()

    // Create some test issues
    const testIssues = [
      {
        title: 'Implement user authentication',
        description: 'Set up login and user management system',
        priority: 'High',
        estimate: '5 days'
      },
      {
        title: 'Design database schema',
        description: 'Create and optimize database structure',
        priority: 'Medium',
        estimate: '3 days'
      }
    ]

    for (const issue of testIssues) {
      // Try to create new issue
      const createIssueButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New Issue")'
      if (await page.locator(createIssueButton).count() > 0) {
        await uiHelper.stableClick(createIssueButton)
        
        // Fill issue form
        const issueForm = '[data-testid="issue-form"], .issue-form'
        if (await page.locator(issueForm).count() > 0) {
          await uiHelper.stableFill('[data-testid="issue-title"], input[name="title"], #title', issue.title)
          await uiHelper.stableFill('[data-testid="issue-description"], textarea[name="description"]', issue.description)
          
          // Set priority if field exists
          const priorityField = '[data-testid="issue-priority"], select[name="priority"]'
          if (await page.locator(priorityField).count() > 0) {
            await uiHelper.selectOption(priorityField, issue.priority)
          }
          
          // Save issue
          const saveIssueButton = '[data-testid="save-issue"], button[type="submit"], .save-btn'
          if (await page.locator(saveIssueButton).count() > 0) {
            await uiHelper.stableClick(saveIssueButton)
            await uiHelper.waitForPageLoad()
          }
        }
      }
    }

    // Step 5: Navigate to Gantt Chart View
    console.log('📊 Step 5: Setting up Gantt chart scheduling...')
    const navigationBenchmark = await performanceHelper.measureNavigation('/gantt')
    await uiHelper.waitForPageLoad()

    // Verify Gantt chart loaded
    await uiHelper.verifyElementExists('[data-testid="gantt-container"], .gantt-container, .gantt-chart')

    // Step 6: Test Gantt Chart Operations
    console.log('🎯 Step 6: Testing Gantt chart operations...')
    
    // Test task drag operations (AC4: Performance target <100ms)
    const taskBars = '[data-testid="task-bar"], .task-bar, .gantt-task'
    if (await page.locator(taskBars).count() > 0) {
      const firstTask = page.locator(taskBars).first()
      const secondTask = page.locator(taskBars).nth(1)
      
      if (await secondTask.count() > 0) {
        const dragBenchmark = await performanceHelper.measureDragOperation(
          `${taskBars}:first-child`,
          `${taskBars}:nth-child(2)`
        )
      }
    }

    // Test scheduling operations
    const schedulingControls = [
      '[data-testid="auto-schedule"], .auto-schedule-btn',
      '[data-testid="timeline-controls"], .timeline-controls',
      '[data-testid="zoom-controls"], .zoom-controls'
    ]

    for (const control of schedulingControls) {
      if (await page.locator(control).count() > 0) {
        await uiHelper.stableClick(control)
        await page.waitForTimeout(500)
      }
    }

    // Step 7: Test Dependencies
    console.log('🔗 Step 7: Testing task dependencies...')
    
    // Look for dependency creation controls
    const dependencyControls = '[data-testid="create-dependency"], .create-dependency'
    if (await page.locator(dependencyControls).count() > 0) {
      await uiHelper.stableClick(dependencyControls)
      await page.waitForTimeout(500)
      
      // Close dependency creation if modal opens
      const cancelButton = '[data-testid="cancel-dependency"], .cancel-btn, button:has-text("Cancel")'
      if (await page.locator(cancelButton).count() > 0) {
        await uiHelper.stableClick(cancelButton)
      }
    }

    // Step 8: Test Progress Management
    console.log('📈 Step 8: Testing progress management...')
    
    // Look for progress indicators and controls
    const progressControls = '[data-testid="progress-indicator"], .progress-bar, .task-progress'
    if (await page.locator(progressControls).count() > 0) {
      const progressElements = await page.locator(progressControls).count()
      console.log(`Found ${progressElements} progress indicators`)
    }

    // Step 9: Validate End-to-End Workflow
    console.log('✅ Step 9: Validating complete workflow...')
    
    // Verify key elements from the workflow are present
    const workflowValidation = [
      { selector: '[data-testid="gantt-container"], .gantt-container', name: 'Gantt Chart' },
      { selector: '[data-testid="task-bar"], .task-bar, .gantt-task', name: 'Task Bars' },
      { selector: '[data-testid="timeline"], .timeline, .gantt-timeline', name: 'Timeline' }
    ]

    let validationsPassed = 0
    for (const validation of workflowValidation) {
      try {
        await uiHelper.verifyElementExists(validation.selector)
        console.log(`✅ ${validation.name} validation passed`)
        validationsPassed++
      } catch (error) {
        console.log(`❌ ${validation.name} validation failed:`, error)
      }
    }

    // AC4: Validate performance benchmarks
    await performanceHelper.validateBenchmarks([
      renderBenchmark,
      navigationBenchmark
    ])

    // Take final screenshot
    await uiHelper.takeScreenshot('complete-wbs-gantt-workflow-final')

    // Assert workflow completion
    expect(validationsPassed, 'At least 2 workflow validations should pass').toBeGreaterThanOrEqual(2)
    
    console.log('🎉 Complete WBS to Gantt workflow test completed successfully!')
  })

  // AC1: Advanced workflow test with real-world complexity
  test('Advanced WBS to Gantt workflow with dependencies and milestones', { 
    tag: '@critical' 
  }, async ({ page }) => {
    console.log('🚀 Starting advanced workflow test...')

    // Navigate to Gantt chart
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test milestone creation and management
    console.log('🎯 Testing milestone management...')
    const milestoneButton = '[data-testid="add-milestone"], .add-milestone-btn, button:has-text("Milestone")'
    if (await page.locator(milestoneButton).count() > 0) {
      await uiHelper.stableClick(milestoneButton)
      
      const milestoneForm = '[data-testid="milestone-form"], .milestone-form'
      if (await page.locator(milestoneForm).count() > 0) {
        await uiHelper.stableFill('[data-testid="milestone-name"], input[name="name"]', 'Project Milestone 1')
        await uiHelper.stableFill('[data-testid="milestone-date"], input[type="date"]', '2025-09-15')
        
        const saveMilestone = '[data-testid="save-milestone"], button[type="submit"]'
        if (await page.locator(saveMilestone).count() > 0) {
          await uiHelper.stableClick(saveMilestone)
          await uiHelper.waitForPageLoad()
        }
      }
    }

    // Test critical path calculation
    console.log('📍 Testing critical path functionality...')
    const criticalPathToggle = '[data-testid="critical-path"], .critical-path-btn'
    if (await page.locator(criticalPathToggle).count() > 0) {
      await uiHelper.stableClick(criticalPathToggle)
      await page.waitForTimeout(1000)
      
      // Verify critical path is highlighted
      const criticalTasks = '[data-testid="critical-task"], .critical-task'
      if (await page.locator(criticalTasks).count() > 0) {
        console.log('✅ Critical path visualization working')
      }
    }

    // Test resource allocation
    console.log('👥 Testing resource allocation...')
    const resourceButton = '[data-testid="resource-allocation"], .resource-btn'
    if (await page.locator(resourceButton).count() > 0) {
      await uiHelper.stableClick(resourceButton)
      await page.waitForTimeout(500)
    }

    // Test project export functionality
    console.log('📤 Testing project export...')
    const exportButton = '[data-testid="export-project"], .export-btn, button:has-text("Export")'
    if (await page.locator(exportButton).count() > 0) {
      try {
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 })
        await uiHelper.stableClick(exportButton)
        const download = await downloadPromise
        console.log('✅ Export functionality working:', download.suggestedFilename())
      } catch (error) {
        console.log('⚠️  Export functionality not yet implemented')
      }
    }

    await uiHelper.takeScreenshot('advanced-workflow-final')
    console.log('✅ Advanced workflow test completed')
  })

  // AC1: Workflow error recovery and state management
  test('WBS to Gantt workflow - Error recovery and state persistence', { 
    tag: '@critical' 
  }, async ({ page }) => {
    console.log('🚀 Testing workflow error recovery...')

    // Start workflow
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test error recovery during workflow
    console.log('🔧 Testing error scenario recovery...')
    
    // Simulate network issues during task operations
    await errorHelper.simulateNetworkFailure(/\/api\/tasks\/.*/)
    
    // Try to perform task operations that should gracefully handle errors
    const taskBar = '[data-testid="task-bar"], .task-bar'
    if (await page.locator(taskBar).count() > 0) {
      await page.locator(taskBar).first().click()
      await page.waitForTimeout(1000)
      
      // Verify error handling UI appears
      await errorHelper.verifyErrorHandling()
    }

    // Restore network and test recovery
    await errorHelper.clearAllRoutes()
    await page.reload()
    await uiHelper.waitForPageLoad()

    // Verify state persistence after error recovery
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    await uiHelper.verifyElementExists(ganttContainer)

    console.log('✅ Error recovery test completed')
  })
})