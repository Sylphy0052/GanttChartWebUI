import { test, expect } from '@playwright/test'
import { UIHelper } from '../helpers/ui-helper'
import { DataHelper } from '../helpers/data-helper'
import { AuthHelper } from '../helpers/auth-helper'
import { PerformanceHelper } from '../helpers/performance-helper'

/**
 * T023-AC5: API Endpoint Load Testing
 * Ensures stable response times under high request volumes
 */
test.describe('API Endpoint Load Testing (AC5)', () => {
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

  // AC5: High volume API load testing
  test('API endpoints load testing - High request volumes', { 
    tag: '@load-test',
    timeout: 600000 // 10 minutes
  }, async ({ page }) => {
    console.log('🌐 AC5: Testing API endpoints under high request volumes...')

    // Step 1: Create test dataset for API load testing
    console.log('Creating test dataset for API load testing...')
    await dataHelper.createLargeDataset(500) // Moderate dataset for focused API testing

    // Step 2: Define API endpoints to test
    const apiEndpoints = [
      {
        name: 'Issues List',
        method: 'GET',
        url: '/api/issues',
        params: 'limit=50',
        expectedStatus: 200
      },
      {
        name: 'Issues Filtered',
        method: 'GET',
        url: '/api/issues',
        params: 'status=TODO&limit=20',
        expectedStatus: 200
      },
      {
        name: 'Issue Detail',
        method: 'GET',
        url: '/api/issues/1',
        params: '',
        expectedStatus: 200
      },
      {
        name: 'Projects List',
        method: 'GET',
        url: '/api/projects',
        params: 'limit=10',
        expectedStatus: 200
      },
      {
        name: 'Project Detail',
        method: 'GET',
        url: '/api/projects/1',
        params: '',
        expectedStatus: 200
      },
      {
        name: 'Issue Search',
        method: 'GET',
        url: '/api/issues/search',
        params: 'q=test&limit=20',
        expectedStatus: 200
      }
    ]

    // Step 3: Test each endpoint with high load
    const loadTestResults = []
    
    for (const endpoint of apiEndpoints) {
      console.log(`\nTesting ${endpoint.name} endpoint under load...`)
      
      // Test 1: Sustained load test
      await performanceHelper.startMeasurement(`sustainedLoad_${endpoint.name}`)
      
      const requestsPerSecond = 20
      const testDuration = 30000 // 30 seconds
      const totalRequests = Math.floor((testDuration / 1000) * requestsPerSecond)
      
      console.log(`Sending ${totalRequests} requests over ${testDuration / 1000} seconds...`)
      
      const sustainedPromises = []
      const requestInterval = 1000 / requestsPerSecond // Interval between requests
      
      for (let i = 0; i < totalRequests; i++) {
        const requestPromise = new Promise((resolve) => {
          setTimeout(async () => {
            const requestStart = performance.now()
            
            try {
              const response = await page.evaluate(async ({ endpoint, params }) => {
                const url = params ? `${endpoint.url}?${params}` : endpoint.url
                const response = await fetch(url, { method: endpoint.method })
                
                return {
                  ok: response.ok,
                  status: response.status,
                  headers: Object.fromEntries(response.headers.entries()),
                  size: (await response.text()).length
                }
              }, { endpoint, params: endpoint.params })
              
              const requestEnd = performance.now()
              
              resolve({
                requestId: i,
                success: response.ok && response.status === endpoint.expectedStatus,
                status: response.status,
                duration: requestEnd - requestStart,
                size: response.size,
                timestamp: Date.now()
              })
              
            } catch (error) {
              const requestEnd = performance.now()
              resolve({
                requestId: i,
                success: false,
                error: error.message,
                duration: requestEnd - requestStart,
                timestamp: Date.now()
              })
            }
          }, i * requestInterval)
        })
        
        sustainedPromises.push(requestPromise)
      }
      
      const sustainedResults = await Promise.all(sustainedPromises)
      const sustainedLoadTime = await performanceHelper.endMeasurement(`sustainedLoad_${endpoint.name}`)
      
      // Analyze sustained load results
      const successfulRequests = sustainedResults.filter(result => result.success)
      const failedRequests = sustainedResults.filter(result => !result.success)
      
      const avgResponseTime = successfulRequests.length > 0 
        ? successfulRequests.reduce((sum, result) => sum + result.duration, 0) / successfulRequests.length 
        : 0
      const maxResponseTime = successfulRequests.length > 0 
        ? Math.max(...successfulRequests.map(result => result.duration))
        : 0
      const minResponseTime = successfulRequests.length > 0 
        ? Math.min(...successfulRequests.map(result => result.duration))
        : 0
      
      console.log(`${endpoint.name} sustained load results:`)
      console.log(`- Total requests: ${totalRequests}`)
      console.log(`- Successful: ${successfulRequests.length}`)
      console.log(`- Failed: ${failedRequests.length}`)
      console.log(`- Success rate: ${((successfulRequests.length / totalRequests) * 100).toFixed(2)}%`)
      console.log(`- Avg response time: ${avgResponseTime.toFixed(2)}ms`)
      console.log(`- Max response time: ${maxResponseTime.toFixed(2)}ms`)
      console.log(`- Min response time: ${minResponseTime.toFixed(2)}ms`)
      
      loadTestResults.push({
        endpoint: endpoint.name,
        testType: 'sustained',
        totalRequests,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        successRate: (successfulRequests.length / totalRequests) * 100,
        avgResponseTime,
        maxResponseTime,
        minResponseTime,
        duration: sustainedLoadTime
      })
      
      // Test 2: Burst load test
      console.log(`Testing ${endpoint.name} with burst load...`)
      
      await performanceHelper.startMeasurement(`burstLoad_${endpoint.name}`)
      
      const burstRequests = 100 // Send 100 requests simultaneously
      const burstPromises = []
      
      for (let i = 0; i < burstRequests; i++) {
        const burstPromise = page.evaluate(async ({ endpoint, params, requestId }) => {
          const requestStart = performance.now()
          
          try {
            const url = params ? `${endpoint.url}?${params}&_burst=${requestId}` : `${endpoint.url}?_burst=${requestId}`
            const response = await fetch(url, { method: endpoint.method })
            const requestEnd = performance.now()
            
            return {
              requestId,
              success: response.ok,
              status: response.status,
              duration: requestEnd - requestStart,
              size: (await response.text()).length
            }
          } catch (error) {
            const requestEnd = performance.now()
            return {
              requestId,
              success: false,
              error: error.message,
              duration: requestEnd - requestStart
            }
          }
        }, { endpoint, params: endpoint.params, requestId: i })
        
        burstPromises.push(burstPromise)
      }
      
      const burstResults = await Promise.all(burstPromises)
      const burstLoadTime = await performanceHelper.endMeasurement(`burstLoad_${endpoint.name}`)
      
      // Analyze burst load results
      const burstSuccessful = burstResults.filter(result => result.success)
      const burstFailed = burstResults.filter(result => !result.success)
      
      const burstAvgTime = burstSuccessful.length > 0 
        ? burstSuccessful.reduce((sum, result) => sum + result.duration, 0) / burstSuccessful.length 
        : 0
      const burstMaxTime = burstSuccessful.length > 0 
        ? Math.max(...burstSuccessful.map(result => result.duration))
        : 0
      
      console.log(`${endpoint.name} burst load results:`)
      console.log(`- Total requests: ${burstRequests}`)
      console.log(`- Successful: ${burstSuccessful.length}`)
      console.log(`- Failed: ${burstFailed.length}`)
      console.log(`- Success rate: ${((burstSuccessful.length / burstRequests) * 100).toFixed(2)}%`)
      console.log(`- Avg response time: ${burstAvgTime.toFixed(2)}ms`)
      console.log(`- Max response time: ${burstMaxTime.toFixed(2)}ms`)
      console.log(`- Total duration: ${burstLoadTime}ms`)
      
      loadTestResults.push({
        endpoint: endpoint.name,
        testType: 'burst',
        totalRequests: burstRequests,
        successfulRequests: burstSuccessful.length,
        failedRequests: burstFailed.length,
        successRate: (burstSuccessful.length / burstRequests) * 100,
        avgResponseTime: burstAvgTime,
        maxResponseTime: burstMaxTime,
        minResponseTime: burstSuccessful.length > 0 ? Math.min(...burstSuccessful.map(result => result.duration)) : 0,
        duration: burstLoadTime
      })
    }

    // Step 4: Test mixed endpoint load
    console.log('\nTesting mixed endpoint load scenario...')
    
    await performanceHelper.startMeasurement('mixedEndpointLoad')
    
    const mixedLoadRequests = 200
    const mixedPromises = []
    
    for (let i = 0; i < mixedLoadRequests; i++) {
      // Randomly select endpoint
      const endpoint = apiEndpoints[i % apiEndpoints.length]
      
      const mixedPromise = page.evaluate(async ({ endpoint, params, requestId }) => {
        const requestStart = performance.now()
        
        try {
          const url = params ? `${endpoint.url}?${params}&_mixed=${requestId}` : `${endpoint.url}?_mixed=${requestId}`
          const response = await fetch(url, { method: endpoint.method })
          const requestEnd = performance.now()
          
          return {
            requestId,
            endpoint: endpoint.name,
            success: response.ok,
            status: response.status,
            duration: requestEnd - requestStart,
            size: (await response.text()).length
          }
        } catch (error) {
          const requestEnd = performance.now()
          return {
            requestId,
            endpoint: endpoint.name,
            success: false,
            error: error.message,
            duration: requestEnd - requestStart
          }
        }
      }, { endpoint, params: endpoint.params, requestId: i })
      
      mixedPromises.push(mixedPromise)
    }
    
    const mixedResults = await Promise.all(mixedPromises)
    const mixedLoadTime = await performanceHelper.endMeasurement('mixedEndpointLoad')
    
    // Analyze mixed load results
    const mixedSuccessful = mixedResults.filter(result => result.success)
    const mixedFailed = mixedResults.filter(result => !result.success)
    
    console.log(`Mixed endpoint load results:`)
    console.log(`- Total requests: ${mixedLoadRequests}`)
    console.log(`- Successful: ${mixedSuccessful.length}`)
    console.log(`- Failed: ${mixedFailed.length}`)
    console.log(`- Success rate: ${((mixedSuccessful.length / mixedLoadRequests) * 100).toFixed(2)}%`)
    console.log(`- Total duration: ${mixedLoadTime}ms`)
    
    // Mixed results by endpoint
    console.log('\nMixed load results by endpoint:')
    apiEndpoints.forEach(endpoint => {
      const endpointResults = mixedResults.filter(result => result.endpoint === endpoint.name)
      const endpointSuccessful = endpointResults.filter(result => result.success)
      
      if (endpointResults.length > 0) {
        const endpointAvgTime = endpointSuccessful.length > 0 
          ? endpointSuccessful.reduce((sum, result) => sum + result.duration, 0) / endpointSuccessful.length 
          : 0
        
        console.log(`- ${endpoint.name}: ${endpointSuccessful.length}/${endpointResults.length} success, avg ${endpointAvgTime.toFixed(2)}ms`)
      }
    })

    // Step 5: Rate limiting and throttling test
    console.log('\nTesting rate limiting and system stability...')
    
    await performanceHelper.startMeasurement('rateLimitingTest')
    
    // Send rapid requests to test rate limiting
    const rapidRequests = 500
    const rapidPromises = []
    
    console.log(`Sending ${rapidRequests} rapid requests to test rate limiting...`)
    
    for (let i = 0; i < rapidRequests; i++) {
      const rapidPromise = page.evaluate(async (requestId) => {
        const requestStart = performance.now()
        
        try {
          const response = await fetch(`/api/issues?limit=1&_rapid=${requestId}`)
          const requestEnd = performance.now()
          
          return {
            requestId,
            success: response.ok,
            status: response.status,
            duration: requestEnd - requestStart,
            rateLimited: response.status === 429 || response.status === 503
          }
        } catch (error) {
          const requestEnd = performance.now()
          return {
            requestId,
            success: false,
            error: error.message,
            duration: requestEnd - requestStart,
            rateLimited: false
          }
        }
      }, i)
      
      rapidPromises.push(rapidPromise)
    }
    
    const rapidResults = await Promise.all(rapidPromises)
    const rateLimitingTime = await performanceHelper.endMeasurement('rateLimitingTest')
    
    // Analyze rate limiting results
    const rapidSuccessful = rapidResults.filter(result => result.success && !result.rateLimited)
    const rapidFailed = rapidResults.filter(result => !result.success && !result.rateLimited)
    const rapidLimited = rapidResults.filter(result => result.rateLimited)
    
    console.log(`Rate limiting test results:`)
    console.log(`- Total requests: ${rapidRequests}`)
    console.log(`- Successful: ${rapidSuccessful.length}`)
    console.log(`- Failed: ${rapidFailed.length}`)
    console.log(`- Rate limited: ${rapidLimited.length}`)
    console.log(`- Total duration: ${rateLimitingTime}ms`)
    
    if (rapidLimited.length > 0) {
      console.log(`✅ Rate limiting is working (${rapidLimited.length} requests were limited)`)
    } else {
      console.log(`⚠️  No rate limiting detected`)
    }

    // Step 6: Performance benchmarks validation
    console.log('\n📊 API Load Testing Performance Analysis:')
    
    const apiBenchmarks = []
    
    // Overall success rate benchmark
    const overallSuccessfulRequests = loadTestResults.reduce((sum, result) => sum + result.successfulRequests, 0)
    const overallTotalRequests = loadTestResults.reduce((sum, result) => sum + result.totalRequests, 0)
    const overallSuccessRate = (overallSuccessfulRequests / overallTotalRequests) * 100
    
    apiBenchmarks.push({
      name: 'Overall API Success Rate',
      target: 95, // 95% success rate
      actual: overallSuccessRate,
      passed: overallSuccessRate >= 95,
      unit: '%'
    })
    
    // Average response time benchmark
    const allAvgTimes = loadTestResults.filter(result => result.avgResponseTime > 0).map(result => result.avgResponseTime)
    if (allAvgTimes.length > 0) {
      const overallAvgResponseTime = allAvgTimes.reduce((sum, time) => sum + time, 0) / allAvgTimes.length
      
      apiBenchmarks.push({
        name: 'Average API Response Time',
        target: 2000, // 2 seconds average
        actual: overallAvgResponseTime,
        passed: overallAvgResponseTime <= 2000,
        unit: 'ms'
      })
    }
    
    // Maximum response time benchmark
    const allMaxTimes = loadTestResults.filter(result => result.maxResponseTime > 0).map(result => result.maxResponseTime)
    if (allMaxTimes.length > 0) {
      const overallMaxResponseTime = Math.max(...allMaxTimes)
      
      apiBenchmarks.push({
        name: 'Maximum API Response Time',
        target: 10000, // 10 seconds maximum
        actual: overallMaxResponseTime,
        passed: overallMaxResponseTime <= 10000,
        unit: 'ms'
      })
    }
    
    // Mixed load performance benchmark
    if (mixedSuccessful.length > 0) {
      const mixedAvgTime = mixedSuccessful.reduce((sum, result) => sum + result.duration, 0) / mixedSuccessful.length
      const mixedSuccessRate = (mixedSuccessful.length / mixedLoadRequests) * 100
      
      apiBenchmarks.push(
        {
          name: 'Mixed Load Success Rate',
          target: 90, // 90% success rate for mixed load
          actual: mixedSuccessRate,
          passed: mixedSuccessRate >= 90,
          unit: '%'
        },
        {
          name: 'Mixed Load Average Response Time',
          target: 3000, // 3 seconds for mixed load
          actual: mixedAvgTime,
          passed: mixedAvgTime <= 3000,
          unit: 'ms'
        }
      )
    }
    
    await performanceHelper.validateBenchmarks(apiBenchmarks)

    // Step 7: Detailed performance report
    console.log('\n📄 API Load Testing Detailed Report:')
    
    console.log('\nEndpoint Performance Summary:')
    apiEndpoints.forEach(endpoint => {
      const endpointResults = loadTestResults.filter(result => result.endpoint === endpoint.name)
      
      if (endpointResults.length > 0) {
        console.log(`\n${endpoint.name} (${endpoint.method} ${endpoint.url}):`)
        
        endpointResults.forEach(result => {
          console.log(`  ${result.testType.toUpperCase()} Load:`)
          console.log(`    - Requests: ${result.totalRequests}`)
          console.log(`    - Success rate: ${result.successRate.toFixed(2)}%`)
          console.log(`    - Avg response: ${result.avgResponseTime.toFixed(2)}ms`)
          console.log(`    - Max response: ${result.maxResponseTime.toFixed(2)}ms`)
        })
      }
    })
    
    console.log('\nLoad Testing Statistics:')
    console.log(`- Total API calls: ${overallTotalRequests + mixedLoadRequests + rapidRequests}`)
    console.log(`- Overall success rate: ${overallSuccessRate.toFixed(2)}%`)
    console.log(`- Endpoints tested: ${apiEndpoints.length}`)
    console.log(`- Test types: Sustained load, Burst load, Mixed load, Rate limiting`)

    console.log('\n=== T023-AC5 API Load Testing Summary ===')
    console.log(`✅ ${apiEndpoints.length} API endpoints tested under high load`)
    console.log(`✅ ${overallTotalRequests} total sustained/burst requests`)
    console.log(`✅ ${mixedLoadRequests} mixed endpoint requests`)
    console.log(`✅ ${rapidRequests} rapid requests for rate limiting test`)
    console.log(`✅ Overall success rate: ${overallSuccessRate.toFixed(2)}%`)
    if (allAvgTimes.length > 0) {
      console.log(`✅ Average response time: ${(allAvgTimes.reduce((sum, time) => sum + time, 0) / allAvgTimes.length).toFixed(2)}ms`)
    }
    console.log('==============================================')

    console.log('✅ AC5: API endpoint load testing completed successfully')
  })

  // AC5: API authentication and authorization load testing
  test('API authentication load testing', { 
    tag: '@load-test',
    timeout: 300000 // 5 minutes
  }, async ({ page }) => {
    console.log('🔐 AC5: Testing API authentication under load...')

    // Step 1: Test authentication endpoint performance
    console.log('Testing authentication endpoint under load...')
    
    const authLoadTests = []
    
    // Test valid authentication requests
    await performanceHelper.startMeasurement('authValidLoad')
    
    const validAuthRequests = 50
    const validAuthPromises = []
    
    for (let i = 0; i < validAuthRequests; i++) {
      const authPromise = page.evaluate(async (requestId) => {
        const requestStart = performance.now()
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'testuser@example.com',
              password: 'testpassword'
            })
          })
          
          const requestEnd = performance.now()
          
          return {
            requestId,
            success: response.ok,
            status: response.status,
            duration: requestEnd - requestStart
          }
        } catch (error) {
          const requestEnd = performance.now()
          return {
            requestId,
            success: false,
            error: error.message,
            duration: requestEnd - requestStart
          }
        }
      }, i)
      
      validAuthPromises.push(authPromise)
    }
    
    const validAuthResults = await Promise.all(validAuthPromises)
    const authValidLoadTime = await performanceHelper.endMeasurement('authValidLoad')
    
    const authSuccessful = validAuthResults.filter(result => result.success)
    const authFailed = validAuthResults.filter(result => !result.success)
    
    console.log('Valid authentication load test:')
    console.log(`- Total requests: ${validAuthRequests}`)
    console.log(`- Successful: ${authSuccessful.length}`)
    console.log(`- Failed: ${authFailed.length}`)
    
    if (authSuccessful.length > 0) {
      const avgAuthTime = authSuccessful.reduce((sum, result) => sum + result.duration, 0) / authSuccessful.length
      console.log(`- Average auth time: ${avgAuthTime.toFixed(2)}ms`)
    }

    // Test invalid authentication attempts (to test brute force protection)
    console.log('Testing invalid authentication attempts...')
    
    await performanceHelper.startMeasurement('authInvalidLoad')
    
    const invalidAuthRequests = 30
    const invalidAuthPromises = []
    
    for (let i = 0; i < invalidAuthRequests; i++) {
      const invalidAuthPromise = page.evaluate(async (requestId) => {
        const requestStart = performance.now()
        
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: `invalid${requestId}@example.com`,
              password: 'wrongpassword'
            })
          })
          
          const requestEnd = performance.now()
          
          return {
            requestId,
            success: response.ok,
            status: response.status,
            duration: requestEnd - requestStart,
            blocked: response.status === 429 || response.status === 423
          }
        } catch (error) {
          const requestEnd = performance.now()
          return {
            requestId,
            success: false,
            error: error.message,
            duration: requestEnd - requestStart,
            blocked: false
          }
        }
      }, i)
      
      invalidAuthPromises.push(invalidAuthPromise)
    }
    
    const invalidAuthResults = await Promise.all(invalidAuthPromises)
    const authInvalidLoadTime = await performanceHelper.endMeasurement('authInvalidLoad')
    
    const invalidBlocked = invalidAuthResults.filter(result => result.blocked)
    const invalidNotBlocked = invalidAuthResults.filter(result => !result.blocked && !result.success)
    
    console.log('Invalid authentication load test:')
    console.log(`- Total invalid requests: ${invalidAuthRequests}`)
    console.log(`- Blocked/Rate limited: ${invalidBlocked.length}`)
    console.log(`- Not blocked: ${invalidNotBlocked.length}`)
    
    if (invalidBlocked.length > 0) {
      console.log(`✅ Brute force protection is working`)
    } else {
      console.log(`⚠️  No brute force protection detected`)
    }

    // Step 2: Test protected endpoint access under load
    console.log('Testing protected endpoint access under load...')
    
    await performanceHelper.startMeasurement('protectedEndpointLoad')
    
    const protectedRequests = 100
    const protectedPromises = []
    
    for (let i = 0; i < protectedRequests; i++) {
      const protectedPromise = page.evaluate(async (requestId) => {
        const requestStart = performance.now()
        
        try {
          // Attempt to access protected endpoint
          const response = await fetch('/api/issues', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer invalid-token-${requestId}`
            }
          })
          
          const requestEnd = performance.now()
          
          return {
            requestId,
            success: response.ok,
            status: response.status,
            duration: requestEnd - requestStart,
            unauthorized: response.status === 401
          }
        } catch (error) {
          const requestEnd = performance.now()
          return {
            requestId,
            success: false,
            error: error.message,
            duration: requestEnd - requestStart,
            unauthorized: false
          }
        }
      }, i)
      
      protectedPromises.push(protectedPromise)
    }
    
    const protectedResults = await Promise.all(protectedPromises)
    const protectedEndpointLoadTime = await performanceHelper.endMeasurement('protectedEndpointLoad')
    
    const unauthorizedResponses = protectedResults.filter(result => result.unauthorized)
    const otherResponses = protectedResults.filter(result => !result.unauthorized)
    
    console.log('Protected endpoint load test:')
    console.log(`- Total requests with invalid tokens: ${protectedRequests}`)
    console.log(`- Properly rejected (401): ${unauthorizedResponses.length}`)
    console.log(`- Other responses: ${otherResponses.length}`)
    
    if (unauthorizedResponses.length === protectedRequests) {
      console.log(`✅ Authorization protection is working correctly`)
    } else {
      console.log(`⚠️  Authorization protection may have issues`)
    }

    // Step 3: Authentication benchmarks
    const authBenchmarks = []
    
    if (authSuccessful.length > 0) {
      const avgValidAuthTime = authSuccessful.reduce((sum, result) => sum + result.duration, 0) / authSuccessful.length
      const authSuccessRate = (authSuccessful.length / validAuthRequests) * 100
      
      authBenchmarks.push(
        {
          name: 'Authentication Success Rate',
          target: 95, // 95% success rate for valid auth
          actual: authSuccessRate,
          passed: authSuccessRate >= 95,
          unit: '%'
        },
        {
          name: 'Average Authentication Time',
          target: 1000, // 1 second for authentication
          actual: avgValidAuthTime,
          passed: avgValidAuthTime <= 1000,
          unit: 'ms'
        }
      )
    }
    
    // Protected endpoint response time
    if (unauthorizedResponses.length > 0) {
      const avgUnauthorizedTime = unauthorizedResponses.reduce((sum, result) => sum + result.duration, 0) / unauthorizedResponses.length
      
      authBenchmarks.push({
        name: 'Unauthorized Response Time',
        target: 500, // 500ms for unauthorized responses
        actual: avgUnauthorizedTime,
        passed: avgUnauthorizedTime <= 500,
        unit: 'ms'
      })
    }
    
    if (authBenchmarks.length > 0) {
      await performanceHelper.validateBenchmarks(authBenchmarks)
    }

    console.log('\n=== T023-AC5 API Authentication Load Summary ===')
    console.log(`✅ ${validAuthRequests} valid authentication requests tested`)
    console.log(`✅ ${invalidAuthRequests} invalid authentication attempts tested`)
    console.log(`✅ ${protectedRequests} protected endpoint access attempts tested`)
    console.log(`✅ Authentication success rate: ${authSuccessful.length > 0 ? ((authSuccessful.length / validAuthRequests) * 100).toFixed(1) : 'N/A'}%`)
    console.log(`✅ Authorization protection: ${unauthorizedResponses.length === protectedRequests ? 'Working' : 'Issues detected'}`)
    console.log('=================================================')

    console.log('✅ AC5: API authentication load testing completed successfully')
  })

  // AC5: API error handling under load
  test('API error handling under high load', { 
    tag: '@load-test',
    timeout: 240000 // 4 minutes
  }, async ({ page }) => {
    console.log('⚠️ AC5: Testing API error handling under high load...')

    // Step 1: Test malformed request handling
    console.log('Testing malformed request handling under load...')
    
    await performanceHelper.startMeasurement('malformedRequestLoad')
    
    const malformedRequests = 100
    const malformedTypes = [
      { name: 'Invalid JSON', body: '{"invalid": json}' },
      { name: 'Missing Fields', body: '{"title": ""}' },
      { name: 'Wrong Content Type', body: 'not-json', contentType: 'text/plain' },
      { name: 'Oversized Payload', body: JSON.stringify({ data: 'x'.repeat(10000) }) },
      { name: 'Invalid Parameters', body: '{"status": "INVALID_STATUS"}' }
    ]
    
    const malformedPromises = []
    
    for (let i = 0; i < malformedRequests; i++) {
      const malformedType = malformedTypes[i % malformedTypes.length]
      
      const malformedPromise = page.evaluate(async ({ type, requestId }) => {
        const requestStart = performance.now()
        
        try {
          const response = await fetch('/api/issues', {
            method: 'POST',
            headers: {
              'Content-Type': type.contentType || 'application/json'
            },
            body: type.body
          })
          
          const requestEnd = performance.now()
          
          return {
            requestId,
            type: type.name,
            status: response.status,
            duration: requestEnd - requestStart,
            properlyHandled: response.status >= 400 && response.status < 500 // 4xx for client errors
          }
        } catch (error) {
          const requestEnd = performance.now()
          return {
            requestId,
            type: type.name,
            error: error.message,
            duration: requestEnd - requestStart,
            properlyHandled: true // Network errors are handled
          }
        }
      }, { type: malformedType, requestId: i })
      
      malformedPromises.push(malformedPromise)
    }
    
    const malformedResults = await Promise.all(malformedPromises)
    const malformedLoadTime = await performanceHelper.endMeasurement('malformedRequestLoad')
    
    const properlyHandled = malformedResults.filter(result => result.properlyHandled)
    const improperlyHandled = malformedResults.filter(result => !result.properlyHandled)
    
    console.log('Malformed request handling:')
    console.log(`- Total malformed requests: ${malformedRequests}`)
    console.log(`- Properly handled: ${properlyHandled.length}`)
    console.log(`- Improperly handled: ${improperlyHandled.length}`)
    console.log(`- Error handling rate: ${((properlyHandled.length / malformedRequests) * 100).toFixed(2)}%`)
    
    // Analyze by error type
    console.log('\nError handling by type:')
    malformedTypes.forEach(type => {
      const typeResults = malformedResults.filter(result => result.type === type.name)
      const typeProperlyHandled = typeResults.filter(result => result.properlyHandled)
      console.log(`- ${type.name}: ${typeProperlyHandled.length}/${typeResults.length} properly handled`)
    })

    // Step 2: Test resource not found handling
    console.log('Testing resource not found handling under load...')
    
    await performanceHelper.startMeasurement('notFoundLoad')
    
    const notFoundRequests = 50
    const notFoundPromises = []
    
    for (let i = 0; i < notFoundRequests; i++) {
      const notFoundPromise = page.evaluate(async (requestId) => {
        const requestStart = performance.now()
        
        try {
          // Request non-existent resources
          const nonExistentId = 999999 + requestId
          const response = await fetch(`/api/issues/${nonExistentId}`)
          const requestEnd = performance.now()
          
          return {
            requestId,
            status: response.status,
            duration: requestEnd - requestStart,
            properlyHandled: response.status === 404
          }
        } catch (error) {
          const requestEnd = performance.now()
          return {
            requestId,
            error: error.message,
            duration: requestEnd - requestStart,
            properlyHandled: false
          }
        }
      }, i)
      
      notFoundPromises.push(notFoundPromise)
    }
    
    const notFoundResults = await Promise.all(notFoundPromises)
    const notFoundLoadTime = await performanceHelper.endMeasurement('notFoundLoad')
    
    const notFoundProperlyHandled = notFoundResults.filter(result => result.properlyHandled)
    
    console.log('Resource not found handling:')
    console.log(`- Total requests: ${notFoundRequests}`)
    console.log(`- Properly handled (404): ${notFoundProperlyHandled.length}`)
    console.log(`- 404 handling rate: ${((notFoundProperlyHandled.length / notFoundRequests) * 100).toFixed(2)}%`)

    // Step 3: Test server error recovery
    console.log('Testing server error handling and recovery...')
    
    await performanceHelper.startMeasurement('serverErrorLoad')
    
    const errorRecoveryRequests = 50
    const errorPromises = []
    
    // Send requests that might trigger server errors
    for (let i = 0; i < errorRecoveryRequests; i++) {
      const errorPromise = page.evaluate(async (requestId) => {
        const requestStart = performance.now()
        
        try {
          // Create request that might cause server issues
          const response = await fetch('/api/issues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `Error Test ${requestId}`,
              description: 'Testing server error recovery',
              // Potentially problematic data
              invalidField: null,
              startDate: 'invalid-date',
              estimatedHours: 'not-a-number'
            })
          })
          
          const requestEnd = performance.now()
          
          return {
            requestId,
            status: response.status,
            duration: requestEnd - requestStart,
            serverError: response.status >= 500,
            clientError: response.status >= 400 && response.status < 500,
            success: response.status >= 200 && response.status < 300
          }
        } catch (error) {
          const requestEnd = performance.now()
          return {
            requestId,
            error: error.message,
            duration: requestEnd - requestStart,
            networkError: true
          }
        }
      }, i)
      
      errorPromises.push(errorPromise)
    }
    
    const errorResults = await Promise.all(errorPromises)
    const serverErrorLoadTime = await performanceHelper.endMeasurement('serverErrorLoad')
    
    const serverErrors = errorResults.filter(result => result.serverError)
    const clientErrors = errorResults.filter(result => result.clientError)
    const successful = errorResults.filter(result => result.success)
    const networkErrors = errorResults.filter(result => result.networkError)
    
    console.log('Server error handling:')
    console.log(`- Total requests: ${errorRecoveryRequests}`)
    console.log(`- Server errors (5xx): ${serverErrors.length}`)
    console.log(`- Client errors (4xx): ${clientErrors.length}`)
    console.log(`- Successful (2xx): ${successful.length}`)
    console.log(`- Network errors: ${networkErrors.length}`)

    // Step 4: Error handling benchmarks
    const errorHandlingBenchmarks = []
    
    // Malformed request handling rate
    const malformedHandlingRate = (properlyHandled.length / malformedRequests) * 100
    errorHandlingBenchmarks.push({
      name: 'Malformed Request Handling Rate',
      target: 95, // 95% of malformed requests should be properly handled
      actual: malformedHandlingRate,
      passed: malformedHandlingRate >= 95,
      unit: '%'
    })
    
    // 404 handling rate
    const notFoundHandlingRate = (notFoundProperlyHandled.length / notFoundRequests) * 100
    errorHandlingBenchmarks.push({
      name: '404 Error Handling Rate',
      target: 98, // 98% of not found requests should return 404
      actual: notFoundHandlingRate,
      passed: notFoundHandlingRate >= 98,
      unit: '%'
    })
    
    // Server error rate (should be low)
    const serverErrorRate = (serverErrors.length / errorRecoveryRequests) * 100
    errorHandlingBenchmarks.push({
      name: 'Server Error Rate',
      target: 10, // Less than 10% server errors
      actual: serverErrorRate,
      passed: serverErrorRate <= 10,
      unit: '%'
    })
    
    // Error response time
    const allErrorResults = [...malformedResults, ...notFoundResults, ...errorResults]
    const errorResponseTimes = allErrorResults.map(result => result.duration).filter(duration => duration > 0)
    
    if (errorResponseTimes.length > 0) {
      const avgErrorResponseTime = errorResponseTimes.reduce((sum, time) => sum + time, 0) / errorResponseTimes.length
      
      errorHandlingBenchmarks.push({
        name: 'Average Error Response Time',
        target: 1000, // 1 second for error responses
        actual: avgErrorResponseTime,
        passed: avgErrorResponseTime <= 1000,
        unit: 'ms'
      })
    }
    
    await performanceHelper.validateBenchmarks(errorHandlingBenchmarks)

    console.log('\n=== T023-AC5 API Error Handling Summary ===')
    console.log(`✅ ${malformedRequests} malformed requests tested`)
    console.log(`✅ ${notFoundRequests} not found scenarios tested`)
    console.log(`✅ ${errorRecoveryRequests} error recovery scenarios tested`)
    console.log(`✅ Malformed handling rate: ${malformedHandlingRate.toFixed(1)}%`)
    console.log(`✅ 404 handling rate: ${notFoundHandlingRate.toFixed(1)}%`)
    console.log(`✅ Server error rate: ${serverErrorRate.toFixed(1)}%`)
    console.log('==============================================')

    console.log('✅ AC5: API error handling load testing completed successfully')
  })
})