#!/bin/bash

# GanttChartWebUI - 本番環境用Dockerスクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

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
    echo "使用方法: $0 {deploy|start|stop|restart|logs|shell|db|migrate|seed|backup|restore|clean|status|health}"
    echo ""
    echo "コマンド:"
    echo "  deploy    - 本番環境をビルド・デプロイ"
    echo "  start     - 本番環境を起動"
    echo "  stop      - 本番環境を停止"
    echo "  restart   - 本番環境を再起動"
    echo "  logs      - 全サービスのログを表示"
    echo "  shell     - APIコンテナのシェルを開く"
    echo "  db        - PostgreSQLに接続"
    echo "  migrate   - データベースマイグレーション実行"
    echo "  seed      - シードデータを投入"
    echo "  backup    - データベースバックアップ"
    echo "  restore   - データベースリストア"
    echo "  clean     - 未使用のDockerリソースをクリーンアップ"
    echo "  status    - サービス状況を確認"
    echo "  health    - ヘルスチェック実行"
}

# 環境変数チェック
check_env() {
    local required_vars=("JWT_SECRET" "POSTGRES_PASSWORD")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "以下の環境変数が設定されていません:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        log_warning "本番環境では適切な値を設定してください"
        return 1
    fi
    
    return 0
}

# デプロイ（ビルド + 起動）
deploy_prod() {
    log_info "本番環境をデプロイしています..."
    cd "$PROJECT_ROOT"
    
    # 環境変数チェック
    if ! check_env; then
        log_warning "環境変数が未設定ですが、続行します"
    fi
    
    # ビルドと起動
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # ヘルスチェック待機
    log_info "サービスの起動を待機しています..."
    sleep 10
    
    if check_health; then
        log_success "本番環境のデプロイが完了しました"
        show_access_info
    else
        log_error "一部のサービスが正常に起動していません"
        show_status
    fi
}

# 本番環境起動
start_prod() {
    log_info "本番環境を起動しています..."
    cd "$PROJECT_ROOT"
    
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_success "本番環境が起動しました"
    show_access_info
}

# 本番環境停止
stop_prod() {
    log_info "本番環境を停止しています..."
    cd "$PROJECT_ROOT"
    
    docker-compose -f "$COMPOSE_FILE" down
    
    log_success "本番環境が停止しました"
}

# 本番環境再起動
restart_prod() {
    log_info "本番環境を再起動しています..."
    stop_prod
    sleep 5
    start_prod
}

# ログ表示
show_logs() {
    local service="${1:-}"
    
    cd "$PROJECT_ROOT"
    
    if [[ -n "$service" ]]; then
        log_info "$service サービスのログを表示しています... (Ctrl+Cで終了)"
        docker-compose -f "$COMPOSE_FILE" logs -f "$service"
    else
        log_info "全サービスのログを表示しています... (Ctrl+Cで終了)"
        docker-compose -f "$COMPOSE_FILE" logs -f
    fi
}

# APIコンテナのシェル
api_shell() {
    log_info "APIコンテナのシェルを開きます..."
    cd "$PROJECT_ROOT"
    
    docker-compose -f "$COMPOSE_FILE" exec api sh
}

# データベース接続
connect_db() {
    log_info "PostgreSQLに接続しています..."
    cd "$PROJECT_ROOT"
    
    docker-compose -f "$COMPOSE_FILE" exec postgres psql -U gantt_user -d gantt_chart
}

# マイグレーション実行
run_migrate() {
    log_info "データベースマイグレーションを実行しています..."
    cd "$PROJECT_ROOT"
    
    docker-compose -f "$COMPOSE_FILE" exec api npm run prisma:migrate
    
    log_success "マイグレーションが完了しました"
}

# シードデータ投入
run_seed() {
    log_warning "本番環境でシードデータを投入しようとしています"
    read -p "続行しますか? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "シードデータを投入しています..."
        cd "$PROJECT_ROOT"
        
        docker-compose -f "$COMPOSE_FILE" exec api npm run seed
        
        log_success "シードデータの投入が完了しました"
    else
        log_info "シードデータ投入をキャンセルしました"
    fi
}

# データベースバックアップ
backup_db() {
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    log_info "データベースをバックアップしています..."
    cd "$PROJECT_ROOT"
    
    docker-compose -f "$COMPOSE_FILE" exec postgres pg_dump -U gantt_user gantt_chart > "$backup_file"
    
    log_success "バックアップが完了しました: $backup_file"
}

# データベースリストア
restore_db() {
    local backup_file="${1:-}"
    
    if [[ -z "$backup_file" ]]; then
        log_error "バックアップファイルを指定してください"
        echo "使用方法: $0 restore <backup_file>"
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "バックアップファイルが見つかりません: $backup_file"
        exit 1
    fi
    
    log_warning "データベースをリストアします。既存のデータは削除されます"
    read -p "続行しますか? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "データベースをリストアしています..."
        cd "$PROJECT_ROOT"
        
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U gantt_user gantt_chart < "$backup_file"
        
        log_success "データベースのリストアが完了しました"
    else
        log_info "リストアをキャンセルしました"
    fi
}

# クリーンアップ
clean_all() {
    log_info "未使用のDockerリソースをクリーンアップしています..."
    
    docker system prune -f
    docker volume prune -f
    
    log_success "クリーンアップが完了しました"
}

# ステータス確認
show_status() {
    log_info "サービス状況:"
    cd "$PROJECT_ROOT"
    
    docker-compose -f "$COMPOSE_FILE" ps
}

# ヘルスチェック
check_health() {
    local all_healthy=true
    
    log_info "ヘルスチェックを実行しています..."
    
    # PostgreSQL
    if docker-compose -f "$COMPOSE_FILE" exec postgres pg_isready -U gantt_user >/dev/null 2>&1; then
        log_success "PostgreSQL: 正常"
    else
        log_error "PostgreSQL: 異常"
        all_healthy=false
    fi
    
    # API
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        log_success "API: 正常"
    else
        log_error "API: 異常"
        all_healthy=false
    fi
    
    # Web
    if curl -f http://localhost:3000 >/dev/null 2>&1; then
        log_success "Web: 正常"
    else
        log_error "Web: 異常"
        all_healthy=false
    fi
    
    if $all_healthy; then
        log_success "全サービスが正常に動作しています"
        return 0
    else
        log_error "一部のサービスに問題があります"
        return 1
    fi
}

# アクセス情報表示
show_access_info() {
    echo ""
    log_info "アクセス情報:"
    echo "  フロントエンド: http://localhost:3000"
    echo "  API: http://localhost:3001"
    echo "  API仕様書: http://localhost:3001/api"
}

# メイン処理
main() {
    case "${1:-}" in
        deploy)
            deploy_prod
            ;;
        start)
            start_prod
            ;;
        stop)
            stop_prod
            ;;
        restart)
            restart_prod
            ;;
        logs)
            show_logs "${2:-}"
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
        backup)
            backup_db
            ;;
        restore)
            restore_db "${2:-}"
            ;;
        clean)
            clean_all
            ;;
        status)
            show_status
            ;;
        health)
            check_health
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

main "$@"