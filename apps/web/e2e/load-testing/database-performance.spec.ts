import { test, expect } from '@playwright/test'
import { UIHelper } from '../helpers/ui-helper'
import { DataHelper } from '../helpers/data-helper'
import { AuthHelper } from '../helpers/auth-helper'
import { PerformanceHelper } from '../helpers/performance-helper'

/**
 * T023-AC4: Database Performance Testing
 * Validates query optimization and connection pooling performance
 */
test.describe('Database Performance Testing (AC4)', () => {
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

  // AC4: Large dataset query performance testing
  test('Large dataset query performance - 1000+ records', { 
    tag: '@load-test',
    timeout: 300000 // 5 minutes
  }, async ({ page }) => {
    console.log('💾 AC4: Testing large dataset query performance...')

    // Step 1: Create large dataset for database performance testing
    console.log('Creating large dataset for database testing...')
    
    await performanceHelper.startMeasurement('datasetCreation')
    
    // Create 1000+ issues for comprehensive database testing
    const totalRecords = 1000
    const batchSize = 50
    const batches = Math.ceil(totalRecords / batchSize)
    
    for (let batch = 0; batch < batches; batch++) {
      const startIdx = batch * batchSize
      const endIdx = Math.min(startIdx + batchSize, totalRecords)
      
      const batchData = []
      for (let i = startIdx; i < endIdx; i++) {
        batchData.push({
          title: `Database Test Issue ${i + 1}`,
          description: `Performance testing record ${i + 1} for database query optimization validation`,
          status: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'][i % 4],
          priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
          assignee: `testuser${(i % 20) + 1}@example.com`,
          estimatedHours: Math.floor(Math.random() * 40) + 8,
          tags: [`tag${i % 10}`, `category${i % 5}`],
          startDate: new Date(Date.now() + i * 86400000), // Spread over days
          endDate: new Date(Date.now() + (i + 7) * 86400000)
        })
      }
      
      await dataHelper.createIssuesBatch(batchData)
      console.log(`Created database test batch ${batch + 1}/${batches}`)
      
      // Small delay to prevent overwhelming the database
      await page.waitForTimeout(100)
    }
    
    const datasetCreationTime = await performanceHelper.endMeasurement('datasetCreation')
    console.log(`Database dataset created in ${datasetCreationTime}ms`)

    // Step 2: Test various query performance scenarios
    const queryPerformanceTests = []

    // Query Test 1: Simple fetch all records
    console.log('Testing simple fetch all performance...')
    await performanceHelper.startMeasurement('queryFetchAll')
    
    const fetchAllResponse = await page.evaluate(async () => {
      const response = await fetch('/api/issues?limit=1000')
      return {
        ok: response.ok,
        status: response.status,
        dataSize: (await response.text()).length
      }
    })
    
    const fetchAllTime = await performanceHelper.endMeasurement('queryFetchAll')
    queryPerformanceTests.push({
      name: 'Fetch All Records (1000+)',
      time: fetchAllTime,
      success: fetchAllResponse.ok,
      dataSize: fetchAllResponse.dataSize
    })
    console.log(`Fetch all completed in ${fetchAllTime}ms`)

    // Query Test 2: Filtered queries
    console.log('Testing filtered query performance...')
    const filters = [
      { name: 'Status Filter', params: 'status=TODO' },
      { name: 'Priority Filter', params: 'priority=HIGH' },
      { name: 'Assignee Filter', params: 'assignee=testuser1@example.com' },
      { name: 'Combined Filter', params: 'status=IN_PROGRESS&priority=MEDIUM' },
      { name: 'Text Search', params: 'search=Database Test' }
    ]
    
    for (const filter of filters) {
      await performanceHelper.startMeasurement(`query${filter.name}`)
      
      const filterResponse = await page.evaluate(async (params) => {
        const response = await fetch(`/api/issues?${params}`)
        return {
          ok: response.ok,
          status: response.status,
          dataSize: (await response.text()).length
        }
      }, filter.params)
      
      const filterTime = await performanceHelper.endMeasurement(`query${filter.name}`)
      queryPerformanceTests.push({
        name: `Query: ${filter.name}`,
        time: filterTime,
        success: filterResponse.ok,
        dataSize: filterResponse.dataSize
      })
      console.log(`${filter.name} completed in ${filterTime}ms`)
    }

    // Query Test 3: Pagination performance
    console.log('Testing pagination query performance...')
    const paginationTests = [
      { page: 1, limit: 50 },
      { page: 5, limit: 50 },
      { page: 10, limit: 50 },
      { page: 1, limit: 100 },
      { page: 5, limit: 100 }
    ]
    
    for (const paginationTest of paginationTests) {
      await performanceHelper.startMeasurement(`queryPagination${paginationTest.page}_${paginationTest.limit}`)
      
      const paginationResponse = await page.evaluate(async ({ page: pageNum, limit }) => {
        const response = await fetch(`/api/issues?page=${pageNum}&limit=${limit}`)
        return {
          ok: response.ok,
          status: response.status,
          dataSize: (await response.text()).length
        }
      }, paginationTest)
      
      const paginationTime = await performanceHelper.endMeasurement(`queryPagination${paginationTest.page}_${paginationTest.limit}`)
      queryPerformanceTests.push({
        name: `Pagination: Page ${paginationTest.page}, Limit ${paginationTest.limit}`,
        time: paginationTime,
        success: paginationResponse.ok,
        dataSize: paginationResponse.dataSize
      })
      console.log(`Pagination ${paginationTest.page}/${paginationTest.limit} completed in ${paginationTime}ms`)
    }

    // Query Test 4: Sorting performance
    console.log('Testing sorting query performance...')
    const sortingTests = [
      'title',
      'status',
      'priority',
      'createdAt',
      'updatedAt',
      'startDate',
      'endDate'
    ]
    
    for (const sortField of sortingTests) {
      // Test both ascending and descending
      for (const order of ['asc', 'desc']) {
        await performanceHelper.startMeasurement(`querySort${sortField}_${order}`)
        
        const sortResponse = await page.evaluate(async ({ field, direction }) => {
          const response = await fetch(`/api/issues?sortBy=${field}&sortOrder=${direction}&limit=500`)
          return {
            ok: response.ok,
            status: response.status,
            dataSize: (await response.text()).length
          }
        }, { field: sortField, direction: order })
        
        const sortTime = await performanceHelper.endMeasurement(`querySort${sortField}_${order}`)
        queryPerformanceTests.push({
          name: `Sort: ${sortField} ${order}`,
          time: sortTime,
          success: sortResponse.ok,
          dataSize: sortResponse.dataSize
        })
      }
    }
    console.log('Sorting tests completed')

    // Query Test 5: Complex joins and relationships
    console.log('Testing complex query performance...')
    const complexQueries = [
      { name: 'Issues with Projects', endpoint: '/api/issues?include=project' },
      { name: 'Issues with Dependencies', endpoint: '/api/issues?include=dependencies' },
      { name: 'Issues with Comments', endpoint: '/api/issues?include=comments' },
      { name: 'Full Issue Details', endpoint: '/api/issues?include=project,dependencies,comments&limit=100' }
    ]
    
    for (const complexQuery of complexQueries) {
      await performanceHelper.startMeasurement(`queryComplex${complexQuery.name}`)
      
      const complexResponse = await page.evaluate(async (endpoint) => {
        const response = await fetch(endpoint)
        return {
          ok: response.ok,
          status: response.status,
          dataSize: (await response.text()).length
        }
      }, complexQuery.endpoint)
      
      const complexTime = await performanceHelper.endMeasurement(`queryComplex${complexQuery.name}`)
      queryPerformanceTests.push({
        name: `Complex: ${complexQuery.name}`,
        time: complexTime,
        success: complexResponse.ok,
        dataSize: complexResponse.dataSize
      })
      console.log(`${complexQuery.name} completed in ${complexTime}ms`)
    }

    // Step 3: Analyze query performance results
    console.log('\n📊 Database Query Performance Analysis:')
    
    const successfulQueries = queryPerformanceTests.filter(test => test.success)
    const failedQueries = queryPerformanceTests.filter(test => !test.success)
    
    console.log(`Total Queries: ${queryPerformanceTests.length}`)
    console.log(`Successful: ${successfulQueries.length}`)
    console.log(`Failed: ${failedQueries.length}`)
    
    if (failedQueries.length > 0) {
      console.log('Failed Queries:')
      failedQueries.forEach(query => console.log(`- ${query.name}`))
    }

    // Performance statistics
    if (successfulQueries.length > 0) {
      const queryTimes = successfulQueries.map(test => test.time)
      const avgQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length
      const maxQueryTime = Math.max(...queryTimes)
      const minQueryTime = Math.min(...queryTimes)
      
      console.log('\nQuery Performance Statistics:')
      console.log(`- Average: ${avgQueryTime.toFixed(2)}ms`)
      console.log(`- Maximum: ${maxQueryTime}ms`)
      console.log(`- Minimum: ${minQueryTime}ms`)
      console.log(`- 95th percentile: ${queryTimes.sort((a, b) => a - b)[Math.floor(queryTimes.length * 0.95)]}ms`)
      
      // Identify slow queries
      const slowQueries = successfulQueries.filter(test => test.time > 2000) // > 2 seconds
      if (slowQueries.length > 0) {
        console.log('\n⚠️  Slow Queries (>2s):')
        slowQueries.forEach(query => {
          console.log(`- ${query.name}: ${query.time}ms`)
        })
      }
      
      // Identify queries by category performance
      const queryCategories = {
        'Fetch': successfulQueries.filter(q => q.name.includes('Fetch')),
        'Filter': successfulQueries.filter(q => q.name.includes('Query:') || q.name.includes('Filter')),
        'Pagination': successfulQueries.filter(q => q.name.includes('Pagination')),
        'Sort': successfulQueries.filter(q => q.name.includes('Sort')),
        'Complex': successfulQueries.filter(q => q.name.includes('Complex'))
      }
      
      console.log('\nPerformance by Query Category:')
      Object.entries(queryCategories).forEach(([category, queries]) => {
        if (queries.length > 0) {
          const avgTime = queries.reduce((sum, q) => sum + q.time, 0) / queries.length
          const maxTime = Math.max(...queries.map(q => q.time))
          console.log(`- ${category}: avg ${avgTime.toFixed(2)}ms, max ${maxTime}ms`)
        }
      })
    }

    // Step 4: Database performance benchmarks
    const dbBenchmarks = []
    
    if (successfulQueries.length > 0) {
      const avgQueryTime = successfulQueries.reduce((sum, test) => sum + test.time, 0) / successfulQueries.length
      const maxQueryTime = Math.max(...successfulQueries.map(test => test.time))
      
      dbBenchmarks.push(
        {
          name: 'Average Query Performance',
          target: 1000, // 1 second average
          actual: avgQueryTime,
          passed: avgQueryTime <= 1000,
          unit: 'ms'
        },
        {
          name: 'Maximum Query Performance',
          target: 5000, // 5 seconds maximum
          actual: maxQueryTime,
          passed: maxQueryTime <= 5000,
          unit: 'ms'
        },
        {
          name: 'Query Success Rate',
          target: 95, // 95% success rate
          actual: (successfulQueries.length / queryPerformanceTests.length) * 100,
          passed: (successfulQueries.length / queryPerformanceTests.length) >= 0.95,
          unit: '%'
        }
      )
    }
    
    if (dbBenchmarks.length > 0) {
      await performanceHelper.validateBenchmarks(dbBenchmarks)
    }

    console.log('\n=== T023-AC4 Database Performance Summary ===')
    console.log(`✅ ${totalRecords} records created for testing`)
    console.log(`✅ ${queryPerformanceTests.length} database queries tested`)
    console.log(`✅ Success rate: ${((successfulQueries.length / queryPerformanceTests.length) * 100).toFixed(1)}%`)
    if (successfulQueries.length > 0) {
      console.log(`✅ Average query time: ${(successfulQueries.reduce((sum, test) => sum + test.time, 0) / successfulQueries.length).toFixed(2)}ms`)
    }
    console.log('===============================================')

    console.log('✅ AC4: Database query performance testing completed successfully')
  })

  // AC4: Connection pool performance testing
  test('Connection pool performance under load', { 
    tag: '@load-test',
    timeout: 180000 // 3 minutes
  }, async ({ page }) => {
    console.log('🔗 AC4: Testing connection pool performance under load...')

    // Step 1: Create baseline dataset
    console.log('Creating baseline dataset for connection pool testing...')
    await dataHelper.createLargeDataset(200) // Moderate dataset for connection testing

    // Step 2: Test concurrent database requests
    console.log('Testing concurrent database connection performance...')
    
    const concurrentRequests = 50 // Simulate 50 concurrent requests
    const connectionTests = []
    
    await performanceHelper.startMeasurement('concurrentConnections')
    
    // Create array of concurrent API calls
    const apiCalls = []
    
    for (let i = 0; i < concurrentRequests; i++) {
      const apiCall = page.evaluate(async (requestId) => {
        const startTime = performance.now()
        
        try {
          const response = await fetch(`/api/issues?limit=20&page=${(requestId % 10) + 1}`)
          const endTime = performance.now()
          const data = await response.json()
          
          return {
            requestId,
            success: response.ok,
            status: response.status,
            duration: endTime - startTime,
            recordCount: Array.isArray(data) ? data.length : (data.data ? data.data.length : 0)
          }
        } catch (error) {
          const endTime = performance.now()
          return {
            requestId,
            success: false,
            error: error.message,
            duration: endTime - startTime,
            recordCount: 0
          }
        }
      }, i)
      
      apiCalls.push(apiCall)
    }
    
    // Execute all concurrent requests
    const concurrentResults = await Promise.all(apiCalls)
    
    const totalConcurrentTime = await performanceHelper.endMeasurement('concurrentConnections')
    
    // Analyze connection pool performance
    const successfulRequests = concurrentResults.filter(result => result.success)
    const failedRequests = concurrentResults.filter(result => !result.success)
    
    console.log('\n📊 Connection Pool Performance Analysis:')
    console.log(`Total Concurrent Requests: ${concurrentRequests}`)
    console.log(`Successful Requests: ${successfulRequests.length}`)
    console.log(`Failed Requests: ${failedRequests.length}`)
    console.log(`Overall Duration: ${totalConcurrentTime}ms`)
    
    if (successfulRequests.length > 0) {
      const requestTimes = successfulRequests.map(result => result.duration)
      const avgRequestTime = requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length
      const maxRequestTime = Math.max(...requestTimes)
      const minRequestTime = Math.min(...requestTimes)
      
      console.log('\nRequest Performance Statistics:')
      console.log(`- Average Request Time: ${avgRequestTime.toFixed(2)}ms`)
      console.log(`- Maximum Request Time: ${maxRequestTime.toFixed(2)}ms`)
      console.log(`- Minimum Request Time: ${minRequestTime.toFixed(2)}ms`)
      console.log(`- Throughput: ${(successfulRequests.length / (totalConcurrentTime / 1000)).toFixed(2)} requests/second`)
    }
    
    if (failedRequests.length > 0) {
      console.log('\n⚠️  Failed Requests Analysis:')
      const errorTypes = {}
      failedRequests.forEach(request => {
        const errorType = request.error || 'Unknown Error'
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1
      })
      
      Object.entries(errorTypes).forEach(([error, count]) => {
        console.log(`- ${error}: ${count} occurrences`)
      })
    }

    // Step 3: Test sustained load on connection pool
    console.log('\nTesting sustained connection pool load...')
    
    const sustainedDuration = 60000 // 1 minute of sustained load
    const requestInterval = 100 // Request every 100ms
    const sustainedResults = []
    
    await performanceHelper.startMeasurement('sustainedLoad')
    
    const sustainedLoadPromise = new Promise(async (resolve) => {
      const startTime = Date.now()
      let requestCounter = 0
      
      const makeRequest = async () => {
        if (Date.now() - startTime >= sustainedDuration) {
          resolve(sustainedResults)
          return
        }
        
        const requestStart = performance.now()
        
        try {
          const response = await page.evaluate(async (counter) => {
            const response = await fetch(`/api/issues?limit=10&offset=${counter * 10}`)
            return {
              ok: response.ok,
              status: response.status
            }
          }, requestCounter)
          
          const requestEnd = performance.now()
          
          sustainedResults.push({
            requestId: requestCounter,
            success: response.ok,
            duration: requestEnd - requestStart,
            timestamp: Date.now()
          })
          
        } catch (error) {
          const requestEnd = performance.now()
          sustainedResults.push({
            requestId: requestCounter,
            success: false,
            duration: requestEnd - requestStart,
            timestamp: Date.now(),
            error: error.message
          })
        }
        
        requestCounter++
        setTimeout(makeRequest, requestInterval)
      }
      
      makeRequest()
    })
    
    await sustainedLoadPromise
    const sustainedLoadTime = await performanceHelper.endMeasurement('sustainedLoad')
    
    // Analyze sustained load results
    const sustainedSuccessful = sustainedResults.filter(result => result.success)
    const sustainedFailed = sustainedResults.filter(result => !result.success)
    
    console.log('\n📊 Sustained Load Analysis:')
    console.log(`Duration: ${sustainedLoadTime}ms`)
    console.log(`Total Requests: ${sustainedResults.length}`)
    console.log(`Successful: ${sustainedSuccessful.length}`)
    console.log(`Failed: ${sustainedFailed.length}`)
    console.log(`Success Rate: ${((sustainedSuccessful.length / sustainedResults.length) * 100).toFixed(2)}%`)
    
    if (sustainedSuccessful.length > 0) {
      const avgSustainedTime = sustainedSuccessful.reduce((sum, result) => sum + result.duration, 0) / sustainedSuccessful.length
      console.log(`Average Response Time: ${avgSustainedTime.toFixed(2)}ms`)
      console.log(`Sustained Throughput: ${(sustainedSuccessful.length / (sustainedDuration / 1000)).toFixed(2)} requests/second`)
    }

    // Step 4: Connection pool benchmarks
    const connectionBenchmarks = [
      {
        name: 'Concurrent Request Success Rate',
        target: 95, // 95% success rate for concurrent requests
        actual: (successfulRequests.length / concurrentRequests) * 100,
        passed: (successfulRequests.length / concurrentRequests) >= 0.95,
        unit: '%'
      },
      {
        name: 'Sustained Load Success Rate',
        target: 90, // 90% success rate for sustained load
        actual: (sustainedSuccessful.length / sustainedResults.length) * 100,
        passed: (sustainedSuccessful.length / sustainedResults.length) >= 0.90,
        unit: '%'
      }
    ]
    
    if (successfulRequests.length > 0) {
      const avgConcurrentTime = successfulRequests.reduce((sum, result) => sum + result.duration, 0) / successfulRequests.length
      connectionBenchmarks.push({
        name: 'Average Concurrent Request Time',
        target: 2000, // 2 seconds maximum for concurrent requests
        actual: avgConcurrentTime,
        passed: avgConcurrentTime <= 2000,
        unit: 'ms'
      })
    }
    
    if (sustainedSuccessful.length > 0) {
      const avgSustainedTime = sustainedSuccessful.reduce((sum, result) => sum + result.duration, 0) / sustainedSuccessful.length
      connectionBenchmarks.push({
        name: 'Average Sustained Request Time',
        target: 1500, // 1.5 seconds for sustained requests
        actual: avgSustainedTime,
        passed: avgSustainedTime <= 1500,
        unit: 'ms'
      })
    }
    
    await performanceHelper.validateBenchmarks(connectionBenchmarks)

    console.log('\n=== T023-AC4 Connection Pool Summary ===')
    console.log(`✅ ${concurrentRequests} concurrent requests tested`)
    console.log(`✅ Concurrent success rate: ${((successfulRequests.length / concurrentRequests) * 100).toFixed(1)}%`)
    console.log(`✅ Sustained load testing completed`)
    console.log(`✅ Sustained success rate: ${((sustainedSuccessful.length / sustainedResults.length) * 100).toFixed(1)}%`)
    console.log('============================================')

    console.log('✅ AC4: Connection pool performance testing completed successfully')
  })

  // AC4: Database transaction performance
  test('Database transaction performance testing', { 
    tag: '@load-test',
    timeout: 240000 // 4 minutes
  }, async ({ page }) => {
    console.log('💳 AC4: Testing database transaction performance...')

    // Step 1: Test individual transaction performance
    console.log('Testing individual transaction performance...')
    
    const transactionTests = []
    
    // Test CREATE transactions
    for (let i = 0; i < 10; i++) {
      await performanceHelper.startMeasurement(`createTransaction${i}`)
      
      const createResult = await page.evaluate(async (index) => {
        const response = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Transaction Test Issue ${index}`,
            description: `Testing database transaction performance ${index}`,
            status: 'TODO',
            priority: 'MEDIUM'
          })
        })
        
        return {
          ok: response.ok,
          status: response.status
        }
      }, i)
      
      const createTime = await performanceHelper.endMeasurement(`createTransaction${i}`)
      
      transactionTests.push({
        type: 'CREATE',
        success: createResult.ok,
        duration: createTime
      })
    }

    // Test UPDATE transactions
    console.log('Testing UPDATE transaction performance...')
    
    // First, get some issue IDs to update
    const issuesResponse = await page.evaluate(async () => {
      const response = await fetch('/api/issues?limit=10')
      const data = await response.json()
      return Array.isArray(data) ? data : (data.data || [])
    })
    
    for (let i = 0; i < Math.min(5, issuesResponse.length); i++) {
      const issue = issuesResponse[i]
      
      await performanceHelper.startMeasurement(`updateTransaction${i}`)
      
      const updateResult = await page.evaluate(async ({ issueId, index }) => {
        const response = await fetch(`/api/issues/${issueId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Updated Transaction Test ${index}`,
            description: `Updated for transaction performance testing`,
            status: 'IN_PROGRESS'
          })
        })
        
        return {
          ok: response.ok,
          status: response.status
        }
      }, { issueId: issue.id, index: i })
      
      const updateTime = await performanceHelper.endMeasurement(`updateTransaction${i}`)
      
      transactionTests.push({
        type: 'UPDATE',
        success: updateResult.ok,
        duration: updateTime
      })
    }

    // Step 2: Test bulk transaction performance
    console.log('Testing bulk transaction performance...')
    
    await performanceHelper.startMeasurement('bulkTransaction')
    
    const bulkCreateData = []
    for (let i = 0; i < 50; i++) {
      bulkCreateData.push({
        title: `Bulk Transaction Issue ${i}`,
        description: `Bulk transaction performance test record ${i}`,
        status: ['TODO', 'IN_PROGRESS', 'REVIEW'][i % 3],
        priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3]
      })
    }
    
    const bulkResult = await page.evaluate(async (data) => {
      const response = await fetch('/api/issues/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issues: data })
      })
      
      return {
        ok: response.ok,
        status: response.status,
        responseData: response.ok ? await response.json() : null
      }
    }, bulkCreateData)
    
    const bulkTime = await performanceHelper.endMeasurement('bulkTransaction')
    
    transactionTests.push({
      type: 'BULK_CREATE',
      success: bulkResult.ok,
      duration: bulkTime,
      recordCount: bulkCreateData.length
    })

    // Step 3: Test concurrent transaction performance
    console.log('Testing concurrent transaction performance...')
    
    await performanceHelper.startMeasurement('concurrentTransactions')
    
    const concurrentTransactionPromises = []
    
    for (let i = 0; i < 20; i++) {
      const transactionPromise = page.evaluate(async (index) => {
        const startTime = performance.now()
        
        try {
          const response = await fetch('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `Concurrent Transaction ${index}`,
              description: `Concurrent database transaction test ${index}`,
              status: 'TODO',
              priority: 'LOW'
            })
          })
          
          const endTime = performance.now()
          
          return {
            success: response.ok,
            duration: endTime - startTime,
            transactionId: index
          }
        } catch (error) {
          const endTime = performance.now()
          return {
            success: false,
            duration: endTime - startTime,
            transactionId: index,
            error: error.message
          }
        }
      }, i)
      
      concurrentTransactionPromises.push(transactionPromise)
    }
    
    const concurrentTransactionResults = await Promise.all(concurrentTransactionPromises)
    const concurrentTransactionsTime = await performanceHelper.endMeasurement('concurrentTransactions')

    // Step 4: Analyze transaction performance
    console.log('\n📊 Database Transaction Performance Analysis:')
    
    // Individual transaction analysis
    const createTransactions = transactionTests.filter(test => test.type === 'CREATE')
    const updateTransactions = transactionTests.filter(test => test.type === 'UPDATE')
    const bulkTransactions = transactionTests.filter(test => test.type === 'BULK_CREATE')
    
    console.log('\nIndividual Transaction Performance:')
    
    if (createTransactions.length > 0) {
      const avgCreateTime = createTransactions.reduce((sum, test) => sum + test.duration, 0) / createTransactions.length
      const createSuccess = createTransactions.filter(test => test.success).length
      console.log(`- CREATE: avg ${avgCreateTime.toFixed(2)}ms, success ${createSuccess}/${createTransactions.length}`)
    }
    
    if (updateTransactions.length > 0) {
      const avgUpdateTime = updateTransactions.reduce((sum, test) => sum + test.duration, 0) / updateTransactions.length
      const updateSuccess = updateTransactions.filter(test => test.success).length
      console.log(`- UPDATE: avg ${avgUpdateTime.toFixed(2)}ms, success ${updateSuccess}/${updateTransactions.length}`)
    }
    
    if (bulkTransactions.length > 0) {
      const bulkTransaction = bulkTransactions[0]
      console.log(`- BULK CREATE: ${bulkTransaction.duration}ms for ${bulkTransaction.recordCount} records`)
      console.log(`- Per-record bulk time: ${(bulkTransaction.duration / bulkTransaction.recordCount).toFixed(2)}ms`)
    }
    
    // Concurrent transaction analysis
    const successfulConcurrent = concurrentTransactionResults.filter(result => result.success)
    const failedConcurrent = concurrentTransactionResults.filter(result => !result.success)
    
    console.log('\nConcurrent Transaction Performance:')
    console.log(`- Total: ${concurrentTransactionResults.length}`)
    console.log(`- Successful: ${successfulConcurrent.length}`)
    console.log(`- Failed: ${failedConcurrent.length}`)
    console.log(`- Overall Duration: ${concurrentTransactionsTime}ms`)
    
    if (successfulConcurrent.length > 0) {
      const avgConcurrentTime = successfulConcurrent.reduce((sum, result) => sum + result.duration, 0) / successfulConcurrent.length
      const maxConcurrentTime = Math.max(...successfulConcurrent.map(result => result.duration))
      console.log(`- Average Response: ${avgConcurrentTime.toFixed(2)}ms`)
      console.log(`- Maximum Response: ${maxConcurrentTime.toFixed(2)}ms`)
    }

    // Step 5: Transaction performance benchmarks
    const transactionBenchmarks = []
    
    if (createTransactions.length > 0) {
      const avgCreateTime = createTransactions.reduce((sum, test) => sum + test.duration, 0) / createTransactions.length
      transactionBenchmarks.push({
        name: 'Average CREATE Transaction Time',
        target: 1000, // 1 second for CREATE transactions
        actual: avgCreateTime,
        passed: avgCreateTime <= 1000,
        unit: 'ms'
      })
    }
    
    if (successfulConcurrent.length > 0) {
      const concurrentSuccessRate = (successfulConcurrent.length / concurrentTransactionResults.length) * 100
      const avgConcurrentTime = successfulConcurrent.reduce((sum, result) => sum + result.duration, 0) / successfulConcurrent.length
      
      transactionBenchmarks.push(
        {
          name: 'Concurrent Transaction Success Rate',
          target: 90, // 90% success rate
          actual: concurrentSuccessRate,
          passed: concurrentSuccessRate >= 90,
          unit: '%'
        },
        {
          name: 'Average Concurrent Transaction Time',
          target: 2000, // 2 seconds for concurrent transactions
          actual: avgConcurrentTime,
          passed: avgConcurrentTime <= 2000,
          unit: 'ms'
        }
      )
    }
    
    if (bulkTransactions.length > 0 && bulkTransactions[0].recordCount > 0) {
      const perRecordTime = bulkTransactions[0].duration / bulkTransactions[0].recordCount
      transactionBenchmarks.push({
        name: 'Bulk Transaction Per-Record Time',
        target: 50, // 50ms per record in bulk operations
        actual: perRecordTime,
        passed: perRecordTime <= 50,
        unit: 'ms'
      })
    }
    
    if (transactionBenchmarks.length > 0) {
      await performanceHelper.validateBenchmarks(transactionBenchmarks)
    }

    console.log('\n=== T023-AC4 Database Transaction Summary ===')
    console.log(`✅ Individual transactions tested: ${transactionTests.length}`)
    console.log(`✅ Concurrent transactions tested: ${concurrentTransactionResults.length}`)
    console.log(`✅ Concurrent success rate: ${((successfulConcurrent.length / concurrentTransactionResults.length) * 100).toFixed(1)}%`)
    if (bulkTransactions.length > 0) {
      console.log(`✅ Bulk transaction: ${bulkTransactions[0].recordCount} records in ${bulkTransactions[0].duration}ms`)
    }
    console.log('===============================================')

    console.log('✅ AC4: Database transaction performance testing completed successfully')
  })
})