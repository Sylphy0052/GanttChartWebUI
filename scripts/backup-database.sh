#!/bin/bash

# ============================================================================
# GanttChart WebUI - 自動バックアップスクリプト
# ============================================================================
# 説明: PostgreSQLデータベース、アップロードファイル、設定ファイルの
#       完全バックアップを実行するスクリプト
# 
# 機能:
# - PostgreSQLデータベースの完全バックアップ
# - アップロード画像ファイルのバックアップ
# - 設定ファイル（.env、docker-compose等）のバックアップ
# - 圧縮・暗号化オプション
# - データ整合性チェック
# - ローテーション管理
# - 詳細ログ出力
# 
# 使用方法:
#   ./backup-database.sh [オプション]
# 
# オプション:
#   -c, --config FILE    設定ファイルを指定
#   -t, --type TYPE      バックアップ種別 (daily|weekly|monthly|yearly)
#   -d, --destination DIR バックアップ保存先ディレクトリ
#   -e, --encrypt        暗号化を有効にする
#   -v, --verbose        詳細出力を有効にする
#   -n, --dry-run        テストモード（実際のバックアップは実行しない）
#   -h, --help           ヘルプを表示
# 
# 戻り値:
#   0: 成功
#   1: 一般的なエラー
#   2: 設定エラー
#   3: データベース接続エラー
#   4: ファイルアクセスエラー
#   5: 暗号化エラー
#   6: 検証エラー
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
BACKUP_TYPE="daily"
DESTINATION_DIR=""
ENABLE_ENCRYPTION=false
VERBOSE=false
DRY_RUN=false

# デフォルトのスクリプトバージョン（設定ファイル読み込み前）
DEFAULT_SCRIPT_VERSION="1.0.0"

# 戻り値定数
readonly EXIT_SUCCESS=0
readonly EXIT_GENERAL_ERROR=1
readonly EXIT_CONFIG_ERROR=2
readonly EXIT_DB_CONNECTION_ERROR=3
readonly EXIT_FILE_ACCESS_ERROR=4
readonly EXIT_ENCRYPTION_ERROR=5
readonly EXIT_VERIFICATION_ERROR=6

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
}

# トラップ設定
trap cleanup EXIT
trap 'error_exit "Script interrupted by user" $EXIT_GENERAL_ERROR' INT TERM

# ============================================================================
# 引数解析
# ============================================================================

show_help() {
    cat << EOF
使用方法: $SCRIPT_NAME [オプション]

GanttChart WebUI の自動バックアップスクリプト

オプション:
  -c, --config FILE    設定ファイルを指定 (デフォルト: $DEFAULT_CONFIG)
  -t, --type TYPE      バックアップ種別 (daily|weekly|monthly|yearly)
  -d, --destination DIR バックアップ保存先ディレクトリ
  -e, --encrypt        暗号化を有効にする
  -v, --verbose        詳細出力を有効にする
  -n, --dry-run        テストモード（実際のバックアップは実行しない）
  -h, --help           このヘルプを表示

例:
  $SCRIPT_NAME                                    # デフォルト設定で実行
  $SCRIPT_NAME -t weekly -e                      # 週次バックアップ、暗号化有効
  $SCRIPT_NAME -c custom.conf -d /backup/dir     # カスタム設定とディレクトリ
  $SCRIPT_NAME -n -v                             # テストモード、詳細出力

戻り値:
  0: 成功
  1: 一般的なエラー
  2: 設定エラー
  3: データベース接続エラー
  4: ファイルアクセスエラー
  5: 暗号化エラー
  6: 検証エラー
EOF
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            -t|--type)
                BACKUP_TYPE="$2"
                shift 2
                ;;
            -d|--destination)
                DESTINATION_DIR="$2"
                shift 2
                ;;
            -e|--encrypt)
                ENABLE_ENCRYPTION=true
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
            -h|--help)
                show_help
                exit $EXIT_SUCCESS
                ;;
            *)
                error_exit "Unknown option: $1" $EXIT_CONFIG_ERROR
                ;;
        esac
    done
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
    
    # コマンドライン引数で設定を上書き
    if [[ -n "$DESTINATION_DIR" ]]; then
        BACKUP_DIR="$DESTINATION_DIR"
    fi
    
    if [[ "$ENABLE_ENCRYPTION" == "true" ]]; then
        ENCRYPTION_ENABLED="true"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        TEST_MODE="true"
    fi
    
    # 必要なディレクトリの作成
    if [[ "$TEST_MODE" != "true" ]]; then
        mkdir -p "$BACKUP_DIR" || error_exit "Cannot create backup directory: $BACKUP_DIR" $EXIT_FILE_ACCESS_ERROR
        chmod "$BACKUP_DIR_PERMISSIONS" "$BACKUP_DIR" 2>/dev/null || true
    fi
    
    # 一時ディレクトリの作成
    TEMP_DIR=$(mktemp -d "${TEMP_DIR}/backup.XXXXXX") || error_exit "Cannot create temporary directory" $EXIT_FILE_ACCESS_ERROR
    
    log_debug "Configuration loaded successfully"
    log_debug "Backup type: $BACKUP_TYPE"
    log_debug "Backup directory: $BACKUP_DIR"
    log_debug "Test mode: $TEST_MODE"
}

# ============================================================================
# 事前チェック
# ============================================================================

check_dependencies() {
    log_info "Checking dependencies..."
    
    local required_commands=("docker" "pg_dump" "tar" "gzip")
    
    if [[ "$ENCRYPTION_ENABLED" == "true" ]]; then
        required_commands+=("gpg")
    fi
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error_exit "Required command not found: $cmd" $EXIT_CONFIG_ERROR
        fi
    done
    
    log_debug "All dependencies satisfied"
}

check_docker_environment() {
    log_info "Checking Docker environment..."
    
    if ! docker info &> /dev/null; then
        error_exit "Docker is not running or not accessible" $EXIT_CONFIG_ERROR
    fi
    
    # PostgreSQLコンテナの存在確認
    if ! docker ps --format "table {{.Names}}" | grep -q "$POSTGRES_CONTAINER"; then
        # より柔軟なコンテナ名検索
        local postgres_container
        postgres_container=$(docker ps --format "{{.Names}}" | grep -i postgres | head -n1)
        if [[ -n "$postgres_container" ]]; then
            POSTGRES_CONTAINER="$postgres_container"
            log_warn "Using detected PostgreSQL container: $POSTGRES_CONTAINER"
        else
            error_exit "PostgreSQL container not found: $POSTGRES_CONTAINER" $EXIT_DB_CONNECTION_ERROR
        fi
    fi
    
    log_debug "Docker environment check passed"
}

check_database_connection() {
    log_info "Checking database connection..."
    
    if ! docker exec "$POSTGRES_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
        error_exit "Cannot connect to PostgreSQL database" $EXIT_DB_CONNECTION_ERROR
    fi
    
    log_debug "Database connection check passed"
}

check_disk_space() {
    log_info "Checking disk space..."
    
    local backup_dir_parent
    backup_dir_parent=$(dirname "$BACKUP_DIR")
    
    local available_space
    available_space=$(df "$backup_dir_parent" | awk 'NR==2 {print $4}')
    
    # 最低限必要な容量（1GB）
    local min_space=1048576  # KB
    
    if [[ "$available_space" -lt "$min_space" ]]; then
        error_exit "Insufficient disk space. Available: ${available_space}KB, Required: ${min_space}KB" $EXIT_FILE_ACCESS_ERROR
    fi
    
    log_debug "Disk space check passed. Available: ${available_space}KB"
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
            error_exit "Another backup process is already running (PID: $lock_pid)" $EXIT_GENERAL_ERROR
        else
            log_warn "Removing stale lock file: $LOCK_FILE"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
    log_debug "Lock acquired: $LOCK_FILE"
}

# ============================================================================
# データベースバックアップ
# ============================================================================

backup_database() {
    log_info "Starting database backup..."
    
    local db_backup_file="$TEMP_DIR/database_${BACKUP_TIMESTAMP}.backup"
    local pg_dump_options=(
        "--format=$DB_BACKUP_FORMAT"
        "--no-owner"
        "--no-privileges"
        "--verbose"
        "--host=$DB_HOST"
        "--port=$DB_PORT"
        "--username=$DB_USER"
        "--dbname=$DB_NAME"
    )
    
    if [[ "$DB_BACKUP_COMPRESS" == "true" ]] && [[ "$DB_BACKUP_FORMAT" == "custom" ]]; then
        pg_dump_options+=("--compress=6")
    fi
    
    log_debug "Database backup options: ${pg_dump_options[*]}"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would execute pg_dump with options: ${pg_dump_options[*]}"
        touch "$db_backup_file"
    else
        local start_time=$(date +%s)
        
        # タイムアウト付きでpg_dumpを実行
        if timeout "$MAX_BACKUP_TIME" docker exec -e PGPASSWORD="$DB_PASSWORD" "$POSTGRES_CONTAINER" \
            pg_dump "${pg_dump_options[@]}" > "$db_backup_file"; then
            
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            log_info "Database backup completed in ${duration} seconds"
            log_debug "Database backup file: $db_backup_file"
            log_debug "Database backup size: $(du -h "$db_backup_file" | cut -f1)"
        else
            error_exit "Database backup failed or timed out" $EXIT_DB_CONNECTION_ERROR
        fi
    fi
    
    # バックアップファイルのサイズチェック
    if [[ "$TEST_MODE" != "true" ]] && [[ ! -s "$db_backup_file" ]]; then
        error_exit "Database backup file is empty: $db_backup_file" $EXIT_DB_CONNECTION_ERROR
    fi
    
    echo "$db_backup_file"
}

# ============================================================================
# ファイルバックアップ
# ============================================================================

backup_files() {
    log_info "Starting file backup..."
    
    local files_backup_file="$TEMP_DIR/files_${BACKUP_TIMESTAMP}.tar"
    local tar_options=(
        "--create"
        "--file=$files_backup_file"
        "--preserve-permissions"
        "--same-owner"
        "--atime-preserve=system"
    )
    
    # 除外パターンの追加
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        tar_options+=("--exclude=$pattern")
    done
    
    if [[ "$VERBOSE" == "true" ]]; then
        tar_options+=("--verbose")
    fi
    
    # バックアップ対象ディレクトリの収集
    local backup_sources=()
    
    # アップロードディレクトリ
    if [[ -d "$UPLOADS_DIR" ]]; then
        backup_sources+=("$UPLOADS_DIR")
        log_debug "Added to backup: $UPLOADS_DIR"
    else
        log_warn "Upload directory not found: $UPLOADS_DIR"
    fi
    
    # ログディレクトリ
    if [[ -d "$LOGS_DIR" ]]; then
        backup_sources+=("$LOGS_DIR")
        log_debug "Added to backup: $LOGS_DIR"
    else
        log_warn "Log directory not found: $LOGS_DIR"
    fi
    
    # 設定ファイル
    local config_files=(
        "$CONFIG_DIR/.env"
        "$CONFIG_DIR/package.json"
        "$CONFIG_DIR/package-lock.json"
        "$CONFIG_DIR/prisma/schema.prisma"
        "$FRONTEND_CONFIG_DIR/package.json"
        "$FRONTEND_CONFIG_DIR/package-lock.json"
        "$FRONTEND_CONFIG_DIR/next.config.js"
        "$DOCKER_COMPOSE_FILE"
    )
    
    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]]; then
            backup_sources+=("$config_file")
            log_debug "Added to backup: $config_file"
        else
            log_warn "Configuration file not found: $config_file"
        fi
    done
    
    if [[ ${#backup_sources[@]} -eq 0 ]]; then
        error_exit "No backup sources found" $EXIT_FILE_ACCESS_ERROR
    fi
    
    log_debug "File backup options: ${tar_options[*]}"
    log_debug "File backup sources: ${backup_sources[*]}"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would execute tar with options: ${tar_options[*]}"
        log_info "TEST MODE: Would backup sources: ${backup_sources[*]}"
        touch "$files_backup_file"
    else
        local start_time=$(date +%s)
        
        if tar "${tar_options[@]}" "${backup_sources[@]}"; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))
            
            log_info "File backup completed in ${duration} seconds"
            log_debug "File backup file: $files_backup_file"
            log_debug "File backup size: $(du -h "$files_backup_file" | cut -f1)"
        else
            error_exit "File backup failed" $EXIT_FILE_ACCESS_ERROR
        fi
    fi
    
    echo "$files_backup_file"
}

# ============================================================================
# 圧縮処理
# ============================================================================

compress_backup() {
    local source_file="$1"
    local compressed_file="$2"
    
    log_info "Compressing backup file..."
    log_debug "Source: $source_file"
    log_debug "Target: $compressed_file"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would compress $source_file to $compressed_file"
        touch "$compressed_file"
        echo "$compressed_file"
        return
    fi
    
    local start_time=$(date +%s)
    
    case "$COMPRESSION_FORMAT" in
        "gz")
            if gzip -c -"$COMPRESSION_LEVEL" "$source_file" > "$compressed_file"; then
                log_debug "Compression completed using gzip"
            else
                error_exit "Compression failed using gzip" $EXIT_FILE_ACCESS_ERROR
            fi
            ;;
        "xz")
            if xz -c -"$COMPRESSION_LEVEL" "$source_file" > "$compressed_file"; then
                log_debug "Compression completed using xz"
            else
                error_exit "Compression failed using xz" $EXIT_FILE_ACCESS_ERROR
            fi
            ;;
        "bzip2")
            if bzip2 -c -"$COMPRESSION_LEVEL" "$source_file" > "$compressed_file"; then
                log_debug "Compression completed using bzip2"
            else
                error_exit "Compression failed using bzip2" $EXIT_FILE_ACCESS_ERROR
            fi
            ;;
        *)
            error_exit "Unsupported compression format: $COMPRESSION_FORMAT" $EXIT_CONFIG_ERROR
            ;;
    esac
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local original_size=$(stat -c%s "$source_file" 2>/dev/null || echo "0")
    local compressed_size=$(stat -c%s "$compressed_file" 2>/dev/null || echo "0")
    
    log_info "Compression completed in ${duration} seconds"
    
    if [[ "$original_size" -gt 0 ]]; then
        local compression_ratio=$((100 - (compressed_size * 100 / original_size)))
        log_debug "Compression ratio: ${compression_ratio}%"
        log_debug "Original size: $(numfmt --to=iec "$original_size")"
        log_debug "Compressed size: $(numfmt --to=iec "$compressed_size")"
    fi
    
    echo "$compressed_file"
}

# ============================================================================
# 暗号化処理
# ============================================================================

encrypt_backup() {
    local source_file="$1"
    local encrypted_file="$2"
    
    log_info "Encrypting backup file..."
    log_debug "Source: $source_file"
    log_debug "Target: $encrypted_file"
    
    if [[ "$ENCRYPTION_ENABLED" != "true" ]]; then
        log_debug "Encryption disabled, skipping"
        echo "$source_file"
        return
    fi
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would encrypt $source_file to $encrypted_file"
        touch "$encrypted_file"
        echo "$encrypted_file"
        return
    fi
    
    # GPG暗号化キーの確認
    if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
        log_warn "Encryption key file not found: $ENCRYPTION_KEY_FILE"
        log_warn "Using recipient: $ENCRYPTION_RECIPIENT"
    fi
    
    local start_time=$(date +%s)
    local gpg_options=(
        "--cipher-algo" "AES256"
        "--compress-algo" "2"
        "--compress-level" "6"
        "--yes"
        "--armor"
        "--encrypt"
        "--recipient" "$ENCRYPTION_RECIPIENT"
        "--output" "$encrypted_file"
    )
    
    if gpg "${gpg_options[@]}" "$source_file"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log_info "Encryption completed in ${duration} seconds"
        log_debug "Encrypted file: $encrypted_file"
        log_debug "Encrypted file size: $(du -h "$encrypted_file" | cut -f1)"
        
        echo "$encrypted_file"
    else
        error_exit "Encryption failed" $EXIT_ENCRYPTION_ERROR
    fi
}

# ============================================================================
# チェックサム生成
# ============================================================================

generate_checksum() {
    local file="$1"
    local checksum_file="${file}.${CHECKSUM_ALGORITHM}"
    
    log_info "Generating checksum..."
    log_debug "File: $file"
    log_debug "Algorithm: $CHECKSUM_ALGORITHM"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would generate $CHECKSUM_ALGORITHM checksum for $file"
        echo "dummy_checksum  $file" > "$checksum_file"
        echo "$checksum_file"
        return
    fi
    
    case "$CHECKSUM_ALGORITHM" in
        "md5")
            md5sum "$file" > "$checksum_file"
            ;;
        "sha1")
            sha1sum "$file" > "$checksum_file"
            ;;
        "sha256")
            sha256sum "$file" > "$checksum_file"
            ;;
        "sha512")
            sha512sum "$file" > "$checksum_file"
            ;;
        *)
            error_exit "Unsupported checksum algorithm: $CHECKSUM_ALGORITHM" $EXIT_CONFIG_ERROR
            ;;
    esac
    
    log_debug "Checksum file: $checksum_file"
    log_debug "Checksum: $(cat "$checksum_file")"
    
    echo "$checksum_file"
}

# ============================================================================
# バックアップ検証
# ============================================================================

verify_backup() {
    local backup_file="$1"
    
    log_info "Verifying backup file..."
    
    if [[ "$VERIFY_BACKUP" != "true" ]]; then
        log_debug "Backup verification disabled"
        return 0
    fi
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would verify backup file: $backup_file"
        return 0
    fi
    
    # ファイル存在確認
    if [[ ! -f "$backup_file" ]]; then
        error_exit "Backup file not found: $backup_file" $EXIT_VERIFICATION_ERROR
    fi
    
    # ファイルサイズ確認
    local file_size
    file_size=$(stat -c%s "$backup_file" 2>/dev/null || echo "0")
    if [[ "$file_size" -eq 0 ]]; then
        error_exit "Backup file is empty: $backup_file" $EXIT_VERIFICATION_ERROR
    fi
    
    # ファイル形式の検証
    local file_type
    file_type=$(file -b "$backup_file")
    log_debug "File type: $file_type"
    
    # チェックサムの検証
    if [[ "$CHECKSUM_FILE_ENABLED" == "true" ]]; then
        local checksum_file="${backup_file}.${CHECKSUM_ALGORITHM}"
        if [[ -f "$checksum_file" ]]; then
            case "$CHECKSUM_ALGORITHM" in
                "md5")
                    if md5sum -c "$checksum_file" &> /dev/null; then
                        log_debug "MD5 checksum verification passed"
                    else
                        error_exit "MD5 checksum verification failed" $EXIT_VERIFICATION_ERROR
                    fi
                    ;;
                "sha256")
                    if sha256sum -c "$checksum_file" &> /dev/null; then
                        log_debug "SHA256 checksum verification passed"
                    else
                        error_exit "SHA256 checksum verification failed" $EXIT_VERIFICATION_ERROR
                    fi
                    ;;
                *)
                    log_warn "Checksum verification not implemented for: $CHECKSUM_ALGORITHM"
                    ;;
            esac
        fi
    fi
    
    log_info "Backup verification completed successfully"
    log_debug "Verified file: $backup_file"
    log_debug "File size: $(numfmt --to=iec "$file_size")"
}

# ============================================================================
# ファイル移動と権限設定
# ============================================================================

finalize_backup() {
    local temp_file="$1"
    local final_file="$2"
    
    log_info "Finalizing backup file..."
    log_debug "Moving from: $temp_file"
    log_debug "Moving to: $final_file"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would move $temp_file to $final_file"
        return 0
    fi
    
    # ファイル移動
    if mv "$temp_file" "$final_file"; then
        log_debug "File moved successfully"
    else
        error_exit "Failed to move backup file to final location" $EXIT_FILE_ACCESS_ERROR
    fi
    
    # 権限設定
    if chmod "$BACKUP_FILE_PERMISSIONS" "$final_file"; then
        log_debug "File permissions set successfully"
    else
        log_warn "Failed to set file permissions: $final_file"
    fi
    
    # チェックサムファイルも移動
    if [[ "$CHECKSUM_FILE_ENABLED" == "true" ]]; then
        local temp_checksum="${temp_file}.${CHECKSUM_ALGORITHM}"
        local final_checksum="${final_file}.${CHECKSUM_ALGORITHM}"
        
        if [[ -f "$temp_checksum" ]]; then
            if mv "$temp_checksum" "$final_checksum"; then
                chmod "$BACKUP_FILE_PERMISSIONS" "$final_checksum" 2>/dev/null || true
                log_debug "Checksum file moved: $final_checksum"
            else
                log_warn "Failed to move checksum file"
            fi
        fi
    fi
    
    log_info "Backup file finalized: $final_file"
}

# ============================================================================
# バックアップローテーション
# ============================================================================

rotate_backups() {
    log_info "Starting backup rotation..."
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would perform backup rotation"
        return 0
    fi
    
    local retention_days
    case "$BACKUP_TYPE" in
        "daily")
            retention_days="$KEEP_DAILY"
            ;;
        "weekly")
            retention_days="$KEEP_WEEKLY"
            ;;
        "monthly")
            retention_days="$KEEP_MONTHLY"
            ;;
        "yearly")
            retention_days="$KEEP_YEARLY"
            ;;
        *)
            log_warn "Unknown backup type: $BACKUP_TYPE, using daily retention"
            retention_days="$KEEP_DAILY"
            ;;
    esac
    
    log_debug "Retention period: $retention_days days for $BACKUP_TYPE backups"
    
    # 古いバックアップファイルの検索と削除
    local deleted_count=0
    while IFS= read -r -d '' file; do
        if rm "$file"; then
            log_debug "Deleted old backup: $file"
            ((deleted_count++))
        else
            log_warn "Failed to delete old backup: $file"
        fi
    done < <(find "$BACKUP_DIR" -name "*_${BACKUP_TYPE}_*" -type f -mtime +"$retention_days" -print0 2>/dev/null)
    
    # チェックサムファイルも削除
    while IFS= read -r -d '' file; do
        if rm "$file"; then
            log_debug "Deleted old checksum: $file"
        else
            log_warn "Failed to delete old checksum: $file"
        fi
    done < <(find "$BACKUP_DIR" -name "*_${BACKUP_TYPE}_*.${CHECKSUM_ALGORITHM}" -type f -mtime +"$retention_days" -print0 2>/dev/null)
    
    if [[ "$deleted_count" -gt 0 ]]; then
        log_info "Deleted $deleted_count old backup files"
    else
        log_debug "No old backup files to delete"
    fi
}

# ============================================================================
# 統計情報の表示
# ============================================================================

show_statistics() {
    local backup_file="$1"
    local end_time=$(date +%s)
    local total_duration=$((end_time - START_TIME))
    
    log_info "=== Backup Statistics ==="
    log_info "Backup type: $BACKUP_TYPE"
    log_info "Total duration: ${total_duration} seconds"
    log_info "Start time: $(date -d "@$START_TIME" '+%Y-%m-%d %H:%M:%S')"
    log_info "End time: $(date -d "@$end_time" '+%Y-%m-%d %H:%M:%S')"
    
    if [[ -f "$backup_file" ]] && [[ "$TEST_MODE" != "true" ]]; then
        local file_size
        file_size=$(stat -c%s "$backup_file" 2>/dev/null || echo "0")
        log_info "Backup file: $backup_file"
        log_info "Backup size: $(numfmt --to=iec "$file_size")"
        
        if [[ "$total_duration" -gt 0 ]]; then
            local throughput=$((file_size / total_duration))
            log_info "Average throughput: $(numfmt --to=iec "$throughput")/s"
        fi
    fi
    
    log_info "Compression: $COMPRESSION_ENABLED ($COMPRESSION_FORMAT)"
    log_info "Encryption: $ENCRYPTION_ENABLED"
    log_info "Verification: $VERIFY_BACKUP"
    log_info "=========================="
}

# ============================================================================
# 通知送信
# ============================================================================

send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ "$EMAIL_ENABLED" == "true" ]]; then
        echo "$message" | mail -s "$EMAIL_SUBJECT - $status" "$EMAIL_TO" 2>/dev/null || \
            log_warn "Failed to send email notification"
    fi
    
    if [[ "$SLACK_ENABLED" == "true" ]] && [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        local payload
        payload=$(cat << EOF
{
    "channel": "$SLACK_CHANNEL",
    "text": "GanttChart Backup $status",
    "attachments": [
        {
            "color": "$([[ "$status" == "SUCCESS" ]] && echo "good" || echo "danger")",
            "text": "$message",
            "ts": $(date +%s)
        }
    ]
}
EOF
        )
        
        curl -X POST -H "Content-type: application/json" \
            --data "$payload" "$SLACK_WEBHOOK_URL" &>/dev/null || \
            log_warn "Failed to send Slack notification"
    fi
}

# ============================================================================
# メイン処理
# ============================================================================

main() {
    log_info "Starting GanttChart WebUI backup process..."
    log_info "PID: $$"
    
    # 引数解析
    parse_arguments "$@"
    
    # ロック取得
    acquire_lock
    
    # 設定読み込み
    load_config
    
    # 設定ファイル読み込み後にバージョン情報を表示
    log_info "Script version: ${BACKUP_SCRIPT_VERSION:-$DEFAULT_SCRIPT_VERSION}"
    
    # 事前チェック
    check_dependencies
    check_docker_environment
    check_database_connection
    check_disk_space
    
    # バックアップファイル名の生成
    local backup_filename="ganttchart_${BACKUP_TYPE}_${BACKUP_TIMESTAMP}"
    local final_backup_file="$BACKUP_DIR/${backup_filename}.tar.gz"
    
    if [[ "$ENCRYPTION_ENABLED" == "true" ]]; then
        final_backup_file="${final_backup_file}.gpg"
    fi
    
    # データベースバックアップ
    local db_backup_file
    db_backup_file=$(backup_database)
    
    # ファイルバックアップ
    local files_backup_file
    files_backup_file=$(backup_files)
    
    # 統合アーカイブの作成
    log_info "Creating integrated backup archive..."
    local integrated_backup="$TEMP_DIR/${backup_filename}.tar"
    
    if [[ "$TEST_MODE" == "true" ]]; then
        log_info "TEST MODE: Would create integrated archive: $integrated_backup"
        touch "$integrated_backup"
    else
        if tar -cf "$integrated_backup" -C "$TEMP_DIR" \
            "$(basename "$db_backup_file")" \
            "$(basename "$files_backup_file")"; then
            log_debug "Integrated archive created: $integrated_backup"
        else
            error_exit "Failed to create integrated archive" $EXIT_FILE_ACCESS_ERROR
        fi
    fi
    
    # 圧縮処理
    local compressed_backup
    if [[ "$COMPRESSION_ENABLED" == "true" ]]; then
        compressed_backup=$(compress_backup "$integrated_backup" "${integrated_backup}.${COMPRESSION_FORMAT}")
    else
        compressed_backup="$integrated_backup"
    fi
    
    # 暗号化処理
    local encrypted_backup
    encrypted_backup=$(encrypt_backup "$compressed_backup" "${compressed_backup}.gpg")
    
    # チェックサム生成
    local checksum_file
    if [[ "$CHECKSUM_FILE_ENABLED" == "true" ]]; then
        checksum_file=$(generate_checksum "$encrypted_backup")
    fi
    
    # バックアップ検証
    verify_backup "$encrypted_backup"
    
    # ファイル移動と権限設定
    finalize_backup "$encrypted_backup" "$final_backup_file"
    
    # バックアップローテーション
    rotate_backups
    
    # 統計情報表示
    show_statistics "$final_backup_file"
    
    # 成功通知
    local success_message="Backup completed successfully
Backup file: $final_backup_file
Backup type: $BACKUP_TYPE
Duration: $(($(date +%s) - START_TIME)) seconds"
    
    send_notification "SUCCESS" "$success_message"
    
    log_info "Backup process completed successfully"
    log_info "Final backup file: $final_backup_file"
}

# ============================================================================
# スクリプト実行
# ============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi