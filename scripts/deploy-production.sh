#!/bin/bash
# Production Deployment Script for GanttChartWebUI
# This script handles the safe deployment of the application to production

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Configuration
PROJECT_NAME="GanttChartWebUI"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="./logs/deploy-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Starting pre-deployment checks..."
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root for security reasons"
        exit 1
    fi
    
    # Check required files exist
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Production environment file not found: $ENV_FILE"
        log "Please copy .env.production.template to $ENV_FILE and configure it"
        exit 1
    fi
    
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error "Production compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    # Check Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
        exit 1
    fi
    
    # Check docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        error "docker-compose is not installed"
        exit 1
    fi
    
    # Validate environment variables
    source "$ENV_FILE"
    if [[ "$POSTGRES_PASSWORD" == "CHANGE_ME_STRONG_DATABASE_PASSWORD" ]]; then
        error "Please update POSTGRES_PASSWORD in $ENV_FILE"
        exit 1
    fi
    
    if [[ "$JWT_SECRET" == "CHANGE_ME_STRONG_JWT_SECRET_KEY_64_CHARACTERS_MINIMUM" ]]; then
        error "Please update JWT_SECRET in $ENV_FILE"
        exit 1
    fi
    
    success "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p ./logs
    
    # Backup database if running
    if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        log "Creating database backup..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/database_backup.sql"
        success "Database backup created: $BACKUP_DIR/database_backup.sql"
    else
        warning "Database container not running, skipping database backup"
    fi
    
    # Backup current configuration
    cp "$ENV_FILE" "$BACKUP_DIR/"
    cp "$COMPOSE_FILE" "$BACKUP_DIR/"
    
    success "Configuration backup created in: $BACKUP_DIR"
}

# Build and deploy
deploy() {
    log "Starting deployment..."
    
    # Pull latest images
    log "Pulling latest base images..."
    docker-compose -f "$COMPOSE_FILE" pull postgres redis
    
    # Build application images
    log "Building application images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    
    # Stop existing services gracefully
    log "Stopping existing services..."
    docker-compose -f "$COMPOSE_FILE" down --timeout 30
    
    # Start services
    log "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    success "Services started"
}

# Health checks
health_checks() {
    log "Running health checks..."
    
    # Wait for services to be ready
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Health check attempt $attempt/$max_attempts"
        
        if docker-compose -f "$COMPOSE_FILE" exec -T api curl -f http://localhost:3001/health >/dev/null 2>&1 && \
           docker-compose -f "$COMPOSE_FILE" exec -T web curl -f http://localhost:3000 >/dev/null 2>&1; then
            success "All services are healthy"
            return 0
        fi
        
        log "Services not ready yet, waiting..."
        sleep 10
        ((attempt++))
    done
    
    error "Health checks failed after $max_attempts attempts"
    return 1
}

# Rollback function
rollback() {
    error "Deployment failed, initiating rollback..."
    
    # Stop current services
    docker-compose -f "$COMPOSE_FILE" down --timeout 30
    
    # Restore database if backup exists
    if [[ -f "$BACKUP_DIR/database_backup.sql" ]]; then
        log "Restoring database backup..."
        docker-compose -f "$COMPOSE_FILE" up -d postgres
        sleep 10
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$BACKUP_DIR/database_backup.sql"
    fi
    
    # Restart with previous configuration
    docker-compose -f "$COMPOSE_FILE" up -d
    
    warning "Rollback completed. Please check logs for issues."
}

# Cleanup
cleanup() {
    log "Cleaning up unused Docker resources..."
    docker system prune -f --volumes
    success "Cleanup completed"
}

# Main deployment process
main() {
    log "=== Starting Production Deployment for $PROJECT_NAME ==="
    
    # Trap errors and run rollback
    trap 'rollback; exit 1' ERR
    
    pre_deployment_checks
    create_backup
    deploy
    
    if ! health_checks; then
        error "Health checks failed"
        exit 1
    fi
    
    cleanup
    
    success "=== Production Deployment Completed Successfully ==="
    log "Application is now running:"
    log "- Web UI: http://localhost:3000"
    log "- API: http://localhost:3001"
    log "- Health Check: http://localhost:3001/health"
    log ""
    log "Backup location: $BACKUP_DIR"
    log "Deployment log: $LOG_FILE"
}

# Run main function
main "$@"