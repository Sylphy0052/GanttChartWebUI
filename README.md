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
