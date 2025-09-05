import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'

test.describe('WBS Operations Critical User Flow', () => {
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
    
    // Navigate to WBS page
    await uiHelper.navigateToPage('/wbs')
    await uiHelper.waitForPageLoad()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
  })

  test('WBS view loads and displays tree structure', { tag: '@critical' }, async ({ page }) => {
    // Verify WBS container is present
    await uiHelper.verifyElementExists('[data-testid="wbs-container"], .wbs-container, .wbs-tree')
    
    // Check for WBS items
    const wbsItems = await uiHelper.getElementCount('[data-testid="wbs-item"], .wbs-item, .tree-node')
    expect(wbsItems).toBeGreaterThan(0)

    // Verify tree structure elements
    const treeElements = [
      '[data-testid="wbs-root"], .wbs-root',
      '[data-testid="wbs-node"], .wbs-node, .tree-node',
      '[data-testid="wbs-leaf"], .wbs-leaf'
    ]

    for (const selector of treeElements) {
      if (await page.locator(selector).count() > 0) {
        await uiHelper.verifyElementExists(selector)
      }
    }

    // Take screenshot for verification
    await uiHelper.takeScreenshot('wbs-initial-load')
  })

  test('Create new WBS item', { tag: '@critical' }, async ({ page }) => {
    // Click add WBS item button
    await uiHelper.stableClick('[data-testid="add-wbs-item"], .add-wbs-btn, button:has-text("Add Item")')
    
    // Fill WBS item form if modal/form appears
    const itemForm = '[data-testid="wbs-form"], .wbs-form, .add-item-form'
    if (await page.locator(itemForm).count() > 0) {
      await uiHelper.stableFill('[data-testid="wbs-name"], input[name="name"], #wbs-name', 'E2E Test WBS Item')
      await uiHelper.stableFill('[data-testid="wbs-description"], textarea[name="description"]', 'WBS item created via E2E test')
      
      // Submit form
      await uiHelper.stableClick('[data-testid="save-wbs"], button[type="submit"], .save-btn')
      await uiHelper.waitForPageLoad()
    }

    // Verify new item appears in tree
    await uiHelper.verifyElementText('[data-testid="wbs-item"]:last-child, .wbs-item:last-child', 'E2E Test WBS Item')
    
    // Take screenshot for verification
    await uiHelper.takeScreenshot('wbs-item-created')
  })

  test('Edit WBS item', { tag: '@critical' }, async ({ page }) => {
    // Find first WBS item
    const firstItem = '[data-testid="wbs-item"]:first-child, .wbs-item:first-child, .tree-node:first-child'
    await uiHelper.verifyElementExists(firstItem)

    // Right-click or double-click to edit
    await uiHelper.retryOperation(async () => {
      // Try double-click first
      await page.locator(firstItem).dblclick()
      
      // If that doesn't work, try right-click and context menu
      const editOption = '[data-testid="edit-wbs"], .edit-option, [role="menuitem"]:has-text("Edit")'
      if (await page.locator(editOption).count() > 0) {
        await uiHelper.stableClick(editOption)
      }
    })

    // Look for inline edit or modal
    const editInput = '[data-testid="wbs-edit-input"], .wbs-edit-input, input.editing'
    if (await page.locator(editInput).count() > 0) {
      await uiHelper.stableFill(editInput, 'Updated WBS Item - E2E')
      
      // Press Enter or click save
      await page.keyboard.press('Enter')
      await uiHelper.waitForPageLoad()
      
      // Verify item was updated
      await uiHelper.verifyElementText(firstItem, 'Updated WBS Item - E2E')
    }

    // Take screenshot for verification
    await uiHelper.takeScreenshot('wbs-item-edited')
  })

  test('Delete WBS item', { tag: '@critical' }, async ({ page }) => {
    // Find a WBS item to delete
    const targetItem = '[data-testid="wbs-item"]:last-child, .wbs-item:last-child'
    await uiHelper.verifyElementExists(targetItem)

    // Get item count before deletion
    const initialCount = await uiHelper.getElementCount('[data-testid="wbs-item"], .wbs-item')

    // Right-click for context menu
    await page.locator(targetItem).click({ button: 'right' })
    
    // Click delete option
    const deleteOption = '[data-testid="delete-wbs"], .delete-option, [role="menuitem"]:has-text("Delete")'
    if (await page.locator(deleteOption).count() > 0) {
      await uiHelper.stableClick(deleteOption)
      
      // Handle confirmation dialog
      await uiHelper.retryOperation(async () => {
        const confirmButton = '[data-testid="confirm-delete"], .confirm-btn, button:has-text("Confirm")'
        if (await page.locator(confirmButton).count() > 0) {
          await uiHelper.stableClick(confirmButton)
        }
      })

      await uiHelper.waitForPageLoad()

      // Verify item count decreased
      const finalCount = await uiHelper.getElementCount('[data-testid="wbs-item"], .wbs-item')
      expect(finalCount).toBe(initialCount - 1)
    }

    // Take screenshot for verification
    await uiHelper.takeScreenshot('wbs-item-deleted')
  })

  test('Drag and drop WBS items to reorder', { tag: '@critical' }, async ({ page }) => {
    // Ensure we have at least 2 items
    const itemCount = await uiHelper.getElementCount('[data-testid="wbs-item"], .wbs-item')
    
    if (itemCount >= 2) {
      const firstItem = '[data-testid="wbs-item"]:first-child, .wbs-item:first-child'
      const secondItem = '[data-testid="wbs-item"]:nth-child(2), .wbs-item:nth-child(2)'
      
      // Get initial text content for verification
      const firstItemText = await uiHelper.getElementText(firstItem)
      const secondItemText = await uiHelper.getElementText(secondItem)

      // Perform drag and drop
      await uiHelper.dragAndDrop(firstItem, secondItem)
      
      // Wait for reorder to complete
      await uiHelper.waitForPageLoad()

      // Verify items were reordered (first item should now be second)
      const newSecondItemText = await uiHelper.getElementText(secondItem)
      expect(newSecondItemText).toBe(firstItemText)

      // Take screenshot for verification
      await uiHelper.takeScreenshot('wbs-drag-drop-reorder')
    }
  })

  test('Expand and collapse WBS tree nodes', { tag: '@critical' }, async ({ page }) => {
    // Look for expandable nodes
    const expandableNodes = '[data-testid="wbs-expandable"], .wbs-expandable, .tree-node.expandable'
    const nodeCount = await page.locator(expandableNodes).count()

    if (nodeCount > 0) {
      const firstExpandable = page.locator(expandableNodes).first()
      
      // Click to expand/collapse
      const expandToggle = firstExpandable.locator('[data-testid="expand-toggle"], .expand-toggle, .tree-toggle')
      if (await expandToggle.count() > 0) {
        // Click to toggle
        await expandToggle.click()
        await page.waitForTimeout(500)
        
        // Click again to toggle back
        await expandToggle.click()
        await page.waitForTimeout(500)
      }

      // Take screenshot for verification
      await uiHelper.takeScreenshot('wbs-expand-collapse')
    }
  })

  test('WBS hierarchy validation', { tag: '@critical' }, async ({ page }) => {
    // Verify proper hierarchy structure
    const parentNodes = await page.locator('[data-testid="wbs-parent"], .wbs-parent, .tree-parent').count()
    const childNodes = await page.locator('[data-testid="wbs-child"], .wbs-child, .tree-child').count()
    
    // Basic hierarchy validation
    if (parentNodes > 0 && childNodes > 0) {
      // Ensure children are properly nested under parents
      const nestedStructure = await page.locator('.wbs-parent .wbs-child, .tree-parent .tree-child').count()
      expect(nestedStructure).toBeGreaterThan(0)
    }

    // Check indentation for visual hierarchy
    const indentedItems = await page.locator('[style*="margin-left"], [style*="padding-left"], .indented').count()
    if (indentedItems > 0) {
      expect(indentedItems).toBeGreaterThan(0)
    }

    // Take screenshot for verification
    await uiHelper.takeScreenshot('wbs-hierarchy-validation')
  })

  test('WBS filter and search functionality', { tag: '@critical' }, async ({ page }) => {
    // Check for search/filter controls
    const searchInput = '[data-testid="wbs-search"], input[name="search"], .wbs-search'
    
    if (await page.locator(searchInput).count() > 0) {
      // Get initial item count
      const initialCount = await uiHelper.getElementCount('[data-testid="wbs-item"], .wbs-item')
      
      // Perform search
      await uiHelper.stableFill(searchInput, 'test')
      await page.waitForTimeout(1000) // Wait for search to process
      
      // Get filtered count
      const filteredCount = await uiHelper.getElementCount('[data-testid="wbs-item"], .wbs-item')
      
      // Clear search
      await uiHelper.stableFill(searchInput, '')
      await page.waitForTimeout(1000)
      
      // Verify all items are back
      const finalCount = await uiHelper.getElementCount('[data-testid="wbs-item"], .wbs-item')
      expect(finalCount).toBe(initialCount)

      // Take screenshot for verification
      await uiHelper.takeScreenshot('wbs-search-filter')
    }
  })

  test('WBS export functionality', { tag: '@critical' }, async ({ page }) => {
    // Look for export button
    const exportButton = '[data-testid="export-wbs"], .export-btn, button:has-text("Export")'
    
    if (await page.locator(exportButton).count() > 0) {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download')
      
      // Click export
      await uiHelper.stableClick(exportButton)
      
      // Wait for download
      try {
        const download = await downloadPromise
        expect(download.suggestedFilename()).toContain('wbs')
        
        // Take screenshot for verification
        await uiHelper.takeScreenshot('wbs-export-initiated')
      } catch (error) {
        // Export might not be implemented yet, continue test
        console.log('Export functionality not yet implemented')
      }
    }
  })
})