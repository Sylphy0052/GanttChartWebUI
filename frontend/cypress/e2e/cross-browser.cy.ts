/**
 * Cross-Browser Compatibility Tests
 * 
 * Tests the Gantt Chart WebUI application functionality across different
 * browsers (Chrome, Firefox, Safari, Edge) to ensure consistent behavior
 * and identify browser-specific issues.
 */

/// <reference types="cypress" />

import { VIEWPORT_PRESETS } from '../support/browser-utils'

describe('Cross-Browser Compatibility Tests', () => {
  let testProjectId: string

  beforeEach(() => {
    // Detect current browser capabilities
    cy.detectBrowser().then((info) => {
      cy.log(`Running tests on ${info.name} ${info.version} (${info.engine})`)
    })

    // Create test project for each test
    cy.visit('/')
    cy.createTestProject('Cross Browser Test Project', 'test123').then(() => {
      cy.url().should('include', '/projects/')
      cy.url().then((url) => {
        testProjectId = url.split('/').pop() || ''
      })
    })
  })

  afterEach(() => {
    // Cleanup test data
    cy.cleanupTestData()
  })

  describe('Browser Detection and Feature Support', () => {
    it('should detect browser capabilities correctly', () => {
      cy.detectBrowser().then((browser) => {
        expect(browser.name).to.be.oneOf(['chrome', 'firefox', 'safari', 'edge', 'unknown'])
        expect(browser.version).to.match(/\d+\.\d+/)
        expect(browser.engine).to.be.oneOf(['blink', 'gecko', 'webkit', 'unknown'])
        
        // Test feature detection
        expect(browser.supportsFeatures.dragAndDrop).to.be.a('boolean')
        expect(browser.supportsFeatures.webSocket).to.be.a('boolean')
        expect(browser.supportsFeatures.localStorage).to.be.a('boolean')
        expect(browser.supportsFeatures.cssGrid).to.be.a('boolean')
        expect(browser.supportsFeatures.svg).to.be.a('boolean')

        // Log browser-specific capabilities
        cy.log('Browser Features:', JSON.stringify(browser.supportsFeatures, null, 2))
      })
    })

    it('should test JavaScript API compatibility', () => {
      const requiredAPIs = [
        'fetch',
        'Promise',
        'localStorage',
        'sessionStorage',
        'WebSocket',
        'JSON.parse',
        'JSON.stringify',
        'document.querySelector',
        'document.addEventListener'
      ]

      const optionalAPIs = [
        'navigator.clipboard',
        'navigator.serviceWorker',
        'IntersectionObserver',
        'ResizeObserver'
      ]

      cy.testJavaScriptAPIs(requiredAPIs.concat(optionalAPIs))
    })
  })

  describe('Authentication and Project Access', () => {
    it('should authenticate consistently across browsers', () => {
      cy.visit(`/projects/${testProjectId}/auth`)
      
      // Test password input
      cy.get('[data-testid="password-input"]')
        .should('be.visible')
        .type('test123')
      
      cy.get('[data-testid="password-submit"]')
        .should('be.enabled')
        .click()
      
      // Verify authentication success
      cy.get('[data-testid="auth-success"]', { timeout: 10000 })
        .should('be.visible')
      
      // Test localStorage persistence
      cy.window().then((win) => {
        expect(win.localStorage.getItem('authToken')).to.exist
      })
    })

    it('should handle role-based permissions correctly', () => {
      cy.setUserRole('editor')
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Editor should see create button
      cy.get('[data-testid="create-issue-btn"]').should('be.visible')
      
      // Switch to viewer role
      cy.setUserRole('viewer')
      cy.reload()
      
      // Viewer should not see create button
      cy.get('[data-testid="create-issue-btn"]').should('not.exist')
    })
  })

  describe('Responsive Design Testing', () => {
    VIEWPORT_PRESETS.slice(0, 6).forEach((viewport) => {
      it(`should render correctly on ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
        cy.setViewport(viewport)
        cy.visit(`/projects/${testProjectId}/issues`)
        
        // Wait for layout to stabilize
        cy.wait(1000)
        
        // Test main navigation
        cy.testResponsiveLayout('[data-testid="main-navigation"]', {
          mobile: { visible: false },
          tablet: { visible: true },
          desktop: { visible: true }
        })
        
        // Test mobile menu toggle
        if (viewport.deviceType === 'mobile') {
          cy.get('[data-testid="mobile-menu-toggle"]').should('be.visible')
          cy.get('[data-testid="mobile-menu-toggle"]').click()
          cy.get('[data-testid="mobile-menu"]').should('be.visible')
        }
        
        // Test issue list layout
        cy.get('[data-testid="issue-list"]').should('be.visible')
        
        // Take screenshot for visual regression
        cy.takeScreenshotForComparison(`responsive-${viewport.name}`, {
          fullPage: true
        })
      })
    })

    it('should handle viewport changes gracefully', () => {
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Start with desktop
      cy.setViewport(VIEWPORT_PRESETS.find(v => v.name === 'Desktop')!)
      cy.get('[data-testid="main-navigation"]').should('be.visible')
      
      // Switch to mobile
      cy.setViewport(VIEWPORT_PRESETS.find(v => v.name === 'iPhone 12/13/14')!)
      cy.wait(500)
      cy.get('[data-testid="mobile-menu-toggle"]').should('be.visible')
      
      // Back to desktop
      cy.setViewport(VIEWPORT_PRESETS.find(v => v.name === 'Desktop')!)
      cy.wait(500)
      cy.get('[data-testid="main-navigation"]').should('be.visible')
    })
  })

  describe('CSS Rendering Consistency', () => {
    beforeEach(() => {
      cy.visit(`/projects/${testProjectId}/issues`)
    })

    it('should render colors consistently', () => {
      // Test primary colors
      cy.testCSSRendering('[data-testid="primary-button"]', {
        'background-color': ['rgb(59, 130, 246)', '#3b82f6'], // Tailwind blue-500
        'color': ['rgb(255, 255, 255)', '#ffffff', '#fff']
      })
      
      // Test success colors
      cy.get('[data-testid="success-message"]').then(($el) => {
        if ($el.length > 0) {
          cy.testCSSRendering('[data-testid="success-message"]', {
            'background-color': ['rgb(34, 197, 94)', '#22c55e'], // Tailwind green-500
            'color': ['rgb(255, 255, 255)', '#ffffff', '#fff']
          })
        }
      })
    })

    it('should render layout properties consistently', () => {
      // Test CSS Grid
      cy.get('[data-testid="issue-grid"]').then(($el) => {
        if ($el.length > 0) {
          cy.testCSSRendering('[data-testid="issue-grid"]', {
            'display': 'grid'
          })
        }
      })
      
      // Test Flexbox
      cy.testCSSRendering('[data-testid="header-container"]', {
        'display': 'flex',
        'justify-content': ['space-between', 'flex-start', 'flex-end']
      })
    })

    it('should handle CSS transforms and transitions', () => {
      // Test transform on hover elements
      cy.get('[data-testid="issue-card"]').first().then(($card) => {
        if ($card.length > 0) {
          cy.wrap($card).trigger('mouseenter')
          cy.testCSSRendering('[data-testid="issue-card"]:hover', {
            'transform': ['scale(1.02)', 'scale(1)', 'none']
          })
        }
      })
    })
  })

  describe('Drag and Drop Functionality', () => {
    beforeEach(() => {
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Create test issues for drag and drop
      cy.createTestIssue('Drag Source Issue', 'Source for drag test', testProjectId)
      cy.createTestIssue('Drop Target Issue', 'Target for drop test', testProjectId)
      cy.reload()
    })

    it('should handle drag and drop across browsers', () => {
      cy.get('[data-testid="issue-card"]').should('have.length.at.least', 2)
      
      const sourceSelector = '[data-testid="issue-card"]:first'
      const targetSelector = '[data-testid="issue-card"]:last'
      
      cy.testDragAndDrop(sourceSelector, targetSelector, {
        browserSpecific: true,
        validateMove: true,
        expectedBehavior: 'move'
      })
    })

    it('should handle WBS tree drag and drop', () => {
      cy.visit(`/projects/${testProjectId}/wbs`)
      
      // Wait for WBS tree to load
      cy.get('[data-testid="wbs-tree"]', { timeout: 10000 }).should('be.visible')
      
      // Test hierarchical drag and drop
      cy.get('[data-testid="wbs-node"]').then(($nodes) => {
        if ($nodes.length >= 2) {
          cy.testDragAndDrop(
            '[data-testid="wbs-node"]:first',
            '[data-testid="wbs-node"]:last',
            {
              browserSpecific: true,
              expectedBehavior: 'move'
            }
          )
        }
      })
    })
  })

  describe('SVG and Graphics Rendering', () => {
    beforeEach(() => {
      cy.visit(`/projects/${testProjectId}/gantt`)
    })

    it('should render SVG elements correctly', () => {
      // Wait for Gantt chart to load
      cy.get('[data-testid="gantt-chart"]', { timeout: 15000 }).should('be.visible')
      
      // Test SVG container
      cy.get('[data-testid="gantt-svg"]').then(($svg) => {
        if ($svg.length > 0) {
          cy.testSVGRendering('[data-testid="gantt-svg"]', [
            'rect', // Task bars
            'line', // Grid lines
            'text'  // Labels
          ])
        }
      })
    })

    it('should handle dependency lines rendering', () => {
      // Create issues with dependencies
      cy.visit(`/projects/${testProjectId}/issues`)
      cy.createTestIssue('Parent Task', 'Parent task description', testProjectId)
      cy.createTestIssue('Child Task', 'Child task description', testProjectId)
      
      // Navigate to Gantt chart
      cy.visit(`/projects/${testProjectId}/gantt`)
      cy.get('[data-testid="gantt-chart"]', { timeout: 15000 }).should('be.visible')
      
      // Test dependency lines if present
      cy.get('[data-testid="dependency-line"]').then(($lines) => {
        if ($lines.length > 0) {
          cy.testSVGRendering('[data-testid="gantt-svg"]', [
            'path', // Dependency arrows
            'marker' // Arrow markers
          ])
        }
      })
    })
  })

  describe('WebSocket and Real-time Features', () => {
    it('should establish WebSocket connection', () => {
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Mock WebSocket URL for testing
      const wsUrl = `ws://localhost:3001/socket.io/?EIO=4&transport=websocket`
      
      cy.detectBrowser().then((browser) => {
        if (browser.supportsFeatures.webSocket) {
          cy.testWebSocketConnection(
            wsUrl,
            { type: 'test', data: 'connection test' },
            { status: 'connected' }
          )
        } else {
          cy.log(`Browser ${browser.name} does not support WebSocket`)
        }
      })
    })

    it('should handle real-time notifications', () => {
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Simulate WebSocket message
      cy.simulateWebSocketMessage('issue_updated', {
        issueId: 'test-issue-123',
        title: 'Updated Issue Title',
        status: 'in-progress'
      })
      
      // Verify notification display
      cy.get('[data-testid="notification-toast"]').should('be.visible')
      cy.get('[data-testid="notification-message"]').should('contain', 'Updated Issue Title')
    })
  })

  describe('File Upload and Image Handling', () => {
    beforeEach(() => {
      cy.visit(`/projects/${testProjectId}/issues`)
      cy.createTestIssue('File Upload Test', 'Test issue for file uploads', testProjectId)
      
      // Navigate to issue detail
      cy.get('[data-testid="issue-card"]').first().click()
    })

    it('should handle image uploads across browsers', () => {
      const testImages = [
        { name: 'test.png', type: 'image/png' },
        { name: 'test.jpg', type: 'image/jpeg' },
        { name: 'test.gif', type: 'image/gif' }
      ]

      testImages.forEach((image) => {
        cy.uploadTestFile(image.name, image.type, 1024)
        
        // Verify upload success
        cy.get('[data-testid="upload-success"]').should('be.visible')
        
        // Verify image preview
        cy.get(`[data-testid="image-preview"][data-filename="${image.name}"]`)
          .should('be.visible')
      })
    })

    it('should validate file types consistently', () => {
      const testFiles = [
        { name: 'allowed.png', type: 'image/png', shouldAllow: true },
        { name: 'allowed.pdf', type: 'application/pdf', shouldAllow: true },
        { name: 'blocked.exe', type: 'application/x-executable', shouldAllow: false },
        { name: 'blocked.js', type: 'application/javascript', shouldAllow: false }
      ]

      testFiles.forEach((file) => {
        cy.checkFileTypeValidation(file.name, file.shouldAllow)
      })
    })
  })

  describe('Performance Testing', () => {
    it('should load pages within acceptable time limits', () => {
      const pages = [
        { path: `/projects/${testProjectId}/issues`, name: 'Issues Page', maxTime: 5000 },
        { path: `/projects/${testProjectId}/gantt`, name: 'Gantt Chart', maxTime: 8000 },
        { path: `/projects/${testProjectId}/wbs`, name: 'WBS Tree', maxTime: 6000 }
      ]

      pages.forEach((page) => {
        cy.measurePerformance(
          `Load ${page.name}`,
          () => {
            cy.visit(page.path)
            cy.get('[data-testid="page-loaded"]', { timeout: page.maxTime }).should('exist')
          },
          page.maxTime
        )
      })
    })

    it('should handle large datasets efficiently', () => {
      // Create multiple issues to test performance
      const issueCount = 50
      
      cy.measurePerformance(
        'Load large issue list',
        () => {
          for (let i = 0; i < issueCount; i++) {
            cy.createTestIssue(`Performance Test Issue ${i}`, `Description ${i}`, testProjectId)
          }
          
          cy.visit(`/projects/${testProjectId}/issues`)
          cy.get('[data-testid="issue-card"]').should('have.length', issueCount)
        },
        10000 // Allow up to 10 seconds for large dataset
      )
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', () => {
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Simulate network failure
      cy.intercept('GET', '**/api/**', { forceNetworkError: true }).as('networkError')
      
      // Trigger an API call
      cy.get('[data-testid="refresh-btn"]').click()
      
      // Verify error handling
      cy.get('[data-testid="error-message"]').should('be.visible')
      cy.get('[data-testid="error-message"]').should('contain', 'Network Error')
    })

    it('should handle invalid data gracefully', () => {
      // Test with malformed API response
      cy.mockApiResponse('GET', `**/api/projects/${testProjectId}/issues`, {
        issues: 'invalid-data-format'
      })
      
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Should show error state instead of crashing
      cy.get('[data-testid="error-state"]').should('be.visible')
    })

    it('should handle browser-specific JavaScript errors', () => {
      cy.detectBrowser().then((browser) => {
        cy.visit(`/projects/${testProjectId}/issues`)
        
        // Test browser-specific error scenarios
        cy.window().then(() => {
          // Safari-specific tests
          if (browser.name === 'safari') {
            // Test clipboard API fallback
            if (!browser.supportsFeatures.clipboardApi) {
              cy.get('[data-testid="copy-btn"]').click()
              cy.get('[data-testid="copy-fallback-modal"]').should('be.visible')
            }
          }
          
          // Firefox-specific tests
          if (browser.name === 'firefox') {
            // Test drag and drop behavior differences
            cy.log('Firefox-specific drag and drop tests')
          }
        })
      })
    })
  })

  describe('Accessibility Across Browsers', () => {
    it('should maintain keyboard navigation', () => {
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Test tab navigation
      cy.get('body').tab()
      cy.focused().should('have.attr', 'data-testid')
      
      // Test enter key activation
      cy.focused().type('{enter}')
      
      // Test escape key for modals
      cy.get('[data-testid="create-issue-btn"]').click()
      cy.get('[data-testid="issue-modal"]').should('be.visible')
      cy.get('body').type('{esc}')
      cy.get('[data-testid="issue-modal"]').should('not.be.visible')
    })

    it('should maintain screen reader compatibility', () => {
      cy.visit(`/projects/${testProjectId}/issues`)
      
      // Check ARIA labels
      cy.get('[data-testid="main-heading"]').should('have.attr', 'role', 'heading')
      cy.get('[data-testid="issue-list"]').should('have.attr', 'role', 'list')
      cy.get('[data-testid="issue-card"]').first().should('have.attr', 'role', 'listitem')
      
      // Check alt text for images
      cy.get('img').each(($img) => {
        cy.wrap($img).should('have.attr', 'alt')
      })
    })
  })

  describe('Browser-Specific Workarounds', () => {
    it('should apply browser-specific fixes', () => {
      cy.detectBrowser().then((browser) => {
        cy.visit(`/projects/${testProjectId}/gantt`)
        
        // Safari-specific fixes
        if (browser.name === 'safari') {
          cy.log('Testing Safari-specific workarounds')
          
          // Test Safari date picker workaround
          cy.get('[data-testid="date-picker"]').should('be.visible')
          
          // Test Safari scroll behavior
          cy.get('[data-testid="gantt-container"]').scrollTo('right')
          cy.wait(500)
          cy.get('[data-testid="gantt-container"]').should('not.have.css', 'scroll-behavior', 'auto')
        }
        
        // Firefox-specific fixes
        if (browser.name === 'firefox') {
          cy.log('Testing Firefox-specific workarounds')
          
          // Test Firefox drag and drop
          cy.get('[data-testid="draggable-element"]').should('have.attr', 'draggable', 'true')
        }
        
        // Internet Explorer compatibility (Edge legacy mode)
        if (browser.name === 'edge' && browser.version.startsWith('18')) {
          cy.log('Testing IE compatibility mode workarounds')
          
          // Test polyfill loading
          cy.window().should('have.property', 'Promise')
          cy.window().should('have.property', 'fetch')
        }
      })
    })
  })
})

// Custom command to simulate tab key
Cypress.Commands.add('tab', { prevSubject: 'element' }, (subject) => {
  cy.wrap(subject).trigger('keydown', { keyCode: 9, which: 9 })
  return cy.focused()
})

 
declare global {
  namespace Cypress {
    interface Chainable {
      tab(): Chainable<JQuery<HTMLElement>>
    }
  }
}