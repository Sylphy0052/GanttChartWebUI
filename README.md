# 📊 GanttChart WebUI

[![Node.js Version](https://img.shields.io/badge/node-20%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-20.10%2B-blue.svg)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-org/GanttChartWebUI/releases)

GanttChart WebUIは、プロジェクトの課題(Issue)管理とガントチャート表示を行うモダンなWebアプリケーションです。階層構造を持つ課題管理、リアルタイム通知、高度な権限制御を提供します。

![GanttChart WebUI Screenshot](docs/screenshot.png)

## 🚀 Quick Start

最短30秒でアプリケーションを起動できます：

```bash
# リポジトリクローン
git clone <repository-url>
cd GanttChartWebUI

# 環境変数設定
cp .env.example .env
# 必要に応じて .env ファイルを編集

# Docker環境で一括起動
cd infra
docker compose up -d

# アクセス確認
curl http://localhost:8080/health
```

**アクセスURL**: http://localhost:8080

## ✨ 主要機能

### 📋 プロジェクト管理
- **プロジェクト作成・編集・削除**: 直感的なUI操作
- **パスワード認証**: プロジェクトレベルでのアクセス制御
- **バックアップ・エクスポート**: JSON形式でのデータ出力

### 🎯 Issue管理
- **階層構造**: 親子関係を持つタスク管理
- **進捗追跡**: リアルタイムでの進捗状況更新
- **依存関係管理**: Finish-to-Start形式の依存設定
- **ドラッグ&ドロップ**: 直感的な順序変更

### 📊 ガントチャート
- **視覚的スケジュール表示**: プロジェクト全体の進捗可視化
- **リアルタイム更新**: WebSocketによる即座の反映
- **レスポンシブデザイン**: モバイル・タブレット対応

### 💬 コラボレーション
- **コメント機能**: Issue単位でのディスカッション
- **画像アップロード**: 資料・画面キャプチャの添付
- **リアルタイム通知**: Socket.IOによる即時通知

### 🔐 セキュリティ・権限
- **Editor/Viewer権限**: きめ細かい権限制御
- **セッション管理**: 安全な認証状態管理
- **データ保護**: bcryptによるパスワードハッシュ化

### 🔍 監視・メトリクス
- **ヘルスチェック**: アプリケーションとデータベースの状態監視
- **パフォーマンス監視**: レスポンス時間とリソース使用量
- **詳細ログ**: デバッグとトラブルシューティング用

## 🏗️ 技術スタック

### Backend
- **[NestJS](https://nestjs.com/)** v10 - Enterprise-grade Node.jsフレームワーク
- **[Prisma](https://www.prisma.io/)** v5.6 - 型安全なORM
- **[PostgreSQL](https://www.postgresql.org/)** v15 - リレーショナルデータベース
- **[Socket.IO](https://socket.io/)** v4.8 - リアルタイム通信
- **[TypeScript](https://www.typescriptlang.org/)** v5.9 - 静的型付け

### Frontend
- **[Next.js](https://nextjs.org/)** v15 - Reactベースフレームワーク
- **[React](https://react.dev/)** v19 - UIライブラリ
- **[Tailwind CSS](https://tailwindcss.com/)** v4 - ユーティリティファーストCSS
- **[Cypress](https://www.cypress.io/)** v15.1 - E2Eテストフレームワーク
- **[TypeScript](https://www.typescriptlang.org/)** v5 - 静的型付け

### Infrastructure
- **[Docker](https://www.docker.com/)** & **Docker Compose** - コンテナ化
- **[Nginx](https://nginx.org/)** - リバースプロキシ
- **[Jest](https://jestjs.io/)** - ユニットテストフレームワーク

## 🛠️ 必要環境

### Docker環境（推奨）
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **OS**: Linux/macOS/Windows + WSL2
- **メモリ**: 4GB+（推奨）

### ローカル環境
- **Node.js**: 20+
- **PostgreSQL**: 15+
- **npm**: 9+ または **yarn**: 1.22+

## 📦 セットアップ

### 🐳 Docker環境（推奨）

```bash
# 1. リポジトリクローン
git clone <repository-url>
cd GanttChartWebUI

# 2. 環境変数設定
cp .env.example .env
# 必要に応じて .env ファイルを編集

# 3. アプリケーション起動
cd infra
docker compose up -d

# 4. 起動確認
docker compose ps
curl http://localhost:8080/health
```

**アクセスポイント**:
- **メインアプリ**: http://localhost:8080 (Nginx経由)
- **Frontend直接**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Prisma Studio**: http://localhost:5555

### 💻 ローカル環境

#### 1. データベース準備

```bash
# PostgreSQL起動（Dockerの場合）
docker run --name gantt-postgres -e POSTGRES_PASSWORD=gantt_pass -e POSTGRES_DB=gantt_db -p 5432:5432 -d postgres:15-alpine
```

#### 2. Backend セットアップ

```bash
cd backend

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# DATABASE_URL="postgresql://gantt_user:gantt_pass@localhost:5432/gantt_db?schema=public"

# Prisma初期化
npm run prisma:generate
npm run prisma:migrate:deploy

# 開発サーバー起動
npm run start:dev
```

#### 3. Frontend セットアップ

```bash
cd frontend

# 依存関係インストール
npm install

# 環境変数設定
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001' > .env.local
echo 'NEXT_PUBLIC_WS_URL=http://localhost:3001' >> .env.local

# 開発サーバー起動
npm run dev
```

## 🔐 Authentication & Authorization

### 認証システム

GanttChart WebUIは **プロジェクトレベル認証** を採用しています：

```bash
# プロジェクト作成例
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Project",
    "description": "プロジェクトの説明",
    "shared_password": "secure_password_123"
  }'
```

### 権限システム

| 権限レベル | 説明 | 操作可能範囲 |
|-----------|------|-------------|
| **Viewer** | 閲覧専用 | プロジェクト・Issue・コメントの閲覧 |
| **Editor** | 編集可能 | 全ての作成・更新・削除操作 |

### 認証フロー

1. **プロジェクトアクセス**: パスワード入力
2. **権限チェック**: 操作に応じた権限確認
3. **セッション管理**: ブラウザセッションでの状態保持

## 📋 API Reference

### 🔑 認証

すべてのAPI（`/health`、`/metrics`を除く）は認証が必要です。

```bash
# 認証ヘッダー例
curl -H "Authorization: Bearer <project-password>" \
     -H "X-Editor-Mode: true" \
     http://localhost:3001/projects/1
```

### 📊 プロジェクト管理

#### プロジェクト一覧取得

```bash
GET /projects

# レスポンス例
{
  "projects": [
    {
      "id": "clx1234567890",
      "name": "Sample Project",
      "description_md": "プロジェクトの説明",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

#### プロジェクト作成

```bash
POST /projects
Content-Type: application/json

{
  "name": "New Project",
  "description_md": "新しいプロジェクト",
  "shared_password": "secure_password"
}

# レスポンス例
{
  "id": "clx1234567891",
  "name": "New Project",
  "description_md": "新しいプロジェクト",
  "created_at": "2025-01-15T11:00:00Z"
}
```

#### パスワード認証

```bash
POST /projects/auth-password
Content-Type: application/json

{
  "project_id": "clx1234567890",
  "password": "secure_password",
  "editor_mode": true
}

# レスポンス例
{
  "success": true,
  "editor_mode": true,
  "project": {
    "id": "clx1234567890",
    "name": "Sample Project"
  }
}
```

### 🎯 Issue管理

#### Issue一覧取得

```bash
GET /projects/:projectId/issues

# レスポンス例
{
  "issues": [
    {
      "id": "clx1234567892",
      "title": "要件定義",
      "description_md": "システム要件の定義作業",
      "status": "in_progress",
      "type": "Task",
      "start_date": "2025-01-15",
      "end_date": "2025-01-20",
      "progress_pct": 60,
      "parent_id": null,
      "sort_order": 1
    }
  ]
}
```

#### Issue作成

```bash
POST /projects/:projectId/issues
Content-Type: application/json

{
  "title": "新しいタスク",
  "description_md": "タスクの詳細説明",
  "start_date": "2025-01-16",
  "end_date": "2025-01-18",
  "type": "Task",
  "parent_id": "clx1234567892"
}
```

#### Issue更新

```bash
PUT /projects/:projectId/issues/:id
Content-Type: application/json

{
  "title": "更新されたタスク",
  "progress_pct": 75,
  "status": "in_progress"
}
```

#### Issue削除

```bash
DELETE /projects/:projectId/issues/:id
```

### 🔄 依存関係管理

#### 依存関係作成

```bash
POST /projects/:projectId/dependencies
Content-Type: application/json

{
  "predecessor_issue_id": "clx1234567892",
  "successor_issue_id": "clx1234567893",
  "type": "FS"
}
```

#### 依存関係一覧取得

```bash
GET /projects/:projectId/dependencies

# レスポンス例
{
  "dependencies": [
    {
      "id": "clx1234567894",
      "predecessor_issue_id": "clx1234567892",
      "successor_issue_id": "clx1234567893",
      "type": "FS"
    }
  ]
}
```

### 💬 コメント管理

#### コメント一覧取得

```bash
GET /projects/:projectId/issues/:issueId/comments

# レスポンス例
{
  "comments": [
    {
      "id": "clx1234567895",
      "body_md": "進捗について確認します",
      "author": "ユーザー名",
      "created_at": "2025-01-15T12:00:00Z"
    }
  ]
}
```

#### コメント作成

```bash
POST /projects/:projectId/issues/:issueId/comments
Content-Type: application/json

{
  "body_md": "新しいコメント",
  "author": "ユーザー名"
}
```

### 🔄 WebSocket Events

リアルタイム通知は以下のイベントで配信されます：

```javascript
// フロントエンド接続例
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001');

// Issue更新通知
socket.on('issue:updated', (data) => {
  console.log('Issue updated:', data);
});

// 新しいコメント通知
socket.on('comment:created', (data) => {
  console.log('New comment:', data);
});

// 依存関係変更通知
socket.on('dependency:created', (data) => {
  console.log('Dependency created:', data);
});

socket.on('dependency:deleted', (data) => {
  console.log('Dependency deleted:', data);
});
```

### 🏥 ヘルスチェック・監視

#### 基本ヘルスチェック

```bash
GET /health

# レスポンス例
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### 詳細ヘルスチェック

```bash
GET /health/detailed

# レスポンス例
{
  "status": "ok",
  "timestamp": "2025-01-15T12:00:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "database": {
    "status": "connected",
    "response_time_ms": 25
  },
  "system": {
    "memory": {
      "used": 234567890,
      "total": 8589934592
    },
    "cpu_usage": 15.5
  }
}
```

#### メトリクス

```bash
GET /metrics

# Prometheus形式のメトリクス
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1024
```

### 📁 画像アップロード

#### 画像アップロード

```bash
POST /projects/:projectId/issues/:issueId/upload
Content-Type: multipart/form-data

# フォームデータで画像ファイルを送信
```

#### アップロード済み画像一覧

```bash
GET /projects/:projectId/issues/:issueId/uploads

# レスポンス例
{
  "images": [
    {
      "id": "clx1234567896",
      "path": "uuid-filename.jpg",
      "created_at": "2025-01-15T13:00:00Z"
    }
  ]
}
```

### 📥 バックアップ・エクスポート

#### プロジェクトエクスポート

```bash
GET /api/backup/projects/:projectId/export

# レスポンス: JSON形式のプロジェクトデータ
```

## ⚡ Performance

### パフォーマンス目標

| 指標 | 目標値 | 説明 |
|------|-------|------|
| **初期レンダリング時間** | < 1,500ms (P95) | ページ初回表示完了 |
| **ドラッグ操作レイテンシ** | < 100ms (P95) | Issue移動時の応答性 |
| **API応答時間** | < 500ms (平均) | REST API レスポンス |
| **WebSocket遅延** | < 50ms | リアルタイム通知配信 |

### パフォーマンス最適化

- **フロントエンド**:
  - React Server Components活用
  - コード分割・遅延読み込み
  - 画像最適化（WebP対応）
  - Service Worker キャッシュ

- **バックエンド**:
  - Prismaクエリ最適化
  - データベースインデックス
  - 接続プーリング
  - レート制限による負荷制御

### パフォーマンステスト

```bash
# Cypressパフォーマンステスト実行
cd frontend
npm run test:performance

# 本番環境での負荷テスト
docker compose -f infra/docker-compose.yml exec frontend npm run test:performance:ci
```

## 🧪 Testing

### テスト戦略

本プロジェクトは **品質第一** のアプローチを採用しています：

- **ユニットテスト**: 各機能の単体テスト
- **統合テスト**: API・データベース連携テスト
- **E2Eテスト**: ユーザーシナリオ実証
- **パフォーマンステスト**: 性能要件検証
- **セキュリティテスト**: 認証・権限確認

### テスト実行

#### 🚀 Docker環境（推奨）

```bash
# Backend全テスト
docker compose -f infra/docker-compose.yml exec backend npm run test
docker compose -f infra/docker-compose.yml exec backend npm run test:e2e
docker compose -f infra/docker-compose.yml exec backend npm run test:cov

# Frontend E2Eテスト
docker compose -f infra/docker-compose.yml exec frontend npm run cypress:run

# パフォーマンステスト
docker compose -f infra/docker-compose.yml exec frontend npm run test:performance
```

#### 💻 ローカル環境

```bash
# Backend
cd backend
npm run test              # ユニットテスト
npm run test:e2e          # E2Eテスト
npm run test:cov          # カバレッジレポート

# Frontend
cd frontend
npm run cypress:open      # Cypress UI
npm run cypress:run       # ヘッドレスE2E
npm run test:performance  # パフォーマンス
```

### テストカバレッジ目標

- **バックエンド**: 80%以上
- **重要なビジネスロジック**: 90%以上
- **API エンドポイント**: 100%

## 🐳 Docker運用

### 利用可能なコマンド

#### 基本操作

```bash
# 全サービス起動
cd infra
docker compose up -d

# 特定サービス起動
docker compose up -d postgres backend

# ログ確認
docker compose logs -f
docker compose logs -f backend frontend

# サービス状態確認
docker compose ps
docker compose top
```

#### データ管理

```bash
# データベースリセット
docker compose down -v
docker compose up -d

# バックアップ
docker compose exec postgres pg_dump -U gantt_user gantt_db > backup.sql

# リストア
docker compose exec -T postgres psql -U gantt_user gantt_db < backup.sql
```

#### 開発・デバッグ

```bash
# コンテナ内部アクセス
docker compose exec backend sh
docker compose exec frontend sh

# 再ビルド
docker compose build --no-cache
docker compose up -d

# リソース使用量確認
docker compose stats
```

## 🔧 Troubleshooting

### よくある問題と解決策

#### 🚫 起動・接続問題

**問題**: `docker compose up -d` が失敗する

```bash
# 解決策
docker compose down -v
docker compose build --no-cache
docker compose up -d

# ログ確認
docker compose logs -f postgres
docker compose logs -f backend
```

**問題**: フロントエンドがAPIに接続できない

```bash
# 環境変数確認
cat frontend/.env.local

# 正しい設定
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001' > frontend/.env.local
echo 'NEXT_PUBLIC_WS_URL=http://localhost:3001' >> frontend/.env.local
```

**問題**: データベース接続エラー

```bash
# PostgreSQL状態確認
docker compose exec postgres pg_isready -U gantt_user

# 環境変数確認
docker compose exec backend printenv DATABASE_URL
```

#### 🗄️ データベース問題

**問題**: Prismaマイグレーション失敗

```bash
# 解決策
cd backend
npx prisma migrate reset
npm run prisma:migrate:deploy
npm run prisma:generate
```

**問題**: データベースの破損・不整合

```bash
# 完全リセット
docker compose down -v
docker volume prune
docker compose up -d
```

#### 🧪 テスト実行問題

**問題**: Cypress E2Eテストが失敗

```bash
# 回避策: 公式イメージ使用
docker run --rm --network infra_gantt-network \
  -v $(pwd)/frontend:/e2e -w /e2e \
  -e CYPRESS_baseUrl=http://frontend:3000 \
  cypress/included:15.1.0 cypress run
```

**問題**: テスト実行時のメモリ不足

```bash
# Docker メモリ割り当て増加
# Docker Desktop > Settings > Resources > Memory: 4GB+
```

#### 🔐 認証・権限問題

**問題**: API認証エラー

```bash
# 正しい認証ヘッダー例
curl -H "Authorization: Bearer correct_password" \
     -H "X-Editor-Mode: true" \
     http://localhost:3001/projects/clx1234567890
```

**問題**: Editor権限が効かない

```bash
# フロントエンドセッション確認
# ブラウザの開発者ツール > Application > Local Storage
# editor_mode: "true" が設定されているか確認
```

#### ⚡ パフォーマンス問題

**問題**: API レスポンスが遅い

```bash
# データベースインデックス確認
docker compose exec postgres psql -U gantt_user -d gantt_db -c "\d+ issues"

# アプリケーションログ確認
docker compose logs backend | grep -E "(slow|timeout|error)"
```

**問題**: フロントエンドの描画が重い

```bash
# パフォーマンス測定
cd frontend
npm run test:performance

# ビルド最適化確認
npm run build
```

### デバッグ用コマンド

```bash
# システム全体の状態確認
curl http://localhost:8080/health
curl http://localhost:3001/health

# 詳細ヘルスチェック
curl http://localhost:3001/health/detailed

# ネットワーク接続確認
docker network ls
docker network inspect infra_gantt-network

# ポート使用状況確認
netstat -tulpn | grep :3001
netstat -tulpn | grep :8080

# Docker リソース確認
docker system df
docker stats --no-stream
```

### ログ収集

```bash
# 全ログ保存
docker compose logs --no-color > logs/full.log

# 特定サービスログ
docker compose logs backend > logs/backend.log
docker compose logs frontend > logs/frontend.log

# エラーログのみ
docker compose logs 2>&1 | grep -E "(error|Error|ERROR)"

# WebSocketログ
docker compose logs backend | grep -i websocket
```

## 🏗️ 開発

### 開発環境構築

```bash
# 開発環境セットアップ
git clone <repository-url>
cd GanttChartWebUI

# 開発ブランチ作成
git checkout -b feature/new-feature

# Docker開発環境起動
cd infra
docker compose up -d

# ホットリロードで開発
# backend/src/ と frontend/src/ の変更が即座に反映
```

### コード品質

#### Lint・フォーマット

```bash
# Backend
cd backend
npm run lint           # ESLint実行
npm run format         # Prettier実行

# Frontend
cd frontend
npm run lint           # ESLint実行
```

#### 型チェック

```bash
# TypeScript型チェック（両プロジェクトともstrict mode）
npm run build          # ビルド時に型チェック実行
```

### 新機能開発フロー

1. **設計・計画**
   - Issue作成、技術仕様検討
   - データベーススキーマ変更検討

2. **Backend実装**
   ```bash
   cd backend
   # Prismaスキーマ更新
   npm run prisma:migrate:dev
   # API実装
   npm run test           # ユニットテスト
   ```

3. **Frontend実装**
   ```bash
   cd frontend
   # UI実装
   npm run cypress:open   # E2Eテスト
   ```

4. **統合テスト**
   ```bash
   # 全体テスト実行
   docker compose -f infra/docker-compose.yml exec backend npm run test:e2e
   docker compose -f infra/docker-compose.yml exec frontend npm run cypress:run
   ```

5. **品質チェック**
   ```bash
   # コード品質確認
   npm run lint
   npm run test:cov
   ```

### データベース開発

```bash
# スキーマ変更
cd backend
vim prisma/schema.prisma

# マイグレーション生成・適用
npm run prisma:migrate:dev

# Prisma Studio でデータ確認
npm run prisma:studio
# http://localhost:5555
```

### WebSocket開発

```javascript
// バックエンド: src/websocket/websocket.gateway.ts
@WebSocketGateway()
export class WebSocketGateway {
  @SubscribeMessage('issue:update')
  handleIssueUpdate(client: Socket, payload: any) {
    // リアルタイム通知実装
  }
}

// フロントエンド: WebSocket接続
import { io } from 'socket.io-client';
const socket = io(process.env.NEXT_PUBLIC_WS_URL);
```

## 🤝 Contributing

GanttChart WebUIへのコントリビューションを歓迎します！

### コントリビューションの流れ

1. **Issue作成**
   - バグ報告、機能要望はGitHub Issuesで管理
   - テンプレートに従って詳細な情報を提供

2. **フォーク・ブランチ作成**
   ```bash
   # フォーク後
   git clone https://github.com/YOUR_USERNAME/GanttChartWebUI.git
   cd GanttChartWebUI
   git checkout -b feature/awesome-feature
   ```

3. **開発・テスト**
   ```bash
   # 開発環境起動
   cd infra && docker compose up -d
   
   # 開発・実装
   # backend/ または frontend/ で作業
   
   # テスト実行
   npm run test
   npm run test:e2e
   npm run lint
   ```

4. **プルリクエスト**
   - わかりやすいタイトル・説明
   - 関連Issue番号の記載
   - スクリーンショット（UI変更の場合）

### 開発ガイドライン

#### コーディング規約

- **TypeScript**: strict mode、明示的な型定義
- **命名**: ケバブケース（API）、キャメルケース（変数・関数）
- **コメント**: 英語または日本語、複雑なロジックは必須
- **コミットメッセージ**: `[feat/fix/refactor] 簡潔な説明`

#### プルリクエスト要件

- [ ] 関連テストの追加・更新
- [ ] ドキュメント更新（必要に応じて）
- [ ] Lint・型チェック通過
- [ ] CI/CDテスト通過
- [ ] レビュー対応

#### コードレビュー観点

- **機能性**: 要件・仕様通りの動作
- **保守性**: 読みやすく、理解しやすいコード
- **性能**: 適切なアルゴリズム・データ構造
- **セキュリティ**: 認証・権限・入力検証
- **テスト**: 適切なテストカバレッジ

### バグ報告

バグを発見した場合は、以下の情報を含めてIssue作成をお願いします：

```markdown
## 🐛 バグ概要
簡潔なバグの説明

## 📋 再現手順
1. XXX画面にアクセス
2. YYYボタンをクリック
3. ZZZが発生

## 🔍 期待される動作
正常に動作する場合の説明

## 📱 環境情報
- OS: Windows 11 / macOS 14 / Ubuntu 22.04
- ブラウザ: Chrome 120 / Firefox 121 / Safari 17
- Docker版またはローカル環境
- バージョン: v1.0.0

## 📎 追加情報
- エラーメッセージ
- スクリーンショット
- ログファイル
```

### 機能要望

新機能の提案は以下のテンプレートでお願いします：

```markdown
## 💡 機能概要
提案する機能の簡潔な説明

## 🎯 解決したい課題
現在の問題点や改善したい点

## 📝 詳細仕様
- UI/UXの詳細
- 技術的要件
- 制約・注意点

## 🔄 代替案
検討した他のアプローチがあれば

## 📚 参考資料
関連するドキュメント・記事・競合サービス
```

## 📄 License

本プロジェクトは [MIT License](https://opensource.org/licenses/MIT) の下で公開されています。

```
MIT License

Copyright (c) 2025 GanttChart WebUI Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### オープンソースライセンス

本プロジェクトが使用している主要なオープンソースライブラリ：

- **NestJS**: MIT License
- **Next.js**: MIT License  
- **React**: MIT License
- **Prisma**: Apache License 2.0
- **PostgreSQL**: PostgreSQL License
- **TypeScript**: Apache License 2.0
- **Tailwind CSS**: MIT License

## 🙏 Acknowledgments

GanttChart WebUIの開発にご協力いただいた皆様に感謝いたします：

### 💡 コントリビューター
- プロジェクト企画・設計チーム
- 開発・テストメンバー
- ドキュメント作成協力者
- バグ報告・フィードバック提供者

### 🛠️ 使用技術・ツール
- **[NestJS](https://nestjs.com/)** - 素晴らしいNode.jsフレームワーク
- **[Next.js](https://nextjs.org/)** - 優れたReactフレームワーク
- **[Prisma](https://www.prisma.io/)** - 型安全なORM
- **[Tailwind CSS](https://tailwindcss.com/)** - 効率的なCSSフレームワーク
- **[Docker](https://www.docker.com/)** - コンテナ化技術

### 📚 参考・インスピレーション
- **Gantt Chart**: ヘンリー・ガント氏の画期的なプロジェクト管理手法
- **モダンWeb開発**: オープンソースコミュニティの知見
- **アジャイル開発**: 継続的改善とユーザーフィードバック重視

---

## 📞 サポート・お問い合わせ

### 🔗 リンク
- **GitHub Repository**: [GanttChart WebUI](https://github.com/your-org/GanttChartWebUI)
- **Issue Tracker**: [GitHub Issues](https://github.com/your-org/GanttChartWebUI/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/GanttChartWebUI/discussions)

### 📧 コンタクト
- **メンテナー**: project-maintainer@example.com
- **セキュリティ**: security@example.com

### 🚀 ロードマップ
- **v1.1.0**: カレンダー統合、通知機能強化
- **v1.2.0**: チーム機能、ロール管理
- **v2.0.0**: Enterprise機能、API v2

---

**Happy Coding! 🎉**

*GanttChart WebUIで効率的なプロジェクト管理を実現しましょう。*