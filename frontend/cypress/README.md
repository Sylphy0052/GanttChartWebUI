# Frontend E2E Testing with Cypress

## 概要

このディレクトリにはCypressを使用したフロントエンドのE2Eテストが含まれています。

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
```

## テストファイル構成

```
cypress/
├── e2e/
│   └── project-management.cy.ts      # メインのE2Eテストスイート
├── fixtures/
│   ├── projects.json                 # プロジェクトテストデータ
│   └── settings.json                 # 設定テストデータ
├── support/
│   └── e2e.ts                        # カスタムコマンドと設定
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

## カスタムコマンド

テストで使用可能なカスタムCypressコマンド:

- `cy.authenticateProject(password)` - プロジェクトパスワード認証
- `cy.createTestProject(name, password?)` - テストプロジェクト作成
- `cy.cleanupTestData()` - テストデータのクリーンアップ
- `cy.mockApiResponse(method, url, response)` - API応答のモック
- `cy.waitForApi(alias)` - API呼び出し完了の待機

## テスト環境設定

### 環境変数

`cypress.config.ts`で以下の環境変数を設定:

- `baseUrl`: フロントエンドのベースURL (デフォルト: http://localhost:3000)
- `backendUrl`: バックエンドAPIのURL (デフォルト: http://localhost:3001)

### データモック

テストではAPIレスポンスをモックして安定したテスト環境を提供しています。実際のバックエンドサービスに依存せずにフロントエンド機能をテストできます。

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

## 統合テスト戦略

このE2Eテストスイートは以下の統合テスト戦略に従います:

1. **Critical Path Testing**: 主要なユーザージャーニーをカバー
2. **Error Path Testing**: エラー処理とユーザーフィードバック
3. **Permission Testing**: 権限による機能制限の確認
4. **Data Flow Testing**: データの一貫性とライフサイクル
5. **UI/UX Testing**: レスポンシブデザインとアクセシビリティ

## 実行結果

テストは以下の条件で実行されます:

- **Timeout**: 各操作10秒、ページロード30秒
- **Retry**: 本番実行時は2回リトライ
- **Screenshot**: 失敗時に自動撮影
- **Video**: 無効（必要に応じて有効化）

テスト結果は`cypress/screenshots/`と`cypress/videos/`に保存されます。