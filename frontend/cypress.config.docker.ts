import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // Docker環境用のベースURL設定
    baseUrl: 'http://frontend-test:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Docker環境では動画とスクリーンショットを有効化
    video: true,
    videosFolder: 'cypress/videos',
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    
    // レポート設定
    reporter: 'junit',
    reporterOptions: {
      mochaFile: 'cypress/results/test-results-[hash].xml',
      toConsole: true,
    },
    
    setupNodeEvents(on, config) {
      // JUnit XMLレポート生成設定
      on('after:run', (results) => {
        console.log('Test run completed:', {
          totalTests: results.totalTests,
          totalPassed: results.totalPassed,
          totalFailed: results.totalFailed,
          totalPending: results.totalPending,
          totalSkipped: results.totalSkipped,
          totalDuration: results.totalDuration,
        })
      })

      // スクリーンショット/動画カスタマイズ
      on('after:screenshot', (details) => {
        console.log('Screenshot taken:', details.path)
      })

      // テスト環境の設定値を返す
      return config
    },
    
    env: {
      // Docker環境用のバックエンドURL
      backendUrl: 'http://backend-test:3001',
      // テスト環境フラグ
      isDocker: true,
      testEnvironment: 'docker',
    },
    
    // Docker環境でのタイムアウト設定（長めに設定）
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 60000,
    taskTimeout: 120000,
    
    // リトライ設定（Docker環境では多めに設定）
    retries: {
      runMode: 3,
      openMode: 1
    },
    
    // ブラウザ設定
    chromeWebSecurity: false,
    blockHosts: [
      // 外部リソースをブロックしてテストを高速化
      '*.google-analytics.com',
      '*.googletagmanager.com',
      '*.doubleclick.net',
    ],
    
    // ファイルアップロードの設定
    fileServerFolder: '.',
    fixturesFolder: 'cypress/fixtures',
    
    // 追加設定
    experimentalStudio: false,
    experimentalWebKitSupport: false,
    
    // Electron使用時の設定
    scrollBehavior: 'center',
    animationDistanceThreshold: 5,
    waitForAnimations: true,
    
    // ネットワーク設定
    hosts: {
      'frontend-test': '127.0.0.1',
      'backend-test': '127.0.0.1',
    },
    
    // 除外パターン
    excludeSpecPattern: [
      '**/__snapshots__/*',
      '**/__image_snapshots__/*'
    ],
    
    // テストファイル監視設定（Docker環境では無効化）
    watchForFileChanges: false,
    
    // ビューポート設定
    viewportHeight: 720,
    viewportWidth: 1280,
    
    // ユーザーエージェント
    userAgent: 'Cypress-Docker-E2E-Tests',
    
    // モバイル向けテスト設定
    testIsolation: true,
    
    // デバッグ設定
    numTestsKeptInMemory: 10,
    trashAssetsBeforeRuns: true,
  },
  
  // コンポーネントテスト設定（将来的な拡張用）
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
    indexHtmlFile: 'cypress/support/component-index.html',
  },
})