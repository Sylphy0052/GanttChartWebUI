#!/bin/bash

# Docker本番環境起動スクリプト
# Usage: ./scripts/docker-prod.sh [command]
# Commands: start, stop, restart, logs, clean, build, backup, restore

set -e

PROJECT_NAME="ganttchart-webui-prod"
COMPOSE_FILE="infra/docker-compose.prod.yml"
BACKUP_DIR="./backups"

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

# 環境変数ファイルの確認
setup_env() {
    if [ ! -f .env ]; then
        log_error ".env file not found. Please create it from .env.example"
        exit 1
    fi
    
    # 本番環境用の環境変数チェック
    if grep -q "NODE_ENV=development" .env; then
        log_warn "NODE_ENV is set to development. Consider changing to production."
    fi
    
    log_info "Environment configuration loaded"
}

# 必要なディレクトリの作成
setup_directories() {
    log_info "Creating required directories..."
    mkdir -p uploads logs $BACKUP_DIR
    # 適切な権限を設定
    chmod 755 uploads logs $BACKUP_DIR
}

# Docker Composeサービスの起動
start_services() {
    log_info "Starting Docker services (Production Mode)..."
    setup_env
    setup_directories
    
    # サービスを起動（detachedモード）
    docker compose -f $COMPOSE_FILE up -d
    
    # 起動確認
    sleep 5
    if docker compose -f $COMPOSE_FILE ps | grep -q "Up"; then
        log_info "Services started successfully!"
        log_info "Application is available at: http://localhost:8080"
        log_info ""
        log_info "Use './scripts/docker-prod.sh logs' to view logs"
        log_info "Use './scripts/docker-prod.sh stop' to stop services"
    else
        log_error "Some services failed to start. Check logs with './scripts/docker-prod.sh logs'"
        exit 1
    fi
}

# サービスの停止
stop_services() {
    log_info "Stopping Docker services..."
    docker compose -f $COMPOSE_FILE down
    log_info "Services stopped"
}

# サービスの再起動
restart_services() {
    log_info "Restarting Docker services..."
    docker compose -f $COMPOSE_FILE restart
    log_info "Services restarted"
}

# ログの表示
show_logs() {
    local service=$2
    if [ -n "$service" ]; then
        log_info "Showing logs for service: $service"
        docker compose -f $COMPOSE_FILE logs -f --tail=100 $service
    else
        log_info "Showing logs for all services (Ctrl+C to exit)"
        docker compose -f $COMPOSE_FILE logs -f --tail=100
    fi
}

# データベースバックアップ
backup_database() {
    log_info "Creating database backup..."
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/db_backup_$timestamp.sql"
    
    # PostgreSQLコンテナが起動しているか確認
    if ! docker compose -f $COMPOSE_FILE ps postgres | grep -q "Up"; then
        log_error "PostgreSQL container is not running"
        exit 1
    fi
    
    # バックアップ実行
    docker compose -f $COMPOSE_FILE exec -T postgres pg_dump -U gantt_user gantt_db > "$backup_file"
    
    if [ $? -eq 0 ]; then
        log_info "Database backup created: $backup_file"
        
        # アップロードファイルもバックアップ
        if [ -d "uploads" ] && [ "$(ls -A uploads)" ]; then
            local uploads_backup="$BACKUP_DIR/uploads_backup_$timestamp.tar.gz"
            tar -czf "$uploads_backup" -C uploads .
            log_info "Uploads backup created: $uploads_backup"
        fi
    else
        log_error "Database backup failed"
        exit 1
    fi
}

# データベースリストア
restore_database() {
    local backup_file=$2
    
    if [ -z "$backup_file" ]; then
        log_error "Please specify backup file: ./scripts/docker-prod.sh restore <backup_file.sql>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "This will overwrite the current database!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restoring database from: $backup_file"
        docker compose -f $COMPOSE_FILE exec -T postgres psql -U gantt_user -d gantt_db < "$backup_file"
        
        if [ $? -eq 0 ]; then
            log_info "Database restore completed"
        else
            log_error "Database restore failed"
            exit 1
        fi
    else
        log_info "Restore cancelled"
    fi
}

# クリーンアップ
clean_services() {
    log_warn "This will remove all containers and volumes!"
    log_warn "All data will be lost unless you have backups!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up Docker services and volumes..."
        docker compose -f $COMPOSE_FILE down -v --remove-orphans
        docker system prune -f
        log_info "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# イメージのリビルド
rebuild_services() {
    log_info "Rebuilding Docker images for production..."
    docker compose -f $COMPOSE_FILE build --no-cache
    log_info "Images rebuilt. Use 'start' command to launch services"
}

# システム状態の表示
show_status() {
    log_info "Docker Services Status:"
    docker compose -f $COMPOSE_FILE ps
    echo ""
    
    log_info "System Resources:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(docker compose -f $COMPOSE_FILE ps -q) 2>/dev/null || log_warn "No running containers found"
    echo ""
    
    log_info "Disk Usage:"
    df -h uploads logs 2>/dev/null || log_warn "Directories not found"
}

# ヘルプの表示
show_help() {
    echo "Docker Production Environment Management Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start     - Start all services (default)"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  logs      - Show logs for all services"
    echo "  logs <service> - Show logs for specific service"
    echo "  backup    - Create database and uploads backup"
    echo "  restore <file> - Restore database from backup file"
    echo "  clean     - Stop services and remove volumes"
    echo "  build     - Rebuild Docker images"
    echo "  status    - Show system status"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs nginx"
    echo "  $0 backup"
    echo "  $0 restore backups/db_backup_20241201_120000.sql"
}

# メイン処理
main() {
    local command=${1:-start}
    
    case $command in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        logs)
            show_logs $@
            ;;
        backup)
            backup_database
            ;;
        restore)
            restore_database $@
            ;;
        clean)
            clean_services
            ;;
        build)
            rebuild_services
            ;;
        status)
            show_status
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

# Dockerとdocker composeのチェック
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        exit 1
    fi
}

# スクリプトの実行
check_dependencies
main $@