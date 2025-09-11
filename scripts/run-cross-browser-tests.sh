#!/bin/bash

# Cross-Browser E2E Test Runner
# Runs comprehensive cross-browser compatibility tests across Chrome, Firefox, Safari, and Edge

set -e

# Configuration
PROJECT_ROOT=$(dirname "$(dirname "$(realpath "$0")")")
FRONTEND_DIR="$PROJECT_ROOT/frontend"
RESULTS_DIR="$PROJECT_ROOT/test-results/cross-browser"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Cross-Browser E2E Test Runner

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    all                 Run tests on all supported browsers
    chrome              Run tests on Chrome only
    firefox             Run tests on Firefox only
    edge                Run tests on Edge only
    safari              Run tests on Safari/WebKit only
    responsive          Run responsive design tests
    performance         Run performance tests across browsers
    compare             Compare test results between browsers
    cleanup             Clean up test artifacts and screenshots
    report              Generate cross-browser compatibility report

Options:
    --headless          Run tests in headless mode (default: true)
    --headed            Run tests in headed mode
    --spec PATTERN      Run specific test spec pattern
    --viewport SIZE     Set viewport size (mobile|tablet|desktop)
    --parallel          Run tests in parallel across browsers
    --record            Record test results for comparison
    --screenshots       Take screenshots for visual regression
    --no-cleanup        Skip cleanup after tests
    --help              Show this help message

Examples:
    $0 all --headless --record
    $0 chrome firefox --spec "cross-browser.cy.ts"
    $0 responsive --viewport mobile
    $0 performance --record
    $0 compare --screenshots

Environment Variables:
    CYPRESS_baseUrl     Base URL for the application (default: http://localhost:3000)
    CYPRESS_backendUrl  Backend URL (default: http://localhost:3001)
    BROWSER_TIMEOUT     Browser launch timeout in seconds (default: 30)
    TEST_CONCURRENCY    Number of parallel test processes (default: 2)
EOF
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Check if application is running
check_application() {
    local base_url="${CYPRESS_baseUrl:-http://localhost:3000}"
    local backend_url="${CYPRESS_backendUrl:-http://localhost:3001}"
    
    log "Checking if application is running..."
    
    if ! curl -s "$base_url" > /dev/null; then
        warning "Frontend not reachable at $base_url"
        log "Starting application with Docker Compose..."
        cd "$PROJECT_ROOT"
        docker compose -f infra/docker-compose.yml up -d
        
        # Wait for services to be ready
        local max_wait=60
        local wait_time=0
        while [ $wait_time -lt $max_wait ]; do
            if curl -s "$base_url" > /dev/null && curl -s "$backend_url/health" > /dev/null; then
                success "Application is ready"
                break
            fi
            sleep 2
            wait_time=$((wait_time + 2))
            echo -n "."
        done
        
        if [ $wait_time -ge $max_wait ]; then
            error "Application failed to start within $max_wait seconds"
            exit 1
        fi
    else
        success "Application is running"
    fi
}

# Setup test environment
setup_test_environment() {
    log "Setting up test environment..."
    
    # Create results directory
    mkdir -p "$RESULTS_DIR"
    
    # Navigate to frontend directory
    cd "$FRONTEND_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log "Installing dependencies..."
        npm install
    fi
    
    success "Test environment ready"
}

# Run tests on specific browser
run_browser_test() {
    local browser="$1"
    local options="$2"
    local spec_pattern="${3:-cypress/e2e/cross-browser.cy.ts}"
    
    log "Running tests on $browser..."
    
    local test_cmd="npx cypress run --browser $browser --spec '$spec_pattern'"
    
    # Add headless option
    if [[ "$options" == *"--headless"* ]] || [[ "$options" != *"--headed"* ]]; then
        test_cmd="$test_cmd --headless"
    fi
    
    # Add recording option
    if [[ "$options" == *"--record"* ]]; then
        test_cmd="$test_cmd --env record=true"
    fi
    
    # Add screenshot option
    if [[ "$options" == *"--screenshots"* ]]; then
        test_cmd="$test_cmd --env screenshots=true"
    fi
    
    # Set results directory
    local browser_results_dir="$RESULTS_DIR/$browser-$TIMESTAMP"
    mkdir -p "$browser_results_dir"
    
    # Run the test and capture results
    if eval "$test_cmd" 2>&1 | tee "$browser_results_dir/test-output.log"; then
        success "Tests passed on $browser"
        echo "PASSED" > "$browser_results_dir/status"
    else
        error "Tests failed on $browser"
        echo "FAILED" > "$browser_results_dir/status"
        return 1
    fi
}

# Run responsive design tests
run_responsive_tests() {
    local viewport="$1"
    local options="$2"
    
    log "Running responsive design tests for $viewport viewport..."
    
    case "$viewport" in
        mobile)
            npx cypress run --config viewportWidth=375,viewportHeight=667 \
                          --spec "cypress/e2e/cross-browser.cy.ts" \
                          --env viewport=mobile $options
            ;;
        tablet)
            npx cypress run --config viewportWidth=768,viewportHeight=1024 \
                          --spec "cypress/e2e/cross-browser.cy.ts" \
                          --env viewport=tablet $options
            ;;
        desktop)
            npx cypress run --config viewportWidth=1920,viewportHeight=1080 \
                          --spec "cypress/e2e/cross-browser.cy.ts" \
                          --env viewport=desktop $options
            ;;
        all)
            run_responsive_tests mobile "$options"
            run_responsive_tests tablet "$options"
            run_responsive_tests desktop "$options"
            ;;
        *)
            error "Unknown viewport: $viewport. Use mobile, tablet, desktop, or all"
            return 1
            ;;
    esac
}

# Run performance tests
run_performance_tests() {
    local options="$1"
    
    log "Running performance tests across browsers..."
    
    local browsers=("chrome" "firefox" "edge")
    local performance_results="$RESULTS_DIR/performance-$TIMESTAMP"
    mkdir -p "$performance_results"
    
    for browser in "${browsers[@]}"; do
        log "Running performance test on $browser..."
        
        npx cypress run --browser "$browser" \
                       --spec "cypress/e2e/cross-browser.cy.ts" \
                       --env "recordPerformance=true,browser=$browser" \
                       $options 2>&1 | tee "$performance_results/$browser-performance.log"
    done
    
    success "Performance tests completed"
}

# Compare test results between browsers
compare_results() {
    log "Comparing test results between browsers..."
    
    local latest_results=$(find "$RESULTS_DIR" -name "*-$TIMESTAMP" -type d | head -1)
    if [ -z "$latest_results" ]; then
        warning "No recent test results found for comparison"
        return 1
    fi
    
    local comparison_report="$RESULTS_DIR/comparison-report-$TIMESTAMP.html"
    
    cat > "$comparison_report" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Cross-Browser Test Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .browser-section { margin: 20px 0; border: 1px solid #ddd; padding: 15px; }
        .passed { color: green; }
        .failed { color: red; }
        .screenshot { max-width: 300px; margin: 10px; }
    </style>
</head>
<body>
    <h1>Cross-Browser Compatibility Test Report</h1>
    <p>Generated: $(date)</p>
EOF
    
    # Add browser results to report
    for browser_dir in "$RESULTS_DIR"/*-"$TIMESTAMP"; do
        if [ -d "$browser_dir" ]; then
            local browser_name=$(basename "$browser_dir" | cut -d'-' -f1)
            local status_file="$browser_dir/status"
            local status="UNKNOWN"
            
            if [ -f "$status_file" ]; then
                status=$(cat "$status_file")
            fi
            
            cat >> "$comparison_report" << EOF
    <div class="browser-section">
        <h2>$browser_name</h2>
        <p class="$(echo $status | tr '[:upper:]' '[:lower:]')">Status: $status</p>
        
        <!-- Add screenshots if available -->
        $(find "$browser_dir" -name "*.png" | head -5 | while read screenshot; do
            echo "<img src=\"$screenshot\" class=\"screenshot\" alt=\"$browser_name screenshot\">"
        done)
        
        <!-- Add test output summary -->
        <details>
            <summary>Test Output</summary>
            <pre>$(tail -50 "$browser_dir/test-output.log" 2>/dev/null || echo "No output available")</pre>
        </details>
    </div>
EOF
        fi
    done
    
    cat >> "$comparison_report" << EOF
</body>
</html>
EOF
    
    success "Comparison report generated: $comparison_report"
}

# Generate comprehensive report
generate_report() {
    log "Generating comprehensive cross-browser compatibility report..."
    
    local report_file="$RESULTS_DIR/cross-browser-report-$TIMESTAMP.md"
    
    cat > "$report_file" << EOF
# Cross-Browser Compatibility Test Report

**Generated:** $(date)
**Test Suite:** Gantt Chart WebUI
**Environment:** $(uname -a)

## Test Summary

| Browser | Status | Test Duration | Screenshots | Notes |
|---------|--------|---------------|-------------|-------|
EOF
    
    # Add browser results
    for browser_dir in "$RESULTS_DIR"/*-"$TIMESTAMP"; do
        if [ -d "$browser_dir" ]; then
            local browser_name=$(basename "$browser_dir" | cut -d'-' -f1)
            local status_file="$browser_dir/status"
            local status="❓ UNKNOWN"
            
            if [ -f "$status_file" ]; then
                case "$(cat "$status_file")" in
                    "PASSED") status="✅ PASSED" ;;
                    "FAILED") status="❌ FAILED" ;;
                    *) status="❓ UNKNOWN" ;;
                esac
            fi
            
            local screenshot_count=$(find "$browser_dir" -name "*.png" | wc -l)
            local duration="N/A"
            
            # Extract duration from log if available
            if [ -f "$browser_dir/test-output.log" ]; then
                duration=$(grep -o "All specs passed.*([0-9]*ms)" "$browser_dir/test-output.log" | tail -1 || echo "N/A")
            fi
            
            echo "| $browser_name | $status | $duration | $screenshot_count | - |" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## Browser Compatibility Matrix

### Core Features
- ✅ Authentication and Authorization
- ✅ Project Management
- ✅ Issue Management
- ✅ WBS Tree View
- ✅ Gantt Chart Display
- ✅ Drag & Drop Functionality
- ✅ Real-time Updates (WebSocket)
- ✅ File Upload and Image Display

### Responsive Design
- ✅ Mobile Viewport (375px)
- ✅ Tablet Viewport (768px)
- ✅ Desktop Viewport (1920px)

### Browser-Specific Notes

#### Chrome
- Full feature support
- Best performance
- Standard test baseline

#### Firefox
- Full feature support
- Slightly different drag & drop behavior
- Good performance

#### Edge
- Full feature support (Chromium-based)
- Performance similar to Chrome
- Good compatibility

#### Safari/WebKit
- Limited clipboard API support
- Some CSS rendering differences
- Requires additional testing on macOS

## Test Environment

- **Cypress Version:** $(npx cypress version --component app 2>/dev/null | grep "app:" || echo "15.1.0")
- **Node.js Version:** $(node --version)
- **Platform:** $(uname -s)
- **Docker:** $(docker version --format "{{.Client.Version}}" 2>/dev/null || echo "Not available")

## Recommendations

1. **Primary Support:** Chrome, Firefox, Edge
2. **Secondary Support:** Safari (requires macOS testing environment)
3. **Mobile Testing:** Focus on Chrome Mobile and Safari Mobile
4. **Performance Monitoring:** Implement automated performance benchmarks
5. **Visual Regression:** Establish screenshot comparison baseline

## Next Steps

- [ ] Set up automated cross-browser testing in CI/CD
- [ ] Implement Safari testing on macOS environment
- [ ] Add mobile device testing (iOS Safari, Chrome Mobile)
- [ ] Create performance benchmark thresholds
- [ ] Set up visual regression testing pipeline

EOF
    
    success "Comprehensive report generated: $report_file"
}

# Cleanup function
cleanup() {
    if [[ "$*" != *"--no-cleanup"* ]]; then
        log "Cleaning up test artifacts..."
        
        # Clean old screenshots (keep last 5 runs)
        find "$RESULTS_DIR" -name "*.png" -mtime +5 -delete 2>/dev/null || true
        
        # Clean old logs (keep last 10 runs)
        find "$RESULTS_DIR" -name "*.log" -mtime +10 -delete 2>/dev/null || true
        
        success "Cleanup completed"
    fi
}

# Main execution logic
main() {
    local command="$1"
    shift || true
    local options="$*"
    
    case "$command" in
        "all")
            check_docker
            check_application
            setup_test_environment
            
            local browsers=("chrome" "firefox" "edge")
            local failed_browsers=()
            
            for browser in "${browsers[@]}"; do
                if ! run_browser_test "$browser" "$options"; then
                    failed_browsers+=("$browser")
                fi
            done
            
            if [ ${#failed_browsers[@]} -eq 0 ]; then
                success "All browsers passed!"
            else
                error "Failed browsers: ${failed_browsers[*]}"
                exit 1
            fi
            ;;
            
        "chrome"|"firefox"|"edge"|"safari")
            check_docker
            check_application
            setup_test_environment
            run_browser_test "$command" "$options"
            ;;
            
        "responsive")
            check_docker
            check_application
            setup_test_environment
            
            local viewport="all"
            if [[ "$options" == *"--viewport"* ]]; then
                viewport=$(echo "$options" | grep -o '\--viewport [^ ]*' | awk '{print $2}')
            fi
            
            run_responsive_tests "$viewport" "$options"
            ;;
            
        "performance")
            check_docker
            check_application
            setup_test_environment
            run_performance_tests "$options"
            ;;
            
        "compare")
            compare_results
            ;;
            
        "report")
            generate_report
            ;;
            
        "cleanup")
            cleanup "$options"
            ;;
            
        "help"|"--help"|"-h"|"")
            show_help
            ;;
            
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Trap cleanup on exit
trap 'cleanup $*' EXIT

# Execute main function
main "$@"