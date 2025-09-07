import { test, expect } from '@playwright/test'
import { UIHelper } from '../helpers/ui-helper'
import { DataHelper } from '../helpers/data-helper'
import { AuthHelper } from '../helpers/auth-helper'
import { PerformanceHelper } from '../helpers/performance-helper'
import * as fs from 'fs'
import * as path from 'path'

/**
 * T023-AC7: Automated Performance Reports
 * Generate actionable recommendations for system improvements
 */
test.describe('Automated Performance Reports (AC7)', () => {
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

  // AC7: Comprehensive automated performance report generation
  test('Comprehensive automated performance report generation', { 
    tag: '@load-test',
    timeout: 900000 // 15 minutes for comprehensive testing
  }, async ({ page }) => {
    console.log('📊 AC7: Generating comprehensive automated performance report...')

    // Step 1: Initialize performance tracking
    const performanceReport = {
      metadata: {
        timestamp: new Date().toISOString(),
        testDuration: 0,
        environment: {
          userAgent: await page.evaluate(() => navigator.userAgent),
          viewport: await page.viewportSize(),
          url: page.url()
        }
      },
      executive_summary: {},
      detailed_metrics: {
        page_load: {},
        user_interactions: {},
        network_performance: {},
        memory_analysis: {},
        api_performance: {},
        database_performance: {},
        scalability_analysis: {},
        error_handling: {}
      },
      benchmarks: {
        passed: [],
        failed: [],
        warnings: []
      },
      recommendations: {
        critical: [],
        high: [],
        medium: [],
        low: []
      },
      trend_analysis: {},
      action_items: []
    }

    const startTime = Date.now()

    // Step 2: Create comprehensive test dataset
    console.log('Creating comprehensive test dataset...')
    await dataHelper.createLargeDataset(300) // Substantial dataset for comprehensive testing

    // Step 3: Page Load Performance Analysis
    console.log('Analyzing page load performance...')
    
    const pagesToTest = [
      { path: '/', name: 'Home', critical: true },
      { path: '/issues', name: 'Issues', critical: true },
      { path: '/gantt', name: 'Gantt Chart', critical: true },
      { path: '/projects', name: 'Projects', critical: false }
    ]

    const pageLoadMetrics = {}
    
    for (const pageInfo of pagesToTest) {
      console.log(`Testing ${pageInfo.name} page...`)
      
      // Clear cache for accurate measurement
      await page.evaluate(() => {
        if ('caches' in window) {
          caches.keys().then(names => names.forEach(name => caches.delete(name)))
        }
        localStorage.clear()
        sessionStorage.clear()
      })

      await performanceHelper.startMeasurement(`pageLoad_${pageInfo.name}`)
      
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(2000) // Allow complete rendering
      
      const loadTime = await performanceHelper.endMeasurement(`pageLoad_${pageInfo.name}`)
      
      // Collect detailed metrics
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        const paint = performance.getEntriesByType('paint')
        const memory = (performance as any).memory
        const lcp = performance.getEntriesByType('largest-contentful-paint')[0] as any
        
        return {
          navigation: {
            dns: navigation.domainLookupEnd - navigation.domainLookupStart,
            connect: navigation.connectEnd - navigation.connectStart,
            ttfb: navigation.responseStart - navigation.requestStart,
            download: navigation.responseEnd - navigation.responseStart,
            domInteractive: navigation.domInteractive - navigation.navigationStart,
            domComplete: navigation.domComplete - navigation.navigationStart,
            loadComplete: navigation.loadEventEnd - navigation.navigationStart
          },
          paint: {
            fcp: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || null,
            lcp: lcp?.startTime || null
          },
          memory: memory ? {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit
          } : null,
          dom: {
            elements: document.querySelectorAll('*').length,
            scripts: document.scripts.length,
            stylesheets: document.styleSheets.length
          }
        }
      })
      
      pageLoadMetrics[pageInfo.name] = {
        ...pageInfo,
        loadTime,
        ...metrics,
        score: calculatePageLoadScore(loadTime, metrics)
      }
    }
    
    performanceReport.detailed_metrics.page_load = pageLoadMetrics

    // Step 4: User Interaction Performance Analysis
    console.log('Analyzing user interaction performance...')
    
    const interactionMetrics = []
    
    // Test various user interactions
    const interactions = [
      {
        name: 'Navigation Click',
        critical: true,
        test: async () => {
          await page.click('a[href="/issues"], nav a:first-child')
          await page.waitForTimeout(300)
        }
      },
      {
        name: 'Search Input',
        critical: true,
        test: async () => {
          const searchInput = '[data-testid="search-input"], input[type="search"]'
          if (await page.locator(searchInput).count() > 0) {
            await page.locator(searchInput).fill('performance test')
            await page.waitForTimeout(500)
            await page.locator(searchInput).fill('')
          }
        }
      },
      {
        name: 'Create Issue Modal',
        critical: true,
        test: async () => {
          const createBtn = '[data-testid="create-issue"], button:has-text("New")'
          if (await page.locator(createBtn).count() > 0) {
            await page.locator(createBtn).click()
            await page.waitForTimeout(300)
            await page.keyboard.press('Escape')
          }
        }
      },
      {
        name: 'Gantt Chart Scroll',
        critical: false,
        test: async () => {
          await page.goto('/gantt', { waitUntil: 'domcontentloaded' })
          const container = '[data-testid="gantt-container"], .gantt-container'
          if (await page.locator(container).count() > 0) {
            await page.locator(container).hover()
            for (let i = 0; i < 10; i++) {
              await page.mouse.wheel(100, 0)
              await page.waitForTimeout(50)
            }
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
      
      interactionMetrics.push({
        name: interaction.name,
        critical: interaction.critical,
        responseTime: interactionTime,
        score: calculateInteractionScore(interactionTime, interaction.critical)
      })
    }
    
    performanceReport.detailed_metrics.user_interactions = interactionMetrics

    // Step 5: Network Performance Analysis
    console.log('Analyzing network performance...')
    
    const networkMetrics = []
    
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
    
    // Navigate through pages to collect network data
    for (const pageInfo of pagesToTest) {
      await page.goto(pageInfo.path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)
    }
    
    const apiRequests = networkMetrics.filter(req => req.url.includes('/api/'))
    const staticRequests = networkMetrics.filter(req => 
      req.type === 'script' || req.type === 'stylesheet' || req.type === 'image'
    )
    
    performanceReport.detailed_metrics.network_performance = {
      total_requests: networkMetrics.length,
      api_requests: analyzeRequests(apiRequests),
      static_requests: analyzeRequests(staticRequests),
      failed_requests: networkMetrics.filter(req => req.status >= 400),
      score: calculateNetworkScore(networkMetrics)
    }

    // Step 6: Memory Analysis
    console.log('Analyzing memory usage patterns...')
    
    const memorySnapshots = []
    
    const memoryOperations = [
      { name: 'Baseline', action: async () => await page.goto('/', { waitUntil: 'networkidle' }) },
      { name: 'Issues Load', action: async () => await page.goto('/issues', { waitUntil: 'networkidle' }) },
      { name: 'Gantt Load', action: async () => await page.goto('/gantt', { waitUntil: 'networkidle' }) },
      { name: 'Heavy Scrolling', action: async () => {
        const container = await page.locator('body').first()
        for (let i = 0; i < 50; i++) {
          await page.mouse.wheel(0, 200)
          await page.waitForTimeout(20)
        }
      }},
      { name: 'DOM Manipulation', action: async () => {
        await page.evaluate(() => {
          for (let i = 0; i < 500; i++) {
            const div = document.createElement('div')
            div.innerHTML = `Test element ${i}`
            document.body.appendChild(div)
          }
          // Clean up
          document.querySelectorAll('div:has-text("Test element")').forEach(el => el.remove())
        })
      }}
    ]
    
    for (const operation of memoryOperations) {
      await operation.action()
      await page.waitForTimeout(1000)
      
      const memorySnapshot = await page.evaluate(() => {
        const memory = (performance as any).memory
        if (memory && (window as any).gc) {
          (window as any).gc()
        }
        return memory ? {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          domElements: document.querySelectorAll('*').length
        } : null
      })
      
      if (memorySnapshot) {
        memorySnapshots.push({
          operation: operation.name,
          timestamp: Date.now(),
          ...memorySnapshot
        })
      }
    }
    
    performanceReport.detailed_metrics.memory_analysis = {
      snapshots: memorySnapshots,
      analysis: analyzeMemoryUsage(memorySnapshots),
      score: calculateMemoryScore(memorySnapshots)
    }

    // Step 7: API Performance Testing
    console.log('Testing API performance under load...')
    
    const apiTestResults = await performAPIConcurrencyTest(page, 25) // Test with 25 concurrent requests
    
    performanceReport.detailed_metrics.api_performance = {
      ...apiTestResults,
      score: calculateAPIScore(apiTestResults)
    }

    // Step 8: Scalability Analysis
    console.log('Performing scalability analysis...')
    
    const scalabilityResults = await performScalabilityTest(page, [5, 10, 15]) // Test with increasing load
    
    performanceReport.detailed_metrics.scalability_analysis = {
      results: scalabilityResults,
      score: calculateScalabilityScore(scalabilityResults)
    }

    // Step 9: Error Handling Analysis
    console.log('Analyzing error handling performance...')
    
    const errorHandlingResults = await testErrorHandlingPerformance(page)
    
    performanceReport.detailed_metrics.error_handling = {
      ...errorHandlingResults,
      score: calculateErrorHandlingScore(errorHandlingResults)
    }

    // Step 10: Generate Executive Summary
    console.log('Generating executive summary...')
    
    const overallScore = calculateOverallScore(performanceReport.detailed_metrics)
    
    performanceReport.executive_summary = {
      overall_score: overallScore,
      grade: getPerformanceGrade(overallScore),
      critical_issues: getCriticalIssues(performanceReport.detailed_metrics),
      key_metrics: {
        avg_page_load: Object.values(pageLoadMetrics).reduce((sum, page: any) => sum + page.loadTime, 0) / Object.values(pageLoadMetrics).length,
        avg_interaction_time: interactionMetrics.reduce((sum, i) => sum + i.responseTime, 0) / interactionMetrics.length,
        api_success_rate: apiTestResults.success_rate,
        memory_efficiency: performanceReport.detailed_metrics.memory_analysis.score
      },
      performance_trend: 'N/A - Single test run', // Would be populated with historical data
      recommendation_count: 0 // Will be updated after recommendations generation
    }

    // Step 11: Generate Benchmarks Results
    console.log('Processing performance benchmarks...')
    
    const benchmarks = generateBenchmarks(performanceReport.detailed_metrics)
    performanceReport.benchmarks = benchmarks

    // Step 12: Generate Actionable Recommendations
    console.log('Generating actionable recommendations...')
    
    const recommendations = generateRecommendations(performanceReport.detailed_metrics, benchmarks)
    performanceReport.recommendations = recommendations
    performanceReport.executive_summary.recommendation_count = 
      recommendations.critical.length + recommendations.high.length + recommendations.medium.length + recommendations.low.length

    // Step 13: Generate Action Items
    console.log('Creating prioritized action items...')
    
    performanceReport.action_items = generateActionItems(recommendations, performanceReport.detailed_metrics)

    // Step 14: Calculate test duration
    const endTime = Date.now()
    performanceReport.metadata.testDuration = endTime - startTime

    // Step 15: Save Performance Report
    console.log('Saving performance report...')
    
    const reportPath = await savePerformanceReport(performanceReport)
    
    // Step 16: Generate and Display Summary
    console.log('\n📊 AUTOMATED PERFORMANCE REPORT SUMMARY')
    console.log('==========================================')
    console.log(`Report Generated: ${performanceReport.metadata.timestamp}`)
    console.log(`Test Duration: ${(performanceReport.metadata.testDuration / 1000).toFixed(2)} seconds`)
    console.log(`Overall Performance Score: ${overallScore}/100`)
    console.log(`Performance Grade: ${performanceReport.executive_summary.grade}`)
    
    console.log('\n📈 KEY METRICS:')
    console.log(`- Average Page Load Time: ${performanceReport.executive_summary.key_metrics.avg_page_load.toFixed(2)}ms`)
    console.log(`- Average Interaction Time: ${performanceReport.executive_summary.key_metrics.avg_interaction_time.toFixed(2)}ms`)
    console.log(`- API Success Rate: ${(performanceReport.executive_summary.key_metrics.api_success_rate * 100).toFixed(1)}%`)
    console.log(`- Memory Efficiency Score: ${performanceReport.detailed_metrics.memory_analysis.score}/100`)
    
    console.log('\n🎯 BENCHMARKS SUMMARY:')
    console.log(`- Passed: ${benchmarks.passed.length}`)
    console.log(`- Failed: ${benchmarks.failed.length}`)
    console.log(`- Warnings: ${benchmarks.warnings.length}`)
    
    console.log('\n💡 RECOMMENDATIONS SUMMARY:')
    console.log(`- Critical: ${recommendations.critical.length}`)
    console.log(`- High Priority: ${recommendations.high.length}`)
    console.log(`- Medium Priority: ${recommendations.medium.length}`)
    console.log(`- Low Priority: ${recommendations.low.length}`)
    
    if (recommendations.critical.length > 0) {
      console.log('\n🚨 CRITICAL RECOMMENDATIONS:')
      recommendations.critical.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.title}: ${rec.description}`)
      })
    }
    
    if (recommendations.high.length > 0) {
      console.log('\n⚠️  HIGH PRIORITY RECOMMENDATIONS:')
      recommendations.high.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.title}: ${rec.description}`)
      })
    }
    
    console.log('\n📋 TOP 5 ACTION ITEMS:')
    performanceReport.action_items.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. [${item.priority}] ${item.task} (Est. Impact: ${item.estimated_impact})`)
    })
    
    console.log(`\n📄 Full Report Saved: ${reportPath}`)
    console.log('\n=== T023-AC7 Automated Performance Report Summary ===')
    console.log(`✅ Comprehensive performance analysis completed`)
    console.log(`✅ ${Object.keys(pageLoadMetrics).length} pages analyzed`)
    console.log(`✅ ${interactionMetrics.length} user interactions tested`)
    console.log(`✅ ${networkMetrics.length} network requests analyzed`)
    console.log(`✅ ${memorySnapshots.length} memory snapshots taken`)
    console.log(`✅ ${apiTestResults.total_requests} API requests tested`)
    console.log(`✅ ${benchmarks.passed.length + benchmarks.failed.length + benchmarks.warnings.length} benchmarks evaluated`)
    console.log(`✅ ${performanceReport.action_items.length} actionable items generated`)
    console.log(`✅ Overall Performance Score: ${overallScore}/100 (${performanceReport.executive_summary.grade})`)
    console.log('======================================================')

    // Assertions for test validation
    expect(overallScore, 'Overall performance score should be reasonable').toBeGreaterThan(60)
    expect(benchmarks.failed.length, 'Failed benchmarks should be minimal').toBeLessThan(5)
    expect(performanceReport.action_items.length, 'Should generate actionable recommendations').toBeGreaterThan(0)

    console.log('✅ AC7: Automated performance report generation completed successfully')
  })

  // Helper functions for performance analysis
  
  async function performAPIConcurrencyTest(page: any, concurrentRequests: number) {
    const promises = []
    
    for (let i = 0; i < concurrentRequests; i++) {
      const promise = page.evaluate(async (requestId) => {
        const start = performance.now()
        try {
          const response = await fetch(`/api/issues?limit=10&page=${requestId % 5 + 1}`)
          const end = performance.now()
          return {
            success: response.ok,
            duration: end - start,
            status: response.status
          }
        } catch (error) {
          return {
            success: false,
            duration: performance.now() - start,
            error: error.message
          }
        }
      }, i)
      
      promises.push(promise)
    }
    
    const results = await Promise.all(promises)
    const successful = results.filter(r => r.success)
    
    return {
      total_requests: concurrentRequests,
      successful_requests: successful.length,
      failed_requests: results.length - successful.length,
      success_rate: successful.length / results.length,
      avg_response_time: successful.length > 0 ? successful.reduce((sum, r) => sum + r.duration, 0) / successful.length : 0,
      max_response_time: successful.length > 0 ? Math.max(...successful.map(r => r.duration)) : 0
    }
  }
  
  async function performScalabilityTest(page: any, loadLevels: number[]) {
    const results = []
    
    for (const load of loadLevels) {
      const result = await performAPIConcurrencyTest(page, load)
      results.push({
        load_level: load,
        ...result
      })
    }
    
    return results
  }
  
  async function testErrorHandlingPerformance(page: any) {
    const errorTests = [
      { name: '404 Handling', url: '/api/nonexistent', expectedStatus: 404 },
      { name: 'Invalid JSON', method: 'POST', url: '/api/issues', body: '{invalid json}', expectedStatus: 400 },
      { name: 'Server Error Recovery', url: '/api/issues/999999', expectedStatus: 404 }
    ]
    
    const results = []
    
    for (const test of errorTests) {
      const result = await page.evaluate(async ({ test }) => {
        const start = performance.now()
        try {
          const response = await fetch(test.url, {
            method: test.method || 'GET',
            body: test.body,
            headers: test.body ? { 'Content-Type': 'application/json' } : {}
          })
          const end = performance.now()
          
          return {
            name: test.name,
            properly_handled: response.status === test.expectedStatus,
            response_time: end - start,
            status: response.status
          }
        } catch (error) {
          return {
            name: test.name,
            properly_handled: false,
            response_time: performance.now() - start,
            error: error.message
          }
        }
      }, { test })
      
      results.push(result)
    }
    
    return {
      tests: results,
      success_rate: results.filter(r => r.properly_handled).length / results.length,
      avg_error_response_time: results.reduce((sum, r) => sum + r.response_time, 0) / results.length
    }
  }

  function calculatePageLoadScore(loadTime: number, metrics: any): number {
    let score = 100
    
    // Penalize slow load times
    if (loadTime > 3000) score -= 30
    else if (loadTime > 2000) score -= 20
    else if (loadTime > 1000) score -= 10
    
    // Penalize slow FCP
    if (metrics.paint.fcp > 2000) score -= 20
    else if (metrics.paint.fcp > 1500) score -= 10
    
    // Penalize large DOM
    if (metrics.dom.elements > 3000) score -= 15
    else if (metrics.dom.elements > 2000) score -= 10
    
    return Math.max(0, score)
  }
  
  function calculateInteractionScore(responseTime: number, critical: boolean): number {
    let score = 100
    const threshold = critical ? 100 : 200
    
    if (responseTime > threshold * 3) score -= 40
    else if (responseTime > threshold * 2) score -= 30
    else if (responseTime > threshold) score -= 20
    
    return Math.max(0, score)
  }
  
  function calculateNetworkScore(requests: any[]): number {
    const apiRequests = requests.filter(req => req.url.includes('/api/'))
    const failedRequests = requests.filter(req => req.status >= 400)
    
    let score = 100
    
    // Penalize high failure rate
    const failureRate = failedRequests.length / requests.length
    if (failureRate > 0.1) score -= 40
    else if (failureRate > 0.05) score -= 20
    
    // Penalize slow API responses
    if (apiRequests.length > 0) {
      const avgApiTime = apiRequests.reduce((sum, req) => sum + req.duration, 0) / apiRequests.length
      if (avgApiTime > 2000) score -= 30
      else if (avgApiTime > 1000) score -= 15
    }
    
    return Math.max(0, score)
  }
  
  function calculateMemoryScore(snapshots: any[]): number {
    if (snapshots.length < 2) return 50
    
    const baseline = snapshots[0].used
    const final = snapshots[snapshots.length - 1].used
    const growth = (final - baseline) / baseline * 100
    
    let score = 100
    
    if (growth > 100) score -= 40 // 100% growth is concerning
    else if (growth > 50) score -= 25
    else if (growth > 25) score -= 15
    
    // Check for excessive memory usage
    const maxUsage = Math.max(...snapshots.map(s => s.used))
    if (maxUsage > 150 * 1024 * 1024) score -= 20 // > 150MB
    else if (maxUsage > 100 * 1024 * 1024) score -= 10 // > 100MB
    
    return Math.max(0, score)
  }
  
  function calculateAPIScore(apiResults: any): number {
    let score = 100
    
    if (apiResults.success_rate < 0.9) score -= 40
    else if (apiResults.success_rate < 0.95) score -= 20
    
    if (apiResults.avg_response_time > 2000) score -= 30
    else if (apiResults.avg_response_time > 1000) score -= 15
    
    return Math.max(0, score)
  }
  
  function calculateScalabilityScore(results: any[]): number {
    if (results.length < 2) return 50
    
    // Check if performance degrades significantly with load
    const firstResult = results[0]
    const lastResult = results[results.length - 1]
    
    const responseTimeDegradation = (lastResult.avg_response_time - firstResult.avg_response_time) / firstResult.avg_response_time
    const successRateDegradation = firstResult.success_rate - lastResult.success_rate
    
    let score = 100
    
    if (responseTimeDegradation > 2) score -= 40 // 200% increase
    else if (responseTimeDegradation > 1) score -= 25 // 100% increase
    else if (responseTimeDegradation > 0.5) score -= 15 // 50% increase
    
    if (successRateDegradation > 0.1) score -= 30 // 10% drop
    else if (successRateDegradation > 0.05) score -= 15 // 5% drop
    
    return Math.max(0, score)
  }
  
  function calculateErrorHandlingScore(errorResults: any): number {
    let score = 100
    
    if (errorResults.success_rate < 0.8) score -= 40
    else if (errorResults.success_rate < 0.9) score -= 20
    
    if (errorResults.avg_error_response_time > 1000) score -= 20
    else if (errorResults.avg_error_response_time > 500) score -= 10
    
    return Math.max(0, score)
  }
  
  function calculateOverallScore(metrics: any): number {
    const scores = [
      metrics.page_load ? Object.values(metrics.page_load).reduce((sum: number, page: any) => sum + page.score, 0) / Object.values(metrics.page_load).length : 70,
      metrics.user_interactions ? metrics.user_interactions.reduce((sum: number, interaction: any) => sum + interaction.score, 0) / metrics.user_interactions.length : 70,
      metrics.network_performance?.score || 70,
      metrics.memory_analysis?.score || 70,
      metrics.api_performance?.score || 70,
      metrics.scalability_analysis?.score || 70,
      metrics.error_handling?.score || 70
    ]
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
  }
  
  function getPerformanceGrade(score: number): string {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }
  
  function getCriticalIssues(metrics: any): string[] {
    const issues = []
    
    // Check for critical page load issues
    if (metrics.page_load) {
      Object.entries(metrics.page_load).forEach(([pageName, page]: [string, any]) => {
        if (page.loadTime > 3000) {
          issues.push(`${pageName} page load time exceeds 3 seconds (${page.loadTime}ms)`)
        }
        if (page.score < 50) {
          issues.push(`${pageName} page has critically low performance score (${page.score}/100)`)
        }
      })
    }
    
    // Check for API issues
    if (metrics.api_performance?.success_rate < 0.9) {
      issues.push(`API success rate is below 90% (${(metrics.api_performance.success_rate * 100).toFixed(1)}%)`)
    }
    
    // Check for memory issues
    if (metrics.memory_analysis?.score < 50) {
      issues.push('Critical memory usage patterns detected')
    }
    
    return issues
  }
  
  function analyzeRequests(requests: any[]): any {
    if (requests.length === 0) return { count: 0, avg_duration: 0, total_size: 0 }
    
    return {
      count: requests.length,
      avg_duration: requests.reduce((sum, req) => sum + req.duration, 0) / requests.length,
      max_duration: Math.max(...requests.map(req => req.duration)),
      total_size: requests.reduce((sum, req) => sum + req.size, 0),
      status_codes: requests.reduce((acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1
        return acc
      }, {})
    }
  }
  
  function analyzeMemoryUsage(snapshots: any[]): any {
    if (snapshots.length === 0) return {}
    
    const baseline = snapshots[0].used
    const peak = Math.max(...snapshots.map(s => s.used))
    const final = snapshots[snapshots.length - 1].used
    
    return {
      baseline_mb: baseline / 1024 / 1024,
      peak_mb: peak / 1024 / 1024,
      final_mb: final / 1024 / 1024,
      growth_mb: (final - baseline) / 1024 / 1024,
      growth_percent: ((final - baseline) / baseline) * 100,
      peak_increase_percent: ((peak - baseline) / baseline) * 100
    }
  }
  
  function generateBenchmarks(metrics: any): any {
    const passed = []
    const failed = []
    const warnings = []
    
    // Page load benchmarks
    if (metrics.page_load) {
      Object.entries(metrics.page_load).forEach(([pageName, page]: [string, any]) => {
        const benchmark = {
          category: 'Page Load',
          test: `${pageName} Load Time`,
          target: page.critical ? 1500 : 2000,
          actual: page.loadTime,
          unit: 'ms'
        }
        
        if (page.loadTime <= benchmark.target) {
          passed.push(benchmark)
        } else if (page.loadTime <= benchmark.target * 1.5) {
          warnings.push({...benchmark, status: 'warning'})
        } else {
          failed.push({...benchmark, status: 'failed'})
        }
      })
    }
    
    // API benchmarks
    if (metrics.api_performance) {
      const apiBenchmarks = [
        {
          category: 'API Performance',
          test: 'API Success Rate',
          target: 95,
          actual: metrics.api_performance.success_rate * 100,
          unit: '%'
        },
        {
          category: 'API Performance',
          test: 'Average API Response Time',
          target: 1000,
          actual: metrics.api_performance.avg_response_time,
          unit: 'ms'
        }
      ]
      
      apiBenchmarks.forEach(benchmark => {
        if (benchmark.test === 'API Success Rate') {
          if (benchmark.actual >= benchmark.target) {
            passed.push(benchmark)
          } else if (benchmark.actual >= benchmark.target * 0.9) {
            warnings.push({...benchmark, status: 'warning'})
          } else {
            failed.push({...benchmark, status: 'failed'})
          }
        } else {
          if (benchmark.actual <= benchmark.target) {
            passed.push(benchmark)
          } else if (benchmark.actual <= benchmark.target * 1.5) {
            warnings.push({...benchmark, status: 'warning'})
          } else {
            failed.push({...benchmark, status: 'failed'})
          }
        }
      })
    }
    
    return { passed, failed, warnings }
  }
  
  function generateRecommendations(metrics: any, benchmarks: any): any {
    const recommendations = {
      critical: [],
      high: [],
      medium: [],
      low: []
    }
    
    // Critical recommendations
    benchmarks.failed.forEach(benchmark => {
      if (benchmark.category === 'Page Load' && benchmark.actual > benchmark.target * 2) {
        recommendations.critical.push({
          title: 'Critical Page Load Performance',
          description: `${benchmark.test} is ${benchmark.actual}ms, which is ${(benchmark.actual / benchmark.target).toFixed(1)}x slower than the target`,
          impact: 'High',
          effort: 'Medium',
          category: 'Performance'
        })
      }
    })
    
    // High priority recommendations
    if (metrics.memory_analysis?.analysis?.growth_percent > 50) {
      recommendations.high.push({
        title: 'Memory Usage Optimization',
        description: `Memory usage grew by ${metrics.memory_analysis.analysis.growth_percent.toFixed(1)}% during testing. Investigate potential memory leaks.`,
        impact: 'High',
        effort: 'High',
        category: 'Memory'
      })
    }
    
    // Medium priority recommendations
    if (metrics.network_performance?.api_requests?.avg_duration > 1000) {
      recommendations.medium.push({
        title: 'API Response Time Optimization',
        description: `Average API response time is ${metrics.network_performance.api_requests.avg_duration.toFixed(2)}ms. Consider implementing caching or optimizing queries.`,
        impact: 'Medium',
        effort: 'Medium',
        category: 'API'
      })
    }
    
    // Low priority recommendations
    if (metrics.page_load) {
      Object.entries(metrics.page_load).forEach(([pageName, page]: [string, any]) => {
        if (page.dom.elements > 2000) {
          recommendations.low.push({
            title: 'DOM Optimization',
            description: `${pageName} page has ${page.dom.elements} DOM elements. Consider implementing virtualization for better performance.`,
            impact: 'Low',
            effort: 'Medium',
            category: 'Frontend'
          })
        }
      })
    }
    
    return recommendations
  }
  
  function generateActionItems(recommendations: any, metrics: any): any[] {
    const actionItems = []
    
    // Convert critical recommendations to action items
    recommendations.critical.forEach(rec => {
      actionItems.push({
        priority: 'Critical',
        task: rec.title,
        description: rec.description,
        category: rec.category,
        estimated_impact: rec.impact,
        estimated_effort: rec.effort,
        timeline: 'Immediate'
      })
    })
    
    // Convert high priority recommendations
    recommendations.high.forEach(rec => {
      actionItems.push({
        priority: 'High',
        task: rec.title,
        description: rec.description,
        category: rec.category,
        estimated_impact: rec.impact,
        estimated_effort: rec.effort,
        timeline: '1-2 weeks'
      })
    })
    
    // Convert medium priority recommendations
    recommendations.medium.forEach(rec => {
      actionItems.push({
        priority: 'Medium',
        task: rec.title,
        description: rec.description,
        category: rec.category,
        estimated_impact: rec.impact,
        estimated_effort: rec.effort,
        timeline: '2-4 weeks'
      })
    })
    
    // Sort by priority and impact
    return actionItems.sort((a, b) => {
      const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }
  
  async function savePerformanceReport(report: any): Promise<string> {
    const reportsDir = path.join(process.cwd(), 'playwright-report', 'performance-reports')
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.join(reportsDir, `performance-report-${timestamp}.json`)
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    
    // Also create a human-readable summary
    const summaryPath = path.join(reportsDir, `performance-summary-${timestamp}.md`)
    const summaryContent = generateMarkdownSummary(report)
    fs.writeFileSync(summaryPath, summaryContent)
    
    return reportPath
  }
  
  function generateMarkdownSummary(report: any): string {
    return `
# Performance Test Report

**Generated:** ${report.metadata.timestamp}
**Test Duration:** ${(report.metadata.testDuration / 1000).toFixed(2)} seconds
**Overall Score:** ${report.executive_summary.overall_score}/100 (Grade: ${report.executive_summary.grade})

## Executive Summary

- **Average Page Load Time:** ${report.executive_summary.key_metrics.avg_page_load.toFixed(2)}ms
- **Average Interaction Time:** ${report.executive_summary.key_metrics.avg_interaction_time.toFixed(2)}ms
- **API Success Rate:** ${(report.executive_summary.key_metrics.api_success_rate * 100).toFixed(1)}%
- **Memory Efficiency Score:** ${report.executive_summary.key_metrics.memory_efficiency}/100

## Benchmarks Results

- **Passed:** ${report.benchmarks.passed.length}
- **Failed:** ${report.benchmarks.failed.length}
- **Warnings:** ${report.benchmarks.warnings.length}

## Critical Issues

${report.executive_summary.critical_issues.map(issue => `- ${issue}`).join('\n')}

## Recommendations

### Critical (${report.recommendations.critical.length})
${report.recommendations.critical.map(rec => `- **${rec.title}:** ${rec.description}`).join('\n')}

### High Priority (${report.recommendations.high.length})
${report.recommendations.high.map(rec => `- **${rec.title}:** ${rec.description}`).join('\n')}

### Medium Priority (${report.recommendations.medium.length})
${report.recommendations.medium.map(rec => `- **${rec.title}:** ${rec.description}`).join('\n')}

## Action Items

${report.action_items.slice(0, 10).map((item, index) => 
  `${index + 1}. **[${item.priority}]** ${item.task} (Timeline: ${item.timeline})`
).join('\n')}

---
*This report was generated automatically by the T023 Load Testing & Performance Validation Suite*
`.trim()
  }
})