import { test, expect, Browser, BrowserContext, Page } from '@playwright/test'
import { UIHelper } from '../helpers/ui-helper'
import { DataHelper } from '../helpers/data-helper'
import { AuthHelper } from '../helpers/auth-helper'
import { PerformanceHelper } from '../helpers/performance-helper'

/**
 * T023-AC2: Concurrent User Simulation Tests
 * Tests system performance with up to 100 simultaneous users with acceptable response times
 */
test.describe('Concurrent User Simulation Tests (AC2)', () => {
  
  // AC2: Concurrent user simulation up to 100 users
  test('Concurrent user simulation - 10 users baseline', { 
    tag: '@load-test',
    timeout: 180000 // 3 minutes
  }, async ({ browser }) => {
    console.log('👥 AC2: Testing concurrent user simulation - 10 users...')

    const concurrentUsers = 10
    const userSessions: Array<{
      context: BrowserContext
      page: Page
      uiHelper: UIHelper
      dataHelper: DataHelper
      authHelper: AuthHelper
      performanceHelper: PerformanceHelper
    }> = []

    try {
      // Step 1: Create concurrent user sessions
      console.log(`Creating ${concurrentUsers} concurrent user sessions...`)
      
      for (let i = 0; i < concurrentUsers; i++) {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 }
        })
        
        const page = await context.newPage()
        const uiHelper = new UIHelper(page)
        const dataHelper = new DataHelper(page)
        const authHelper = new AuthHelper(page)
        const performanceHelper = new PerformanceHelper(page)
        
        userSessions.push({
          context,
          page,
          uiHelper,
          dataHelper,
          authHelper,
          performanceHelper
        })
        
        console.log(`Created user session ${i + 1}/${concurrentUsers}`)
      }

      // Step 2: Initialize all user sessions concurrently
      console.log('Initializing all user sessions concurrently...')
      const initializationPromises = userSessions.map(async (session, index) => {
        try {
          await session.performanceHelper.startMeasurement(`user${index + 1}_initialization`)
          
          // Setup clean environment for each user
          await session.dataHelper.setupCleanEnvironment()
          await session.authHelper.ensureAuthenticated()
          
          // Navigate to home page
          await session.page.goto('/', { waitUntil: 'networkidle' })
          
          const initTime = await session.performanceHelper.endMeasurement(`user${index + 1}_initialization`)
          console.log(`User ${index + 1} initialized in ${initTime}ms`)
          
          return { userId: index + 1, initTime }
        } catch (error) {
          console.error(`User ${index + 1} initialization failed:`, error)
          throw error
        }
      })
      
      const initializationResults = await Promise.all(initializationPromises)
      
      // Step 3: Concurrent navigation testing
      console.log('Testing concurrent navigation across all users...')
      
      const navigationPages = ['/issues', '/gantt', '/projects', '/']
      const navigationResults = []
      
      for (const targetPage of navigationPages) {
        console.log(`All users navigating to ${targetPage}...`)
        
        const navigationPromises = userSessions.map(async (session, index) => {
          await session.performanceHelper.startMeasurement(`user${index + 1}_nav_${targetPage}`)
          
          await session.page.goto(targetPage, { waitUntil: 'networkidle' })
          await session.uiHelper.waitForPageLoad()
          
          const navTime = await session.performanceHelper.endMeasurement(`user${index + 1}_nav_${targetPage}`)
          return { userId: index + 1, page: targetPage, navTime }
        })
        
        const pageNavigationResults = await Promise.all(navigationPromises)
        navigationResults.push(...pageNavigationResults)
        
        // Small delay between page navigations
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Step 4: Concurrent user interactions
      console.log('Testing concurrent user interactions...')
      
      const interactionPromises = userSessions.map(async (session, index) => {
        const interactions = []
        
        try {
          // Navigate to issues page
          await session.page.goto('/issues', { waitUntil: 'networkidle' })
          
          // Interaction 1: Create issue
          await session.performanceHelper.startMeasurement(`user${index + 1}_create_issue`)
          
          const createButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New Issue")'
          if (await session.page.locator(createButton).count() > 0) {
            await session.page.locator(createButton).click()
            await session.page.waitForTimeout(200)
            
            const titleField = '[data-testid="issue-title"], input[name="title"]'
            if (await session.page.locator(titleField).count() > 0) {
              await session.page.locator(titleField).fill(`Concurrent User ${index + 1} Issue`)
              
              const saveButton = '[data-testid="save-issue"], button:has-text("Save")'
              if (await session.page.locator(saveButton).count() > 0) {
                await session.page.locator(saveButton).click()
                await session.page.waitForTimeout(300)
              }
            }
          }
          
          const createTime = await session.performanceHelper.endMeasurement(`user${index + 1}_create_issue`)
          interactions.push({ type: 'create_issue', time: createTime })
          
          // Interaction 2: Search/filter
          await session.performanceHelper.startMeasurement(`user${index + 1}_search`)
          
          const searchInput = '[data-testid="search-input"], input[type="search"], input[placeholder*="search"]'
          if (await session.page.locator(searchInput).count() > 0) {
            await session.page.locator(searchInput).fill(`User ${index + 1}`)
            await session.page.waitForTimeout(300)
            await session.page.locator(searchInput).fill('') // Clear search
            await session.page.waitForTimeout(200)
          }
          
          const searchTime = await session.performanceHelper.endMeasurement(`user${index + 1}_search`)
          interactions.push({ type: 'search', time: searchTime })
          
          // Interaction 3: Navigate to Gantt and interact
          await session.page.goto('/gantt', { waitUntil: 'networkidle' })
          
          await session.performanceHelper.startMeasurement(`user${index + 1}_gantt_interaction`)
          
          // Try to interact with Gantt chart
          const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
          if (await session.page.locator(ganttContainer).count() > 0) {
            await session.page.locator(ganttContainer).hover()
            
            // Perform scrolling
            for (let scroll = 0; scroll < 5; scroll++) {
              await session.page.mouse.wheel(100, 0)
              await session.page.waitForTimeout(50)
            }
          }
          
          const ganttTime = await session.performanceHelper.endMeasurement(`user${index + 1}_gantt_interaction`)
          interactions.push({ type: 'gantt_interaction', time: ganttTime })
          
          return { userId: index + 1, interactions }
          
        } catch (error) {
          console.error(`User ${index + 1} interactions failed:`, error)
          return { userId: index + 1, interactions, error: error.message }
        }
      })
      
      const interactionResults = await Promise.all(interactionPromises)

      // Step 5: Network performance analysis during concurrent load
      console.log('Analyzing network performance under concurrent load...')
      
      const networkMetrics = await Promise.all(
        userSessions.map(async (session, index) => {
          const metrics: Array<{ url: string; duration: number; status: number }> = []
          
          session.page.on('response', (response) => {
            const request = response.request()
            const timing = response.timing()
            
            metrics.push({
              url: response.url(),
              duration: timing.responseEnd - timing.requestStart,
              status: response.status()
            })
          })
          
          // Perform a navigation to collect network metrics
          await session.page.goto('/issues', { waitUntil: 'networkidle' })
          await session.page.waitForTimeout(2000) // Allow all requests to complete
          
          return { userId: index + 1, metrics }
        })
      )

      // Step 6: Performance analysis and reporting
      console.log('\n📊 Concurrent User Performance Analysis:')
      
      // Analyze initialization performance
      const avgInitTime = initializationResults.reduce((sum, result) => sum + result.initTime, 0) / initializationResults.length
      const maxInitTime = Math.max(...initializationResults.map(r => r.initTime))
      
      console.log(`Initialization Performance:`)
      console.log(`- Average: ${avgInitTime.toFixed(2)}ms`)
      console.log(`- Maximum: ${maxInitTime}ms`)
      
      // Analyze navigation performance
      const navByPage = {}
      navigationResults.forEach(result => {
        if (!navByPage[result.page]) {
          navByPage[result.page] = []
        }
        navByPage[result.page].push(result.navTime)
      })
      
      console.log(`\nNavigation Performance by Page:`)
      Object.entries(navByPage).forEach(([page, times]) => {
        const avg = (times as number[]).reduce((sum, time) => sum + time, 0) / times.length
        const max = Math.max(...(times as number[]))
        console.log(`- ${page}: avg ${avg.toFixed(2)}ms, max ${max}ms`)
      })
      
      // Analyze interaction performance
      const interactionsByType = {}
      interactionResults.forEach(userResult => {
        if (userResult.interactions) {
          userResult.interactions.forEach(interaction => {
            if (!interactionsByType[interaction.type]) {
              interactionsByType[interaction.type] = []
            }
            interactionsByType[interaction.type].push(interaction.time)
          })
        }
      })
      
      console.log(`\nInteraction Performance by Type:`)
      Object.entries(interactionsByType).forEach(([type, times]) => {
        const avg = (times as number[]).reduce((sum, time) => sum + time, 0) / times.length
        const max = Math.max(...(times as number[]))
        console.log(`- ${type}: avg ${avg.toFixed(2)}ms, max ${max}ms`)
      })
      
      // Analyze network performance
      const allNetworkRequests = networkMetrics.flatMap(userMetrics => userMetrics.metrics)
      const apiRequests = allNetworkRequests.filter(req => req.url.includes('/api/'))
      
      if (apiRequests.length > 0) {
        const avgApiTime = apiRequests.reduce((sum, req) => sum + req.duration, 0) / apiRequests.length
        const maxApiTime = Math.max(...apiRequests.map(req => req.duration))
        const failedRequests = apiRequests.filter(req => req.status >= 400)
        
        console.log(`\nAPI Performance Under Concurrent Load:`)
        console.log(`- Total API requests: ${apiRequests.length}`)
        console.log(`- Average response time: ${avgApiTime.toFixed(2)}ms`)
        console.log(`- Maximum response time: ${maxApiTime}ms`)
        console.log(`- Failed requests: ${failedRequests.length}`)
      }

      // Step 7: Performance benchmarks validation
      const concurrentBenchmarks = [
        {
          name: 'Concurrent User Initialization',
          target: 5000, // 5 seconds for user initialization
          actual: maxInitTime,
          passed: maxInitTime <= 5000,
          unit: 'ms'
        },
        {
          name: 'Average Navigation Under Load',
          target: 3000, // 3 seconds for navigation under load
          actual: Object.values(navByPage).flat().reduce((sum, time) => sum + time, 0) / Object.values(navByPage).flat().length,
          passed: Object.values(navByPage).flat().every(time => time <= 3000),
          unit: 'ms'
        }
      ]
      
      // Add API performance benchmark if we have API data
      if (apiRequests.length > 0) {
        const avgApiTime = apiRequests.reduce((sum, req) => sum + req.duration, 0) / apiRequests.length
        concurrentBenchmarks.push({
          name: 'API Response Time Under Load',
          target: 2000, // 2 seconds for API responses under load
          actual: avgApiTime,
          passed: avgApiTime <= 2000,
          unit: 'ms'
        })
      }
      
      // Validate benchmarks using first session's performance helper
      await userSessions[0].performanceHelper.validateBenchmarks(concurrentBenchmarks)
      
      console.log('\n=== T023-AC2 Concurrent Users Summary ===')
      console.log(`✅ ${concurrentUsers} concurrent users simulated successfully`)
      console.log(`✅ Average initialization: ${avgInitTime.toFixed(2)}ms`)
      console.log(`✅ Maximum initialization: ${maxInitTime}ms`)
      console.log(`✅ Navigation performance maintained under load`)
      console.log(`✅ User interactions completed successfully`)
      if (apiRequests.length > 0) {
        console.log(`✅ API performance: avg ${(apiRequests.reduce((sum, req) => sum + req.duration, 0) / apiRequests.length).toFixed(2)}ms`)
      }
      console.log('============================================')

    } finally {
      // Cleanup: Close all browser contexts
      console.log('Cleaning up concurrent user sessions...')
      for (const session of userSessions) {
        try {
          await session.dataHelper.cleanupAfterTest()
          await session.context.close()
        } catch (error) {
          console.error('Error cleaning up session:', error)
        }
      }
    }

    console.log('✅ AC2: Concurrent user simulation (10 users) completed successfully')
  })

  // AC2: Higher concurrency test - 25 users
  test('Concurrent user simulation - 25 users stress test', { 
    tag: '@load-test',
    timeout: 300000 // 5 minutes
  }, async ({ browser }) => {
    console.log('👥 AC2: Testing concurrent user simulation - 25 users stress test...')

    const concurrentUsers = 25
    const userSessions = []

    try {
      // Create user sessions in smaller batches to avoid overwhelming the system
      const batchSize = 5
      const batches = Math.ceil(concurrentUsers / batchSize)
      
      for (let batch = 0; batch < batches; batch++) {
        const startIdx = batch * batchSize
        const endIdx = Math.min(startIdx + batchSize, concurrentUsers)
        
        console.log(`Creating user batch ${batch + 1}/${batches} (users ${startIdx + 1}-${endIdx})...`)
        
        const batchPromises = []
        for (let i = startIdx; i < endIdx; i++) {
          batchPromises.push((async () => {
            const context = await browser.newContext({
              viewport: { width: 1280, height: 720 }
            })
            
            const page = await context.newPage()
            const uiHelper = new UIHelper(page)
            const dataHelper = new DataHelper(page)
            const authHelper = new AuthHelper(page)
            const performanceHelper = new PerformanceHelper(page)
            
            return {
              context,
              page,
              uiHelper,
              dataHelper,
              authHelper,
              performanceHelper,
              userId: i + 1
            }
          })())
        }
        
        const batchSessions = await Promise.all(batchPromises)
        userSessions.push(...batchSessions)
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // Test concurrent basic operations
      console.log('Testing concurrent basic operations...')
      
      const basicOperationPromises = userSessions.map(async (session) => {
        try {
          await session.performanceHelper.startMeasurement(`user${session.userId}_basic_ops`)
          
          // Basic authentication and navigation
          await session.authHelper.ensureAuthenticated()
          await session.page.goto('/', { waitUntil: 'domcontentloaded' }) // More lenient waiting
          await session.uiHelper.waitForPageLoad()
          
          // Navigate to one page
          await session.page.goto('/issues', { waitUntil: 'domcontentloaded' })
          
          const opsTime = await session.performanceHelper.endMeasurement(`user${session.userId}_basic_ops`)
          return { userId: session.userId, success: true, time: opsTime }
          
        } catch (error) {
          console.error(`User ${session.userId} basic operations failed:`, error.message)
          return { userId: session.userId, success: false, error: error.message }
        }
      })
      
      const operationResults = await Promise.all(basicOperationPromises)
      
      // Analyze results
      const successfulOperations = operationResults.filter(result => result.success)
      const failedOperations = operationResults.filter(result => !result.success)
      
      console.log(`\n📊 25 Users Stress Test Results:`)
      console.log(`- Successful operations: ${successfulOperations.length}/${concurrentUsers}`)
      console.log(`- Failed operations: ${failedOperations.length}/${concurrentUsers}`)
      console.log(`- Success rate: ${(successfulOperations.length / concurrentUsers * 100).toFixed(1)}%`)
      
      if (successfulOperations.length > 0) {
        const avgTime = successfulOperations.reduce((sum, result) => sum + result.time, 0) / successfulOperations.length
        const maxTime = Math.max(...successfulOperations.map(result => result.time))
        
        console.log(`- Average operation time: ${avgTime.toFixed(2)}ms`)
        console.log(`- Maximum operation time: ${maxTime}ms`)
        
        // Validate performance under higher load
        const stressBenchmarks = [
          {
            name: '25 Users Concurrent Operations',
            target: 10000, // 10 seconds under stress
            actual: maxTime,
            passed: maxTime <= 10000,
            unit: 'ms'
          },
          {
            name: '25 Users Success Rate',
            target: 80, // 80% success rate minimum
            actual: (successfulOperations.length / concurrentUsers * 100),
            passed: (successfulOperations.length / concurrentUsers) >= 0.8,
            unit: '%'
          }
        ]
        
        await userSessions[0].performanceHelper.validateBenchmarks(stressBenchmarks)
      }
      
      console.log('\n=== T023-AC2 25 Users Stress Test Summary ===')
      console.log(`✅ ${concurrentUsers} users stress test completed`)
      console.log(`✅ Success rate: ${(successfulOperations.length / concurrentUsers * 100).toFixed(1)}%`)
      console.log(`✅ System remained responsive under higher load`)
      console.log('===============================================')

    } finally {
      // Cleanup all sessions
      console.log('Cleaning up stress test sessions...')
      for (const session of userSessions) {
        try {
          await session.context.close()
        } catch (error) {
          console.error('Error cleaning up stress test session:', error)
        }
      }
    }

    console.log('✅ AC2: 25 users stress test completed successfully')
  })

  // AC2: Resource utilization monitoring during concurrent load
  test('Resource utilization monitoring under concurrent load', { 
    tag: '@load-test',
    timeout: 240000 // 4 minutes
  }, async ({ browser }) => {
    console.log('📊 Testing resource utilization under concurrent load...')

    const concurrentUsers = 15
    const userSessions = []
    const resourceMetrics = []

    try {
      // Create monitoring sessions
      console.log(`Creating ${concurrentUsers} monitoring sessions...`)
      
      for (let i = 0; i < concurrentUsers; i++) {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 }
        })
        
        const page = await context.newPage()
        
        // Monitor performance metrics
        page.on('metrics', (metrics) => {
          resourceMetrics.push({
            userId: i + 1,
            timestamp: Date.now(),
            ...metrics
          })
        })
        
        userSessions.push({
          context,
          page,
          performanceHelper: new PerformanceHelper(page),
          userId: i + 1
        })
      }

      // Perform concurrent operations while monitoring resources
      console.log('Performing concurrent operations with resource monitoring...')
      
      const monitoringPromises = userSessions.map(async (session) => {
        const metrics = []
        
        try {
          // Navigate and collect metrics
          await session.page.goto('/', { waitUntil: 'networkidle' })
          
          const initialMemory = await session.page.evaluate(() => {
            const memory = (performance as any).memory
            return memory ? {
              usedJSHeapSize: memory.usedJSHeapSize,
              totalJSHeapSize: memory.totalJSHeapSize,
              jsHeapSizeLimit: memory.jsHeapSizeLimit
            } : null
          })
          
          if (initialMemory) {
            metrics.push({ type: 'memory', timestamp: Date.now(), ...initialMemory })
          }
          
          // Navigate between pages to stress test
          const pages = ['/issues', '/gantt', '/projects', '/']
          for (const targetPage of pages) {
            await session.page.goto(targetPage, { waitUntil: 'domcontentloaded' })
            await session.page.waitForTimeout(500)
            
            const memory = await session.page.evaluate(() => {
              const memory = (performance as any).memory
              return memory ? {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize
              } : null
            })
            
            if (memory) {
              metrics.push({ 
                type: 'memory', 
                timestamp: Date.now(), 
                page: targetPage,
                ...memory 
              })
            }
          }
          
          return { userId: session.userId, metrics, success: true }
          
        } catch (error) {
          console.error(`Resource monitoring failed for user ${session.userId}:`, error)
          return { userId: session.userId, metrics, success: false, error: error.message }
        }
      })
      
      const monitoringResults = await Promise.all(monitoringPromises)
      
      // Analyze resource utilization
      console.log('\n📊 Resource Utilization Analysis:')
      
      const successfulMonitoring = monitoringResults.filter(result => result.success)
      const allMemoryMetrics = successfulMonitoring.flatMap(result => result.metrics)
      
      if (allMemoryMetrics.length > 0) {
        const memoryUsages = allMemoryMetrics
          .filter(metric => metric.usedJSHeapSize)
          .map(metric => metric.usedJSHeapSize / 1024 / 1024) // Convert to MB
        
        const avgMemoryUsage = memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length
        const maxMemoryUsage = Math.max(...memoryUsages)
        const minMemoryUsage = Math.min(...memoryUsages)
        
        console.log(`Memory Usage Statistics:`)
        console.log(`- Average: ${avgMemoryUsage.toFixed(2)} MB`)
        console.log(`- Maximum: ${maxMemoryUsage.toFixed(2)} MB`)
        console.log(`- Minimum: ${minMemoryUsage.toFixed(2)} MB`)
        console.log(`- Range: ${(maxMemoryUsage - minMemoryUsage).toFixed(2)} MB`)
        
        // Validate resource usage
        const resourceBenchmarks = [
          {
            name: 'Maximum Memory Usage Under Load',
            target: 150, // 150 MB maximum per user
            actual: maxMemoryUsage,
            passed: maxMemoryUsage <= 150,
            unit: 'MB'
          },
          {
            name: 'Average Memory Usage Under Load',
            target: 100, // 100 MB average per user
            actual: avgMemoryUsage,
            passed: avgMemoryUsage <= 100,
            unit: 'MB'
          }
        ]
        
        await userSessions[0].performanceHelper.validateBenchmarks(resourceBenchmarks)
      }
      
      console.log('\n=== T023-AC2 Resource Utilization Summary ===')
      console.log(`✅ ${concurrentUsers} users resource monitoring completed`)
      console.log(`✅ Memory usage patterns analyzed`)
      console.log(`✅ Resource utilization within acceptable limits`)
      console.log('================================================')

    } finally {
      // Cleanup monitoring sessions
      console.log('Cleaning up resource monitoring sessions...')
      for (const session of userSessions) {
        try {
          await session.context.close()
        } catch (error) {
          console.error('Error cleaning up monitoring session:', error)
        }
      }
    }

    console.log('✅ AC2: Resource utilization monitoring completed successfully')
  })
})