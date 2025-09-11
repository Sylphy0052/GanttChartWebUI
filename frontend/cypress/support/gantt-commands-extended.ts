/// <reference types="cypress" />

/**
 * Extended Gantt Chart Commands for Enhanced E2E Testing
 * 
 * 新しいテストケースに対応するための拡張ガントコマンド
 */

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * 新しい拡張ガントコマンド群
       */

      /**
       * マイルストーン操作のテスト
       * @example cy.verifyMilestoneDisplay('milestone-123', '2024-02-01')
       */
      verifyMilestoneDisplay(milestoneId: string, expectedDate: string): Chainable<Element>

      /**
       * 依存関係制約プレビューの検証
       * @example cy.verifyConstraintPreview('task-1', 'task-2', 'valid')
       */
      verifyConstraintPreview(
        predecessorId: string, 
        successorId: string, 
        expectedState: 'valid' | 'invalid'
      ): Chainable<Element>

      /**
       * ドラッグ中の視覚的フィードバックの検証
       * @example cy.verifyDragFeedback('task-1', { x: 100, y: 0 })
       */
      verifyDragFeedback(
        taskId: string, 
        dragPosition: { x: number; y: number }
      ): Chainable<Element>

      /**
       * タスクバーの視覚的プロパティ検証
       * @example cy.verifyTaskBarVisualProperties('task-1', { color: 'blue', height: 20 })
       */
      verifyTaskBarVisualProperties(
        taskId: string, 
        expectedProperties: { color?: string; height?: number; width?: number }
      ): Chainable<Element>

      /**
       * 権限制限の詳細検証
       * @example cy.verifyPermissionRestrictions('viewer', ['create', 'edit', 'delete'])
       */
      verifyPermissionRestrictions(
        userRole: 'viewer' | 'editor', 
        restrictedActions: string[]
      ): Chainable<Element>

      /**
       * WebSocket接続状態の詳細検証
       * @example cy.verifyWebSocketState({ connected: true, lastMessage: 'dependency_created' })
       */
      verifyWebSocketState(
        expectedState: { 
          connected: boolean; 
          lastMessage?: string; 
          reconnectAttempts?: number 
        }
      ): Chainable<Element>

      /**
       * エラー回復フローの検証
       * @example cy.verifyErrorRecoveryFlow('network_error', 'retry_button')
       */
      verifyErrorRecoveryFlow(
        errorType: string, 
        recoveryAction: string
      ): Chainable<Element>

      /**
       * パフォーマンス指標の測定
       * @example cy.measureInteractionPerformance('dependency_creation', 1000)
       */
      measureInteractionPerformance(
        operationType: string, 
        maxExpectedTimeMs: number
      ): Chainable<Element>

      /**
       * ツールチップ内容の詳細検証
       * @example cy.verifyTooltipContent('task-1', { title: 'Test Task', progress: 75 })
       */
      verifyTooltipContent(
        elementId: string, 
        expectedContent: { [key: string]: any }
      ): Chainable<Element>

      /**
       * キーボードショートカットの検証
       * @example cy.verifyKeyboardShortcuts([{ key: 'ctrl+d', action: 'create_dependency' }])
       */
      verifyKeyboardShortcuts(
        shortcuts: Array<{ key: string; action: string }>
      ): Chainable<Element>

      /**
       * レスポンシブレイアウトの検証
       * @example cy.verifyResponsiveLayout(768, 'mobile')
       */
      verifyResponsiveLayout(
        viewportWidth: number, 
        expectedLayout: 'mobile' | 'tablet' | 'desktop'
      ): Chainable<Element>

      /**
       * データ同期の検証
       * @example cy.verifyDataSynchronization('wbs_tree', 'gantt_chart')
       */
      verifyDataSynchronization(
        sourceComponent: string, 
        targetComponent: string
      ): Chainable<Element>

      /**
       * バリデーションメッセージの検証
       * @example cy.verifyValidationMessages(['start_date_invalid', 'circular_dependency'])
       */
      verifyValidationMessages(expectedValidations: string[]): Chainable<Element>

      /**
       * 進捗アニメーションの検証
       * @example cy.verifyProgressAnimation('task-1', 50, 75)
       */
      verifyProgressAnimation(
        taskId: string, 
        fromProgress: number, 
        toProgress: number
      ): Chainable<Element>

      /**
       * 複数ユーザー協調編集の検証
       * @example cy.verifyCollaborativeEditing('user1', 'user2', 'dependency_created')
       */
      verifyCollaborativeEditing(
        user1: string, 
        user2: string, 
        action: string
      ): Chainable<Element>
    }
  }
}

/**
 * マイルストーン関連のコマンド実装
 */

Cypress.Commands.add('verifyMilestoneDisplay', (milestoneId: string, expectedDate: string) => {
  // マイルストーンマーカーが存在し、正しい日付に配置されていることを確認
  cy.get(`[data-testid="milestone-marker-${milestoneId}"]`)
    .should('be.visible')
    .should('have.attr', 'data-date', expectedDate)
    .should('have.class', 'milestone-diamond')

  // マイルストーンが正しい位置に表示されていることを確認
  cy.get(`[data-testid="milestone-marker-${milestoneId}"]`)
    .should('have.css', 'position', 'absolute')
    .should('have.attr', 'data-task-type', 'milestone')
})

/**
 * 依存関係制約プレビューのコマンド実装
 */

Cypress.Commands.add('verifyConstraintPreview', (
  predecessorId: string, 
  successorId: string, 
  expectedState: 'valid' | 'invalid'
) => {
  // 制約プレビューが表示されることを確認
  cy.get('[data-testid="constraint-preview"]').should('be.visible')
  
  // 予想される状態に基づいて検証
  if (expectedState === 'valid') {
    cy.get('[data-testid="valid-drop-zone"]').should('be.visible')
    cy.get('[data-testid="constraint-violation-indicator"]').should('not.exist')
  } else {
    cy.get('[data-testid="invalid-drop-zone"]').should('be.visible')
    cy.get('[data-testid="constraint-violation-indicator"]').should('be.visible')
    cy.get('[data-testid="constraint-violation-indicator"]').should('contain', '制約違反')
  }

  // 関連するタスクがハイライトされていることを確認
  cy.get(`[data-testid="task-bar-${predecessorId}"]`).should('have.class', 'constraint-highlighted')
  cy.get(`[data-testid="task-bar-${successorId}"]`).should('have.class', 'constraint-highlighted')
})

/**
 * ドラッグフィードバックのコマンド実装
 */

Cypress.Commands.add('verifyDragFeedback', (
  taskId: string, 
  dragPosition: { x: number; y: number }
) => {
  // ドラッグ中のタスクバーが正しい位置にあることを確認
  cy.get(`[data-testid="draggable-task-bar-${taskId}"]`)
    .should('have.class', 'dragging')
    .should('have.css', 'transform')
    .should('include', `translate(${dragPosition.x}px, ${dragPosition.y}px)`)

  // ドラッグプレビューが表示されていることを確認
  cy.get('[data-testid="drag-preview"]').should('be.visible')
  
  // 新しい日付の表示
  cy.get('[data-testid="drag-date-preview"]').should('be.visible')
  
  // ドロップゾーンインジケーター
  cy.get('[data-testid="drop-zone-indicator"]').should('be.visible')
})

/**
 * タスクバー視覚プロパティのコマンド実装
 */

Cypress.Commands.add('verifyTaskBarVisualProperties', (
  taskId: string, 
  expectedProperties: { color?: string; height?: number; width?: number }
) => {
  const taskBar = cy.get(`[data-testid="task-bar-${taskId}"]`)

  if (expectedProperties.color) {
    taskBar.should('have.css', 'background-color')
      .should('include', expectedProperties.color)
  }

  if (expectedProperties.height) {
    taskBar.should('have.css', 'height', `${expectedProperties.height}px`)
  }

  if (expectedProperties.width) {
    taskBar.invoke('width').should('be.closeTo', expectedProperties.width, 5)
  }

  // 基本的な表示プロパティの確認
  taskBar.should('be.visible')
    .should('have.css', 'position', 'absolute')
    .should('have.css', 'border-radius')
})

/**
 * 権限制限のコマンド実装
 */

Cypress.Commands.add('verifyPermissionRestrictions', (
  userRole: 'viewer' | 'editor', 
  restrictedActions: string[]
) => {
  restrictedActions.forEach(action => {
    switch (action) {
      case 'create':
        cy.get('[data-testid="create-dependency-btn"]').should('not.exist')
        break
      case 'edit':
        cy.get('[data-testid="edit-task-btn"]').should('be.disabled')
        break
      case 'delete':
        cy.get('[data-testid="delete-dependency-btn"]').should('not.exist')
        break
      case 'drag':
        cy.get('[data-testid^="task-bar-"]').should('not.have.class', 'draggable')
        break
    }
  })

  // 権限表示の確認
  if (userRole === 'viewer') {
    cy.get('[data-testid="user-role-indicator"]').should('contain', '閲覧専用')
    cy.get('[data-testid="permission-notice"]').should('be.visible')
  }
})

/**
 * WebSocket状態のコマンド実装
 */

Cypress.Commands.add('verifyWebSocketState', (expectedState: { 
  connected: boolean; 
  lastMessage?: string; 
  reconnectAttempts?: number 
}) => {
  // 接続状態の確認
  const expectedStatus = expectedState.connected ? 'connected' : 'disconnected'
  cy.get('[data-testid="websocket-indicator"]').should('have.class', expectedStatus)

  if (expectedState.connected) {
    cy.get('[data-testid="websocket-status"]').should('contain', 'リアルタイム同期中')
  } else {
    cy.get('[data-testid="websocket-status"]').should('contain', '切断中')
  }

  // 最後のメッセージの確認
  if (expectedState.lastMessage) {
    cy.get('[data-testid="last-websocket-message"]')
      .should('contain', expectedState.lastMessage)
  }

  // 再接続試行回数の確認
  if (expectedState.reconnectAttempts !== undefined) {
    cy.get('[data-testid="reconnect-attempts"]')
      .should('contain', expectedState.reconnectAttempts.toString())
  }
})

/**
 * エラー回復フローのコマンド実装
 */

Cypress.Commands.add('verifyErrorRecoveryFlow', (errorType: string, recoveryAction: string) => {
  // エラー状態の確認
  cy.get(`[data-testid="${errorType}-error"]`).should('be.visible')
  
  // 回復オプションの存在確認
  cy.get(`[data-testid="${recoveryAction}"]`).should('be.visible').click()
  
  // 回復処理の実行
  cy.get('[data-testid="recovery-in-progress"]').should('be.visible')
  
  // 回復完了の確認
  cy.get('[data-testid="recovery-success"]').should('be.visible')
  cy.get(`[data-testid="${errorType}-error"]`).should('not.exist')
})

/**
 * パフォーマンス測定のコマンド実装
 */

Cypress.Commands.add('measureInteractionPerformance', (
  operationType: string, 
  maxExpectedTimeMs: number
) => {
  const startTime = performance.now()
  
  // 操作の完了を待つ（操作タイプに基づく）
  cy.get(`[data-testid="${operationType}-completed"]`).should('be.visible')
  
  cy.then(() => {
    const endTime = performance.now()
    const operationTime = endTime - startTime
    
    cy.log(`${operationType} performance: ${operationTime.toFixed(2)}ms`)
    
    // パフォーマンス基準の確認
    expect(operationTime).to.be.lessThan(maxExpectedTimeMs)
    
    // パフォーマンス警告の表示
    if (operationTime > maxExpectedTimeMs * 0.8) {
      cy.log(`⚠️ Performance warning: ${operationType} took ${operationTime.toFixed(2)}ms`)
    }
  })
})

/**
 * ツールチップ内容のコマンド実装
 */

Cypress.Commands.add('verifyTooltipContent', (
  elementId: string, 
  expectedContent: { [key: string]: any }
) => {
  // 要素にホバーしてツールチップを表示
  cy.get(`[data-testid="${elementId}"]`).trigger('mouseover')
  
  // ツールチップの存在確認
  cy.get('[data-testid="tooltip"]').should('be.visible')
  
  // 期待される内容の確認
  Object.entries(expectedContent).forEach(([key, value]) => {
    cy.get(`[data-testid="tooltip-${key}"]`).should('contain', value.toString())
  })
  
  // ツールチップの適切な位置の確認
  cy.get('[data-testid="tooltip"]')
    .should('have.css', 'position', 'absolute')
    .should('be.visible')
})

/**
 * キーボードショートカットのコマンド実装
 */

Cypress.Commands.add('verifyKeyboardShortcuts', (
  shortcuts: Array<{ key: string; action: string }>
) => {
  shortcuts.forEach(shortcut => {
    // ショートカットキーの実行
    cy.get('body').type(`{${shortcut.key}}`)
    
    // アクションの実行結果を確認
    cy.get(`[data-testid="${shortcut.action}-triggered"]`).should('be.visible')
    
    // ショートカットヘルプの表示確認
    cy.get('[data-testid="keyboard-shortcuts-help"]').within(() => {
      cy.contains(shortcut.key).should('be.visible')
      cy.contains(shortcut.action).should('be.visible')
    })
  })
})

/**
 * レスポンシブレイアウトのコマンド実装
 */

Cypress.Commands.add('verifyResponsiveLayout', (
  viewportWidth: number, 
  expectedLayout: 'mobile' | 'tablet' | 'desktop'
) => {
  // ビューポートサイズの設定
  cy.viewport(viewportWidth, 800)
  
  // レイアウトクラスの確認
  cy.get('[data-testid="gantt-layout"]').should('have.class', `${expectedLayout}-layout`)
  
  // レスポンシブ要素の表示/非表示確認
  if (expectedLayout === 'mobile') {
    cy.get('[data-testid="mobile-navigation"]').should('be.visible')
    cy.get('[data-testid="desktop-sidebar"]').should('not.be.visible')
  } else if (expectedLayout === 'desktop') {
    cy.get('[data-testid="desktop-sidebar"]').should('be.visible')
    cy.get('[data-testid="mobile-navigation"]').should('not.be.visible')
  }
  
  // パネルサイズの適応確認
  cy.get('[data-testid="wbs-panel"]').invoke('width').should('be.lessThan', viewportWidth)
})

/**
 * データ同期のコマンド実装
 */

Cypress.Commands.add('verifyDataSynchronization', (
  sourceComponent: string, 
  targetComponent: string
) => {
  // ソースコンポーネントでの変更
  cy.get(`[data-testid="${sourceComponent}-item-1"]`).click()
  
  // ターゲットコンポーネントでの同期確認
  cy.get(`[data-testid="${targetComponent}-item-1"]`).should('have.class', 'selected')
  
  // データ一貫性の確認
  cy.get(`[data-testid="${sourceComponent}-data"]`).invoke('text').then(sourceData => {
    cy.get(`[data-testid="${targetComponent}-data"]`).should('contain', sourceData)
  })
  
  // 同期インジケーターの確認
  cy.get('[data-testid="sync-indicator"]').should('have.class', 'synchronized')
})

/**
 * バリデーションメッセージのコマンド実装
 */

Cypress.Commands.add('verifyValidationMessages', (expectedValidations: string[]) => {
  // バリデーション結果コンテナの確認
  cy.get('[data-testid="validation-results"]').should('be.visible')
  
  expectedValidations.forEach(validation => {
    cy.get(`[data-testid="validation-${validation}"]`)
      .should('be.visible')
      .should('have.class', 'validation-error')
  })
  
  // バリデーション要約の確認
  cy.get('[data-testid="validation-summary"]')
    .should('contain', `${expectedValidations.length}件の問題`)
})

/**
 * 進捗アニメーションのコマンド実装
 */

Cypress.Commands.add('verifyProgressAnimation', (
  taskId: string, 
  fromProgress: number, 
  toProgress: number
) => {
  // 初期進捗の確認
  cy.get(`[data-testid="progress-bar-${taskId}"]`).should('contain', `${fromProgress}%`)
  
  // 進捗変更のトリガー
  cy.window().then((win) => {
    win.dispatchEvent(new CustomEvent('progress-update', {
      detail: { taskId, progress: toProgress }
    }))
  })
  
  // アニメーション中の確認
  cy.get(`[data-testid="progress-animation-${taskId}"]`).should('be.visible')
  
  // 最終進捗の確認
  cy.get(`[data-testid="progress-bar-${taskId}"]`).should('contain', `${toProgress}%`)
  
  // アニメーション完了の確認
  cy.get(`[data-testid="progress-animation-${taskId}"]`).should('not.exist')
})

/**
 * 協調編集のコマンド実装
 */

Cypress.Commands.add('verifyCollaborativeEditing', (
  user1: string, 
  user2: string, 
  action: string
) => {
  // ユーザー1のアクション
  cy.setUserRole('editor')
  cy.window().then((win) => {
    win.localStorage.setItem('currentUser', user1)
  })
  
  // アクションの実行
  cy.get(`[data-testid="perform-${action}"]`).click()
  
  // ユーザー2への通知確認
  cy.simulateGanttWebSocketNotification(action, {
    author: user1,
    timestamp: new Date().toISOString()
  })
  
  // 協調編集インジケーターの確認
  cy.get('[data-testid="collaborative-editing-indicator"]').should('be.visible')
  cy.get('[data-testid="other-users-actions"]').should('contain', user1)
  
  // 競合回避の確認
  cy.get('[data-testid="conflict-resolution"]').should('not.exist')
})

export {}