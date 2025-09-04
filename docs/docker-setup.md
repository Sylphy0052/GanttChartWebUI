# Docker環境でのセットアップ・実行ガイド

このドキュメントでは、GanttChartWebUIをDockerを使用して起動・実行する方法について説明します。

## 前提条件

以下のソフトウェアがインストールされている必要があります：

- Docker Engine 20.0+
- Docker Compose 2.0+

## アーキテクチャ構成

このプロジェクトは以下のサービスで構成されています：

- **postgres**: PostgreSQL 15データベース
- **api**: NestJS APIサーバー（ポート: 3001）
- **web**: Next.js フロントエンド（ポート: 3000）

## 環境別セットアップ

### 本番環境（Production）

本番環境用の設定で起動します：

```bash
# プロジェクト全体をビルド・起動
docker compose up -d

# ログの確認
docker compose logs -f

# 特定のサービスのログ確認
docker compose logs -f api
docker compose logs -f web
```

### 開発環境（Development）

開発環境用の設定で起動します（ホットリロード有効）：

```bash
# 開発環境用の設定で起動
docker compose -f docker-compose.dev.yml up -d

# ログの確認
docker compose -f docker-compose.dev.yml logs -f
```

## データベースの初期化

### マイグレーション実行

```bash
# APIコンテナ内でマイグレーション実行
docker compose exec api npm run prisma:migrate

# または、新しいコンテナでマイグレーション実行
docker compose run --rm api npm run prisma:migrate
```

### シードデータ投入

```bash
# シードデータの投入
docker compose exec api npm run seed
```

## 主要なDocker操作

### サービス管理

```bash
# 全サービス起動
docker compose up -d

# 特定のサービスのみ起動
docker compose up -d postgres api

# サービス停止
docker compose down

# サービス停止（ボリュームも削除）
docker compose down -v

# サービス再起動
docker compose restart

# 特定のサービスの再起動
docker compose restart api
```

### コンテナ内でのコマンド実行

```bash
# APIコンテナ内でシェル実行
docker compose exec api sh

# Webコンテナ内でシェル実行
docker compose exec web sh

# データベース接続
docker compose exec postgres psql -U gantt_user -d gantt_chart
```

### ログ確認

```bash
# 全サービスのログ
docker compose logs -f

# 特定のサービスのログ
docker compose logs -f api

# 最新100行のログを表示
docker compose logs --tail=100 web
```

## 環境変数の設定

### 本番環境

本番環境では、以下の環境変数を適切に設定してください：

- `JWT_SECRET`: 強力なJWTシークレットキー
- `POSTGRES_PASSWORD`: 強力なデータベースパスワード
- `NEXT_PUBLIC_API_URL`: APIサーバーのURL

環境変数は`.env`ファイルまたは`docker-compose.override.yml`で設定できます：

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  api:
    environment:
      JWT_SECRET: "your-production-jwt-secret"
  postgres:
    environment:
      POSTGRES_PASSWORD: "your-production-password"
```

### 開発環境

開発環境では、デフォルトの環境変数をそのまま使用できます。

## ヘルスチェック

各サービスにはヘルスチェック機能が組み込まれています：

```bash
# サービス状態の確認
docker compose ps

# ヘルスチェック詳細
docker inspect gantt-api | grep Health -A 10
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. ポートが使用中エラー

```bash
# ポート使用状況確認
netstat -tulpn | grep :3000
netstat -tulpn | grep :3001

# 使用中のプロセスを終了後、再度起動
docker compose down && docker-compose up -d
```

#### 2. データベース接続エラー

```bash
# PostgreSQLコンテナの状態確認
docker compose logs postgres

# データベース接続テスト
docker compose exec postgres pg_isready -U gantt_user
```

#### 3. ビルドエラー

```bash
# イメージの再ビルド
docker compose build --no-cache

# 未使用のDockerリソースクリーンアップ
docker system prune -a
```

#### 4. 依存関係の問題

```bash
# コンテナ内で依存関係を再インストール
docker compose exec api npm install
docker compose exec web npm install
```

### ログレベル設定

詳細なログが必要な場合：

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  api:
    environment:
      LOG_LEVEL: debug
```

## パフォーマンス最適化

### 本番環境での推奨設定

```yaml
# docker-compose.override.yml for production
version: '3.8'
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
  web:
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.3'
  postgres:
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.2'
```

## バックアップとリストア

### データベースバックアップ

```bash
# バックアップ作成
docker compose exec postgres pg_dump -U gantt_user gantt_chart > backup.sql

# バックアップからリストア
docker compose exec -T postgres psql -U gantt_user gantt_chart < backup.sql
```

## アクセス情報

起動完了後、以下のURLでアプリケーションにアクセスできます：

- **フロントエンド**: http://localhost:3000
- **API**: http://localhost:3001
- **API仕様書**: http://localhost:3001/api (Swagger UI)
- **データベース**: localhost:5432

## セキュリティ考慮事項

本番環境で使用する際は、以下の点にご注意ください：

1. **環境変数**: デフォルトのパスワードやシークレットキーを変更
2. **ネットワーク**: 必要最小限のポートのみを公開
3. **SSL/TLS**: リバースプロキシ（Nginx/Apache）でHTTPS設定
4. **ファイアウォール**: 適切なファイアウォール設定を適用