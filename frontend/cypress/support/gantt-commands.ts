/// <reference types="cypress" />

/**
 * Gantt Chart機能専用のCypressカスタムコマンド
 * 
 * このファイルは、ガントチャート機能のE2Eテスト用のカスタムコマンドを提供します。
 * 主要な機能領域：
 * - ガントチャート基本操作（表示、選択、ナビゲーション）
 * - 依存関係管理（作成、削除、編集）
 * - ドラッグ&ドロップによる日程調整
 * - WebSocket リアルタイム機能
 * - データ準備・検証用ヘルパー
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * ガントチャート基本操作コマンド群
       */

      /**
       * ガントチャートページに遷移する
       * @example cy.navigateToGanttChart('project-123')
       */
      navigateToGanttChart(projectId: string): Chainable<Element>

      /**
       * ガントチャートの読み込み完了を待つ
       * @example cy.waitForGanttChartLoad()
       */
      waitForGanttChartLoad(): Chainable<Element>

      /**
       * タスクバーをクリックして選択する
       * @example cy.selectTaskBar('issue-123')
       */
      selectTaskBar(issueId: string): Chainable<Element>

      /**
       * マイルストーンマーカーをクリックして選択する
       * @example cy.selectMilestone('milestone-456')
       */
      selectMilestone(issueId: string): Chainable<Element>

      /**
       * ガントチャートのズーム操作
       * @example cy.zoomGanttChart('in') // or 'out', 'reset'
       */
      zoomGanttChart(direction: 'in' | 'out' | 'reset'): Chainable<Element>

      /**
       * ガントチャートをスクロール
       * @example cy.scrollGanttChart('right', 200)
       */
      scrollGanttChart(direction: 'left' | 'right' | 'up' | 'down', amount: number): Chainable<Element>

      /**
       * 依存関係管理コマンド群
       */

      /**
       * タスクバーを右クリックして依存関係コンテキストメニューを開く
       * @example cy.openDependencyContextMenu('issue-123')
       */
      openDependencyContextMenu(issueId: string): Chainable<Element>

      /**
       * 依存関係を作成する（右クリック方式）
       * @example cy.createDependencyViaRightClick('issue-1', 'issue-2')
       */
      createDependencyViaRightClick(predecessorId: string, successorId: string): Chainable<Element>

      /**
       * 依存関係線を右クリックして削除コンテキストメニューを開く
       * @example cy.openDependencyDeleteMenu('dep-123')
       */
      openDependencyDeleteMenu(dependencyId: string): Chainable<Element>

      /**
       * 依存関係を削除する
       * @example cy.deleteDependency('dep-123')
       */
      deleteDependency(dependencyId: string): Chainable<Element>

      /**
       * 依存関係線を選択する
       * @example cy.selectDependencyLine('dep-123')
       */
      selectDependencyLine(dependencyId: string): Chainable<Element>

      /**
       * 循環依存の検出エラーを確認する
       * @example cy.verifyCircularDependencyError('循環依存が検出されました')
       */
      verifyCircularDependencyError(expectedMessage: string): Chainable<Element>

      /**
       * 依存関係の詳細情報を確認する
       * @example cy.verifyDependencyDetails('dep-1', 'finish_to_start', 0)
       */
      verifyDependencyDetails(dependencyId: string, type: string, lagDays: number): Chainable<Element>

      /**
       * ドラッグ&ドロップ操作コマンド群
       */

      /**
       * タスクバーをドラッグ&ドロップで移動する
       * @example cy.dragTaskBar('issue-123', 50) // 50px right
       */
      dragTaskBar(issueId: string, deltaX: number, deltaY?: number): Chainable<Element>

      /**
       * ドラッグ&ドロップの制約違反を検証する
       * @example cy.verifyDragConstraintViolation('依存関係制約に違反')
       */
      verifyDragConstraintViolation(expectedMessage: string): Chainable<Element>

      /**
       * ドラッグ&ドロップ操作の成功を確認する
       * @example cy.verifyDragDropSuccess()
       */
      verifyDragDropSuccess(): Chainable<Element>

      /**
       * カスケード調整通知を確認する
       * @example cy.verifyCascadeAdjustmentNotification()
       */
      verifyCascadeAdjustmentNotification(): Chainable<Element>

      /**
       * WebSocketリアルタイム機能コマンド群
       */

      /**
       * WebSocket接続状態を確認する
       * @example cy.verifyWebSocketConnection('connected')
       */
      verifyWebSocketConnection(status: 'connected' | 'disconnected' | 'connecting'): Chainable<Element>

      /**
       * ガント関連のWebSocket通知をシミュレートする
       * @example cy.simulateGanttWebSocketNotification('dependency_created', data)
       */
      simulateGanttWebSocketNotification(type: string, data: any): Chainable<Element>

      /**
       * リアルタイム通知の表示を確認する
       * @example cy.verifyRealtimeNotification('dependency_created', 'other-user@example.com')
       */
      verifyRealtimeNotification(eventType: string, authorName: string): Chainable<Element>

      /**
       * スケジュール調整通知を確認する
       * @example cy.verifyScheduleAdjustmentNotification(['issue-1', 'issue-2'])
       */
      verifyScheduleAdjustmentNotification(affectedIssueIds: string[]): Chainable<Element>

      /**
       * データ準備・検証ヘルパー
       */

      /**
       * ガント用テストデータを作成する
       * @example cy.createGanttTestData('project-123', 5)
       */
      createGanttTestData(projectId: string, taskCount: number): Chainable<Element>

      /**
       * 依存関係チェーンテストデータを作成する
       * @example cy.createDependencyChainData('project-123', 4)
       */
      createDependencyChainData(projectId: string, chainLength: number): Chainable<Element>

      /**
       * ガントチャートの表示状態を検証する
       * @example cy.verifyGanttChartState(expectedTaskCount, expectedDepCount)
       */
      verifyGanttChartState(expectedTaskCount: number, expectedDependencyCount: number): Chainable<Element>

      /**
       * タスクバーの位置と幅を検証する
       * @example cy.verifyTaskBarPosition('issue-123', '2024-01-15', '2024-02-15')
       */
      verifyTaskBarPosition(issueId: string, expectedStartDate: string, expectedEndDate: string): Chainable<Element>

      /**
       * 進捗バーの表示を検証する
       * @example cy.verifyProgressBar('issue-123', 75)
       */
      verifyProgressBar(issueId: string, expectedProgress: number): Chainable<Element>

      /**
       * パフォーマンス・UI応答性コマンド群
       */

      /**
       * 大量データでのレンダリング性能を測定する
       * @example cy.measureGanttRenderingPerformance(100, 80)
       */
      measureGanttRenderingPerformance(taskCount: number, dependencyCount: number): Chainable<Element>

      /**
       * 操作レスポンス時間を測定する
       * @example cy.measureOperationResponseTime(() => cy.createDependency())
       */
      measureOperationResponseTime(operation: () => void): Chainable<Element>

      /**
       * ローディング状態の適切な表示を確認する
       * @example cy.verifyLoadingFeedback('dependency-creation-loading')
       */
      verifyLoadingFeedback(loadingIndicatorTestId: string): Chainable<Element>

      /**
       * エラーハンドリング・復旧コマンド群
       */

      /**
       * バージョン競合エラーを確認する
       * @example cy.verifyVersionConflictDialog()
       */
      verifyVersionConflictDialog(): Chainable<Element>

      /**
       * エラー状態からの復旧操作をテストする
       * @example cy.testErrorRecovery()
       */
      testErrorRecovery(): Chainable<Element>

      /**
       * ネットワークエラー時の動作を確認する
       * @example cy.simulateNetworkErrorAndRecover()
       */
      simulateNetworkErrorAndRecover(): Chainable<Element>

      /**
       * アクセシビリティ・キーボード操作コマンド群
       */

      /**
       * キーボードナビゲーションを検証する
       * @example cy.verifyGanttKeyboardNavigation()
       */
      verifyGanttKeyboardNavigation(): Chainable<Element>

      /**
       * ARIAラベルの適切な設定を確認する
       * @example cy.verifyGanttAccessibilityLabels()
       */
      verifyGanttAccessibilityLabels(): Chainable<Element>

      /**
       * スクリーンリーダー用のアナウンス機能を確認する
       * @example cy.verifyScreenReaderAnnouncements()
       */
      verifyScreenReaderAnnouncements(): Chainable<Element>
    }
  }
}

/**
 * ガントチャート基本操作コマンドの実装
 */

Cypress.Commands.add('navigateToGanttChart', (projectId: string) => {
  cy.visit(`/projects/${projectId}/gantt`)
})

Cypress.Commands.add('waitForGanttChartLoad', () => {
  // ローディングスピナーが消えるまで待つ
  cy.get('[data-testid="gantt-loading"]').should('not.exist')
  // ガントチャートコンテナが表示されることを確認
  cy.get('[data-testid="gantt-chart"]').should('be.visible')
  // レイアウトが完成するまで少し待つ
  cy.wait(500)
})

Cypress.Commands.add('selectTaskBar', (issueId: string) => {
  cy.get(`[data-testid="task-bar-${issueId}"]`).click()
  // 選択状態の確認
  cy.get(`[data-issue-id="${issueId}"]`).should('have.class', 'selected')
})

Cypress.Commands.add('selectMilestone', (issueId: string) => {
  cy.get(`[data-testid="milestone-marker-${issueId}"]`).click()
  // 選択状態の確認
  cy.get(`[data-issue-id="${issueId}"]`).should('have.class', 'selected')
})

Cypress.Commands.add('zoomGanttChart', (direction: 'in' | 'out' | 'reset') => {
  const buttonMap = {
    in: 'zoom-in-btn',
    out: 'zoom-out-btn',
    reset: 'zoom-reset-btn'
  }
  
  cy.get(`[data-testid="${buttonMap[direction]}"]`).click()
  // ズーム変更のアニメーション完了を待つ
  cy.wait(300)
})

Cypress.Commands.add('scrollGanttChart', (direction: 'left' | 'right' | 'up' | 'down', amount: number) => {
  const scrollMap = {
    left: [-amount, 0],
    right: [amount, 0],
    up: [0, -amount],
    down: [0, amount]
  }
  
  const [x, y] = scrollMap[direction]
  cy.get('[data-testid="gantt-container"]').scrollTo(x, y)
})

/**
 * 依存関係管理コマンドの実装
 */

Cypress.Commands.add('openDependencyContextMenu', (issueId: string) => {
  cy.get(`[data-testid="task-bar-${issueId}"]`).rightclick()
  cy.get('[data-testid="dependency-context-menu"]').should('be.visible')
})

Cypress.Commands.add('createDependencyViaRightClick', (predecessorId: string, successorId: string) => {
  // 先行タスクを右クリック
  cy.openDependencyContextMenu(predecessorId)
  // 依存関係作成ボタンをクリック
  cy.get('[data-testid="create-dependency-btn"]').click()
  // 依存関係作成モードに入ることを確認
  cy.get('[data-testid="dependency-creation-mode"]').should('be.visible')
  // 後続タスクをクリック
  cy.get(`[data-testid="task-bar-${successorId}"]`).click()
  // 作成完了を待つ
  cy.get('[data-testid="dependency-created-success"]').should('be.visible')
})

Cypress.Commands.add('openDependencyDeleteMenu', (dependencyId: string) => {
  cy.get(`[data-testid="dependency-line-${dependencyId}"]`).rightclick()
  cy.get('[data-testid="dependency-context-menu"]').should('be.visible')
})

Cypress.Commands.add('deleteDependency', (dependencyId: string) => {
  cy.openDependencyDeleteMenu(dependencyId)
  cy.get('[data-testid="delete-dependency-btn"]').click()
  // 確認ダイアログの処理
  cy.get('[data-testid="delete-dependency-confirmation"]').should('be.visible')
  cy.get('[data-testid="confirm-delete-dependency"]').click()
  // 削除完了を待つ
  cy.get('[data-testid="dependency-deleted-success"]').should('be.visible')
})

Cypress.Commands.add('selectDependencyLine', (dependencyId: string) => {
  cy.get(`[data-testid="dependency-line-${dependencyId}"]`).click()
  cy.get(`[data-testid="dependency-line-${dependencyId}"]`).should('have.class', 'selected')
})

Cypress.Commands.add('verifyCircularDependencyError', (expectedMessage: string) => {
  cy.get('[data-testid="circular-dependency-error"]').should('be.visible')
  cy.get('[data-testid="circular-dependency-error"]').should('contain', expectedMessage)
})

Cypress.Commands.add('verifyDependencyDetails', (dependencyId: string, type: string, lagDays: number) => {
  cy.selectDependencyLine(dependencyId)
  cy.get('[data-testid="dependency-details"]').should('be.visible')
  cy.get('[data-testid="dependency-type"]').should('contain', type)
  cy.get('[data-testid="lag-days"]').should('contain', `${lagDays}日`)
})

/**
 * ドラッグ&ドロップ操作コマンドの実装
 */

Cypress.Commands.add('dragTaskBar', (issueId: string, deltaX: number, deltaY: number = 0) => {
  const startX = 300
  const startY = 200
  const endX = startX + deltaX
  const endY = startY + deltaY
  
  cy.get(`[data-testid="draggable-task-bar-${issueId}"]`)
    .trigger('mousedown', { button: 0, clientX: startX, clientY: startY })
    .trigger('mousemove', { clientX: endX, clientY: endY })
    .trigger('mouseup')
  
  // ドラッグ完了のアニメーションを待つ
  cy.wait(500)
})

Cypress.Commands.add('verifyDragConstraintViolation', (expectedMessage: string) => {
  cy.get('[data-testid="constraint-violation-warning"]').should('be.visible')
  cy.get('[data-testid="constraint-violation-warning"]').should('contain', expectedMessage)
})

Cypress.Commands.add('verifyDragDropSuccess', () => {
  cy.get('[data-testid="drag-drop-success-notification"]').should('be.visible')
  cy.get('[data-testid="drag-drop-success-notification"]').should('contain', 'タスクの日程を変更しました')
})

Cypress.Commands.add('verifyCascadeAdjustmentNotification', () => {
  cy.get('[data-testid="cascade-adjustment-notification"]').should('be.visible')
  cy.get('[data-testid="cascade-adjustment-notification"]').should('contain', '依存タスクの日程も調整されました')
})

/**
 * WebSocketリアルタイム機能コマンドの実装
 */

Cypress.Commands.add('verifyWebSocketConnection', (status: 'connected' | 'disconnected' | 'connecting') => {
  const statusMap = {
    connected: 'リアルタイム同期中',
    disconnected: '切断中',
    connecting: '接続中...'
  }
  
  cy.get('[data-testid="websocket-status"]').should('contain', statusMap[status])
  
  const indicatorClassMap = {
    connected: 'connected',
    disconnected: 'disconnected',
    connecting: 'connecting'
  }
  
  cy.get('[data-testid="websocket-indicator"]').should('have.class', indicatorClassMap[status])
})

Cypress.Commands.add('simulateGanttWebSocketNotification', (type: string, data: any) => {
  cy.window().then((win) => {
    const notification = {
      type,
      data: {
        ...data,
        timestamp: new Date().toISOString()
      }
    }
    win.dispatchEvent(new CustomEvent('websocket-message', { detail: JSON.stringify(notification) }))
  })
})

Cypress.Commands.add('verifyRealtimeNotification', (eventType: string, authorName: string) => {
  cy.get('[data-testid="realtime-notification"]').should('be.visible')
  cy.get('[data-testid="realtime-notification"]').should('contain', authorName)
  
  const eventMessages = {
    dependency_created: '依存関係が作成されました',
    dependency_deleted: '依存関係が削除されました',
    issue_updated: 'タスクが更新されました',
    schedule_adjusted: '日程が調整されました'
  }
  
  if (eventMessages[eventType as keyof typeof eventMessages]) {
    cy.get('[data-testid="realtime-notification"]')
      .should('contain', eventMessages[eventType as keyof typeof eventMessages])
  }
})

Cypress.Commands.add('verifyScheduleAdjustmentNotification', (affectedIssueIds: string[]) => {
  cy.get('[data-testid="schedule-adjustment-notification"]').should('be.visible')
  
  affectedIssueIds.forEach(issueId => {
    cy.get(`[data-issue-id="${issueId}"]`).should('have.class', 'schedule-adjusted')
  })
})

/**
 * データ準備・検証ヘルパーの実装
 */

Cypress.Commands.add('createGanttTestData', (projectId: string, taskCount: number) => {
  const tasks = Array.from({ length: taskCount }, (_, i) => {
    const startDate = new Date(2024, 0, (i * 7) + 1) // 7-day intervals
    const endDate = new Date(startDate.getTime() + (5 * 24 * 60 * 60 * 1000)) // 5-day duration
    
    return {
      id: `test-task-${i + 1}`,
      project_id: projectId,
      title: `Test Task ${i + 1}`,
      description_md: `Description for test task ${i + 1}`,
      status: ['open', 'in_progress', 'done'][i % 3] as 'open' | 'in_progress' | 'done',
      assignee: `user-${(i % 3) + 1}@example.com`,
      progress_pct: Math.floor(Math.random() * 101),
      is_blocked: false,
      labels: [`category-${(i % 5) + 1}`],
      sort_order: (i + 1) * 100,
      version: 1,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      wbs_number: `${i + 1}`,
      parent_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: []
    }
  })
  
  cy.wrap(tasks).as('ganttTestTasks')
  return cy.wrap(tasks)
})

Cypress.Commands.add('createDependencyChainData', (projectId: string, chainLength: number) => {
  cy.createGanttTestData(projectId, chainLength).then((tasks: any[]) => {
    const dependencies = Array.from({ length: chainLength - 1 }, (_, i) => ({
      id: `chain-dep-${i + 1}`,
      predecessor_issue_id: tasks[i].id,
      successor_issue_id: tasks[i + 1].id,
      dependency_type: 'finish_to_start' as const,
      lag_days: i === 0 ? 2 : 0, // First dependency has 2-day lag
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
    
    cy.wrap({ tasks, dependencies }).as('dependencyChainTestData')
    return cy.wrap({ tasks, dependencies })
  })
})

Cypress.Commands.add('verifyGanttChartState', (expectedTaskCount: number, expectedDependencyCount: number) => {
  // タスク数の確認
  cy.get('[data-testid^="task-bar-"]').should('have.length', expectedTaskCount)
  
  // 依存関係数の確認
  if (expectedDependencyCount > 0) {
    cy.get('[data-testid^="dependency-line-"]').should('have.length', expectedDependencyCount)
  }
  
  // ヘッダー情報の確認
  cy.get('[data-testid="gantt-header"]').should('contain', `${expectedTaskCount} タスク`)
  
  if (expectedDependencyCount > 0) {
    cy.get('[data-testid="dependency-stats"]').should('contain', `依存関係: ${expectedDependencyCount}件`)
  }
})

Cypress.Commands.add('verifyTaskBarPosition', (issueId: string, expectedStartDate: string, expectedEndDate: string) => {
  // タスクバーが存在することを確認
  cy.get(`[data-testid="task-bar-${issueId}"]`).should('be.visible')
  
  // 日付情報の確認（テキスト表示から）
  cy.get(`[data-issue-id="${issueId}"]`).within(() => {
    cy.get('.task-date-range').should('contain', expectedStartDate)
    cy.get('.task-date-range').should('contain', expectedEndDate)
  })
})

Cypress.Commands.add('verifyProgressBar', (issueId: string, expectedProgress: number) => {
  cy.get(`[data-testid="progress-bar-${issueId}"]`)
    .should('be.visible')
    .should('contain', `${expectedProgress}%`)
  
  // プログレスバーの幅も確認
  cy.get(`[data-testid="progress-fill-${issueId}"]`)
    .should('have.css', 'width')
    .then((width) => {
      // 概ね期待値に近い幅であることを確認（誤差を考慮）
      const expectedWidthPercent = expectedProgress
      expect(width).to.match(new RegExp(`${expectedWidthPercent - 5}%|${expectedWidthPercent}%|${expectedWidthPercent + 5}%`))
    })
})

/**
 * パフォーマンス・UI応答性コマンドの実装
 */

Cypress.Commands.add('measureGanttRenderingPerformance', (taskCount: number, dependencyCount: number) => {
  const startTime = performance.now()
  
  cy.get('[data-testid="gantt-chart"]').should('be.visible')
  
  cy.then(() => {
    const endTime = performance.now()
    const renderingTime = endTime - startTime
    
    cy.log(`Gantt chart rendering time: ${renderingTime.toFixed(2)}ms`)
    cy.log(`Tasks: ${taskCount}, Dependencies: ${dependencyCount}`)
    
    // パフォーマンス基準: 大量データでも5秒以内
    expect(renderingTime).to.be.lessThan(5000)
  })
})

Cypress.Commands.add('measureOperationResponseTime', (operation: () => void) => {
  const startTime = performance.now()
  
  operation()
  
  cy.then(() => {
    const endTime = performance.now()
    const operationTime = endTime - startTime
    
    cy.log(`Operation response time: ${operationTime.toFixed(2)}ms`)
    
    // 応答性基準: 操作は1秒以内
    expect(operationTime).to.be.lessThan(1000)
  })
})

Cypress.Commands.add('verifyLoadingFeedback', (loadingIndicatorTestId: string) => {
  // ローディングインジケーターが表示されることを確認
  cy.get(`[data-testid="${loadingIndicatorTestId}"]`).should('be.visible')
  
  // ローディング中もキャンセルボタンが利用可能であることを確認
  cy.get('[data-testid="cancel-operation"]').should('be.visible').and('not.be.disabled')
  
  // 他のUI要素が操作可能であることを確認
  cy.get('[data-testid="gantt-zoom-controls"]').should('be.visible')
})

/**
 * エラーハンドリング・復旧コマンドの実装
 */

Cypress.Commands.add('verifyVersionConflictDialog', () => {
  cy.get('[data-testid="version-conflict-dialog"]').should('be.visible')
  cy.get('[data-testid="conflict-resolution-message"]').should('contain', '他のユーザーによって変更されています')
  
  // 解決オプションが提供されていることを確認
  cy.get('[data-testid="reload-and-retry"]').should('be.visible')
  cy.get('[data-testid="discard-changes"]').should('be.visible')
})

Cypress.Commands.add('testErrorRecovery', () => {
  // エラー状態を想定
  cy.get('[data-testid="operation-error"]').should('be.visible')
  
  // リトライボタンの存在確認
  cy.get('[data-testid="retry-operation"]').should('be.visible').click()
  
  // 復旧成功を確認
  cy.get('[data-testid="operation-success"]').should('be.visible')
  cy.get('[data-testid="operation-error"]').should('not.exist')
})

Cypress.Commands.add('simulateNetworkErrorAndRecover', () => {
  // ネットワークエラーのシミュレート
  cy.intercept('POST', '**/dependencies', { forceNetworkError: true }).as('networkError')
  
  // 操作実行
  cy.get('[data-testid="create-dependency-btn"]').click()
  cy.wait('@networkError')
  
  // エラー表示の確認
  cy.get('[data-testid="network-error"]').should('be.visible')
  
  // 復旧: 正常なレスポンスに戻す
  cy.intercept('POST', '**/dependencies', { fixture: 'dependency-success.json' }).as('recoverySuccess')
  
  // リトライ
  cy.get('[data-testid="retry-network-operation"]').click()
  cy.wait('@recoverySuccess')
  
  // 復旧確認
  cy.get('[data-testid="operation-success"]').should('be.visible')
})

/**
 * アクセシビリティ・キーボード操作コマンドの実装
 */

Cypress.Commands.add('verifyGanttKeyboardNavigation', () => {
  // Tab による フォーカス移動
  cy.get('body').tab()
  cy.focused().should('have.attr', 'data-testid').and('match', /task-bar-|milestone-marker-/)
  
  // Arrow key による ナビゲーション
  cy.focused().type('{rightarrow}')
  cy.focused().should('not.equal', '[data-testid="task-bar-"]')
  
  // Enter による 選択
  cy.focused().type('{enter}')
  cy.focused().should('have.class', 'selected')
  
  // Escape による キャンセル
  cy.get('body').type('{esc}')
})

Cypress.Commands.add('verifyGanttAccessibilityLabels', () => {
  // タスクバーのARIAラベル
  cy.get('[data-testid^="task-bar-"]').first().should('have.attr', 'aria-label')
  
  // 依存関係線のARIAラベル
  cy.get('[data-testid^="dependency-line-"]').first().should('have.attr', 'aria-label')
  
  // ガントチャート全体のアクセシビリティ属性
  cy.get('[data-testid="gantt-chart"]').should('have.attr', 'role', 'application')
  cy.get('[data-testid="gantt-chart"]').should('have.attr', 'aria-label', 'ガントチャート')
})

Cypress.Commands.add('verifyScreenReaderAnnouncements', () => {
  // Live region の存在確認
  cy.get('[data-testid="sr-announcements"]').should('exist')
  cy.get('[data-testid="sr-announcements"]').should('have.attr', 'aria-live', 'polite')
  
  // 操作時のアナウンス確認
  cy.selectTaskBar('test-task-1')
  cy.get('[data-testid="sr-announcements"]').should('contain', 'selected')
})

/**
 * ヘルパー関数群
 */

// 日付フォーマット変換
const formatDateForGantt = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// タスクIDからDOM要素セレクタを生成
const getTaskBarSelector = (issueId: string): string => {
  return `[data-testid="task-bar-${issueId}"]`
}

// 依存関係IDからDOM要素セレクタを生成
const getDependencyLineSelector = (dependencyId: string): string => {
  return `[data-testid="dependency-line-${dependencyId}"]`
}

// ピクセル値から日数を概算計算（ガントチャートの設定に依存）
const pixelsToDays = (pixels: number, pixelsPerDay: number = 14): number => {
  return Math.round(pixels / pixelsPerDay)
}

// 日数からピクセル値を概算計算
const daysToPixels = (days: number, pixelsPerDay: number = 14): number => {
  return days * pixelsPerDay
}

export {
  formatDateForGantt,
  getTaskBarSelector,
  getDependencyLineSelector,
  pixelsToDays,
  daysToPixels
}

export {}