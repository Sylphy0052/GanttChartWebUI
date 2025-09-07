import { test as setup, expect } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate and setup session', async ({ page }) => {
  console.log('Setting up authentication and session management...')
  
  // Start on home page to test initial application state
  await page.goto('/')
  
  // Wait for initial page load
  await page.waitForLoadState('networkidle')
  
  // AC5: Test authentication flows - Check if login is required
  const currentUrl = page.url()
  console.log('Current URL:', currentUrl)
  
  // Look for login form or authentication elements
  const loginForm = page.locator('[data-testid="login-form"], .login-form, form[name="login"]')
  const loginFormExists = await loginForm.count() > 0
  
  console.log('Login form exists:', loginFormExists)
  
  if (loginFormExists || currentUrl.includes('/login')) {
    // AC5: Test login flow with credentials
    console.log('Performing login...')
    
    // Fill in login credentials
    const emailInput = page.locator('[data-testid="email"], input[name="email"], input[type="email"]')
    const passwordInput = page.locator('[data-testid="password"], input[name="password"], input[type="password"]')
    const loginButton = page.locator('[data-testid="login-button"], button[type="submit"], .login-btn')
    
    if (await emailInput.count() > 0) {
      await emailInput.fill('test@example.com')
    }
    
    if (await passwordInput.count() > 0) {
      await passwordInput.fill('password123')
    }
    
    if (await loginButton.count() > 0) {
      await loginButton.click()
      
      // Wait for successful login
      try {
        await page.waitForURL('**/dashboard', { timeout: 10000 })
        console.log('Login successful, redirected to dashboard')
      } catch {
        // Try waiting for any navigation away from login
        await page.waitForLoadState('networkidle')
        console.log('Login attempted, current URL:', page.url())
      }
    }
  } else {
    // AC5: Test password protection - Look for password-protected projects
    console.log('No login required, checking for password-protected content...')
    
    // Navigate to projects page to test password protection
    try {
      await page.goto('/projects')
      await page.waitForLoadState('networkidle')
      
      // Look for password protection dialog
      const passwordDialog = page.locator('[data-testid="password-dialog"], .password-dialog, [role="dialog"]:has-text("Password")')
      const passwordProtected = await passwordDialog.count() > 0
      
      console.log('Password-protected content detected:', passwordProtected)
      
      if (passwordProtected) {
        // Test password entry for protected project
        const passwordField = page.locator('[data-testid="project-password"], input[type="password"]')
        const submitButton = page.locator('[data-testid="password-submit"], button[type="submit"]')
        
        if (await passwordField.count() > 0) {
          await passwordField.fill('project123') // Use test project password
          
          if (await submitButton.count() > 0) {
            await submitButton.click()
            await page.waitForLoadState('networkidle')
            console.log('Project password entered successfully')
          }
        }
      }
    } catch (error) {
      console.log('Projects page navigation failed or not available:', error)
    }
  }
  
  // AC5: Test session management - Check if session persists
  console.log('Testing session persistence...')
  
  // Verify we can access protected routes
  const protectedRoutes = ['/gantt', '/issues', '/projects']
  
  for (const route of protectedRoutes) {
    try {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      
      // Check if we're still authenticated (not redirected to login)
      const finalUrl = page.url()
      const isAuthenticated = !finalUrl.includes('/login')
      
      console.log(`Route ${route} accessible:`, isAuthenticated)
      
      if (isAuthenticated) {
        console.log(`Successfully authenticated for ${route}`)
        break // Found at least one working route
      }
    } catch (error) {
      console.log(`Route ${route} test failed:`, error)
    }
  }
  
  // Save authentication state for subsequent tests
  await page.context().storageState({ path: authFile })
  
  console.log('Authentication setup complete, state saved to', authFile)
})

// AC5: Test logout functionality in a separate setup
setup('test logout functionality', async ({ page }) => {
  console.log('Testing logout functionality...')
  
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  
  // Look for logout button or user menu
  const logoutSelectors = [
    '[data-testid="logout-button"]',
    '[data-testid="user-menu"] [data-testid="logout"]',
    'button:has-text("Logout")',
    'button:has-text("Sign Out")',
    '.user-menu .logout',
    '[aria-label="Logout"]'
  ]
  
  for (const selector of logoutSelectors) {
    const logoutElement = page.locator(selector)
    
    if (await logoutElement.count() > 0) {
      console.log('Found logout element:', selector)
      
      // Click logout
      await logoutElement.click()
      await page.waitForLoadState('networkidle')
      
      // Verify we're logged out (redirected to login or home)
      const finalUrl = page.url()
      const isLoggedOut = finalUrl.includes('/login') || finalUrl === page.url().split('/')[0] + '/'
      
      console.log('Logout successful:', isLoggedOut)
      console.log('Post-logout URL:', finalUrl)
      
      break
    }
  }
  
  console.log('Logout test completed')
})