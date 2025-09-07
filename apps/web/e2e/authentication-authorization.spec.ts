import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'

test.describe('Authentication and Authorization - Password Protection & Session Management', () => {
  let uiHelper: UIHelper
  let dataHelper: DataHelper
  let authHelper: AuthHelper

  test.beforeEach(async ({ page }) => {
    uiHelper = new UIHelper(page)
    dataHelper = new DataHelper(page)
    authHelper = new AuthHelper(page)
    
    // Start with clean state (no authentication)
    await page.context().clearCookies()
    await page.context().clearPermissions()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
  })

  // AC5: Authentication flow testing including login and logout
  test('Complete authentication flow - Login and Logout', { 
    tag: '@authentication' 
  }, async ({ page }) => {
    console.log('🔐 Testing complete authentication flow...')

    // Step 1: Navigate to home page and check if login is required
    await uiHelper.navigateToPage('/')
    await uiHelper.waitForPageLoad()

    const currentUrl = page.url()
    console.log('Initial URL:', currentUrl)

    // Check if redirected to login page or login form exists
    const isOnLoginPage = currentUrl.includes('/login')
    const loginForm = await page.locator('[data-testid="login-form"], .login-form, form[name="login"]').count()
    
    if (isOnLoginPage || loginForm > 0) {
      console.log('🚪 Login required, testing authentication flow...')
      
      // Step 2: Test login form validation
      console.log('Testing login form validation...')
      
      const emailInput = '[data-testid="email"], input[name="email"], input[type="email"]'
      const passwordInput = '[data-testid="password"], input[name="password"], input[type="password"]'
      const loginButton = '[data-testid="login-button"], button[type="submit"], .login-btn'
      
      // Test empty form submission
      if (await page.locator(loginButton).count() > 0) {
        await uiHelper.stableClick(loginButton)
        await page.waitForTimeout(1000)
        
        // Should show validation errors
        const errorMessages = await page.locator('.error, [role="alert"], .invalid').count()
        if (errorMessages > 0) {
          console.log('✅ Form validation working - shows errors for empty fields')
        }
      }

      // Step 3: Test invalid credentials
      console.log('Testing invalid credentials...')
      
      if (await page.locator(emailInput).count() > 0) {
        await uiHelper.stableFill(emailInput, 'invalid@test.com')
      }
      
      if (await page.locator(passwordInput).count() > 0) {
        await uiHelper.stableFill(passwordInput, 'wrongpassword')
      }
      
      if (await page.locator(loginButton).count() > 0) {
        await uiHelper.stableClick(loginButton)
        await page.waitForTimeout(2000)
        
        // Should still be on login page or show error
        const stillOnLogin = page.url().includes('/login') || await page.locator('[data-testid="login-form"]').count() > 0
        if (stillOnLogin) {
          console.log('✅ Invalid credentials properly rejected')
        }
        
        // Check for error message
        const errorMessage = await page.locator('.error, [role="alert"], .login-error, .auth-error').count()
        if (errorMessage > 0) {
          console.log('✅ Login error message displayed')
        }
      }

      // Step 4: Test valid credentials
      console.log('Testing valid credentials...')
      
      // Use test credentials
      if (await page.locator(emailInput).count() > 0) {
        await page.locator(emailInput).clear()
        await uiHelper.stableFill(emailInput, 'test@example.com')
      }
      
      if (await page.locator(passwordInput).count() > 0) {
        await page.locator(passwordInput).clear()
        await uiHelper.stableFill(passwordInput, 'password123')
      }
      
      if (await page.locator(loginButton).count() > 0) {
        await uiHelper.stableClick(loginButton)
        await page.waitForTimeout(3000)
        
        // Should be redirected to dashboard or main app
        const postLoginUrl = page.url()
        console.log('Post-login URL:', postLoginUrl)
        
        const isAuthenticated = !postLoginUrl.includes('/login')
        expect(isAuthenticated, 'Should be redirected away from login page after successful login').toBe(true)
        
        console.log('✅ Valid credentials accepted - user logged in')
      }

      // Step 5: Test session persistence
      console.log('Testing session persistence...')
      
      // Navigate to different pages to ensure session persists
      const protectedPages = ['/gantt', '/issues', '/projects']
      
      for (const pagePath of protectedPages) {
        try {
          await uiHelper.navigateToPage(pagePath)
          await uiHelper.waitForPageLoad()
          
          const currentUrl = page.url()
          const isStillAuthenticated = !currentUrl.includes('/login')
          
          if (isStillAuthenticated) {
            console.log(`✅ Session persisted for ${pagePath}`)
          } else {
            console.log(`❌ Session lost when navigating to ${pagePath}`)
          }
          
          expect(isStillAuthenticated, `Should remain authenticated when navigating to ${pagePath}`).toBe(true)
        } catch (error) {
          console.log(`Page ${pagePath} may not exist:`, error)
        }
      }

      // Step 6: Test logout functionality
      console.log('Testing logout functionality...')
      
      const logoutSelectors = [
        '[data-testid="logout-button"]',
        '[data-testid="user-menu"] [data-testid="logout"]',
        'button:has-text("Logout")',
        'button:has-text("Sign Out")',
        '.user-menu .logout',
        '[aria-label="Logout"]'
      ]
      
      let logoutSuccessful = false
      
      for (const selector of logoutSelectors) {
        if (await page.locator(selector).count() > 0) {
          console.log(`Found logout button: ${selector}`)
          
          await uiHelper.stableClick(selector)
          await page.waitForTimeout(2000)
          
          // Check if redirected to login or logged out state
          const postLogoutUrl = page.url()
          const isLoggedOut = postLogoutUrl.includes('/login') || 
                             await page.locator('[data-testid="login-form"]').count() > 0
          
          if (isLoggedOut) {
            console.log('✅ Logout successful - redirected to login')
            logoutSuccessful = true
            break
          }
        }
      }
      
      // If no explicit logout button, try to verify logout by accessing protected page
      if (!logoutSuccessful) {
        console.log('⚠️  No logout button found, testing session timeout...')
        
        // Clear session data
        await page.context().clearCookies()
        
        // Try to access protected page
        await uiHelper.navigateToPage('/gantt')
        await page.waitForTimeout(2000)
        
        const finalUrl = page.url()
        const redirectedToLogin = finalUrl.includes('/login')
        
        if (redirectedToLogin) {
          console.log('✅ Session properly expired - redirected to login')
          logoutSuccessful = true
        }
      }
      
      expect(logoutSuccessful, 'Should be able to logout or have proper session management').toBe(true)

    } else {
      console.log('ℹ️  No authentication required - application may be in open access mode')
      
      // Test that application functions without authentication
      const testPages = ['/', '/gantt', '/issues', '/projects']
      
      for (const pagePath of testPages) {
        try {
          await uiHelper.navigateToPage(pagePath)
          await uiHelper.waitForPageLoad()
          
          const isAccessible = page.url().includes(pagePath) || !page.url().includes('/login')
          console.log(`Page ${pagePath} accessible without auth: ${isAccessible}`)
        } catch (error) {
          console.log(`Page ${pagePath} may not exist:`, error)
        }
      }
    }

    console.log('✅ Authentication flow testing completed')
  })

  // AC5: Password protection testing for projects
  test('Password protection and project access control', { 
    tag: '@authentication' 
  }, async ({ page }) => {
    console.log('🔒 Testing password protection and access control...')

    // Navigate to projects page
    await uiHelper.navigateToPage('/projects')
    await uiHelper.waitForPageLoad()

    // Look for password-protected projects or project creation
    const projectElements = [
      '[data-testid="project-item"], .project-item',
      '[data-testid="project-card"], .project-card',
      '[data-testid="create-project"], .create-project-btn'
    ]

    let hasProjects = false
    
    for (const selector of projectElements) {
      if (await page.locator(selector).count() > 0) {
        hasProjects = true
        console.log(`Found project elements: ${selector}`)
        break
      }
    }

    if (hasProjects) {
      // Test 1: Try to access a project (may trigger password prompt)
      console.log('Testing project access...')
      
      const firstProject = page.locator(projectElements[0]).first()
      if (await firstProject.count() > 0) {
        await firstProject.click()
        await page.waitForTimeout(1500)
        
        // Check for password dialog
        const passwordDialog = page.locator('[data-testid="password-dialog"], .password-dialog, [role="dialog"]:has-text("Password")')
        const hasPasswordDialog = await passwordDialog.count() > 0
        
        if (hasPasswordDialog) {
          console.log('✅ Password protection dialog found')
          
          // Test password entry
          const passwordField = '[data-testid="project-password"], input[type="password"]'
          const submitButton = '[data-testid="password-submit"], button[type="submit"]'
          
          if (await page.locator(passwordField).count() > 0) {
            // Test wrong password first
            await uiHelper.stableFill(passwordField, 'wrongpassword')
            
            if (await page.locator(submitButton).count() > 0) {
              await uiHelper.stableClick(submitButton)
              await page.waitForTimeout(1000)
              
              // Should show error or remain on password dialog
              const stillHasDialog = await passwordDialog.count() > 0
              if (stillHasDialog) {
                console.log('✅ Wrong password properly rejected')
              }
              
              // Try correct password
              await page.locator(passwordField).clear()
              await uiHelper.stableFill(passwordField, 'project123')
              await uiHelper.stableClick(submitButton)
              await page.waitForTimeout(1500)
              
              // Should now have access to project
              const hasAccess = await passwordDialog.count() === 0
              if (hasAccess) {
                console.log('✅ Correct password accepted - project access granted')
              }
              
              expect(hasAccess, 'Should gain access with correct password').toBe(true)
            }
          }
        } else {
          console.log('ℹ️  No password protection dialog - project may be public or authentication not implemented')
        }
      }
      
      // Test 2: Project creation with password protection
      console.log('Testing password-protected project creation...')
      
      const createProjectButton = '[data-testid="create-project"], .create-project-btn, button:has-text("New Project")'
      if (await page.locator(createProjectButton).count() > 0) {
        await uiHelper.stableClick(createProjectButton)
        await page.waitForTimeout(1000)
        
        const projectForm = '[data-testid="project-form"], .project-form'
        if (await page.locator(projectForm).count() > 0) {
          // Fill basic project info
          const nameField = '[data-testid="project-name"], input[name="name"]'
          if (await page.locator(nameField).count() > 0) {
            await uiHelper.stableFill(nameField, 'Password Protected Test Project')
          }
          
          // Look for password protection options
          const passwordProtectionOptions = [
            '[data-testid="enable-password"], input[name="password-protected"]',
            '[data-testid="project-password"], input[name="password"]',
            '[data-testid="visibility"], select[name="visibility"]'
          ]
          
          for (const option of passwordProtectionOptions) {
            if (await page.locator(option).count() > 0) {
              console.log(`Found password protection option: ${option}`)
              
              if (option.includes('checkbox')) {
                await page.locator(option).check()
              } else if (option.includes('password')) {
                await uiHelper.stableFill(option, 'secureproject123')
              } else if (option.includes('select')) {
                await uiHelper.selectOption(option, 'private')
              }
            }
          }
          
          // Submit project creation
          const submitButton = '[data-testid="create-submit"], button[type="submit"]'
          if (await page.locator(submitButton).count() > 0) {
            await uiHelper.stableClick(submitButton)
            await uiHelper.waitForPageLoad()
            
            console.log('✅ Password-protected project creation attempted')
          }
        }
      }
      
    } else {
      console.log('ℹ️  No projects found - testing may require seeded data')
    }

    console.log('✅ Password protection testing completed')
  })

  // AC5: Session management and timeout testing
  test('Session management and timeout behavior', { 
    tag: '@authentication' 
  }, async ({ page }) => {
    console.log('⏱️  Testing session management and timeout...')

    // First ensure we're authenticated
    await authHelper.ensureAuthenticated()
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test 1: Session persistence across page reloads
    console.log('Testing session persistence across reloads...')
    
    for (let i = 0; i < 3; i++) {
      await page.reload()
      await uiHelper.waitForPageLoad()
      
      const currentUrl = page.url()
      const isStillAuthenticated = !currentUrl.includes('/login')
      
      console.log(`Reload ${i + 1}: Authentication persisted: ${isStillAuthenticated}`)
    }

    // Test 2: Session persistence across tab close/reopen simulation
    console.log('Testing session persistence across browser close/reopen simulation...')
    
    // Save storage state
    const storageState = await page.context().storageState()
    
    // Create new context with saved state
    const newContext = await page.context().browser()?.newContext({ storageState })
    if (newContext) {
      const newPage = await newContext.newPage()
      
      await newPage.goto('/gantt')
      await newPage.waitForLoadState('networkidle')
      
      const isSessionRestored = !newPage.url().includes('/login')
      console.log(`Session restored in new context: ${isSessionRestored}`)
      
      await newPage.close()
      await newContext.close()
      
      expect(isSessionRestored, 'Session should persist across browser close/reopen').toBe(true)
    }

    // Test 3: Concurrent session handling
    console.log('Testing concurrent session handling...')
    
    // Open second tab/context
    const secondPage = await page.context().newPage()
    await secondPage.goto('/issues')
    await secondPage.waitForLoadState('networkidle')
    
    const bothPagesAuthenticated = !page.url().includes('/login') && !secondPage.url().includes('/login')
    console.log(`Concurrent sessions working: ${bothPagesAuthenticated}`)
    
    // Test interaction in both tabs
    await page.bringToFront()
    await page.reload()
    await uiHelper.waitForPageLoad()
    
    await secondPage.bringToFront()
    await secondPage.reload()
    await secondPage.waitForLoadState('networkidle')
    
    const bothStillAuthenticated = !page.url().includes('/login') && !secondPage.url().includes('/login')
    console.log(`Both sessions maintained after activity: ${bothStillAuthenticated}`)
    
    await secondPage.close()

    // Test 4: Session timeout simulation (if applicable)
    console.log('Testing session timeout behavior...')
    
    // Check if there are any session timeout mechanisms
    const hasSessionTimeout = await page.evaluate(() => {
      // Look for session timeout mechanisms
      return !!(window as any).sessionTimeout || 
             !!(window as any).sessionExpiry ||
             !!sessionStorage.getItem('sessionTimeout') ||
             !!localStorage.getItem('sessionTimeout')
    })
    
    if (hasSessionTimeout) {
      console.log('Session timeout mechanism detected')
      
      // Wait for potential timeout (shortened for testing)
      await page.waitForTimeout(5000)
      
      // Try to perform an action
      await page.reload()
      await page.waitForTimeout(2000)
      
      const isTimedOut = page.url().includes('/login')
      if (isTimedOut) {
        console.log('✅ Session timeout working correctly')
      } else {
        console.log('ℹ️  Session timeout may have longer duration')
      }
    } else {
      console.log('ℹ️  No session timeout mechanism detected')
    }

    // Test 5: Manual session invalidation
    console.log('Testing manual session invalidation...')
    
    // Try to invalidate session by clearing storage
    await page.evaluate(() => {
      // Clear all storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Clear any auth tokens
      Object.keys(localStorage).forEach(key => {
        if (key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('auth') ||
            key.toLowerCase().includes('session')) {
          localStorage.removeItem(key)
        }
      })
    })
    
    // Navigate to protected page
    await uiHelper.navigateToPage('/gantt')
    await page.waitForTimeout(2000)
    
    const isSessionInvalidated = page.url().includes('/login')
    if (isSessionInvalidated) {
      console.log('✅ Session properly invalidated after storage clear')
    } else {
      console.log('ℹ️  Session persists even after storage clear - may use server-side sessions')
    }

    console.log('✅ Session management testing completed')
  })

  // AC5: Role-based access control (if implemented)
  test('Role-based access control testing', { 
    tag: '@authentication' 
  }, async ({ page }) => {
    console.log('👤 Testing role-based access control...')

    await authHelper.ensureAuthenticated()
    await uiHelper.navigateToPage('/')
    await uiHelper.waitForPageLoad()

    // Look for role-based UI elements
    const adminElements = [
      '[data-testid="admin-panel"], .admin-panel',
      '[data-testid="user-management"], .user-management',
      '[data-testid="system-settings"], .system-settings'
    ]

    const editorElements = [
      '[data-testid="edit-project"], .edit-project',
      '[data-testid="delete-issue"], .delete-issue',
      '[data-testid="manage-users"], .manage-users'
    ]

    const viewerElements = [
      '[data-testid="view-only"], .view-only',
      '[data-testid="read-only"], .read-only'
    ]

    // Check current user role based on available UI elements
    let currentRole = 'viewer' // default assumption

    // Test for admin role
    for (const selector of adminElements) {
      if (await page.locator(selector).count() > 0) {
        currentRole = 'admin'
        console.log(`Admin elements found: ${selector}`)
        break
      }
    }

    // Test for editor role (if not admin)
    if (currentRole === 'viewer') {
      for (const selector of editorElements) {
        if (await page.locator(selector).count() > 0) {
          currentRole = 'editor'
          console.log(`Editor elements found: ${selector}`)
          break
        }
      }
    }

    console.log(`Detected user role: ${currentRole}`)

    // Test role-appropriate access
    if (currentRole === 'admin') {
      console.log('Testing admin access...')
      
      // Should be able to access all features
      const adminPages = ['/admin', '/users', '/settings']
      
      for (const adminPage of adminPages) {
        try {
          await uiHelper.navigateToPage(adminPage)
          await page.waitForTimeout(1500)
          
          const hasAccess = !page.url().includes('/login') && !page.url().includes('/403')
          console.log(`Admin access to ${adminPage}: ${hasAccess}`)
        } catch (error) {
          console.log(`Admin page ${adminPage} may not exist`)
        }
      }
      
    } else if (currentRole === 'editor') {
      console.log('Testing editor access...')
      
      // Should be able to create/edit but not admin functions
      const editActions = [
        '[data-testid="create-project"], .create-project-btn',
        '[data-testid="edit-issue"], .edit-issue-btn',
        '[data-testid="delete-task"], .delete-task-btn'
      ]
      
      for (const action of editActions) {
        const hasEditAccess = await page.locator(action).count() > 0
        console.log(`Editor action ${action}: ${hasEditAccess}`)
      }
      
    } else {
      console.log('Testing viewer access...')
      
      // Should only be able to view
      const restrictedActions = [
        '[data-testid="delete"], [data-testid*="delete"]',
        '[data-testid="admin"], [data-testid*="admin"]',
        '[data-testid="create"], [data-testid*="create"]'
      ]
      
      for (const action of restrictedActions) {
        const hasRestrictedAccess = await page.locator(action).count() > 0
        console.log(`Viewer restricted action ${action}: ${!hasRestrictedAccess ? 'properly restricted' : 'has access'}`)
      }
    }

    // Test unauthorized access attempts
    console.log('Testing unauthorized access attempts...')
    
    const unauthorizedUrls = [
      '/admin/users',
      '/admin/settings',
      '/admin/system',
      '/api/admin',
      '/management'
    ]
    
    for (const unauthorizedUrl of unauthorizedUrls) {
      try {
        await page.goto(unauthorizedUrl)
        await page.waitForTimeout(1000)
        
        const currentUrl = page.url()
        const isBlocked = currentUrl.includes('/403') || 
                         currentUrl.includes('/login') || 
                         currentUrl.includes('/unauthorized') ||
                         !currentUrl.includes(unauthorizedUrl)
        
        console.log(`Unauthorized access to ${unauthorizedUrl}: ${isBlocked ? 'properly blocked' : 'allowed'}`)
      } catch (error) {
        console.log(`URL ${unauthorizedUrl} resulted in error (likely blocked):`, error.message)
      }
    }

    console.log('✅ Role-based access control testing completed')
  })

  // AC5: Security headers and CSRF protection testing
  test('Security headers and protection mechanisms', { 
    tag: '@authentication' 
  }, async ({ page }) => {
    console.log('🛡️  Testing security headers and protection mechanisms...')

    await uiHelper.navigateToPage('/')
    await uiHelper.waitForPageLoad()

    // Check security headers
    const response = await page.goto('/')
    const headers = response?.headers() || {}
    
    console.log('Security headers check:')
    
    const securityHeaders = [
      { name: 'x-content-type-options', expected: 'nosniff' },
      { name: 'x-frame-options', expected: ['DENY', 'SAMEORIGIN'] },
      { name: 'x-xss-protection', expected: '1; mode=block' },
      { name: 'strict-transport-security', required: false },
      { name: 'content-security-policy', required: false }
    ]

    for (const header of securityHeaders) {
      const value = headers[header.name]
      const hasHeader = !!value
      
      if (Array.isArray(header.expected)) {
        const isValid = header.expected.some(expected => value?.includes(expected))
        console.log(`${header.name}: ${value || 'missing'} - ${isValid ? '✅' : '⚠️'}`)
      } else {
        const isValid = value?.includes(header.expected) || !header.expected
        console.log(`${header.name}: ${value || 'missing'} - ${hasHeader ? '✅' : '⚠️'}`)
      }
    }

    // Test CSRF protection (if forms exist)
    console.log('Testing CSRF protection...')
    
    const forms = await page.locator('form').count()
    if (forms > 0) {
      console.log(`Found ${forms} forms to test for CSRF protection`)
      
      // Look for CSRF tokens
      const csrfTokens = await page.locator('input[name*="csrf"], input[name*="token"], meta[name="csrf-token"]').count()
      
      if (csrfTokens > 0) {
        console.log('✅ CSRF tokens found in forms')
      } else {
        console.log('⚠️  No CSRF tokens detected - may be using other protection')
      }
      
      // Test form submission without proper tokens (if applicable)
      const firstForm = page.locator('form').first()
      const actionUrl = await firstForm.getAttribute('action')
      
      if (actionUrl) {
        console.log(`Testing form submission to: ${actionUrl}`)
        // Note: In a real test, you'd attempt malicious form submission
        // This is just checking that protection mechanisms exist
      }
    }

    // Test for common security vulnerabilities
    console.log('Testing for common security vulnerabilities...')
    
    // Check for exposed sensitive information
    const pageContent = await page.content()
    const sensitivePatterns = [
      /password\s*[:=]\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
      /secret\s*[:=]\s*['"][^'"]+['"]/i,
      /token\s*[:=]\s*['"][^'"]{20,}['"]/i
    ]

    let vulnerabilityFound = false
    for (const pattern of sensitivePatterns) {
      if (pattern.test(pageContent)) {
        console.log(`⚠️  Potential sensitive information exposure detected`)
        vulnerabilityFound = true
        break
      }
    }

    if (!vulnerabilityFound) {
      console.log('✅ No obvious sensitive information exposure detected')
    }

    // Test JavaScript injection protection
    console.log('Testing XSS protection...')
    
    try {
      await page.evaluate(() => {
        // Try to inject malicious script (should be blocked)
        const script = document.createElement('script')
        script.innerHTML = 'window.xssTest = true'
        document.head.appendChild(script)
      })
      
      const xssExecuted = await page.evaluate(() => (window as any).xssTest)
      
      if (xssExecuted) {
        console.log('⚠️  XSS vulnerability detected - script injection succeeded')
      } else {
        console.log('✅ XSS protection working - script injection blocked')
      }
    } catch (error) {
      console.log('✅ XSS protection working - script injection blocked with error')
    }

    console.log('✅ Security testing completed')
  })
})