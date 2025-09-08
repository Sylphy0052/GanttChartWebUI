# E2E テストスイート

このディレクトリには、GanttChart WebUI Backend APIの包括的なE2Eテストが含まれています。

## 📋 テスト構成

### テストファイル一覧

| ファイル | 対象機能 | テスト数 | カバレッジ |
|---------|----------|---------|-----------|
| `auth.e2e-spec.ts` | 認証・権限管理 | 25+ | Basic認証、権限制御、プロジェクトパスワード認証 |
| `projects.e2e-spec.ts` | プロジェクト管理 | 35+ | CRUD操作、バリデーション、論理削除 |
| `backup.e2e-spec.ts` | バックアップ機能 | 30+ | エクスポート・インポート、ファイル処理 |
| `settings.e2e-spec.ts` | 設定管理 | 20+ | 休日設定、権限制御、バリデーション |
| `health.e2e-spec.ts` | ヘルスチェック | 15+ | 稼働状態、データベース接続、セキュリティ |
| `test-suite.e2e-spec.ts` | 統合テスト | 10+ | カバレッジ分析、パフォーマンス、セキュリティ |

### サポートファイル

- `jest-e2e.json` - E2Eテスト用Jest設定
- `test-setup.ts` - テストヘルパーとセットアップ
- `README.md` - このファイル

## 🚀 実行方法

### 前提条件

```bash
# 依存関係のインストール
npm install

# データベースのセットアップ
npx prisma generate
npx prisma db push
```

### 基本実行

```bash
# 全E2Eテスト実行
npm run test:e2e

# 特定のテストファイル実行
npm run test:e2e -- auth.e2e-spec.ts
npm run test:e2e -- projects.e2e-spec.ts
npm run test:e2e -- backup.e2e-spec.ts

# カバレッジ付きで実行
npm run test:e2e -- --coverage

# 監視モード（開発時）
npm run test:e2e -- --watch
```

### 詳細実行オプション

```bash
# 並列実行の制御
npm run test:e2e -- --maxWorkers=4

# 特定のテストパターンを実行
npm run test:e2e -- --testNamePattern="認証"

# 失敗時のみ詳細表示
npm run test:e2e -- --verbose=false

# タイムアウト設定（デフォルト30秒）
npm run test:e2e -- --testTimeout=60000
```

## 🏗️ テスト構成要素

### 認証テスト (`auth.e2e-spec.ts`)
- ✅ Basic認証（正常・異常ケース）
- ✅ 権限管理（Viewer/Editor）
- ✅ プロジェクトパスワード認証
- ✅ 認証バリデーション
- ✅ セキュリティ制御

### プロジェクト管理テスト (`projects.e2e-spec.ts`)
- ✅ プロジェクトCRUD操作
- ✅ データバリデーション
- ✅ 論理削除機能
- ✅ パスワード保護機能
- ✅ パフォーマンステスト

### バックアップテスト (`backup.e2e-spec.ts`)
- ✅ プロジェクトエクスポート
- ✅ プロジェクトインポート
- ✅ ファイルアップロード処理
- ✅ ZIPファイル検証
- ✅ セキュリティ制御

### 設定管理テスト (`settings.e2e-spec.ts`)
- ✅ 休日設定の取得・更新
- ✅ 権限制御の検証
- ✅ バリデーション処理
- ✅ 同時アクセス制御

### ヘルスチェックテスト (`health.e2e-spec.ts`)
- ✅ アプリケーション状態確認
- ✅ データベース接続テスト
- ✅ 認証不要アクセス
- ✅ パフォーマンス要件

## 📊 カバレッジ分析

### API エンドポイントカバレッジ
- **総エンドポイント**: 12
- **テスト済み**: 12 (100%)
- **HTTPメソッド**: GET(4), POST(6), PUT(1), PATCH(1), DELETE(1)

### 認証シナリオ
- **認証不要**: 1エンドポイント
- **Basic認証**: 11エンドポイント  
- **プロジェクトパスワード**: 2エンドポイント

### エラーケーステスト
- **認証エラー**: 12パターン
- **権限エラー**: 8パターン
- **バリデーションエラー**: 25パターン
- **404エラー**: 6パターン
- **サーバーエラー**: 3パターン

## ⚡ パフォーマンス基準

### レスポンス時間要件
- **ヘルスチェック**: < 500ms
- **プロジェクト一覧**: < 2000ms
- **プロジェクト詳細**: < 1000ms
- **設定取得**: < 1000ms

### 並行処理
- **同時接続**: 50リクエスト対応
- **平均応答時間**: < 3000ms
- **メモリリーク**: なし

## 🔒 セキュリティテスト

### 実装済みセキュリティテスト
- ✅ 入力サニタイゼーション（XSS防御）
- ✅ SQLインジェクション防御
- ✅ パストラバーサル防御
- ✅ 権限昇格攻撃防御
- ✅ レート制限テスト
- ✅ センシティブ情報漏洩防御

## 🐛 フレーク対策

### 安定化メカニズム
- データベーストランザクション分離
- 非同期処理の完了待機
- テストデータの厳密な分離
- タイムアウト設定の最適化
- モック・スタブの活用

### 監視項目
- テスト実行時間の追跡
- テスト成功率の監視
- リソース使用量の確認
- エラーパターンの分析

## 🔍 不足領域の特定

### High Priority (緊急)
- [ ] WebSocketリアルタイム通信テスト
- [ ] 大容量データのパフォーマンステスト  
- [ ] エラー復旧シナリオのテスト

### Medium Priority (重要)
- [ ] ファイルアップロードのエッジケーステスト
- [ ] データベースロック競合のテスト
- [ ] 長時間実行プロセスのテスト

### Low Priority (将来)
- [ ] i18n対応テスト
- [ ] ブラウザキャッシュ制御テスト
- [ ] レスポンス圧縮テスト

## 📈 継続的改善

### 新しいテストの追加手順
1. 対応するspecファイルを特定
2. テストケースを追加
3. `test-setup.ts`にヘルパー関数を追加（必要に応じて）
4. 実行・検証
5. `test-suite.e2e-spec.ts`のカバレッジレポートを更新

### ベストプラクティス
- テストは独立して実行可能にする
- テストデータのクリーンアップを確実に行う
- エラーメッセージは分かりやすくする
- パフォーマンステストは定量的な基準を設ける
- セキュリティテストは最新の脅威に対応する

## 🚨 トラブルシューティング

### よくある問題

#### データベース接続エラー
```bash
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**解決方法**: テスト用SQLiteデータベースの設定を確認
```bash
export DATABASE_URL="file:./test.db"
```

#### ポート競合エラー
```bash
Error: listen EADDRINUSE :::3001
```
**解決方法**: テスト用ポートを変更
```bash
export PORT=3002
```

#### タイムアウトエラー
```bash
Timeout - Async callback was not invoked within timeout
```
**解決方法**: タイムアウト時間を調整
```bash
npm run test:e2e -- --testTimeout=60000
```

#### メモリ不足
```bash
JavaScript heap out of memory
```
**解決方法**: Node.jsメモリを増加
```bash
NODE_OPTIONS="--max_old_space_size=4096" npm run test:e2e
```

### デバッグモード実行
```bash
# 詳細ログ出力
DEBUG=* npm run test:e2e

# 特定のテストのみデバッグ
npm run test:e2e -- --testNamePattern="should create project" --verbose
```

## 📝 レポート生成

### カバレッジレポート
```bash
npm run test:e2e -- --coverage
open coverage-e2e/lcov-report/index.html
```

### JUnit XMLレポート
```bash
npm run test:e2e -- --reporters=jest-junit
```

### HTMLレポート
```bash
npm run test:e2e -- --reporters=jest-html-reporter
```

---

**注意**: このテストスイートは継続的に更新されます。新機能の追加や既存機能の変更に伴い、対応するテストケースも更新してください。