import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'
import { PerformanceHelper } from './helpers/performance-helper'

test.describe('Performance Benchmarks - Automated Regression Detection', () => {
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
    
    // Generate performance report
    const report = await performanceHelper.generateReport()
    console.log('\n📊 Performance Report:\n', report)
  })

  // AC4: Initial render time target <1.5s
  test('Initial render performance - Target <1.5s', { 
    tag: '@performance' 
  }, async ({ page }) => {
    console.log('🚀 Testing initial render performance...')

    // Clear any cached data to get accurate initial load
    await page.context().clearCookies()
    
    // Measure initial render time
    const renderBenchmark = await performanceHelper.measureInitialRender()
    
    // Navigate to all critical pages and measure render times
    const criticalPages = [
      { path: '/', name: 'Home Page' },
      { path: '/gantt', name: 'Gantt Chart' },
      { path: '/issues', name: 'Issues Page' },
      { path: '/projects', name: 'Projects Page' }
    ]

    const benchmarks = []
    
    for (const pageInfo of criticalPages) {
      console.log(`Measuring render time for ${pageInfo.name}...`)
      
      await performanceHelper.startMeasurement(`render_${pageInfo.name}`)
      
      await uiHelper.navigateToPage(pageInfo.path)
      await uiHelper.waitForPageLoad()
      
      // Wait for critical elements to be visible
      const criticalElements = [
        '[data-testid="main-content"], main',
        '[data-testid="gantt-container"], .gantt-container',
        '[data-testid="issue-table"], .issue-table',
        '[data-testid="project-list"], .project-list'
      ]
      
      for (const selector of criticalElements) {
        try {
          await page.waitForSelector(selector, { timeout: 2000, state: 'visible' })
          break // Found at least one critical element
        } catch {
          // Continue to next selector
        }
      }
      
      const renderTime = await performanceHelper.endMeasurement(`render_${pageInfo.name}`)
      
      benchmarks.push({
        name: `${pageInfo.name} Render Time`,
        target: 1500, // 1.5 seconds
        actual: renderTime,
        passed: renderTime <= 1500,
        unit: 'ms'
      })
      
      console.log(`${pageInfo.name} rendered in ${renderTime}ms`)
    }

    // Validate all benchmarks
    await performanceHelper.validateBenchmarks(benchmarks)

    console.log('✅ Initial render performance test completed')
  })

  // AC4: Drag operation performance target <100ms
  test('Drag operation performance - Target <100ms', { 
    tag: '@performance' 
  }, async ({ page }) => {
    console.log('🎯 Testing drag operation performance...')

    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test different types of drag operations
    const dragOperations = []
    
    // Test 1: Task bar drag (horizontal movement)
    const taskBars = '[data-testid="task-bar"], .task-bar, .gantt-task'
    if (await page.locator(taskBars).count() >= 2) {
      console.log('Testing task bar drag performance...')
      
      const dragBenchmark = await performanceHelper.measureDragOperation(
        `${taskBars}:first-child`,
        `${taskBars}:nth-child(2)`
      )
      
      dragOperations.push(dragBenchmark)
    }

    // Test 2: Task resize operation
    const resizeHandles = '[data-testid="resize-handle"], .resize-handle, .task-resize'
    if (await page.locator(resizeHandles).count() > 0) {
      console.log('Testing task resize performance...')
      
      await performanceHelper.startMeasurement('taskResize')
      
      const firstHandle = page.locator(resizeHandles).first()
      const handleBox = await firstHandle.boundingBox()
      
      if (handleBox) {
        await firstHandle.hover()
        await page.mouse.down()
        await page.mouse.move(handleBox.x + 50, handleBox.y)
        await page.mouse.up()
        await page.waitForTimeout(100) // Wait for UI update
      }
      
      const resizeTime = await performanceHelper.endMeasurement('taskResize')
      
      dragOperations.push({
        name: 'Task Resize Time',
        target: 100,
        actual: resizeTime,
        passed: resizeTime <= 100,
        unit: 'ms'
      })
    }

    // Test 3: Timeline scroll performance
    console.log('Testing timeline scroll performance...')
    
    await performanceHelper.startMeasurement('timelineScroll')
    
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    if (await page.locator(ganttContainer).count() > 0) {
      await page.locator(ganttContainer).hover()
      
      // Perform multiple scroll operations
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(50, 0) // Horizontal scroll
        await page.waitForTimeout(20) // Small delay between scrolls
      }
    }
    
    const scrollTime = await performanceHelper.endMeasurement('timelineScroll')
    
    dragOperations.push({
      name: 'Timeline Scroll Time',
      target: 500, // More lenient for scroll operations
      actual: scrollTime,
      passed: scrollTime <= 500,
      unit: 'ms'
    })

    // Validate all drag operation benchmarks
    await performanceHelper.validateBenchmarks(dragOperations)

    console.log('✅ Drag operation performance test completed')
  })

  // AC4: Memory usage monitoring and leak detection
  test('Memory usage and leak detection', { 
    tag: '@performance' 
  }, async ({ page }) => {
    console.log('🧠 Testing memory usage and leak detection...')

    // Only run memory tests on Chromium (has memory API)
    const browserName = await page.evaluate(() => navigator.userAgent)
    if (!browserName.includes('Chrome')) {
      test.skip('Memory testing only available on Chromium browsers')
      return
    }

    // Get initial memory baseline
    const initialMemory = await page.evaluate(() => {
      const memory = (performance as any).memory
      return memory ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      } : null
    })

    if (!initialMemory) {
      test.skip('Memory API not available')
      return
    }

    console.log('Initial memory usage:', {
      used: `${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      total: `${(initialMemory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`
    })

    // Perform memory-intensive operations
    const testOperations = [
      { path: '/gantt', name: 'Gantt Chart' },
      { path: '/issues', name: 'Issues Page' },
      { path: '/projects', name: 'Projects Page' }
    ]

    let maxMemoryUsed = initialMemory.usedJSHeapSize

    for (let cycle = 0; cycle < 3; cycle++) {
      console.log(`Memory test cycle ${cycle + 1}/3`)
      
      for (const operation of testOperations) {
        await uiHelper.navigateToPage(operation.path)
        await uiHelper.waitForPageLoad()
        
        // Perform some interactions to load more data
        if (operation.path === '/gantt') {
          // Zoom in/out to trigger redraws
          const zoomControls = '[data-testid="zoom-in"], [data-testid="zoom-out"], .zoom-btn'
          if (await page.locator(zoomControls).count() > 0) {
            await page.locator(zoomControls).first().click()
            await page.waitForTimeout(500)
          }
          
          // Scroll timeline
          const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
          if (await page.locator(ganttContainer).count() > 0) {
            await page.locator(ganttContainer).hover()
            for (let i = 0; i < 10; i++) {
              await page.mouse.wheel(100, 0)
              await page.waitForTimeout(50)
            }
          }
        }
        
        // Check memory usage
        const currentMemory = await page.evaluate(() => {
          const memory = (performance as any).memory
          return memory ? memory.usedJSHeapSize : 0
        })
        
        maxMemoryUsed = Math.max(maxMemoryUsed, currentMemory)
        
        console.log(`${operation.name} memory: ${(currentMemory / 1024 / 1024).toFixed(2)} MB`)
      }
      
      // Force garbage collection (if available in test environment)
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc()
        }
      })
      
      await page.waitForTimeout(1000) // Allow GC to run
    }

    // Final memory check
    const finalMemory = await page.evaluate(() => {
      const memory = (performance as any).memory
      return memory ? memory.usedJSHeapSize : 0
    })

    const memoryIncrease = finalMemory - initialMemory.usedJSHeapSize
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024
    const maxMemoryMB = maxMemoryUsed / 1024 / 1024

    console.log('\n📊 Memory Test Results:')
    console.log(`Initial: ${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Peak: ${maxMemoryMB.toFixed(2)} MB`)
    console.log(`Net Increase: ${memoryIncreaseMB.toFixed(2)} MB`)

    // Memory assertions
    expect(maxMemoryMB, 'Peak memory usage should be reasonable').toBeLessThan(150) // 150MB limit
    expect(memoryIncreaseMB, 'Memory increase should be minimal (no major leaks)').toBeLessThan(50) // 50MB increase limit
    
    console.log('✅ Memory usage test completed')
  })

  // AC4: Network request performance monitoring
  test('Network request performance', { 
    tag: '@performance' 
  }, async ({ page }) => {
    console.log('🌐 Testing network request performance...')

    const networkMetrics: Array<{
      url: string
      duration: number
      status: number
      size: number
    }> = []

    // Monitor network requests
    page.on('response', (response) => {
      const request = response.request()
      const timing = response.timing()
      
      networkMetrics.push({
        url: response.url(),
        duration: timing.responseEnd - timing.requestStart,
        status: response.status(),
        size: parseInt(response.headers()['content-length'] || '0', 10)
      })
    })

    // Navigate to pages and measure network performance
    const pages = ['/gantt', '/issues', '/projects']
    
    for (const pagePath of pages) {
      console.log(`Testing network performance for ${pagePath}...`)
      
      await performanceHelper.startMeasurement(`network_${pagePath}`)
      await uiHelper.navigateToPage(pagePath)
      await uiHelper.waitForPageLoad()
      const networkTime = await performanceHelper.endMeasurement(`network_${pagePath}`)
      
      console.log(`${pagePath} network time: ${networkTime}ms`)
    }

    // Wait for all requests to complete
    await page.waitForTimeout(2000)

    // Analyze network performance
    const apiRequests = networkMetrics.filter(req => req.url.includes('/api/'))
    const staticRequests = networkMetrics.filter(req => 
      req.url.includes('.js') || req.url.includes('.css') || req.url.includes('.png')
    )

    console.log('\n📊 Network Performance Analysis:')
    console.log(`Total requests: ${networkMetrics.length}`)
    console.log(`API requests: ${apiRequests.length}`)
    console.log(`Static requests: ${staticRequests.length}`)

    if (apiRequests.length > 0) {
      const avgApiTime = apiRequests.reduce((sum, req) => sum + req.duration, 0) / apiRequests.length
      const maxApiTime = Math.max(...apiRequests.map(req => req.duration))
      
      console.log(`Average API response time: ${avgApiTime.toFixed(2)}ms`)
      console.log(`Max API response time: ${maxApiTime.toFixed(2)}ms`)
      
      expect(avgApiTime, 'Average API response time should be reasonable').toBeLessThan(2000) // 2s
      expect(maxApiTime, 'Max API response time should be acceptable').toBeLessThan(5000) // 5s
    }

    // Check for failed requests
    const failedRequests = networkMetrics.filter(req => req.status >= 400)
    console.log(`Failed requests: ${failedRequests.length}`)
    
    if (failedRequests.length > 0) {
      console.log('Failed requests:', failedRequests.map(req => ({ url: req.url, status: req.status })))
    }

    expect(failedRequests.length, 'Should have minimal failed requests').toBeLessThanOrEqual(2)

    console.log('✅ Network request performance test completed')
  })

  // AC4: Performance regression detection with baselines
  test('Performance regression detection', { 
    tag: '@performance' 
  }, async ({ page }) => {
    console.log('📈 Testing performance regression detection...')

    // Define performance baselines (these would typically be stored/loaded from a file)
    const performanceBaselines = {
      initialRender: { target: 1500, warning: 1200 }, // ms
      ganttRender: { target: 2000, warning: 1500 }, // ms
      taskInteraction: { target: 100, warning: 75 }, // ms
      navigation: { target: 1000, warning: 750 } // ms
    }

    // Test 1: Initial render regression
    console.log('Testing initial render regression...')
    const renderBenchmark = await performanceHelper.measureInitialRender()
    
    const renderRegression = renderBenchmark.actual > performanceBaselines.initialRender.warning
    if (renderRegression) {
      console.warn(`⚠️  Initial render regression detected: ${renderBenchmark.actual}ms > ${performanceBaselines.initialRender.warning}ms baseline`)
    }

    // Test 2: Gantt chart specific performance
    console.log('Testing Gantt chart performance regression...')
    await performanceHelper.startMeasurement('ganttSpecific')
    
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()
    
    // Wait specifically for Gantt chart to render
    await page.waitForSelector('[data-testid="gantt-container"], .gantt-container', { timeout: 5000 })
    await page.waitForSelector('[data-testid="task-bar"], .task-bar, .gantt-task', { timeout: 5000 })
    
    const ganttRenderTime = await performanceHelper.endMeasurement('ganttSpecific')
    
    const ganttRegression = ganttRenderTime > performanceBaselines.ganttRender.warning
    if (ganttRegression) {
      console.warn(`⚠️  Gantt chart regression detected: ${ganttRenderTime}ms > ${performanceBaselines.ganttRender.warning}ms baseline`)
    }

    // Test 3: Interaction performance regression
    console.log('Testing interaction performance regression...')
    const taskBars = '[data-testid="task-bar"], .task-bar, .gantt-task'
    
    if (await page.locator(taskBars).count() > 0) {
      await performanceHelper.startMeasurement('taskInteraction')
      
      // Perform typical user interaction
      await page.locator(taskBars).first().click()
      await page.waitForTimeout(100)
      
      const interactionTime = await performanceHelper.endMeasurement('taskInteraction')
      
      const interactionRegression = interactionTime > performanceBaselines.taskInteraction.warning
      if (interactionRegression) {
        console.warn(`⚠️  Task interaction regression detected: ${interactionTime}ms > ${performanceBaselines.taskInteraction.warning}ms baseline`)
      }
    }

    // Test 4: Navigation performance regression
    console.log('Testing navigation performance regression...')
    const navigationBenchmark = await performanceHelper.measureNavigation('/issues')
    
    const navRegression = navigationBenchmark.actual > performanceBaselines.navigation.warning
    if (navRegression) {
      console.warn(`⚠️  Navigation regression detected: ${navigationBenchmark.actual}ms > ${performanceBaselines.navigation.warning}ms baseline`)
    }

    // Compile regression report
    const regressions = [
      { name: 'Initial Render', hasRegression: renderRegression, value: renderBenchmark.actual, baseline: performanceBaselines.initialRender.warning },
      { name: 'Gantt Chart Render', hasRegression: ganttRegression, value: ganttRenderTime, baseline: performanceBaselines.ganttRender.warning },
      { name: 'Navigation', hasRegression: navRegression, value: navigationBenchmark.actual, baseline: performanceBaselines.navigation.warning }
    ]

    console.log('\n📊 Regression Detection Results:')
    regressions.forEach(regression => {
      const status = regression.hasRegression ? '⚠️  REGRESSION' : '✅ OK'
      console.log(`${status} ${regression.name}: ${regression.value}ms (baseline: ${regression.baseline}ms)`)
    })

    // Assert no critical regressions (allow warnings but fail on critical issues)
    const criticalRegressions = regressions.filter(r => r.hasRegression && r.value > r.baseline * 1.5) // 50% over baseline is critical
    expect(criticalRegressions.length, 'Should have no critical performance regressions').toBe(0)

    console.log('✅ Performance regression detection completed')
  })

  // AC4: Real-world performance scenarios
  test('Real-world performance scenarios', { 
    tag: '@performance' 
  }, async ({ page }) => {
    console.log('🌍 Testing real-world performance scenarios...')

    // Scenario 1: Large project with many tasks
    console.log('Scenario 1: Large project performance...')
    await performanceHelper.startMeasurement('largeProject')
    
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()
    
    // Simulate scrolling through large project
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    if (await page.locator(ganttContainer).count() > 0) {
      await page.locator(ganttContainer).hover()
      
      // Simulate heavy scrolling
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(0, 100) // Vertical scroll
        await page.waitForTimeout(25)
      }
      
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(100, 0) // Horizontal scroll
        await page.waitForTimeout(25)
      }
    }
    
    const largeProjectTime = await performanceHelper.endMeasurement('largeProject')
    console.log(`Large project scenario: ${largeProjectTime}ms`)

    // Scenario 2: Rapid task creation
    console.log('Scenario 2: Rapid task operations...')
    await performanceHelper.startMeasurement('rapidOperations')
    
    await uiHelper.navigateToPage('/issues')
    await uiHelper.waitForPageLoad()
    
    // Simulate rapid task creation/editing
    for (let i = 0; i < 3; i++) {
      const createButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New Issue")'
      if (await page.locator(createButton).count() > 0) {
        await page.locator(createButton).click()
        await page.waitForTimeout(100)
        
        // Quick form fill and cancel
        const titleField = '[data-testid="issue-title"], input[name="title"]'
        if (await page.locator(titleField).count() > 0) {
          await page.locator(titleField).fill(`Quick Task ${i}`)
          
          const cancelButton = '[data-testid="cancel"], button:has-text("Cancel")'
          if (await page.locator(cancelButton).count() > 0) {
            await page.locator(cancelButton).click()
          } else {
            await page.keyboard.press('Escape')
          }
        }
        
        await page.waitForTimeout(100)
      }
    }
    
    const rapidOpsTime = await performanceHelper.endMeasurement('rapidOperations')
    console.log(`Rapid operations scenario: ${rapidOpsTime}ms`)

    // Scenario 3: Multi-tab performance (simulate user switching between views)
    console.log('Scenario 3: Multi-view performance...')
    await performanceHelper.startMeasurement('multiView')
    
    const views = ['/gantt', '/issues', '/projects', '/gantt']
    for (const view of views) {
      await uiHelper.navigateToPage(view)
      await uiHelper.waitForPageLoad()
      await page.waitForTimeout(200) // Simulate user reading time
    }
    
    const multiViewTime = await performanceHelper.endMeasurement('multiView')
    console.log(`Multi-view scenario: ${multiViewTime}ms`)

    // Performance benchmarks for real-world scenarios
    const scenarioBenchmarks = [
      {
        name: 'Large Project Handling',
        target: 3000, // 3 seconds for large project operations
        actual: largeProjectTime,
        passed: largeProjectTime <= 3000,
        unit: 'ms'
      },
      {
        name: 'Rapid Operations',
        target: 2000, // 2 seconds for rapid operations
        actual: rapidOpsTime,
        passed: rapidOpsTime <= 2000,
        unit: 'ms'
      },
      {
        name: 'Multi-View Navigation',
        target: 4000, // 4 seconds for switching between views
        actual: multiViewTime,
        passed: multiViewTime <= 4000,
        unit: 'ms'
      }
    ]

    await performanceHelper.validateBenchmarks(scenarioBenchmarks)

    console.log('✅ Real-world performance scenarios completed')
  })
})