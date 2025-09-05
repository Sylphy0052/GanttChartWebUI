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