import { Page, expect } from '@playwright/test'

export interface PerformanceMetrics {
  initialRenderTime: number
  dragOperationTime: number
  navigationTime: number
  memoryUsage: number
  networkRequests: number
  jsHeapSize?: number
  domNodes?: number
}

export interface PerformanceBenchmark {
  name: string
  target: number
  actual: number
  passed: boolean
  unit: string
}

export class PerformanceHelper {
  private performanceMarks: Map<string, number> = new Map()

  constructor(private page: Page) {}

  // AC4: Start performance measurement
  async startMeasurement(label: string): Promise<void> {
    const startTime = Date.now()
    this.performanceMarks.set(label, startTime)
    
    // Mark in browser performance API
    await this.page.evaluate((markLabel) => {
      if (window.performance && window.performance.mark) {
        window.performance.mark(`${markLabel}_start`)
      }
    }, label)
  }

  // AC4: End performance measurement
  async endMeasurement(label: string): Promise<number> {
    const endTime = Date.now()
    const startTime = this.performanceMarks.get(label)
    
    if (!startTime) {
      throw new Error(`No start time found for measurement: ${label}`)
    }

    const duration = endTime - startTime
    this.performanceMarks.delete(label)

    // Mark and measure in browser performance API
    await this.page.evaluate((markLabel) => {
      if (window.performance && window.performance.mark && window.performance.measure) {
        window.performance.mark(`${markLabel}_end`)
        window.performance.measure(markLabel, `${markLabel}_start`, `${markLabel}_end`)
      }
    }, label)

    return duration
  }

  // AC4: Measure initial render time with target <1.5s
  async measureInitialRender(): Promise<PerformanceBenchmark> {
    await this.startMeasurement('initialRender')
    
    // Wait for the page to be fully loaded
    await this.page.waitForLoadState('networkidle')
    
    // Wait for critical UI elements
    const criticalElements = [
      '[data-testid="gantt-container"], .gantt-container',
      '[data-testid="issue-table"], .issue-table',
      '[data-testid="wbs-container"], .wbs-container'
    ]
    
    for (const selector of criticalElements) {
      try {
        await this.page.waitForSelector(selector, { timeout: 2000, state: 'visible' })
        break // Found at least one critical element
      } catch {
        // Continue to next selector
      }
    }

    const actualTime = await this.endMeasurement('initialRender')
    
    return {
      name: 'Initial Render Time',
      target: 1500, // 1.5 seconds
      actual: actualTime,
      passed: actualTime <= 1500,
      unit: 'ms'
    }
  }

  // AC4: Measure drag operation time with target <100ms
  async measureDragOperation(sourceSelector: string, targetSelector: string): Promise<PerformanceBenchmark> {
    await this.startMeasurement('dragOperation')
    
    const source = this.page.locator(sourceSelector)
    const target = this.page.locator(targetSelector)
    
    // Perform drag operation
    await source.dragTo(target)
    
    // Wait for any visual updates
    await this.page.waitForTimeout(100)
    
    const actualTime = await this.endMeasurement('dragOperation')
    
    return {
      name: 'Drag Operation Time',
      target: 100, // 100ms
      actual: actualTime,
      passed: actualTime <= 100,
      unit: 'ms'
    }
  }

  // AC4: Measure navigation time between pages
  async measureNavigation(targetUrl: string): Promise<PerformanceBenchmark> {
    await this.startMeasurement('navigation')
    
    await this.page.goto(targetUrl)
    await this.page.waitForLoadState('networkidle')
    
    const actualTime = await this.endMeasurement('navigation')
    
    return {
      name: 'Navigation Time',
      target: 1000, // 1 second
      actual: actualTime,
      passed: actualTime <= 1000,
      unit: 'ms'
    }
  }

  // AC4: Collect comprehensive performance metrics
  async collectMetrics(): Promise<PerformanceMetrics> {
    const metrics = await this.page.evaluate(() => {
      const perf = window.performance
      const navigation = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const memory = (performance as any).memory
      
      return {
        // Navigation timing
        loadComplete: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
        domComplete: navigation ? navigation.domComplete - navigation.navigationStart : 0,
        
        // Resource timing
        resourceCount: perf.getEntriesByType('resource').length,
        
        // Memory usage (Chrome only)
        jsHeapSize: memory ? memory.usedJSHeapSize : undefined,
        jsHeapSizeLimit: memory ? memory.totalJSHeapSize : undefined,
        
        // DOM metrics
        domNodes: document.querySelectorAll('*').length
      }
    })

    return {
      initialRenderTime: metrics.loadComplete,
      dragOperationTime: 0, // To be measured during specific tests
      navigationTime: metrics.domComplete,
      memoryUsage: metrics.jsHeapSize || 0,
      networkRequests: metrics.resourceCount,
      jsHeapSize: metrics.jsHeapSize,
      domNodes: metrics.domNodes
    }
  }

  // AC4: Validate performance benchmarks
  async validateBenchmarks(benchmarks: PerformanceBenchmark[]): Promise<void> {
    console.log('\n=== Performance Benchmark Results ===')
    
    for (const benchmark of benchmarks) {
      const status = benchmark.passed ? '✅ PASS' : '❌ FAIL'
      console.log(`${status} ${benchmark.name}: ${benchmark.actual}${benchmark.unit} (target: ≤${benchmark.target}${benchmark.unit})`)
      
      // Assert that performance targets are met
      expect(benchmark.actual, `${benchmark.name} should be ≤ ${benchmark.target}${benchmark.unit}`).toBeLessThanOrEqual(benchmark.target)
    }
    
    console.log('=====================================\n')
  }

  // AC4: Monitor for performance regressions during test execution
  async monitorPerformanceRegression(testName: string, expectedMaxTime: number): Promise<void> {
    await this.startMeasurement(testName)
    
    // This method should be called at the end of a test
    return new Promise((resolve) => {
      const checkTime = () => {
        const currentTime = Date.now() - (this.performanceMarks.get(testName) || Date.now())
        
        if (currentTime > expectedMaxTime) {
          console.warn(`⚠️  Performance regression detected in ${testName}: ${currentTime}ms > ${expectedMaxTime}ms`)
        }
        
        resolve()
      }
      
      // Check after a brief delay to allow test completion
      setTimeout(checkTime, 100)
    })
  }

  // AC4: Generate performance report
  async generateReport(): Promise<string> {
    const metrics = await this.collectMetrics()
    const browserInfo = await this.page.evaluate(() => ({
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    }))

    const report = `
Performance Test Report
Generated: ${new Date().toISOString()}

Browser: ${browserInfo.userAgent}
Viewport: ${browserInfo.viewport.width}x${browserInfo.viewport.height}

Metrics:
- Initial Render Time: ${metrics.initialRenderTime}ms
- Navigation Time: ${metrics.navigationTime}ms
- Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)} MB
- Network Requests: ${metrics.networkRequests}
- DOM Nodes: ${metrics.domNodes}
- JS Heap Size: ${metrics.jsHeapSize ? (metrics.jsHeapSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}

Benchmarks:
- Initial Render Target: ≤1.5s
- Drag Operation Target: ≤100ms
- Navigation Target: ≤1s
    `.trim()

    return report
  }
}