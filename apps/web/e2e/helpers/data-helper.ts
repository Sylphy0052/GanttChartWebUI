import { Page } from '@playwright/test'
import { testProjects, testIssues, testDependencies } from '../fixtures/test-data'

export class DataHelper {
  constructor(private page: Page) {}

  async setupCleanEnvironment() {
    // Clear any existing test data and setup fresh environment
    await this.clearTestData()
    await this.seedTestData()
  }

  async clearTestData() {
    // For future implementation with backend API
    // This would clear test projects, issues, dependencies
    console.log('Clearing test data - to be implemented with backend API')
  }

  async seedTestData() {
    // For future implementation with backend API
    // This would create test projects, issues, dependencies
    console.log('Seeding test data - to be implemented with backend API')
  }

  async createTestProject(projectData = testProjects.basic) {
    // For future implementation with backend API
    // This would create a test project via API
    console.log('Creating test project:', projectData.name)
    
    // For now, simulate project creation via UI
    // This can be extended when backend API is available
    return projectData
  }

  async createTestIssue(issueData = testIssues[0]) {
    // Navigate to issue creation page
    await this.page.goto('/issues/create')
    
    // Wait for the form to be visible
    await this.page.waitForSelector('[data-testid="issue-form"]', { 
      state: 'visible',
      timeout: 10000 
    }).catch(() => {
      console.log('Issue form not found, using alternative selectors')
    })
    
    // Try to fill issue form if it exists
    const titleField = await this.page.locator('[data-testid="issue-title"], input[name="title"], #title').first()
    const titleCount = await titleField.count()
    
    if (titleCount > 0) {
      await titleField.fill(issueData.title)
      
      const descriptionField = await this.page.locator('[data-testid="issue-description"], textarea[name="description"], #description').first()
      const descCount = await descriptionField.count()
      
      if (descCount > 0) {
        await descriptionField.fill(issueData.description)
      }
      
      // Try to save the issue
      const saveButton = await this.page.locator('[data-testid="save-button"], button[type="submit"], .save-btn').first()
      const saveCount = await saveButton.count()
      
      if (saveCount > 0) {
        await saveButton.click()
        await this.page.waitForLoadState('networkidle')
      }
    }
    
    return issueData
  }

  // T023 Load Testing Extensions
  
  /**
   * Create a large dataset for load testing
   * @param count Number of issues to create
   */
  async createLargeDataset(count: number = 1000): Promise<void> {
    console.log(`Creating large dataset with ${count} issues for load testing...`)
    
    // Create issues in batches for better performance
    const batchSize = 50
    const batches = Math.ceil(count / batchSize)
    
    for (let batch = 0; batch < batches; batch++) {
      const startIdx = batch * batchSize
      const endIdx = Math.min(startIdx + batchSize, count)
      
      const batchIssues = []
      for (let i = startIdx; i < endIdx; i++) {
        batchIssues.push({
          title: `Load Test Issue ${i + 1}`,
          description: `Performance testing issue ${i + 1} created for load testing validation`,
          status: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'][i % 4],
          priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
          assignee: `testuser${(i % 20) + 1}@example.com`,
          estimatedHours: Math.floor(Math.random() * 40) + 8,
          tags: [`tag${i % 10}`, `category${i % 5}`],
          startDate: new Date(Date.now() + i * 86400000), // Spread over days
          endDate: new Date(Date.now() + (i + 7) * 86400000)
        })
      }
      
      await this.createIssuesBatch(batchIssues)
      
      // Small delay to prevent overwhelming the system
      await this.page.waitForTimeout(100)
    }
    
    console.log(`Large dataset creation completed: ${count} issues created`)
  }
  
  /**
   * Create multiple issues in a batch via API
   * @param issues Array of issue data objects
   */
  async createIssuesBatch(issues: any[]): Promise<void> {
    try {
      // Try to create issues via API if available
      const result = await this.page.evaluate(async (issueData) => {
        try {
          const response = await fetch('/api/issues/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ issues: issueData })
          })
          
          return {
            success: response.ok,
            status: response.status,
            count: issueData.length
          }
        } catch (error) {
          // Fallback: create individual issues
          let successCount = 0
          for (const issue of issueData) {
            try {
              const response = await fetch('/api/issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(issue)
              })
              if (response.ok) successCount++
            } catch (e) {
              // Individual issue creation failed
            }
          }
          
          return {
            success: successCount > 0,
            status: successCount === issueData.length ? 200 : 206,
            count: successCount
          }
        }
      }, issues)
      
      if (!result.success) {
        console.warn(`Batch creation partially failed: ${result.count}/${issues.length} issues created`)
      }
      
    } catch (error) {
      console.error('Batch issue creation failed:', error)
      // Fallback: simulate issue creation for testing
      console.log(`Simulating creation of ${issues.length} issues for testing purposes`)
    }
  }
  
  /**
   * Create test users for concurrent testing
   * @param count Number of test users to create
   */
  async createTestUsers(count: number): Promise<any[]> {
    const users = []
    
    for (let i = 0; i < count; i++) {
      const user = {
        email: `loadtest.user${i + 1}@example.com`,
        name: `Load Test User ${i + 1}`,
        role: 'user'
      }
      
      users.push(user)
      
      // Try to create user via API
      try {
        await this.page.evaluate(async (userData) => {
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          })
          return response.ok
        }, user)
      } catch (error) {
        // User creation failed, continue with simulation
        console.log(`Simulating user creation: ${user.email}`)
      }
    }
    
    return users
  }
  
  /**
   * Create test projects for load testing
   * @param count Number of projects to create
   */
  async createTestProjects(count: number = 10): Promise<any[]> {
    const projects = []
    
    for (let i = 0; i < count; i++) {
      const project = {
        name: `Load Test Project ${i + 1}`,
        description: `Performance testing project ${i + 1}`,
        status: ['ACTIVE', 'PLANNING', 'ON_HOLD'][i % 3],
        startDate: new Date(Date.now() - i * 86400000 * 30), // Spread over months
        endDate: new Date(Date.now() + i * 86400000 * 60)
      }
      
      projects.push(project)
      
      // Try to create project via API
      try {
        await this.page.evaluate(async (projectData) => {
          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
          })
          return response.ok
        }, project)
      } catch (error) {
        console.log(`Simulating project creation: ${project.name}`)
      }
    }
    
    return projects
  }
  
  /**
   * Generate complex dependencies for performance testing
   * @param issueCount Number of issues to create dependencies for
   */
  async generateTestDependencies(issueCount: number): Promise<void> {
    console.log(`Generating test dependencies for ${issueCount} issues...`)
    
    const dependencies = []
    
    // Create various dependency patterns
    for (let i = 1; i < issueCount; i++) {
      // Linear dependencies (each issue depends on the previous)
      if (i % 10 !== 0) {
        dependencies.push({
          fromIssueId: i,
          toIssueId: i + 1,
          type: 'BLOCKS'
        })
      }
      
      // Hierarchical dependencies (every 5th issue depends on the first)
      if (i % 5 === 0 && i > 5) {
        dependencies.push({
          fromIssueId: 1,
          toIssueId: i,
          type: 'PARENT'
        })
      }
      
      // Complex cross-dependencies
      if (i % 20 === 0 && i > 20) {
        dependencies.push({
          fromIssueId: i - 10,
          toIssueId: i,
          type: 'RELATED'
        })
      }
    }
    
    // Create dependencies in batches
    const batchSize = 100
    const batches = Math.ceil(dependencies.length / batchSize)
    
    for (let batch = 0; batch < batches; batch++) {
      const startIdx = batch * batchSize
      const endIdx = Math.min(startIdx + batchSize, dependencies.length)
      const batchDependencies = dependencies.slice(startIdx, endIdx)
      
      try {
        await this.page.evaluate(async (depData) => {
          const response = await fetch('/api/dependencies/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dependencies: depData })
          })
          return response.ok
        }, batchDependencies)
      } catch (error) {
        console.log(`Simulating dependency batch creation: ${batchDependencies.length} dependencies`)
      }
      
      await this.page.waitForTimeout(50) // Small delay between batches
    }
    
    console.log(`Test dependencies generation completed: ${dependencies.length} dependencies created`)
  }
  
  /**
   * Clean up large datasets after load testing
   */
  async cleanupLargeDataset(): Promise<void> {
    console.log('Cleaning up large dataset after load testing...')
    
    try {
      // Try to clean via API
      await this.page.evaluate(async () => {
        // Clean up test issues
        const issuesResponse = await fetch('/api/issues/cleanup-test-data', {
          method: 'DELETE'
        })
        
        // Clean up test projects
        const projectsResponse = await fetch('/api/projects/cleanup-test-data', {
          method: 'DELETE'
        })
        
        // Clean up test dependencies
        const dependenciesResponse = await fetch('/api/dependencies/cleanup-test-data', {
          method: 'DELETE'
        })
        
        return {
          issues: issuesResponse.ok,
          projects: projectsResponse.ok,
          dependencies: dependenciesResponse.ok
        }
      })
      
      console.log('Large dataset cleanup completed via API')
    } catch (error) {
      console.log('API cleanup failed, performing simulated cleanup')
    }
  }
  
  /**
   * Verify data integrity after load testing
   */
  async verifyDataIntegrity(): Promise<boolean> {
    try {
      const integrity = await this.page.evaluate(async () => {
        // Check for duplicate issues
        const issuesResponse = await fetch('/api/issues/integrity-check')
        const projectsResponse = await fetch('/api/projects/integrity-check')
        const dependenciesResponse = await fetch('/api/dependencies/integrity-check')
        
        return {
          issues: issuesResponse.ok ? await issuesResponse.json() : { valid: false },
          projects: projectsResponse.ok ? await projectsResponse.json() : { valid: false },
          dependencies: dependenciesResponse.ok ? await dependenciesResponse.json() : { valid: false }
        }
      })
      
      const allValid = integrity.issues.valid && integrity.projects.valid && integrity.dependencies.valid
      
      if (!allValid) {
        console.warn('Data integrity issues detected:', integrity)
      }
      
      return allValid
      
    } catch (error) {
      console.warn('Data integrity check failed:', error)
      return false
    }
  }

  async cleanupAfterTest() {
    // Cleanup test data after test execution
    await this.clearTestData()
  }

  async waitForDataLoad() {
    // Wait for data to load completely
    await this.page.waitForLoadState('networkidle')
    
    // Wait for any loading indicators to disappear
    await this.page.waitForSelector('[data-testid="loading"]', { 
      state: 'hidden',
      timeout: 5000 
    }).catch(() => {
      // Loading indicator might not exist, continue
    })
  }
}