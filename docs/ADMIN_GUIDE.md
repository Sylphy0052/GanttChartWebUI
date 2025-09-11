# GanttChart WebUI - システム管理者ガイド

本ドキュメントは、GanttChart WebUIをプロダクション環境で安全かつ効率的に運用するためのシステム管理者向け包括ガイドです。

## 📋 目次

- [システム概要](#システム概要)
- [システム要件と前提条件](#システム要件と前提条件)
- [インストールと初期設定](#インストールと初期設定)
- [環境変数と設定ファイル](#環境変数と設定ファイル)
- [バックアップ・リストア手順](#バックアップリストア手順)
- [ログ管理とモニタリング](#ログ管理とモニタリング)
- [セキュリティ設定](#セキュリティ設定)
- [アップデート・ロールバック](#アップデートロールバック)
- [パフォーマンス調整](#パフォーマンス調整)
- [トラブルシューティング](#トラブルシューティング)
- [運用チェックリスト](#運用チェックリスト)

---

## 🏗️ システム概要

### アーキテクチャ

**GanttChart WebUI** は、以下のコンポーネントで構成されるマイクロサービス型Webアプリケーションです：

```
┌─────────────────┐    ┌──────────────────┐
│   Load Balancer │    │   SSL Termination│
│     (Nginx)     │────│    (Let's Encrypt)│
└─────────────────┘    └──────────────────┘
         │
         ├── Frontend (Next.js + React)
         ├── Backend API (NestJS + Socket.IO)
         └── Database (PostgreSQL + Prisma)
```

### 技術スタック

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **Backend**: NestJS + TypeScript + Prisma ORM + Socket.IO
- **Database**: PostgreSQL 15
- **Reverse Proxy**: Nginx 1.25
- **Container**: Docker + Docker Compose
- **SSL/TLS**: Let's Encrypt (Certbot)

### パフォーマンス目標

- **初期レンダリング時間**: P95 < 1500ms
- **ドラッグ操作レイテンシ**: P95 < 100ms
- **API応答時間**: P95 < 500ms
- **並行ユーザー**: 100ユーザー（同時編集20ユーザー）
- **稼働率**: 99.9%以上

---

## 🔧 システム要件と前提条件

### ハードウェア要件

**最小要件**:
- **CPU**: 2コア以上
- **メモリ**: 4GB以上
- **ストレージ**: 20GB以上 (SSD推奨)
- **OS**: Linux (Ubuntu 20.04 LTS以上推奨)

**推奨要件**:
- **CPU**: 4コア以上
- **メモリ**: 8GB以上
- **ストレージ**: 50GB以上 (SSD)
- **ネットワーク**: 100Mbps以上

### ソフトウェア要件

**必須ソフトウェア**:
- Docker 24.0+
- Docker Compose 2.0+
- Git 2.30+
- Curl/Wget
- OpenSSL

**推奨ソフトウェア**:
- UFW (ファイアウォール)
- Fail2Ban (侵入検知)
- Logrotate (ログローテーション)
- Certbot (SSL証明書管理)

### ネットワーク要件

**ポート開放要件**:
- 22 (SSH) - 管理者IPからのみ
- 80 (HTTP) - HTTPSリダイレクト用
- 443 (HTTPS) - Webアクセス

**外部通信要件**:
- Docker Hub (イメージプル)
- GitHub (ソースコード取得)
- Let's Encrypt (SSL証明書取得)
- APTリポジトリ (パッケージ更新)

---

## 🚀 インストールと初期設定

### 1. 事前準備

```bash
# システム更新
sudo apt update && sudo apt upgrade -y

# 必要パッケージインストール
sudo apt install -y curl wget unzip htop git ufw certbot

# Docker & Docker Composeインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 再ログイン後、Dockerテスト
docker --version
docker compose version
```

### 2. プロジェクトデプロイ

```bash
# プロジェクトクローン
git clone https://github.com/yourdomain/GanttChartWebUI.git
cd GanttChartWebUI

# データディレクトリ作成
sudo mkdir -p /opt/gantt/data/{postgres,uploads}
sudo mkdir -p /opt/gantt/logs/{nginx,app}
sudo mkdir -p /opt/gantt/backups
sudo chown -R $USER:docker /opt/gantt/
sudo chmod -R 755 /opt/gantt/

# SSL証明書ディレクトリ準備
sudo mkdir -p /opt/gantt/ssl/{certs,private}
```

### 3. 初期設定

```bash
# 環境設定ファイル作成
cp .env.production .env.production.local

# 重要: セキュリティ設定を変更
vim .env.production.local
```

**必須変更項目**:
```bash
# PostgreSQL（強力なパスワードに変更）
POSTGRES_PASSWORD=your_secure_database_password_here
POSTGRES_USER=gantt_prod_user
POSTGRES_DB=gantt_production

# JWT・セッション（256bit以上のランダム文字列）
JWT_SECRET=your_super_secure_jwt_secret_256_bit_minimum
SESSION_SECRET=your_session_secret_key_256_bit_here

# ドメイン設定（実際のドメインに変更）
NEXT_PUBLIC_API_URL=https://gantt.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://gantt.yourdomain.com

# データベース接続文字列
DATABASE_URL="postgresql://gantt_prod_user:your_secure_database_password_here@postgres:5432/gantt_production?schema=public&connection_limit=20&pool_timeout=20"
```

### 4. SSL証明書設定

```bash
# Let's Encrypt証明書取得
sudo certbot certonly --standalone -d gantt.yourdomain.com

# 証明書を適切な場所にコピー
sudo cp /etc/letsencrypt/live/gantt.yourdomain.com/fullchain.pem /opt/gantt/ssl/certs/
sudo cp /etc/letsencrypt/live/gantt.yourdomain.com/privkey.pem /opt/gantt/ssl/private/
sudo chown root:docker /opt/gantt/ssl/private/privkey.pem
sudo chmod 640 /opt/gantt/ssl/private/privkey.pem
```

### 5. 初回デプロイ

```bash
# デプロイスクリプト実行権限付与
chmod +x scripts/deploy-production.sh

# 本番環境起動
./scripts/deploy-production.sh start

# サービス状態確認
./scripts/deploy-production.sh status

# ヘルスチェック
curl -f https://gantt.yourdomain.com/health
```

---

## ⚙️ 環境変数と設定ファイル

### 主要設定ファイル一覧

```
/mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/
├── .env.production.local              # 本番環境変数（要編集）
├── infra/
│   ├── docker-compose.production.yml # Docker Compose設定
│   ├── nginx/nginx.production.conf   # Nginx設定
│   └── postgres/postgresql.conf       # PostgreSQL最適化設定
└── scripts/
    ├── deploy-production.sh           # デプロイスクリプト
    ├── backup-database.sh            # バックアップスクリプト
    └── backup-config.conf             # バックアップ設定
```

### 環境変数詳細

#### データベース設定
```bash
# PostgreSQL設定
POSTGRES_USER=gantt_prod_user
POSTGRES_PASSWORD=your_secure_password  # 必須変更
POSTGRES_DB=gantt_production
DATABASE_URL="postgresql://gantt_prod_user:password@postgres:5432/gantt_production?schema=public&connection_limit=20&pool_timeout=20"
```

#### アプリケーション設定
```bash
# 本番環境設定
NODE_ENV=production
BACKEND_PORT=3002
NGINX_PORT=80
NGINX_HTTPS_PORT=443

# フロントエンド設定
NEXT_PUBLIC_API_URL=https://gantt.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://gantt.yourdomain.com
```

#### パフォーマンス設定
```bash
# Node.js最大メモリ（MB）
NODE_MAX_OLD_SPACE_SIZE=2048

# データベース接続プール
DB_CONNECTION_POOL_MIN=5
DB_CONNECTION_POOL_MAX=20

# キャッシュTTL（秒）
CACHE_TTL=3600
```

#### セキュリティ設定
```bash
# 認証設定
AUTH_TYPE=password
JWT_SECRET=your_jwt_secret_256_bit_minimum    # 必須変更
SESSION_SECRET=your_session_secret_256_bit    # 必須変更

# ファイルアップロード制限
MAX_FILE_SIZE=10                              # MB
ALLOWED_FILE_EXTENSIONS=jpg,jpeg,png,gif,pdf,doc,docx

# レート制限
RATE_LIMIT_RPM=1000                          # requests per minute
WS_CONNECTION_LIMIT=100
```

#### 監視・ログ設定
```bash
# ログ設定
LOG_LEVEL=info
LOG_MAX_FILES=14
LOG_MAX_SIZE=100m

# 監視設定
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30
```

### Docker Compose設定詳細

#### リソース制限
```yaml
# PostgreSQL
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M

# Backend
deploy:
  resources:
    limits:
      cpus: '1.5'
      memory: 2G
    reservations:
      cpus: '0.3'
      memory: 256M
```

#### ヘルスチェック設定
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

---

## 💾 バックアップ・リストア手順

### 自動バックアップ設定

#### 1. バックアップスクリプト設定

```bash
# 設定ファイル編集
vim scripts/backup-config.conf

# 主要設定項目
BACKUP_DIR="/opt/gantt/backups"
DB_USER="gantt_prod_user"
DB_NAME="gantt_production"
POSTGRES_CONTAINER="gantt_postgres_prod"
ENCRYPTION_ENABLED="false"  # 本番では"true"推奨
```

#### 2. デプロイスクリプトによるバックアップ

```bash
# 統合バックアップ実行
./scripts/deploy-production.sh backup

# 詳細バックアップ（設定可能）
./scripts/backup-database.sh -v -t daily
```

#### 3. Cronによる定期バックアップ

```bash
# Cron設定編集
crontab -e

# 毎日2時にバックアップ実行
0 2 * * * /path/to/GanttChartWebUI/scripts/backup-database.sh -t daily >> /var/log/gantt-backup.log 2>&1

# 週次バックアップ（日曜3時）
0 3 * * 0 /path/to/GanttChartWebUI/scripts/backup-database.sh -t weekly

# 古いバックアップ削除（30日以上）
0 3 * * 0 find /opt/gantt/backups/ -type d -mtime +30 -exec rm -rf {} +
```

### 手動バックアップ

#### 完全バックアップ
```bash
# データベース + ファイル + 設定の完全バックアップ
backup_name="gantt_manual_backup_$(date +%Y%m%d_%H%M%S)"
backup_path="/opt/gantt/backups/$backup_name"
mkdir -p "$backup_path"

# データベースバックアップ
docker exec gantt_postgres_prod \
  pg_dump -U gantt_prod_user gantt_production > "$backup_path/database.sql"

# アップロードファイルバックアップ
tar -czf "$backup_path/uploads.tar.gz" -C /opt/gantt/data uploads/

# 設定ファイルバックアップ
cp .env.production.local "$backup_path/"
cp -r infra/ "$backup_path/"

# ログファイルバックアップ（オプション）
tar -czf "$backup_path/logs.tar.gz" -C /opt/gantt logs/
```

#### ホットバックアップ（サービス停止なし）
```bash
# PostgreSQLホットバックアップ
docker exec gantt_postgres_prod \
  pg_basebackup -U gantt_prod_user -D /tmp/backup -Ft -z -P
```

### リストア手順

#### 災害復旧時の完全リストア

```bash
# 1. サービス停止
./scripts/deploy-production.sh stop

# 2. データベースリストア
backup_date="20240101_020000"  # バックアップ日時を指定
docker compose -f infra/docker-compose.production.yml up -d postgres

# データベース再作成
docker exec gantt_postgres_prod \
  psql -U gantt_prod_user -c "DROP DATABASE IF EXISTS gantt_production;"
docker exec gantt_postgres_prod \
  psql -U gantt_prod_user -c "CREATE DATABASE gantt_production;"

# データ復元
docker exec -i gantt_postgres_prod \
  psql -U gantt_prod_user gantt_production < "/opt/gantt/backups/gantt_backup_$backup_date/database.sql"

# 3. ファイルリストア
rm -rf /opt/gantt/data/uploads/*
tar -xzf "/opt/gantt/backups/gantt_backup_$backup_date/uploads.tar.gz" -C /opt/gantt/data/

# 4. 設定ファイルリストア（必要に応じて）
cp "/opt/gantt/backups/gantt_backup_$backup_date/.env.production.local" .

# 5. サービス再起動
./scripts/deploy-production.sh start
```

### 整合性チェック

```bash
# データベース整合性チェック
docker exec gantt_postgres_prod \
  pg_dump -U gantt_prod_user gantt_production --schema-only > schema_check.sql

# アップロードファイル整合性
docker exec gantt_backend_prod \
  ls -la /app/uploads | wc -l

# データベース統計
docker exec gantt_postgres_prod \
  psql -U gantt_prod_user gantt_production -c "
    SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
    FROM pg_stat_user_tables;
  "
```

---

## 📊 ログ管理とモニタリング

### ログ構成

#### ログファイル一覧
```
/opt/gantt/logs/
├── nginx/
│   ├── access.log          # アクセスログ
│   ├── error.log           # エラーログ
│   └── cache.log           # キャッシュログ
├── app/
│   ├── backend.log         # バックエンドアプリケーションログ
│   ├── frontend.log        # フロントエンドビルドログ
│   └── database.log        # データベースログ
└── system/
    ├── docker-compose.log  # Docker Composeログ
    └── backup.log          # バックアップログ
```

### ログローテーション設定

```bash
# /etc/logrotate.d/gantt-webui
sudo tee /etc/logrotate.d/gantt-webui << 'EOF'
/opt/gantt/logs/*/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    create 644 root root
    postrotate
        docker exec gantt_nginx_prod nginx -s reload
    endscript
}

/var/log/gantt-backup.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    create 644 root root
}
EOF
```

### リアルタイムログ監視

#### 基本ログ監視
```bash
# 全サービスログ
./scripts/deploy-production.sh logs

# 特定サービス
./scripts/deploy-production.sh logs backend
./scripts/deploy-production.sh logs nginx

# エラーログのみ
docker compose -f infra/docker-compose.production.yml logs | grep -i error

# JSONログ形式での詳細解析
docker compose -f infra/docker-compose.production.yml logs backend | jq .
```

#### アラート用ログフィルタ
```bash
# 重要エラーの監視
tail -f /opt/gantt/logs/app/backend.log | grep -E "(ERROR|FATAL|5[0-9][0-9])"

# 異常な接続数
tail -f /opt/gantt/logs/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -nr | head -10

# データベース接続エラー
docker compose -f infra/docker-compose.production.yml logs postgres | grep -i "connection\|error"
```

### システムモニタリング

#### 基本監視項目

**CPU・メモリ・ディスク監視**:
```bash
# リアルタイムリソース使用量
./scripts/deploy-production.sh status

# 詳細リソース監視
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# ディスク使用量
df -h /opt/gantt/
du -sh /opt/gantt/data/*
```

**アプリケーション監視**:
```bash
# ヘルスチェック
curl -f https://gantt.yourdomain.com/health

# API応答時間測定
time curl -f https://gantt.yourdomain.com/projects

# データベース接続確認
docker exec gantt_postgres_prod \
  pg_isready -U gantt_prod_user -d gantt_production
```

#### 詳細監視スクリプト

```bash
# システム監視スクリプト作成
cat > /opt/gantt/monitoring.sh << 'EOF'
#!/bin/bash

LOG_FILE="/opt/gantt/logs/system/monitoring.log"
ALERT_EMAIL="admin@yourdomain.com"

# CPU使用率チェック
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "$(date): HIGH CPU USAGE: $CPU_USAGE%" >> $LOG_FILE
fi

# メモリ使用率チェック
MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
if (( $(echo "$MEM_USAGE > 90" | bc -l) )); then
    echo "$(date): HIGH MEMORY USAGE: $MEM_USAGE%" >> $LOG_FILE
fi

# ディスク使用率チェック
DISK_USAGE=$(df /opt/gantt | tail -1 | awk '{print $5}' | cut -d'%' -f1)
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "$(date): HIGH DISK USAGE: $DISK_USAGE%" >> $LOG_FILE
fi

# サービス稼働確認
if ! curl -f -s https://gantt.yourdomain.com/health > /dev/null; then
    echo "$(date): SERVICE DOWN: Health check failed" >> $LOG_FILE
fi
EOF

chmod +x /opt/gantt/monitoring.sh

# Cron設定（5分間隔）
echo "*/5 * * * * /opt/gantt/monitoring.sh" | crontab -
```

#### 監視項目・閾値

| 項目 | 警告閾値 | 重要閾値 | チェック間隔 |
|------|----------|----------|------------|
| CPU使用率 | 70% | 85% | 5分 |
| メモリ使用率 | 80% | 95% | 5分 |
| ディスク使用率 | 80% | 90% | 15分 |
| API応答時間 | 1秒 | 3秒 | 1分 |
| エラー率 | 1% | 5% | 5分 |
| データベース接続数 | 150 | 190 | 5分 |

---

## 🔒 セキュリティ設定

### ネットワークセキュリティ

#### ファイアウォール設定（UFW）

```bash
# 基本ファイアウォール設定
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 必要ポートのみ開放
sudo ufw allow ssh                    # SSH (22)
sudo ufw allow 80/tcp                 # HTTP
sudo ufw allow 443/tcp                # HTTPS

# 管理者IP限定SSH（推奨）
sudo ufw delete allow ssh
sudo ufw allow from YOUR_ADMIN_IP to any port ssh

sudo ufw enable
sudo ufw status verbose
```

#### 侵入検知システム（Fail2Ban）

```bash
# Fail2Ban インストール
sudo apt install -y fail2ban

# 設定ファイル作成
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /opt/gantt/logs/nginx/error.log
maxretry = 3

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /opt/gantt/logs/nginx/error.log
maxretry = 10
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### アプリケーションセキュリティ

#### 認証・権限管理

**プロジェクトレベル認証**:
```bash
# 強力なプロジェクトパスワード設定
# 管理画面でプロジェクト作成時に20文字以上のパスワード設定を推奨

# パスワード強度チェック例
echo "your_project_password" | cracklib-check
```

**JWT セキュリティ**:
```bash
# 256bit以上のJWT秘密鍵生成
openssl rand -base64 64

# セッション秘密鍵生成
openssl rand -base64 64
```

#### データ保護

**データベース暗号化**:
```bash
# PostgreSQL SSL接続設定
# postgresql.conf
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
```

**ファイルアップロード制限**:
```nginx
# Nginx ファイルサイズ制限
client_max_body_size 10M;

# アップロード可能拡張子制限（設定済み）
location ~ \.(php|jsp|asp|sh|exe)$ {
    deny all;
}
```

#### 脆弱性対策

**定期セキュリティ更新**:
```bash
# システムパッケージ更新スクリプト
cat > /opt/gantt/security-update.sh << 'EOF'
#!/bin/bash
LOG_FILE="/var/log/security-updates.log"

echo "$(date): Starting security updates" >> $LOG_FILE

# システムパッケージ更新
sudo apt update && sudo apt upgrade -y

# Dockerイメージ更新
cd /path/to/GanttChartWebUI
docker compose -f infra/docker-compose.production.yml pull

# セキュリティスキャン（CIS Benchmarks）
if command -v lynis &> /dev/null; then
    lynis audit system --quiet
fi

echo "$(date): Security updates completed" >> $LOG_FILE
EOF

chmod +x /opt/gantt/security-update.sh

# 週次自動実行
echo "0 3 * * 0 /opt/gantt/security-update.sh" | sudo crontab -
```

**セキュリティスキャン**:
```bash
# Lynis セキュリティスキャンツール
sudo apt install -y lynis
sudo lynis audit system

# Docker セキュリティスキャン
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image gantt_backend_prod
```

---

## 🔄 アップデート・ロールバック

### アップデート戦略

#### ローリングアップデート（ダウンタイム最小化）

```bash
# 1. バックアップ作成
./scripts/deploy-production.sh backup

# 2. 新バージョンプル
git fetch origin
git checkout v2.0.0  # 新バージョンタグ

# 3. 段階的アップデート
# データベースマイグレーション（影響度チェック）
docker exec gantt_backend_prod \
  npx prisma migrate status

# 4. ステージング環境テスト（推奨）
# ...

# 5. 本番適用
./scripts/deploy-production.sh restart
```

#### Blue-Green デプロイメント（高可用性）

```bash
# Blue環境（現行）→ Green環境（新バージョン）への切り替え

# 1. Green環境準備
cp .env.production.local .env.production.green
sed -i 's/gantt_production/gantt_production_green/g' .env.production.green

# 2. Green環境デプロイ
docker compose -f infra/docker-compose.production.yml \
  --env-file .env.production.green up -d

# 3. Green環境テスト
curl -f http://localhost:8080/health  # Green環境ポート

# 4. Nginxで切り替え
# nginx.conf のupstream設定を変更してリロード

# 5. Blue環境停止
docker compose -f infra/docker-compose.production.yml \
  --env-file .env.production.local down
```

### ロールバック手順

#### 緊急ロールバック（5分以内）

```bash
# 1. 即座に前バージョンに戻す
git checkout v1.9.0  # 前の安定バージョン

# 2. サービス再起動
./scripts/deploy-production.sh restart

# 3. ヘルスチェック
curl -f https://gantt.yourdomain.com/health

# 4. データベース整合性確認
docker exec gantt_postgres_prod \
  psql -U gantt_prod_user gantt_production -c "SELECT COUNT(*) FROM projects;"
```

#### データベースロールバック

```bash
# データベーススキーマロールバック（Prisma）
# 注意: データ損失の可能性があるため、事前バックアップ必須

# 1. マイグレーション状態確認
docker exec gantt_backend_prod \
  npx prisma migrate status

# 2. 特定マイグレーションまでリセット
docker exec gantt_backend_prod \
  npx prisma migrate reset --force

# 3. 安定バージョンのマイグレーション適用
docker exec gantt_backend_prod \
  npx prisma migrate deploy
```

### 更新検証

#### 更新後検証チェックリスト

```bash
# 1. サービス稼働確認
./scripts/deploy-production.sh status

# 2. 機能テスト
curl -f https://gantt.yourdomain.com/health
curl -f https://gantt.yourdomain.com/projects

# 3. パフォーマンステスト
ab -n 100 -c 10 https://gantt.yourdomain.com/

# 4. データ整合性確認
docker exec gantt_postgres_prod \
  psql -U gantt_prod_user gantt_production -c "
    SELECT table_name, estimated_count 
    FROM (
      SELECT schemaname, tablename AS table_name, n_tup_ins + n_tup_upd - n_tup_del AS estimated_count
      FROM pg_stat_user_tables
    ) t;
  "

# 5. ログ確認
./scripts/deploy-production.sh logs | grep -i error | head -20
```

---

## ⚡ パフォーマンス調整

### データベース最適化

#### PostgreSQL設定調整

```bash
# postgresql.conf 主要設定項目
cat > /opt/gantt/postgres/postgresql.conf << 'EOF'
# Memory Configuration
shared_buffers = 256MB                    # システムメモリの25%
effective_cache_size = 1GB                # システムメモリの75%
work_mem = 4MB                           # ソート/ハッシュ操作用メモリ
maintenance_work_mem = 64MB               # VACUUM, CREATE INDEX用

# Connection Configuration
max_connections = 200                     # 最大接続数
superuser_reserved_connections = 3

# WAL Configuration
wal_level = replica                       # レプリケーション対応
max_wal_size = 1GB
min_wal_size = 80MB
checkpoint_completion_target = 0.9

# Query Performance
random_page_cost = 1.1                    # SSD向け調整
effective_io_concurrency = 200            # SSD向け調整

# Logging
log_statement = 'mod'                     # DML/DDL ログ
log_min_duration_statement = 1000         # 1秒以上のクエリログ
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Autovacuum
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min
EOF
```

#### 定期メンテナンス

```bash
# データベース最適化スクリプト
cat > /opt/gantt/db-maintenance.sh << 'EOF'
#!/bin/bash

DB_CONTAINER="gantt_postgres_prod"
DB_USER="gantt_prod_user"
DB_NAME="gantt_production"

# 統計情報更新
docker exec $DB_CONTAINER psql -U $DB_USER $DB_NAME -c "ANALYZE;"

# バキューム実行
docker exec $DB_CONTAINER psql -U $DB_USER $DB_NAME -c "VACUUM ANALYZE;"

# クエリ統計リセット（月次）
if [ $(date +%d) -eq 01 ]; then
    docker exec $DB_CONTAINER psql -U $DB_USER $DB_NAME -c "SELECT pg_stat_statements_reset();"
fi
EOF

chmod +x /opt/gantt/db-maintenance.sh

# 週次実行
echo "0 4 * * 0 /opt/gantt/db-maintenance.sh" | crontab -
```

### アプリケーション最適化

#### Node.js パフォーマンス設定

```bash
# .env.production.local 追加設定
NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"
UV_THREADPOOL_SIZE=16                     # ファイルI/O最適化

# Backend プロセス最適化
PM2_INSTANCES=2                          # CPU使用率向上
PM2_EXEC_MODE=cluster
```

---

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. データベース接続エラー

**症状**: "database connection failed" エラー

```bash
# 原因調査
./scripts/deploy-production.sh logs postgres

# 接続数確認
docker exec gantt_postgres_prod \
  psql -U gantt_prod_user gantt_production -c "
    SELECT count(*) as connection_count 
    FROM pg_stat_activity 
    WHERE state = 'active';
  "

# 解決方法
# 1. PostgreSQL再起動
docker compose -f infra/docker-compose.production.yml restart postgres

# 2. 接続プール設定調整
# .env.production.local
DATABASE_URL="...&connection_limit=10&pool_timeout=30"
```

#### 2. Nginx 502 Bad Gateway

**症状**: フロントエンド画面表示エラー

```bash
# 原因調査
./scripts/deploy-production.sh logs nginx
./scripts/deploy-production.sh logs backend

# Backend接続確認
curl -f http://backend:3002/health

# 解決方法
# 1. Backend再起動
docker compose -f infra/docker-compose.production.yml restart backend

# 2. Nginx設定確認
docker exec gantt_nginx_prod nginx -t

# 3. ポート競合確認
netstat -tlnp | grep 3002
```

#### 3. ディスク容量不足

**症状**: "No space left on device" エラー

```bash
# 容量確認
df -h
du -sh /opt/gantt/data/*
du -sh /var/lib/docker/*

# 解決方法
# 1. 未使用Dockerリソース削除
docker system prune -af
docker volume prune -f

# 2. 古いログ削除
find /opt/gantt/logs -name "*.log" -mtime +7 -delete
journalctl --vacuum-time=7d

# 3. 古いバックアップ削除
find /opt/gantt/backups -type d -mtime +30 -exec rm -rf {} +
```

### パフォーマンス問題

#### 1. 応答時間遅延

```bash
# API応答時間測定
time curl -f https://gantt.yourdomain.com/projects

# データベースクエリ分析
docker exec gantt_postgres_prod \
  psql -U gantt_prod_user gantt_production -c "
    SELECT query, mean_time, calls 
    FROM pg_stat_statements 
    ORDER BY mean_time DESC LIMIT 10;
  "

# Nginx アクセスログ分析
awk '{print $NF}' /opt/gantt/logs/nginx/access.log | sort -n | tail -20
```

### 緊急時対応手順

#### 1. サービス全停止

```bash
# 緊急停止
./scripts/deploy-production.sh stop

# 強制停止
docker compose -f infra/docker-compose.production.yml kill
docker compose -f infra/docker-compose.production.yml down -v
```

#### 2. 緊急バックアップ

```bash
# 最小限バックアップ
backup_dir="/tmp/emergency_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

# データベース緊急ダンプ
docker exec gantt_postgres_prod \
  pg_dump -U gantt_prod_user gantt_production > "$backup_dir/database.sql"

# 設定ファイル保存
cp .env.production.local "$backup_dir/"
```

---

## ✅ 運用チェックリスト

### 日次運用タスク

#### 毎日実行（自動化推奨）

- [ ] **システムヘルスチェック**
  ```bash
  ./scripts/deploy-production.sh status
  curl -f https://gantt.yourdomain.com/health
  ```

- [ ] **リソース使用量確認**
  ```bash
  df -h /opt/gantt/
  docker stats --no-stream
  ```

- [ ] **エラーログ確認**
  ```bash
  ./scripts/deploy-production.sh logs | grep -i error | tail -10
  ```

- [ ] **バックアップ実行確認**
  ```bash
  ls -la /opt/gantt/backups/ | head -5
  ```

### 週次運用タスク

#### 毎週実行

- [ ] **セキュリティ更新確認**
  ```bash
  sudo apt list --upgradable | grep -i security
  ```

- [ ] **データベース最適化**
  ```bash
  /opt/gantt/db-maintenance.sh
  ```

- [ ] **SSL証明書期限確認**
  ```bash
  openssl x509 -in /opt/gantt/ssl/certs/fullchain.pem -noout -dates
  ```

### 月次運用タスク

#### 毎月実行

- [ ] **システム全体更新**
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```

- [ ] **Dockerイメージ更新**
  ```bash
  docker compose -f infra/docker-compose.production.yml pull
  ./scripts/deploy-production.sh restart
  ```

- [ ] **パフォーマンス分析レポート**
  ```bash
  # データベース統計分析
  docker exec gantt_postgres_prod \
    psql -U gantt_prod_user gantt_production -c "
      SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
      FROM pg_stat_user_tables;
    "
  ```

### インシデント対応

#### インシデントレベル定義

| レベル | 定義 | 対応時間 | 通知方法 |
|--------|------|----------|----------|
| P1 (重大) | サービス全停止、データ損失 | 15分以内 | SMS + 電話 |
| P2 (高) | 一部機能停止、性能大幅劣化 | 1時間以内 | SMS + メール |
| P3 (中) | 軽微な機能不具合 | 4時間以内 | メール |
| P4 (低) | 改善要望、質問 | 24時間以内 | チケット |

#### P1インシデント対応フロー

```bash
# 1. 即座にサービス状態確認（5分以内）
./scripts/deploy-production.sh status
curl -f https://gantt.yourdomain.com/health

# 2. 緊急バックアップ実行
./scripts/deploy-production.sh backup

# 3. ログ分析・原因特定
./scripts/deploy-production.sh logs | grep -i error
journalctl -u docker --since "1 hour ago"

# 4. 対応実施
# - サービス再起動
# - 設定修正
# - ロールバック
# 状況に応じて適切な対応を選択

# 5. 復旧確認
./scripts/deploy-production.sh status
curl -f https://gantt.yourdomain.com/health
```

---

## 🆘 サポート・参考資料

### システム情報収集スクリプト

問題報告時の情報収集用：

```bash
# システム情報収集スクリプト
cat > /opt/gantt/collect-support-info.sh << 'EOF'
#!/bin/bash

SUPPORT_DIR="/tmp/gantt-support-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$SUPPORT_DIR"

echo "Collecting system information..."

# システム基本情報
uname -a > "$SUPPORT_DIR/system-info.txt"
docker --version >> "$SUPPORT_DIR/system-info.txt"
docker compose version >> "$SUPPORT_DIR/system-info.txt"

# サービス状態
./scripts/deploy-production.sh status > "$SUPPORT_DIR/service-status.txt"

# リソース使用状況
docker stats --no-stream > "$SUPPORT_DIR/resource-usage.txt"
df -h >> "$SUPPORT_DIR/resource-usage.txt"
free -h >> "$SUPPORT_DIR/resource-usage.txt"

# 設定ファイル（機密情報マスク）
cp .env.production.local "$SUPPORT_DIR/env-config.txt"
sed -i 's/PASSWORD=.*/PASSWORD=***MASKED***/g' "$SUPPORT_DIR/env-config.txt"
sed -i 's/SECRET=.*/SECRET=***MASKED***/g' "$SUPPORT_DIR/env-config.txt"

# ログファイル（最新100行）
./scripts/deploy-production.sh logs --tail=100 > "$SUPPORT_DIR/application-logs.txt"

# ネットワーク情報
netstat -tlnp > "$SUPPORT_DIR/network-status.txt"

echo "Support information collected in: $SUPPORT_DIR"
echo "Please compress and send this directory to the support team."
EOF

chmod +x /opt/gantt/collect-support-info.sh
```

### 設定検証スクリプト

```bash
# 設定検証スクリプト
cat > /opt/gantt/config-validation.sh << 'EOF'
#!/bin/bash

echo "=== GanttChart WebUI Configuration Validation ==="

# 1. 必須ファイル存在確認
FILES=(
    ".env.production.local"
    "infra/docker-compose.production.yml"
    "infra/nginx/nginx.production.conf"
    "scripts/deploy-production.sh"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✓ $file exists"
    else
        echo "✗ $file missing"
    fi
done

# 2. セキュリティ設定確認
if grep -q "CHANGE_ME" .env.production.local; then
    echo "✗ Default passwords detected in .env.production.local"
else
    echo "✓ No default passwords found"
fi

# 3. SSL証明書確認
if [ -f "/opt/gantt/ssl/certs/fullchain.pem" ]; then
    echo "✓ SSL certificate exists"
    openssl x509 -in /opt/gantt/ssl/certs/fullchain.pem -noout -dates
else
    echo "✗ SSL certificate missing"
fi

# 4. ディレクトリ権限確認
if [ -w "/opt/gantt/data" ]; then
    echo "✓ Data directory writable"
else
    echo "✗ Data directory permission issue"
fi

echo "=== Validation completed ==="
EOF

chmod +x /opt/gantt/config-validation.sh
```

### 連絡先・エスカレーション

**緊急連絡先**:
- **システム管理者**: admin@yourdomain.com
- **開発チーム**: dev-team@yourdomain.com
- **24時間サポート**: +81-XX-XXXX-XXXX

**外部サポート**:
- **インフラ・クラウド**: [クラウドプロバイダーサポート]
- **データベース**: PostgreSQL Community / Commercial Support
- **Webサーバー**: Nginx Community Support

---

**重要**: 本ガイドの設定を本番環境に適用する前に、必ずステージング環境でテストを実施し、セキュリティ設定を組織のポリシーに合わせて調整してください。

**最終更新**: 2024年1月11日  
**バージョン**: 1.0.0  
**対象システム**: GanttChart WebUI v2.0.0以降