import { test, expect } from '@playwright/test'
import { UIHelper } from '../helpers/ui-helper'
import { DataHelper } from '../helpers/data-helper'
import { AuthHelper } from '../helpers/auth-helper'
import { PerformanceHelper } from '../helpers/performance-helper'

/**
 * T023-AC3: Memory Leak Detection and Analysis
 * Identifies and reports potential memory issues during extended sessions
 */
test.describe('Memory Leak Detection and Analysis (AC3)', () => {
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

  // AC3: Extended session memory leak detection
  test('Extended session memory leak detection - 30 minute simulation', { 
    tag: '@load-test',
    timeout: 1800000 // 30 minutes
  }, async ({ page }) => {
    console.log('🧠 AC3: Testing extended session memory leak detection...')

    // Skip on non-Chromium browsers (memory API not available)
    const browserName = await page.evaluate(() => navigator.userAgent)
    if (!browserName.includes('Chrome')) {
      test.skip('Memory leak testing only available on Chromium browsers')
      return
    }

    // Initialize memory tracking
    const memorySnapshots: Array<{
      timestamp: number
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit: number
      cycle: number
      operation: string
    }> = []

    const takeMemorySnapshot = async (cycle: number, operation: string) => {
      const memory = await page.evaluate(() => {
        const memory = (performance as any).memory
        if (memory) {
          // Force garbage collection if available
          if ((window as any).gc) {
            (window as any).gc()
          }
          
          return {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          }
        }
        return null
      })

      if (memory) {
        memorySnapshots.push({
          timestamp: Date.now(),
          cycle,
          operation,
          ...memory
        })
        
        console.log(`[Cycle ${cycle}] ${operation}: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
      }
    }

    // Baseline memory measurement
    console.log('Taking baseline memory measurement...')
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000) // Allow initial rendering to complete
    await takeMemorySnapshot(0, 'Baseline')

    // Extended session simulation - 10 cycles of intensive operations
    const totalCycles = 10
    const cycleDuration = 180000 // 3 minutes per cycle
    
    console.log(`Starting ${totalCycles} cycles of intensive operations...`)
    
    for (let cycle = 1; cycle <= totalCycles; cycle++) {
      console.log(`\n--- Memory Leak Test Cycle ${cycle}/${totalCycles} ---`)
      
      const cycleStartTime = Date.now()
      
      // Operation 1: Navigate between pages multiple times
      const pages = ['/issues', '/gantt', '/projects', '/']
      for (let pageRound = 0; pageRound < 5; pageRound++) {
        for (const targetPage of pages) {
          await page.goto(targetPage, { waitUntil: 'domcontentloaded' })
          await uiHelper.waitForPageLoad()
          await page.waitForTimeout(200)
        }
      }
      await takeMemorySnapshot(cycle, 'Navigation Intensive')

      // Operation 2: Create and manipulate multiple issues
      await page.goto('/issues', { waitUntil: 'domcontentloaded' })
      
      for (let issueCount = 0; issueCount < 20; issueCount++) {
        const createButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New Issue")'
        if (await page.locator(createButton).count() > 0) {
          await page.locator(createButton).click()
          await page.waitForTimeout(100)
          
          const titleField = '[data-testid="issue-title"], input[name="title"]'
          if (await page.locator(titleField).count() > 0) {
            await page.locator(titleField).fill(`Memory Test Issue ${cycle}-${issueCount}`)
            
            // Cancel instead of saving to avoid database bloat
            const cancelButton = '[data-testid="cancel"], button:has-text("Cancel")'
            if (await page.locator(cancelButton).count() > 0) {
              await page.locator(cancelButton).click()
            } else {
              await page.keyboard.press('Escape')
            }
            await page.waitForTimeout(50)
          }
        }
      }
      await takeMemorySnapshot(cycle, 'Issue Creation/Cancellation')

      // Operation 3: Intensive Gantt chart interactions
      await page.goto('/gantt', { waitUntil: 'domcontentloaded' })
      await uiHelper.waitForPageLoad()
      
      const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
      if (await page.locator(ganttContainer).count() > 0) {
        await page.locator(ganttContainer).hover()
        
        // Intensive scrolling and zooming
        for (let interaction = 0; interaction < 100; interaction++) {
          // Horizontal scroll
          await page.mouse.wheel(Math.random() * 200 - 100, 0)
          
          // Vertical scroll
          if (interaction % 10 === 0) {
            await page.mouse.wheel(0, Math.random() * 200 - 100)
          }
          
          // Zoom interactions
          if (interaction % 20 === 0) {
            const zoomIn = '[data-testid="zoom-in"], .zoom-in'
            const zoomOut = '[data-testid="zoom-out"], .zoom-out'
            
            if (await page.locator(zoomIn).count() > 0) {
              await page.locator(zoomIn).click()
            }
            
            await page.waitForTimeout(100)
            
            if (await page.locator(zoomOut).count() > 0) {
              await page.locator(zoomOut).click()
            }
          }
          
          await page.waitForTimeout(20)
        }
      }
      await takeMemorySnapshot(cycle, 'Gantt Interactions')

      // Operation 4: DOM manipulation intensive tasks
      await page.goto('/issues', { waitUntil: 'domcontentloaded' })
      
      // Simulate intensive DOM operations
      await page.evaluate(() => {
        // Create and remove DOM elements to test for DOM leaks
        for (let i = 0; i < 1000; i++) {
          const div = document.createElement('div')
          div.innerHTML = `<span>Memory test element ${i}</span>`
          div.setAttribute('data-test-id', `memory-test-${i}`)
          document.body.appendChild(div)
        }
        
        // Remove elements
        const testElements = document.querySelectorAll('[data-test-id*="memory-test-"]')
        testElements.forEach(element => element.remove())
      })
      
      await takeMemorySnapshot(cycle, 'DOM Manipulation')

      // Operation 5: Event listener stress test
      await page.evaluate(() => {
        // Add and remove event listeners to test for listener leaks
        const handlers = []
        
        for (let i = 0; i < 100; i++) {
          const handler = () => console.log(`Handler ${i}`)
          handlers.push(handler)
          document.addEventListener('click', handler)
          document.addEventListener('mouseover', handler)
          document.addEventListener('scroll', handler)
        }
        
        // Remove event listeners
        handlers.forEach(handler => {
          document.removeEventListener('click', handler)
          document.removeEventListener('mouseover', handler)
          document.removeEventListener('scroll', handler)
        })
      })
      
      await takeMemorySnapshot(cycle, 'Event Listeners')

      // Cycle completion
      const cycleEndTime = Date.now()
      const cycleActualDuration = cycleEndTime - cycleStartTime
      console.log(`Cycle ${cycle} completed in ${cycleActualDuration}ms`)
      
      // Wait for remaining cycle time if needed
      const remainingTime = Math.max(0, cycleDuration - cycleActualDuration)
      if (remainingTime > 0) {
        console.log(`Waiting ${remainingTime}ms to complete cycle duration...`)
        await page.waitForTimeout(remainingTime)
      }
    }

    // Final memory measurement
    console.log('\nTaking final memory measurement...')
    
    // Force multiple garbage collections
    await page.evaluate(() => {
      if ((window as any).gc) {
        for (let i = 0; i < 5; i++) {
          (window as any).gc()
        }
      }
    })
    
    await page.waitForTimeout(2000) // Allow GC to complete
    await takeMemorySnapshot(totalCycles + 1, 'Final Measurement')

    // Memory leak analysis
    console.log('\n🔍 Analyzing memory usage patterns for leaks...')
    
    if (memorySnapshots.length < 2) {
      throw new Error('Insufficient memory snapshots for analysis')
    }

    const baselineMemory = memorySnapshots[0]
    const finalMemory = memorySnapshots[memorySnapshots.length - 1]
    
    const memoryIncrease = finalMemory.usedJSHeapSize - baselineMemory.usedJSHeapSize
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024
    const memoryIncreasePercent = (memoryIncrease / baselineMemory.usedJSHeapSize) * 100

    console.log('\n📊 Memory Leak Analysis Results:')
    console.log(`Baseline Memory: ${(baselineMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Final Memory: ${(finalMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Net Memory Increase: ${memoryIncreaseMB.toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`)

    // Analyze memory growth patterns
    const memoryGrowthAnalysis = memorySnapshots.map((snapshot, index) => {
      if (index === 0) return null
      
      const previousSnapshot = memorySnapshots[index - 1]
      const growth = snapshot.usedJSHeapSize - previousSnapshot.usedJSHeapSize
      const growthMB = growth / 1024 / 1024
      
      return {
        cycle: snapshot.cycle,
        operation: snapshot.operation,
        growthMB,
        totalMB: snapshot.usedJSHeapSize / 1024 / 1024
      }
    }).filter(Boolean)

    console.log('\nMemory Growth by Operation:')
    const growthByOperation = {}
    memoryGrowthAnalysis.forEach(analysis => {
      if (!growthByOperation[analysis.operation]) {
        growthByOperation[analysis.operation] = []
      }
      growthByOperation[analysis.operation].push(analysis.growthMB)
    })

    Object.entries(growthByOperation).forEach(([operation, growths]) => {
      const avgGrowth = (growths as number[]).reduce((sum, growth) => sum + growth, 0) / growths.length
      const maxGrowth = Math.max(...(growths as number[]))
      console.log(`- ${operation}: avg ${avgGrowth.toFixed(2)} MB, max ${maxGrowth.toFixed(2)} MB`)
    })

    // Detect potential memory leaks
    const leakThreshold = 10 // 10 MB increase is concerning
    const leakDetected = memoryIncreaseMB > leakThreshold
    
    if (leakDetected) {
      console.log(`\n⚠️  POTENTIAL MEMORY LEAK DETECTED!`)
      console.log(`Memory increased by ${memoryIncreaseMB.toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`)
      console.log(`This exceeds the leak detection threshold of ${leakThreshold} MB`)
      
      // Identify the operations with highest memory growth
      const highGrowthOperations = Object.entries(growthByOperation)
        .map(([operation, growths]) => ({
          operation,
          avgGrowth: (growths as number[]).reduce((sum, growth) => sum + growth, 0) / growths.length,
          maxGrowth: Math.max(...(growths as number[]))
        }))
        .sort((a, b) => b.avgGrowth - a.avgGrowth)
        .slice(0, 3)
      
      console.log('\nTop Memory Growth Operations:')
      highGrowthOperations.forEach((op, index) => {
        console.log(`${index + 1}. ${op.operation}: ${op.avgGrowth.toFixed(2)} MB avg, ${op.maxGrowth.toFixed(2)} MB max`)
      })
    } else {
      console.log(`\n✅ No significant memory leaks detected`)
      console.log(`Memory increase of ${memoryIncreaseMB.toFixed(2)} MB is within acceptable limits`)
    }

    // Memory benchmark validation
    const memoryBenchmarks = [
      {
        name: 'Extended Session Memory Increase',
        target: 50, // 50 MB maximum increase over 30 minutes
        actual: memoryIncreaseMB,
        passed: memoryIncreaseMB <= 50,
        unit: 'MB'
      },
      {
        name: 'Final Memory Usage',
        target: 150, // 150 MB maximum final memory usage
        actual: finalMemory.usedJSHeapSize / 1024 / 1024,
        passed: (finalMemory.usedJSHeapSize / 1024 / 1024) <= 150,
        unit: 'MB'
      },
      {
        name: 'Memory Growth Rate',
        target: 100, // 100% maximum growth rate
        actual: memoryIncreasePercent,
        passed: memoryIncreasePercent <= 100,
        unit: '%'
      }
    ]

    await performanceHelper.validateBenchmarks(memoryBenchmarks)

    // Generate detailed memory report
    const memoryReport = `
Extended Session Memory Leak Detection Report
Generated: ${new Date().toISOString()}
Test Duration: ${totalCycles} cycles (${(totalCycles * 3).toFixed(0)} minutes simulated)

Memory Usage Summary:
- Baseline: ${(baselineMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
- Final: ${(finalMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
- Net Increase: ${memoryIncreaseMB.toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)
- Leak Status: ${leakDetected ? 'POTENTIAL LEAK DETECTED' : 'NO SIGNIFICANT LEAKS'}

Memory Growth by Operation:
${Object.entries(growthByOperation).map(([operation, growths]) => {
  const avgGrowth = (growths as number[]).reduce((sum, growth) => sum + growth, 0) / growths.length
  return `- ${operation}: ${avgGrowth.toFixed(2)} MB average`
}).join('\n')}

Peak Memory Usage: ${Math.max(...memorySnapshots.map(s => s.usedJSHeapSize)) / 1024 / 1024} MB

Recommendations:
${leakDetected ? 
  '- Investigate high-growth operations for potential memory leaks\n- Review event listener cleanup\n- Check for uncleaned DOM references' : 
  '- Memory usage is within acceptable limits\n- Continue monitoring in production\n- Consider periodic memory profiling'
}
    `.trim()

    console.log('\n📄 Extended Session Memory Report:')
    console.log(memoryReport)

    console.log('\n=== T023-AC3 Memory Leak Detection Summary ===')
    console.log(`✅ ${totalCycles}-cycle extended session completed`)
    console.log(`✅ Memory usage analyzed: ${memoryIncreaseMB.toFixed(2)} MB increase`)
    console.log(`✅ Leak status: ${leakDetected ? '⚠️  POTENTIAL LEAK' : '✅ NO LEAKS'}`)
    console.log(`✅ Memory benchmarks validated`)
    console.log('===============================================')

    // Assert no critical memory leaks
    expect(memoryIncreaseMB, 'Extended session memory increase should be reasonable').toBeLessThan(50)
    expect(leakDetected, 'No significant memory leaks should be detected').toBeFalsy()

    console.log('✅ AC3: Extended session memory leak detection completed successfully')
  })

  // AC3: Rapid operations memory leak detection
  test('Rapid operations memory leak detection', { 
    tag: '@load-test',
    timeout: 600000 // 10 minutes
  }, async ({ page }) => {
    console.log('⚡ AC3: Testing rapid operations memory leak detection...')

    // Skip on non-Chromium browsers
    const browserName = await page.evaluate(() => navigator.userAgent)
    if (!browserName.includes('Chrome')) {
      test.skip('Memory leak testing only available on Chromium browsers')
      return
    }

    const memorySnapshots = []

    const takeMemorySnapshot = async (operation: string, iteration: number) => {
      const memory = await page.evaluate(() => {
        const memory = (performance as any).memory
        if (memory && (window as any).gc) {
          (window as any).gc()
        }
        return memory ? {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize
        } : null
      })

      if (memory) {
        memorySnapshots.push({
          timestamp: Date.now(),
          operation,
          iteration,
          ...memory
        })
        
        if (iteration % 50 === 0) {
          console.log(`[${operation}:${iteration}] ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
        }
      }
    }

    // Baseline measurement
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await takeMemorySnapshot('Baseline', 0)

    // Test 1: Rapid page navigation
    console.log('Testing rapid page navigation memory usage...')
    const pages = ['/issues', '/gantt', '/projects', '/']
    
    for (let iteration = 1; iteration <= 200; iteration++) {
      const targetPage = pages[iteration % pages.length]
      await page.goto(targetPage, { waitUntil: 'domcontentloaded' })
      
      if (iteration % 10 === 0) {
        await takeMemorySnapshot('Rapid Navigation', iteration)
      }
    }

    // Test 2: Rapid DOM manipulation
    console.log('Testing rapid DOM manipulation memory usage...')
    await page.goto('/issues', { waitUntil: 'domcontentloaded' })
    
    for (let iteration = 1; iteration <= 100; iteration++) {
      await page.evaluate((iter) => {
        // Create elements
        for (let i = 0; i < 10; i++) {
          const div = document.createElement('div')
          div.innerHTML = `<span>Rapid test ${iter}-${i}</span><button>Click</button>`
          div.setAttribute('data-rapid-test', `${iter}-${i}`)
          document.body.appendChild(div)
        }
        
        // Remove elements
        const elements = document.querySelectorAll('[data-rapid-test]')
        elements.forEach(el => el.remove())
      }, iteration)
      
      if (iteration % 25 === 0) {
        await takeMemorySnapshot('Rapid DOM', iteration)
      }
    }

    // Test 3: Rapid event handler creation/removal
    console.log('Testing rapid event handler memory usage...')
    
    for (let iteration = 1; iteration <= 100; iteration++) {
      await page.evaluate((iter) => {
        const handlers = []
        
        // Create handlers
        for (let i = 0; i < 20; i++) {
          const handler = () => console.log(`Handler ${iter}-${i}`)
          handlers.push(handler)
          document.addEventListener('click', handler)
          document.addEventListener('mouseover', handler)
        }
        
        // Remove handlers
        handlers.forEach(handler => {
          document.removeEventListener('click', handler)
          document.removeEventListener('mouseover', handler)
        })
      }, iteration)
      
      if (iteration % 25 === 0) {
        await takeMemorySnapshot('Rapid Events', iteration)
      }
    }

    // Final measurement with forced GC
    await page.evaluate(() => {
      if ((window as any).gc) {
        for (let i = 0; i < 3; i++) {
          (window as any).gc()
        }
      }
    })
    await page.waitForTimeout(1000)
    await takeMemorySnapshot('Final', 0)

    // Analyze rapid operations memory usage
    console.log('\n🔍 Analyzing rapid operations memory patterns...')
    
    const baseline = memorySnapshots.find(s => s.operation === 'Baseline')
    const final = memorySnapshots.find(s => s.operation === 'Final')
    
    if (!baseline || !final) {
      throw new Error('Missing baseline or final memory measurements')
    }

    const totalIncrease = final.usedJSHeapSize - baseline.usedJSHeapSize
    const totalIncreaseMB = totalIncrease / 1024 / 1024
    const increasePercent = (totalIncrease / baseline.usedJSHeapSize) * 100

    console.log('\n📊 Rapid Operations Memory Analysis:')
    console.log(`Baseline: ${(baseline.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Final: ${(final.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Net Increase: ${totalIncreaseMB.toFixed(2)} MB (${increasePercent.toFixed(1)}%)`)

    // Analyze memory patterns by operation type
    const operationTypes = ['Rapid Navigation', 'Rapid DOM', 'Rapid Events']
    
    operationTypes.forEach(opType => {
      const snapshots = memorySnapshots.filter(s => s.operation === opType)
      if (snapshots.length > 0) {
        const memories = snapshots.map(s => s.usedJSHeapSize / 1024 / 1024)
        const avgMemory = memories.reduce((sum, mem) => sum + mem, 0) / memories.length
        const maxMemory = Math.max(...memories)
        const minMemory = Math.min(...memories)
        
        console.log(`${opType}: avg ${avgMemory.toFixed(2)} MB, range ${minMemory.toFixed(2)}-${maxMemory.toFixed(2)} MB`)
      }
    })

    // Rapid operations benchmarks
    const rapidBenchmarks = [
      {
        name: 'Rapid Operations Memory Increase',
        target: 20, // 20 MB maximum increase for rapid operations
        actual: totalIncreaseMB,
        passed: totalIncreaseMB <= 20,
        unit: 'MB'
      },
      {
        name: 'Rapid Operations Growth Rate',
        target: 50, // 50% maximum growth rate
        actual: increasePercent,
        passed: increasePercent <= 50,
        unit: '%'
      }
    ]

    await performanceHelper.validateBenchmarks(rapidBenchmarks)

    const rapidLeakDetected = totalIncreaseMB > 15 // 15 MB threshold for rapid operations

    console.log('\n=== T023-AC3 Rapid Operations Summary ===')
    console.log(`✅ Rapid operations memory testing completed`)
    console.log(`✅ Memory increase: ${totalIncreaseMB.toFixed(2)} MB`)
    console.log(`✅ Leak status: ${rapidLeakDetected ? '⚠️  POTENTIAL RAPID LEAK' : '✅ NO RAPID LEAKS'}`)
    console.log(`✅ Operations tested: Navigation, DOM manipulation, Events`)
    console.log('============================================')

    expect(totalIncreaseMB, 'Rapid operations memory increase should be minimal').toBeLessThan(20)
    expect(rapidLeakDetected, 'No rapid operation memory leaks should be detected').toBeFalsy()

    console.log('✅ AC3: Rapid operations memory leak detection completed successfully')
  })

  // AC3: Component lifecycle memory leak detection
  test('Component lifecycle memory leak detection', { 
    tag: '@load-test',
    timeout: 300000 // 5 minutes
  }, async ({ page }) => {
    console.log('🔄 AC3: Testing component lifecycle memory leak detection...')

    // Skip on non-Chromium browsers
    const browserName = await page.evaluate(() => navigator.userAgent)
    if (!browserName.includes('Chrome')) {
      test.skip('Memory leak testing only available on Chromium browsers')
      return
    }

    const memorySnapshots = []
    let snapshotCounter = 0

    const takeMemorySnapshot = async (operation: string) => {
      const memory = await page.evaluate(() => {
        const memory = (performance as any).memory
        if (memory && (window as any).gc) {
          (window as any).gc()
        }
        return memory ? {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          domNodes: document.querySelectorAll('*').length
        } : null
      })

      if (memory) {
        memorySnapshots.push({
          id: ++snapshotCounter,
          timestamp: Date.now(),
          operation,
          ...memory
        })
        
        console.log(`[${operation}] Memory: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB, DOM: ${memory.domNodes} nodes`)
      }
    }

    // Baseline measurement
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await takeMemorySnapshot('Baseline')

    // Test component mount/unmount cycles
    console.log('Testing component lifecycle memory patterns...')
    
    const testCycles = 20
    
    for (let cycle = 1; cycle <= testCycles; cycle++) {
      console.log(`\nComponent lifecycle test cycle ${cycle}/${testCycles}`)
      
      // Navigate to issues page (mount components)
      await page.goto('/issues', { waitUntil: 'domcontentloaded' })
      await uiHelper.waitForPageLoad()
      await takeMemorySnapshot(`Issues Mount ${cycle}`)
      
      // Interact with components to create internal state
      const createButton = '[data-testid="create-issue"], .create-issue-btn, button:has-text("New Issue")'
      if (await page.locator(createButton).count() > 0) {
        await page.locator(createButton).click()
        await page.waitForTimeout(100)
        
        const titleField = '[data-testid="issue-title"], input[name="title"]'
        if (await page.locator(titleField).count() > 0) {
          await page.locator(titleField).fill(`Lifecycle Test ${cycle}`)
          
          // Cancel to test cleanup
          const cancelButton = '[data-testid="cancel"], button:has-text("Cancel")'
          if (await page.locator(cancelButton).count() > 0) {
            await page.locator(cancelButton).click()
          } else {
            await page.keyboard.press('Escape')
          }
        }
      }
      
      await takeMemorySnapshot(`Issues Interact ${cycle}`)
      
      // Navigate to Gantt (unmount issues, mount gantt)
      await page.goto('/gantt', { waitUntil: 'domcontentloaded' })
      await uiHelper.waitForPageLoad()
      await takeMemorySnapshot(`Gantt Mount ${cycle}`)
      
      // Interact with Gantt components
      const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
      if (await page.locator(ganttContainer).count() > 0) {
        await page.locator(ganttContainer).hover()
        
        // Create some interactions
        for (let i = 0; i < 10; i++) {
          await page.mouse.wheel(50, 0)
          await page.waitForTimeout(20)
        }
      }
      
      await takeMemorySnapshot(`Gantt Interact ${cycle}`)
      
      // Navigate to projects (unmount gantt, mount projects)
      await page.goto('/projects', { waitUntil: 'domcontentloaded' })
      await uiHelper.waitForPageLoad()
      await takeMemorySnapshot(`Projects Mount ${cycle}`)
      
      // Navigate back to home (unmount all main components)
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await takeMemorySnapshot(`Home Return ${cycle}`)
      
      // Small delay between cycles
      await page.waitForTimeout(200)
    }

    // Final measurement with forced GC
    await page.evaluate(() => {
      if ((window as any).gc) {
        for (let i = 0; i < 5; i++) {
          (window as any).gc()
        }
      }
    })
    await page.waitForTimeout(2000)
    await takeMemorySnapshot('Final')

    // Analyze component lifecycle memory patterns
    console.log('\n🔍 Analyzing component lifecycle memory patterns...')
    
    const baseline = memorySnapshots.find(s => s.operation === 'Baseline')
    const final = memorySnapshots.find(s => s.operation === 'Final')
    
    if (!baseline || !final) {
      throw new Error('Missing baseline or final measurements')
    }

    const totalMemoryIncrease = final.usedJSHeapSize - baseline.usedJSHeapSize
    const totalMemoryIncreaseMB = totalMemoryIncrease / 1024 / 1024
    const totalDomIncrease = final.domNodes - baseline.domNodes

    console.log('\n📊 Component Lifecycle Memory Analysis:')
    console.log(`Baseline Memory: ${(baseline.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Final Memory: ${(final.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`Net Memory Increase: ${totalMemoryIncreaseMB.toFixed(2)} MB`)
    console.log(`Baseline DOM Nodes: ${baseline.domNodes}`)
    console.log(`Final DOM Nodes: ${final.domNodes}`)
    console.log(`Net DOM Node Increase: ${totalDomIncrease}`)

    // Analyze memory patterns by operation type
    const operationPatterns = {}
    memorySnapshots.forEach(snapshot => {
      const operationType = snapshot.operation.replace(/\s\d+$/, '') // Remove cycle numbers
      if (!operationPatterns[operationType]) {
        operationPatterns[operationType] = []
      }
      operationPatterns[operationType].push({
        memory: snapshot.usedJSHeapSize / 1024 / 1024,
        domNodes: snapshot.domNodes
      })
    })

    console.log('\nMemory Patterns by Component Operation:')
    Object.entries(operationPatterns).forEach(([operation, snapshots]) => {
      if (snapshots.length > 1) {
        const memories = (snapshots as any[]).map(s => s.memory)
        const domCounts = (snapshots as any[]).map(s => s.domNodes)
        
        const avgMemory = memories.reduce((sum, mem) => sum + mem, 0) / memories.length
        const avgDom = domCounts.reduce((sum, dom) => sum + dom, 0) / domCounts.length
        const maxMemory = Math.max(...memories)
        const maxDom = Math.max(...domCounts)
        
        console.log(`${operation}: avg ${avgMemory.toFixed(2)} MB (max ${maxMemory.toFixed(2)}), avg ${avgDom.toFixed(0)} DOM (max ${maxDom})`)
      }
    })

    // Component lifecycle benchmarks
    const lifecycleBenchmarks = [
      {
        name: 'Component Lifecycle Memory Increase',
        target: 25, // 25 MB maximum for component lifecycle testing
        actual: totalMemoryIncreaseMB,
        passed: totalMemoryIncreaseMB <= 25,
        unit: 'MB'
      },
      {
        name: 'DOM Node Increase',
        target: 1000, // 1000 nodes maximum increase
        actual: totalDomIncrease,
        passed: totalDomIncrease <= 1000,
        unit: 'nodes'
      }
    ]

    await performanceHelper.validateBenchmarks(lifecycleBenchmarks)

    const lifecycleLeakDetected = totalMemoryIncreaseMB > 20 || totalDomIncrease > 500

    console.log('\n=== T023-AC3 Component Lifecycle Summary ===')
    console.log(`✅ ${testCycles} component lifecycle cycles completed`)
    console.log(`✅ Memory increase: ${totalMemoryIncreaseMB.toFixed(2)} MB`)
    console.log(`✅ DOM node increase: ${totalDomIncrease}`)
    console.log(`✅ Leak status: ${lifecycleLeakDetected ? '⚠️  POTENTIAL COMPONENT LEAK' : '✅ NO COMPONENT LEAKS'}`)
    console.log('=============================================')

    expect(totalMemoryIncreaseMB, 'Component lifecycle memory increase should be minimal').toBeLessThan(25)
    expect(totalDomIncrease, 'DOM node increase should be minimal').toBeLessThan(1000)

    console.log('✅ AC3: Component lifecycle memory leak detection completed successfully')
  })
})