#!/bin/bash

# Docker環境管理ユーティリティスクリプト
# Usage: ./scripts/docker-utils.sh [command]

set -e

# 色付きログ出力
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# データベースに接続
db_connect() {
    log_info "Connecting to PostgreSQL database..."
    docker compose exec postgres psql -U gantt_user -d gantt_db
}

# データベースの状態確認
db_status() {
    log_info "Database connection status:"
    docker compose exec postgres pg_isready -U gantt_user -d gantt_db
    
    log_info "Database size and table info:"
    docker compose exec postgres psql -U gantt_user -d gantt_db -c "\l" -c "\dt" -c "SELECT schemaname,tablename,n_tup_ins,n_tup_upd,n_tup_del FROM pg_stat_user_tables;"
}

# ログファイルの確認
show_disk_usage() {
    log_info "Disk usage for project directories:"
    echo "Logs:"
    du -sh logs/ 2>/dev/null || echo "  No logs directory"
    echo "Uploads:"
    du -sh uploads/ 2>/dev/null || echo "  No uploads directory"
    echo "Database:"
    docker system df
}

# コンテナシェルに接続
container_shell() {
    local service=${1:-backend}
    
    if ! docker compose ps $service | grep -q "Up"; then
        log_error "Service '$service' is not running"
        exit 1
    fi
    
    log_info "Connecting to $service container shell..."
    docker compose exec $service /bin/sh
}

# 開発用データベースリセット
dev_db_reset() {
    log_warn "This will reset the development database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Resetting development database..."
        docker compose down -v
        docker compose up -d postgres
        sleep 5
        docker compose up -d
        log_info "Database reset completed"
    else
        log_info "Reset cancelled"
    fi
}

# Prismaスキーマの同期
prisma_sync() {
    log_info "Synchronizing Prisma schema..."
    docker compose exec backend npx prisma db push
    docker compose exec backend npx prisma generate
    log_info "Prisma sync completed"
}

# Prismaスタジオの起動
prisma_studio() {
    log_info "Starting Prisma Studio..."
    log_info "Prisma Studio will be available at: http://localhost:5555"
    docker compose exec backend npx prisma studio
}

# ログファイルの圧縮・アーカイブ
archive_logs() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local archive_name="logs_archive_$timestamp.tar.gz"
    
    if [ ! -d "logs" ] || [ -z "$(ls -A logs)" ]; then
        log_warn "No logs to archive"
        return
    fi
    
    log_info "Archiving logs to $archive_name..."
    tar -czf "$archive_name" -C logs .
    
    # アーカイブ後、古いログファイルを削除（7日以上古い）
    find logs -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
    
    log_info "Logs archived successfully"
}

# 環境変数の表示（セキュリティ配慮でパスワード部分をマスク）
show_env() {
    log_info "Current environment variables:"
    if [ -f ".env" ]; then
        sed 's/\(.*PASSWORD.*=\).*/\1[MASKED]/' .env
    else
        log_warn ".env file not found"
    fi
}

# Dockerイメージのセキュリティスキャン（trivy使用）
security_scan() {
    if ! command -v trivy &> /dev/null; then
        log_warn "Trivy is not installed. Skipping security scan."
        log_info "Install trivy: https://aquasecurity.github.io/trivy/"
        return
    fi
    
    log_info "Running security scan on Docker images..."
    
    for image in $(docker compose config --images); do
        log_info "Scanning image: $image"
        trivy image --severity HIGH,CRITICAL $image
    done
}

# パフォーマンス監視
performance_monitor() {
    log_info "Starting performance monitoring (Ctrl+C to stop)..."
    while true; do
        clear
        echo "=== Docker Container Performance Monitor ==="
        echo "Time: $(date)"
        echo ""
        
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}" $(docker compose ps -q) 2>/dev/null
        
        echo ""
        echo "=== Database Connections ==="
        docker compose exec postgres psql -U gantt_user -d gantt_db -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null || echo "Database not available"
        
        sleep 5
    done
}

# ヘルプの表示
show_help() {
    echo "Docker Environment Utilities"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Database Commands:"
    echo "  db-connect    - Connect to PostgreSQL database"
    echo "  db-status     - Show database status and table info"
    echo "  db-reset      - Reset development database (with confirmation)"
    echo "  prisma-sync   - Sync Prisma schema to database"
    echo "  prisma-studio - Open Prisma Studio"
    echo ""
    echo "System Commands:"
    echo "  shell [service] - Connect to container shell (default: backend)"
    echo "  disk-usage    - Show disk usage for logs, uploads, and Docker"
    echo "  archive-logs  - Archive and clean old log files"
    echo "  show-env      - Display environment variables (passwords masked)"
    echo "  performance   - Monitor container performance"
    echo ""
    echo "Security Commands:"
    echo "  security-scan - Scan Docker images for vulnerabilities (requires trivy)"
    echo ""
    echo "Examples:"
    echo "  $0 db-connect"
    echo "  $0 shell frontend"
    echo "  $0 prisma-studio"
}

# メイン処理
main() {
    local command=${1:-help}
    
    case $command in
        db-connect)
            db_connect
            ;;
        db-status)
            db_status
            ;;
        db-reset)
            dev_db_reset
            ;;
        prisma-sync)
            prisma_sync
            ;;
        prisma-studio)
            prisma_studio
            ;;
        shell)
            container_shell $2
            ;;
        disk-usage)
            show_disk_usage
            ;;
        archive-logs)
            archive_logs
            ;;
        show-env)
            show_env
            ;;
        performance)
            performance_monitor
            ;;
        security-scan)
            security_scan
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Dockerの確認
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker compose ps &> /dev/null; then
        log_warn "Docker services may not be running"
    fi
}

# スクリプトの実行
check_docker
main $@