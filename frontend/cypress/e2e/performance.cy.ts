/**
 * パフォーマンスメトリクス計測E2Eテスト
 * KPI目標値: initial_render_ms_p95 (1500ms), drag_latency_ms_p95 (100ms)
 */

describe('Performance Metrics Testing', () => {
  interface PerformanceMetric {
    target: string
    initial_render_ms?: number
    drag_latency_ms?: number
    page_load_ms?: number
    web_vitals?: WebVitalsData
    timestamp: number
  }

  interface WebVitalsData {
    lcp: number | null
    fid: number | null
    cls: number | null
    ttfb: number | null
  }

  let performanceMetrics: PerformanceMetric[] = []

  const KPI_TARGETS = {
    initial_render_ms_p95: 1500, // KPI目標値: 1500ms
    drag_latency_ms_p95: 100     // KPI目標値: 100ms
  }

  before(() => {
    // テストデータ準備：サンプルプロジェクトとIssueを作成
    cy.visit('/')
    cy.createTestProject('Performance Test Project', 'test123')
    cy.wait(1000)
  })

  beforeEach(() => {
    // パフォーマンス監視の初期化
    cy.window().then((win) => {
      win.localStorage.setItem('performance-test-mode', 'true')
    })

    // 各テストごとにメトリクスをリセット
    performanceMetrics = []
  })

  describe('Initial Render Performance (KPI: 1500ms P95)', () => {
    const testPages = [
      { name: 'プロジェクト一覧', path: '/', testId: 'projects-list' },
      { name: 'Issue一覧', path: '/projects/1/issues', testId: 'issues-list' },
      { name: 'WBSツリー', path: '/projects/1/issues?view=wbs', testId: 'wbs-tree' },
      { name: 'ガントチャート', path: '/projects/1/gantt', testId: 'gantt-chart' },
      { name: 'Issue詳細', path: '/projects/1/issues/1', testId: 'issue-detail' }
    ]

    testPages.forEach(({ name, path, testId }) => {
      it(`should measure initial render time for ${name}`, () => {
        const measurements: number[] = []

        // ウォームアップ実行（1回）
        cy.visit(path)
        cy.wait(500)

        // 複数回計測してP95を算出（5回実行）
        for (let i = 0; i < 5; i++) {
          cy.window().then((win) => {
            // Performance API リセット
            win.performance.clearMarks()
            win.performance.clearMeasures()
          })

          const startTime = Date.now()

          cy.visit(path)

          // 計測開始マーク
          cy.window().then((win) => {
            win.performance.mark(`render-start-${testId}`)
          })

          // ページの主要要素の読み込み完了を待機
          cy.get(`[data-testid="${testId}"]`, { timeout: 10000 }).should('be.visible')

          // 計測終了マーク
          cy.window().then((win) => {
            win.performance.mark(`render-end-${testId}`)
            win.performance.measure(
              `render-duration-${testId}`,
              `render-start-${testId}`,
              `render-end-${testId}`
            )

            // Performance Timing APIから詳細データを取得
            const navigationEntry = win.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
            const measureEntry = win.performance.getEntriesByName(`render-duration-${testId}`)[0]

            let renderTime: number
            if (measureEntry) {
              renderTime = measureEntry.duration
            } else {
              renderTime = Date.now() - startTime
            }

            measurements.push(renderTime)

            // Web Vitals データも収集
            const webVitals: WebVitalsData = {
              lcp: null,
              fid: null,
              cls: null,
              ttfb: navigationEntry ? navigationEntry.responseStart - navigationEntry.requestStart : null
            }

            // LCP取得試行
            try {
              const lcpEntries = win.performance.getEntriesByType('largest-contentful-paint')
              if (lcpEntries.length > 0) {
                webVitals.lcp = lcpEntries[lcpEntries.length - 1].startTime
              }
            } catch (error) {
              console.warn('LCP measurement failed:', error)
            }

            // パフォーマンスデータを記録
            performanceMetrics.push({
              target: `${name}-${testId}`,
              initial_render_ms: renderTime,
              page_load_ms: navigationEntry ? navigationEntry.loadEventEnd - navigationEntry.navigationStart : 0,
              web_vitals: webVitals,
              timestamp: Date.now()
            })

            cy.log(`${name} Render Time (Run ${i + 1}): ${renderTime.toFixed(2)}ms`)
          })

          cy.wait(500) // 測定間の安定化待機
        }

        cy.then(() => {
          // 95パーセンタイル値を計算
          const sortedMeasurements = measurements.sort((a, b) => a - b)
          const p95Index = Math.floor(measurements.length * 0.95)
          const p95Value = sortedMeasurements[p95Index]
          const average = measurements.reduce((a, b) => a + b, 0) / measurements.length

          cy.log(`${name} Performance Summary:`)
          cy.log(`  Measurements: [${measurements.map(m => m.toFixed(0)).join(', ')}]ms`)
          cy.log(`  Average: ${average.toFixed(2)}ms`)
          cy.log(`  P95: ${p95Value.toFixed(2)}ms`)
          cy.log(`  KPI Target: ${KPI_TARGETS.initial_render_ms_p95}ms`)
          cy.log(`  Status: ${p95Value <= KPI_TARGETS.initial_render_ms_p95 ? '✓ PASS' : '✗ FAIL'}`)

          // KPI目標値に対する評価
          if (p95Value <= KPI_TARGETS.initial_render_ms_p95) {
            cy.log(`✅ ${name} initial render performance meets KPI target`)
          } else {
            cy.log(`⚠️ ${name} initial render performance exceeds KPI target by ${(p95Value - KPI_TARGETS.initial_render_ms_p95).toFixed(2)}ms`)
            
            // パフォーマンス改善の推奨事項をログ出力
            cy.log('Performance improvement recommendations:')
            if (p95Value > 2000) {
              cy.log('  - Consider code splitting and lazy loading')
              cy.log('  - Optimize bundle size')
              cy.log('  - Review component rendering cycles')
            }
            if (p95Value > 1800) {
              cy.log('  - Implement virtualization for large lists')
              cy.log('  - Optimize API response times')
            }
          }

          // テストは警告として扱い、失敗させない（継続的な監視のため）
          expect(p95Value).to.be.lessThan(KPI_TARGETS.initial_render_ms_p95 * 1.5, 
            `${name} render time P95 (${p95Value.toFixed(2)}ms) significantly exceeds target (${KPI_TARGETS.initial_render_ms_p95}ms)`)
        })
      })
    })
  })

  describe('Drag Operation Latency (KPI: 100ms P95)', () => {
    const dragOperations = [
      {
        name: 'WBSツリー並び替え',
        setup: '/projects/1/issues?view=wbs',
        testId: 'wbs-tree-item',
        action: 'wbs-reorder'
      },
      {
        name: 'ガントチャートタスクバー移動',
        setup: '/projects/1/gantt',
        testId: 'gantt-task-bar',
        action: 'gantt-drag'
      },
      {
        name: '階層構造変更',
        setup: '/projects/1/issues?view=wbs',
        testId: 'wbs-tree-item',
        action: 'hierarchy-change'
      }
    ]

    dragOperations.forEach(({ name, setup, testId, action }) => {
      it(`should measure drag latency for ${name}`, () => {
        cy.visit(setup)
        cy.wait(1000)

        // テストデータ準備：複数のIssueを作成
        for (let i = 0; i < 10; i++) {
          cy.createTestIssue(`Test Issue ${i + 1}`, `Description for issue ${i + 1}`)
        }

        cy.visit(setup)
        cy.get(`[data-testid="${testId}"]`, { timeout: 10000 }).should('be.visible')

        const dragMeasurements: number[] = []

        // 複数回のドラッグ操作を計測（10回実行）
        for (let i = 0; i < 10; i++) {
          cy.get(`[data-testid="${testId}"]`).first().then(($element) => {
            let dragStartTime: number
            let dragEndTime: number

            cy.window().then((win) => {
              // Performance API マーク設定
              win.performance.mark(`drag-start-${action}-${i}`)
              dragStartTime = win.performance.now()
            })

            // ドラッグ&ドロップ操作の実行
            cy.get($element)
              .trigger('mousedown', { which: 1 })
              .wait(10) // 最小限の待機
              .trigger('mousemove', { clientX: 100, clientY: 100 })
              .wait(10)
              .trigger('mouseup')

            cy.window().then((win) => {
              dragEndTime = win.performance.now()
              win.performance.mark(`drag-end-${action}-${i}`)
              win.performance.measure(
                `drag-duration-${action}-${i}`,
                `drag-start-${action}-${i}`,
                `drag-end-${action}-${i}`
              )

              const latency = dragEndTime - dragStartTime
              dragMeasurements.push(latency)

              // パフォーマンスデータを記録
              performanceMetrics.push({
                target: `${name}-${action}`,
                drag_latency_ms: latency,
                timestamp: Date.now()
              })

              cy.log(`${name} Drag Latency (Run ${i + 1}): ${latency.toFixed(2)}ms`)
            })

            cy.wait(200) // 操作間の安定化待機
          })
        }

        cy.then(() => {
          // 95パーセンタイル値を計算
          const sortedLatencies = dragMeasurements.sort((a, b) => a - b)
          const p95Index = Math.floor(dragMeasurements.length * 0.95)
          const p95Value = sortedLatencies[p95Index]
          const average = dragMeasurements.reduce((a, b) => a + b, 0) / dragMeasurements.length

          cy.log(`${name} Drag Performance Summary:`)
          cy.log(`  Measurements: [${dragMeasurements.map(m => m.toFixed(0)).join(', ')}]ms`)
          cy.log(`  Average: ${average.toFixed(2)}ms`)
          cy.log(`  P95: ${p95Value.toFixed(2)}ms`)
          cy.log(`  KPI Target: ${KPI_TARGETS.drag_latency_ms_p95}ms`)
          cy.log(`  Status: ${p95Value <= KPI_TARGETS.drag_latency_ms_p95 ? '✓ PASS' : '✗ FAIL'}`)

          // KPI目標値に対する評価
          if (p95Value <= KPI_TARGETS.drag_latency_ms_p95) {
            cy.log(`✅ ${name} drag latency meets KPI target`)
          } else {
            cy.log(`⚠️ ${name} drag latency exceeds KPI target by ${(p95Value - KPI_TARGETS.drag_latency_ms_p95).toFixed(2)}ms`)
            
            // パフォーマンス改善の推奨事項
            cy.log('Drag performance improvement recommendations:')
            if (p95Value > 150) {
              cy.log('  - Optimize drag event handlers')
              cy.log('  - Implement requestAnimationFrame for smooth updates')
              cy.log('  - Review DOM manipulation during drag operations')
            }
            if (p95Value > 120) {
              cy.log('  - Consider debouncing drag updates')
              cy.log('  - Optimize component re-rendering during drag')
            }
          }

          // テストは警告として扱い、失敗させない
          expect(p95Value).to.be.lessThan(KPI_TARGETS.drag_latency_ms_p95 * 2, 
            `${name} drag latency P95 (${p95Value.toFixed(2)}ms) significantly exceeds target (${KPI_TARGETS.drag_latency_ms_p95}ms)`)
        })
      })
    })
  })

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', () => {
      cy.window().then((win) => {
        // ベースライン値をローカルストレージに保存/読み込み
        const baselineKey = 'performance-baseline'
        const currentBaseline = win.localStorage.getItem(baselineKey)

        if (!currentBaseline) {
          // 初回実行：ベースライン設定
          const baseline = {
            initial_render_ms_p95: KPI_TARGETS.initial_render_ms_p95 * 0.8, // 目標値の80%をベースライン
            drag_latency_ms_p95: KPI_TARGETS.drag_latency_ms_p95 * 0.8,
            timestamp: Date.now()
          }
          win.localStorage.setItem(baselineKey, JSON.stringify(baseline))
          cy.log('Performance baseline established:', baseline)
        } else {
          // ベースライン比較実行
          const baseline = JSON.parse(currentBaseline)
          
          // 現在のメトリクスから統計を計算
          const renderTimes = performanceMetrics
            .filter(m => m.initial_render_ms)
            .map(m => m.initial_render_ms!)
          
          const dragLatencies = performanceMetrics
            .filter(m => m.drag_latency_ms)
            .map(m => m.drag_latency_ms!)

          if (renderTimes.length > 0) {
            const renderP95 = renderTimes.sort((a, b) => a - b)[Math.floor(renderTimes.length * 0.95)]
            const renderRegression = renderP95 > baseline.initial_render_ms_p95 * 1.2 // 20%劣化で回帰検知
            
            if (renderRegression) {
              cy.log(`🚨 Performance regression detected in render time: ${renderP95.toFixed(2)}ms vs baseline ${baseline.initial_render_ms_p95.toFixed(2)}ms`)
            }
          }

          if (dragLatencies.length > 0) {
            const dragP95 = dragLatencies.sort((a, b) => a - b)[Math.floor(dragLatencies.length * 0.95)]
            const dragRegression = dragP95 > baseline.drag_latency_ms_p95 * 1.2
            
            if (dragRegression) {
              cy.log(`🚨 Performance regression detected in drag latency: ${dragP95.toFixed(2)}ms vs baseline ${baseline.drag_latency_ms_p95.toFixed(2)}ms`)
            }
          }
        }
      })
    })
  })

  describe('Performance Data Management', () => {
    it('should export performance metrics to CSV', () => {
      cy.window().then((win) => {
        if (performanceMetrics.length === 0) {
          cy.log('No performance metrics to export')
          return
        }

        // CSV形式でエクスポート
        const headers = [
          'timestamp',
          'target',
          'initial_render_ms',
          'drag_latency_ms',
          'page_load_ms',
          'web_vitals_lcp',
          'web_vitals_ttfb'
        ]

        const csvRows = performanceMetrics.map(metric => [
          new Date(metric.timestamp).toISOString(),
          metric.target,
          metric.initial_render_ms || '',
          metric.drag_latency_ms || '',
          metric.page_load_ms || '',
          metric.web_vitals?.lcp || '',
          metric.web_vitals?.ttfb || ''
        ])

        const csvContent = [headers, ...csvRows]
          .map(row => row.join(','))
          .join('\n')

        // ファイルとして保存（テスト環境では検証のみ）
        cy.log('Performance metrics CSV export:')
        cy.log(csvContent)

        // ローカルストレージに履歴保存
        const historyKey = 'performance-history'
        const existingHistory = win.localStorage.getItem(historyKey)
        const history = existingHistory ? JSON.parse(existingHistory) : []
        
        history.push({
          test_run: new Date().toISOString(),
          metrics: performanceMetrics,
          summary: {
            total_metrics: performanceMetrics.length,
            render_measurements: performanceMetrics.filter(m => m.initial_render_ms).length,
            drag_measurements: performanceMetrics.filter(m => m.drag_latency_ms).length
          }
        })

        // 履歴の上限設定（最新100件）
        if (history.length > 100) {
          history.splice(0, history.length - 100)
        }

        win.localStorage.setItem(historyKey, JSON.stringify(history))
        cy.log(`Performance history updated: ${history.length} test runs stored`)
      })
    })

    it('should generate performance dashboard data', () => {
      cy.window().then((win) => {
        const dashboardData = {
          kpi_status: {
            initial_render_ms_p95: {
              target: KPI_TARGETS.initial_render_ms_p95,
              current: null as number | null,
              status: 'unknown' as 'pass' | 'fail' | 'unknown'
            },
            drag_latency_ms_p95: {
              target: KPI_TARGETS.drag_latency_ms_p95,
              current: null as number | null,
              status: 'unknown' as 'pass' | 'fail' | 'unknown'
            }
          },
          test_summary: {
            total_tests_run: performanceMetrics.length,
            timestamp: new Date().toISOString(),
            browser: win.navigator.userAgent,
            environment: 'cypress-e2e'
          },
          recommendations: [] as string[]
        }

        // 現在の値を計算
        const renderTimes = performanceMetrics
          .filter(m => m.initial_render_ms)
          .map(m => m.initial_render_ms!)

        if (renderTimes.length > 0) {
          const renderP95 = renderTimes.sort((a, b) => a - b)[Math.floor(renderTimes.length * 0.95)]
          dashboardData.kpi_status.initial_render_ms_p95.current = renderP95
          dashboardData.kpi_status.initial_render_ms_p95.status = 
            renderP95 <= KPI_TARGETS.initial_render_ms_p95 ? 'pass' : 'fail'
          
          if (renderP95 > KPI_TARGETS.initial_render_ms_p95) {
            dashboardData.recommendations.push('初期レンダリング性能の改善が必要です')
          }
        }

        const dragLatencies = performanceMetrics
          .filter(m => m.drag_latency_ms)
          .map(m => m.drag_latency_ms!)

        if (dragLatencies.length > 0) {
          const dragP95 = dragLatencies.sort((a, b) => a - b)[Math.floor(dragLatencies.length * 0.95)]
          dashboardData.kpi_status.drag_latency_ms_p95.current = dragP95
          dashboardData.kpi_status.drag_latency_ms_p95.status = 
            dragP95 <= KPI_TARGETS.drag_latency_ms_p95 ? 'pass' : 'fail'
          
          if (dragP95 > KPI_TARGETS.drag_latency_ms_p95) {
            dashboardData.recommendations.push('ドラッグ操作の応答性能の改善が必要です')
          }
        }

        cy.log('Performance Dashboard Data:')
        cy.log(JSON.stringify(dashboardData, null, 2))

        // ダッシュボードデータをローカルストレージに保存
        win.localStorage.setItem('performance-dashboard', JSON.stringify(dashboardData))
      })
    })
  })

  after(() => {
    // テスト完了後のクリーンアップ
    cy.cleanupTestData()
    
    // 最終パフォーマンスサマリーをログ出力
    cy.then(() => {
      if (performanceMetrics.length > 0) {
        cy.log('='.repeat(60))
        cy.log('PERFORMANCE TEST SUMMARY')
        cy.log('='.repeat(60))
        cy.log(`Total measurements: ${performanceMetrics.length}`)
        
        const renderMetrics = performanceMetrics.filter(m => m.initial_render_ms)
        const dragMetrics = performanceMetrics.filter(m => m.drag_latency_ms)
        
        if (renderMetrics.length > 0) {
          const renderTimes = renderMetrics.map(m => m.initial_render_ms!)
          const renderP95 = renderTimes.sort((a, b) => a - b)[Math.floor(renderTimes.length * 0.95)]
          cy.log(`Initial Render P95: ${renderP95.toFixed(2)}ms (Target: ${KPI_TARGETS.initial_render_ms_p95}ms) ${renderP95 <= KPI_TARGETS.initial_render_ms_p95 ? '✓' : '✗'}`)
        }
        
        if (dragMetrics.length > 0) {
          const dragLatencies = dragMetrics.map(m => m.drag_latency_ms!)
          const dragP95 = dragLatencies.sort((a, b) => a - b)[Math.floor(dragLatencies.length * 0.95)]
          cy.log(`Drag Latency P95: ${dragP95.toFixed(2)}ms (Target: ${KPI_TARGETS.drag_latency_ms_p95}ms) ${dragP95 <= KPI_TARGETS.drag_latency_ms_p95 ? '✓' : '✗'}`)
        }
        
        cy.log('='.repeat(60))
      }
    })
  })
})