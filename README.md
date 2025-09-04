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
- Node.js 20.x
- Docker & Docker Compose
- npm or pnpm

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定
```bash
# APIの環境変数
cp apps/api/.env.example apps/api/.env

# Webの環境変数
cp apps/web/.env.example apps/web/.env.local
```

### 3. Dockerで開発環境を起動
```bash
cd infra/docker
docker compose up -d
```

### 4. データベースのマイグレーション
```bash
cd apps/api
npx prisma migrate dev
```

### 5. シードデータの投入（1,000件のダミーデータ）
```bash
npm run seed
```

### 6. アプリケーションの起動
```bash
# プロジェクトルートで
npm run dev
```

アクセス先:
- Web: http://localhost:3000
- API: http://localhost:3001/api/v1

## 主要機能（PoC版）

- **Issue管理**: CRUD操作、担当者・ステータス・工数管理
- **WBS**: 親子階層表示、ドラッグ&ドロップでの並び替え
- **ガントチャート**: バー編集（移動/伸縮）、FS依存関係の追加/削除
- **進捗管理**: パーセンテージ入力、親タスクへの自動集計
- **Undo/Redo**: Ctrl+Z/Ctrl+Y での操作取り消し/やり直し
- **カレンダー**: 平日稼働設定（1日8時間固定）
- **監査ログ**: 主要操作の履歴記録

## 開発コマンド

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

## パフォーマンス目標

- 1,000 Issueでのガント初回描画: < 1.5秒
- ドラッグ操作の応答: < 100ms
- ズーム切替: < 150ms

## ライセンス

Private