import { Page } from '@playwright/test'

export class AuthHelper {
  constructor(private page: Page) {}

  async login(email: string = 'test@example.com', password: string = 'password') {
    // For future implementation when authentication is added
    await this.page.goto('/login')
    
    // Wait for login form to be visible
    await this.page.waitForSelector('[data-testid="login-form"]', { 
      state: 'visible',
      timeout: 10000 
    }).catch(() => {
      // If login form is not found, assume no authentication required yet
      console.log('Login form not found, proceeding without authentication')
    })
    
    // Check if login form exists
    const loginForm = await this.page.locator('[data-testid="login-form"]').count()
    
    if (loginForm > 0) {
      await this.page.fill('[data-testid="email"]', email)
      await this.page.fill('[data-testid="password"]', password)
      await this.page.click('[data-testid="login-button"]')
      
      // Wait for redirect after successful login
      await this.page.waitForURL('/dashboard')
    } else {
      // No authentication required, go to home page
      await this.page.goto('/')
    }
  }

  async logout() {
    // For future implementation
    const logoutButton = await this.page.locator('[data-testid="logout-button"]').count()
    
    if (logoutButton > 0) {
      await this.page.click('[data-testid="logout-button"]')
      await this.page.waitForURL('/login')
    }
  }

  async ensureAuthenticated() {
    // Check if we're on a login page or need authentication
    const currentUrl = this.page.url()
    
    if (currentUrl.includes('/login')) {
      await this.login()
    }
  }
}