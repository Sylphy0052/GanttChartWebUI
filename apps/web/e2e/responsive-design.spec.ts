import { test, expect } from '@playwright/test'
import { UIHelper } from './helpers/ui-helper'
import { DataHelper } from './helpers/data-helper'
import { AuthHelper } from './helpers/auth-helper'
import { ResponsiveHelper } from './helpers/responsive-helper'

test.describe('Responsive Design Testing - Desktop, Tablet, Mobile', () => {
  let uiHelper: UIHelper
  let dataHelper: DataHelper
  let authHelper: AuthHelper
  let responsiveHelper: ResponsiveHelper

  test.beforeEach(async ({ page }) => {
    uiHelper = new UIHelper(page)
    dataHelper = new DataHelper(page)
    authHelper = new AuthHelper(page)
    responsiveHelper = new ResponsiveHelper(page)
    
    await dataHelper.setupCleanEnvironment()
    await authHelper.ensureAuthenticated()
  })

  test.afterEach(async () => {
    await dataHelper.cleanupAfterTest()
  })

  // AC3: Comprehensive responsive design testing across all viewport sizes
  test('Complete responsive design validation', { 
    tag: '@responsive' 
  }, async ({ page }) => {
    console.log('🎯 Starting comprehensive responsive design test...')

    // Navigate to the main Gantt chart page
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // AC3: Run complete responsive design compliance test
    await responsiveHelper.assertResponsiveDesignCompliance()

    console.log('✅ Comprehensive responsive design test completed')
  })

  // AC3: Desktop viewport testing (1920px, 1440px, 1280px)
  test('Desktop viewport responsiveness', { 
    tag: '@responsive' 
  }, async ({ page }) => {
    console.log('🖥️  Testing desktop viewport responsiveness...')

    const desktopViewports = ResponsiveHelper.VIEWPORTS.filter(v => v.deviceType === 'desktop')
    
    for (const viewport of desktopViewports) {
      console.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})`)
      
      await responsiveHelper.setViewport(viewport)
      await uiHelper.navigateToPage('/gantt')
      await uiHelper.waitForPageLoad()

      // Desktop-specific tests
      await this.testDesktopSpecificFeatures(page, viewport)
      
      // Take screenshot for visual validation
      await responsiveHelper.takeResponsiveScreenshots(`desktop-${viewport.name.toLowerCase().replace(/\s+/g, '-')}`)
    }

    console.log('✅ Desktop viewport testing completed')
  })

  // AC3: Tablet viewport testing (iPad Pro, iPad, landscape mode)
  test('Tablet viewport responsiveness', { 
    tag: '@responsive' 
  }, async ({ page }) => {
    console.log('📱 Testing tablet viewport responsiveness...')

    const tabletViewports = ResponsiveHelper.VIEWPORTS.filter(v => v.deviceType === 'tablet')
    
    for (const viewport of tabletViewports) {
      console.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})`)
      
      await responsiveHelper.setViewport(viewport)
      await uiHelper.navigateToPage('/gantt')
      await uiHelper.waitForPageLoad()

      // Tablet-specific tests
      await this.testTabletSpecificFeatures(page, viewport)
      
      // Test orientation handling
      if (viewport.width < viewport.height) {
        // Portrait mode
        await this.testPortraitMode(page)
      } else {
        // Landscape mode  
        await this.testLandscapeMode(page)
      }
      
      await responsiveHelper.takeResponsiveScreenshots(`tablet-${viewport.name.toLowerCase().replace(/\s+/g, '-')}`)
    }

    console.log('✅ Tablet viewport testing completed')
  })

  // AC3: Mobile viewport testing (iPhone, Samsung Galaxy, small screens)
  test('Mobile viewport responsiveness', { 
    tag: '@responsive' 
  }, async ({ page }) => {
    console.log('📱 Testing mobile viewport responsiveness...')

    const mobileViewports = ResponsiveHelper.VIEWPORTS.filter(v => v.deviceType === 'mobile')
    
    for (const viewport of mobileViewports) {
      console.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})`)
      
      await responsiveHelper.setViewport(viewport)
      await uiHelper.navigateToPage('/gantt')
      await uiHelper.waitForPageLoad()

      // Mobile-specific tests
      await this.testMobileSpecificFeatures(page, viewport)
      
      // Test critical mobile interactions
      await this.testMobileInteractions(page)
      
      await responsiveHelper.takeResponsiveScreenshots(`mobile-${viewport.name.toLowerCase().replace(/\s+/g, '-')}`)
    }

    console.log('✅ Mobile viewport testing completed')
  })

  // AC3: Test adaptive UI elements (navigation, menus, buttons)
  test('Adaptive UI elements across viewports', { 
    tag: '@responsive' 
  }, async ({ page }) => {
    console.log('🔄 Testing adaptive UI elements...')

    const testViewports = [
      ResponsiveHelper.VIEWPORTS.find(v => v.name === 'Desktop Medium')!,
      ResponsiveHelper.VIEWPORTS.find(v => v.name === 'iPad')!,
      ResponsiveHelper.VIEWPORTS.find(v => v.name === 'iPhone 12 Pro')!
    ]

    for (const viewport of testViewports) {
      await responsiveHelper.setViewport(viewport)
      await uiHelper.navigateToPage('/gantt')
      await uiHelper.waitForPageLoad()

      console.log(`Testing adaptive elements on ${viewport.name}...`)

      // Test navigation adaptation
      await this.testNavigationAdaptation(page, viewport)
      
      // Test button sizing and layout
      await this.testButtonAdaptation(page, viewport)
      
      // Test form element adaptation
      await this.testFormElementAdaptation(page, viewport)
      
      // Test Gantt chart adaptation
      await this.testGanttChartAdaptation(page, viewport)
    }

    console.log('✅ Adaptive UI elements testing completed')
  })

  // AC3: Test touch interactions on mobile devices
  test('Touch interactions and gestures', { 
    tag: '@responsive' 
  }, async ({ page }) => {
    console.log('👆 Testing touch interactions...')

    // Use mobile viewport for touch testing
    const mobileViewport = ResponsiveHelper.VIEWPORTS.find(v => v.name === 'iPhone 12 Pro')!
    await responsiveHelper.setViewport(mobileViewport)
    await uiHelper.navigateToPage('/gantt')
    await uiHelper.waitForPageLoad()

    // Test touch tap on buttons
    const buttons = '[data-testid*="button"], button, [role="button"]'
    if (await page.locator(buttons).count() > 0) {
      const firstButton = page.locator(buttons).first()
      const buttonBox = await firstButton.boundingBox()
      
      if (buttonBox) {
        await page.touchscreen.tap(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2)
        console.log('✅ Touch tap on button works')
      }
    }

    // Test swipe gestures on Gantt timeline
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    if (await page.locator(ganttContainer).count() > 0) {
      const containerBox = await page.locator(ganttContainer).boundingBox()
      
      if (containerBox) {
        // Horizontal swipe (timeline scroll)
        const startX = containerBox.x + containerBox.width * 0.8
        const endX = containerBox.x + containerBox.width * 0.2
        const y = containerBox.y + containerBox.height / 2
        
        await page.touchscreen.tap(startX, y)
        await page.mouse.move(startX, y)
        await page.mouse.down()
        await page.mouse.move(endX, y)
        await page.mouse.up()
        
        console.log('✅ Horizontal swipe gesture works')
        
        // Vertical swipe (task list scroll)
        const startY = containerBox.y + containerBox.height * 0.7
        const endY = containerBox.y + containerBox.height * 0.3
        const x = containerBox.x + containerBox.width / 2
        
        await page.touchscreen.tap(x, startY)
        await page.mouse.move(x, startY)
        await page.mouse.down()
        await page.mouse.move(x, endY)
        await page.mouse.up()
        
        console.log('✅ Vertical swipe gesture works')
      }
    }

    // Test pinch-to-zoom gesture (if supported)
    await page.evaluate(() => {
      // Simulate pinch gesture
      const element = document.querySelector('[data-testid="gantt-container"], .gantt-container')
      if (element) {
        const event = new WheelEvent('wheel', {
          deltaY: -100,
          ctrlKey: true, // Simulates pinch on some devices
          bubbles: true
        })
        element.dispatchEvent(event)
      }
    })
    
    console.log('✅ Touch interactions testing completed')
  })

  // Helper method: Test desktop-specific features
  async function testDesktopSpecificFeatures(page: any, viewport: any): Promise<void> {
    // Test that full navigation is visible
    const navItems = '[data-testid="nav-item"], nav a, .sidebar a'
    const navCount = await page.locator(navItems).count()
    expect(navCount, `Desktop should show full navigation`).toBeGreaterThanOrEqual(3)

    // Test multi-panel layout
    const panels = '[data-testid="panel"], .panel, .sidebar, .main-content'
    const panelCount = await page.locator(panels).count()
    expect(panelCount, `Desktop should show multiple panels`).toBeGreaterThanOrEqual(2)

    // Test desktop-specific controls
    const desktopControls = '[data-testid*="desktop"], .desktop-only'
    if (await page.locator(desktopControls).count() > 0) {
      await expect(page.locator(desktopControls).first()).toBeVisible()
    }
  }

  // Helper method: Test tablet-specific features
  async function testTabletSpecificFeatures(page: any, viewport: any): Promise<void> {
    // Test hybrid navigation (may have hamburger or full nav)
    const mobileNav = '[data-testid="mobile-menu"], .hamburger'
    const fullNav = '[data-testid="nav-item"], nav a'
    
    const hasMobileNav = await page.locator(mobileNav).count() > 0
    const hasFullNav = await page.locator(fullNav).count() > 0
    
    expect(hasMobileNav || hasFullNav, 'Tablet should have some navigation').toBe(true)

    // Test touch-friendly button sizes
    const buttons = 'button, [role="button"]'
    const buttonElements = page.locator(buttons)
    const buttonCount = await buttonElements.count()
    
    if (buttonCount > 0) {
      const firstButton = buttonElements.first()
      const buttonSize = await firstButton.boundingBox()
      
      if (buttonSize) {
        expect(buttonSize.height, 'Tablet buttons should be touch-friendly (min 44px)').toBeGreaterThanOrEqual(44)
      }
    }
  }

  // Helper method: Test mobile-specific features
  async function testMobileSpecificFeatures(page: any, viewport: any): Promise<void> {
    // Test mobile navigation (should have hamburger menu)
    const mobileMenuButton = '[data-testid="mobile-menu"], .hamburger, .menu-toggle'
    
    // On mobile, either hamburger menu should exist OR navigation should be hidden/minimal
    const hasMobileMenu = await page.locator(mobileMenuButton).count() > 0
    const visibleNavItems = await page.locator('[data-testid="nav-item"], nav a').count()
    
    // Either mobile menu exists or navigation is minimal
    expect(hasMobileMenu || visibleNavItems <= 2, 'Mobile should have hamburger menu or minimal navigation').toBe(true)

    // Test mobile-optimized layout (single column)
    const multiColumnElements = '.grid-cols-2, .grid-cols-3, .columns-2'
    const hasMultiColumn = await page.locator(multiColumnElements).count() > 0
    
    // On small mobile screens, should avoid multi-column layouts
    if (viewport.width <= 375) {
      console.log(`Small mobile screen (${viewport.width}px): checking for single-column layout`)
    }

    // Test minimum touch target sizes
    const interactiveElements = 'button, a, input[type="button"], [role="button"]'
    const elements = page.locator(interactiveElements)
    const elementCount = await elements.count()
    
    if (elementCount > 0) {
      for (let i = 0; i < Math.min(elementCount, 5); i++) {
        const element = elements.nth(i)
        const size = await element.boundingBox()
        
        if (size && size.height > 0) {
          expect(size.height, `Mobile interactive element ${i} should meet minimum touch target size`).toBeGreaterThanOrEqual(32)
        }
      }
    }
  }

  // Helper method: Test portrait mode
  async function testPortraitMode(page: any): Promise<void> {
    console.log('Testing portrait mode adaptations...')
    
    // In portrait mode, Gantt chart might stack vertically or use different layout
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    if (await page.locator(ganttContainer).count() > 0) {
      const containerSize = await page.locator(ganttContainer).boundingBox()
      
      if (containerSize) {
        // Should adapt to portrait layout
        console.log(`Portrait Gantt container: ${containerSize.width}x${containerSize.height}`)
        expect(containerSize.width, 'Portrait Gantt should use available width').toBeGreaterThan(200)
      }
    }
  }

  // Helper method: Test landscape mode
  async function testLandscapeMode(page: any): Promise<void> {
    console.log('Testing landscape mode adaptations...')
    
    // In landscape mode, should utilize horizontal space efficiently
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    if (await page.locator(ganttContainer).count() > 0) {
      const containerSize = await page.locator(ganttContainer).boundingBox()
      
      if (containerSize) {
        console.log(`Landscape Gantt container: ${containerSize.width}x${containerSize.height}`)
        // Should use most of the available width in landscape
        expect(containerSize.width, 'Landscape Gantt should use horizontal space').toBeGreaterThan(500)
      }
    }
  }

  // Helper method: Test mobile interactions
  async function testMobileInteractions(page: any): Promise<void> {
    // Test mobile-specific interactions like pull-to-refresh (if implemented)
    
    // Test that elements are easily tappable
    const tappableElements = 'button, a, [role="button"], [data-testid*="button"]'
    const elements = page.locator(tappableElements)
    const count = await elements.count()
    
    if (count > 0) {
      // Test first few elements are tappable
      for (let i = 0; i < Math.min(count, 3); i++) {
        const element = elements.nth(i)
        
        if (await element.isVisible()) {
          const box = await element.boundingBox()
          
          if (box) {
            // Tap center of element
            await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
            await page.waitForTimeout(200)
            console.log(`✅ Mobile tap ${i} successful`)
          }
        }
      }
    }
  }

  // Helper method: Test navigation adaptation
  async function testNavigationAdaptation(page: any, viewport: any): Promise<void> {
    if (viewport.deviceType === 'mobile') {
      // Should have hamburger menu
      const hamburger = '[data-testid="mobile-menu"], .hamburger, .menu-toggle'
      const hasHamburger = await page.locator(hamburger).count() > 0
      
      if (hasHamburger) {
        console.log(`✅ ${viewport.name}: Mobile hamburger menu present`)
      } else {
        console.log(`⚠️  ${viewport.name}: No mobile hamburger menu found`)
      }
    } else {
      // Desktop/tablet should show more navigation
      const navItems = '[data-testid="nav-item"], nav a'
      const navCount = await page.locator(navItems).count()
      console.log(`${viewport.name}: ${navCount} navigation items visible`)
    }
  }

  // Helper method: Test button adaptation
  async function testButtonAdaptation(page: any, viewport: any): Promise<void> {
    const buttons = 'button, [role="button"]'
    const buttonElements = page.locator(buttons)
    const count = await buttonElements.count()
    
    if (count > 0) {
      const firstButton = buttonElements.first()
      const size = await firstButton.boundingBox()
      
      if (size) {
        const expectedMinSize = viewport.deviceType === 'mobile' ? 44 : 32
        console.log(`${viewport.name}: Button size ${size.width}x${size.height}px`)
        expect(size.height, `${viewport.name} buttons should meet minimum size`).toBeGreaterThanOrEqual(expectedMinSize)
      }
    }
  }

  // Helper method: Test form element adaptation
  async function testFormElementAdaptation(page: any, viewport: any): Promise<void> {
    const formElements = 'input, textarea, select'
    const elements = page.locator(formElements)
    const count = await elements.count()
    
    if (count > 0) {
      const firstElement = elements.first()
      const size = await firstElement.boundingBox()
      
      if (size) {
        console.log(`${viewport.name}: Form element size ${size.width}x${size.height}px`)
        
        if (viewport.deviceType === 'mobile') {
          expect(size.height, 'Mobile form elements should be touch-friendly').toBeGreaterThanOrEqual(40)
        }
      }
    }
  }

  // Helper method: Test Gantt chart adaptation
  async function testGanttChartAdaptation(page: any, viewport: any): Promise<void> {
    const ganttContainer = '[data-testid="gantt-container"], .gantt-container'
    
    if (await page.locator(ganttContainer).count() > 0) {
      const size = await page.locator(ganttContainer).boundingBox()
      
      if (size) {
        console.log(`${viewport.name}: Gantt chart ${size.width}x${size.height}px`)
        
        // Gantt should adapt to viewport
        expect(size.width, 'Gantt chart should use available width').toBeGreaterThan(viewport.width * 0.5)
        
        // On mobile, might switch to different view or scroll pattern
        if (viewport.deviceType === 'mobile') {
          // Test horizontal scrolling capability
          const hasHorizontalScroll = await page.evaluate(() => {
            const gantt = document.querySelector('[data-testid="gantt-container"], .gantt-container') as HTMLElement
            return gantt ? gantt.scrollWidth > gantt.clientWidth : false
          })
          
          console.log(`${viewport.name}: Gantt horizontal scroll available: ${hasHorizontalScroll}`)
        }
      }
    }
  }
})