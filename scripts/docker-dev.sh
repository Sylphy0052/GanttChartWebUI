#!/bin/bash

# GanttChartWebUI - 開発環境用Dockerスクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ出力関数
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

# 使用方法表示
show_usage() {
    echo "使用方法: $0 {start|stop|restart|logs|shell|db|migrate|seed|clean|status}"
    echo ""
    echo "コマンド:"
    echo "  start     - 開発環境を起動"
    echo "  stop      - 開発環境を停止"
    echo "  restart   - 開発環境を再起動"
    echo "  logs      - 全サービスのログを表示"
    echo "  shell     - APIコンテナのシェルを開く"
    echo "  db        - PostgreSQLに接続"
    echo "  migrate   - データベースマイグレーション実行"
    echo "  seed      - シードデータを投入"
    echo "  clean     - 全てのコンテナとボリュームを削除"
    echo "  status    - サービス状況を確認"
}

# 開発環境起動
start_dev() {
    log_info "開発環境を起動しています..."
    cd "$PROJECT_ROOT"
    
    # Docker Composeで起動
    docker compose -f "$COMPOSE_FILE" up -d
    
    log_success "開発環境が起動しました"
    log_info "フロントエンド: http://localhost:3000"
    log_info "API: http://localhost:3001"
    log_info "ログを確認するには: $0 logs"
}

# 開発環境停止
stop_dev() {
    log_info "開発環境を停止しています..."
    cd "$PROJECT_ROOT"
    
    docker compose -f "$COMPOSE_FILE" down
    
    log_success "開発環境が停止しました"
}

# 開発環境再起動
restart_dev() {
    log_info "開発環境を再起動しています..."
    stop_dev
    start_dev
}

# ログ表示
show_logs() {
    log_info "ログを表示しています... (Ctrl+Cで終了)"
    cd "$PROJECT_ROOT"
    
    docker compose -f "$COMPOSE_FILE" logs -f
}

# APIコンテナのシェル
api_shell() {
    log_info "APIコンテナのシェルを開きます..."
    cd "$PROJECT_ROOT"
    
    docker compose -f "$COMPOSE_FILE" exec api sh
}

# データベース接続
connect_db() {
    log_info "PostgreSQLに接続しています..."
    cd "$PROJECT_ROOT"
    
    docker compose -f "$COMPOSE_FILE" exec postgres psql -U gantt_user -d gantt_chart_dev
}

# マイグレーション実行
run_migrate() {
    log_info "データベースマイグレーションを実行しています..."
    cd "$PROJECT_ROOT"
    
    docker compose -f "$COMPOSE_FILE" exec api npm run prisma:migrate
    
    log_success "マイグレーションが完了しました"
}

# シードデータ投入
run_seed() {
    log_info "シードデータを投入しています..."
    cd "$PROJECT_ROOT"
    
    docker compose -f "$COMPOSE_FILE" exec api npm run seed
    
    log_success "シードデータの投入が完了しました"
}

# クリーンアップ
clean_all() {
    log_warning "全てのコンテナとボリュームを削除します"
    read -p "続行しますか? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "クリーンアップを実行しています..."
        cd "$PROJECT_ROOT"
        
        docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
        docker system prune -f
        
        log_success "クリーンアップが完了しました"
    else
        log_info "クリーンアップをキャンセルしました"
    fi
}

# ステータス確認
show_status() {
    log_info "サービス状況:"
    cd "$PROJECT_ROOT"
    
    docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "ヘルスチェック:"
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep gantt
}

# メイン処理
main() {
    case "${1:-}" in
        start)
            start_dev
            ;;
        stop)
            stop_dev
            ;;
        restart)
            restart_dev
            ;;
        logs)
            show_logs
            ;;
        shell)
            api_shell
            ;;
        db)
            connect_db
            ;;
        migrate)
            run_migrate
            ;;
        seed)
            run_seed
            ;;
        clean)
            clean_all
            ;;
        status)
            show_status
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

main "$@"