# GanttChart WebUI - プロダクション環境設定ガイド

本ドキュメントは、GanttChart WebUIをプロダクション環境で安全かつ効率的に運用するためのガイドです。

## 📋 目次

- [プロダクション環境設定ガイド](#プロダクション環境設定ガイド)
- [事前準備](#事前準備)
- [設定ファイル](#設定ファイル)
- [デプロイ手順](#デプロイ手順)
- [運用・監視](#運用監視)
- [セキュリティ対策](#セキュリティ対策)
- [パフォーマンス最適化](#パフォーマンス最適化)
- [トラブルシューティング](#トラブルシューティング)

## 🚀 事前準備

### システム要件

- **OS**: Linux (Ubuntu 20.04 LTS以上推奨)
- **CPU**: 2コア以上
- **Memory**: 4GB以上（8GB推奨）
- **Storage**: 50GB以上のSSD
- **Docker**: 24.0以上
- **Docker Compose**: 2.0以上

### 必要なソフトウェア

```bash
# Docker & Docker Compose インストール
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 必要なパッケージ
sudo apt update && sudo apt install -y curl wget unzip htop
```

## ⚙️ 設定ファイル

### 1. 環境変数設定

プロダクション用環境変数を設定：

```bash
# 環境変数テンプレートをコピー
cp .env.production .env.production.local

# 必須設定項目を変更
vim .env.production.local
```

**重要な設定項目**:

```bash
# セキュリティ（必ず変更）
POSTGRES_PASSWORD=your_secure_password_here
JWT_SECRET=your_jwt_secret_256_bit_minimum
SESSION_SECRET=your_session_secret_256_bit

# ドメイン設定
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_WS_URL=wss://your-domain.com

# SSL設定（証明書取得後）
SSL_CERT_PATH=/etc/ssl/certs/your-domain.crt
SSL_KEY_PATH=/etc/ssl/private/your-domain.key
```

### 2. データディレクトリ準備

```bash
# データディレクトリ作成
sudo mkdir -p /opt/gantt/{data/{postgres,uploads},logs/{nginx,app},backups}
sudo chown -R $USER:docker /opt/gantt/
sudo chmod -R 755 /opt/gantt/
```

### 3. SSL証明書設定（Let's Encrypt）

```bash
# Certbot インストール
sudo apt install -y certbot

# SSL証明書取得
sudo certbot certonly --standalone -d your-domain.com

# 証明書を適切な場所にコピー
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/gantt/ssl/certs/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/gantt/ssl/private/
```

## 🚀 デプロイ手順

### 1. 自動デプロイ（推奨）

```bash
# デプロイスクリプトを実行可能にする
chmod +x scripts/deploy-production.sh

# プロダクション環境開始
./scripts/deploy-production.sh start

# サービス状態確認
./scripts/deploy-production.sh status
```

### 2. 手動デプロイ

```bash
# Docker Composeでサービス起動
docker-compose -f infra/docker-compose.production.yml --env-file .env.production.local up -d

# サービス状態確認
docker-compose -f infra/docker-compose.production.yml ps

# ログ確認
docker-compose -f infra/docker-compose.production.yml logs -f
```

### 3. 初期設定確認

```bash
# ヘルスチェック
curl http://your-domain.com/health

# データベース接続確認
docker-compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user -d gantt_production -c "SELECT version();"

# アプリケーション動作確認
curl http://your-domain.com/projects
```

## 📊 運用・監視

### 1. 日次運用チェック

```bash
# システム状態確認
./scripts/deploy-production.sh status

# リソース使用状況
docker stats --no-stream

# ディスク使用量
df -h /opt/gantt/

# ログ確認
./scripts/deploy-production.sh logs | grep -i error
```

### 2. バックアップ

```bash
# データベース＋ファイルバックアップ
./scripts/deploy-production.sh backup

# バックアップ一覧確認
ls -la /opt/gantt/backups/

# 古いバックアップ削除（30日以上）
find /opt/gantt/backups/ -type d -mtime +30 -exec rm -rf {} +
```

### 3. ログローテーション設定

```bash
# /etc/logrotate.d/gantt-webui
sudo tee /etc/logrotate.d/gantt-webui << EOF
/opt/gantt/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    create 644 root root
    postrotate
        docker-compose -f /path/to/docker-compose.production.yml restart nginx
    endscript
}
EOF
```

### 4. 監視設定

**推奨監視項目**:

- CPU使用率 > 80%
- メモリ使用率 > 90%
- ディスク使用率 > 85%
- データベース接続数 > 180
- レスポンス時間 > 2秒
- エラー率 > 5%

```bash
# Prometheus + Grafana（オプション）
# 別途monitoring用docker-compose.monitoring.ymlを作成
```

## 🔒 セキュリティ対策

### 1. ファイアウォール設定

```bash
# UFW設定
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. 定期セキュリティ更新

```bash
# システムパッケージ更新
sudo apt update && sudo apt upgrade -y

# Dockerイメージ更新
docker-compose -f infra/docker-compose.production.yml pull
./scripts/deploy-production.sh restart
```

### 3. セキュリティヘッダー確認

```bash
# セキュリティヘッダーテスト
curl -I https://your-domain.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"
```

## ⚡ パフォーマンス最適化

### 1. データベース最適化

```bash
# PostgreSQL統計情報更新
docker-compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user -d gantt_production -c "ANALYZE;"

# バキューム実行（定期実行推奨）
docker-compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user -d gantt_production -c "VACUUM ANALYZE;"

# スロークエリ確認
docker-compose -f infra/docker-compose.production.yml exec postgres psql -U gantt_prod_user -d gantt_production -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

### 2. Nginx キャッシュ管理

```bash
# キャッシュ統計確認
docker-compose -f infra/docker-compose.production.yml exec nginx nginx -T | grep cache

# キャッシュクリア
docker-compose -f infra/docker-compose.production.yml exec nginx find /var/cache/nginx -type f -delete
```

### 3. リソース監視

```bash
# コンテナリソース使用状況
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# アプリケーション性能指標
curl -s http://your-domain.com/health | jq .
```

## 🔧 トラブルシューティング

### 1. よくある問題と解決方法

**問題**: PostgreSQL接続エラー
```bash
# 解決方法
docker-compose -f infra/docker-compose.production.yml restart postgres
docker-compose -f infra/docker-compose.production.yml logs postgres
```

**問題**: Nginx 502 Bad Gateway
```bash
# 解決方法
docker-compose -f infra/docker-compose.production.yml logs nginx
docker-compose -f infra/docker-compose.production.yml restart backend frontend
```

**問題**: ディスク容量不足
```bash
# 解決方法
docker system prune -af  # 未使用Dockerリソース削除
docker volume prune -f   # 未使用ボリューム削除
```

### 2. 緊急時対応

**サービス全停止**:
```bash
./scripts/deploy-production.sh stop
```

**データベース緊急バックアップ**:
```bash
docker-compose -f infra/docker-compose.production.yml exec postgres pg_dump -U gantt_prod_user gantt_production > emergency_backup_$(date +%Y%m%d_%H%M%S).sql
```

**ロールバック**:
```bash
# 前のDockerイメージに戻す
docker-compose -f infra/docker-compose.production.yml down
docker-compose -f infra/docker-compose.production.yml up -d
```

### 3. ログ調査

```bash
# エラーログ抽出
./scripts/deploy-production.sh logs | grep -i error | tail -100

# 特定時間のログ
docker-compose -f infra/docker-compose.production.yml logs --since="2024-01-01T10:00:00" --until="2024-01-01T11:00:00"

# JSON形式ログ解析
docker-compose -f infra/docker-compose.production.yml logs backend | jq .
```

## 📈 パフォーマンス目標

### KPI指標

- **初期レンダリング時間**: P95 < 1500ms
- **ドラッグ操作レイテンシ**: P95 < 100ms
- **API応答時間**: P95 < 500ms
- **稼働率**: 99.9%以上
- **エラー率**: 0.1%以下

### 定期確認項目

```bash
# 週次確認
- セキュリティアップデート
- バックアップ検証
- リソース使用量トレンド
- パフォーマンス指標

# 月次確認  
- SSL証明書有効期限
- ログローテーション
- ディスク使用量増加傾向
- セキュリティ監査
```

## 🆘 サポート

### ログ収集

問題報告時は以下の情報を収集してください：

```bash
# システム情報収集スクリプト
cat > /tmp/collect_info.sh << 'EOF'
#!/bin/bash
echo "=== System Info ==="
uname -a
docker --version
docker-compose --version

echo "=== Service Status ==="
./scripts/deploy-production.sh status

echo "=== Recent Logs ==="
./scripts/deploy-production.sh logs --tail=50

echo "=== Resource Usage ==="
docker stats --no-stream
df -h /opt/gantt/
EOF

chmod +x /tmp/collect_info.sh && /tmp/collect_info.sh > system_info_$(date +%Y%m%d_%H%M%S).txt
```

### 設定ファイル一覧

プロダクション環境で使用される主要ファイル：

```
/mnt/c/Users/kfuruhashi/projects/github/GanttChartWebUI/
├── .env.production                           # 環境変数設定
├── infra/
│   ├── docker-compose.production.yml        # Docker Compose設定
│   ├── nginx/nginx.production.conf          # Nginx設定
│   └── postgres/postgresql.conf             # PostgreSQL設定
├── scripts/deploy-production.sh             # デプロイスクリプト
└── PRODUCTION.md                            # 本ドキュメント
```

---

**重要**: 本番環境への初回デプロイ前に、必ずステージング環境でテストを実施してください。