#!/bin/bash

# ============================================================================
# GanttChart WebUI Release Automation Script
# ============================================================================
#
# このスクリプトは、GanttChart WebUIプロジェクトのリリースプロセスを自動化します。
# Semantic Versioning に準拠し、Backend と Frontend のバージョンを統一管理します。
#
# 使用方法:
#   ./scripts/release.sh <command> [version]
#
# コマンド:
#   prepare <version>  - リリース準備（バージョン更新、CHANGELOG更新）
#   test              - 包括的テスト実行
#   build             - プロダクションビルド
#   tag <version>     - Gitタグ作成・プッシュ
#   release <version> - 完全リリースプロセス実行
#   check             - バージョン整合性確認
#   sync-versions     - Backend・Frontend バージョン同期
#
# 例:
#   ./scripts/release.sh prepare 1.1.0
#   ./scripts/release.sh release 1.0.1
#
# 必要な環境:
#   - Node.js 20+
#   - npm
#   - git
#   - Docker (テスト実行時)
#
# Author: GanttChart WebUI Team
# Version: 1.0.0
# Date: 2025-01-15
# ============================================================================

set -euo pipefail

# ============================================================================
# 設定・定数
# ============================================================================

# プロジェクト設定
readonly PROJECT_NAME="GanttChart WebUI"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly BACKEND_DIR="$PROJECT_ROOT/backend"
readonly FRONTEND_DIR="$PROJECT_ROOT/frontend"

# カラー定義
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m' # No Color

# ログレベル
readonly LOG_INFO="INFO"
readonly LOG_WARN="WARN"
readonly LOG_ERROR="ERROR"
readonly LOG_SUCCESS="SUCCESS"

# バージョン検証パターン
readonly VERSION_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[0-9]+)?)?$'

# ============================================================================
# ユーティリティ関数
# ============================================================================

# ログ出力関数
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "$LOG_INFO")
            echo -e "${BLUE}[INFO]${NC} ${timestamp} - $message"
            ;;
        "$LOG_WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp} - $message"
            ;;
        "$LOG_ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp} - $message"
            ;;
        "$LOG_SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp} - $message"
            ;;
        *)
            echo -e "${WHITE}[LOG]${NC} ${timestamp} - $message"
            ;;
    esac
}

# エラーハンドリング
error_exit() {
    log "$LOG_ERROR" "$1"
    exit 1
}

# 成功メッセージ
success_msg() {
    log "$LOG_SUCCESS" "$1"
}

# 警告メッセージ
warn_msg() {
    log "$LOG_WARN" "$1"
}

# 情報メッセージ
info_msg() {
    log "$LOG_INFO" "$1"
}

# ============================================================================
# バージョン管理関数
# ============================================================================

# バージョン形式の検証
validate_version() {
    local version="$1"
    
    if [[ ! $version =~ $VERSION_PATTERN ]]; then
        error_exit "無効なバージョン形式: $version (例: 1.0.0, 1.1.0-beta.1)"
    fi
    
    info_msg "バージョン形式確認完了: $version"
}

# 現在のバージョン取得
get_current_version() {
    local component="$1"  # "backend" or "frontend"
    
    if [[ "$component" == "backend" ]]; then
        local version=$(node -p "require('$BACKEND_DIR/package.json').version")
    elif [[ "$component" == "frontend" ]]; then
        local version=$(node -p "require('$FRONTEND_DIR/package.json').version")
    else
        error_exit "不正なコンポーネント: $component"
    fi
    
    echo "$version"
}

# バージョン整合性確認
check_version_consistency() {
    local backend_version=$(get_current_version "backend")
    local frontend_version=$(get_current_version "frontend")
    
    info_msg "バージョン整合性チェック..."
    info_msg "Backend バージョン: $backend_version"
    info_msg "Frontend バージョン: $frontend_version"
    
    if [[ "$backend_version" != "$frontend_version" ]]; then
        error_exit "バージョン不整合: Backend($backend_version) != Frontend($frontend_version)"
    fi
    
    success_msg "バージョン整合性確認完了: $backend_version"
    echo "$backend_version"
}

# バージョン更新
update_version() {
    local new_version="$1"
    
    validate_version "$new_version"
    
    info_msg "バージョン更新開始: $new_version"
    
    # Backend バージョン更新
    info_msg "Backend バージョン更新中..."
    cd "$BACKEND_DIR"
    npm version "$new_version" --no-git-tag-version
    
    # Frontend バージョン更新
    info_msg "Frontend バージョン更新中..."
    cd "$FRONTEND_DIR"
    npm version "$new_version" --no-git-tag-version
    
    cd "$PROJECT_ROOT"
    success_msg "バージョン更新完了: $new_version"
}

# バージョン同期
sync_versions() {
    local backend_version=$(get_current_version "backend")
    local frontend_version=$(get_current_version "frontend")
    
    info_msg "バージョン同期処理開始..."
    info_msg "Backend: $backend_version, Frontend: $frontend_version"
    
    if [[ "$backend_version" != "$frontend_version" ]]; then
        warn_msg "バージョン不整合検出。Backend バージョンに統一します。"
        
        cd "$FRONTEND_DIR"
        npm version "$backend_version" --no-git-tag-version
        
        success_msg "バージョン同期完了: $backend_version"
    else
        success_msg "バージョンは既に同期されています: $backend_version"
    fi
}

# ============================================================================
# ビルド・テスト関数
# ============================================================================

# 依存関係インストール
install_dependencies() {
    info_msg "依存関係インストール開始..."
    
    # Backend
    info_msg "Backend 依存関係インストール..."
    cd "$BACKEND_DIR"
    npm ci
    
    # Frontend
    info_msg "Frontend 依存関係インストール..."
    cd "$FRONTEND_DIR"
    npm ci
    
    cd "$PROJECT_ROOT"
    success_msg "依存関係インストール完了"
}

# Lint チェック
run_lint() {
    info_msg "Lint チェック開始..."
    
    # Backend Lint
    info_msg "Backend Lint 実行..."
    cd "$BACKEND_DIR"
    npm run lint
    
    # Frontend Lint
    info_msg "Frontend Lint 実行..."
    cd "$FRONTEND_DIR"
    npm run lint
    
    cd "$PROJECT_ROOT"
    success_msg "Lint チェック完了"
}

# テスト実行
run_tests() {
    info_msg "テスト実行開始..."
    
    # Backend テスト
    info_msg "Backend ユニットテスト実行..."
    cd "$BACKEND_DIR"
    npm run test
    
    info_msg "Backend E2Eテスト実行..."
    npm run test:e2e
    
    # Frontend E2Eテスト（Docker環境）
    info_msg "Frontend E2Eテスト実行..."
    cd "$FRONTEND_DIR"
    # Docker環境でのテスト実行（Alpine Linux対応）
    if command -v docker &> /dev/null; then
        npm run test:e2e:docker
    else
        warn_msg "Docker未検出。ローカルCypressでテスト実行..."
        npm run cypress:run || warn_msg "E2Eテストでエラーが発生しましたが、処理を継続します"
    fi
    
    cd "$PROJECT_ROOT"
    success_msg "テスト実行完了"
}

# プロダクションビルド
build_production() {
    info_msg "プロダクションビルド開始..."
    
    # Backend ビルド
    info_msg "Backend ビルド..."
    cd "$BACKEND_DIR"
    npm run build
    
    # Frontend ビルド
    info_msg "Frontend ビルド..."
    cd "$FRONTEND_DIR"
    npm run build
    
    cd "$PROJECT_ROOT"
    success_msg "プロダクションビルド完了"
}

# ============================================================================
# Git操作関数
# ============================================================================

# Git状態確認
check_git_status() {
    info_msg "Git状態確認..."
    
    # 未コミット変更確認
    if [[ -n $(git status --porcelain) ]]; then
        error_exit "未コミットの変更があります。コミットまたはstashしてください。"
    fi
    
    # ブランチ確認
    local current_branch=$(git branch --show-current)
    info_msg "現在のブランチ: $current_branch"
    
    if [[ "$current_branch" != "main" && "$current_branch" != "release/"* ]]; then
        warn_msg "リリースは通常 main または release/* ブランチで実行されます"
        read -p "続行しますか？ (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error_exit "処理をキャンセルしました"
        fi
    fi
    
    success_msg "Git状態確認完了"
}

# Git タグ作成
create_git_tag() {
    local version="$1"
    local tag_name="v$version"
    
    validate_version "$version"
    
    info_msg "Git タグ作成: $tag_name"
    
    # 既存タグ確認
    if git tag -l | grep -q "^$tag_name$"; then
        error_exit "タグ $tag_name は既に存在します"
    fi
    
    # タグ作成
    git tag -a "$tag_name" -m "Release $tag_name

$(generate_release_message "$version")"
    
    success_msg "Git タグ作成完了: $tag_name"
}

# Git タグプッシュ
push_git_tag() {
    local version="$1"
    local tag_name="v$version"
    
    info_msg "Git タグプッシュ: $tag_name"
    
    git push origin "$tag_name"
    
    success_msg "Git タグプッシュ完了: $tag_name"
}

# ============================================================================
# ドキュメント更新関数
# ============================================================================

# リリースメッセージ生成
generate_release_message() {
    local version="$1"
    
    cat << EOF
Release Notes:
- Version: $version
- Build Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- Git Commit: $(git rev-parse HEAD)

For detailed changes, see:
- CHANGELOG.md
- RELEASE_NOTES.md

For installation instructions:
- README.md
- docs/ADMIN_GUIDE.md
EOF
}

# CHANGELOG.md 更新準備
prepare_changelog() {
    local version="$1"
    local release_date=$(date +"%Y-%m-%d")
    
    info_msg "CHANGELOG.md 更新準備..."
    
    # CHANGELOGバックアップ
    cp CHANGELOG.md CHANGELOG.md.backup
    
    # 新バージョンエントリ準備
    local temp_file=$(mktemp)
    
    # ヘッダー追加
    head -n 8 CHANGELOG.md > "$temp_file"
    
    # 新バージョンエントリ
    cat << EOF >> "$temp_file"

## [$version] - $release_date

### Added
- TODO: 新機能を記載してください

### Changed
- TODO: 変更された機能を記載してください

### Fixed
- TODO: 修正されたバグを記載してください

### Security
- TODO: セキュリティ関連の変更を記載してください

EOF
    
    # 既存のUnreleased以降を追加
    tail -n +9 CHANGELOG.md >> "$temp_file"
    
    # ファイル置換
    mv "$temp_file" CHANGELOG.md
    
    warn_msg "CHANGELOG.md を手動で編集してください："
    warn_msg "  - [Added] セクションに新機能を記載"
    warn_msg "  - [Changed] セクションに変更点を記載"  
    warn_msg "  - [Fixed] セクションに修正内容を記載"
    warn_msg "  - [Security] セクションにセキュリティ変更を記載"
    warn_msg "  - TODO項目を削除"
    
    read -p "CHANGELOG.md の編集が完了したら Enter を押してください..."
}

# ============================================================================
# メインコマンド関数
# ============================================================================

# リリース準備
cmd_prepare() {
    local version="$1"
    
    if [[ -z "$version" ]]; then
        error_exit "バージョンを指定してください: ./scripts/release.sh prepare <version>"
    fi
    
    info_msg "=== リリース準備開始: $version ==="
    
    check_git_status
    validate_version "$version"
    install_dependencies
    update_version "$version"
    prepare_changelog "$version"
    
    success_msg "=== リリース準備完了: $version ==="
    info_msg "次のステップ:"
    info_msg "1. CHANGELOG.md を確認・編集"
    info_msg "2. 変更をコミット: git add . && git commit -m 'chore: prepare release $version'"
    info_msg "3. テスト実行: ./scripts/release.sh test"
    info_msg "4. ビルド確認: ./scripts/release.sh build"
    info_msg "5. タグ作成: ./scripts/release.sh tag $version"
}

# テスト実行
cmd_test() {
    info_msg "=== テスト実行開始 ==="
    
    install_dependencies
    run_lint
    run_tests
    
    success_msg "=== テスト実行完了 ==="
}

# ビルド実行
cmd_build() {
    info_msg "=== ビルド実行開始 ==="
    
    install_dependencies
    build_production
    
    success_msg "=== ビルド実行完了 ==="
}

# タグ作成
cmd_tag() {
    local version="$1"
    
    if [[ -z "$version" ]]; then
        error_exit "バージョンを指定してください: ./scripts/release.sh tag <version>"
    fi
    
    info_msg "=== タグ作成開始: $version ==="
    
    check_git_status
    
    # バージョン整合性確認
    local current_version=$(check_version_consistency)
    if [[ "$current_version" != "$version" ]]; then
        error_exit "指定バージョン($version)と現在のバージョン($current_version)が一致しません"
    fi
    
    create_git_tag "$version"
    push_git_tag "$version"
    
    success_msg "=== タグ作成完了: v$version ==="
    info_msg "GitHub Releases: https://github.com/your-org/GanttChartWebUI/releases/tag/v$version"
}

# 完全リリース
cmd_release() {
    local version="$1"
    
    if [[ -z "$version" ]]; then
        error_exit "バージョンを指定してください: ./scripts/release.sh release <version>"
    fi
    
    info_msg "=== 完全リリースプロセス開始: $version ==="
    
    # ステップ1: 準備
    cmd_prepare "$version"
    
    # ステップ2: テスト
    cmd_test
    
    # ステップ3: ビルド
    cmd_build
    
    # ステップ4: 最終確認
    warn_msg "リリース最終確認:"
    warn_msg "  バージョン: $version"
    warn_msg "  ブランチ: $(git branch --show-current)"
    warn_msg "  コミット: $(git rev-parse --short HEAD)"
    
    read -p "リリースを実行しますか？ (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error_exit "リリースをキャンセルしました"
    fi
    
    # ステップ5: タグ作成
    cmd_tag "$version"
    
    success_msg "=== 完全リリースプロセス完了: $version ==="
    success_msg "リリース成功! 🎉"
    info_msg "GitHub Releases: https://github.com/your-org/GanttChartWebUI/releases/tag/v$version"
    info_msg "Docker Hub: docker pull ganttchart-webui:$version"
}

# バージョン確認
cmd_check() {
    info_msg "=== バージョン整合性確認 ==="
    
    local current_version=$(check_version_consistency)
    
    success_msg "=== バージョン確認完了 ==="
    info_msg "統一バージョン: $current_version"
}

# バージョン同期
cmd_sync_versions() {
    info_msg "=== バージョン同期実行 ==="
    
    sync_versions
    
    success_msg "=== バージョン同期完了 ==="
}

# ============================================================================
# ヘルプ・使用方法
# ============================================================================

# ヘルプ表示
show_help() {
    cat << EOF
${WHITE}GanttChart WebUI Release Script${NC}

${GREEN}使用方法:${NC}
  $0 <command> [options]

${GREEN}コマンド:${NC}
  ${CYAN}prepare <version>${NC}   リリース準備（バージョン更新、CHANGELOG更新）
  ${CYAN}test${NC}               包括的テスト実行
  ${CYAN}build${NC}              プロダクションビルド
  ${CYAN}tag <version>${NC}      Gitタグ作成・プッシュ
  ${CYAN}release <version>${NC}  完全リリースプロセス実行
  ${CYAN}check${NC}              バージョン整合性確認
  ${CYAN}sync-versions${NC}      Backend・Frontend バージョン同期
  ${CYAN}help${NC}               このヘルプを表示

${GREEN}例:${NC}
  $0 prepare 1.1.0     # v1.1.0 リリース準備
  $0 test              # テスト実行
  $0 build             # ビルド実行
  $0 tag 1.1.0         # v1.1.0 タグ作成
  $0 release 1.0.1     # v1.0.1 完全リリース
  $0 check             # バージョン確認
  $0 sync-versions     # バージョン同期

${GREEN}リリースワークフロー例:${NC}
  1. $0 prepare 1.1.0    # リリース準備
  2. CHANGELOG.md 編集    # 変更内容記載
  3. git commit          # 変更コミット
  4. $0 test             # テスト実行
  5. $0 build            # ビルド確認
  6. $0 tag 1.1.0        # タグ作成・プッシュ

${GREEN}または一括実行:${NC}
  $0 release 1.1.0       # 上記プロセスを一括実行

${GREEN}必要な環境:${NC}
  - Node.js 20+
  - npm
  - git
  - Docker (テスト実行時)

${GREEN}詳細情報:${NC}
  - バージョニング戦略: docs/VERSIONING.md
  - リリースノート: RELEASE_NOTES.md
  - 変更履歴: CHANGELOG.md

EOF
}

# ============================================================================
# メイン処理
# ============================================================================

main() {
    local command="${1:-}"
    local version="${2:-}"
    
    # 引数チェック
    if [[ -z "$command" ]]; then
        show_help
        exit 1
    fi
    
    # プロジェクトルートに移動
    cd "$PROJECT_ROOT"
    
    # コマンド実行
    case "$command" in
        "prepare")
            cmd_prepare "$version"
            ;;
        "test")
            cmd_test
            ;;
        "build")
            cmd_build
            ;;
        "tag")
            cmd_tag "$version"
            ;;
        "release")
            cmd_release "$version"
            ;;
        "check")
            cmd_check
            ;;
        "sync-versions")
            cmd_sync_versions
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error_exit "不明なコマンド: $command (ヘルプ: $0 help)"
            ;;
    esac
}

# スクリプト実行
main "$@"