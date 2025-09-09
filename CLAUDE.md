# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

**GanttChart WebUI** は、プロジェクトの課題(Issue)管理とガントチャート表示を行うWebアプリケーションです。階層構造を持つ課題管理、依存関係設定、リアルタイム通知機能を提供します。

### 技術スタック

- **Backend**: NestJS + TypeScript + Prisma ORM + PostgreSQL + Socket.IO
- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **インフラ**: Docker Compose
- **テスト**: Jest (Backend) + Cypress (Frontend E2E)

### アーキテクチャ概要

- **モノレポ構成**: `backend/` と `frontend/` に分離
- **リアルタイム通信**: Socket.IOによるWebSocket実装
- **認証・権限**: プロジェクトレベルでのパスワード認証とEditor権限
- **データ管理**: Prismaによる型安全なDB操作、論理削除・楽観ロック対応

## 開発環境セットアップ

### Docker使用（推奨）

```bash
# 全サービス起動
docker compose up -d

# ログ確認
docker compose logs -f

# 停止・クリーンアップ
docker compose down -v
```

### ローカル環境

```bash
# Backend
cd backend
npm install
cp .env.example .env  # DATABASE_URLを設定
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev  # ポート3001

# Frontend
cd frontend
npm install
# .env.localでNEXT_PUBLIC_API_URL=http://localhost:3001を設定
npm run dev  # ポート3000
```

## 開発コマンド

### Backend

```bash
# 開発・ビルド
npm run start:dev    # 開発サーバー起動
npm run build        # 本番ビルド
npm run start:prod   # 本番サーバー起動

# テスト
npm run test         # ユニットテスト
npm run test:e2e     # E2Eテスト
npm run test:cov     # カバレッジレポート

# コード品質
npm run lint         # ESLint実行
npm run format       # Prettier実行

# Prisma
npm run prisma:generate      # Prismaクライアント生成
npm run prisma:migrate:dev   # 開発用マイグレーション
npm run prisma:studio        # Prisma Studio起動
```

### Frontend

```bash
# 開発・ビルド
npm run dev          # 開発サーバー起動
npm run build        # 本番ビルド
npm run start        # 本番サーバー起動

# コード品質・テスト
npm run lint         # ESLint実行
npm run cypress:open # Cypress UI起動
npm run cypress:run  # Cypress ヘッドレス実行
```

## アーキテクチャ詳細

### Backend構成

```
backend/src/
├── app.module.ts           # ルートモジュール（AuthMiddleware設定）
├── auth/                   # 認証ミドルウェア
├── database/              # DatabaseModule（Prismaグローバル提供）
├── projects/              # プロジェクトCRUD API
├── issues/                # Issue管理API
├── comments/              # Comment管理API
├── uploads/               # 画像アップロード機能
├── websocket/             # WebSocket通知機能
├── backup/                # プロジェクトエクスポート
├── settings/              # グローバル設定（休日設定）
├── changelog/             # 変更履歴管理
└── health/                # ヘルスチェック
```

**重要な設計パターン**:

- **モジュール分離**: 各機能がModuleとして独立
- **認証フロー**: AuthMiddleware → Editor権限チェック → API実行
- **Socket.IO統合**: WebSocketModuleによるリアルタイム通知
- **Prismaベース**: 型安全なDB操作、論理削除・楽観ロック対応

### Frontend構成

```
frontend/src/
├── app/                    # Next.js App Router構造
│   ├── layout.tsx         # ルートレイアウト
│   ├── page.tsx           # ホーム
│   ├── projects/          # プロジェクト管理画面群
│   └── settings/          # 設定画面
└── components/            # 再利用コンポーネント
    ├── backup/            # バックアップ・エクスポート
    ├── issues/            # Issue管理UI
    └── websocket/         # リアルタイム通知UI
```

### データベース設計

**主要エンティティ**:

- `Project`: プロジェクト（shared_password_hash）
- `Issue`: 課題（階層構造、依存関係対応）
- `Dependency`: 課題間依存（Finish-to-Start）
- `Comment`: Issue コメント
- `ImagePath`: 添付画像
- `ChangeLog`: 変更履歴追跡
- `GlobalSettings`: 休日設定

**設計特徴**:

- 論理削除対応（`is_deleted`, `deleted_at`）
- 楽観的排他制御（`version`フィールド）
- Asia/Tokyo タイムゾーン（`@db.Timestamptz(3)`）
- インデックス最適化済み

## API設計

### 認証・権限

- **認証**: プロジェクトごとのパスワード認証
- **権限**: Editor権限による書き込み制御
- **除外**: `/health` エンドポイントは認証不要

### 主要エンドポイント

```
# プロジェクト
GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
DELETE /projects/:id

# Issue管理
GET    /projects/:projectId/issues
POST   /projects/:projectId/issues
GET    /issues/:id
PATCH  /issues/:id
DELETE /issues/:id

# その他
GET    /health                           # ヘルスチェック
GET    /settings/global                  # グローバル設定
POST   /backup/export/:projectId         # エクスポート
```

## テスト方針

### Backend

- **ユニットテスト**: Jest (`*.spec.ts`)
- **E2Eテスト**: Jest with Supertest (`test/jest-e2e.json`)
- **カバレッジ**: `npm run test:cov`

### Frontend

- **E2Eテスト**: Cypress (`cypress/e2e/`)
- **設定**: `cypress.config.ts`

### テスト実行（必須：コンテナ内で実行）

**重要**: テスト実行は必ずDockerコンテナ内で行ってください。ローカル環境でのテスト実行は環境差異により結果が不正確になる可能性があります。

```bash
# Backend テスト（Dockerコンテナ内）
docker compose -f infra/docker-compose.yml exec backend npm run test
docker compose -f infra/docker-compose.yml exec backend npm run test:e2e
docker compose -f infra/docker-compose.yml exec backend npm run test:cov

# Frontend E2Eテスト（Dockerコンテナ内）
docker compose -f infra/docker-compose.yml exec frontend npm run cypress:run
docker compose -f infra/docker-compose.yml exec frontend npm run cypress:run -- --spec "cypress/e2e/wbs-tree.cy.ts"

# 一時的なテスト用コンテナ起動（開発用）
docker run --rm -v $(pwd)/backend:/app -w /app node:20-alpine npm test
docker run --rm -v $(pwd)/frontend:/app -w /app cypress/included:13.8.1 cypress run

# WBS機能テスト（特定テスト実行例）
docker compose -f infra/docker-compose.yml exec backend npm test -- --testNamePattern="WBS"
docker compose -f infra/docker-compose.yml exec frontend npm run cypress:run -- --spec "cypress/e2e/wbs-tree.cy.ts,cypress/e2e/issue-reorder.cy.ts"
```

### 既知の問題・制限事項

#### Cypress E2Eテスト（Alpine Linux）

**現在の状況**: Cypress 15.1.0でAlpine Linux環境での実行に技術的問題があります。

**問題詳細**:

- **シンボルエラー**: `posix_fallocate64: symbol not found`
- **影響範囲**: Docker Compose開発環境でのCypress E2Eテスト実行
- **調査済み対策**: udev、gcompat、libstdc++、chromium、firefoxパッケージを追加済み

**回避策**:

1. **一時的解決策**: Cypress公式Alpine Linuxイメージを使用

   ```bash
   # 代替Cypressテスト実行
   docker run --rm --network infra_gantt-network \
     -v $(pwd)/frontend:/e2e -w /e2e \
     -e CYPRESS_baseUrl=http://frontend:3000 \
     cypress/included:13.8.1 cypress run
   ```

2. **長期解決策（検討中）**:
   - Cypress最新版での修正待ち
   - Alpine LinuxからUbuntu Linuxベースイメージへの移行
   - Playwright等への代替テストフレームワークの検討

**開発時の対応**:

- Backend単体テストはDockerコンテナ内で正常動作
- Frontend E2EテストはローカルCypress UI（`npm run cypress:open`）で開発・デバッグ
- CI/CD環境では別途Ubuntu環境を構築予定
- 日本語で回答してください

### テスト環境準備

```bash
# Docker環境起動（テスト前に必須）
docker compose -f infra/docker-compose.yml up -d

# コンテナ状態確認
docker compose -f infra/docker-compose.yml ps

# ログ確認
docker compose -f infra/docker-compose.yml logs backend
docker compose -f infra/docker-compose.yml logs frontend
```

## 開発ガイドライン

### コード品質

- **lint必須**: 実装完了後は `npm run lint` を実行
- **型安全性**: TypeScript strict mode、Prisma型推論活用
- **命名規約**: ケバブケース（API）、キャメルケース（コード）

### 新機能開発フロー

1. **Prismaスキーマ更新** → `npm run prisma:migrate:dev`
2. **Backend API実装** → ユニットテスト作成
3. **Frontend UI実装** → Socket.IO連携確認
4. **E2Eテスト追加** → Cypress
5. **lint・型チェック** → 両プロジェクト

### Docker開発

- **推奨**: `docker compose up -d` での統合開発
- **ホットリロード**: ローカルのソースコード変更が即座に反映
- **DB管理**: PostgreSQL永続化、`docker compose down -v` でリセット

## トラブルシューティング

### よくある問題

- **Prismaマイグレーション失敗**: `npx prisma migrate reset` でリセット
- **Docker起動失敗**: `docker compose down -v && docker compose build --no-cache`
- **フロントエンド接続エラー**: `.env.local` の `NEXT_PUBLIC_API_URL` 確認
- **Socket.IO接続問題**: Backend の WebSocketModule 起動状況確認

### デバッグコマンド

```bash
# Backend API確認
curl http://localhost:3001/health

# DB接続確認
cd backend && npm run test:db

# フロントエンド確認
cd frontend && npm run dev
```
