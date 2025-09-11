/**
 * パフォーマンステスト用サンプルデータ生成ヘルパー
 */

export interface TestDataSize {
  name: string
  issues: number
  dependencies: number
  comments: number
}

export const TEST_DATA_SIZES: TestDataSize[] = [
  { name: 'small', issues: 10, dependencies: 5, comments: 20 },
  { name: 'medium', issues: 100, dependencies: 20, comments: 150 },
  { name: 'large', issues: 500, dependencies: 50, comments: 300 }
]

export interface SampleIssue {
  title: string
  description: string
  status: 'open' | 'in_progress' | 'closed'
  priority: 'low' | 'medium' | 'high'
  type: 'bug' | 'feature' | 'task' | 'improvement'
  estimated_hours: number
  start_date: string
  end_date: string
  parent_id?: number
}

export interface SampleDependency {
  predecessor_id: number
  successor_id: number
  type: 'finish_to_start'
}

export interface TestDataResult {
  projectId: string
  issues: Array<{
    id: string
    title: string
    [key: string]: unknown
  }>
  dependencies: SampleDependency[]
  dataSize: TestDataSize
}

export interface PerformanceTestResult {
  dataSize: string
  target: string
  metric: 'render' | 'drag'
  measurements: number[]
  p95: number
  average: number
  kpiTarget: number
  passed: boolean
}

export interface PerformanceBaseline {
  initial_render_ms_p95?: number
  drag_latency_ms_p95?: number
  initial_render_ms_p95_timestamp?: string
  drag_latency_ms_p95_timestamp?: string
  dataSize: string
}

/**
 * パフォーマンステスト用のサンプルIssueデータ生成
 */
export function generateSampleIssues(count: number): SampleIssue[] {
  const issues: SampleIssue[] = []
  const statuses: Array<'open' | 'in_progress' | 'closed'> = ['open', 'in_progress', 'closed']
  const priorities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']
  const types: Array<'bug' | 'feature' | 'task' | 'improvement'> = ['bug', 'feature', 'task', 'improvement']

  for (let i = 1; i <= count; i++) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + (i - 1) * 2) // 2日間隔
    
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1) // 1-5日間の期間

    const issue: SampleIssue = {
      title: `Performance Test Issue ${i.toString().padStart(3, '0')}`,
      description: `これはパフォーマンステスト用のサンプルIssue ${i} です。\n\n詳細な説明文:\n- 機能要件の説明\n- 技術的な実装方針\n- テスト観点\n- 注意事項\n\n関連情報や参考資料へのリンクも含まれます。`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      type: types[Math.floor(Math.random() * types.length)],
      estimated_hours: Math.floor(Math.random() * 40) + 1, // 1-40時間
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    }

    // 階層構造の作成（20%のIssueを子タスクとする）
    if (i > 1 && Math.random() < 0.2) {
      const parentIndex = Math.floor(Math.random() * (i - 1)) + 1
      issue.parent_id = parentIndex
    }

    issues.push(issue)
  }

  return issues
}

/**
 * パフォーマンステスト用の依存関係データ生成
 */
export function generateSampleDependencies(issueCount: number, dependencyCount: number): SampleDependency[] {
  const dependencies: SampleDependency[] = []
  const usedPairs = new Set<string>()

  for (let i = 0; i < dependencyCount; i++) {
    let predecessorId: number
    let successorId: number
    let pairKey: string

    // 循環依存を避けるため、predecessorは必ずsuccessorより小さい番号にする
    do {
      predecessorId = Math.floor(Math.random() * (issueCount - 1)) + 1
      successorId = Math.floor(Math.random() * (issueCount - predecessorId)) + predecessorId + 1
      pairKey = `${predecessorId}-${successorId}`
    } while (usedPairs.has(pairKey))

    usedPairs.add(pairKey)

    dependencies.push({
      predecessor_id: predecessorId,
      successor_id: successorId,
      type: 'finish_to_start'
    })
  }

  return dependencies
}

/**
 * Cypress経由でテストデータを作成
 */
export function createPerformanceTestData(size: TestDataSize): Cypress.Chainable<TestDataResult> {
  return cy.then(() => {
    const issues = generateSampleIssues(size.issues)
    const dependencies = generateSampleDependencies(size.issues, size.dependencies)

    cy.log(`Creating performance test data: ${size.name}`)
    cy.log(`- Issues: ${size.issues}`)
    cy.log(`- Dependencies: ${size.dependencies}`)
    cy.log(`- Comments: ${size.comments}`)

    // プロジェクト作成
    return cy.request({
      method: 'POST',
      url: `${Cypress.env('backendUrl')}/api/projects`,
      body: {
        name: `Performance Test Project (${size.name})`,
        description: `パフォーマンステスト用プロジェクト - ${size.name} データセット`,
        shared_password: 'test123'
      },
      headers: {
        'Content-Type': 'application/json'
      }
    }).then((projectResponse) => {
      const projectId = projectResponse.body.id

      // Issues作成
      const issueCreationPromises = issues.map((issue, index) => {
        return cy.request({
          method: 'POST',
          url: `${Cypress.env('backendUrl')}/api/projects/${projectId}/issues`,
          body: {
            title: issue.title,
            description: issue.description,
            status: issue.status,
            priority: issue.priority,
            type: issue.type,
            estimated_hours: issue.estimated_hours,
            start_date: issue.start_date,
            end_date: issue.end_date,
            parent_id: issue.parent_id || null,
            order_index: index
          },
          headers: {
            'Content-Type': 'application/json'
          }
        })
      })

      // すべてのIssueを作成後、依存関係を設定
      return cy.wrap(Promise.all(issueCreationPromises)).then((issueResponses: Cypress.Response<unknown>[]) => {
        const createdIssues = issueResponses.map(response => response.body as { id: string; title: string; [key: string]: unknown })
        
        // 依存関係作成
        const dependencyPromises = dependencies.map((dep) => {
          const predecessorIssue = createdIssues[dep.predecessor_id - 1]
          const successorIssue = createdIssues[dep.successor_id - 1]

          return cy.request({
            method: 'POST',
            url: `${Cypress.env('backendUrl')}/api/dependencies`,
            body: {
              predecessor_issue_id: predecessorIssue.id,
              successor_issue_id: successorIssue.id,
              type: dep.type
            },
            headers: {
              'Content-Type': 'application/json'
            }
          })
        })

        return cy.wrap(Promise.all(dependencyPromises)).then(() => {
          // コメント作成（ランダムなIssueに対して）
          const commentPromises = []
          for (let i = 0; i < size.comments; i++) {
            const randomIssue = createdIssues[Math.floor(Math.random() * createdIssues.length)]
            commentPromises.push(
              cy.request({
                method: 'POST',
                url: `${Cypress.env('backendUrl')}/api/issues/${randomIssue.id}/comments`,
                body: {
                  body: `パフォーマンステスト用コメント ${i + 1}\n\n詳細な内容やディスカッションポイントを含むテストコメントです。実際の利用状況を模擬したテキスト量と構造を持っています。`
                },
                headers: {
                  'Content-Type': 'application/json'
                }
              })
            )
          }

          return cy.wrap(Promise.all(commentPromises)).then(() => {
            cy.log(`Performance test data created successfully:`)
            cy.log(`- Project ID: ${projectId}`)
            cy.log(`- Issues created: ${createdIssues.length}`)
            cy.log(`- Dependencies created: ${dependencies.length}`)
            cy.log(`- Comments created: ${size.comments}`)

            return {
              projectId,
              issues: createdIssues,
              dependencies,
              dataSize: size
            }
          })
        })
      })
    })
  })
}

/**
 * 特定サイズのテストデータでパフォーマンステストを実行
 */
export function runPerformanceTestWithData(
  size: TestDataSize,
  testFunction: (projectId: string) => void
): Cypress.Chainable<TestDataResult> {
  return createPerformanceTestData(size).then((testData: TestDataResult) => {
    // テスト実行前にブラウザキャッシュをクリア
    cy.clearLocalStorage()
    cy.clearCookies()
    
    // ウォームアップ（1回訪問してキャッシュを構築）
    cy.visit(`/projects/${testData.projectId}/issues`)
    cy.wait(1000)
    
    // 実際のテスト実行
    testFunction(testData.projectId)
    
    return cy.wrap(testData)
  })
}

/**
 * パフォーマンステスト用のCSVレポート生成
 */
export function generatePerformanceReport(testResults: PerformanceTestResult[]): string {
  const headers = [
    'Data Size',
    'Target',
    'Metric Type',
    'Measurement Count',
    'Min (ms)',
    'Max (ms)',
    'Average (ms)',
    'P95 (ms)',
    'KPI Target (ms)',
    'Pass/Fail',
    'Deviation from Target (%)',
    'Raw Measurements'
  ]

  const rows = testResults.map(result => {
    const measurements = result.measurements
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)
    const deviation = ((result.p95 - result.kpiTarget) / result.kpiTarget * 100).toFixed(1)
    
    return [
      result.dataSize,
      result.target,
      result.metric,
      measurements.length.toString(),
      min.toFixed(2),
      max.toFixed(2),
      result.average.toFixed(2),
      result.p95.toFixed(2),
      result.kpiTarget.toString(),
      result.passed ? 'PASS' : 'FAIL',
      deviation,
      measurements.map(m => m.toFixed(1)).join(';')
    ]
  })

  return [headers, ...rows].map(row => row.join(',')).join('\n')
}

/**
 * パフォーマンス回帰検知のためのベースライン管理
 */
export function updatePerformanceBaseline(
  metric: 'initial_render_ms_p95' | 'drag_latency_ms_p95',
  value: number,
  dataSize: string
): Cypress.Chainable<PerformanceBaseline> {
  return cy.window().then((win) => {
    const baselineKey = `performance-baseline-${dataSize}`
    const existingBaseline = win.localStorage.getItem(baselineKey)
    
    const baseline: PerformanceBaseline = existingBaseline ? JSON.parse(existingBaseline) : { dataSize }
    
    baseline[metric] = value
    baseline[`${metric}_timestamp`] = new Date().toISOString()
    baseline.dataSize = dataSize
    
    win.localStorage.setItem(baselineKey, JSON.stringify(baseline))
    
    cy.log(`Updated performance baseline for ${dataSize}:`)
    cy.log(`${metric}: ${value.toFixed(2)}ms`)
    
    return baseline
  })
}

/**
 * パフォーマンス回帰検知
 */
export function detectPerformanceRegression(
  metric: 'initial_render_ms_p95' | 'drag_latency_ms_p95',
  currentValue: number,
  dataSize: string,
  regressionThreshold: number = 1.2 // 20%劣化で回帰とみなす
): Cypress.Chainable<boolean> {
  return cy.window().then((win) => {
    const baselineKey = `performance-baseline-${dataSize}`
    const existingBaseline = win.localStorage.getItem(baselineKey)
    
    if (!existingBaseline) {
      cy.log(`No baseline found for ${dataSize}. Setting current value as baseline.`)
      updatePerformanceBaseline(metric, currentValue, dataSize)
      return false
    }
    
    const baseline: PerformanceBaseline = JSON.parse(existingBaseline)
    const baselineValue = baseline[metric]
    
    if (!baselineValue) {
      cy.log(`No baseline value found for ${metric}. Setting current value as baseline.`)
      updatePerformanceBaseline(metric, currentValue, dataSize)
      return false
    }
    
    const isRegression = currentValue > baselineValue * regressionThreshold
    const changePercent = ((currentValue - baselineValue) / baselineValue * 100).toFixed(1)
    
    if (isRegression) {
      cy.log(`🚨 Performance regression detected!`)
      cy.log(`${metric} (${dataSize}): ${currentValue.toFixed(2)}ms vs baseline ${baselineValue.toFixed(2)}ms`)
      cy.log(`Performance degraded by ${changePercent}%`)
    } else {
      cy.log(`✅ Performance within acceptable range`)
      cy.log(`${metric} (${dataSize}): ${currentValue.toFixed(2)}ms vs baseline ${baselineValue.toFixed(2)}ms`)
      cy.log(`Performance change: ${changePercent}%`)
    }
    
    return isRegression
  })
}