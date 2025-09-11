# E2E Test Guide

## Alpine Linux制約の回避について

このプロジェクトでは、Alpine Linux環境でのCypress 15.1.0の実行制約（`posix_fallocate64: symbol not found`エラー）を回避するため、Ubuntu LinuxベースのCypress環境を使用したE2Eテスト実行環境を構築しています。

## テスト実行方法

### 🐳 Docker環境での実行（推奨）

Alpine Linux制約を完全に回避した統合テスト環境です：

#### 全てのE2Eテストを実行
```bash
# プロジェクトルートで実行
./scripts/run-e2e-tests.sh

# または
./scripts/run-e2e-tests.sh all
```

#### 特定のテストファイルを実行
```bash
# 単一のテストファイル
./scripts/run-e2e-tests.sh spec "cypress/e2e/issues.cy.ts"

# パターンマッチングで複数ファイル
./scripts/run-e2e-tests.sh spec "cypress/e2e/wbs-*.cy.ts"

# ガントチャート関連テスト
./scripts/run-e2e-tests.sh spec "cypress/e2e/gantt-*.cy.ts"
```

#### テストレポートのみ生成
```bash
./scripts/run-e2e-tests.sh reports
```

#### テスト環境のクリーンアップ
```bash
./scripts/run-e2e-tests.sh cleanup
```

#### サービス状態の確認
```bash
# Docker サービス状態確認
./scripts/run-e2e-tests.sh status

# サービスログ確認
./scripts/run-e2e-tests.sh logs
./scripts/run-e2e-tests.sh logs backend-test
```

### 📦 npm scriptsでの実行

frontendディレクトリから実行可能：

```bash
cd frontend

# Docker環境で全テスト実行
npm run test:e2e:docker

# 特定テスト実行
npm run test:e2e:docker:spec "cypress/e2e/issues.cy.ts"

# レポート生成のみ
npm run test:e2e:docker:reports

# 環境クリーンアップ
npm run test:e2e:docker:cleanup
```

### 🖥️ ローカル開発環境での実行

ローカル開発時のデバッグ用（Alpine制約の影響を受ける場合があります）：

```bash
cd frontend

# Cypress UIでの開発・デバッグ
npm run cypress:open

# ヘッドレス実行
npm run cypress:run

# Docker設定でローカル実行（非推奨）
npm run cypress:run:docker
```

## テスト環境構成

### Docker Compose Services

**docker-compose.test.yml** で定義される専用テスト環境：

- **postgres-test**: PostgreSQL 15 (テスト専用DB)
- **backend-test**: NestJS APIサーバー (ポート 3001)
- **frontend-test**: Next.js アプリサーバー (ポート 3000)
- **cypress-runner**: Ubuntu-based Cypress実行環境
- **test-reporter**: JUnitレポート生成

### ネットワーク設定

- **ネットワーク**: `gantt-test-network`
- **サービス間通信**: Docker内部DNS
- **ポートエクスポート**: ローカルホストからアクセス可能

### 環境変数

テスト実行時に使用される主要な環境変数：

```bash
# データベース
POSTGRES_USER=gantt_user
POSTGRES_PASSWORD=gantt_pass
POSTGRES_DB=gantt_db_test
DATABASE_URL=postgresql://gantt_user:gantt_pass@postgres-test:5432/gantt_db_test

# アプリケーション
NODE_ENV=test
BACKEND_PORT=3001
FRONTEND_PORT=3000

# Cypress設定
CYPRESS_baseUrl=http://frontend-test:3000
CYPRESS_backendUrl=http://backend-test:3001
```

## テスト設定ファイル

### cypress.config.docker.ts

Docker環境専用のCypress設定：

- **baseUrl**: `http://frontend-test:3000`
- **video**: テスト実行の録画有効
- **reporter**: JUnit XML形式
- **retries**: 3回リトライ
- **timeout**: 長めのタイムアウト設定

### cypress.config.ts（既存）

ローカル開発環境用：

- **baseUrl**: `http://localhost:3000`
- **video**: 無効
- **開発時デバッグ**: 最適化された設定

## テスト結果とアーティファクト

### 生成されるファイル

実行後、以下のアーティファクトが生成されます：

```
test-reports/
├── test-report.html        # HTML形式の統合レポート
└── test-results-[hash].xml # JUnit XML レポート

cypress/
├── videos/                 # テスト実行動画
├── screenshots/            # 失敗時スクリーンショット
└── results/               # XML結果ファイル
```

### Docker Volumesでの永続化

```bash
# 結果ファイルの確認
docker volume ls | grep cypress

# ボリュームの中身を確認
docker run --rm -v gantt_cypress_videos:/videos alpine ls -la /videos
docker run --rm -v gantt_cypress_screenshots:/screenshots alpine ls -la /screenshots
docker run --rm -v gantt_cypress_reports:/reports alpine ls -la /reports
```

## GitHub Actions CI/CD

### 自動実行設定

`.github/workflows/e2e-tests.yml` で以下の場合に自動実行：

- **Push**: main, developブランチ
- **Pull Request**: main, developブランチ向け
- **Manual Dispatch**: 特定テスト指定可能

### CI実行環境

- **Runner**: ubuntu-latest (Alpine制約回避)
- **Services**: PostgreSQL 15
- **Node.js**: v20
- **Browser**: Chrome headless

### アーティファクト保存

CI実行後、以下がダウンロード可能：

- `cypress-screenshots` (7日間保存)
- `cypress-videos` (7日間保存)
- `test-results` (14日間保存)
- `test-report` (14日間保存)

## トラブルシューティング

### よくある問題

#### 1. サービスが起動しない

```bash
# ログ確認
./scripts/run-e2e-tests.sh logs backend-test
./scripts/run-e2e-tests.sh logs frontend-test

# Docker状態確認
docker compose -f infra/docker-compose.test.yml ps
```

#### 2. テストが失敗する

```bash
# スクリーンショットの確認
docker run --rm -v gantt_cypress_screenshots:/screenshots alpine ls -la /screenshots

# 特定テストの単体実行
./scripts/run-e2e-tests.sh spec "cypress/e2e/failing-test.cy.ts"
```

#### 3. 環境のクリーンアップ

```bash
# 完全クリーンアップ
./scripts/run-e2e-tests.sh cleanup

# Dockerボリュームの削除
docker volume prune -f

# 不要イメージの削除
docker image prune -f
```

### デバッグモード

詳細ログが必要な場合：

```bash
# DEBUG有効で実行
DEBUG=cypress:* ./scripts/run-e2e-tests.sh

# Docker Composeデバッグ
COMPOSE_LOG_LEVEL=DEBUG docker compose -f infra/docker-compose.test.yml up -d
```

## テストファイル一覧

現在実装されているE2Eテストファイル：

- `comments.cy.ts` - コメント機能テスト
- `dependency-management.cy.ts` - 依存関係管理テスト
- `gantt-chart.cy.ts` - ガントチャート表示テスト
- `gantt-functionality.cy.ts` - ガント機能テスト
- `gantt-permissions-and-errors.cy.ts` - 権限・エラーハンドリング
- `image-upload.cy.ts` - 画像アップロード機能
- `issue-reorder.cy.ts` - Issue並び替え
- `issues.cy.ts` - Issue CRUD操作
- `project-management.cy.ts` - プロジェクト管理
- `wbs-tree.cy.ts` - WBS階層表示

## パフォーマンスとベストプラクティス

### 実行時間の最適化

1. **並列実行**: 将来的にはCypress Dashboardでの並列実行も検討
2. **選択実行**: 関連テストのみの実行でフィードバック高速化
3. **キャッシュ活用**: Docker Layer Cache、npm Cache利用

### テスト安定性

1. **リトライ機能**: Docker環境では3回自動リトライ
2. **適切な待機**: `cy.wait()`より`cy.get().should()`優先
3. **データ分離**: 各テストでクリーンな状態を保証

Alpine Linux制約を回避したこのE2Eテスト環境により、安定したテスト実行が可能になります。