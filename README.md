# ガントチャート WebUI

Issue管理とWBS/ガントチャート機能を統合したWebアプリケーション。

> 🚀 **初回セットアップの方は**: [QUICK_START.md](./QUICK_START.md) で5分以内のセットアップ手順を確認してください

## 技術スタック

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: NestJS, Prisma ORM
- **Database**: PostgreSQL 15
- **Development**: Docker Compose + TurboRepo

## クイックスタート（推奨）

### 前提条件

- Docker & Docker Compose
- Git

### 1. リポジトリをクローン

```bash
git clone <repository-url>
cd GanttChartWebUI
```

### 2. 環境ファイルをセットアップ

```bash
# API環境変数
cp apps/api/.env.example apps/api/.env

# Web環境変数
cp apps/web/.env.example apps/web/.env.local
```

### 3. 開発環境を起動

```bash
# 全サービス起動（初回はビルドも実行される）
./scripts/docker-dev.sh start
```

### 4. アクセス確認

- **Web UI**: http://localhost:3000 
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api

✅ フロントエンドに "Gantt Chart WebUI" ページが表示されれば成功！

### 5. 開発ワークフロー

```bash
# ログ確認
./scripts/docker-dev.sh logs

# 開発環境停止
./scripts/docker-dev.sh stop

# 開発環境再起動
./scripts/docker-dev.sh restart

# 状況確認
./scripts/docker-dev.sh status
```

## セットアップ検証

開発環境が正しく動作しているか確認：

```bash
# 自動検証スクリプト実行
./scripts/verify-docker-setup.sh

# 開発ワークフロー検証（acceptance criteria）
./scripts/validate-dev-workflow.sh
```

✅ **8/8 テストパス** になれば、環境セットアップ完了！

## ディレクトリ構造

```
.
├── apps/
│   ├── api/        # NestJS バックエンド
│   └── web/        # Next.js フロントエンド
├── scripts/        # 開発用スクリプト
├── docker-compose.dev.yml  # 開発環境用Docker設定
└── turbo.json      # モノレポ設定
```

## 開発コマンド

### Docker環境での開発（推奨）

```bash
# 開発環境制御
./scripts/docker-dev.sh start|stop|restart|logs|status

# データベース操作
./scripts/docker-dev.sh db        # PostgreSQL接続
./scripts/docker-dev.sh migrate   # マイグレーション
./scripts/docker-dev.sh seed      # シードデータ投入

# コンテナ操作
./scripts/docker-dev.sh shell     # APIコンテナシェル
./scripts/docker-dev.sh clean     # 全削除（注意）
```

### ローカル環境での開発

```bash
# 前提: PostgreSQL 15がローカルで稼働
npm install
npm run dev         # 全サービス開発サーバー起動
npm run build       # 全サービスビルド
npm run lint        # リント実行
npm run test        # テスト実行
```

## ヘルスチェックエンドポイント

### API ヘルスチェック
- **GET** `/` - シンプルヘルスチェック
- **GET** `/health` - 詳細ヘルスチェック（DB接続確認含む）

### Web ヘルスチェック
- **GET** `/api/health` - フロントエンド＋API接続確認

## トラブルシューティング

### よくある問題と解決法

#### 1. ポートが使用中エラー

```bash
# 使用中ポート確認
lsof -i :3000
lsof -i :3001  
lsof -i :5432

# Docker環境リセット
./scripts/docker-dev.sh stop
./scripts/docker-dev.sh start
```

#### 2. コンテナ起動失敗

```bash
# イメージ再ビルド
docker compose -f docker-compose.dev.yml build --no-cache

# 完全クリーンアップ＋再起動
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh start
```

#### 3. データベース接続エラー

```bash
# マイグレーション実行
./scripts/docker-dev.sh migrate

# データベース状況確認
./scripts/docker-dev.sh db
# → \l でデータベース一覧確認
# → \q で終了
```

#### 4. 環境変数設定確認

```bash
# 環境変数ファイル確認
cat apps/api/.env
cat apps/web/.env.local

# コンテナ内環境変数確認  
docker exec gantt-api-dev env | grep NODE_ENV
docker exec gantt-web-dev env | grep NEXT_PUBLIC
```

## 開発Tips

### ホットリロード

- **フロントエンド**: ファイル保存で自動リロード
- **バックエンド**: ファイル保存で自動再起動

### ログ確認

```bash
# 全サービスログ
./scripts/docker-dev.sh logs

# 特定サービスのみ
docker logs gantt-api-dev -f
docker logs gantt-web-dev -f  
docker logs gantt-postgres-dev -f
```

### デバッグモード

```bash
# APIコンテナ内でデバッグ
./scripts/docker-dev.sh shell
npm run dev  # コンテナ内で直接実行
```

## 現在の実装状況

- ✅ **環境構築**: Docker開発環境、PostgreSQL、Prisma
- ✅ **基本API**: NestJS + ヘルスチェックエンドポイント  
- ✅ **基本UI**: Next.js + 基本ランディングページ
- ⏳ **認証**: JWT認証（実装済み設定、UI未完成）
- ⏳ **Issue管理**: CRUD API（準備中）
- ⏳ **ガントチャート**: SVGベース描画（未実装）

---

## 次のステップ

1. **Issue管理**: CRUD API + UI実装
2. **認証UI**: ログイン・サインアップ画面  
3. **WBS機能**: 階層管理・並び替え
4. **ガントチャート**: バー操作・依存関係設定

---

## サポート

問題が発生した場合：

1. `./scripts/validate-dev-workflow.sh` で開発ワークフロー検証
2. `./scripts/verify-docker-setup.sh` でセットアップ検証
3. `./scripts/docker-dev.sh logs` でログ確認
4. `./scripts/docker-dev.sh clean && ./scripts/docker-dev.sh start` で環境リセット