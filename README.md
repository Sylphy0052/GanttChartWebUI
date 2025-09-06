# ガントチャート WebUI (PoC)

Issue管理とWBS/ガントチャート機能を統合したWebアプリケーション。
Backlog風のタスク管理をしつつ、WBSやガントチャートの閲覧・作成・修正が可能。

## 技術スタック

- **Frontend**: Next.js 14, React 18, TypeScript, Zustand, React Query, Tailwind CSS
- **Backend**: NestJS, Prisma ORM
- **Database**: PostgreSQL 15
- **ガント実装**: 自作SVGベース（D3.jsスケール利用）

## ディレクトリ構造

```
.
├── apps/
│   ├── api/        # NestJS バックエンド
│   └── web/        # Next.js フロントエンド
├── packages/
│   └── shared/     # 共通型定義（将来拡張）
├── prisma/         # Prismaスキーマ・マイグレーション
├── scripts/        # シードスクリプト
└── infra/
    └── docker/     # Docker Compose設定
```

## セットアップ手順

### 前提条件

- Docker & Docker Compose
- Node.js 20.x（ローカル開発時のみ）

### Docker環境での実行（推奨）

#### 開発環境の起動

```bash
# 開発環境を起動（初回はビルドも実行）
./scripts/docker-dev.sh start

# 開発環境を停止
./scripts/docker-dev.sh stop

# 開発環境を再起動
./scripts/docker-dev.sh restart

# ログを確認
./scripts/docker-dev.sh logs

# サービス状況を確認
./scripts/docker-dev.sh status
```

#### 本番環境の起動

```bash
# 本番環境をデプロイ（ビルド + 起動）
./scripts/docker-prod.sh deploy

# 本番環境を起動
./scripts/docker-prod.sh start

# 本番環境を停止
./scripts/docker-prod.sh stop

# ヘルスチェック
./scripts/docker-prod.sh health
```

#### データベース操作

```bash
# マイグレーション実行
./scripts/docker-dev.sh migrate

# シードデータ投入
./scripts/docker-dev.sh seed

# PostgreSQLに接続
./scripts/docker-dev.sh db

# APIコンテナのシェルを開く
./scripts/docker-dev.sh shell
```

#### バックアップ（本番環境）

```bash
# データベースバックアップ
./scripts/docker-prod.sh backup

# データベースリストア
./scripts/docker-prod.sh restore backup_20250905_120000.sql
```

アクセス先:

- Web: <http://localhost:3000>
- API: <http://localhost:3001>
- API仕様書: <http://localhost:3001/api>

### ローカル環境での実行（Docker不使用）

#### 1. PostgreSQLの準備

PostgreSQL 15をローカルにインストールし、データベースを作成：

```bash
createdb gantt_chart_dev
```

#### 2. 依存関係のインストール

```bash
npm install
```

#### 3. 環境変数の設定

```bash
# APIの環境変数
cp apps/api/.env.example apps/api/.env

# Webの環境変数
cp apps/web/.env.example apps/web/.env.local
```

`.env`ファイルを編集してデータベース接続情報を設定。

#### 4. データベースのマイグレーション

```bash
cd apps/api
npx prisma migrate dev
```

#### 5. シードデータの投入（1,000件のダミーデータ）

```bash
npm run seed
```

#### 6. アプリケーションの起動

```bash
# プロジェクトルートで
npm run dev
```

## 主要機能（PoC版）

- **Issue管理**: CRUD操作、担当者・ステータス・工数管理
- **WBS**: 親子階層表示、ドラッグ&ドロップでの並び替え
- **ガントチャート**: バー編集（移動/伸縮）、FS依存関係の追加/削除
- **進捗管理**: パーセンテージ入力、親タスクへの自動集計
- **Undo/Redo**: Ctrl+Z/Ctrl+Y での操作取り消し/やり直し
- **カレンダー**: 平日稼働設定（1日8時間固定）
- **監査ログ**: 主要操作の履歴記録

## 開発コマンド

### Docker環境での開発

```bash
# 開発環境を起動
./scripts/docker-dev.sh start

# コンテナ内でコマンド実行
docker compose -f docker-compose.dev.yml exec api npm run test
docker compose -f docker-compose.dev.yml exec web npm run build

# 全サービスのログを確認
./scripts/docker-dev.sh logs

# 特定サービスのログを確認
docker logs gantt-api-dev -f
docker logs gantt-web-dev -f

# クリーンアップ（全コンテナとボリュームを削除）
./scripts/docker-dev.sh clean
```

### ローカル環境での開発

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# テスト
npm run test

# 型チェック
npm run type-check

# Lint
npm run lint
```

## CI/CD & E2E Testing

### GitHub Actions 自動テスト

このプロジェクトでは、GitHub ActionsによるCI/CDパイプラインが設定されており、Pull RequestやPushの際に自動的にE2Eテストが実行されます。

#### 自動実行されるテスト

- **E2E Tests**: Playwright使用、Chromiumで12テスト実行
- **Environment**: Ubuntu-latest + Node.js 22.x + 自動browser dependencies
- **Success Criteria**: 全テスト通過でmerge許可

#### テスト結果の確認

1. **Pull Request**: 自動でテスト結果がPRコメントに投稿
2. **GitHub Actions**: Actions タブで詳細ログ確認可能
3. **Artifacts**: 失敗時のスクリーンショット・動画保存

### ローカルE2E テスト実行

#### 前提条件

```bash
# Playwright browser dependencies (開発環境)
npx playwright install --with-deps
```

#### テスト実行コマンド

```bash
# 全E2Eテスト実行
npm run e2e

# UIモードでテスト実行 (デバッグ用)
npm run e2e:ui

# 特定ブラウザでのみ実行
npx playwright test --project=chromium

# クリティカルテストのみ実行
npm run e2e:critical
```

#### E2Eテスト設定

- **Test Directory**: `apps/web/e2e/`
- **Config**: `apps/web/playwright.config.ts`
- **Base URL**: 
  - Local: `http://localhost:3001` 
  - CI: `http://localhost:3000`
- **Browsers**: Chromium (primary), Firefox, Safari (local only)

### Development Workflow

#### Pull Request フロー

1. Feature branchでの開発
2. Pull Request作成
3. **自動E2Eテスト実行** (GitHub Actions)
4. テスト成功 → Merge可能
5. テスト失敗 → 修正が必要

#### ローカル開発フロー

```bash
# 開発サーバー起動
npm run dev

# E2Eテスト実行で品質確認
npm run e2e

# 修正後、再テスト
npm run e2e:critical  # 重要機能のみ高速確認
```

### テスト対象機能

#### Core E2E Scenarios

1. **Application Loading**: アプリケーション基本読み込み
2. **Issue Management**: Issue CRUD操作
3. **WBS Operations**: 階層構造・並び替え機能
4. **Gantt Operations**: ガントチャート表示・編集機能
5. **Navigation**: ページ間遷移・メニュー操作

#### 成功率目標

- **Production Target**: 100% (12/12 tests)
- **Current Status**: Phase 6.2.6で91.7% → 100%達成済み

### Troubleshooting E2E Tests

#### ローカル環境での問題

```bash
# Browser dependencies不足の場合
npx playwright install --with-deps

# Port競合の場合
pkill -f "node.*3001"  # 開発サーバー停止
npm run dev            # 再起動

# Cache問題の場合
rm -rf apps/web/.next
rm -rf apps/web/playwright-report
npm run build
```

#### CI環境での問題

- **Test失敗**: Actions logs確認、スクリーンショット・動画をArtifactsからダウンロード
- **Timeout**: CI環境は自動的にretry (最大2回)
- **Manual Re-run**: GitHubのActions画面から手動再実行可能

#### 環境差異の確認

```bash
# ローカル設定確認
cat apps/web/playwright.config.ts

# CI環境用設定確認
cat .github/workflows/e2e-tests.yml
```

## トラブルシューティング

### Docker関連

#### コンテナが起動しない場合

```bash
# イメージを再ビルド
docker compose -f docker-compose.dev.yml build --no-cache

# ボリュームも含めて全削除して再起動
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh start
```

#### ポートが使用中の場合

```bash
# 使用中のポートを確認
lsof -i :3000
lsof -i :3001
lsof -i :5432

# プロセスを停止してから再起動
./scripts/docker-dev.sh stop
./scripts/docker-dev.sh start
```

### データベース関連

#### マイグレーションエラーの場合

```bash
# Prismaクライアントを再生成
docker compose -f docker-compose.dev.yml exec api npx prisma generate

# マイグレーションをリセット
docker compose -f docker-compose.dev.yml exec api npx prisma migrate reset
```

## パフォーマンス目標

- 1,000 Issueでのガント初回描画: < 1.5秒
- ドラッグ操作の応答: < 100ms
- ズーム切替: < 150ms
