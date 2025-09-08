# Frontend E2E Testing with Cypress

## 概要

このディレクトリにはCypressを使用したフロントエンドのE2Eテストが含まれています。プロジェクト管理機能とIssue機能の包括的なテストスイートを提供します。

## 設定

### 必要な依存関係

```bash
npm install --save-dev cypress
```

### テスト実行

```bash
# インタラクティブモードでテストを実行
npm run test:e2e:open

# ヘッドレスモードでテストを実行
npm run test:e2e

# Cypress GUIを開く
npm run cypress:open

# すべてのテストをヘッドレスで実行
npm run cypress:run

# 特定のテストファイルを実行
npx cypress run --spec "cypress/e2e/issues.cy.ts"
npx cypress run --spec "cypress/e2e/comments.cy.ts"
npx cypress run --spec "cypress/e2e/image-upload.cy.ts"
```

## テストファイル構成

```
cypress/
├── e2e/
│   ├── project-management.cy.ts      # プロジェクト管理のE2Eテストスイート
│   ├── issues.cy.ts                  # Issue機能のE2Eテストスイート (新規)
│   ├── comments.cy.ts                # コメント機能のE2Eテストスイート (新規)
│   └── image-upload.cy.ts            # ファイルアップロード機能のE2Eテストスイート (新規)
├── fixtures/
│   ├── projects.json                 # プロジェクトテストデータ
│   ├── settings.json                 # 設定テストデータ
│   ├── issues.json                   # Issueテストデータ (新規)
│   ├── comments.json                 # コメントテストデータ (新規)
│   ├── uploads.json                  # ファイルアップロードテストデータ (新規)
│   ├── websocket-connection.json     # WebSocket接続情報 (新規)
│   └── test-image.jpg                # テスト用画像ファイル (新規)
├── support/
│   └── e2e.ts                        # カスタムコマンドと設定 (拡張済み)
└── README.md                         # このファイル
```

## テストカバレッジ

### Project Management (`project-management.cy.ts`)

1. **プロジェクト一覧画面**
   - ページの正常表示
   - 空のプロジェクトリスト処理
   - APIエラーハンドリング

2. **プロジェクト作成**
   - パスワードなしプロジェクトの作成
   - パスワード保護プロジェクトの作成
   - フォームバリデーション

3. **プロジェクト認証**
   - 正しいパスワードでの認証
   - 間違ったパスワードの処理
   - Viewer権限とEditor権限の区別

4. **プロジェクト設定**
   - プロジェクト情報の更新
   - パスワードの変更
   - プロジェクトの削除

5. **グローバル設定**
   - 休日設定の表示と更新
   - 設定のリセット

6. **バックアップ/復元**
   - プロジェクトデータのエクスポート
   - データのインポート
   - エラーハンドリング

7. **ナビゲーションとUI**
   - ページ間の遷移
   - レスポンシブデザインの確認
   - ローディング状態の表示

8. **エラーハンドリング**
   - ネットワーク障害の処理
   - セッションタイムアウト
   - ファイルアップロードのバリデーション

9. **アクセシビリティ**
   - キーボードナビゲーション
   - モーダルのフォーカス管理

### Issue Management (`issues.cy.ts`) 🆕

1. **Issue一覧ページ**
   - Issue一覧の表示（ステータス、ラベル、アサイン）
   - 空リストの処理
   - フィルタリング（ステータス、アサイン者、ラベル）
   - ソート機能（作成日、更新日、タイトル）

2. **Issue作成**
   - 通常Issue作成（タイトル、説明、ステータス、ラベル）
   - 子Issue作成（親子関係の設定）
   - フォームバリデーション（必須項目、最小文字数）

3. **Issue詳細・編集**
   - Issue詳細表示（Markdown対応）
   - Issue更新（ステータス、進捗率、各種フィールド）
   - Issue削除（確認ダイアログ）

4. **階層構造**
   - 親子関係の表示とインデント
   - ツリー構造の展開/折りたたみ

5. **権限による機能制限**
   - Editor権限（全機能利用可能）
   - Viewer権限（閲覧のみ、編集不可）

6. **WebSocketリアルタイム更新**
   - Issue更新のリアルタイム反映
   - 新着コメント通知
   - 接続エラー処理

7. **検索・高度フィルタ**
   - タイトル・説明でのテキスト検索
   - 複数ラベルでのフィルタリング

### Comment Management (`comments.cy.ts`) 🆕

1. **コメント表示**
   - 既存コメント一覧表示
   - 空状態の表示
   - Markdownレンダリング（太字、斜体、コード、リンク）

2. **コメント作成**
   - 新規コメント投稿
   - Markdownプレビュー機能
   - バリデーション（必須入力、最小文字数）

3. **コメント編集**
   - 既存コメント編集
   - 編集キャンセル機能
   - 作成者のみ編集可能制御

4. **コメント削除**
   - 確認ダイアログ付き削除
   - 削除キャンセル
   - 作成者のみ削除可能制御

5. **権限制御**
   - Editor権限（コメント投稿・編集・削除可）
   - Viewer権限（コメント投稿不可、閲覧のみ）

6. **WebSocketリアルタイム更新**
   - 新着コメントの通知と表示
   - コメント更新のリアルタイム反映
   - 接続エラー処理

7. **高度機能**
   - @mention機能（ユーザー言及）
   - 絵文字リアクション
   - コメント作成者の表示

### File Upload Management (`image-upload.cy.ts`) 🆕

1. **ファイル表示**
   - アップロード済みファイル一覧
   - ファイルタイプアイコン表示
   - ファイルサイズ・アップロード者・日時表示

2. **ファイルアップロード**
   - 単一ファイルアップロード
   - 複数ファイル同時アップロード
   - アップロード進捗表示
   - アップロードキャンセル

3. **ファイルバリデーション**
   - ファイル形式制限（画像・PDF・テキストのみ）
   - ファイルサイズ制限（最大10MB）
   - ファイル数制限（最大20ファイル）
   - ファイル整合性チェック

4. **ファイル操作**
   - ファイルダウンロード
   - ファイル削除（アップロード者のみ）
   - 画像プレビュー表示

5. **権限制御**
   - Editor権限（アップロード・削除可）
   - Viewer権限（ダウンロードのみ、アップロード不可）

6. **ドラッグ&ドロップUI**
   - ファイルドラッグ&ドロップアップロード
   - ドラッグオーバー時の視覚フィードバック

7. **ファイル検索・フィルタ**
   - ファイル名検索
   - ファイルタイプフィルタ

8. **エラーハンドリング**
   - アップロードエラー処理
   - ストレージ容量不足エラー
   - ダウンロードエラー処理

## カスタムコマンド

テストで使用可能なカスタムCypressコマンド:

### 基本コマンド
- `cy.authenticateProject(password)` - プロジェクトパスワード認証
- `cy.createTestProject(name, password?)` - テストプロジェクト作成
- `cy.cleanupTestData()` - テストデータのクリーンアップ
- `cy.mockApiResponse(method, url, response)` - API応答のモック
- `cy.waitForApi(alias)` - API呼び出し完了の待機

### Issue機能コマンド 🆕
- `cy.createTestIssue(title, description?, projectId?)` - テスト用Issue作成
- `cy.addIssueComment(body, issueId?)` - テスト用コメント追加
- `cy.uploadTestFile(filename, mimeType, size?)` - テスト用ファイルアップロード
- `cy.setUserRole(role)` - ユーザー権限設定（'editor' | 'viewer'）
- `cy.simulateWebSocketMessage(type, data)` - WebSocketメッセージシミュレート
- `cy.verifyIssueStatus(status, displayText)` - Issueステータス表示確認
- `cy.checkFileTypeValidation(filename, shouldAllow)` - ファイル形式バリデーション確認

## テスト環境設定

### 環境変数

`cypress.config.ts`で以下の環境変数を設定:

- `baseUrl`: フロントエンドのベースURL (デフォルト: http://localhost:3000)
- `backendUrl`: バックエンドAPIのURL (デフォルト: http://localhost:3001)

### テストデータ

テストで使用する固定ID:
- プロジェクトID: `test-project-123`
- IssueID: `test-issue-123`
- テストユーザー: `test-user@example.com`
- 他のユーザー: `other-user@example.com`

### データモック

テストではAPIレスポンスをモックして安定したテスト環境を提供:

- Issue API (`/api/projects/{projectId}/issues`)
- コメント API (`/api/projects/{projectId}/issues/{issueId}/comments`)
- ファイルアップロード API (`/api/projects/{projectId}/issues/{issueId}/uploads`)
- WebSocket接続 (`/ws`)
- 認証 API (`/api/auth/project/{projectId}/authenticate`)

## ベストプラクティス

1. **data-testid属性の使用**
   - 要素選択にはdata-testid属性を優先使用
   - CSSクラスやテキストベースの選択は避ける

2. **テストデータの管理**
   - 各テストで独立したテストデータを使用
   - fixtureファイルでテストデータを管理

3. **非同期操作の処理**
   - cy.wait()でAPI呼び出し完了を待機
   - 適切なタイムアウト設定

4. **エラーシナリオのテスト**
   - ネットワークエラー、バリデーションエラーなど
   - ユーザーフィードバックの確認

5. **WebSocketテスト**
   - 実際のWebSocket接続を使わずモックを使用
   - リアルタイム更新のシミュレート

6. **ファイルアップロードテスト**
   - テスト用のモックファイルデータを使用
   - バリデーションエラーケースの網羅的テスト

## 統合テスト戦略

このE2Eテストスイートは以下の統合テスト戦略に従います:

1. **Critical Path Testing**: 主要なユーザージャーニーをカバー
2. **Error Path Testing**: エラー処理とユーザーフィードバック
3. **Permission Testing**: 権限による機能制限の確認
4. **Data Flow Testing**: データの一貫性とライフサイクル
5. **UI/UX Testing**: レスポンシブデザインとアクセシビリティ
6. **Real-time Testing**: WebSocketによるリアルタイム機能 🆕
7. **File Handling Testing**: ファイルアップロード・ダウンロード機能 🆕

## 実行結果

テストは以下の条件で実行されます:

- **Timeout**: 各操作10秒、ページロード30秒
- **Retry**: 本番実行時は2回リトライ
- **Screenshot**: 失敗時に自動撮影
- **Video**: 無効（必要に応じて有効化）

テスト結果は`cypress/screenshots/`と`cypress/videos/`に保存されます。

## CI/CD統合

GitHub Actions等でのCI/CD統合例:

```yaml
- name: Run E2E Tests
  run: |
    npm run build
    npm run start:test &
    sleep 10
    npx cypress run --record --key ${{ secrets.CYPRESS_RECORD_KEY }}
  env:
    CYPRESS_baseUrl: http://localhost:3000
    CYPRESS_backendUrl: http://localhost:3001
```

## トラブルシューティング

### よくある問題と解決策

1. **Cypress実行ファイルが見つからない**
   ```bash
   npx cypress install
   ```

2. **テストがタイムアウトする**
   - cypress.config.tsのタイムアウト設定を確認
   - アプリケーションサーバーが起動しているか確認

3. **WebSocketテストが失敗する**
   - WebSocket接続がモックされているか確認
   - `cypress/fixtures/websocket-connection.json`が存在するか確認

4. **ファイルアップロードテストが失敗する**
   - ブラウザのファイルアップロード設定を確認
   - テスト用フィクスチャファイルが存在するか確認

5. **カスタムコマンドが認識されない**
   - `cypress/support/e2e.ts`が正しく読み込まれているか確認
   - TypeScript型定義が正しく設定されているか確認

## 成果物 - M4マイルストーン

このIssue機能E2Eテストスイートは**M4マイルストーンの最終成果物**として、以下を実現します:

✅ **Issue作成・編集・削除のE2Eテスト**
✅ **Issue一覧・詳細画面の表示テスト**
✅ **コメント投稿・編集・削除テスト**
✅ **画像アップロード・削除テスト**
✅ **権限による機能制限テスト**
✅ **エラーハンドリングテスト**
✅ **WebSocket通知テスト**

このテストスイートにより、Issue機能の品質と信頼性が保証され、リグレッション防止とともに継続的なデリバリーが可能になります。