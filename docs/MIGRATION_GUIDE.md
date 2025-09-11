# GanttChart WebUI - 移行ガイド

本ドキュメントは、GanttChart WebUIの安全で効率的な移行作業を実施するための包括ガイドです。システム管理者・DevOpsエンジニアが自信を持って移行を実行できる実践的な手順を提供します。

## 📋 目次

- [概要](#概要)
- [移行シナリオ](#移行シナリオ)
- [環境別設定差異](#環境別設定差異)
- [データ移行手順](#データ移行手順)
- [ダウンタイム最小化戦略](#ダウンタイム最小化戦略)
- [ロールバック手順](#ロールバック手順)
- [移行チェックリスト](#移行チェックリスト)
- [緊急時対応](#緊急時対応)

---

## 🎯 概要

### 対象移行シナリオ

1. **新規環境構築**: 開発 → ステージング → 本番
2. **バージョンアップグレード**: v1.x.x → v2.0.0
3. **サーバー移行**: 別サーバー・別インフラへの移行
4. **災害復旧**: バックアップからの完全復旧

### 技術スタック

- **Backend**: NestJS + TypeScript + Prisma ORM + PostgreSQL + Socket.IO
- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **インフラ**: Docker Compose + Nginx + PostgreSQL 15

### 移行前提条件

- Docker 24.0以上・Docker Compose 2.0以上
- 移行先サーバーの十分なリソース（CPU: 4コア, Memory: 8GB, Storage: 50GB以上）
- 適切なバックアップが存在すること
- 移行計画と承認プロセスが完了していること

---

## 🔄 移行シナリオ

### 1. 新規環境構築移行

**開発環境 → ステージング環境 → 本番環境**

```bash
# 1. 開発環境からの設定・データエクスポート
cd /path/to/GanttChartWebUI
./scripts/backup-database.sh -t migration -e

# 2. ステージング環境構築
git clone https://github.com/yourdomain/GanttChartWebUI.git /opt/gantt-staging
cd /opt/gantt-staging

# 環境設定
cp .env .env.staging.local
# .env.staging.local を編集（ポート変更等）
sed -i 's/POSTGRES_DB=gantt_production/POSTGRES_DB=gantt_staging/g' .env.staging.local
sed -i 's/NGINX_PORT=80/NGINX_PORT=8080/g' .env.staging.local

# 3. ステージング環境でのテスト
./scripts/deploy-production.sh start
./scripts/restore-database.sh /opt/gantt/backups/latest/gantt_migration_*.tar.gz

# 4. 検証合格後、本番環境へ展開
```

### 2. バージョンアップグレード移行

**v1.x.x → v2.0.0への段階的アップグレード**

```bash
# 1. 現行バージョンのフルバックアップ
./scripts/backup-database.sh -t pre_upgrade -e

# 2. メンテナンスモード開始
# Nginxでメンテナンス画面表示設定
cp infra/nginx/maintenance.conf infra/nginx/nginx.production.conf
docker compose -f infra/docker-compose.production.yml exec nginx nginx -s reload

# 3. 新バージョン準備（Blue-Green）
git fetch origin && git checkout v2.0.0
docker compose -f infra/docker-compose.production.yml pull

# 4. データベースマイグレーション
docker compose -f infra/docker-compose.production.yml exec backend \
  npx prisma migrate deploy

# 5. アプリケーション更新
docker compose -f infra/docker-compose.production.yml up -d --force-recreate

# 6. 検証・メンテナンスモード解除
curl -f http://localhost/health
cp infra/nginx/nginx.production.conf.backup infra/nginx/nginx.production.conf
docker compose -f infra/docker-compose.production.yml exec nginx nginx -s reload
```

### 3. サーバー間移行

**Server A → Server B への完全移行**

```bash
# === Server A (移行元) ===
# 1. 移行用完全バックアップ作成
./scripts/backup-database.sh -t migration -e  # 暗号化バックアップ

# 2. バックアップファイルの移行先転送
rsync -avz --progress /opt/gantt/backups/ user@server-b:/tmp/gantt-migration/

# === Server B (移行先) ===
# 3. 環境構築
sudo mkdir -p /opt/gantt/{data,logs,backups}
git clone https://github.com/yourdomain/GanttChartWebUI.git /opt/gantt-app
cd /opt/gantt-app

# 4. 設定調整
cp .env .env.production.local
# DNS・ドメイン設定を新サーバー用に調整
sed -i 's/NEXT_PUBLIC_API_URL=.*/NEXT_PUBLIC_API_URL=https:\/\/new-gantt.yourdomain.com/g' .env.production.local

# 5. SSL証明書設定
sudo certbot certonly --standalone -d new-gantt.yourdomain.com

# 6. データ復元
./scripts/restore-database.sh /tmp/gantt-migration/gantt_migration_*.tar.gz.gpg

# 7. DNS切り替え・動作確認
./scripts/deploy-production.sh start
./scripts/deploy-production.sh health
```

### 4. 災害復旧移行

**バックアップからの完全復旧**

```bash
# 1. 新環境の緊急構築
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# 2. プロジェクト復元
git clone https://github.com/yourdomain/GanttChartWebUI.git
cd GanttChartWebUI

# 3. 最新バックアップからの復旧
./scripts/restore-database.sh -f /backup/location/latest_backup.tar.gz

# 4. 緊急公開
./scripts/deploy-production.sh start

# 5. 動作確認・ユーザー通知
curl -f http://localhost/health
```

---

## ⚙️ 環境別設定差異

### 1. Docker Compose設定比較

| 設定項目 | 開発環境 | ステージング | 本番環境 |
|----------|----------|-------------|----------|
| **コンテナ名** | gantt_*_dev | gantt_*_stg | gantt_*_prod |
| **ポート** | 3000, 3001 | 8000, 8001 | 80, 443 |
| **リソース制限** | なし | 制限あり | 厳格な制限 |
| **ヘルスチェック** | 簡単 | 通常 | 強化 |
| **ログレベル** | debug | info | info/warn |
| **データ永続化** | 一時的 | 永続化 | 完全永続化 |

```yaml
# 開発環境（docker-compose.yml）
services:
  postgres:
    container_name: gantt_postgres_dev
    ports:
      - "5432:5432"
    # リソース制限なし

# ステージング環境（docker-compose.staging.yml）
services:
  postgres:
    container_name: gantt_postgres_stg
    ports:
      - "15432:5432"
    deploy:
      resources:
        limits:
          memory: 1G

# 本番環境（docker-compose.production.yml）
services:
  postgres:
    container_name: gantt_postgres_prod
    # 外部ポート公開なし
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

### 2. 環境変数差異

| 項目 | 開発環境 | ステージング | 本番環境 |
|------|----------|-------------|----------|
| **NODE_ENV** | development | staging | production |
| **LOG_LEVEL** | debug | info | info |
| **AUTH_TYPE** | password | password | password |
| **DATABASE_URL** | localhost | staging-db | postgres |
| **RATE_LIMIT** | 無制限 | 緩い制限 | 厳格な制限 |

```bash
# 開発環境 (.env)
NODE_ENV=development
AUTH_TYPE=password
LOG_LEVEL=debug
DATABASE_URL="postgresql://gantt_user:gantt_password@localhost:5432/gantt_db"
RATE_LIMIT_RPM=0

# ステージング環境 (.env.staging.local)
NODE_ENV=staging
AUTH_TYPE=password
LOG_LEVEL=info
DATABASE_URL="postgresql://gantt_stg_user:secure_password@postgres:5432/gantt_staging"
NEXT_PUBLIC_API_URL=https://staging.gantt.yourdomain.com
RATE_LIMIT_RPM=500

# 本番環境 (.env.production.local)
NODE_ENV=production
AUTH_TYPE=password
LOG_LEVEL=info
DATABASE_URL="postgresql://gantt_prod_user:CHANGE_ME_SECURE_PASSWORD_123@postgres:5432/gantt_production"
NEXT_PUBLIC_API_URL=https://gantt.yourdomain.com
RATE_LIMIT_RPM=1000
```

### 3. セキュリティ設定差異

```bash
# 開発環境：セキュリティ無効化
security_opt: []
user: root

# ステージング環境：基本セキュリティ
security_opt:
  - no-new-privileges:true
user: "1001:1001"

# 本番環境：強化セキュリティ
security_opt:
  - no-new-privileges:true
  - seccomp:unconfined
user: "nestjs:nodejs"
read_only: true  # 一部サービス
```

---

## 💾 データ移行手順

### 1. 移行前データ評価

```bash
# データベースサイズ確認
docker compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user gantt_production -c "
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_stat_get_tuples_returned(oid) as tuples
  FROM pg_tables t, pg_class c 
  WHERE t.tablename = c.relname 
  AND schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# アップロードファイルサイズ確認
du -sh /opt/gantt/data/uploads/*
find /opt/gantt/data/uploads -type f -name "*.jpg" -o -name "*.png" -o -name "*.pdf" | wc -l

# 予想移行時間計算（例：100MB = 約2分）
```

### 2. PostgreSQLデータ移行

#### 2.1 自動バックアップスクリプト使用（推奨）

```bash
# 1. 統合バックアップ実行
./scripts/backup-database.sh -t migration -e -v

# 生成されるファイル構造
/opt/gantt/backups/ganttchart_migration_20240111_020000/
├── database.backup          # PostgreSQLダンプ
├── uploads.tar.gz          # アップロードファイル
├── logs.tar.gz            # ログファイル
└── configs/               # 設定ファイル
    ├── .env.production.local
    ├── docker-compose.production.yml
    └── nginx/nginx.production.conf
```

#### 2.2 移行先でのデータ復元

```bash
# 1. 移行先環境準備
sudo mkdir -p /opt/gantt/{data,logs,backups}
sudo chown -R $USER:docker /opt/gantt/

# 2. アプリケーション配置
git clone https://github.com/yourdomain/GanttChartWebUI.git
cd GanttChartWebUI

# 3. 移行先固有設定
cp .env .env.production.local
# ドメイン・ポート・認証情報を移行先用に調整

# 4. データベース復元
./scripts/restore-database.sh -v /backup/location/ganttchart_migration_*.tar.gz

# 5. データ整合性確認
docker compose -f infra/docker-compose.production.yml exec postgres \
  psql -U gantt_prod_user gantt_production -c "
    SELECT COUNT(*) as projects FROM \"Project\" WHERE is_deleted = false;
    SELECT COUNT(*) as issues FROM \"Issue\" WHERE is_deleted = false;
    SELECT COUNT(*) as comments FROM \"Comment\" WHERE is_deleted = false;
  "
```

### 3. ファイルデータ移行

```bash
# 1. アップロードファイル移行
rsync -avz --progress /opt/gantt/data/uploads/ \
  user@new-server:/opt/gantt/data/uploads/

# 2. 権限調整
sudo chown -R 1001:1001 /opt/gantt/data/uploads/
sudo chmod -R 755 /opt/gantt/data/uploads/

# 3. ファイル整合性確認
find /opt/gantt/data/uploads -type f -exec md5sum {} \; > /tmp/file_checksums.txt
# 移行先でも同じチェックサムを実行して比較
```

### 4. データ整合性確認

```bash
# データベース統計比較スクリプト
cat > migration_verification.sh << 'EOF'
#!/bin/bash

SOURCE_DB="source-server"
TARGET_DB="target-server"

echo "=== Migration Verification ==="

# テーブル行数比較
for table in "Project" "Issue" "Comment" "User"; do
    echo "Checking table: $table"
    
    source_count=$(ssh $SOURCE_DB "docker compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user gantt_production -t -c \"SELECT COUNT(*) FROM \\\"$table\\\" WHERE is_deleted = false;\"" | tr -d ' ')
    target_count=$(ssh $TARGET_DB "docker compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user gantt_production -t -c \"SELECT COUNT(*) FROM \\\"$table\\\" WHERE is_deleted = false;\"" | tr -d ' ')
    
    if [ "$source_count" = "$target_count" ]; then
        echo "✓ $table: $source_count records (MATCH)"
    else
        echo "✗ $table: Source=$source_count, Target=$target_count (MISMATCH)"
    fi
done

# ファイル数比較
source_files=$(ssh $SOURCE_DB "find /opt/gantt/data/uploads -type f | wc -l")
target_files=$(ssh $TARGET_DB "find /opt/gantt/data/uploads -type f | wc -l")

if [ "$source_files" = "$target_files" ]; then
    echo "✓ Upload files: $source_files files (MATCH)"
else
    echo "✗ Upload files: Source=$source_files, Target=$target_files (MISMATCH)"
fi
EOF

chmod +x migration_verification.sh
./migration_verification.sh
```

---

## 🚀 ダウンタイム最小化戦略

### 1. Blue-Green デプロイメント

#### 準備フェーズ

```bash
# 1. Green環境構築（Blue環境と並行稼働）
cp .env .env.green.local
sed -i 's/gantt_production/gantt_production_green/g' .env.green.local
sed -i 's/:80/:8080/g' .env.green.local
sed -i 's/:443/:8443/g' .env.green.local

# 2. Green環境でのデータベース準備
docker compose -f infra/docker-compose.production.yml \
  --env-file .env.green.local up -d postgres

# 3. データ同期（読み取り専用レプリカ経由）
./scripts/backup-database.sh -t pre_switch
./scripts/restore-database.sh -f /opt/gantt/backups/ganttchart_pre_switch_*.tar.gz \
  --env-file .env.green.local
```

#### 切り替えフェーズ（ダウンタイム: 30秒-2分）

```bash
# 1. Blue環境メンテナンスモード（30秒）
cp infra/nginx/maintenance.conf infra/nginx/nginx.production.conf
docker compose -f infra/docker-compose.production.yml exec nginx nginx -s reload

# 2. 最終データ同期（30秒-1分）
./scripts/backup-database.sh -t final_switch
./scripts/restore-database.sh -f /opt/gantt/backups/ganttchart_final_switch_*.tar.gz \
  --env-file .env.green.local

# 3. DNS/LB切り替え（30秒）
# Nginx upstream設定変更
sed -i 's/backend:3002/backend_green:3002/g' infra/nginx/nginx.production.conf
docker compose -f infra/docker-compose.production.yml exec nginx nginx -s reload

# 4. Blue環境停止
docker compose -f infra/docker-compose.production.yml \
  --env-file .env down
```

### 2. ローリングアップデート

#### 段階的コンテナ更新

```bash
# 1. データベース更新（ゼロダウンタイム）
docker compose -f infra/docker-compose.production.yml up -d postgres
# データベースマイグレーション実行

# 2. Backend更新（1台ずつ）
for instance in backend; do
    docker compose -f infra/docker-compose.production.yml stop $instance
    docker compose -f infra/docker-compose.production.yml up -d $instance
    # ヘルスチェック待機
    sleep 30
    curl -f http://localhost/health || exit 1
done

# 3. Frontend更新（ロードバランサー経由）
docker compose -f infra/docker-compose.production.yml up -d frontend

# 4. Nginx設定リロード（ゼロダウンタイム）
docker compose -f infra/docker-compose.production.yml exec nginx nginx -s reload
```

### 3. データ同期手順

#### リアルタイム同期対応

```bash
# 1. データベースレプリケーション設定
# postgresql.conf
cat > infra/postgres/postgresql.conf << 'EOF'
wal_level = logical
max_replication_slots = 4
max_wal_senders = 4
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
EOF

# 2. 論理レプリケーション設定
docker compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user gantt_production -c "
  CREATE PUBLICATION gantt_pub FOR ALL TABLES;
"

# 移行先
docker compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user gantt_production -c "
  CREATE SUBSCRIPTION gantt_sub 
  CONNECTION 'host=source-server port=5432 user=gantt_prod_user dbname=gantt_production password=CHANGE_ME_SECURE_PASSWORD_123'
  PUBLICATION gantt_pub;
"

# 3. ファイル同期（rsync）
while true; do
    rsync -avz --delete /opt/gantt/data/uploads/ \
      user@target-server:/opt/gantt/data/uploads/
    sleep 300  # 5分間隔
done
```

---

## 🔄 ロールバック手順

### 1. 緊急ロールバック（5分以内）

#### アプリケーションロールバック

```bash
# 1. 即座に前バージョンに切り戻し
git checkout $(git describe --tags --abbrev=0 HEAD^)  # 前のタグ

# 2. 前バージョンイメージで起動
docker compose -f infra/docker-compose.production.yml down
docker compose -f infra/docker-compose.production.yml up -d

# 3. ヘルスチェック
timeout 60 bash -c 'until curl -f http://localhost/health; do sleep 2; done'
echo "Rollback completed in $(($SECONDS))s"
```

#### DNS緊急切り戻し

```bash
# 1. 旧環境の緊急復旧
ssh old-server "./scripts/deploy-production.sh start"

# 2. DNS切り替え（TTL=60秒の場合）
# DNSプロバイダーで旧IPに戻す

# 3. ロードバランサー切り戻し
# HAProxy/Nginx upstream設定変更
```

### 2. データベースロールバック

#### スナップショットロールバック

```bash
# 1. 移行前バックアップ特定
ROLLBACK_BACKUP="/opt/gantt/backups/ganttchart_pre_migration_20240111_020000.tar.gz"

# 2. 現在データの緊急バックアップ
./scripts/backup-database.sh -t emergency_before_rollback

# 3. ロールバック実行
./scripts/restore-database.sh -f "$ROLLBACK_BACKUP"

# 4. 整合性確認
docker compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user gantt_production -c "
  SELECT COUNT(*) as projects FROM \"Project\" WHERE is_deleted = false;
"
```

### 3. 段階的ロールバック検証

```bash
# ロールバック検証スクリプト
cat > rollback_verification.sh << 'EOF'
#!/bin/bash

echo "=== Rollback Verification ==="

# 1. サービス稼働確認
if curl -f http://localhost/health; then
    echo "✓ Application health check passed"
else
    echo "✗ Application health check failed"
    exit 1
fi

# 2. データベース接続確認
if docker compose -f infra/docker-compose.production.yml exec postgres pg_isready -U gantt_prod_user -d gantt_production; then
    echo "✓ Database connection verified"
else
    echo "✗ Database connection failed"
    exit 1
fi

# 3. 主要機能確認
project_count=$(docker compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user gantt_production -t -c \
  "SELECT COUNT(*) FROM \"Project\" WHERE is_deleted = false;" | tr -d ' ')

if [ "$project_count" -gt 0 ]; then
    echo "✓ Projects available: $project_count"
else
    echo "✗ No projects found"
    exit 1
fi

# 4. ファイルアクセス確認
if [ -d "/opt/gantt/data/uploads" ] && [ "$(ls -A /opt/gantt/data/uploads)" ]; then
    file_count=$(find /opt/gantt/data/uploads -type f | wc -l)
    echo "✓ Upload files accessible: $file_count files"
else
    echo "! No upload files found (may be expected)"
fi

echo "=== Rollback verification completed ==="
EOF

chmod +x rollback_verification.sh
./rollback_verification.sh
```

---

## ✅ 移行チェックリスト

### 移行前準備（T-7日）

#### インフラ・環境準備

- [ ] **移行先サーバー準備完了**
  ```bash
  # システム要件確認
  lscpu | grep "CPU(s)"
  free -h
  df -h
  ```

- [ ] **Docker環境構築**
  ```bash
  docker --version  # 24.0以上
  docker compose version  # 2.0以上
  ```

- [ ] **ネットワーク・DNS設定**
  ```bash
  nslookup gantt.yourdomain.com
  telnet gantt.yourdomain.com 443
  ```

- [ ] **SSL証明書準備**
  ```bash
  sudo certbot certonly --standalone -d gantt.yourdomain.com
  openssl x509 -in /etc/letsencrypt/live/gantt.yourdomain.com/fullchain.pem -text -noout
  ```

#### データ・バックアップ準備

- [ ] **完全バックアップ作成**
  ```bash
  ./scripts/backup-database.sh -t pre_migration -e
  ```

- [ ] **バックアップ検証**
  ```bash
  # テスト環境での復元確認
  ./scripts/restore-database.sh -n backup.tar.gz.gpg
  ```

- [ ] **移行データサイズ計算**
  ```bash
  du -sh /opt/gantt/data/*
  # 予想移行時間算出
  ```

### 移行実行（T-day）

#### 移行前最終確認（T-2時間）

- [ ] **サービス正常性確認**
  ```bash
  curl -f https://gantt.yourdomain.com/health
  docker compose -f infra/docker-compose.production.yml ps --filter "status=running"
  ```

- [ ] **ユーザー通知実施**
  - メンテナンス通知配信
  - 社内チャット通知
  - Webサイトメンテナンス表示

- [ ] **移行チーム招集**
  - システム管理者
  - DevOpsエンジニア
  - アプリケーション担当者

#### 移行実行フェーズ（T-0時間）

- [ ] **メンテナンスモード開始**
  ```bash
  # Nginx設定でメンテナンス画面表示
  cp infra/nginx/maintenance.conf infra/nginx/nginx.production.conf
  docker compose -f infra/docker-compose.production.yml exec nginx nginx -s reload
  ```

- [ ] **最終データバックアップ**
  ```bash
  ./scripts/backup-database.sh -t final_migration
  ```

- [ ] **移行先環境構築**
  ```bash
  cd /opt/gantt-new
  git clone https://github.com/yourdomain/GanttChartWebUI.git .
  cp .env .env.production.local
  # 移行先固有設定調整
  ```

- [ ] **データ移行実行**
  ```bash
  ./scripts/restore-database.sh -v /opt/gantt/backups/ganttchart_final_migration_*.tar.gz
  ```

- [ ] **アプリケーション起動**
  ```bash
  ./scripts/deploy-production.sh start
  ```

#### 移行後検証（T+30分）

- [ ] **サービス稼働確認**
  ```bash
  curl -f https://gantt.yourdomain.com/health
  curl -f https://gantt.yourdomain.com/projects
  ```

- [ ] **データ整合性確認**
  ```bash
  ./migration_verification.sh
  ```

- [ ] **パフォーマンステスト**
  ```bash
  ab -n 100 -c 10 https://gantt.yourdomain.com/
  ```

- [ ] **機能テスト実施**
  - ログイン・ログアウト
  - プロジェクト作成・編集
  - Issue作成・ガントチャート表示
  - ファイルアップロード

### 移行完了（T+1時間）

#### 本格運用開始

- [ ] **メンテナンスモード解除**
  ```bash
  cp infra/nginx/nginx.production.conf.backup infra/nginx/nginx.production.conf
  docker compose -f infra/docker-compose.production.yml exec nginx nginx -s reload
  ```

- [ ] **ユーザー通知（復旧完了）**
  - メンテナンス完了通知
  - 新機能案内（バージョンアップ時）

- [ ] **監視設定確認**
  ```bash
  # ログ監視・アラート設定
  tail -f /opt/gantt/logs/app/backend.log | grep -i error &
  ```

- [ ] **バックアップスケジュール再開**
  ```bash
  crontab -l | grep backup-database.sh
  ```

### 移行後監視（T+24時間）

#### 安定稼働確認

- [ ] **リソース使用量監視**
  ```bash
  docker stats --no-stream
  df -h /opt/gantt/
  ```

- [ ] **エラーログ確認**
  ```bash
  grep -i error /opt/gantt/logs/app/* | tail -20
  ```

- [ ] **ユーザーフィードバック収集**
  - 不具合報告チェック
  - パフォーマンス改善要望確認

- [ ] **旧環境クリーンアップ**
  ```bash
  # 1週間後の実施を推奨
  # docker system prune -af
  # rm -rf /opt/gantt-old/
  ```

---

## 🆘 緊急時対応

### 緊急事態分類

| レベル | 定義 | 対応時間 | 対応方法 |
|--------|------|----------|----------|
| **P1 (Critical)** | サービス全停止 | 15分以内 | 即座にロールバック |
| **P2 (High)** | 機能一部停止 | 1時間以内 | 段階的復旧 |
| **P3 (Medium)** | 性能劣化 | 4時間以内 | 調査・調整 |
| **P4 (Low)** | 軽微な不具合 | 24時間以内 | 計画的修正 |

### P1緊急対応手順

#### サービス全停止（15分以内対応）

```bash
# === 緊急対応フローチャート ===
# 1. 症状確認（2分）
curl -f https://gantt.yourdomain.com/health || echo "SERVICE DOWN"
docker compose -f infra/docker-compose.production.yml ps --filter "status=unhealthy"

# 2. 即座にロールバック決定（1分）
echo "EMERGENCY ROLLBACK INITIATED at $(date)"

# 3. 前バージョンに切り戻し（10分）
cd /opt/gantt-rollback  # 事前に準備された環境
./scripts/deploy-production.sh start

# 4. 動作確認（2分）
curl -f https://gantt.yourdomain.com/health
echo "ROLLBACK COMPLETED at $(date)"

# 5. 関係者通知
echo "Emergency rollback completed. Service restored." | \
  mail -s "URGENT: Service Restored" ops-team@company.com
```

#### データベース障害対応

```bash
# 1. 症状特定
docker compose -f infra/docker-compose.production.yml exec postgres pg_isready || echo "DB DOWN"

# 2. 最新バックアップから復旧
LATEST_BACKUP=$(ls -t /opt/gantt/backups/ganttchart_*/ | head -n1)
./scripts/restore-database.sh -f "$LATEST_BACKUP"

# 3. データ整合性確認
docker compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user gantt_production -c "
  SELECT COUNT(*) FROM \"Project\" WHERE is_deleted = false;
"
```

### 緊急連絡体制

#### エスカレーション手順

```bash
# 緊急連絡スクリプト
cat > emergency_notification.sh << 'EOF'
#!/bin/bash

SEVERITY="$1"
MESSAGE="$2"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

case "$SEVERITY" in
    "P1")
        # SMS + 電話 + Slack
        echo "$MESSAGE" | mail -s "P1 CRITICAL: GanttChart Service" ops-team@company.com
        curl -X POST "$SLACK_WEBHOOK_URL" -d "{\"text\":\"🚨 P1 CRITICAL: $MESSAGE\"}"
        ;;
    "P2")
        # Slack + メール
        echo "$MESSAGE" | mail -s "P2 HIGH: GanttChart Service" ops-team@company.com
        curl -X POST "$SLACK_WEBHOOK_URL" -d "{\"text\":\"⚠️ P2 HIGH: $MESSAGE\"}"
        ;;
esac
EOF

chmod +x emergency_notification.sh

# 使用例
./emergency_notification.sh "P1" "Service completely down - initiating rollback"
```

### 災害復旧計画

#### 完全災害時の復旧手順

```bash
# === 災害復旧シナリオ ===
# 前提：メインサーバー完全障害、バックアップサーバーで復旧

# 1. 緊急サーバー立ち上げ（30分）
# AWS/GCP等のクラウドでインスタンス作成

# 2. 基本環境構築（30分）
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# 3. アプリケーション配置（15分）
git clone https://github.com/yourdomain/GanttChartWebUI.git
cd GanttChartWebUI

# 4. 最新バックアップから復旧（60分）
# 外部ストレージ（S3等）から最新バックアップ取得
aws s3 cp s3://gantt-backups/latest/ . --recursive
./scripts/restore-database.sh -f ganttchart_latest_backup.tar.gz

# 5. 緊急DNS切り替え（15分）
# Route53等でDNSを緊急サーバーに向ける

# 6. サービス開始（15分）
./scripts/deploy-production.sh start
curl -f https://gantt.yourdomain.com/health

# 総復旧時間目標：3時間以内
```

#### RPO/RTO目標

| 指標 | 目標値 | 測定方法 |
|------|--------|----------|
| **RPO** (Recovery Point Objective) | 1時間 | 最新バックアップからのデータ損失 |
| **RTO** (Recovery Time Objective) | 3時間 | 障害検知からサービス復旧まで |
| **MTTR** (Mean Time To Recovery) | 30分 | P1障害の平均復旧時間 |

---

## 📊 移行後検証・最適化

### パフォーマンステスト

```bash
# 1. 負荷テスト実行
cat > performance_test.sh << 'EOF'
#!/bin/bash

URL="https://gantt.yourdomain.com"
RESULTS_DIR="/opt/gantt/performance-results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "Starting performance test for $URL"

# API負荷テスト
ab -n 1000 -c 20 "$URL/projects" > "$RESULTS_DIR/api_load.txt"

# ページ読み込みテスト
ab -n 100 -c 5 "$URL/" > "$RESULTS_DIR/page_load.txt"

# WebSocket接続テスト
timeout 10s curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     -H "Sec-WebSocket-Version: 13" \
     "$URL/socket.io/" > "$RESULTS_DIR/websocket.txt" 2>&1

echo "Performance test completed. Results in $RESULTS_DIR"
EOF

chmod +x performance_test.sh
./performance_test.sh
```

### 監視設定確認

```bash
# システム監視設定
cat > monitoring_setup.sh << 'EOF'
#!/bin/bash

# 1. ログ監視設定
echo "Setting up log monitoring..."
cat > /etc/logrotate.d/gantt-webui << EOL
/opt/gantt/logs/*/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    create 644 root root
}
EOL

# 2. アラート設定
echo "Setting up alerts..."
crontab -l | grep -v "gantt_monitoring" | (cat; echo "*/5 * * * * /opt/gantt/scripts/monitoring.sh # gantt_monitoring") | crontab -

# 3. ヘルスチェック設定
echo "Setting up health checks..."
cat > /opt/gantt/scripts/monitoring.sh << EOL
#!/bin/bash
if ! curl -f http://localhost/health > /dev/null 2>&1; then
    echo "GanttChart WebUI health check failed at \$(date)" | mail -s "Service Alert" ops-team@company.com
fi
EOL

chmod +x /opt/gantt/scripts/monitoring.sh
EOF

chmod +x monitoring_setup.sh
./monitoring_setup.sh
```

---

**移行ガイド完了**

このガイドに従って移行を実施することで、GanttChart WebUIの安全で効率的な移行が可能です。不明な点や問題が発生した場合は、[サポートチーム](mailto:support@yourdomain.com)までお問い合わせください。

**最終更新**: 2025年1月11日  
**バージョン**: 2.0.0  
**対象システム**: GanttChart WebUI v2.0.0以降