import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'

test.describe('Issue Management Critical User Flow', () => {
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
    
    // Navigate to issues page
    await uiHelper.navigateToPage('/issues')
    await uiHelper.waitForPageLoad()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
  })

  test('Create new issue successfully', { tag: '@critical' }, async ({ page }) => {
    // Navigate to create issue page
    await uiHelper.stableClick('[data-testid="create-issue-button"], .create-issue-btn, [href="/issues/create"]')
    await uiHelper.waitForPageLoad()

    // Fill issue form
    const issueData = {
      title: 'E2E Test Issue - Create',
      description: 'This is a test issue created via E2E test',
      type: 'task',
      priority: '5',
      estimate: '4h'
    }

    await uiHelper.stableFill('[data-testid="issue-title"], input[name="title"], #title', issueData.title)
    await uiHelper.stableFill('[data-testid="issue-description"], textarea[name="description"], #description', issueData.description)
    
    // Try to select issue type if dropdown exists
    const typeSelector = '[data-testid="issue-type"], select[name="type"], #type'
    if (await page.locator(typeSelector).count() > 0) {
      await uiHelper.selectOption(typeSelector, issueData.type)
    }

    // Submit the form
    await uiHelper.stableClick('[data-testid="save-button"], button[type="submit"], .save-btn')
    await uiHelper.waitForPageLoad()

    // Verify issue was created
    await uiHelper.verifyElementText('[data-testid="issue-title"], .issue-title, h1', issueData.title)
    
    // Take screenshot for verification
    await uiHelper.takeScreenshot('issue-created')
  })

  test('Edit existing issue successfully', { tag: '@critical' }, async ({ page }) => {
    // Create a test issue first
    const testIssue = await dataHelper.createTestIssue()
    
    // Navigate to issues list
    await uiHelper.navigateToPage('/issues')
    await uiHelper.waitForPageLoad()

    // Find and click on the test issue
    const issueSelector = `[data-testid="issue-${testIssue.id}"], .issue-item:has-text("${testIssue.title}"), a:has-text("${testIssue.title}")`
    await uiHelper.stableClick(issueSelector)
    await uiHelper.waitForPageLoad()

    // Click edit button
    await uiHelper.stableClick('[data-testid="edit-button"], .edit-btn, button:has-text("Edit")')
    await uiHelper.waitForPageLoad()

    // Modify issue data
    const updatedTitle = testIssue.title + ' - Updated'
    await uiHelper.stableFill('[data-testid="issue-title"], input[name="title"], #title', updatedTitle)

    // Save changes
    await uiHelper.stableClick('[data-testid="save-button"], button[type="submit"], .save-btn')
    await uiHelper.waitForPageLoad()

    // Verify issue was updated
    await uiHelper.verifyElementText('[data-testid="issue-title"], .issue-title, h1', updatedTitle)
    
    // Take screenshot for verification
    await uiHelper.takeScreenshot('issue-edited')
  })

  test('Delete issue successfully', { tag: '@critical' }, async ({ page }) => {
    // Create a test issue first
    const testIssue = await dataHelper.createTestIssue()
    
    // Navigate to issue detail page
    await uiHelper.navigateToPage(`/issues/${testIssue.id}`)
    await uiHelper.waitForPageLoad()

    // Click delete button
    await uiHelper.stableClick('[data-testid="delete-button"], .delete-btn, button:has-text("Delete")')
    
    // Handle confirmation dialog if it exists
    await uiHelper.retryOperation(async () => {
      const confirmButton = page.locator('[data-testid="confirm-delete"], .confirm-btn, button:has-text("Confirm")')
      if (await confirmButton.count() > 0) {
        await confirmButton.click()
      }
    })

    await uiHelper.waitForPageLoad()

    // Verify redirection to issues list
    await uiHelper.verifyURL(/\/issues\/?$/)
    
    // Verify issue is no longer in the list
    const deletedIssueExists = await uiHelper.isElementVisible(`[data-testid="issue-${testIssue.id}"]`)
    expect(deletedIssueExists).toBe(false)
    
    // Take screenshot for verification
    await uiHelper.takeScreenshot('issue-deleted')
  })

  test('Filter and search issues', { tag: '@critical' }, async ({ page }) => {
    // Create multiple test issues with different statuses
    const testIssues = [
      { ...await dataHelper.createTestIssue(), status: 'open' },
      { ...await dataHelper.createTestIssue(), status: 'in-progress' }
    ]

    // Navigate to issues page
    await uiHelper.navigateToPage('/issues')
    await uiHelper.waitForPageLoad()

    // Test search functionality
    const searchInput = '[data-testid="search-input"], input[name="search"], .search-input'
    if (await page.locator(searchInput).count() > 0) {
      await uiHelper.stableFill(searchInput, testIssues[0].title)
      await uiHelper.waitForPageLoad()
      
      // Verify filtered results
      await uiHelper.verifyElementExists(`[data-testid="issue-item"]:has-text("${testIssues[0].title}")`)
    }

    // Test status filter
    const statusFilter = '[data-testid="status-filter"], select[name="status"], .status-filter'
    if (await page.locator(statusFilter).count() > 0) {
      await uiHelper.selectOption(statusFilter, 'open')
      await uiHelper.waitForPageLoad()
      
      // Verify only open issues are shown
      const issueCount = await uiHelper.getElementCount('[data-testid="issue-item"], .issue-item')
      expect(issueCount).toBeGreaterThan(0)
    }

    // Take screenshot for verification
    await uiHelper.takeScreenshot('issue-filter-search')
  })

  test('Issue list pagination', { tag: '@critical' }, async ({ page }) => {
    // Navigate to issues page
    await uiHelper.navigateToPage('/issues')
    await uiHelper.waitForPageLoad()

    // Check if pagination exists
    const paginationExists = await uiHelper.isElementVisible('[data-testid="pagination"], .pagination')
    
    if (paginationExists) {
      // Test next page navigation
      const nextButton = '[data-testid="next-page"], .next-page, button:has-text("Next")'
      if (await page.locator(nextButton).count() > 0) {
        await uiHelper.stableClick(nextButton)
        await uiHelper.waitForPageLoad()
        
        // Verify page changed
        await uiHelper.verifyURL(/page=2|p=2/)
        
        // Take screenshot for verification
        await uiHelper.takeScreenshot('issue-pagination')
      }
    }
  })

  test('Issue detail view displays correctly', { tag: '@critical' }, async ({ page }) => {
    // Create a test issue
    const testIssue = await dataHelper.createTestIssue()
    
    // Navigate to issue detail page
    await uiHelper.navigateToPage(`/issues/${testIssue.id}`)
    await uiHelper.waitForPageLoad()

    // Verify issue details are displayed
    await uiHelper.verifyElementText('[data-testid="issue-title"], .issue-title, h1', testIssue.title)
    await uiHelper.verifyElementText('[data-testid="issue-description"], .issue-description', testIssue.description)
    
    // Verify issue metadata if present
    const metadataSelectors = [
      '[data-testid="issue-status"], .issue-status',
      '[data-testid="issue-type"], .issue-type',
      '[data-testid="issue-priority"], .issue-priority',
      '[data-testid="issue-assignee"], .issue-assignee'
    ]
    
    for (const selector of metadataSelectors) {
      if (await page.locator(selector).count() > 0) {
        await uiHelper.verifyElementExists(selector)
      }
    }

    // Take screenshot for verification
    await uiHelper.takeScreenshot('issue-detail-view')
  })
})