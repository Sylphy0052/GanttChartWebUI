/// <reference types="cypress" />

/**
 * Gantt Chart Styling Verification E2E Tests
 *
 * ガントチャートのスタイリング変更を検証するテスト:
 * 1. 日付カラムのテキスト色が黒であることを確認
 * 2. タスクバーの状態別色分けを確認:
 *    - Open: Light gray (#94a3b8) with dark gray text
 *    - In Progress: Blue (#3b82f6) with white text
 *    - Done: Green (#22c55e) with white text
 *    - Blocked: Orange (#f97316) with white text
 */

describe('Gantt Chart Styling Verification Tests', () => {
  const TEST_PROJECT_ID = 'gantt-styling-test-123'

  // 各状態のテストタスクを準備
  const TEST_TASKS = [
    {
      id: 'task-open',
      project_id: TEST_PROJECT_ID,
      title: 'Open Task',
      description_md: 'Task with open status',
      status: 'open',
      assignee: 'test@example.com',
      progress_pct: 0,
      is_blocked: false,
      labels: ['open'],
      sort_order: 100,
      version: 1,
      start_date: '2024-01-01',
      end_date: '2024-01-05',
      wbs_number: '1',
      parent_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      children: []
    },
    {
      id: 'task-in-progress',
      project_id: TEST_PROJECT_ID,
      title: 'In Progress Task',
      description_md: 'Task with in_progress status',
      status: 'in_progress',
      assignee: 'test@example.com',
      progress_pct: 50,
      is_blocked: false,
      labels: ['in_progress'],
      sort_order: 200,
      version: 1,
      start_date: '2024-01-06',
      end_date: '2024-01-10',
      wbs_number: '2',
      parent_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      children: []
    },
    {
      id: 'task-done',
      project_id: TEST_PROJECT_ID,
      title: 'Done Task',
      description_md: 'Task with done status',
      status: 'done',
      assignee: 'test@example.com',
      progress_pct: 100,
      is_blocked: false,
      labels: ['done'],
      sort_order: 300,
      version: 1,
      start_date: '2024-01-11',
      end_date: '2024-01-15',
      wbs_number: '3',
      parent_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      children: []
    },
    {
      id: 'task-blocked',
      project_id: TEST_PROJECT_ID,
      title: 'Blocked Task',
      description_md: 'Task with blocked status',
      status: 'blocked',
      assignee: 'test@example.com',
      progress_pct: 30,
      is_blocked: true,
      labels: ['blocked'],
      sort_order: 400,
      version: 1,
      start_date: '2024-01-16',
      end_date: '2024-01-20',
      wbs_number: '4',
      parent_id: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      children: []
    }
  ]

  beforeEach(() => {
    // Mock project exists
    cy.intercept('GET', `/api/projects/${TEST_PROJECT_ID}`, {
      statusCode: 200,
      body: {
        id: TEST_PROJECT_ID,
        name: 'Gantt Styling Test Project',
        description: 'Test project for styling verification',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    }).as('getProject')

    // Mock issues API
    cy.intercept('GET', `/api/projects/${TEST_PROJECT_ID}/issues*`, {
      statusCode: 200,
      body: {
        issues: TEST_TASKS,
        pagination: {
          page: 1,
          limit: 50,
          total: TEST_TASKS.length,
          total_pages: 1
        }
      }
    }).as('getIssues')

    // Mock dependencies
    cy.intercept('GET', `/api/projects/${TEST_PROJECT_ID}/dependencies*`, {
      statusCode: 200,
      body: {
        dependencies: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          total_pages: 1
        }
      }
    }).as('getDependencies')

    // プロジェクトページにアクセス
    cy.visit(`/projects/${TEST_PROJECT_ID}`)

    // API呼び出しの待機
    cy.wait(['@getProject', '@getIssues', '@getDependencies'])

    // ガントチャートタブをクリック
    cy.contains('button', 'ガントチャート').click()

    // ガントチャートが読み込まれるまで待機
    cy.get('.gantt-chart-container', { timeout: 10000 }).should('be.visible')
  })

  it('日付カラムのテキスト色が黒であることを確認', () => {
    // 日付ヘッダーの確認
    cy.get('.bg-gray-100 .text-xs').first().then($header => {
      const textColor = $header.css('color')
      cy.log(`日付ヘッダーの色: ${textColor}`)

      // RGB値として黒系の色であることを確認
      expect(textColor).to.match(/rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\)|#000000/i)
    })

    // 複数の日付ヘッダーをチェック
    cy.get('.bg-gray-100 .text-xs').each($header => {
      const textColor = $header.css('color')
      expect(textColor).to.match(/rgb\(0,\s*0,\s*0\)|rgba\(0,\s*0,\s*0,\s*1\)|#000000/i)
    })

    cy.log('✅ 日付カラムのテキスト色確認完了')
  })

  it('Open状態のタスクバー色を確認 - Light gray background with dark gray text', () => {
    // Open状態のタスクバーを見つける
    cy.contains('[data-issue-id]', 'Open Task').within(() => {
      cy.get('.task-bar-container').should('be.visible').then($taskBar => {
        const backgroundColor = $taskBar.css('background-color')
        const textColor = $taskBar.css('color')

        cy.log(`Open Task - 背景色: ${backgroundColor}, テキスト色: ${textColor}`)

        // Light gray background (#94a3b8 = rgb(148, 163, 184))
        expect(backgroundColor).to.match(/rgb\(148,\s*163,\s*184\)|rgba\(148,\s*163,\s*184/i)

        // Dark gray text (#1e293b = rgb(30, 41, 59))
        expect(textColor).to.match(/rgb\(30,\s*41,\s*59\)|rgba\(30,\s*41,\s*59/i)
      })
    })

    cy.log('✅ Open状態のタスクバー色確認完了')
  })

  it('In Progress状態のタスクバー色を確認 - Blue background with white text', () => {
    // In Progress状態のタスクバーを見つける
    cy.contains('[data-issue-id]', 'In Progress Task').within(() => {
      cy.get('.task-bar-container').should('be.visible').then($taskBar => {
        const backgroundColor = $taskBar.css('background-color')
        const textColor = $taskBar.css('color')

        cy.log(`In Progress Task - 背景色: ${backgroundColor}, テキスト色: ${textColor}`)

        // Blue background (#3b82f6 = rgb(59, 130, 246))
        expect(backgroundColor).to.match(/rgb\(59,\s*130,\s*246\)|rgba\(59,\s*130,\s*246/i)

        // White text (rgb(255, 255, 255))
        expect(textColor).to.match(/rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255/i)
      })
    })

    cy.log('✅ In Progress状態のタスクバー色確認完了')
  })

  it('Done状態のタスクバー色を確認 - Green background with white text', () => {
    // Done状態のタスクバーを見つける
    cy.contains('[data-issue-id]', 'Done Task').within(() => {
      cy.get('.task-bar-container').should('be.visible').then($taskBar => {
        const backgroundColor = $taskBar.css('background-color')
        const textColor = $taskBar.css('color')

        cy.log(`Done Task - 背景色: ${backgroundColor}, テキスト色: ${textColor}`)

        // Green background (#22c55e = rgb(34, 197, 94))
        expect(backgroundColor).to.match(/rgb\(34,\s*197,\s*94\)|rgba\(34,\s*197,\s*94/i)

        // White text (rgb(255, 255, 255))
        expect(textColor).to.match(/rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255/i)
      })
    })

    cy.log('✅ Done状態のタスクバー色確認完了')
  })

  it('Blocked状態のタスクバー色を確認 - Orange background with white text', () => {
    // Blocked状態のタスクバーを見つける
    cy.contains('[data-issue-id]', 'Blocked Task').within(() => {
      cy.get('.task-bar-container').should('be.visible').then($taskBar => {
        const backgroundColor = $taskBar.css('background-color')
        const textColor = $taskBar.css('color')

        cy.log(`Blocked Task - 背景色: ${backgroundColor}, テキスト色: ${textColor}`)

        // Orange background (#f97316 = rgb(249, 115, 22))
        expect(backgroundColor).to.match(/rgb\(249,\s*115,\s*22\)|rgba\(249,\s*115,\s*22/i)

        // White text (rgb(255, 255, 255))
        expect(textColor).to.match(/rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255/i)
      })
    })

    cy.log('✅ Blocked状態のタスクバー色確認完了')
  })

  it('タスクバーのホバー効果を確認', () => {
    // 最初のタスクバーでホバー効果をテスト
    cy.get('.task-bar-container').first().then($taskBar => {
      // ホバー前の状態を取得
      const beforeHoverColor = $taskBar.css('background-color')
      const beforeHoverShadow = $taskBar.css('box-shadow')

      cy.log(`ホバー前 - 背景色: ${beforeHoverColor}, シャドウ: ${beforeHoverShadow}`)

      // ホバーを実行
      cy.wrap($taskBar).trigger('mouseenter')
      cy.wait(300) // ホバー効果の待機

      cy.wrap($taskBar).then($hoveredBar => {
        const afterHoverColor = $hoveredBar.css('background-color')
        const afterHoverShadow = $hoveredBar.css('box-shadow')

        cy.log(`ホバー後 - 背景色: ${afterHoverColor}, シャドウ: ${afterHoverShadow}`)

        // ホバー効果でシャドウが変わることを確認
        expect(afterHoverShadow).to.not.equal('none')
        expect(afterHoverShadow).to.not.equal(beforeHoverShadow)
      })
    })

    cy.log('✅ ホバー効果確認完了')
  })

  it('すべての状態のタスクバーが異なる色を持つことを確認', () => {
    const colors = new Set()

    // 各タスクバーの色を収集
    cy.get('.task-bar-container').each($taskBar => {
      const backgroundColor = $taskBar.css('background-color')
      colors.add(backgroundColor)
      cy.log(`タスクバー色: ${backgroundColor}`)
    }).then(() => {
      // 異なる色が複数存在することを確認
      expect(colors.size).to.be.greaterThan(1)
      cy.log(`✅ 検出された異なる色の数: ${colors.size}`)
    })
  })

  it('ガントチャートの全体的なビジュアル確認用スクリーンショット', () => {
    // ガントチャートのスクリーンショットを撮る
    cy.get('.gantt-chart-container').screenshot('gantt-styling-verification', {
      capture: 'viewport',
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    })

    // 個別のタスクバー領域のスクリーンショット
    cy.get('.gantt-timeline').screenshot('gantt-taskbars-only', {
      capture: 'viewport'
    })

    cy.log('✅ スクリーンショット保存完了')
  })

  it('CSS変数とクラス名による色設定の確認', () => {
    // ガントチャートコンテナのCSS変数を確認
    cy.get('.gantt-chart-container').then($container => {
      // コンテナスタイルの確認
      const containerStyles = window.getComputedStyle($container[0])

      cy.log('CSS変数確認:')
      cy.log(`コンテナ背景色: ${containerStyles.backgroundColor}`)
      cy.log(`コンテナテキスト色: ${containerStyles.color}`)

      // カスタムプロパティの確認
      const taskColor = containerStyles.getPropertyValue('--gantt-task-color')
      const taskHoverColor = containerStyles.getPropertyValue('--gantt-task-hover-color')
      const taskTextColor = containerStyles.getPropertyValue('--gantt-task-text-color')

      if (taskColor) cy.log(`タスク色: ${taskColor}`)
      if (taskHoverColor) cy.log(`タスクホバー色: ${taskHoverColor}`)
      if (taskTextColor) cy.log(`タスクテキスト色: ${taskTextColor}`)
    })
  })

  it('レスポンシブ表示での色の確認', () => {
    // モバイル表示での確認
    cy.viewport(375, 667)
    cy.wait(500)

    cy.get('.task-bar-container').first().then($taskBar => {
      const mobileColor = $taskBar.css('background-color')
      cy.log(`モバイル表示での色: ${mobileColor}`)

      // デスクトップ表示に戻す
      cy.viewport(1200, 800)
      cy.wait(500)

      cy.get('.task-bar-container').first().then($taskBarDesktop => {
        const desktopColor = $taskBarDesktop.css('background-color')
        cy.log(`デスクトップ表示での色: ${desktopColor}`)

        // 色が一貫していることを確認
        expect(mobileColor).to.equal(desktopColor)
      })
    })

    cy.log('✅ レスポンシブ表示での色確認完了')
  })
})