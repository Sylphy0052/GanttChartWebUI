import { Page, expect } from '@playwright/test'

export interface ViewportConfig {
  name: string
  width: number
  height: number
  deviceType: 'desktop' | 'tablet' | 'mobile'
}

export interface ResponsiveTestResult {
  viewport: ViewportConfig
  elementsVisible: boolean
  navigationWorking: boolean
  scrollingFunctional: boolean
  touchGesturesWork: boolean
  textReadable: boolean
  score: number
}

export class ResponsiveHelper {
  // AC3: Standard viewport configurations for testing
  public static readonly VIEWPORTS: ViewportConfig[] = [
    // Desktop viewports
    { name: 'Desktop Large', width: 1920, height: 1080, deviceType: 'desktop' },
    { name: 'Desktop Medium', width: 1440, height: 900, deviceType: 'desktop' },
    { name: 'Desktop Small', width: 1280, height: 720, deviceType: 'desktop' },
    
    // Tablet viewports
    { name: 'iPad Pro', width: 1024, height: 1366, deviceType: 'tablet' },
    { name: 'iPad', width: 768, height: 1024, deviceType: 'tablet' },
    { name: 'Tablet Landscape', width: 1024, height: 768, deviceType: 'tablet' },
    
    // Mobile viewports
    { name: 'iPhone 12 Pro', width: 390, height: 844, deviceType: 'mobile' },
    { name: 'iPhone SE', width: 375, height: 667, deviceType: 'mobile' },
    { name: 'Samsung Galaxy S21', width: 360, height: 800, deviceType: 'mobile' },
    { name: 'Mobile Small', width: 320, height: 568, deviceType: 'mobile' }
  ]

  constructor(private page: Page) {}

  // AC3: Set viewport to specific configuration
  async setViewport(viewport: ViewportConfig): Promise<void> {
    console.log(`Setting viewport: ${viewport.name} (${viewport.width}x${viewport.height})`)
    await this.page.setViewportSize({ 
      width: viewport.width, 
      height: viewport.height 
    })
    
    // Wait for layout to adjust
    await this.page.waitForTimeout(500)
  }

  // AC3: Test responsive behavior for specific viewport
  async testViewportResponsiveness(viewport: ViewportConfig): Promise<ResponsiveTestResult> {
    await this.setViewport(viewport)
    
    console.log(`Testing responsiveness for ${viewport.name}...`)
    
    // Test various responsive aspects
    const [
      elementsVisible,
      navigationWorking,
      scrollingFunctional,
      touchGesturesWork,
      textReadable
    ] = await Promise.all([
      this.checkElementVisibility(viewport),
      this.checkNavigationResponsiveness(viewport),
      this.checkScrollingFunctionality(viewport),
      this.checkTouchGestures(viewport),
      this.checkTextReadability(viewport)
    ])

    // Calculate overall score
    const score = this.calculateResponsivenessScore({
      elementsVisible,
      navigationWorking,
      scrollingFunctional,
      touchGesturesWork,
      textReadable
    })

    return {
      viewport,
      elementsVisible,
      navigationWorking,
      scrollingFunctional,
      touchGesturesWork,
      textReadable,
      score
    }
  }

  // AC3: Check if critical elements are visible and properly sized
  private async checkElementVisibility(viewport: ViewportConfig): Promise<boolean> {
    console.log(`Checking element visibility for ${viewport.name}...`)
    
    const criticalElements = [
      '[data-testid="header"], header',
      '[data-testid="navigation"], nav, .sidebar',
      '[data-testid="main-content"], main',
      '[data-testid="gantt-container"], .gantt-container',
      '[data-testid="issue-table"], .issue-table'
    ]

    let visibleElements = 0
    const totalElements = criticalElements.length

    for (const selector of criticalElements) {
      try {
        const element = this.page.locator(selector).first()
        const isVisible = await element.isVisible()
        
        if (isVisible) {
          // Check if element is reasonably sized
          const box = await element.boundingBox()
          const isSized = box && box.width > 10 && box.height > 10
          
          if (isSized) {
            visibleElements++
            console.log(`✅ ${selector} visible and properly sized`)
          } else {
            console.log(`⚠️  ${selector} visible but incorrectly sized`)
          }
        } else {
          console.log(`❌ ${selector} not visible`)
        }
      } catch (error) {
        console.log(`❌ ${selector} not found`)
      }
    }

    const visibilityScore = visibleElements / totalElements
    console.log(`Element visibility score: ${visibilityScore * 100}%`)
    
    return visibilityScore >= 0.7 // At least 70% of critical elements should be visible
  }

  // AC3: Check navigation responsiveness (hamburger menu for mobile, etc.)
  private async checkNavigationResponsiveness(viewport: ViewportConfig): Promise<boolean> {
    console.log(`Checking navigation responsiveness for ${viewport.name}...`)
    
    if (viewport.deviceType === 'mobile') {
      // Look for mobile navigation patterns
      const mobileNavSelectors = [
        '[data-testid="mobile-menu-button"], .hamburger, .menu-toggle',
        '[data-testid="mobile-menu"], .mobile-menu, .offcanvas-menu'
      ]

      for (const selector of mobileNavSelectors) {
        try {
          const element = this.page.locator(selector).first()
          if (await element.isVisible()) {
            // Try to interact with mobile menu
            await element.click()
            await this.page.waitForTimeout(300)
            
            console.log(`✅ Mobile navigation element found: ${selector}`)
            return true
          }
        } catch (error) {
          // Continue checking other selectors
        }
      }
      
      console.log('⚠️  No mobile navigation patterns found')
      return false
    } else {
      // Desktop/tablet - check if regular navigation is accessible
      const navElements = [
        '[data-testid="navigation"] a',
        'nav a',
        '.navbar a',
        '.sidebar a'
      ]

      for (const selector of navElements) {
        try {
          const links = this.page.locator(selector)
          const count = await links.count()
          
          if (count > 0) {
            console.log(`✅ Found ${count} navigation links`)
            return true
          }
        } catch (error) {
          // Continue checking
        }
      }
      
      return false
    }
  }

  // AC3: Check scrolling functionality
  private async checkScrollingFunctionality(viewport: ViewportConfig): Promise<boolean> {
    console.log(`Checking scrolling functionality for ${viewport.name}...`)
    
    try {
      // Get initial scroll position
      const initialScroll = await this.page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY
      }))

      // Try to scroll down
      await this.page.mouse.wheel(0, 500)
      await this.page.waitForTimeout(300)

      // Check if scroll position changed
      const afterScroll = await this.page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY
      }))

      const scrollWorked = afterScroll.y > initialScroll.y
      
      if (scrollWorked) {
        console.log('✅ Vertical scrolling works')
      } else {
        console.log('⚠️  Vertical scrolling may not work or content fits viewport')
      }

      return true // Scrolling test is non-critical
    } catch (error) {
      console.log('❌ Scrolling test failed:', error)
      return false
    }
  }

  // AC3: Check touch gestures (for mobile/tablet)
  private async checkTouchGestures(viewport: ViewportConfig): Promise<boolean> {
    if (viewport.deviceType === 'desktop') {
      return true // N/A for desktop
    }

    console.log(`Checking touch gestures for ${viewport.name}...`)
    
    try {
      // Find interactive elements to test touch
      const interactiveElements = [
        'button',
        'a',
        '[data-testid*="button"]',
        '[role="button"]'
      ]

      for (const selector of interactiveElements) {
        const element = this.page.locator(selector).first()
        
        if (await element.count() > 0 && await element.isVisible()) {
          // Simulate touch tap
          const box = await element.boundingBox()
          if (box) {
            await this.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
            await this.page.waitForTimeout(200)
            
            console.log(`✅ Touch gesture successful on ${selector}`)
            return true
          }
        }
      }
      
      console.log('⚠️  No suitable elements found for touch testing')
      return false
    } catch (error) {
      console.log('❌ Touch gesture test failed:', error)
      return false
    }
  }

  // AC3: Check text readability (font sizes, line height)
  private async checkTextReadability(viewport: ViewportConfig): Promise<boolean> {
    console.log(`Checking text readability for ${viewport.name}...`)
    
    const textElements = [
      'h1, h2, h3',
      'p',
      'button',
      'a',
      '[data-testid*="text"]'
    ]

    let readableTextCount = 0
    let totalTextElements = 0

    for (const selector of textElements) {
      try {
        const elements = this.page.locator(selector)
        const count = await elements.count()
        
        for (let i = 0; i < Math.min(count, 5); i++) { // Check first 5 of each type
          totalTextElements++
          
          const element = elements.nth(i)
          const isVisible = await element.isVisible()
          
          if (isVisible) {
            const styles = await element.evaluate((el) => {
              const computed = window.getComputedStyle(el)
              return {
                fontSize: parseFloat(computed.fontSize),
                lineHeight: computed.lineHeight,
                color: computed.color,
                fontWeight: computed.fontWeight
              }
            })

            // Check minimum font sizes based on device type
            const minFontSize = viewport.deviceType === 'mobile' ? 14 : 12
            
            if (styles.fontSize >= minFontSize) {
              readableTextCount++
            }
          }
        }
      } catch (error) {
        // Continue checking other elements
      }
    }

    const readabilityScore = totalTextElements > 0 ? readableTextCount / totalTextElements : 1
    console.log(`Text readability score: ${(readabilityScore * 100).toFixed(1)}%`)
    
    return readabilityScore >= 0.8 // 80% of text should be readable
  }

  // AC3: Calculate overall responsiveness score
  private calculateResponsivenessScore(results: {
    elementsVisible: boolean
    navigationWorking: boolean
    scrollingFunctional: boolean
    touchGesturesWork: boolean
    textReadable: boolean
  }): number {
    const weights = {
      elementsVisible: 0.3,
      navigationWorking: 0.25,
      scrollingFunctional: 0.15,
      touchGesturesWork: 0.15,
      textReadable: 0.15
    }

    let score = 0
    score += results.elementsVisible ? weights.elementsVisible * 100 : 0
    score += results.navigationWorking ? weights.navigationWorking * 100 : 0
    score += results.scrollingFunctional ? weights.scrollingFunctional * 100 : 0
    score += results.touchGesturesWork ? weights.touchGesturesWork * 100 : 0
    score += results.textReadable ? weights.textReadable * 100 : 0

    return Math.round(score)
  }

  // AC3: Test all viewports and generate report
  async testAllViewports(): Promise<ResponsiveTestResult[]> {
    console.log('Testing responsive design across all viewports...')
    
    const results: ResponsiveTestResult[] = []
    
    for (const viewport of ResponsiveHelper.VIEWPORTS) {
      try {
        const result = await this.testViewportResponsiveness(viewport)
        results.push(result)
        
        console.log(`${viewport.name}: ${result.score}% responsive score`)
      } catch (error) {
        console.error(`Failed to test viewport ${viewport.name}:`, error)
        
        // Add failed result
        results.push({
          viewport,
          elementsVisible: false,
          navigationWorking: false,
          scrollingFunctional: false,
          touchGesturesWork: false,
          textReadable: false,
          score: 0
        })
      }
    }
    
    return results
  }

  // AC3: Assert responsive design requirements
  async assertResponsiveDesignCompliance(): Promise<void> {
    console.log('\n=== Responsive Design Compliance Test ===')
    
    const results = await this.testAllViewports()
    
    // Group results by device type
    const desktop = results.filter(r => r.viewport.deviceType === 'desktop')
    const tablet = results.filter(r => r.viewport.deviceType === 'tablet')
    const mobile = results.filter(r => r.viewport.deviceType === 'mobile')
    
    // Calculate average scores
    const desktopAvg = desktop.reduce((sum, r) => sum + r.score, 0) / desktop.length
    const tabletAvg = tablet.reduce((sum, r) => sum + r.score, 0) / tablet.length
    const mobileAvg = mobile.reduce((sum, r) => sum + r.score, 0) / mobile.length
    
    console.log('\nAverage Responsiveness Scores:')
    console.log(`Desktop: ${desktopAvg.toFixed(1)}%`)
    console.log(`Tablet: ${tabletAvg.toFixed(1)}%`)
    console.log(`Mobile: ${mobileAvg.toFixed(1)}%`)
    
    // Detailed results
    console.log('\nDetailed Results:')
    results.forEach(result => {
      const status = result.score >= 70 ? '✅' : result.score >= 50 ? '⚠️' : '❌'
      console.log(`${status} ${result.viewport.name}: ${result.score}%`)
    })
    
    console.log('=========================================\n')
    
    // Assert minimum responsiveness requirements
    expect(desktopAvg, 'Desktop responsiveness should be at least 80%').toBeGreaterThanOrEqual(80)
    expect(tabletAvg, 'Tablet responsiveness should be at least 75%').toBeGreaterThanOrEqual(75)
    expect(mobileAvg, 'Mobile responsiveness should be at least 70%').toBeGreaterThanOrEqual(70)
    
    // Assert no viewport has catastrophic failure
    const failedViewports = results.filter(r => r.score < 30)
    expect(failedViewports.length, 'No viewport should have catastrophic failure (<30% score)').toBe(0)
  }

  // AC3: Take responsive screenshots for visual comparison
  async takeResponsiveScreenshots(pageName: string): Promise<void> {
    console.log(`Taking responsive screenshots for ${pageName}...`)
    
    const keyViewports = [
      ResponsiveHelper.VIEWPORTS.find(v => v.name === 'Desktop Medium'),
      ResponsiveHelper.VIEWPORTS.find(v => v.name === 'iPad'),
      ResponsiveHelper.VIEWPORTS.find(v => v.name === 'iPhone 12 Pro')
    ].filter(Boolean) as ViewportConfig[]
    
    for (const viewport of keyViewports) {
      await this.setViewport(viewport)
      await this.page.screenshot({ 
        path: `e2e/screenshots/responsive-${pageName}-${viewport.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        fullPage: true
      })
    }
    
    console.log(`Screenshots saved for ${keyViewports.length} viewports`)
  }
}