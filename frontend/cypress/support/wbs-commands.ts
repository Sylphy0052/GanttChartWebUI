/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * WBS tree特有のカスタムコマンド群
       */

      /**
       * WBSツリーを展開/折りたたみする
       * @example cy.toggleWBSNode('issue-123')
       */
      toggleWBSNode(issueId: string): Chainable<Element>

      /**
       * WBSツリーのすべてのノードを展開する
       * @example cy.expandAllWBSNodes()
       */
      expandAllWBSNodes(): Chainable<Element>

      /**
       * WBSツリーのすべてのノードを折りたたむ
       * @example cy.collapseAllWBSNodes()
       */
      collapseAllWBSNodes(): Chainable<Element>

      /**
       * 指定されたIssueがWBSツリー内で表示されているかチェック
       * @example cy.verifyWBSNodeVisible('issue-123')
       */
      verifyWBSNodeVisible(issueId: string, shouldBeVisible?: boolean): Chainable<Element>

      /**
       * WBS番号が正しく表示されているかチェック
       * @example cy.verifyWBSNumber('issue-123', '1.2.3')
       */
      verifyWBSNumber(issueId: string, expectedWBSNumber: string): Chainable<Element>

      /**
       * 階層レベルが正しく表示されているかチェック
       * @example cy.verifyHierarchyLevel('issue-123', 2)
       */
      verifyHierarchyLevel(issueId: string, expectedLevel: number): Chainable<Element>

      /**
       * ドラッグ&ドロップでIssueを並び替える
       * @example cy.dragAndDropIssue('issue-1', 'issue-2', 'before')
       */
      dragAndDropIssue(draggedId: string, targetId: string, position?: 'before' | 'after'): Chainable<Element>

      /**
       * 同一階層チェックを無視してドラッグ&ドロップを試行（エラーテスト用）
       * @example cy.attemptCrossHierarchyDrag('child-issue', 'parent-issue')
       */
      attemptCrossHierarchyDrag(draggedId: string, targetId: string): Chainable<Element>

      /**
       * WebSocketでWBS関連の通知をシミュレート
       * @example cy.simulateWBSWebSocketMessage('issues_reordered', { projectId: 'test', affectedIssues: [] })
       */
      simulateWBSWebSocketMessage(eventType: string, data: any): Chainable<Element>

      /**
       * WBSツリーの読み込み状態をチェック
       * @example cy.waitForWBSTreeLoad()
       */
      waitForWBSTreeLoad(): Chainable<Element>

      /**
       * 階層構造のあるテストデータを作成
       * @example cy.createHierarchicalTestIssues('project-123', 3, 2)
       */
      createHierarchicalTestIssues(projectId: string, depth: number, childrenPerLevel: number): Chainable<Element>

      /**
       * WBSツリー内の並び順をチェック
       * @example cy.verifyWBSTreeOrder(['issue-1', 'issue-2', 'issue-3'])
       */
      verifyWBSTreeOrder(expectedOrder: string[]): Chainable<Element>

      /**
       * Progress barの表示と値をチェック
       * @example cy.verifyProgressDisplay('issue-123', 75)
       */
      verifyProgressDisplay(issueId: string, expectedProgress: number): Chainable<Element>

      /**
       * キーボードナビゲーションでWBSツリーを操作
       * @example cy.navigateWBSWithKeyboard('down', 'issue-123')
       */
      navigateWBSWithKeyboard(direction: 'up' | 'down' | 'left' | 'right', startFromIssue?: string): Chainable<Element>

      /**
       * 並び替え権限に基づくUI状態をチェック
       * @example cy.verifyReorderPermissions('editor')
       */
      verifyReorderPermissions(role: 'editor' | 'viewer'): Chainable<Element>

      /**
       * WBS関連エラー状態をチェック
       * @example cy.verifyWBSErrorState('同一階層内でのみ並び替えが可能です')
       */
      verifyWBSErrorState(expectedErrorMessage?: string): Chainable<Element>

      /**
       * リアルタイム更新の通知をチェック
       * @example cy.verifyRealtimeUpdateNotification('other-user@example.com', 'reorder')
       */
      verifyRealtimeUpdateNotification(userName: string, changeType: 'reorder' | 'hierarchy'): Chainable<Element>

      /**
       * WBSツリーの状態をスナップショットとして保存
       * @example cy.captureWBSTreeSnapshot('before-reorder')
       */
      captureWBSTreeSnapshot(snapshotName: string): Chainable<Element>

      /**
       * WBSツリー状態を以前のスナップショットと比較
       * @example cy.compareWBSTreeWithSnapshot('before-reorder')
       */
      compareWBSTreeWithSnapshot(snapshotName: string): Chainable<Element>
    }
  }
}

/**
 * WBS tree特有のカスタムコマンド実装
 */

// WBSノードの展開/折りたたみ
Cypress.Commands.add('toggleWBSNode', (issueId: string) => {
  cy.get(`[data-testid="expand-toggle-${issueId}"]`).click()
})

// すべてのWBSノードを展開
Cypress.Commands.add('expandAllWBSNodes', () => {
  cy.get('[data-testid="expand-all-btn"]').click()
  // 展開アニメーションの完了を待つ
  cy.wait(500)
})

// すべてのWBSノードを折りたたみ
Cypress.Commands.add('collapseAllWBSNodes', () => {
  cy.get('[data-testid="collapse-all-btn"]').click()
  // 折りたたみアニメーションの完了を待つ
  cy.wait(500)
})

// WBSノードの表示状態をチェック
Cypress.Commands.add('verifyWBSNodeVisible', (issueId: string, shouldBeVisible: boolean = true) => {
  const assertion = shouldBeVisible ? 'be.visible' : 'not.be.visible'
  cy.get(`[data-testid="wbs-node-${issueId}"]`).should(assertion)
})

// WBS番号の表示をチェック
Cypress.Commands.add('verifyWBSNumber', (issueId: string, expectedWBSNumber: string) => {
  cy.get(`[data-testid="wbs-number-${issueId}"]`).should('contain', expectedWBSNumber)
})

// 階層レベルの表示をチェック
Cypress.Commands.add('verifyHierarchyLevel', (issueId: string, expectedLevel: number) => {
  cy.get(`[data-testid="wbs-node-${issueId}"]`).should('have.class', `level-${expectedLevel}`)
})

// ドラッグ&ドロップでの並び替え
Cypress.Commands.add('dragAndDropIssue', (draggedId: string, targetId: string, position: 'before' | 'after' = 'after') => {
  // HTML5 drag and drop APIを使用
  const dataTransfer = new DataTransfer()
  
  cy.get(`[data-testid="draggable-row-${draggedId}"]`)
    .trigger('dragstart', { dataTransfer })
  
  cy.get(`[data-testid="draggable-row-${targetId}"]`)
    .trigger('dragover', { dataTransfer })
    .trigger('drop', { dataTransfer })
    .trigger('dragend')

  // 並び替え完了の通知を待つ
  cy.get('[data-testid="reorder-success-notification"]', { timeout: 10000 }).should('be.visible')
})

// 階層を超えたドラッグ&ドロップを試行（エラーテスト用）
Cypress.Commands.add('attemptCrossHierarchyDrag', (draggedId: string, targetId: string) => {
  const dataTransfer = new DataTransfer()
  
  cy.get(`[data-testid="draggable-row-${draggedId}"]`)
    .trigger('dragstart', { dataTransfer })
  
  cy.get(`[data-testid="draggable-row-${targetId}"]`)
    .trigger('dragover', { dataTransfer })
    .trigger('drop', { dataTransfer })

  // エラー通知を期待
  cy.get('[data-testid="reorder-error-notification"]').should('be.visible')
})

// WBS関連WebSocket通知のシミュレート
Cypress.Commands.add('simulateWBSWebSocketMessage', (eventType: string, data: any) => {
  cy.window().then((win) => {
    const message = JSON.stringify({ 
      event: eventType,
      data: data,
      timestamp: new Date().toISOString()
    })
    win.dispatchEvent(new CustomEvent('websocket-message', { detail: message }))
  })
})

// WBSツリーの読み込み完了を待つ
Cypress.Commands.add('waitForWBSTreeLoad', () => {
  // Loading spinnerが消えるまで待つ
  cy.get('[data-testid="wbs-tree-loading"]').should('not.exist')
  // WBSツリーが表示されることを確認
  cy.get('[data-testid="wbs-tree-view"]').should('be.visible')
  // テーブルヘッダーが存在することを確認
  cy.get('[data-testid="wbs-tree-header"]').should('be.visible')
})

// 階層構造テストデータの作成
Cypress.Commands.add('createHierarchicalTestIssues', (projectId: string, depth: number, childrenPerLevel: number) => {
  const generateIssues = (level: number, parentId: string | null, parentWBS: string = ''): any[] => {
    const issues: any[] = []
    
    for (let i = 1; i <= childrenPerLevel; i++) {
      const wbsNumber = parentWBS ? `${parentWBS}.${i}` : `${i}`
      const issueId = `test-issue-${wbsNumber.replace(/\./g, '-')}`
      
      const issue = {
        id: issueId,
        project_id: projectId,
        title: `Test Issue ${wbsNumber}`,
        description_md: `Description for issue ${wbsNumber}`,
        status: level % 2 === 0 ? 'open' : 'in_progress',
        assignee: level === 1 ? 'lead@example.com' : 'dev@example.com',
        progress_pct: Math.floor(Math.random() * 100),
        is_blocked: false,
        labels: [`level-${level}`],
        sort_order: i * 100,
        version: 1,
        wbs_number: wbsNumber,
        parent_id: parentId,
        created_at: new Date(Date.now() - (depth - level) * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        children: level < depth ? generateIssues(level + 1, issueId, wbsNumber) : []
      }
      
      issues.push(issue)
    }
    
    return issues
  }

  const hierarchicalIssues = generateIssues(1, null)
  
  // Created test data をcypress内部に保存
  cy.wrap(hierarchicalIssues).as('hierarchicalTestData')
  
  return cy.wrap(hierarchicalIssues)
})

// WBSツリーの並び順をチェック
Cypress.Commands.add('verifyWBSTreeOrder', (expectedOrder: string[]) => {
  expectedOrder.forEach((issueId, index) => {
    cy.get('[data-testid="wbs-tree-table"] tbody tr').eq(index)
      .should('contain', issueId)
      .find(`[data-testid="wbs-node-${issueId}"]`)
      .should('be.visible')
  })
})

// Progress barの表示チェック
Cypress.Commands.add('verifyProgressDisplay', (issueId: string, expectedProgress: number) => {
  cy.get(`[data-testid="progress-bar-${issueId}"]`)
    .should('be.visible')
    .should('contain', `${expectedProgress}%`)
  
  // Progress barの幅もチェック
  cy.get(`[data-testid="progress-fill-${issueId}"]`)
    .should('have.css', 'width')
    .and('match', new RegExp(`${expectedProgress}%|${expectedProgress/100}%`))
})

// キーボードナビゲーション
Cypress.Commands.add('navigateWBSWithKeyboard', (direction: 'up' | 'down' | 'left' | 'right', startFromIssue?: string) => {
  if (startFromIssue) {
    cy.get(`[data-testid="wbs-node-${startFromIssue}"]`).focus()
  }
  
  const keyMap = {
    up: '{uparrow}',
    down: '{downarrow}',
    left: '{leftarrow}',
    right: '{rightarrow}'
  }
  
  cy.focused().type(keyMap[direction])
})

// 並び替え権限チェック
Cypress.Commands.add('verifyReorderPermissions', (role: 'editor' | 'viewer') => {
  if (role === 'editor') {
    // エディター権限では並び替え機能が有効
    cy.get('[data-testid="draggable-wbs-tree"]').should('be.visible')
    cy.get('[data-testid="drag-drop-indicator"]').should('contain', 'ドラッグ&ドロップ対応')
    cy.get('[data-testid*="drag-handle-"]').should('exist')
  } else {
    // ビューアー権限では並び替え機能が無効
    cy.get('[data-testid="viewer-reorder-restriction"]').should('be.visible')
    cy.get('[data-testid*="drag-handle-"]').should('not.exist')
    cy.get('[data-testid="drag-drop-indicator"]').should('not.exist')
  }
})

// WBSエラー状態チェック
Cypress.Commands.add('verifyWBSErrorState', (expectedErrorMessage?: string) => {
  cy.get('[data-testid="reorder-error-notification"]').should('be.visible')
  
  if (expectedErrorMessage) {
    cy.get('[data-testid="reorder-error-notification"]').should('contain', expectedErrorMessage)
  }
  
  // エラーの自動消去を確認
  cy.get('[data-testid="reorder-error-notification"]', { timeout: 6000 }).should('not.exist')
})

// リアルタイム更新通知チェック
Cypress.Commands.add('verifyRealtimeUpdateNotification', (userName: string, changeType: 'reorder' | 'hierarchy') => {
  const notificationId = changeType === 'reorder' 
    ? 'realtime-reorder-notification'
    : 'realtime-hierarchy-notification'
  
  cy.get(`[data-testid="${notificationId}"]`)
    .should('be.visible')
    .should('contain', userName)
  
  cy.get('[data-testid="realtime-update-indicator"]')
    .should('be.visible')
    .should('contain', 'リアルタイム更新')
})

// WBSツリー状態のスナップショット保存
Cypress.Commands.add('captureWBSTreeSnapshot', (snapshotName: string) => {
  cy.get('[data-testid="wbs-tree-table"] tbody tr').then(($rows) => {
    const snapshot: any[] = []
    
    $rows.each((index, row) => {
      const $row = Cypress.$(row)
      const issueId = $row.find('[data-testid*="wbs-node-"]').attr('data-testid')?.replace('wbs-node-', '')
      const wbsNumber = $row.find('[data-testid*="wbs-number-"]').text()
      const title = $row.find('[data-testid*="issue-title-"]').text()
      const isVisible = $row.is(':visible')
      
      snapshot.push({
        index,
        issueId,
        wbsNumber,
        title,
        isVisible
      })
    })
    
    // スナップショットをcypress aliasとして保存
    cy.wrap(snapshot).as(snapshotName)
  })
})

// WBSツリー状態をスナップショットと比較
Cypress.Commands.add('compareWBSTreeWithSnapshot', (snapshotName: string) => {
  cy.get(`@${snapshotName}`).then((originalSnapshot: any) => {
    cy.captureWBSTreeSnapshot('currentState')
    
    cy.get('@currentState').then((currentSnapshot: any) => {
      // スナップショット比較ロジック
      const originalIds = originalSnapshot.map((item: any) => item.issueId)
      const currentIds = currentSnapshot.map((item: any) => item.issueId)
      
      // 同じ要素数であることを確認
      expect(originalIds.length).to.equal(currentIds.length)
      
      // 順序変更の検出
      const hasReordering = !originalIds.every((id: string, index: number) => id === currentIds[index])
      
      if (hasReordering) {
        cy.log('WBS Tree order has changed')
        cy.log('Original order:', originalIds.join(', '))
        cy.log('Current order:', currentIds.join(', '))
      }
    })
  })
})

// Helper function: WBSツリーのデータ属性を統一的に生成
const getWBSTestId = (prefix: string, issueId: string): string => {
  return `${prefix}-${issueId}`
}

// Helper function: ドラッグ&ドロップのブラウザー互換性をチェック
const checkDragDropSupport = (): void => {
  cy.window().then((win) => {
    if (!('DataTransfer' in win)) {
      throw new Error('Browser does not support HTML5 Drag and Drop API')
    }
  })
}

// Helper function: WebSocket接続状態をチェック
const ensureWebSocketConnection = (): void => {
  cy.window().then((win) => {
    // WebSocket接続が確立されていることを確認
    if (!(win as any).webSocketManager || !(win as any).webSocketManager.getIsConnected()) {
      cy.log('WebSocket connection is not established, mocking...')
      // WebSocket関連の処理をモック
    }
  })
}

// Global hooks for WBS testing
beforeEach(() => {
  // WBSテスト用の共通セットアップ
  ensureWebSocketConnection()
  checkDragDropSupport()
})

export {}