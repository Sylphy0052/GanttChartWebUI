#!/bin/bash

# ====================
# GanttChart WebUI - Production Deployment Script
# ====================
# 本番環境デプロイ用スクリプト
# 使用方法: ./scripts/deploy-production.sh [start|stop|restart|logs|backup]

set -euo pipefail

# ====================
# Configuration
# ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker-compose.production.yml"
ENV_FILE="$PROJECT_ROOT/.env.production"
BACKUP_DIR="/opt/gantt/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ====================
# Helper Functions
# ====================
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Docker & Docker Compose check
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed"
        exit 1
    fi
    
    # Environment file check
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file not found: $ENV_FILE"
        error "Please copy .env.production.example and configure it"
        exit 1
    fi
    
    # Docker Compose file check
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

create_directories() {
    log "Creating necessary directories..."
    
    # Data directories
    sudo mkdir -p /opt/gantt/data/{postgres,uploads}
    sudo mkdir -p /opt/gantt/logs/{nginx,app}
    sudo mkdir -p /opt/gantt/backups
    sudo mkdir -p "$PROJECT_ROOT/infra/ssl/certs"
    sudo mkdir -p "$PROJECT_ROOT/infra/ssl/private"
    
    # Set proper permissions
    sudo chown -R $USER:docker /opt/gantt/
    sudo chmod -R 755 /opt/gantt/
    
    success "Directories created successfully"
}

# ====================
# Deployment Functions
# ====================
deploy_start() {
    log "Starting production deployment..."
    
    check_prerequisites
    create_directories
    
    # Pull latest images
    log "Pulling Docker images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
    
    # Build and start services
    log "Building and starting services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_health
    
    success "Production deployment completed successfully!"
}

deploy_stop() {
    log "Stopping production services..."
    
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    
    success "Production services stopped"
}

deploy_restart() {
    log "Restarting production services..."
    
    deploy_stop
    sleep 5
    deploy_start
}

show_logs() {
    local service=${1:-}
    
    if [[ -n "$service" ]]; then
        log "Showing logs for service: $service"
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f "$service"
    else
        log "Showing logs for all services"
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
    fi
}

check_health() {
    log "Checking service health..."
    
    # Check PostgreSQL
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres pg_isready &>/dev/null; then
        success "PostgreSQL is healthy"
    else
        error "PostgreSQL is not responding"
        return 1
    fi
    
    # Check Backend
    if curl -f http://localhost:$(grep NGINX_PORT "$ENV_FILE" | cut -d'=' -f2)/health &>/dev/null; then
        success "Backend is healthy"
    else
        error "Backend is not responding"
        return 1
    fi
    
    # Show service status
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    
    success "All services are healthy"
}

backup_data() {
    log "Creating backup..."
    
    local backup_name="gantt_backup_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    # Database backup
    log "Backing up database..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
        pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > "$backup_path/database.sql"
    
    # Upload files backup
    log "Backing up upload files..."
    tar -czf "$backup_path/uploads.tar.gz" -C /opt/gantt/data uploads/
    
    # Configuration backup
    log "Backing up configuration..."
    cp "$ENV_FILE" "$backup_path/"
    cp "$COMPOSE_FILE" "$backup_path/"
    
    # Create backup info
    cat > "$backup_path/backup_info.txt" << EOF
Backup created: $(date)
Database size: $(du -sh /opt/gantt/data/postgres | cut -f1)
Uploads size: $(du -sh /opt/gantt/data/uploads | cut -f1)
Services status:
$(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps)
EOF
    
    success "Backup created: $backup_path"
}

show_status() {
    log "Production Environment Status"
    echo "=============================="
    
    # Service status
    echo "Service Status:"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo
    
    # Resource usage
    echo "Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    echo
    
    # Disk usage
    echo "Disk Usage:"
    df -h /opt/gantt/
    echo
    
    # Recent logs
    echo "Recent Error Logs:"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail=5 | grep -i error || echo "No recent errors"
}

show_help() {
    cat << EOF
GanttChart WebUI - Production Deployment Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    start       Start production services
    stop        Stop production services  
    restart     Restart production services
    logs        Show service logs
    health      Check service health
    backup      Create data backup
    status      Show system status
    help        Show this help message

Examples:
    $0 start                    # Start all services
    $0 logs backend             # Show backend logs
    $0 backup                   # Create backup
    $0 status                   # Show system status

Environment:
    Production config: $ENV_FILE
    Compose file: $COMPOSE_FILE
    Data directory: /opt/gantt/data/
    Backup directory: $BACKUP_DIR
EOF
}

# ====================
# Main Script Logic
# ====================
main() {
    local command=${1:-help}
    
    case "$command" in
        start)
            deploy_start
            ;;
        stop)
            deploy_stop
            ;;
        restart)
            deploy_restart
            ;;
        logs)
            show_logs "${2:-}"
            ;;
        health)
            check_health
            ;;
        backup)
            backup_data
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "Unknown command: $command"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"