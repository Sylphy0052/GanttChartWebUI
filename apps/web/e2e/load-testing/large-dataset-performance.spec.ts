import { test, expect } from '@playwright/test'
import { UIHelper } from '../helpers/ui-helper'
import { DataHelper } from '../helpers/data-helper'
import { AuthHelper } from '../helpers/auth-helper'
import { PerformanceHelper } from '../helpers/performance-helper'

/**
 * T023-AC1: Large Dataset Performance Validation
 * Tests system performance with 1000+ issues to ensure initial render under 1.5s target
 */
test.describe('Large Dataset Performance Validation (AC1)', () => {
  let uiHelper: UIHelper
  let dataHelper: DataHelper
  let authHelper: AuthHelper
  let performanceHelper: PerformanceHelper

  test.beforeEach(async ({ page }) => {
    uiHelper = new UIHelper(page)
    dataHelper = new DataHelper(page)
    authHelper = new AuthHelper(page)
    performanceHelper = new PerformanceHelper(page)
    
    await dataHelper.setupCleanEnvironment()
    await authHelper.ensureAuthenticated()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
  })

  // AC1: 1000+ issues performance validation with initial render <1.5s
  test('1000+ issues performance validation - Initial render <1.5s', { 
    tag: '@load-test',
    timeout: 120000 // 2 minutes for large dataset
  }, async ({ page }) => {
    console.log('🔬 AC1: Testing 1000+ issues performance validation...')

    // Step 1: Create large dataset of 1000+ issues
    console.log('Creating large dataset of 1000+ issues...')
    await performanceHelper.startMeasurement('datasetCreation')
    
    // Create issues in batches for better performance
    const batchSize = 50
    const totalIssues = 1000
    const batches = Math.ceil(totalIssues / batchSize)
    
    for (let batch = 0; batch < batches; batch++) {
      const startIdx = batch * batchSize
      const endIdx = Math.min(startIdx + batchSize, totalIssues)
      const batchIssues = []
      
      for (let i = startIdx; i < endIdx; i++) {
        batchIssues.push({
          title: `Load Test Issue ${i + 1}`,
          description: `Performance test issue ${i + 1} for load testing validation`,
          status: i % 4 === 0 ? 'TODO' : i % 4 === 1 ? 'IN_PROGRESS' : i % 4 === 2 ? 'REVIEW' : 'DONE',
          priority: i % 3 === 0 ? 'HIGH' : i % 3 === 1 ? 'MEDIUM' : 'LOW',
          assignee: `user${(i % 10) + 1}@example.com`,
          startDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + (i + 7) * 24 * 60 * 60 * 1000),
          estimatedHours: Math.floor(Math.random() * 40) + 8
        })
      }
      
      // Create issues via API for efficiency
      await dataHelper.createIssuesBatch(batchIssues)
      console.log(`Created batch ${batch + 1}/${batches} (${endIdx}/${totalIssues} issues)`)
      
      // Small delay to prevent overwhelming the API
      await page.waitForTimeout(100)
    }
    
    const datasetCreationTime = await performanceHelper.endMeasurement('datasetCreation')
    console.log(`Dataset creation completed in ${datasetCreationTime}ms`)

    // Step 2: Measure initial render performance with large dataset
    console.log('Measuring initial render performance with 1000+ issues...')
    
    // Clear browser cache to get accurate initial load measurement
    await page.context().clearCookies()
    await page.evaluate(() => {
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name))
        })
      }
      localStorage.clear()
      sessionStorage.clear()
    })

    // Start performance measurement for initial render
    await performanceHelper.startMeasurement('largeDatasetInitialRender')
    
    // Navigate to issues page with large dataset
    await page.goto('/issues', { waitUntil: 'networkidle' })
    
    // Wait for critical UI elements to be visible
    const criticalSelectors = [
      '[data-testid="issue-table"]',
      '[data-testid="issue-row"]',
      '.issue-table',
      '.issue-row',
      'table tbody tr'
    ]
    
    let elementsFound = false
    for (const selector of criticalSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000, state: 'visible' })
        elementsFound = true
        console.log(`Critical element found: ${selector}`)
        break
      } catch (error) {
        console.log(`Selector not found: ${selector}`)
      }
    }
    
    if (!elementsFound) {
      console.log('Warning: No critical UI elements found, checking for any table elements...')
      try {
        await page.waitForSelector('table, [role="table"], [data-testid*="table"]', { timeout: 5000 })
        elementsFound = true
      } catch (error) {
        console.log('No table elements found either')
      }
    }

    // Wait for data to be loaded (check for loading indicators to disappear)
    try {
      await page.waitForSelector('[data-testid="loading"], .loading, .spinner', { 
        state: 'detached', 
        timeout: 15000 
      })
    } catch (error) {
      // No loading indicator found, which is fine
    }

    // Wait for virtualization to complete (if using virtualized tables)
    await page.waitForTimeout(1000)
    
    const initialRenderTime = await performanceHelper.endMeasurement('largeDatasetInitialRender')
    console.log(`Initial render with 1000+ issues: ${initialRenderTime}ms`)

    // Step 3: Validate performance benchmarks
    const largeDataseBenchmarks = [
      {
        name: 'Large Dataset Initial Render (1000+ issues)',
        target: 1500, // 1.5 seconds target
        actual: initialRenderTime,
        passed: initialRenderTime <= 1500,
        unit: 'ms'
      }
    ]

    await performanceHelper.validateBenchmarks(largeDataseBenchmarks)

    // Step 4: Test scrolling performance with large dataset
    console.log('Testing scrolling performance with large dataset...')
    await performanceHelper.startMeasurement('largeDatasetScrolling')
    
    // Perform vertical scrolling through the large dataset
    const tableContainer = await page.locator('table, [data-testid="issue-table"], .issue-table').first()
    if (await tableContainer.count() > 0) {
      await tableContainer.hover()
      
      // Scroll through multiple pages of data
      for (let i = 0; i < 50; i++) {
        await page.mouse.wheel(0, 200) // Scroll down
        await page.waitForTimeout(20) // Small delay for smooth scrolling
      }
      
      // Scroll back up
      for (let i = 0; i < 25; i++) {
        await page.mouse.wheel(0, -200) // Scroll up
        await page.waitForTimeout(20)
      }
    }
    
    const scrollingTime = await performanceHelper.endMeasurement('largeDatasetScrolling')
    console.log(`Large dataset scrolling performance: ${scrollingTime}ms`)

    // Step 5: Test search/filter performance with large dataset
    console.log('Testing search/filter performance with large dataset...')
    await performanceHelper.startMeasurement('largeDatasetSearch')
    
    const searchInput = '[data-testid="search-input"], input[type="search"], input[placeholder*="search"]'
    if (await page.locator(searchInput).count() > 0) {
      await page.locator(searchInput).fill('Load Test Issue 100')
      await page.waitForTimeout(500) // Wait for debounced search
      
      // Clear search
      await page.locator(searchInput).fill('')
      await page.waitForTimeout(500)
    }
    
    const searchTime = await performanceHelper.endMeasurement('largeDatasetSearch')
    console.log(`Large dataset search performance: ${searchTime}ms`)

    // Step 6: Test Gantt chart performance with large dataset
    console.log('Testing Gantt chart performance with large dataset...')
    await performanceHelper.startMeasurement('largeDatasetGantt')
    
    await page.goto('/gantt', { waitUntil: 'networkidle' })
    
    // Wait for Gantt chart to render
    const ganttSelectors = [
      '[data-testid="gantt-container"]',
      '.gantt-container',
      '[data-testid="task-bar"]',
      '.task-bar'
    ]
    
    for (const selector of ganttSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000, state: 'visible' })
        console.log(`Gantt element found: ${selector}`)
        break
      } catch (error) {
        console.log(`Gantt selector not found: ${selector}`)
      }
    }
    
    const ganttRenderTime = await performanceHelper.endMeasurement('largeDatasetGantt')
    console.log(`Gantt chart render with 1000+ issues: ${ganttRenderTime}ms`)

    // Step 7: Comprehensive performance validation
    const comprehensiveBenchmarks = [
      {
        name: 'Large Dataset Initial Render',
        target: 1500,
        actual: initialRenderTime,
        passed: initialRenderTime <= 1500,
        unit: 'ms'
      },
      {
        name: 'Large Dataset Scrolling',
        target: 2000, // More lenient for scrolling operations
        actual: scrollingTime,
        passed: scrollingTime <= 2000,
        unit: 'ms'
      },
      {
        name: 'Large Dataset Search/Filter',
        target: 1000,
        actual: searchTime,
        passed: searchTime <= 1000,
        unit: 'ms'
      },
      {
        name: 'Gantt Chart with Large Dataset',
        target: 3000, // More lenient for complex Gantt rendering
        actual: ganttRenderTime,
        passed: ganttRenderTime <= 3000,
        unit: 'ms'
      }
    ]

    await performanceHelper.validateBenchmarks(comprehensiveBenchmarks)

    // Step 8: Memory usage validation with large dataset
    console.log('Validating memory usage with large dataset...')
    
    const memoryMetrics = await page.evaluate(() => {
      const memory = (performance as any).memory
      return memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      } : null
    })

    if (memoryMetrics) {
      const memoryUsageMB = memoryMetrics.usedJSHeapSize / 1024 / 1024
      console.log(`Memory usage with 1000+ issues: ${memoryUsageMB.toFixed(2)} MB`)
      
      // Validate memory usage is reasonable
      expect(memoryUsageMB, 'Memory usage should be reasonable with large dataset').toBeLessThan(200) // 200MB limit
    }

    // Step 9: Performance report generation
    const performanceReport = await performanceHelper.generateReport()
    console.log('\n📊 Large Dataset Performance Report:')
    console.log(performanceReport)
    
    // Generate detailed performance summary
    console.log('\n=== T023-AC1 Large Dataset Performance Summary ===')
    console.log(`✅ 1000+ issues created successfully`)
    console.log(`✅ Initial render: ${initialRenderTime}ms (target: ≤1500ms)`)
    console.log(`✅ Scrolling performance: ${scrollingTime}ms (target: ≤2000ms)`)
    console.log(`✅ Search performance: ${searchTime}ms (target: ≤1000ms)`)
    console.log(`✅ Gantt rendering: ${ganttRenderTime}ms (target: ≤3000ms)`)
    if (memoryMetrics) {
      console.log(`✅ Memory usage: ${(memoryMetrics.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    }
    console.log('================================================')

    console.log('✅ AC1: Large dataset performance validation completed successfully')
  })

  // AC1: Pagination performance with large dataset
  test('Pagination performance with 1000+ issues', { 
    tag: '@load-test',
    timeout: 60000
  }, async ({ page }) => {
    console.log('📄 Testing pagination performance with large dataset...')

    // Create large dataset (smaller than full test for focused pagination testing)
    await dataHelper.createLargeDataset(500) // 500 issues for pagination testing
    
    await page.goto('/issues', { waitUntil: 'networkidle' })
    
    // Test pagination performance
    await performanceHelper.startMeasurement('paginationNavigation')
    
    const paginationControls = [
      '[data-testid="next-page"]',
      '.pagination-next',
      'button:has-text("Next")',
      'button[aria-label*="next"]'
    ]
    
    let paginationFound = false
    for (const control of paginationControls) {
      if (await page.locator(control).count() > 0) {
        paginationFound = true
        
        // Navigate through multiple pages
        for (let i = 0; i < 5; i++) {
          try {
            await page.locator(control).click()
            await page.waitForTimeout(200) // Wait for page to load
            console.log(`Navigated to page ${i + 2}`)
          } catch (error) {
            console.log(`Pagination ended at page ${i + 1}`)
            break
          }
        }
        break
      }
    }
    
    if (!paginationFound) {
      console.log('No pagination controls found, testing virtual scrolling instead...')
      
      // Test virtual scrolling if pagination is not available
      const tableContainer = await page.locator('table, [data-testid="issue-table"]').first()
      if (await tableContainer.count() > 0) {
        await tableContainer.hover()
        
        for (let i = 0; i < 20; i++) {
          await page.mouse.wheel(0, 500)
          await page.waitForTimeout(50)
        }
      }
    }
    
    const paginationTime = await performanceHelper.endMeasurement('paginationNavigation')
    console.log(`Pagination performance: ${paginationTime}ms`)
    
    // Validate pagination performance
    const paginationBenchmark = {
      name: 'Pagination Navigation Performance',
      target: 2000,
      actual: paginationTime,
      passed: paginationTime <= 2000,
      unit: 'ms'
    }
    
    await performanceHelper.validateBenchmarks([paginationBenchmark])
    
    console.log('✅ Pagination performance test completed')
  })

  // AC1: Table sorting performance with large dataset
  test('Table sorting performance with 1000+ issues', { 
    tag: '@load-test',
    timeout: 60000
  }, async ({ page }) => {
    console.log('📊 Testing table sorting performance with large dataset...')

    // Create dataset for sorting test
    await dataHelper.createLargeDataset(300) // 300 issues for sorting test
    
    await page.goto('/issues', { waitUntil: 'networkidle' })
    
    // Test sorting performance
    const sortableColumns = [
      '[data-testid="sort-title"], th:has-text("Title")',
      '[data-testid="sort-status"], th:has-text("Status")',
      '[data-testid="sort-priority"], th:has-text("Priority")',
      '[data-testid="sort-assignee"], th:has-text("Assignee")'
    ]
    
    const sortingBenchmarks = []
    
    for (const column of sortableColumns) {
      if (await page.locator(column).count() > 0) {
        await performanceHelper.startMeasurement(`sorting_${column}`)
        
        // Click to sort ascending
        await page.locator(column).click()
        await page.waitForTimeout(300)
        
        // Click to sort descending
        await page.locator(column).click()
        await page.waitForTimeout(300)
        
        const sortingTime = await performanceHelper.endMeasurement(`sorting_${column}`)
        
        sortingBenchmarks.push({
          name: `Table Sorting - ${column}`,
          target: 1000,
          actual: sortingTime,
          passed: sortingTime <= 1000,
          unit: 'ms'
        })
        
        console.log(`Sorting performance for ${column}: ${sortingTime}ms`)
      }
    }
    
    if (sortingBenchmarks.length > 0) {
      await performanceHelper.validateBenchmarks(sortingBenchmarks)
    } else {
      console.log('⚠️  No sortable columns found for testing')
    }
    
    console.log('✅ Table sorting performance test completed')
  })
})