/**
 * Cross-browser compatibility testing utilities
 * 
 * This module provides utilities for testing application functionality
 * across different browsers (Chrome, Firefox, Safari, Edge) and
 * detecting browser-specific behaviors and capabilities.
 */

export interface BrowserInfo {
  name: string
  version: string
  engine: string
  userAgent: string
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  supportsFeatures: {
    dragAndDrop: boolean
    webSocket: boolean
    localStorage: boolean
    clipboardApi: boolean
    cssGrid: boolean
    cssCustomProperties: boolean
    svg: boolean
    transforms: boolean
    transitions: boolean
  }
}

export interface ViewportConfig {
  name: string
  width: number
  height: number
  deviceType: 'mobile' | 'tablet' | 'desktop'
}

export const VIEWPORT_PRESETS: ViewportConfig[] = [
  // Mobile viewports
  { name: 'iPhone SE', width: 375, height: 667, deviceType: 'mobile' },
  { name: 'iPhone 12/13/14', width: 390, height: 844, deviceType: 'mobile' },
  { name: 'Samsung Galaxy S20', width: 360, height: 800, deviceType: 'mobile' },
  
  // Tablet viewports
  { name: 'iPad Mini', width: 768, height: 1024, deviceType: 'tablet' },
  { name: 'iPad Pro 11"', width: 834, height: 1194, deviceType: 'tablet' },
  { name: 'Surface Pro', width: 912, height: 1368, deviceType: 'tablet' },
  
  // Desktop viewports
  { name: 'Laptop', width: 1366, height: 768, deviceType: 'desktop' },
  { name: 'Desktop', width: 1920, height: 1080, deviceType: 'desktop' },
  { name: 'Wide Screen', width: 2560, height: 1440, deviceType: 'desktop' }
]

export const BROWSER_CONFIGS = {
  chrome: {
    name: 'Chrome',
    family: 'chromium',
    features: {
      dragAndDrop: true,
      webSocket: true,
      localStorage: true,
      clipboardApi: true,
      cssGrid: true,
      cssCustomProperties: true,
      svg: true,
      transforms: true,
      transitions: true
    }
  },
  firefox: {
    name: 'Firefox',
    family: 'gecko',
    features: {
      dragAndDrop: true,
      webSocket: true,
      localStorage: true,
      clipboardApi: true,
      cssGrid: true,
      cssCustomProperties: true,
      svg: true,
      transforms: true,
      transitions: true
    }
  },
  safari: {
    name: 'Safari',
    family: 'webkit',
    features: {
      dragAndDrop: true,
      webSocket: true,
      localStorage: true,
      clipboardApi: false, // Limited support
      cssGrid: true,
      cssCustomProperties: true,
      svg: true,
      transforms: true,
      transitions: true
    }
  },
  edge: {
    name: 'Edge',
    family: 'chromium',
    features: {
      dragAndDrop: true,
      webSocket: true,
      localStorage: true,
      clipboardApi: true,
      cssGrid: true,
      cssCustomProperties: true,
      svg: true,
      transforms: true,
      transitions: true
    }
  }
}

/**
 * Detects current browser information from user agent
 */
export function detectBrowser(): Cypress.Chainable<BrowserInfo> {
  return cy.window().then((win) => {
    const userAgent = win.navigator.userAgent
    const testElement = win.document.createElement('div')
    win.document.body.appendChild(testElement)
    
    // Browser detection
    let browserName = 'unknown'
    let browserEngine = 'unknown'
    
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browserName = 'chrome'
      browserEngine = 'blink'
    } else if (userAgent.includes('Firefox')) {
      browserName = 'firefox'
      browserEngine = 'gecko'
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browserName = 'safari'
      browserEngine = 'webkit'
    } else if (userAgent.includes('Edg')) {
      browserName = 'edge'
      browserEngine = 'blink'
    }
    
    // Device type detection
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent)
    const isTablet = /iPad|Android.*Tablet/.test(userAgent)
    const isDesktop = !isMobile && !isTablet
    
    // Feature detection
    const supportsFeatures = {
      dragAndDrop: 'draggable' in testElement,
      webSocket: 'WebSocket' in win,
      localStorage: 'localStorage' in win,
      clipboardApi: 'clipboard' in win.navigator,
      cssGrid: testSupportsCSSFeature(testElement, 'display', 'grid'),
      cssCustomProperties: testSupportsCSSFeature(testElement, '--test', 'value'),
      svg: !!win.document.createElementNS,
      transforms: testSupportsCSSFeature(testElement, 'transform', 'translateX(10px)'),
      transitions: testSupportsCSSFeature(testElement, 'transition', 'all 0.3s')
    }
    
    win.document.body.removeChild(testElement)
    
    return {
      name: browserName,
      version: extractBrowserVersion(userAgent, browserName),
      engine: browserEngine,
      userAgent,
      isMobile,
      isTablet,
      isDesktop,
      supportsFeatures
    }
  })
}

/**
 * Tests CSS feature support
 */
function testSupportsCSSFeature(element: HTMLElement, property: string, value: string): boolean {
  try {
    element.style.setProperty(property, value)
    return element.style.getPropertyValue(property) === value
  } catch {
    return false
  }
}

/**
 * Extracts browser version from user agent
 */
function extractBrowserVersion(userAgent: string, browserName: string): string {
  const patterns: { [key: string]: RegExp } = {
    chrome: /Chrome\/(\d+\.\d+)/,
    firefox: /Firefox\/(\d+\.\d+)/,
    safari: /Version\/(\d+\.\d+)/,
    edge: /Edg\/(\d+\.\d+)/
  }
  
  const pattern = patterns[browserName]
  if (pattern) {
    const match = userAgent.match(pattern)
    return match ? match[1] : 'unknown'
  }
  
  return 'unknown'
}

/**
 * Sets viewport for responsive testing
 */
export function setViewport(config: ViewportConfig): void {
  cy.viewport(config.width, config.height)
  cy.log(`Set viewport to ${config.name} (${config.width}x${config.height})`)
}

/**
 * Tests responsive layout at different breakpoints
 */
export function testResponsiveLayout(selector: string, expectations: {
  mobile?: { visible?: boolean, width?: string, display?: string }
  tablet?: { visible?: boolean, width?: string, display?: string }
  desktop?: { visible?: boolean, width?: string, display?: string }
}): void {
  const testAtBreakpoint = (
    viewportConfig: ViewportConfig, 
    expectation: { visible?: boolean, width?: string, display?: string }
  ) => {
    setViewport(viewportConfig)
    cy.wait(500) // Allow for responsive transition
    
    if (expectation.visible !== undefined) {
      if (expectation.visible) {
        cy.get(selector).should('be.visible')
      } else {
        cy.get(selector).should('not.be.visible')
      }
    }
    
    if (expectation.width) {
      cy.get(selector).should('have.css', 'width', expectation.width)
    }
    
    if (expectation.display) {
      cy.get(selector).should('have.css', 'display', expectation.display)
    }
  }
  
  if (expectations.mobile) {
    testAtBreakpoint(VIEWPORT_PRESETS.find(v => v.deviceType === 'mobile')!, expectations.mobile)
  }
  
  if (expectations.tablet) {
    testAtBreakpoint(VIEWPORT_PRESETS.find(v => v.deviceType === 'tablet')!, expectations.tablet)
  }
  
  if (expectations.desktop) {
    testAtBreakpoint(VIEWPORT_PRESETS.find(v => v.deviceType === 'desktop')!, expectations.desktop)
  }
}

/**
 * Tests drag and drop functionality across browsers
 */
export function testDragAndDrop(
  sourceSelector: string,
  targetSelector: string,
  options: {
    browserSpecific?: boolean
    validateMove?: boolean
    expectedBehavior?: 'move' | 'copy' | 'none'
  } = {}
): void {
  detectBrowser().then((browser) => {
    cy.log(`Testing drag and drop on ${browser.name}`)
    
    if (!browser.supportsFeatures.dragAndDrop) {
      cy.log(`Browser ${browser.name} does not support native drag and drop, skipping`)
      return
    }
    
    // Get source and target elements
    cy.get(sourceSelector).as('source')
    cy.get(targetSelector).as('target')
    
    // Browser-specific drag and drop implementation
    if (browser.name === 'safari') {
      // Safari may need special handling
      cy.get('@source').trigger('mousedown', { which: 1 })
      cy.get('@target').trigger('mousemove').trigger('mouseup')
    } else {
      // Standard HTML5 drag and drop
      cy.get('@source')
        .trigger('dragstart', { dataTransfer: new DataTransfer() })
      
      cy.get('@target')
        .trigger('dragover')
        .trigger('drop')
      
      cy.get('@source')
        .trigger('dragend')
    }
    
    // Validate the expected behavior
    if (options.validateMove && options.expectedBehavior === 'move') {
      cy.get('@source').invoke('text').then((sourceText) => {
        cy.get('@target').should('contain', sourceText)
      })
    }
  })
}

/**
 * Tests WebSocket functionality across browsers
 */
export function testWebSocketConnection(
  wsUrl: string,
  messageToSend?: Record<string, unknown>,
  expectedResponse?: Record<string, unknown>
): Cypress.Chainable<unknown> {
  return detectBrowser().then((browser) => {
    cy.log(`Testing WebSocket on ${browser.name}`)
    
    if (!browser.supportsFeatures.webSocket) {
      cy.log(`Browser ${browser.name} does not support WebSocket, skipping`)
      return null
    }
    
    return cy.window().then((win) => {
      return new Cypress.Promise((resolve) => {
        const ws = new win.WebSocket(wsUrl)
        
        ws.onopen = () => {
          cy.log('WebSocket connection opened')
          if (messageToSend) {
            ws.send(JSON.stringify(messageToSend))
          }
        }
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          cy.log('WebSocket message received:', data)
          
          if (expectedResponse) {
            expect(data).to.deep.include(expectedResponse)
          }
          
          ws.close()
          resolve(data)
        }
        
        ws.onerror = () => {
          cy.log('WebSocket error')
          resolve(null)
        }
        
        ws.onclose = () => {
          cy.log('WebSocket connection closed')
        }
      })
    })
  })
}

/**
 * Tests CSS rendering consistency across browsers
 */
export function testCSSRendering(
  selector: string,
  expectedStyles: { [property: string]: string | string[] }
): void {
  detectBrowser().then((browser) => {
    cy.log(`Testing CSS rendering on ${browser.name}`)
    
    Object.entries(expectedStyles).forEach(([property, expectedValue]) => {
      const values = Array.isArray(expectedValue) ? expectedValue : [expectedValue]
      
      cy.get(selector).should(($el) => {
        const computedStyle = window.getComputedStyle($el[0])
        const actualValue = computedStyle.getPropertyValue(property)
        
        // Check if any of the expected values match
        const matches = values.some(value => {
          if (property === 'color' || property.includes('color')) {
            // Normalize color values for comparison
            return normalizeColor(actualValue) === normalizeColor(value)
          }
          return actualValue === value
        })
        
        if (!matches) {
          throw new Error(`CSS property ${property} should be one of [${values.join(', ')}] but was ${actualValue} on ${browser.name}`)
        }
      })
    })
  })
}

/**
 * Normalizes color values for cross-browser comparison
 */
function normalizeColor(color: string): string {
  // Convert hex to rgb, normalize rgb format, etc.
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    return `rgb(${r}, ${g}, ${b})`
  }
  
  // Normalize rgb/rgba format
  return color.replace(/\s+/g, '').toLowerCase()
}

/**
 * Tests SVG rendering across browsers
 */
export function testSVGRendering(svgSelector: string, expectedElements: string[]): void {
  detectBrowser().then((browser) => {
    cy.log(`Testing SVG rendering on ${browser.name}`)
    
    if (!browser.supportsFeatures.svg) {
      cy.log(`Browser ${browser.name} does not support SVG, skipping`)
      return
    }
    
    cy.get(svgSelector).should('be.visible')
    
    expectedElements.forEach(element => {
      cy.get(`${svgSelector} ${element}`).should('exist')
    })
    
    // Test SVG viewport and scaling
    cy.get(svgSelector).should(($svg) => {
      const svg = $svg[0] as SVGSVGElement
      if (!svg.viewBox) {
        throw new Error('SVG should have viewBox property')
      }
      if (svg.getBoundingClientRect().width <= 0) {
        throw new Error('SVG width should be greater than 0')
      }
      if (svg.getBoundingClientRect().height <= 0) {
        throw new Error('SVG height should be greater than 0')
      }
    })
  })
}

/**
 * Tests JavaScript API compatibility
 */
export function testJavaScriptAPIs(apis: string[]): void {
  detectBrowser().then((browser) => {
    cy.log(`Testing JavaScript APIs on ${browser.name}`)
    
    cy.window().then((win) => {
      apis.forEach(api => {
        const hasAPI = api.split('.').reduce((obj, prop) => obj && obj[prop], win as unknown)
        cy.log(`API ${api}: ${hasAPI ? 'supported' : 'not supported'}`)
        
        // Some APIs are optional, log but don't fail
        if (['clipboard', 'serviceWorker'].some(optional => api.includes(optional))) {
          if (!hasAPI) {
            cy.log(`Optional API ${api} not supported on ${browser.name}`)
          }
        } else {
          if (!hasAPI) {
            throw new Error(`API ${api} should be supported on ${browser.name}`)
          }
        }
      })
    })
  })
}

/**
 * Takes screenshot for visual regression testing
 */
export function takeScreenshotForComparison(
  name: string,
  options: {
    element?: string
    fullPage?: boolean
    clip?: { x: number, y: number, width: number, height: number }
  } = {}
): void {
  detectBrowser().then((browser) => {
    const screenshotName = `${name}-${browser.name}-${Date.now()}`
    
    if (options.element) {
      cy.get(options.element).screenshot(screenshotName, {
        clip: options.clip
      })
    } else {
      cy.screenshot(screenshotName, {
        capture: options.fullPage ? 'fullPage' : 'viewport',
        clip: options.clip
      })
    }
  })
}

/**
 * Tests performance across browsers
 */
export function measurePerformance(
  testName: string,
  testFunction: () => void,
  expectedMaxTime?: number
): void {
  detectBrowser().then((browser) => {
    cy.log(`Measuring performance for ${testName} on ${browser.name}`)
    
    cy.window().then((win) => {
      const startTime = win.performance.now()
      
      testFunction()
      
      cy.then(() => {
        const endTime = win.performance.now()
        const duration = endTime - startTime
        
        cy.log(`${testName} took ${duration.toFixed(2)}ms on ${browser.name}`)
        
        if (expectedMaxTime && duration >= expectedMaxTime) {
          throw new Error(`${testName} should complete within ${expectedMaxTime}ms on ${browser.name} but took ${duration.toFixed(2)}ms`)
        }
      })
    })
  })
}

// Declare custom commands for TypeScript
 
declare global {
  namespace Cypress {
    interface Chainable {
      detectBrowser(): Chainable<BrowserInfo>
      setViewport(config: ViewportConfig): Chainable<void>
      testResponsiveLayout(
        selector: string, 
        expectations: {
          mobile?: { visible?: boolean, width?: string, display?: string }
          tablet?: { visible?: boolean, width?: string, display?: string }
          desktop?: { visible?: boolean, width?: string, display?: string }
        }
      ): Chainable<void>
      testDragAndDrop(
        sourceSelector: string,
        targetSelector: string,
        options?: {
          browserSpecific?: boolean
          validateMove?: boolean
          expectedBehavior?: 'move' | 'copy' | 'none'
        }
      ): Chainable<void>
      testWebSocketConnection(
        wsUrl: string,
        messageToSend?: Record<string, unknown>,
        expectedResponse?: Record<string, unknown>
      ): Chainable<unknown>
      testCSSRendering(
        selector: string,
        expectedStyles: { [property: string]: string | string[] }
      ): Chainable<void>
      testSVGRendering(svgSelector: string, expectedElements: string[]): Chainable<void>
      testJavaScriptAPIs(apis: string[]): Chainable<void>
      takeScreenshotForComparison(
        name: string,
        options?: {
          element?: string
          fullPage?: boolean
          clip?: { x: number, y: number, width: number, height: number }
        }
      ): Chainable<void>
      measurePerformance(
        testName: string,
        testFunction: () => void,
        expectedMaxTime?: number
      ): Chainable<void>
    }
  }
}

// Register custom commands
Cypress.Commands.add('detectBrowser', detectBrowser)
Cypress.Commands.add('setViewport', setViewport)
Cypress.Commands.add('testResponsiveLayout', testResponsiveLayout)
Cypress.Commands.add('testDragAndDrop', testDragAndDrop)
Cypress.Commands.add('testWebSocketConnection', testWebSocketConnection)
Cypress.Commands.add('testCSSRendering', testCSSRendering)
Cypress.Commands.add('testSVGRendering', testSVGRendering)
Cypress.Commands.add('testJavaScriptAPIs', testJavaScriptAPIs)
Cypress.Commands.add('takeScreenshotForComparison', takeScreenshotForComparison)
Cypress.Commands.add('measurePerformance', measurePerformance)