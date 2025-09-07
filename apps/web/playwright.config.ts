import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }],
    ['line'],
    ['allure-playwright', { outputFolder: 'playwright-report/allure-results' }]
  ],
  use: {
    baseURL: process.env.CI ? 'http://localhost:3000' : 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: process.env.CI ? 30000 : 15000,
    navigationTimeout: process.env.CI ? 60000 : 30000
  },
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/
    },
    
    // AC2: Cross-browser compatibility testing
    // Desktop Browsers - Chrome
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup']
    },
    
    // Desktop Browsers - Firefox
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup']
    },
    
    // Desktop Browsers - Safari (WebKit)
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup']
    },
    
    // Desktop Browsers - Edge
    {
      name: 'edge-desktop',
      use: { 
        ...devices['Desktop Edge'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup']
    },

    // AC3: Responsive design testing - Mobile devices
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup']
    },
    
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup']
    },

    // AC3: Responsive design testing - Tablet devices
    {
      name: 'tablet-chrome',
      use: { 
        ...devices['iPad Pro'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup']
    },

    // AC4: Performance testing with specific viewport for consistent benchmarks
    {
      name: 'performance-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        viewport: { width: 1280, height: 720 } // Standard viewport for performance consistency
      },
      dependencies: ['setup'],
      testMatch: /.*performance.*\.spec\.ts/
    },

    // T023: Load Testing & Performance Validation Suite
    // AC1-7: Comprehensive load testing project
    {
      name: 'load-testing',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        viewport: { width: 1920, height: 1080 }, // Larger viewport for load testing
        // Extended timeouts for load testing
        actionTimeout: 60000, // 1 minute for individual actions
        navigationTimeout: 120000 // 2 minutes for page navigation
      },
      dependencies: ['setup'],
      testMatch: /.*load-testing.*\.spec\.ts/
    },

    // T023: High-concurrency testing project (separate for isolation)
    {
      name: 'concurrency-testing',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        viewport: { width: 1280, height: 720 },
        // Very extended timeouts for concurrency testing
        actionTimeout: 120000, // 2 minutes
        navigationTimeout: 180000 // 3 minutes
      },
      dependencies: ['setup'],
      testMatch: /.*concurrent-users.*\.spec\.ts/
    },

    // T023: Memory leak detection project (Chromium only for memory API)
    {
      name: 'memory-leak-testing',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        viewport: { width: 1280, height: 720 },
        // Extended timeouts for long-running memory tests
        actionTimeout: 300000, // 5 minutes
        navigationTimeout: 120000, // 2 minutes
        // Enable additional Chrome flags for memory testing
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--js-flags=--expose-gc',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows'
          ]
        }
      },
      dependencies: ['setup'],
      testMatch: /.*memory-leak.*\.spec\.ts/
    },

    // AC7: Accessibility testing - dedicated project for a11y tests
    {
      name: 'accessibility-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup'],
      testMatch: /.*accessibility.*\.spec\.ts/
    }
  ],
  webServer: {
    command: 'npm run dev',
    port: process.env.CI ? 3000 : 3001,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  }
})