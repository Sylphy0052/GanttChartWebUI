# ガントチャートWebUI セットアップガイド

## 📋 目次

1. [前提条件](#前提条件)
2. [クイックスタート](#クイックスタート)
3. [開発環境セットアップ](#開発環境セットアップ)
4. [本番環境デプロイ](#本番環境デプロイ)
5. [環境変数設定](#環境変数設定)
6. [トラブルシューティング](#トラブルシューティング)
7. [開発コマンド](#開発コマンド)

---

## 前提条件

### 必須ソフトウェア
- **Docker**: 20.10以上
- **Docker Compose**: 2.0以上
- **Git**: 2.30以上

### 推奨環境
- **OS**: Windows 10/11 (WSL2), macOS 11+, Ubuntu 20.04+
- **Memory**: 8GB以上
- **Storage**: 10GB以上の空き容量

### ポート要件
以下のポートが利用可能である必要があります：
- `3000`: Web UI (Next.js)
- `3001`: API Server (NestJS)
- `5432`: PostgreSQL Database

---

## クイックスタート

### 1. リポジトリのクローン
```bash
git clone https://github.com/your-org/GanttChartWebUI.git
cd GanttChartWebUI
```

### 2. Docker環境の起動
```bash
# 開発環境の起動
./scripts/docker-dev.sh start

# または直接Docker Composeで起動
docker compose -f docker-compose.dev.yml up -d
```

### 3. アクセス確認
```bash
# Web UIにアクセス
open http://localhost:3000

# API ドキュメントにアクセス
open http://localhost:3001/api/docs

# ヘルスチェック
curl http://localhost:3000/api/health
curl http://localhost:3001/health
```

### 4. デモアカウントでログイン
| 役割 | メールアドレス | パスワード |
|------|---------------|-----------|
| 管理者 | admin@example.com | admin123 |
| 一般ユーザー | user@example.com | user123 |
| デモユーザー | demo@example.com | demo123 |

---

## 開発環境セットアップ

### プロジェクト構造
```
GanttChartWebUI/
├── apps/
│   ├── api/          # NestJS API Server
│   │   ├── src/      # APIソースコード
│   │   ├── prisma/   # データベーススキーマ
│   │   └── Dockerfile
│   └── web/          # Next.js Web UI
│       ├── src/      # Webソースコード
│       └── Dockerfile
├── packages/         # 共有パッケージ
├── scripts/          # デプロイ・管理スクリプト
├── docs/            # ドキュメント
├── docker-compose.dev.yml   # 開発環境設定
├── docker-compose.yml       # 本番環境設定
└── README.md
```

### 環境別起動方法

#### 開発環境
```bash
# スクリプト使用（推奨）
./scripts/docker-dev.sh start

# 手動実行
docker compose -f docker-compose.dev.yml up -d

# ログ監視
docker compose -f docker-compose.dev.yml logs -f
```

#### 本番環境
```bash
# 本番環境の起動
docker compose up -d

# ログ確認
docker compose logs -f
```

### データベースの初期化

#### スキーマ適用
```bash
# APIコンテナ内でPrismaマイグレーション実行
docker exec gantt-api-dev npx prisma migrate deploy

# Prisma Client生成
docker exec gantt-api-dev npx prisma generate
```

#### 初期データ投入
```bash
# シードデータの実行
docker exec gantt-api-dev npm run seed

# カスタムSQL実行
docker exec -i gantt-postgres-dev psql -U gantt_user gantt_chart_dev < initial_data.sql
```

---

## 本番環境デプロイ

### 環境変数の設定

#### API環境変数 (`apps/api/.env`)
```env
NODE_ENV=production
DATABASE_URL=postgresql://gantt_user:SECURE_PASSWORD@postgres:5432/gantt_chart
JWT_SECRET=YOUR_SECURE_JWT_SECRET_KEY
JWT_AUDIENCE=gantt-chart-web-ui
JWT_ISSUER=gantt-chart-api
PORT=3001
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
```

#### Web環境変数 (`apps/web/.env.production`)
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_API_BASE=https://api.yourdomain.com/api/v1
NEXT_TELEMETRY_DISABLED=1
```

### SSL/TLS設定

#### nginx.conf例
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### データベースバックアップ設定

#### 自動バックアップスクリプト
```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# データベースバックアップ
docker exec gantt-postgres pg_dump -U gantt_user gantt_chart > \
  $BACKUP_DIR/gantt_backup_$DATE.sql

# 古いバックアップの削除（30日以上前）
find $BACKUP_DIR -name "gantt_backup_*.sql" -mtime +30 -delete
```

#### cron設定
```bash
# 毎日午前2時にバックアップ実行
0 2 * * * /path/to/backup.sh
```

---

## 環境変数設定

### 設定ファイル一覧

| ファイル | 用途 | 環境 |
|---------|------|------|
| `apps/api/.env` | API設定 | 開発・本番 |
| `apps/web/.env.local` | Web設定（開発） | 開発のみ |
| `apps/web/.env.production` | Web設定（本番） | 本番のみ |
| `docker-compose.dev.yml` | Docker設定（開発） | 開発のみ |
| `docker-compose.yml` | Docker設定（本番） | 本番のみ |

### 重要な環境変数

#### セキュリティ関連
```env
# JWT秘密鍵（本番では強固なものに変更必須）
JWT_SECRET=your-strong-secret-key-change-in-production

# データベース認証情報
POSTGRES_PASSWORD=secure-database-password

# CORS設定（本番では適切なドメインに限定）
CORS_ORIGIN=https://yourdomain.com
```

#### パフォーマンス関連
```env
# データベース接続プール
DATABASE_POOL_SIZE=10
DATABASE_CONNECTION_TIMEOUT=10000

# ログレベル
LOG_LEVEL=info  # production
LOG_LEVEL=debug # development
```

---

## 開発コマンド

### Docker管理スクリプト

#### `./scripts/docker-dev.sh`
```bash
# 開発環境起動
./scripts/docker-dev.sh start

# 開発環境停止
./scripts/docker-dev.sh stop

# 開発環境再起動
./scripts/docker-dev.sh restart

# ログ表示
./scripts/docker-dev.sh logs

# 環境検証
./scripts/docker-dev.sh verify
```

### データベース管理

#### マイグレーション
```bash
# 新しいマイグレーション作成
docker exec gantt-api-dev npx prisma migrate dev --name description

# マイグレーション適用
docker exec gantt-api-dev npx prisma migrate deploy

# データベースリセット
docker exec gantt-api-dev npx prisma migrate reset
```

#### データ操作
```bash
# Prisma Studio起動（GUIデータベースツール）
docker exec gantt-api-dev npx prisma studio

# データベース直接接続
docker exec -it gantt-postgres-dev psql -U gantt_user gantt_chart_dev
```

### 開発支援コマンド

#### コード品質
```bash
# APIのテスト実行
docker exec gantt-api-dev npm test

# Webのテスト実行
docker exec gantt-web-dev npm test

# ESLintチェック
docker exec gantt-api-dev npm run lint
docker exec gantt-web-dev npm run lint

# 型チェック
docker exec gantt-api-dev npm run type-check
docker exec gantt-web-dev npm run type-check
```

#### ビルド・デプロイ
```bash
# プロダクションビルド
docker compose build --no-cache

# イメージサイズ確認
docker images | grep gantt

# 不要なイメージ・コンテナ削除
docker system prune -af
```

---

## トラブルシューティング

### よくある問題

#### 1. ポート競合
**エラー**: `port is already allocated`
```bash
# ポート使用状況確認
netstat -tlnp | grep :3000
ss -tlnp | grep :3000

# プロセス停止
sudo lsof -ti:3000 | xargs kill -9
```

#### 2. Docker容量不足
**エラー**: `no space left on device`
```bash
# Docker容量確認
docker system df

# 不要データ削除
docker system prune -af
docker volume prune
```

#### 3. データベース接続エラー
**エラー**: `connection refused`
```bash
# PostgreSQLコンテナ状態確認
docker exec gantt-postgres-dev pg_isready -U gantt_user -d gantt_chart_dev

# データベース再起動
docker compose -f docker-compose.dev.yml restart postgres
```

#### 4. 権限エラー（Windows WSL2）
```bash
# WSL2でのファイル権限修正
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

### ログ確認方法

```bash
# 全サービスのログ
docker compose -f docker-compose.dev.yml logs -f

# 特定サービスのログ
docker logs gantt-api-dev --tail 50 -f
docker logs gantt-web-dev --tail 50 -f
docker logs gantt-postgres-dev --tail 50 -f

# エラーログのみ抽出
docker logs gantt-api-dev 2>&1 | grep -i error
```

### パフォーマンスチューニング

#### データベース最適化
```sql
-- インデックス作成例
CREATE INDEX CONCURRENTLY idx_issues_project_id ON issues(project_id);
CREATE INDEX CONCURRENTLY idx_issues_assignee_id ON issues(assignee_id);

-- 統計情報更新
ANALYZE;
```

#### Docker最適化
```bash
# メモリ・CPU制限設定例（docker-compose.yml）
services:
  api:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'
```

---

## 継続的インテグレーション

### GitHub Actions設定例

#### `.github/workflows/ci.yml`
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Docker
      run: |
        docker compose -f docker-compose.dev.yml up -d
        sleep 30
    
    - name: Run Tests
      run: |
        docker exec gantt-api-dev npm test
        docker exec gantt-web-dev npm test
    
    - name: Health Check
      run: |
        curl -f http://localhost:3000/api/health
        curl -f http://localhost:3001/health
```

---

## サポート・コミュニティ

### 開発者リソース
- **API文書**: http://localhost:3001/api/docs
- **パフォーマンス監視**: http://localhost:3001/api/v1/system/performance

### 貢献方法
1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/new-feature`)
3. 変更をコミット (`git commit -am 'Add new feature'`)
4. ブランチをプッシュ (`git push origin feature/new-feature`)
5. プルリクエストを作成

**Happy Development! 🚀**