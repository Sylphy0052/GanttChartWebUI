# GanttChart WebUI

## 概要

GanttChart WebUIは、プロジェクトの課題(Issue)管理とガントチャート表示を行うWebアプリケーションです。

### 主要機能

- **プロジェクト管理**: プロジェクトの作成、編集、削除
- **課題(Issue)管理**: 階層構造を持つ課題の管理、進捗追跡
- **依存関係管理**: 課題間の依存関係設定（Finish-to-Start）
- **ガントチャート表示**: プロジェクトスケジュールの視覚化
- **コメント機能**: 課題に対するコメントの追加・編集
- **画像アップロード**: 課題に関連する画像の添付
- **バックアップ・エクスポート**: プロジェクトデータのJSON形式出力
- **リアルタイム通知**: WebSocketによるリアルタイム更新
- **権限管理**: プロジェクトレベルでの編集権限制御

## 技術スタック

### Backend

- **NestJS** (Node.js フレームワーク)
- **Prisma** (ORM)
- **PostgreSQL** (データベース)
- **Socket.IO** (WebSocket通信)
- **TypeScript**

### Frontend

- **Next.js 15** (React フレームワーク)
- **React 19** (UI ライブラリ)
- **Tailwind CSS v4** (CSSフレームワーク)
- **Cypress** (E2Eテスト)
- **TypeScript**

## 必要環境

- Node.js 20+
- PostgreSQL 15+
- npm または yarn

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd GanttChartWebUI
```

### 2. Backend セットアップ

```bash
cd backend

# 依存関係のインストール
npm install

# データベース環境変数の設定
cp .env.example .env
# .envファイルを編集してDATABASE_URLを設定

# Prismaの初期化とマイグレーション
npm run prisma:generate
npm run prisma:migrate:dev

# 開発サーバーの起動（ポート3001）
npm run start:dev
```

### 3. Frontend セットアップ

```bash
cd frontend

# 依存関係のインストール
npm install

# 環境変数の設定
# .env.localファイルを作成し、バックエンドAPIのURLを設定

# 開発サーバーの起動（ポート3000）
npm run dev
```

## 利用可能なスクリプト

### Backend

```bash
# 開発サーバー起動
npm run start:dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm run start:prod

# テスト実行
npm run test

# E2Eテスト
npm run test:e2e

# コードフォーマット
npm run format

# リント実行
npm run lint

# Prismaスキーマ生成
npm run prisma:generate

# データベースマイグレーション
npm run prisma:migrate:dev

# Prisma Studio起動
npm run prisma:studio
```

### Frontend

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm run start

# リント実行
npm run lint

# Cypressテスト（UI）
npm run cypress:open

# Cypressテスト（ヘッドレス）
npm run cypress:run
```

## API エンドポイント

### プロジェクト管理

- `GET /projects` - 全プロジェクト取得
- `POST /projects` - プロジェクト作成
- `GET /projects/:id` - プロジェクト詳細取得
- `PATCH /projects/:id` - プロジェクト更新
- `DELETE /projects/:id` - プロジェクト削除

### 課題管理

- `GET /projects/:projectId/issues` - プロジェクトの全課題取得
- `POST /projects/:projectId/issues` - 課題作成
- `GET /issues/:id` - 課題詳細取得
- `PATCH /issues/:id` - 課題更新
- `DELETE /issues/:id` - 課題削除

### その他

- `GET /health` - ヘルスチェック
- `GET /settings/global` - グローバル設定取得
- `POST /backup/export/:projectId` - プロジェクトエクスポート

## データベース設計

### 主要エンティティ

- **Project**: プロジェクト情報
- **Issue**: 課題情報（階層構造対応）
- **Dependency**: 課題間依存関係
- **Comment**: 課題コメント
- **ImagePath**: 添付画像パス
- **ChangeLog**: 変更履歴
- **GlobalSettings**: グローバル設定（休日設定等）

### 特徴

- 論理削除対応
- 楽観的排他制御（バージョン管理）
- タイムゾーン対応（Asia/Tokyo）
- インデックス最適化

## 開発について

### コード品質

プロジェクトでは以下のツールを使用してコード品質を保持しています：

- **ESLint**: コード品質チェック
- **Prettier**: コードフォーマット
- **TypeScript**: 静的型チェック
- **Jest**: ユニットテスト
- **Cypress**: E2Eテスト
