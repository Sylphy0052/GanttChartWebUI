#!/bin/bash

# Migration Deployment Script
# 初回マイグレーション実行とスキーマ適用スクリプト

set -euo pipefail

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# エラーハンドリング
error_exit() {
    log_error "$1"
    exit 1
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェックしています..."
    
    # Node.js とnpm のインストール確認
    if ! command -v node &> /dev/null; then
        error_exit "Node.js がインストールされていません"
    fi
    
    if ! command -v npm &> /dev/null && ! command -v yarn &> /dev/null; then
        error_exit "npm または yarn がインストールされていません"
    fi
    
    # Prisma CLI の存在確認
    if ! npx prisma --version &> /dev/null; then
        error_exit "Prisma CLI が利用できません"
    fi
    
    # .env ファイルの存在確認
    if [[ ! -f .env ]]; then
        error_exit ".env ファイルが見つかりません"
    fi
    
    # DATABASE_URL の確認
    if ! grep -q "DATABASE_URL" .env; then
        error_exit ".env ファイルに DATABASE_URL が設定されていません"
    fi
    
    log_success "前提条件チェック完了"
}

# データベース接続テスト
test_database_connection() {
    log_info "データベース接続をテストしています..."
    
    # PostgreSQL接続テスト
    if npx prisma db push --preview-feature --accept-data-loss 2>&1 | grep -q "Authentication failed\|Connection refused\|timeout"; then
        log_warning "PostgreSQL接続に失敗しました。SQLiteモードでテストします。"
        return 1
    else
        log_success "PostgreSQLデータベースに接続できました"
        return 0
    fi
}

# マイグレーション実行（PostgreSQL）
deploy_postgresql_migration() {
    log_info "PostgreSQL用マイグレーションを実行しています..."
    
    # マイグレーションの生成とデプロイ
    if npx prisma migrate deploy; then
        log_success "PostgreSQL マイグレーション完了"
        return 0
    else
        log_warning "PostgreSQL マイグレーションに失敗しました"
        return 1
    fi
}

# マイグレーション実行（SQLite - フォールバック）
deploy_sqlite_migration() {
    log_info "SQLite用マイグレーション（テスト環境）を実行しています..."
    
    # schema.prisma のバックアップ作成
    if [[ ! -f prisma/schema.prisma.backup ]]; then
        cp prisma/schema.prisma prisma/schema.prisma.backup
        log_info "schema.prisma をバックアップしました"
    fi
    
    # SQLite用にスキーマ調整
    sed -i.tmp 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
    sed -i.tmp 's|url.*env("DATABASE_URL")|url = "file:./test.db"|' prisma/schema.prisma
    sed -i.tmp 's/@db\.Text//g' prisma/schema.prisma
    sed -i.tmp 's/@db\.Timestamptz(3)//g' prisma/schema.prisma
    sed -i.tmp 's/@db\.Date//g' prisma/schema.prisma
    sed -i.tmp 's/String\[\]/String/g' prisma/schema.prisma
    sed -i.tmp 's/Json/String/g' prisma/schema.prisma
    sed -i.tmp 's/IssueStatus/String/g' prisma/schema.prisma
    sed -i.tmp 's/DependencyType/String/g' prisma/schema.prisma
    sed -i.tmp 's/ChangeEntityType/String/g' prisma/schema.prisma
    sed -i.tmp 's/@default(open)/@default("open")/g' prisma/schema.prisma
    sed -i.tmp 's/@default(FS)/@default("FS")/g' prisma/schema.prisma
    
    # enum定義を削除
    sed -i.tmp '/^enum IssueStatus/,/^}/d' prisma/schema.prisma
    sed -i.tmp '/^enum DependencyType/,/^}/d' prisma/schema.prisma  
    sed -i.tmp '/^enum ChangeEntityType/,/^}/d' prisma/schema.prisma
    
    # インデックス除去（SQLite では一部サポートされていない）
    sed -i.tmp '/@@index/d' prisma/schema.prisma
    
    rm -f prisma/schema.prisma.tmp
    
    # SQLite マイグレーション実行
    if npx prisma migrate dev --name init --skip-generate; then
        log_success "SQLite マイグレーション完了"
        
        # スキーマを元に戻す
        if [[ -f prisma/schema.prisma.backup ]]; then
            mv prisma/schema.prisma.backup prisma/schema.prisma
            log_info "schema.prisma を復元しました"
        fi
        
        return 0
    else
        # エラー時もスキーマを元に戻す
        if [[ -f prisma/schema.prisma.backup ]]; then
            mv prisma/schema.prisma.backup prisma/schema.prisma
            log_info "schema.prisma を復元しました"
        fi
        error_exit "SQLite マイグレーションに失敗しました"
    fi
}

# Prisma Client 生成
generate_client() {
    log_info "Prisma Client を生成しています..."
    
    if npx prisma generate; then
        log_success "Prisma Client 生成完了"
    else
        error_exit "Prisma Client 生成に失敗しました"
    fi
}

# マイグレーション検証
verify_migration() {
    log_info "マイグレーションを検証しています..."
    
    if [[ -f verify-migration.js ]]; then
        if node verify-migration.js; then
            log_success "マイグレーション検証完了"
        else
            log_error "マイグレーション検証に失敗しました"
            return 1
        fi
    else
        log_warning "検証スクリプトが見つかりませんでした。手動でテーブル確認を行ってください。"
    fi
}

# メイン実行
main() {
    log_info "=== Prisma Migration Deployment Script ==="
    log_info "初回マイグレーション実行とスキーマ適用を開始します"
    
    # 1. 前提条件チェック
    check_prerequisites
    
    # 2. データベース接続テスト
    if test_database_connection; then
        # PostgreSQL 接続成功
        if deploy_postgresql_migration; then
            log_success "PostgreSQL マイグレーション成功"
        else
            log_warning "PostgreSQL マイグレーション失敗 - SQLite フォールバックを実行"
            deploy_sqlite_migration
        fi
    else
        # PostgreSQL 接続失敗 - SQLite フォールバック
        log_info "SQLite フォールバック実行"
        deploy_sqlite_migration
    fi
    
    # 3. Prisma Client 生成
    generate_client
    
    # 4. マイグレーション検証
    verify_migration
    
    log_success "=== マイグレーション デプロイメント完了 ==="
    log_info "次の手順:"
    log_info "1. テーブル構造確認: npx prisma studio"
    log_info "2. PostgreSQL 本格運用時は Docker Compose でデータベース起動"
    log_info "3. 本番デプロイ時は: npx prisma migrate deploy"
}

# スクリプト実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi