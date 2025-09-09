#!/bin/bash

# Docker開発環境起動スクリプト
# Usage: ./scripts/docker-dev.sh [command]
# Commands: start, stop, restart, logs, clean, build

set -e

PROJECT_NAME="ganttchart-webui"
COMPOSE_FILE="infra/docker-compose.dev.yml"

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

# 環境変数ファイルの確認・作成
setup_env() {
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            log_info "Creating .env from .env.example..."
            cp .env.example .env
            log_warn "Please review and adjust the .env file if needed"
        else
            log_error ".env.example not found. Please create .env file manually."
            exit 1
        fi
    else
        log_info ".env file found"
    fi
}

# 必要なディレクトリの作成
setup_directories() {
    log_info "Creating required directories..."
    mkdir -p uploads logs
    # 適切な権限を設定（Dockerコンテナからの書き込み用）
    chmod 755 uploads logs
}

# Docker Composeサービスの起動
start_services() {
    log_info "Starting Docker services..."
    setup_env
    setup_directories
    
    # サービスを起動（detachedモード）
    docker compose -f $COMPOSE_FILE --env-file .env up -d
    
    # 環境変数を読み込み
    source .env
    
    log_info "Services started successfully!"
    log_info "Application will be available at: http://localhost:${NGINX_PORT:-8080}"
    log_info "Direct access:"
    log_info "  - Frontend: http://localhost:${FRONTEND_PORT:-3000}"
    log_info "  - Backend API: http://localhost:${BACKEND_PORT:-3001}"
    log_info ""
    log_info "Use './scripts/docker-dev.sh logs' to view logs"
    log_info "Use './scripts/docker-dev.sh stop' to stop services"
}

# サービスの停止
stop_services() {
    log_info "Stopping Docker services..."
    docker compose -f $COMPOSE_FILE --env-file .env down
    log_info "Services stopped"
}

# サービスの再起動
restart_services() {
    log_info "Restarting Docker services..."
    stop_services
    start_services
}

# ログの表示
show_logs() {
    local service=$2
    if [ -n "$service" ]; then
        log_info "Showing logs for service: $service"
        docker compose -f $COMPOSE_FILE --env-file .env logs -f $service
    else
        log_info "Showing logs for all services (Ctrl+C to exit)"
        docker compose -f $COMPOSE_FILE --env-file .env logs -f
    fi
}

# クリーンアップ（ボリュームも削除）
clean_services() {
    log_warn "This will remove all containers, volumes, and data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up Docker services and volumes..."
        docker compose -f $COMPOSE_FILE --env-file .env down -v --remove-orphans
        docker system prune -f
        log_info "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# 完全リセット（クリーンアップ、キャッシュクリア、再ビルド、再起動）
reset_services() {
    log_warn "This will completely reset the Docker environment!"
    log_warn "All data will be lost and services will be rebuilt from scratch."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Starting complete reset..."
        
        # 1. すべてのコンテナを停止・削除
        log_info "Stopping and removing containers..."
        docker compose -f $COMPOSE_FILE --env-file .env down -v --remove-orphans
        
        # 2. Next.jsキャッシュをクリア
        log_info "Clearing Next.js cache..."
        rm -rf frontend/.next 2>/dev/null || true
        rm -rf frontend/node_modules/.cache 2>/dev/null || true
        
        # 3. アップロードとログディレクトリをクリア
        log_info "Clearing uploads and logs..."
        rm -rf uploads/* 2>/dev/null || true
        rm -rf logs/* 2>/dev/null || true
        
        # 4. Dockerイメージを削除
        log_info "Removing Docker images..."
        docker compose -f $COMPOSE_FILE --env-file .env down --rmi local
        
        # 5. Dockerシステムをクリーンアップ
        log_info "Cleaning Docker system..."
        docker system prune -af --volumes
        
        # 6. イメージを再ビルド
        log_info "Rebuilding Docker images..."
        docker compose -f $COMPOSE_FILE --env-file .env build --no-cache
        
        # 7. サービスを起動
        log_info "Starting services..."
        start_services
        
        log_info "Reset completed successfully!"
    else
        log_info "Reset cancelled"
    fi
}

# イメージのリビルド
rebuild_services() {
    log_info "Rebuilding Docker images..."
    docker compose -f $COMPOSE_FILE --env-file .env build --no-cache
    log_info "Images rebuilt. Use 'start' command to launch services"
}

# ヘルプの表示
show_help() {
    echo "Docker Development Environment Management Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start     - Start all services (default)"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  logs      - Show logs for all services"
    echo "  logs <service> - Show logs for specific service"
    echo "  clean     - Stop services and remove volumes"
    echo "  reset     - Complete reset: clean, rebuild, and restart"
    echo "  build     - Rebuild Docker images"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs backend"
    echo "  $0 logs frontend"
    echo "  $0 logs postgres"
    echo "  $0 reset    # Complete reset with fresh start"
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
        clean)
            clean_services
            ;;
        reset)
            reset_services
            ;;
        build)
            rebuild_services
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