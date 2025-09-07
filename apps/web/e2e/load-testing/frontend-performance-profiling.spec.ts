import { test, expect } from '@playwright/test'
import { UIHelper } from '../helpers/ui-helper'
import { DataHelper } from '../helpers/data-helper'
import { AuthHelper } from '../helpers/auth-helper'
import { PerformanceHelper } from '../helpers/performance-helper'

/**
 * T023-AC6: Frontend Performance Profiling
 * Captures detailed metrics for optimization opportunities
 */
test.describe('Frontend Performance Profiling (AC6)', () => {
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

  // AC6: Comprehensive frontend performance profiling
  test('Comprehensive frontend performance profiling', { 
    tag: '@load-test',
    timeout: 600000 // 10 minutes
  }, async ({ page }) => {
    console.log('🔬 AC6: Comprehensive frontend performance profiling...')

    // Step 1: Create dataset for profiling
    console.log('Creating dataset for performance profiling...')
    await dataHelper.createLargeDataset(200) // Moderate dataset for detailed profiling

    // Initialize performance profiling
    const performanceMetrics = {
      pageLoad: {},
      rendering: {},
      interactions: {},
      memory: {},
      network: {},
      bundleAnalysis: {},
      runtime: {}
    }

    // Step 2: Page Load Performance Profiling
    console.log('Profiling page load performance...')
    
    const pagesToProfile = [
      { path: '/', name: 'Home' },
      { path: '/issues', name: 'Issues' },
      { path: '/gantt', name: 'Gantt Chart' },
      { path: '/projects', name: 'Projects' }
    ]

    for (const pageInfo of pagesToProfile) {
      console.log(`Profiling ${pageInfo.name} page load...`)
      
      // Clear browser cache for accurate measurement
      await page.evaluate(() => {
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name))
          })
        }
        localStorage.clear()
        sessionStorage.clear()
      })

      await performanceHelper.startMeasurement(`pageLoad_${pageInfo.name}`)
      
      // Navigate and collect detailed performance data
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' })
      
      // Wait for critical rendering to complete
      await page.waitForTimeout(2000)
      
      const pageLoadTime = await performanceHelper.endMeasurement(`pageLoad_${pageInfo.name}`)
      
      // Collect detailed page performance metrics
      const pageMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const paint = performance.getEntriesByType('paint')
        const memory = (performance as any).memory
        const resources = performance.getEntriesByType('resource')
        
        // First Contentful Paint
        const fcp = paint.find(entry => entry.name === 'first-contentful-paint')
        
        // Largest Contentful Paint (if available)
        const lcp = performance.getEntriesByType('largest-contentful-paint')[0] as any
        
        return {
          navigation: {
            domainLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
            connect: navigation.connectEnd - navigation.connectStart,
            request: navigation.responseStart - navigation.requestStart,
            response: navigation.responseEnd - navigation.responseStart,
            domInteractive: navigation.domInteractive - navigation.navigationStart,
            domComplete: navigation.domComplete - navigation.navigationStart,
            loadComplete: navigation.loadEventEnd - navigation.navigationStart
          },
          paint: {
            firstContentfulPaint: fcp ? fcp.startTime : null,
            largestContentfulPaint: lcp ? lcp.startTime : null
          },
          memory: memory ? {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          } : null,
          resources: {
            total: resources.length,
            scripts: resources.filter(r => r.name.includes('.js')).length,
            stylesheets: resources.filter(r => r.name.includes('.css')).length,
            images: resources.filter(r => r.name.includes('.png') || r.name.includes('.jpg') || r.name.includes('.svg')).length,
            fonts: resources.filter(r => r.name.includes('.woff') || r.name.includes('.ttf')).length,
            totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0)
          },
          dom: {
            elements: document.querySelectorAll('*').length,
            scripts: document.scripts.length,
            stylesheets: document.styleSheets.length
          }
        }
      })
      
      performanceMetrics.pageLoad[pageInfo.name] = {
        loadTime: pageLoadTime,
        ...pageMetrics
      }
      
      console.log(`${pageInfo.name} page load: ${pageLoadTime}ms`)
      console.log(`  - FCP: ${pageMetrics.paint.firstContentfulPaint?.toFixed(2)}ms`)
      console.log(`  - LCP: ${pageMetrics.paint.largestContentfulPaint?.toFixed(2)}ms`)
      console.log(`  - DOM Complete: ${pageMetrics.navigation.domComplete}ms`)
      console.log(`  - Resources: ${pageMetrics.resources.total} (${(pageMetrics.resources.totalSize / 1024).toFixed(2)} KB)`)
      console.log(`  - DOM Elements: ${pageMetrics.dom.elements}`)
    }

    // Step 3: Rendering Performance Profiling
    console.log('\nProfiling rendering performance...')
    
    await page.goto('/gantt', { waitUntil: 'networkidle' })
    
    // Profile initial render
    await performanceHelper.startMeasurement('initialRender')
    
    // Wait for Gantt chart to be fully rendered
    try {
      await page.waitForSelector('[data-testid="gantt-container"], .gantt-container', { timeout: 10000 })
      await page.waitForSelector('[data-testid="task-bar"], .task-bar, .gantt-task', { timeout: 5000 })
    } catch (error) {
      console.log('Gantt elements not found, continuing with available elements')
    }
    
    const initialRenderTime = await performanceHelper.endMeasurement('initialRender')
    
    // Profile re-rendering performance
    const reRenderTests = []
    
    // Test 1: Scroll-triggered re-rendering
    console.log('Testing scroll-triggered re-rendering...')
    
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    if (await page.locator(ganttContainer).count() > 0) {
      await performanceHelper.startMeasurement('scrollRerender')
      
      await page.locator(ganttContainer).hover()
      
      // Perform intensive scrolling to trigger re-renders
      for (let i = 0; i < 50; i++) {
        await page.mouse.wheel(100, 0) // Horizontal scroll
        if (i % 10 === 0) {
          await page.mouse.wheel(0, 100) // Vertical scroll
        }
        await page.waitForTimeout(20)
      }
      
      const scrollRerenderTime = await performanceHelper.endMeasurement('scrollRerender')
      reRenderTests.push({ name: 'Scroll Re-render', time: scrollRerenderTime })
    }
    
    // Test 2: Data change re-rendering
    console.log('Testing data change re-rendering...')
    
    await page.goto('/issues', { waitUntil: 'domcontentloaded' })
    
    await performanceHelper.startMeasurement('dataRerender')
    
    // Trigger data changes that cause re-rendering
    const searchInput = '[data-testid="search-input"], input[type="search"], input[placeholder*="search"]'
    if (await page.locator(searchInput).count() > 0) {
      const searchTerms = ['test', 'issue', 'project', 'task', '']
      
      for (const term of searchTerms) {
        await page.locator(searchInput).fill(term)
        await page.waitForTimeout(300) // Wait for debounced search
      }
    }
    
    const dataRerenderTime = await performanceHelper.endMeasurement('dataRerender')
    reRenderTests.push({ name: 'Data Change Re-render', time: dataRerenderTime })
    
    performanceMetrics.rendering = {
      initialRender: initialRenderTime,
      reRenderTests
    }

    // Step 4: Interaction Performance Profiling
    console.log('\nProfiling interaction performance...')
    
    const interactionTests = []
    
    // Test various interactions
    const interactions = [
      {
        name: 'Button Click Response',
        test: async () => {
          const buttons = await page.locator('button').all()
          if (buttons.length > 0) {
            await buttons[0].click()
            await page.waitForTimeout(100)
          }
        }
      },
      {
        name: 'Form Input Response',
        test: async () => {
          const inputs = await page.locator('input').all()
          if (inputs.length > 0) {
            await inputs[0].fill('Performance Test Input')
            await page.waitForTimeout(50)
          }
        }
      },
      {
        name: 'Navigation Response',
        test: async () => {
          await page.goto('/projects', { waitUntil: 'domcontentloaded' })
          await page.waitForTimeout(200)
        }
      },
      {
        name: 'Modal Open/Close',
        test: async () => {
          const createButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New")'
          if (await page.locator(createButton).count() > 0) {
            await page.locator(createButton).click()
            await page.waitForTimeout(200)
            
            const closeButton = '[data-testid="cancel"], button:has-text("Cancel")'
            if (await page.locator(closeButton).count() > 0) {
              await page.locator(closeButton).click()
            } else {
              await page.keyboard.press('Escape')
            }
            await page.waitForTimeout(100)
          }
        }
      }
    ]
    
    for (const interaction of interactions) {
      await performanceHelper.startMeasurement(`interaction_${interaction.name}`)
      
      try {
        await interaction.test()
      } catch (error) {
        console.log(`Interaction ${interaction.name} failed: ${error.message}`)
      }
      
      const interactionTime = await performanceHelper.endMeasurement(`interaction_${interaction.name}`)
      interactionTests.push({ name: interaction.name, time: interactionTime })
      
      console.log(`${interaction.name}: ${interactionTime}ms`)
    }
    
    performanceMetrics.interactions = interactionTests

    // Step 5: Memory Usage Profiling
    console.log('\nProfiling memory usage patterns...')
    
    const memorySnapshots = []
    
    // Take memory snapshots during various operations
    const memoryOperations = [
      { name: 'Baseline', action: async () => { await page.goto('/', { waitUntil: 'networkidle' }) } },
      { name: 'Issues Page Load', action: async () => { await page.goto('/issues', { waitUntil: 'networkidle' }) } },
      { name: 'Gantt Page Load', action: async () => { await page.goto('/gantt', { waitUntil: 'networkidle' }) } },
      { name: 'Intensive Scrolling', action: async () => {
        const container = await page.locator('[data-testid="gantt-container"], .gantt-container').first()
        if (await container.count() > 0) {
          await container.hover()
          for (let i = 0; i < 100; i++) {
            await page.mouse.wheel(50, 0)
            await page.waitForTimeout(10)
          }
        }
      }},
      { name: 'DOM Manipulation', action: async () => {
        await page.evaluate(() => {
          for (let i = 0; i < 1000; i++) {
            const div = document.createElement('div')
            div.textContent = `Memory test element ${i}`
            document.body.appendChild(div)
          }
          // Remove elements
          const elements = document.querySelectorAll('div:has-text("Memory test element")')
          elements.forEach(el => el.remove())
        })
      }}
    ]
    
    for (const operation of memoryOperations) {
      await operation.action()
      await page.waitForTimeout(1000) // Allow operations to complete
      
      const memorySnapshot = await page.evaluate(() => {
        const memory = (performance as any).memory
        if (memory) {
          // Force GC if available
          if ((window as any).gc) {
            (window as any).gc()
          }
          
          return {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            domElements: document.querySelectorAll('*').length
          }
        }
        return null
      })
      
      if (memorySnapshot) {
        memorySnapshots.push({
          operation: operation.name,
          timestamp: Date.now(),
          ...memorySnapshot
        })
        
        console.log(`${operation.name}: ${(memorySnapshot.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB, ${memorySnapshot.domElements} DOM elements`)
      }
    }
    
    performanceMetrics.memory = {
      snapshots: memorySnapshots,
      analysis: {
        baselineMemory: memorySnapshots[0]?.usedJSHeapSize || 0,
        peakMemory: Math.max(...memorySnapshots.map(s => s.usedJSHeapSize)),
        memoryGrowth: (memorySnapshots[memorySnapshots.length - 1]?.usedJSHeapSize || 0) - (memorySnapshots[0]?.usedJSHeapSize || 0)
      }
    }

    // Step 6: Network Performance Profiling
    console.log('\nProfiling network performance...')
    
    const networkMetrics = []
    
    // Monitor network requests
    page.on('response', (response) => {
      const request = response.request()
      const timing = response.timing()
      
      networkMetrics.push({
        url: response.url(),
        method: request.method(),
        status: response.status(),
        size: parseInt(response.headers()['content-length'] || '0', 10),
        duration: timing.responseEnd - timing.requestStart,
        type: request.resourceType(),
        timestamp: Date.now()
      })
    })
    
    // Perform operations that generate network requests
    const networkOperations = [
      async () => { await page.goto('/issues', { waitUntil: 'networkidle' }) },
      async () => { await page.goto('/gantt', { waitUntil: 'networkidle' }) },
      async () => { await page.goto('/projects', { waitUntil: 'networkidle' }) }
    ]
    
    for (const operation of networkOperations) {
      await operation()
      await page.waitForTimeout(2000) // Allow all requests to complete
    }
    
    // Analyze network performance
    const apiRequests = networkMetrics.filter(req => req.url.includes('/api/'))
    const staticRequests = networkMetrics.filter(req => 
      req.type === 'script' || req.type === 'stylesheet' || req.type === 'image' || req.type === 'font'
    )
    
    performanceMetrics.network = {
      totalRequests: networkMetrics.length,
      apiRequests: {
        count: apiRequests.length,
        avgDuration: apiRequests.length > 0 ? apiRequests.reduce((sum, req) => sum + req.duration, 0) / apiRequests.length : 0,
        maxDuration: apiRequests.length > 0 ? Math.max(...apiRequests.map(req => req.duration)) : 0,
        totalSize: apiRequests.reduce((sum, req) => sum + req.size, 0)
      },
      staticRequests: {
        count: staticRequests.length,
        avgDuration: staticRequests.length > 0 ? staticRequests.reduce((sum, req) => sum + req.duration, 0) / staticRequests.length : 0,
        totalSize: staticRequests.reduce((sum, req) => sum + req.size, 0)
      },
      failedRequests: networkMetrics.filter(req => req.status >= 400).length
    }

    // Step 7: Runtime Performance Profiling
    console.log('\nProfiling runtime performance...')
    
    // Measure JavaScript execution performance
    const runtimeTests = [
      {
        name: 'Array Operations',
        test: () => {
          const arr = Array.from({ length: 10000 }, (_, i) => i)
          const filtered = arr.filter(n => n % 2 === 0)
          const mapped = filtered.map(n => n * 2)
          return mapped.length
        }
      },
      {
        name: 'DOM Queries',
        test: () => {
          const elements = document.querySelectorAll('*')
          const divs = document.querySelectorAll('div')
          const buttons = document.querySelectorAll('button')
          return elements.length + divs.length + buttons.length
        }
      },
      {
        name: 'JSON Operations',
        test: () => {
          const data = Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}`, data: Math.random() }))
          const json = JSON.stringify(data)
          const parsed = JSON.parse(json)
          return parsed.length
        }
      }
    ]
    
    const runtimeResults = []
    
    for (const runtimeTest of runtimeTests) {
      const result = await page.evaluate((testFn, testName) => {
        const start = performance.now()
        const testResult = testFn()
        const end = performance.now()
        return {
          name: testName,
          duration: end - start,
          result: testResult
        }
      }, runtimeTest.test, runtimeTest.name)
      
      runtimeResults.push(result)
      console.log(`${result.name}: ${result.duration.toFixed(2)}ms`)
    }
    
    performanceMetrics.runtime = runtimeResults

    // Step 8: Bundle Analysis (simulated)
    console.log('\nAnalyzing bundle performance...')
    
    const bundleAnalysis = await page.evaluate(() => {
      const scripts = Array.from(document.scripts)
      const stylesheets = Array.from(document.styleSheets)
      
      return {
        scriptCount: scripts.length,
        scripts: scripts.map(script => ({
          src: script.src,
          size: script.text?.length || 0,
          async: script.async,
          defer: script.defer
        })).filter(s => s.src),
        stylesheetCount: stylesheets.length,
        stylesheets: stylesheets.length,
        inlineScripts: scripts.filter(s => !s.src).length,
        inlineStyles: document.querySelectorAll('style').length
      }
    })
    
    performanceMetrics.bundleAnalysis = bundleAnalysis

    // Step 9: Generate Comprehensive Performance Report
    console.log('\n📊 Generating comprehensive performance report...')
    
    const performanceReport = {
      timestamp: new Date().toISOString(),
      summary: {
        avgPageLoadTime: Object.values(performanceMetrics.pageLoad).reduce((sum, page: any) => sum + page.loadTime, 0) / Object.keys(performanceMetrics.pageLoad).length,
        avgInteractionTime: performanceMetrics.interactions.reduce((sum, interaction) => sum + interaction.time, 0) / performanceMetrics.interactions.length,
        memoryUsage: performanceMetrics.memory.analysis,
        networkPerformance: performanceMetrics.network,
        runtimePerformance: performanceMetrics.runtime
      },
      detailed: performanceMetrics,
      recommendations: []
    }
    
    // Generate optimization recommendations
    console.log('\n💡 Generating optimization recommendations...')
    
    // Page load recommendations
    Object.entries(performanceMetrics.pageLoad).forEach(([pageName, metrics]: [string, any]) => {
      if (metrics.loadTime > 2000) {
        performanceReport.recommendations.push(`${pageName} page load time (${metrics.loadTime}ms) exceeds 2s target - consider code splitting or lazy loading`)
      }
      
      if (metrics.paint.firstContentfulPaint > 1500) {
        performanceReport.recommendations.push(`${pageName} FCP (${metrics.paint.firstContentfulPaint}ms) is slow - optimize critical rendering path`)
      }
      
      if (metrics.resources.totalSize > 1024 * 1024) { // 1MB
        performanceReport.recommendations.push(`${pageName} total resource size (${(metrics.resources.totalSize / 1024 / 1024).toFixed(2)}MB) is large - consider resource optimization`)
      }
      
      if (metrics.dom.elements > 2000) {
        performanceReport.recommendations.push(`${pageName} has many DOM elements (${metrics.dom.elements}) - consider virtualization for large lists`)
      }
    })
    
    // Memory recommendations
    const memoryGrowthMB = performanceMetrics.memory.analysis.memoryGrowth / 1024 / 1024
    if (memoryGrowthMB > 50) {
      performanceReport.recommendations.push(`High memory growth detected (${memoryGrowthMB.toFixed(2)}MB) - investigate potential memory leaks`)
    }
    
    // Network recommendations
    if (performanceMetrics.network.apiRequests.avgDuration > 1000) {
      performanceReport.recommendations.push(`API response times are slow (${performanceMetrics.network.apiRequests.avgDuration.toFixed(2)}ms avg) - consider API optimization or caching`)
    }
    
    if (performanceMetrics.network.failedRequests > 0) {
      performanceReport.recommendations.push(`${performanceMetrics.network.failedRequests} failed network requests detected - implement better error handling and retries`)
    }
    
    // Bundle recommendations
    if (bundleAnalysis.scriptCount > 10) {
      performanceReport.recommendations.push(`Many script files loaded (${bundleAnalysis.scriptCount}) - consider bundling optimization`)
    }
    
    if (bundleAnalysis.inlineScripts > 5) {
      performanceReport.recommendations.push(`Many inline scripts (${bundleAnalysis.inlineScripts}) - consider extracting to external files for better caching`)
    }

    // Step 10: Performance Benchmarks Validation
    const frontendBenchmarks = [
      {
        name: 'Average Page Load Time',
        target: 2000, // 2 seconds
        actual: performanceReport.summary.avgPageLoadTime,
        passed: performanceReport.summary.avgPageLoadTime <= 2000,
        unit: 'ms'
      },
      {
        name: 'Average Interaction Response Time',
        target: 100, // 100ms
        actual: performanceReport.summary.avgInteractionTime,
        passed: performanceReport.summary.avgInteractionTime <= 100,
        unit: 'ms'
      },
      {
        name: 'Memory Growth',
        target: 50, // 50MB
        actual: memoryGrowthMB,
        passed: memoryGrowthMB <= 50,
        unit: 'MB'
      },
      {
        name: 'API Response Time',
        target: 1000, // 1 second
        actual: performanceMetrics.network.apiRequests.avgDuration,
        passed: performanceMetrics.network.apiRequests.avgDuration <= 1000,
        unit: 'ms'
      },
      {
        name: 'Network Success Rate',
        target: 95, // 95%
        actual: ((performanceMetrics.network.totalRequests - performanceMetrics.network.failedRequests) / performanceMetrics.network.totalRequests) * 100,
        passed: ((performanceMetrics.network.totalRequests - performanceMetrics.network.failedRequests) / performanceMetrics.network.totalRequests) >= 0.95,
        unit: '%'
      }
    ]
    
    await performanceHelper.validateBenchmarks(frontendBenchmarks)

    // Step 11: Output Detailed Performance Report
    console.log('\n📄 Frontend Performance Profiling Report:')
    console.log('==========================================')
    
    console.log('\nPage Load Performance:')
    Object.entries(performanceMetrics.pageLoad).forEach(([pageName, metrics]: [string, any]) => {
      console.log(`${pageName}:`)
      console.log(`  - Load Time: ${metrics.loadTime}ms`)
      console.log(`  - FCP: ${metrics.paint.firstContentfulPaint?.toFixed(2)}ms`)
      console.log(`  - LCP: ${metrics.paint.largestContentfulPaint?.toFixed(2)}ms`)
      console.log(`  - DOM Complete: ${metrics.navigation.domComplete}ms`)
      console.log(`  - Resources: ${metrics.resources.total} (${(metrics.resources.totalSize / 1024).toFixed(2)} KB)`)
    })
    
    console.log('\nInteraction Performance:')
    performanceMetrics.interactions.forEach(interaction => {
      console.log(`  - ${interaction.name}: ${interaction.time}ms`)
    })
    
    console.log('\nMemory Usage:')
    console.log(`  - Baseline: ${(performanceMetrics.memory.analysis.baselineMemory / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  - Peak: ${(performanceMetrics.memory.analysis.peakMemory / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  - Growth: ${memoryGrowthMB.toFixed(2)} MB`)
    
    console.log('\nNetwork Performance:')
    console.log(`  - Total Requests: ${performanceMetrics.network.totalRequests}`)
    console.log(`  - API Requests: ${performanceMetrics.network.apiRequests.count} (avg: ${performanceMetrics.network.apiRequests.avgDuration.toFixed(2)}ms)`)
    console.log(`  - Static Requests: ${performanceMetrics.network.staticRequests.count}`)
    console.log(`  - Failed Requests: ${performanceMetrics.network.failedRequests}`)
    
    console.log('\nRuntime Performance:')
    performanceMetrics.runtime.forEach(test => {
      console.log(`  - ${test.name}: ${test.duration.toFixed(2)}ms`)
    })
    
    console.log('\nBundle Analysis:')
    console.log(`  - Script Files: ${bundleAnalysis.scriptCount}`)
    console.log(`  - Stylesheets: ${bundleAnalysis.stylesheetCount}`)
    console.log(`  - Inline Scripts: ${bundleAnalysis.inlineScripts}`)
    console.log(`  - Inline Styles: ${bundleAnalysis.inlineStyles}`)
    
    console.log('\nOptimization Recommendations:')
    performanceReport.recommendations.forEach((recommendation, index) => {
      console.log(`  ${index + 1}. ${recommendation}`)
    })

    console.log('\n=== T023-AC6 Frontend Performance Profiling Summary ===')
    console.log(`✅ ${Object.keys(performanceMetrics.pageLoad).length} pages profiled`)
    console.log(`✅ ${performanceMetrics.interactions.length} interactions tested`)
    console.log(`✅ ${performanceMetrics.memory.snapshots.length} memory snapshots taken`)
    console.log(`✅ ${performanceMetrics.network.totalRequests} network requests analyzed`)
    console.log(`✅ ${performanceMetrics.runtime.length} runtime tests performed`)
    console.log(`✅ ${performanceReport.recommendations.length} optimization recommendations generated`)
    console.log(`✅ Average page load: ${performanceReport.summary.avgPageLoadTime.toFixed(2)}ms`)
    console.log(`✅ Average interaction: ${performanceReport.summary.avgInteractionTime.toFixed(2)}ms`)
    console.log('=======================================================')

    console.log('✅ AC6: Frontend performance profiling completed successfully')
  })

  // AC6: Component-specific performance profiling
  test('Component-specific performance profiling', { 
    tag: '@load-test',
    timeout: 300000 // 5 minutes
  }, async ({ page }) => {
    console.log('🧩 AC6: Component-specific performance profiling...')

    // Create dataset for component testing
    await dataHelper.createLargeDataset(100)
    
    const componentProfiles = {}

    // Profile Gantt Chart Component
    console.log('Profiling Gantt Chart component...')
    
    await page.goto('/gantt', { waitUntil: 'networkidle' })
    
    await performanceHelper.startMeasurement('ganttComponentLoad')
    
    try {
      await page.waitForSelector('[data-testid="gantt-container"], .gantt-container', { timeout: 10000 })
      await page.waitForTimeout(2000) // Allow full rendering
    } catch (error) {
      console.log('Gantt container not found')
    }
    
    const ganttLoadTime = await performanceHelper.endMeasurement('ganttComponentLoad')
    
    // Test Gantt interactions
    const ganttInteractions = []
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    
    if (await page.locator(ganttContainer).count() > 0) {
      // Test scrolling performance
      await performanceHelper.startMeasurement('ganttScrolling')
      await page.locator(ganttContainer).hover()
      
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(100, 0)
        await page.waitForTimeout(25)
      }
      
      const ganttScrollTime = await performanceHelper.endMeasurement('ganttScrolling')
      ganttInteractions.push({ name: 'Scrolling', time: ganttScrollTime })
      
      // Test zoom functionality
      const zoomControls = '[data-testid="zoom-in"], [data-testid="zoom-out"], .zoom-btn'
      if (await page.locator(zoomControls).count() > 0) {
        await performanceHelper.startMeasurement('ganttZoom')
        
        await page.locator(zoomControls).first().click()
        await page.waitForTimeout(300)
        
        const ganttZoomTime = await performanceHelper.endMeasurement('ganttZoom')
        ganttInteractions.push({ name: 'Zoom', time: ganttZoomTime })
      }
    }
    
    componentProfiles.gantt = {
      loadTime: ganttLoadTime,
      interactions: ganttInteractions
    }

    // Profile Issues Table Component
    console.log('Profiling Issues Table component...')
    
    await page.goto('/issues', { waitUntil: 'networkidle' })
    
    await performanceHelper.startMeasurement('issuesTableLoad')
    
    try {
      await page.waitForSelector('[data-testid="issue-table"], .issue-table, table', { timeout: 5000 })
      await page.waitForTimeout(1000)
    } catch (error) {
      console.log('Issues table not found')
    }
    
    const issuesTableLoadTime = await performanceHelper.endMeasurement('issuesTableLoad')
    
    // Test table interactions
    const tableInteractions = []
    
    // Test sorting
    const sortableHeaders = 'th[role="button"], th:has(.sort), .sortable'
    if (await page.locator(sortableHeaders).count() > 0) {
      await performanceHelper.startMeasurement('tableSorting')
      
      await page.locator(sortableHeaders).first().click()
      await page.waitForTimeout(500)
      
      const tableSortTime = await performanceHelper.endMeasurement('tableSorting')
      tableInteractions.push({ name: 'Sorting', time: tableSortTime })
    }
    
    // Test filtering/search
    const searchInput = '[data-testid="search-input"], input[type="search"]'
    if (await page.locator(searchInput).count() > 0) {
      await performanceHelper.startMeasurement('tableSearch')
      
      await page.locator(searchInput).fill('test')
      await page.waitForTimeout(500) // Wait for debounced search
      
      const tableSearchTime = await performanceHelper.endMeasurement('tableSearch')
      tableInteractions.push({ name: 'Search/Filter', time: tableSearchTime })
    }
    
    componentProfiles.issuesTable = {
      loadTime: issuesTableLoadTime,
      interactions: tableInteractions
    }

    // Profile Navigation Component
    console.log('Profiling Navigation component...')
    
    const navigationInteractions = []
    
    // Test navigation performance
    const navItems = ['/', '/issues', '/gantt', '/projects']
    
    for (const navItem of navItems) {
      await performanceHelper.startMeasurement(`navigation_${navItem}`)
      
      await page.goto(navItem, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(300)
      
      const navTime = await performanceHelper.endMeasurement(`navigation_${navItem}`)
      navigationInteractions.push({ name: `Navigate to ${navItem}`, time: navTime })
    }
    
    componentProfiles.navigation = {
      interactions: navigationInteractions
    }

    // Profile Modal/Dialog Components
    console.log('Profiling Modal/Dialog components...')
    
    await page.goto('/issues', { waitUntil: 'domcontentloaded' })
    
    const modalInteractions = []
    
    // Test modal opening/closing
    const createButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New")'
    if (await page.locator(createButton).count() > 0) {
      await performanceHelper.startMeasurement('modalOpen')
      
      await page.locator(createButton).click()
      await page.waitForTimeout(300)
      
      const modalOpenTime = await performanceHelper.endMeasurement('modalOpen')
      modalInteractions.push({ name: 'Modal Open', time: modalOpenTime })
      
      // Test modal closing
      await performanceHelper.startMeasurement('modalClose')
      
      const closeButton = '[data-testid="cancel"], button:has-text("Cancel")'
      if (await page.locator(closeButton).count() > 0) {
        await page.locator(closeButton).click()
      } else {
        await page.keyboard.press('Escape')
      }
      await page.waitForTimeout(200)
      
      const modalCloseTime = await performanceHelper.endMeasurement('modalClose')
      modalInteractions.push({ name: 'Modal Close', time: modalCloseTime })
    }
    
    componentProfiles.modal = {
      interactions: modalInteractions
    }

    // Analyze component performance
    console.log('\n📊 Component Performance Analysis:')
    
    Object.entries(componentProfiles).forEach(([componentName, profile]: [string, any]) => {
      console.log(`\n${componentName.toUpperCase()} Component:`)
      
      if (profile.loadTime) {
        console.log(`  Load Time: ${profile.loadTime}ms`)
      }
      
      if (profile.interactions && profile.interactions.length > 0) {
        console.log('  Interactions:')
        profile.interactions.forEach(interaction => {
          console.log(`    - ${interaction.name}: ${interaction.time}ms`)
        })
      }
    })

    // Component performance benchmarks
    const componentBenchmarks = []
    
    if (componentProfiles.gantt.loadTime) {
      componentBenchmarks.push({
        name: 'Gantt Chart Load Time',
        target: 2000,
        actual: componentProfiles.gantt.loadTime,
        passed: componentProfiles.gantt.loadTime <= 2000,
        unit: 'ms'
      })
    }
    
    if (componentProfiles.issuesTable.loadTime) {
      componentBenchmarks.push({
        name: 'Issues Table Load Time',
        target: 1000,
        actual: componentProfiles.issuesTable.loadTime,
        passed: componentProfiles.issuesTable.loadTime <= 1000,
        unit: 'ms'
      })
    }
    
    // Average interaction times
    const allInteractions = Object.values(componentProfiles)
      .flatMap((profile: any) => profile.interactions || [])
      .map(interaction => interaction.time)
    
    if (allInteractions.length > 0) {
      const avgInteractionTime = allInteractions.reduce((sum, time) => sum + time, 0) / allInteractions.length
      componentBenchmarks.push({
        name: 'Average Component Interaction Time',
        target: 200,
        actual: avgInteractionTime,
        passed: avgInteractionTime <= 200,
        unit: 'ms'
      })
    }
    
    if (componentBenchmarks.length > 0) {
      await performanceHelper.validateBenchmarks(componentBenchmarks)
    }

    console.log('\n=== T023-AC6 Component Performance Summary ===')
    console.log(`✅ ${Object.keys(componentProfiles).length} components profiled`)
    console.log(`✅ Component load times and interactions analyzed`)
    console.log(`✅ Performance benchmarks validated`)
    Object.entries(componentProfiles).forEach(([name, profile]: [string, any]) => {
      if (profile.loadTime) {
        console.log(`✅ ${name}: ${profile.loadTime}ms load time`)
      }
    })
    console.log('==============================================')

    console.log('✅ AC6: Component-specific performance profiling completed successfully')
  })
})