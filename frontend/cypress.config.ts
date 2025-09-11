import { defineConfig } from 'cypress'
import fs from 'fs'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    
    // Cross-browser testing configuration
    browsers: [
      {
        name: 'chrome',
        family: 'chromium',
        channel: 'stable',
        displayName: 'Chrome',
        version: '120.0.0.0',
        path: '',
        majorVersion: 120
      },
      {
        name: 'firefox',
        family: 'firefox',
        channel: 'stable',
        displayName: 'Firefox',
        version: '120.0.0.0',
        path: '',
        majorVersion: 120
      },
      {
        name: 'edge',
        family: 'chromium',
        channel: 'stable',
        displayName: 'Edge',
        version: '120.0.0.0',
        path: '',
        majorVersion: 120
      }
    ],
    
    setupNodeEvents(on, config) {
      // Browser-specific configuration
      on('before:browser:launch', (browser, launchOptions) => {
        // Chrome/Edge specific optimizations
        if (browser.family === 'chromium') {
          launchOptions.args.push(
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          )
          
          // Enable experimental features for testing
          launchOptions.args.push(
            '--enable-experimental-web-platform-features',
            '--enable-features=VaapiVideoDecoder'
          )
        }
        
        // Firefox specific optimizations
        if (browser.family === 'firefox') {
          launchOptions.preferences = {
            ...launchOptions.preferences,
            // Disable auto-updates
            'app.update.enabled': false,
            'app.update.auto': false,
            // Disable telemetry
            'toolkit.telemetry.enabled': false,
            'datareporting.healthreport.uploadEnabled': false,
            // Performance optimizations
            'dom.max_chrome_script_run_time': 0,
            'dom.max_script_run_time': 0,
            'dom.min_background_timeout_value': 4,
            // Security settings for testing
            'security.tls.insecure_fallback_hosts': 'localhost',
            'network.cookie.sameSite.laxByDefault': false
          }
        }
        
        return launchOptions
      })
      
      // Task for browser detection
      on('task', {
        getBrowserInfo() {
          return {
            name: process.env.CYPRESS_BROWSER || 'chrome',
            timestamp: new Date().toISOString()
          }
        },
        
        log(message: string) {
          console.log(`[Cross-Browser Test] ${message}`)
          return null
        },
        
        // Performance measurement
        measurePerformanceStart() {
          return { startTime: Date.now() }
        },
        
        measurePerformanceEnd(startTime: number) {
          return { duration: Date.now() - startTime }
        }
      })
      
      // File operations for test data
      on('task', {
        fileExists(filePath: string) {
          return fs.existsSync(filePath)
        },
        
        deleteFile(filePath: string) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
          return null
        }
      })
      
      // Environment variables based on browser
      if (config.env.browser === 'safari') {
        config.defaultCommandTimeout = 15000 // Safari can be slower
        config.requestTimeout = 15000
        config.responseTimeout = 15000
      } else if (config.env.browser === 'firefox') {
        config.defaultCommandTimeout = 12000 // Firefox moderate timeout
        config.requestTimeout = 12000
        config.responseTimeout = 12000
      }
      
      return config
    },
    
    env: {
      backendUrl: 'http://localhost:3001',
      // Cross-browser test configuration
      crossBrowser: {
        enabled: true,
        browsers: ['chrome', 'firefox', 'edge'],
        viewports: [
          { name: 'mobile', width: 375, height: 667 },
          { name: 'tablet', width: 768, height: 1024 },
          { name: 'desktop', width: 1920, height: 1080 }
        ],
        screenshots: {
          enabled: true,
          comparison: true,
          threshold: 0.2 // 20% difference threshold
        }
      },
      // Feature flags for browser-specific tests
      features: {
        dragAndDrop: true,
        webSocket: true,
        clipboardApi: true,
        svg: true,
        webgl: false // Disable WebGL tests for consistency
      }
    },
    
    // Test timeout settings
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Retry configuration - different for different browsers
    retries: {
      runMode: 2,
      openMode: 0
    },
    
    // Test isolation
    testIsolation: true,
    
    // Experimental features
    experimentalStudio: false,
    experimentalWebKitSupport: true, // Enable WebKit/Safari support
    
    // Exclude patterns for browser-specific issues
    excludeSpecPattern: [
      '**/excluded/**',
      '**/*safari-only*',
      '**/*chrome-only*'
    ]
  },
  
  // Component testing configuration (if needed)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack'
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts'
  }
})