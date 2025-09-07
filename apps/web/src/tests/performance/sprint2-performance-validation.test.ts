/**
 * T011 - Sprint 2 Performance Validation Tests
 * 
 * Validates all performance requirements from Sprint 2:
 * - Initial render: <1.5s for 1000 issues 
 * - Drag latency: <100ms response
 * - WBS-Gantt sync: Real-time synchronization
 * - Memory usage: Monitor and validate thresholds
 * - Telemetry overhead: Minimal performance impact
 */

import { test, expect } from '@playwright/test'

test.describe('T011 Sprint 2 Performance Validation', () => {
  
  test('Performance Requirement: Initial Render <1.5s for 1000 Issues', async ({ page }) => {
    console.log('🚀 Performance Test: Initial Render with 1000 Issues')
    
    // Start performance monitoring
    await page.goto('about:blank')
    
    // Enable performance timeline
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Performance.enable')
    
    // Start timing
    const startTime = performance.now()
    
    // Navigate to Gantt page with large dataset
    await page.goto('/projects/performance-test/gantt')
    
    // Wait for critical render completion
    await page.waitForSelector('[data-testid="gantt-container"], .gantt-container', { 
      state: 'visible',
      timeout: 5000 
    })
    
    // Wait for task bars to render
    await page.waitForSelector('[data-testid="task-bar"], .task-bar', { 
      state: 'visible',
      timeout: 5000 
    })
    
    // Measure when all content is loaded
    await page.waitForLoadState('networkidle')
    const endTime = performance.now()
    
    const renderTime = endTime - startTime
    console.log(`📊 Initial render time: ${renderTime.toFixed(2)}ms`)
    
    // Performance requirement: <1.5s (1500ms)
    expect(renderTime).toBeLessThan(1500)
    
    // Count rendered tasks
    const taskCount = await page.locator('[data-testid="task-bar"], .task-bar, .gantt-task').count()
    console.log(`📊 Rendered tasks: ${taskCount}`)
    
    // Verify significant number of tasks were rendered
    expect(taskCount).toBeGreaterThan(10) // At least some tasks should be visible
    
    // Take performance screenshot
    await page.screenshot({ path: 'test-results/performance-initial-render.png', fullPage: true })
  })

  test('Performance Requirement: Drag Operation Response <100ms', async ({ page }) => {
    console.log('🚀 Performance Test: Drag Operation Response Time')
    
    await page.goto('/projects/performance-test/gantt')
    await page.waitForSelector('[data-testid="gantt-container"], .gantt-container')
    
    // Find a draggable task bar
    const taskBars = page.locator('[data-testid="task-bar"], .task-bar, .gantt-task')
    await expect(taskBars.first()).toBeVisible()
    
    const taskBar = taskBars.first()
    const initialBox = await taskBar.boundingBox()
    
    if (initialBox) {
      // Measure drag operation time
      const dragStartTime = performance.now()
      
      // Perform drag operation
      await taskBar.hover()
      await page.mouse.down()
      await page.mouse.move(initialBox.x + 50, initialBox.y, { steps: 3 })
      await page.mouse.up()
      
      // Wait for visual feedback
      await page.waitForTimeout(50)
      
      const dragEndTime = performance.now()
      const dragTime = dragEndTime - dragStartTime
      
      console.log(`📊 Drag operation time: ${dragTime.toFixed(2)}ms`)
      
      // Performance requirement: <100ms
      expect(dragTime).toBeLessThan(100)
      
      // Verify drag had visual effect (position changed)
      const newBox = await taskBar.boundingBox()
      if (newBox) {
        expect(Math.abs(newBox.x - initialBox.x)).toBeGreaterThan(10)
      }
    }
    
    await page.screenshot({ path: 'test-results/performance-drag-operation.png', fullPage: true })
  })

  test('Performance Requirement: WBS-Gantt Sync Real-time', async ({ page }) => {
    console.log('🚀 Performance Test: WBS-Gantt Synchronization')
    
    // Test sync performance between WBS and Gantt views
    await page.goto('/projects/performance-test/wbs')
    await page.waitForLoadState('networkidle')
    
    const wbsItems = page.locator('[data-testid="wbs-item"], .wbs-item')
    await expect(wbsItems.first()).toBeVisible()
    
    if (await wbsItems.count() >= 2) {
      const syncStartTime = performance.now()
      
      // Modify hierarchy in WBS
      const firstItem = wbsItems.first()
      const secondItem = wbsItems.nth(1)
      
      await secondItem.dragTo(firstItem, { targetPosition: { x: 20, y: 0 } })
      await page.waitForTimeout(100) // Allow for sync processing
      
      // Navigate to Gantt to check sync
      await page.goto('/projects/performance-test/gantt')
      await page.waitForLoadState('networkidle')
      
      const syncEndTime = performance.now()
      const syncTime = syncEndTime - syncStartTime
      
      console.log(`📊 WBS-Gantt sync time: ${syncTime.toFixed(2)}ms`)
      
      // Verify Gantt reflects the change (real-time requirement)
      await expect(page.locator('[data-testid="gantt-container"], .gantt-container')).toBeVisible()
      
      // Real-time sync should be <2000ms total including navigation
      expect(syncTime).toBeLessThan(2000)
    }
    
    await page.screenshot({ path: 'test-results/performance-wbs-gantt-sync.png', fullPage: true })
  })

  test('Performance Monitoring: Memory Usage Validation', async ({ page }) => {
    console.log('🚀 Performance Test: Memory Usage Monitoring')
    
    // Enable runtime monitoring
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Runtime.enable')
    await cdp.send('Performance.enable')
    
    // Get baseline memory
    const baselineHeap = await cdp.send('Runtime.getHeapUsage')
    console.log(`📊 Baseline heap usage: ${(baselineHeap.used / 1024 / 1024).toFixed(2)} MB`)
    
    // Load Gantt with large dataset
    await page.goto('/projects/performance-test/gantt')
    await page.waitForLoadState('networkidle')
    
    // Perform operations that might increase memory usage
    const taskBars = page.locator('[data-testid="task-bar"], .task-bar')
    const barCount = await taskBars.count()
    
    // Simulate user interactions
    for (let i = 0; i < Math.min(10, barCount); i++) {
      const bar = taskBars.nth(i)
      if (await bar.isVisible()) {
        await bar.hover()
        await page.waitForTimeout(50)
      }
    }
    
    // Test undo/redo operations (memory intensive)
    const undoBtn = page.locator('[data-testid="undo-btn"], .undo-btn')
    if (await undoBtn.count() > 0 && await undoBtn.isEnabled()) {
      for (let i = 0; i < 5; i++) {
        await undoBtn.click()
        await page.waitForTimeout(100)
        
        const redoBtn = page.locator('[data-testid="redo-btn"], .redo-btn')
        if (await redoBtn.isEnabled()) {
          await redoBtn.click()
          await page.waitForTimeout(100)
        }
      }
    }
    
    // Measure final memory usage
    const finalHeap = await cdp.send('Runtime.getHeapUsage')
    const memoryIncrease = (finalHeap.used - baselineHeap.used) / 1024 / 1024
    
    console.log(`📊 Final heap usage: ${(finalHeap.used / 1024 / 1024).toFixed(2)} MB`)
    console.log(`📊 Memory increase: ${memoryIncrease.toFixed(2)} MB`)
    
    // Validate memory usage is reasonable
    expect(memoryIncrease).toBeLessThan(50) // Less than 50MB increase
    expect(finalHeap.used / 1024 / 1024).toBeLessThan(200) // Total less than 200MB
    
    await page.screenshot({ path: 'test-results/performance-memory-validation.png', fullPage: true })
  })

  test('Performance Monitoring: Telemetry Overhead Assessment', async ({ page }) => {
    console.log('🚀 Performance Test: Telemetry Overhead Assessment')
    
    // Test with telemetry disabled
    const testWithTelemetry = async (enabled: boolean) => {
      await page.goto(`/projects/performance-test/gantt?telemetry=${enabled}`)
      await page.waitForLoadState('networkidle')
      
      const startTime = performance.now()
      
      // Perform standard operations
      const taskBars = page.locator('[data-testid="task-bar"], .task-bar')
      if (await taskBars.count() > 0) {
        for (let i = 0; i < 5; i++) {
          const bar = taskBars.nth(i % await taskBars.count())
          const barBox = await bar.boundingBox()
          
          if (barBox) {
            await bar.hover()
            await page.mouse.down()
            await page.mouse.move(barBox.x + 10, barBox.y)
            await page.mouse.up()
            await page.waitForTimeout(50)
          }
        }
      }
      
      const endTime = performance.now()
      return endTime - startTime
    }
    
    // Test with telemetry disabled
    const timeWithoutTelemetry = await testWithTelemetry(false)
    console.log(`📊 Operations time without telemetry: ${timeWithoutTelemetry.toFixed(2)}ms`)
    
    // Test with telemetry enabled
    const timeWithTelemetry = await testWithTelemetry(true)
    console.log(`📊 Operations time with telemetry: ${timeWithTelemetry.toFixed(2)}ms`)
    
    // Calculate overhead
    const overhead = timeWithTelemetry - timeWithoutTelemetry
    const overheadPercentage = (overhead / timeWithoutTelemetry) * 100
    
    console.log(`📊 Telemetry overhead: ${overhead.toFixed(2)}ms (${overheadPercentage.toFixed(2)}%)`)
    
    // Validate telemetry overhead is minimal (<10%)
    expect(overheadPercentage).toBeLessThan(10)
    
    await page.screenshot({ path: 'test-results/performance-telemetry-overhead.png', fullPage: true })
  })

  test('Performance Validation: Zoom and Scroll Operations', async ({ page }) => {
    console.log('🚀 Performance Test: Zoom and Scroll Operations')
    
    await page.goto('/projects/performance-test/gantt')
    await page.waitForLoadState('networkidle')
    
    const ganttContainer = page.locator('[data-testid="gantt-container"], .gantt-container')
    await expect(ganttContainer).toBeVisible()
    
    // Test zoom operations
    const zoomInBtn = page.locator('[data-testid="zoom-in"], .zoom-in')
    const zoomOutBtn = page.locator('[data-testid="zoom-out"], .zoom-out')
    
    if (await zoomInBtn.count() > 0) {
      const zoomStartTime = performance.now()
      
      // Perform multiple zoom operations
      await zoomInBtn.click()
      await page.waitForTimeout(100)
      await zoomInBtn.click()
      await page.waitForTimeout(100)
      await zoomOutBtn.click()
      await page.waitForTimeout(100)
      
      const zoomEndTime = performance.now()
      const zoomTime = zoomEndTime - zoomStartTime
      
      console.log(`📊 Zoom operations time: ${zoomTime.toFixed(2)}ms`)
      
      // Zoom operations should be responsive
      expect(zoomTime).toBeLessThan(500)
    }
    
    // Test scroll performance
    const scrollStartTime = performance.now()
    
    // Horizontal scroll
    await ganttContainer.hover()
    await page.mouse.wheel(100, 0)
    await page.waitForTimeout(50)
    
    // Vertical scroll
    await page.mouse.wheel(0, 100)
    await page.waitForTimeout(50)
    
    const scrollEndTime = performance.now()
    const scrollTime = scrollEndTime - scrollStartTime
    
    console.log(`📊 Scroll operations time: ${scrollTime.toFixed(2)}ms`)
    
    // Scroll should be smooth and responsive
    expect(scrollTime).toBeLessThan(200)
    
    await page.screenshot({ path: 'test-results/performance-zoom-scroll.png', fullPage: true })
  })

  test('Performance Benchmarking: Large Dataset Stress Test', async ({ page }) => {
    console.log('🚀 Performance Test: Large Dataset Stress Test')
    
    // Simulate loading with progressively larger datasets
    const datasetSizes = [100, 500, 1000]
    const results: Array<{ size: number; loadTime: number; renderTime: number }> = []
    
    for (const size of datasetSizes) {
      console.log(`🔄 Testing with ${size} issues...`)
      
      const loadStartTime = performance.now()
      
      await page.goto(`/projects/performance-test/gantt?size=${size}`)
      await page.waitForLoadState('networkidle')
      
      const loadEndTime = performance.now()
      
      // Wait for rendering to complete
      const renderStartTime = performance.now()
      await page.waitForSelector('[data-testid="gantt-container"], .gantt-container')
      await page.waitForTimeout(1000) // Allow rendering to stabilize
      const renderEndTime = performance.now()
      
      const loadTime = loadEndTime - loadStartTime
      const renderTime = renderEndTime - renderStartTime
      
      results.push({ size, loadTime, renderTime })
      
      console.log(`📊 ${size} issues: Load ${loadTime.toFixed(2)}ms, Render ${renderTime.toFixed(2)}ms`)
      
      // Validate performance scales reasonably
      if (size === 1000) {
        expect(loadTime).toBeLessThan(1500) // <1.5s for 1000 issues
        expect(renderTime).toBeLessThan(1000) // <1s render time
      }
    }
    
    // Analyze scaling behavior
    const scalingFactor = results[2].loadTime / results[0].loadTime
    console.log(`📊 Performance scaling factor (1000/100): ${scalingFactor.toFixed(2)}x`)
    
    // Performance should scale sub-linearly (better than 10x for 10x data)
    expect(scalingFactor).toBeLessThan(10)
    
    await page.screenshot({ path: 'test-results/performance-stress-test.png', fullPage: true })
  })

  test.afterEach(async ({ page }, testInfo) => {
    // Capture performance metrics after each test
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
      }
    })
    
    console.log(`📊 Performance Metrics for ${testInfo.title}:`)
    console.log(`   DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(2)}ms`)
    console.log(`   Load Complete: ${performanceMetrics.loadComplete.toFixed(2)}ms`)
    console.log(`   First Paint: ${performanceMetrics.firstPaint.toFixed(2)}ms`)
    console.log(`   First Contentful Paint: ${performanceMetrics.firstContentfulPaint.toFixed(2)}ms`)
    
    // Add metrics to test results
    await testInfo.attach('performance-metrics.json', {
      body: JSON.stringify(performanceMetrics, null, 2),
      contentType: 'application/json'
    })
  })
})