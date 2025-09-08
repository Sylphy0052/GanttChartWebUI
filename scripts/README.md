# Docker管理スクリプト

このディレクトリには、GanttChart WebUIのDocker環境を管理するためのスクリプトが含まれています。

## スクリプト一覧

### 🔧 docker-dev.sh - 開発環境管理
開発用Docker環境の起動・停止・管理を行います。

```bash
# 開発環境の起動
./scripts/docker-dev.sh start

# ログの表示
./scripts/docker-dev.sh logs

# 特定のサービスのログ
./scripts/docker-dev.sh logs backend

# サービスの停止
./scripts/docker-dev.sh stop

# クリーンアップ（データ削除）
./scripts/docker-dev.sh clean

# イメージの再ビルド
./scripts/docker-dev.sh build
```

**主な機能:**
- 自動的な.envファイル作成（.env.exampleから）
- 必要なディレクトリの自動作成
- 色付きログ出力
- エラーハンドリング

### 🚀 docker-prod.sh - 本番環境管理
本番用Docker環境の管理とバックアップ機能を提供します。

```bash
# 本番環境の起動
./scripts/docker-prod.sh start

# システム状態の確認
./scripts/docker-prod.sh status

# データベースバックアップ
./scripts/docker-prod.sh backup

# データベースリストア
./scripts/docker-prod.sh restore backups/db_backup_20241201_120000.sql

# サービスの再起動
./scripts/docker-prod.sh restart
```

**主な機能:**
- 本番用Docker Compose設定の使用
- 自動データベースバックアップ（PostgreSQL + アップロードファイル）
- リストア機能
- システム監視とリソース表示
- 安全なクリーンアップ（確認プロンプト付き）

### 🛠️ docker-utils.sh - ユーティリティツール
開発・運用時の補助ツールを提供します。

```bash
# データベースに接続
./scripts/docker-utils.sh db-connect

# Prismaスタジオの起動
./scripts/docker-utils.sh prisma-studio

# コンテナシェルに接続
./scripts/docker-utils.sh shell backend

# ディスク使用量の確認
./scripts/docker-utils.sh disk-usage

# パフォーマンス監視
./scripts/docker-utils.sh performance

# セキュリティスキャン（trivy必要）
./scripts/docker-utils.sh security-scan
```

**主な機能:**
- データベース管理（接続、状態確認、リセット）
- Prismaツール（同期、スタジオ）
- システム監視（パフォーマンス、ディスク使用量）
- ログアーカイブ
- セキュリティスキャン

## 使用方法

### 初回セットアップ

1. **環境変数の設定**
   ```bash
   cp .env.example .env
   # .envファイルを必要に応じて編集
   ```

2. **開発環境の起動**
   ```bash
   ./scripts/docker-dev.sh start
   ```

3. **アプリケーションにアクセス**
   - メイン: http://localhost:8080
   - Frontend直接: http://localhost:3000
   - Backend API直接: http://localhost:3001

### 日常の開発作業

```bash
# 開発開始
./scripts/docker-dev.sh start

# ログ監視
./scripts/docker-dev.sh logs

# データベース確認
./scripts/docker-utils.sh db-status

# 開発終了
./scripts/docker-dev.sh stop
```

### 本番環境での運用

```bash
# 本番環境起動
./scripts/docker-prod.sh start

# 定期バックアップ
./scripts/docker-prod.sh backup

# システム状態確認
./scripts/docker-prod.sh status

# パフォーマンス監視
./scripts/docker-utils.sh performance
```

## トラブルシューティング

### よくある問題

1. **ポートが使用中のエラー**
   ```bash
   # 使用中のプロセス確認
   lsof -i :8080
   # または別のポート使用（.envファイル編集）
   ```

2. **データベース接続エラー**
   ```bash
   # データベース状態確認
   ./scripts/docker-utils.sh db-status
   # データベースリセット（開発環境のみ）
   ./scripts/docker-utils.sh db-reset
   ```

3. **ディスク容量不足**
   ```bash
   # 使用量確認
   ./scripts/docker-utils.sh disk-usage
   # ログアーカイブ
   ./scripts/docker-utils.sh archive-logs
   # Dockerクリーンアップ
   docker system prune -f
   ```

### ログの確認方法

```bash
# 全サービスのログ
./scripts/docker-dev.sh logs

# 特定サービスのログ
./scripts/docker-dev.sh logs postgres
./scripts/docker-dev.sh logs backend
./scripts/docker-dev.sh logs frontend
./scripts/docker-dev.sh logs nginx
```

## セキュリティ考慮事項

- `.env`ファイルには機密情報が含まれるため、Gitにコミットしないでください
- 本番環境では強力なパスワードを使用してください
- 定期的にセキュリティスキャンを実行してください
- バックアップファイルのアクセス権限に注意してください

## 権限設定

スクリプト実行前に実行権限を付与してください：

```bash
chmod +x scripts/*.sh
```

## 依存関係

- Docker 20.10+
- Docker Compose 2.0+
- bash (スクリプト実行用)
- 任意: trivy (セキュリティスキャン用)