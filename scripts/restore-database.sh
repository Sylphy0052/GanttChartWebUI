#!/bin/bash

# ============================================================================
# GanttChart WebUI - リストアスクリプト
# ============================================================================
# 説明: バックアップファイルからPostgreSQLデータベース、ファイル、
#       設定を復旧するスクリプト
# 
# 機能:
# - データベースリストア（Dockerコンテナ対応）
# - ファイルリストア（uploads, logs, configs）
# - 暗号化されたバックアップの復号化
# - バージョン互換性チェック
# - 段階的リストア（データベース→ファイル→検証）
# - ロールバック機能
# - ダウンタイム最小化
# 
# 使用方法:
#   ./restore-database.sh [オプション] <バックアップファイル>
# 
# オプション:
#   -c, --config FILE      設定ファイルを指定
#   -t, --target-env ENV   対象環境 (development|staging|production)
#   -d, --decrypt          暗号化されたバックアップを復号化
#   -k, --keep-existing    既存データを保持（マージモード）
#   -f, --force            確認なしで実行
#   -v, --verbose          詳細出力
#   -n, --dry-run          テストモード
#   -b, --backup-current   リストア前に現在のデータをバックアップ
#   -r, --rollback         前回のリストアをロールバック
#   -h, --help             ヘルプを表示
# 
# 戻り値:
#   0: 成功
#   1: 一般的なエラー
#   2: 設定エラー
#   3: データベースエラー
#   4: ファイルアクセスエラー
#   5: 復号化エラー
#   6: 検証エラー
#   7: バージョン非互換エラー
# ============================================================================

set -euo pipefail

# ============================================================================
# グローバル変数と初期設定
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "$0")"
START_TIME=$(date +%s)

# デフォルト設定
DEFAULT_CONFIG="$SCRIPT_DIR/backup-config.conf"
CONFIG_FILE="$DEFAULT_CONFIG"
TARGET_ENV="development"
BACKUP_FILE=""
DECRYPT_MODE=false
KEEP_EXISTING=false
FORCE_MODE=false
VERBOSE=false
DRY_RUN=false
BACKUP_CURRENT=false
ROLLBACK_MODE=false

# 戻り値定数
readonly EXIT_SUCCESS=0
readonly EXIT_GENERAL_ERROR=1
readonly EXIT_CONFIG_ERROR=2
readonly EXIT_DB_ERROR=3
readonly EXIT_FILE_ACCESS_ERROR=4
readonly EXIT_DECRYPTION_ERROR=5
readonly EXIT_VERIFICATION_ERROR=6
readonly EXIT_VERSION_ERROR=7

# ============================================================================
# ユーティリティ関数
# ============================================================================

# ログ出力関数
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" | tee -a "${LOG_FILE:-/dev/null}"
    
    if [[ "$level" == "ERROR" ]]; then
        echo "[$timestamp] [$level] $message" >&2
    fi
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }
log_debug() { 
    if [[ "${DEBUG_MODE:-false}" == "true" ]] || [[ "$VERBOSE" == "true" ]]; then
        log "DEBUG" "$@"
    fi
}

# エラーハンドリング
error_exit() {
    local exit_code="${2:-$EXIT_GENERAL_ERROR}"
    log_error "$1"
    cleanup
    exit "$exit_code"
}

# クリーンアップ関数
cleanup() {
    log_debug "Cleaning up temporary files..."
    
    if [[ -n "${TEMP_DIR:-}" ]] && [[ -d "$TEMP_DIR" ]]; then
        if [[ "${SECURE_DELETE:-false}" == "true" ]]; then
            find "$TEMP_DIR" -type f -exec shred -vfz -n 3 {} \; 2>/dev/null || true
        fi
        rm -rf "$TEMP_DIR" 2>/dev/null || true
    fi
    
    # ロックファイルの削除
    if [[ -n "${LOCK_FILE:-}" ]] && [[ -f "$LOCK_FILE" ]]; then
        rm -f "$LOCK_FILE" 2>/dev/null || true
    fi
    
    # 一時的なDockerサービス停止の復旧
    if [[ "${DOCKER_SERVICES_STOPPED:-false}" == "true" ]]; then
        log_info "Restarting Docker services..."
        docker compose -f "$DOCKER_COMPOSE_FILE" up -d 2>/dev/null || true
    fi
}

# トラップ設定
trap cleanup EXIT
trap 'error_exit "Script interrupted by user" $EXIT_GENERAL_ERROR' INT TERM

# ============================================================================
# 引数解析
# ============================================================================

show_help() {
    cat << EOF
使用方法: $SCRIPT_NAME [オプション] <バックアップファイル>

GanttChart WebUI のリストアスクリプト

オプション:
  -c, --config FILE      設定ファイルを指定 (デフォルト: $DEFAULT_CONFIG)
  -t, --target-env ENV   対象環境 (development|staging|production)
  -d, --decrypt          暗号化されたバックアップを復号化
  -k, --keep-existing    既存データを保持（マージモード）
  -f, --force            確認なしで実行
  -v, --verbose          詳細出力を有効にする
  -n, --dry-run          テストモード（実際のリストアは実行しない）
  -b, --backup-current   リストア前に現在のデータをバックアップ
  -r, --rollback         前回のリストアをロールバック
  -h, --help             このヘルプを表示

引数:
  <バックアップファイル>  リストアするバックアップファイルのパス

例:
  $SCRIPT_NAME backup.tar.gz                    # 基本的なリストア
  $SCRIPT_NAME -d -v backup.tar.gz.gpg          # 暗号化バックアップの復号化リストア
  $SCRIPT_NAME -t production -f backup.tar.gz   # 本番環境への強制リストア
  $SCRIPT_NAME -b -k backup.tar.gz              # 現在データをバックアップしてマージリストア
  $SCRIPT_NAME -n backup.tar.gz                 # テストモード
  $SCRIPT_NAME -r                               # 前回のリストアをロールバック

戻り値:
  0: 成功
  1: 一般的なエラー
  2: 設定エラー
  3: データベースエラー
  4: ファイルアクセスエラー
  5: 復号化エラー
  6: 検証エラー
  7: バージョン非互換エラー
EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            -t|--target-env)
                TARGET_ENV="$2"
                shift 2
                ;;
            -d|--decrypt)
                DECRYPT_MODE=true
                shift
                ;;
            -k|--keep-existing)
                KEEP_EXISTING=true
                shift
                ;;
            -f|--force)
                FORCE_MODE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -b|--backup-current)
                BACKUP_CURRENT=true
                shift
                ;;
            -r|--rollback)
                ROLLBACK_MODE=true
                shift
                ;;
            -h|--help)
                show_help
                exit $EXIT_SUCCESS
                ;;
            -*)
                error_exit "Unknown option: $1" $EXIT_CONFIG_ERROR
                ;;
            *)
                if [[ -z "$BACKUP_FILE" ]]; then
                    BACKUP_FILE="$1"
                else
                    error_exit "Multiple backup files specified" $EXIT_CONFIG_ERROR
                fi
                shift
                ;;
        esac
    done
    
    # ロールバックモード以外では、バックアップファイルが必須
    if [[ "$ROLLBACK_MODE" != "true" ]] && [[ -z "$BACKUP_FILE" ]]; then
        error_exit "Backup file must be specified" $EXIT_CONFIG_ERROR
    fi
}

# ============================================================================
# 設定読み込み
# ============================================================================

load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        error_exit "Configuration file not found: $CONFIG_FILE" $EXIT_CONFIG_ERROR
    fi
    
    log_info "Loading configuration from: $CONFIG_FILE"
    # shellcheck source=./backup-config.conf
    source "$CONFIG_FILE"
    
    # 環境固有の設定
    case "$TARGET_ENV" in
        "production")
            log_warn "Production environment detected - extra caution required"
            if [[ "$FORCE_MODE" != "true" ]]; then
                log_warn "Production restore requires --force flag for safety"
                read -p "Are you sure you want to restore to production? [y/N]: " -r
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    error_exit "Restore cancelled by user" $EXIT_SUCCESS
                fi
            fi
            ;;
        "staging")
            log_info "Staging environment detected"
            ;;
        "development")
            log_info "Development environment detected"
            ;;
        *)
            error_exit "Unknown target environment: $TARGET_ENV" $EXIT_CONFIG_ERROR
            ;;
    esac
    
    # テストモード設定
    if [[ "$DRY_RUN" == "true" ]]; then
        TEST_MODE="true"
        log_info "Test mode enabled - no actual changes will be made"
    fi
    
    # 一時ディレクトリの作成
    TEMP_DIR=$(mktemp -d "${TEMP_DIR}/restore.XXXXXX") || error_exit "Cannot create temporary directory" $EXIT_FILE_ACCESS_ERROR
    
    log_debug "Configuration loaded successfully"
}

# ============================================================================
# 事前チェック
# ============================================================================

check_dependencies() {
    log_info "Checking dependencies..."
    
    local required_commands=("docker" "pg_restore" "tar" "gzip")
    
    if [[ "$DECRYPT_MODE" == "true" ]]; then
        required_commands+=("gpg")
    fi
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error_exit "Required command not found: $cmd" $EXIT_CONFIG_ERROR
        fi
    done
    
    log_debug "All dependencies satisfied"
}

check_backup_file() {
    if [[ "$ROLLBACK_MODE" == "true" ]]; then
        log_debug "Rollback mode - skipping backup file check"
        return 0
    fi
    
    log_info "Checking backup file..."
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        error_exit "Backup file not found: $BACKUP_FILE" $EXIT_FILE_ACCESS_ERROR
    fi
    
    if [[ ! -r "$BACKUP_FILE" ]]; then
        error_exit "Backup file is not readable: $BACKUP_FILE" $EXIT_FILE_ACCESS_ERROR
    fi
    
    local file_size
    file_size=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || echo "0")
    if [[ "$file_size" -eq 0 ]]; then
        error_exit "Backup file is empty: $BACKUP_FILE" $EXIT_FILE_ACCESS_ERROR
    fi
    
    log_info "Backup file check passed: $(numfmt --to=iec "$file_size")"
}

check_docker_environment() {
    log_info "Checking Docker environment..."
    
    if ! docker info &> /dev/null; then
        error_exit "Docker is not running or not accessible" $EXIT_CONFIG_ERROR
    fi
    
    # PostgreSQLコンテナの存在確認
    if ! docker ps --format "table {{.Names}}" | grep -q "$POSTGRES_CONTAINER"; then
        local postgres_container
        postgres_container=$(docker ps --format "{{.Names}}" | grep -i postgres | head -n1)
        if [[ -n "$postgres_container" ]]; then
            POSTGRES_CONTAINER="$postgres_container"
            log_warn "Using detected PostgreSQL container: $POSTGRES_CONTAINER"
        else
            error_exit "PostgreSQL container not found: $POSTGRES_CONTAINER" $EXIT_DB_ERROR
        fi
    fi
    
    log_debug "Docker environment check passed"
}

check_target_environment() {
    log_info "Checking target environment compatibility..."
    
    # データベース接続確認
    if ! docker exec "$POSTGRES_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
        if [[ "$KEEP_EXISTING" != "true" ]]; then
            log_warn "Database not accessible - will attempt to create"
        else
            error_exit "Cannot connect to existing database for merge mode" $EXIT_DB_ERROR
        fi
    fi
    
    # バージョン互換性確認
    local current_db_version
    current_db_version=$(docker exec "$POSTGRES_CONTAINER" postgres --version 2>/dev/null | grep -oP '\d+\.\d+' | head -n1 || echo "unknown")
    
    log_debug "Current PostgreSQL version: $current_db_version"
    
    # 対応バージョンチェック
    local version_supported=false
    for supported_version in "${SUPPORTED_DB_VERSIONS[@]}"; do
        if [[ "$current_db_version" == "$supported_version"* ]]; then
            version_supported=true
            break
        fi
    done
    
    if [[ "$version_supported" != "true" ]]; then
        log_warn "PostgreSQL version may not be fully supported: $current_db_version"
        if [[ "$FORCE_MODE" != "true" ]]; then
            read -p "Continue anyway? [y/N]: " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                error_exit "Restore cancelled due to version compatibility" $EXIT_VERSION_ERROR
            fi
        fi
    fi
    
    log_debug "Environment compatibility check passed"
}

# ============================================================================
# ロック管理
# ============================================================================

acquire_lock() {
    LOCK_FILE="/tmp/${SCRIPT_NAME}.lock"
    
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid
        lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        
        if [[ -n "$lock_pid" ]] && kill -0 "$lock_pid" 2>/dev/null; then
            error_exit "Another restore process is already running (PID: $lock_pid)" $EXIT_GENERAL_ERROR
        else
            log_warn "Removing stale lock file: $LOCK_FILE"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
    log_debug "Lock acquired: $LOCK_FILE"
}

# ============================================================================
# バックアップファイル処理
# ============================================================================

decrypt_backup() {
    local encrypted_file="$1"
    local decrypted_file="$2"
    
    if [[ "$DECRYPT_MODE" != "true" ]]; then
        echo "$encrypted_file"
        return 0
    fi
    
    log_info "Decrypting backup file..."
    log_debug "Encrypted file: $encrypted_file"
    log_debug "Decrypted file: $decrypted_file"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would decrypt $encrypted_file to $decrypted_file"
        touch "$decrypted_file"
        echo "$decrypted_file"
        return 0
    fi
    
    local start_time=$(date +%s)
    
    if gpg --batch --yes --decrypt --output "$decrypted_file" "$encrypted_file"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "Decryption completed in ${duration} seconds"
        log_debug "Decrypted file size: $(du -h "$decrypted_file" | cut -f1)"
        
        echo "$decrypted_file"
    else
        error_exit "Decryption failed" $EXIT_DECRYPTION_ERROR
    fi
}

extract_backup() {
    local backup_file="$1"
    local extract_dir="$2"
    
    log_info "Extracting backup file..."
    log_debug "Backup file: $backup_file"
    log_debug "Extract directory: $extract_dir"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would extract $backup_file to $extract_dir"
        mkdir -p "$extract_dir"
        touch "$extract_dir/database_dummy.backup"
        touch "$extract_dir/files_dummy.tar"
        return 0
    fi
    
    local start_time=$(date +%s)
    
    # ファイル形式の自動検出
    local file_type
    file_type=$(file -b "$backup_file")
    
    case "$file_type" in
        *"gzip compressed"*)
            if tar -xzf "$backup_file" -C "$extract_dir"; then
                log_debug "Extracted gzip archive successfully"
            else
                error_exit "Failed to extract gzip archive" $EXIT_FILE_ACCESS_ERROR
            fi
            ;;
        *"tar archive"*)
            if tar -xf "$backup_file" -C "$extract_dir"; then
                log_debug "Extracted tar archive successfully"
            else
                error_exit "Failed to extract tar archive" $EXIT_FILE_ACCESS_ERROR
            fi
            ;;
        *"XZ compressed"*)
            if tar -xJf "$backup_file" -C "$extract_dir"; then
                log_debug "Extracted XZ archive successfully"
            else
                error_exit "Failed to extract XZ archive" $EXIT_FILE_ACCESS_ERROR
            fi
            ;;
        *"bzip2 compressed"*)
            if tar -xjf "$backup_file" -C "$extract_dir"; then
                log_debug "Extracted bzip2 archive successfully"
            else
                error_exit "Failed to extract bzip2 archive" $EXIT_FILE_ACCESS_ERROR
            fi
            ;;
        *)
            error_exit "Unsupported backup file format: $file_type" $EXIT_FILE_ACCESS_ERROR
            ;;
    esac
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "Extraction completed in ${duration} seconds"
    
    # 抽出されたファイルの確認
    local extracted_files
    extracted_files=$(find "$extract_dir" -type f | wc -l)
    log_debug "Extracted $extracted_files files"
    
    if [[ "$extracted_files" -eq 0 ]]; then
        error_exit "No files extracted from backup" $EXIT_FILE_ACCESS_ERROR
    fi
}

# ============================================================================
# 現在データのバックアップ
# ============================================================================

backup_current_data() {
    if [[ "$BACKUP_CURRENT" != "true" ]]; then
        log_debug "Current data backup disabled"
        return 0
    fi
    
    log_info "Backing up current data before restore..."
    
    local current_backup_dir="$TEMP_DIR/current_backup"
    mkdir -p "$current_backup_dir"
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local current_backup_file="$BACKUP_DIR/pre_restore_backup_$timestamp.tar.gz"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would backup current data to $current_backup_file"
        return 0
    fi
    
    # 現在のバックアップスクリプトを呼び出し
    if [[ -x "$SCRIPT_DIR/backup-database.sh" ]]; then
        log_debug "Using existing backup script for current data"
        
        if "$SCRIPT_DIR/backup-database.sh" -t "pre_restore" -d "$BACKUP_DIR"; then
            log_info "Current data backup completed"
            CURRENT_BACKUP_CREATED="$current_backup_file"
        else
            log_warn "Current data backup failed, but continuing with restore"
        fi
    else
        log_warn "Backup script not found, skipping current data backup"
    fi
}

# ============================================================================
# データベースリストア
# ============================================================================

prepare_database() {
    log_info "Preparing database for restore..."
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would prepare database"
        return 0
    fi
    
    if [[ "$KEEP_EXISTING" != "true" ]]; then
        log_info "Dropping and recreating database..."
        
        # 接続を強制終了
        docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c \
            "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
        
        # データベース削除・再作成
        docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" || \
            error_exit "Failed to drop database" $EXIT_DB_ERROR
        
        docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" || \
            error_exit "Failed to create database" $EXIT_DB_ERROR
        
        log_debug "Database prepared successfully"
    else
        log_info "Keeping existing database for merge mode"
    fi
}

restore_database() {
    local db_backup_file="$1"
    
    log_info "Starting database restore..."
    log_debug "Database backup file: $db_backup_file"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would restore database from $db_backup_file"
        return 0
    fi
    
    if [[ ! -f "$db_backup_file" ]]; then
        error_exit "Database backup file not found: $db_backup_file" $EXIT_FILE_ACCESS_ERROR
    fi
    
    # pg_restore オプション設定
    local pg_restore_options=(
        "--verbose"
        "--clean"
        "--no-owner"
        "--no-privileges"
        "--host=$DB_HOST"
        "--port=$DB_PORT"
        "--username=$DB_USER"
        "--dbname=$DB_NAME"
    )
    
    if [[ "$KEEP_EXISTING" == "true" ]]; then
        pg_restore_options+=("--data-only")
        log_debug "Using data-only mode for merge"
    fi
    
    log_debug "pg_restore options: ${pg_restore_options[*]}"
    
    local start_time=$(date +%s)
    
    # データベースファイルをコンテナ内にコピー
    local container_backup_file="/tmp/$(basename "$db_backup_file")"
    
    if docker cp "$db_backup_file" "$POSTGRES_CONTAINER:$container_backup_file"; then
        log_debug "Database backup file copied to container"
    else
        error_exit "Failed to copy database backup to container" $EXIT_DB_ERROR
    fi
    
    # リストア実行
    if docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
        pg_restore "${pg_restore_options[@]}" "$container_backup_file"; then
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "Database restore completed in ${duration} seconds"
        
        # 一時ファイル削除
        docker exec "$POSTGRES_CONTAINER" rm -f "$container_backup_file" 2>/dev/null || true
    else
        local exit_code=$?
        docker exec "$POSTGRES_CONTAINER" rm -f "$container_backup_file" 2>/dev/null || true
        
        if [[ "$KEEP_EXISTING" == "true" ]] && [[ $exit_code -eq 1 ]]; then
            log_warn "Some conflicts occurred during merge, but restore may have partially succeeded"
        else
            error_exit "Database restore failed with exit code: $exit_code" $EXIT_DB_ERROR
        fi
    fi
}

# ============================================================================
# ファイルリストア
# ============================================================================

restore_files() {
    local files_backup_file="$1"
    
    log_info "Starting file restore..."
    log_debug "Files backup file: $files_backup_file"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would restore files from $files_backup_file"
        return 0
    fi
    
    if [[ ! -f "$files_backup_file" ]]; then
        error_exit "Files backup file not found: $files_backup_file" $EXIT_FILE_ACCESS_ERROR
    fi
    
    local start_time=$(date +%s)
    local extract_dir="$TEMP_DIR/files_restore"
    
    mkdir -p "$extract_dir"
    
    # ファイルアーカイブを展開
    if tar -xf "$files_backup_file" -C "$extract_dir"; then
        log_debug "Files archive extracted successfully"
    else
        error_exit "Failed to extract files archive" $EXIT_FILE_ACCESS_ERROR
    fi
    
    # ファイルの復元
    local restored_count=0
    
    # アップロードファイルの復元
    local uploads_restore_path="$extract_dir/$(basename "$UPLOADS_DIR")"
    if [[ -d "$uploads_restore_path" ]]; then
        log_info "Restoring upload files..."
        
        if [[ "$KEEP_EXISTING" != "true" ]]; then
            rm -rf "$UPLOADS_DIR" 2>/dev/null || true
            mkdir -p "$(dirname "$UPLOADS_DIR")"
        fi
        
        if cp -r "$uploads_restore_path" "$(dirname "$UPLOADS_DIR")/"; then
            local file_count
            file_count=$(find "$UPLOADS_DIR" -type f 2>/dev/null | wc -l)
            log_debug "Restored $file_count upload files"
            ((restored_count += file_count))
        else
            log_warn "Failed to restore upload files"
        fi
    else
        log_debug "No upload files found in backup"
    fi
    
    # ログファイルの復元（オプション）
    local logs_restore_path="$extract_dir/$(basename "$LOGS_DIR")"
    if [[ -d "$logs_restore_path" ]]; then
        log_info "Restoring log files..."
        
        if [[ "$KEEP_EXISTING" != "true" ]]; then
            rm -rf "$LOGS_DIR" 2>/dev/null || true
            mkdir -p "$(dirname "$LOGS_DIR")"
        fi
        
        if cp -r "$logs_restore_path" "$(dirname "$LOGS_DIR")/"; then
            local log_count
            log_count=$(find "$LOGS_DIR" -type f 2>/dev/null | wc -l)
            log_debug "Restored $log_count log files"
            ((restored_count += log_count))
        else
            log_warn "Failed to restore log files"
        fi
    else
        log_debug "No log files found in backup"
    fi
    
    # 設定ファイルの復元
    log_info "Restoring configuration files..."
    
    local config_files=(
        ".env:$CONFIG_DIR/.env"
        "package.json:$CONFIG_DIR/package.json"
        "package-lock.json:$CONFIG_DIR/package-lock.json"
        "schema.prisma:$CONFIG_DIR/prisma/schema.prisma"
    )
    
    for config_mapping in "${config_files[@]}"; do
        local backup_name="${config_mapping%%:*}"
        local restore_path="${config_mapping##*:}"
        local backup_config_path="$extract_dir/$backup_name"
        
        if [[ -f "$backup_config_path" ]]; then
            if [[ "$KEEP_EXISTING" == "true" ]] && [[ -f "$restore_path" ]]; then
                log_debug "Skipping existing config file: $restore_path"
                continue
            fi
            
            mkdir -p "$(dirname "$restore_path")"
            
            if cp "$backup_config_path" "$restore_path"; then
                log_debug "Restored config file: $restore_path"
                ((restored_count++))
            else
                log_warn "Failed to restore config file: $restore_path"
            fi
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "File restore completed in ${duration} seconds"
    log_info "Total files restored: $restored_count"
}

# ============================================================================
# リストア後検証
# ============================================================================

verify_restore() {
    log_info "Verifying restore results..."
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would verify restore results"
        return 0
    fi
    
    local verification_failed=false
    
    # データベース接続確認
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
        log_debug "Database connection verified"
    else
        log_error "Database connection verification failed"
        verification_failed=true
    fi
    
    # テーブル存在確認
    local table_count
    table_count=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    
    if [[ "$table_count" -gt 0 ]]; then
        log_debug "Database tables verified: $table_count tables found"
    else
        log_error "No database tables found"
        verification_failed=true
    fi
    
    # 主要ファイルの存在確認
    local key_files=(
        "$UPLOADS_DIR"
        "$CONFIG_DIR/.env"
        "$CONFIG_DIR/prisma/schema.prisma"
    )
    
    for file in "${key_files[@]}"; do
        if [[ -e "$file" ]]; then
            log_debug "Key file/directory verified: $file"
        else
            log_warn "Key file/directory not found: $file"
        fi
    done
    
    # データ整合性チェック
    if [[ "$VERIFY_INTEGRITY" == "true" ]]; then
        log_info "Running data integrity checks..."
        
        # プロジェクトテーブルのレコード数確認
        local project_count
        project_count=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
            psql -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT COUNT(*) FROM \"Project\" WHERE \"is_deleted\" = false;" 2>/dev/null | tr -d ' ' || echo "0")
        
        log_debug "Active projects in database: $project_count"
        
        # 課題テーブルのレコード数確認
        local issue_count
        issue_count=$(docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
            psql -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT COUNT(*) FROM \"Issue\" WHERE \"is_deleted\" = false;" 2>/dev/null | tr -d ' ' || echo "0")
        
        log_debug "Active issues in database: $issue_count"
    fi
    
    if [[ "$verification_failed" == "true" ]]; then
        error_exit "Restore verification failed" $EXIT_VERIFICATION_ERROR
    fi
    
    log_info "Restore verification completed successfully"
}

# ============================================================================
# サービス再起動
# ============================================================================

restart_services() {
    log_info "Restarting services..."
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would restart services"
        return 0
    fi
    
    # Docker Composeサービスの再起動
    if docker compose -f "$DOCKER_COMPOSE_FILE" restart; then
        log_info "Services restarted successfully"
        
        # ヘルスチェック
        local max_attempts=30
        local attempt=1
        
        while [[ $attempt -le $max_attempts ]]; do
            if docker compose -f "$DOCKER_COMPOSE_FILE" ps --filter "health=healthy" | grep -q "healthy"; then
                log_info "Services are healthy"
                break
            fi
            
            if [[ $attempt -eq $max_attempts ]]; then
                log_warn "Services health check timeout"
                break
            fi
            
            log_debug "Waiting for services to become healthy (attempt $attempt/$max_attempts)"
            sleep 10
            ((attempt++))
        done
    else
        log_warn "Failed to restart services"
    fi
}

# ============================================================================
# ロールバック機能
# ============================================================================

rollback_restore() {
    log_info "Starting rollback process..."
    
    if [[ -z "${CURRENT_BACKUP_CREATED:-}" ]]; then
        error_exit "No current backup available for rollback" $EXIT_GENERAL_ERROR
    fi
    
    if [[ ! -f "$CURRENT_BACKUP_CREATED" ]]; then
        error_exit "Current backup file not found: $CURRENT_BACKUP_CREATED" $EXIT_FILE_ACCESS_ERROR
    fi
    
    log_info "Rolling back to: $CURRENT_BACKUP_CREATED"
    
    # 自分自身を再帰的に呼び出してロールバック実行
    if "$0" -f "$CURRENT_BACKUP_CREATED"; then
        log_info "Rollback completed successfully"
        rm -f "$CURRENT_BACKUP_CREATED" 2>/dev/null || true
    else
        error_exit "Rollback failed" $EXIT_GENERAL_ERROR
    fi
}

# ============================================================================
# 統計情報の表示
# ============================================================================

show_statistics() {
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    log_info "=== Restore Statistics ==="
    log_info "Target environment: $TARGET_ENV"
    log_info "Total duration: ${total_duration} seconds"
    log_info "Start time: $(date -d "@$START_TIME" '+%Y-%m-%d %H:%M:%S')"
    log_info "End time: $(date -d "@$end_time" '+%Y-%m-%d %H:%M:%S')"
    
    if [[ -n "$BACKUP_FILE" ]]; then
        log_info "Backup file: $BACKUP_FILE"
        
        if [[ -f "$BACKUP_FILE" ]] && [[ "$TEST_MODE" != "true" ]]; then
            local file_size
            file_size=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || echo "0")
            log_info "Backup size: $(numfmt --to=iec "$file_size")"
        fi
    fi
    
    log_info "Decryption: $DECRYPT_MODE"
    log_info "Keep existing: $KEEP_EXISTING"
    log_info "Current backup: $BACKUP_CURRENT"
    log_info "=========================="
}

# ============================================================================
# メイン処理
# ============================================================================

main() {
    log_info "Starting GanttChart WebUI restore process..."
    log_info "Script version: ${BACKUP_SCRIPT_VERSION:-1.0.0}"
    log_info "PID: $$"
    
    # 引数解析
    parse_arguments "$@"
    
    # ロック取得
    acquire_lock
    
    # 設定読み込み
    load_config
    
    # ロールバックモードの処理
    if [[ "$ROLLBACK_MODE" == "true" ]]; then
        rollback_restore
        return $EXIT_SUCCESS
    fi
    
    # 事前チェック
    check_dependencies
    check_backup_file
    check_docker_environment
    check_target_environment
    
    # 現在データのバックアップ
    backup_current_data
    
    # バックアップファイルの処理
    local working_backup_file="$BACKUP_FILE"
    
    # 復号化処理
    if [[ "$DECRYPT_MODE" == "true" ]]; then
        local decrypted_file="$TEMP_DIR/$(basename "$BACKUP_FILE" .gpg)"
        working_backup_file=$(decrypt_backup "$working_backup_file" "$decrypted_file")
    fi
    
    # バックアップファイルの展開
    local extract_dir="$TEMP_DIR/extracted"
    mkdir -p "$extract_dir"
    extract_backup "$working_backup_file" "$extract_dir"
    
    # データベースとファイルの特定
    local db_backup_file
    local files_backup_file
    
    db_backup_file=$(find "$extract_dir" -name "*database*" -type f | head -n1)
    files_backup_file=$(find "$extract_dir" -name "*files*" -type f | head -n1)
    
    if [[ -z "$db_backup_file" ]]; then
        error_exit "Database backup file not found in archive" $EXIT_FILE_ACCESS_ERROR
    fi
    
    if [[ -z "$files_backup_file" ]]; then
        log_warn "Files backup not found in archive"
    fi
    
    log_debug "Database backup: $db_backup_file"
    log_debug "Files backup: $files_backup_file"
    
    # データベースの準備とリストア
    prepare_database
    restore_database "$db_backup_file"
    
    # ファイルのリストア
    if [[ -n "$files_backup_file" ]]; then
        restore_files "$files_backup_file"
    fi
    
    # リストア後検証
    verify_restore
    
    # サービス再起動
    restart_services
    
    # 統計情報表示
    show_statistics
    
    log_info "Restore process completed successfully"
    
    if [[ -n "${CURRENT_BACKUP_CREATED:-}" ]]; then
        log_info "Pre-restore backup created: $CURRENT_BACKUP_CREATED"
        log_info "Use --rollback option to revert if needed"
    fi
}

# ============================================================================
# スクリプト実行
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi