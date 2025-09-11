#!/bin/bash

# E2E Testing Script for GanttChart WebUI
# This script bypasses Alpine Linux constraints by using Ubuntu-based Cypress

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker-compose.test.yml"
ENV_FILE="$PROJECT_ROOT/.env"
TIMEOUT=300  # 5 minutes timeout

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to cleanup on exit
cleanup() {
    if [ "$CLEANUP_ON_EXIT" = "true" ]; then
        print_status "Cleaning up test environment..."
        cd "$PROJECT_ROOT"
        docker compose -f "$COMPOSE_FILE" --profile test down -v --remove-orphans > /dev/null 2>&1 || true
        docker compose -f "$COMPOSE_FILE" --profile report down -v --remove-orphans > /dev/null 2>&1 || true
    fi
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to check if environment file exists
check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warning "Environment file not found at $ENV_FILE"
        print_status "Creating default environment file..."
        cat > "$ENV_FILE" << 'EOF'
# Database Configuration
POSTGRES_USER=gantt_user
POSTGRES_PASSWORD=gantt_pass
POSTGRES_DB=gantt_db_test

# Application Configuration
NODE_ENV=test
BACKEND_PORT=3001
FRONTEND_PORT=3000
EOF
        print_success "Default environment file created"
    fi
}

# Function to wait for service health
wait_for_service() {
    local service_name="$1"
    local max_attempts=60
    local attempt=0

    print_status "Waiting for $service_name to be healthy..."
    
    while [ $attempt -lt $max_attempts ]; do
        if docker compose -f "$COMPOSE_FILE" ps --format json | jq -r ".[] | select(.Service==\"$service_name\") | .Health" | grep -q "healthy"; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        sleep 5
        attempt=$((attempt + 1))
        echo -n "."
    done
    
    echo
    print_error "$service_name failed to become healthy within ${max_attempts} attempts"
    print_status "Service logs:"
    docker compose -f "$COMPOSE_FILE" logs "$service_name" --tail 50
    return 1
}

# Function to run specific test spec
run_specific_test() {
    local spec_pattern="$1"
    print_status "Running specific test: $spec_pattern"
    
    docker compose -f "$COMPOSE_FILE" --profile test run --rm \
        -e CYPRESS_spec="$spec_pattern" \
        cypress-runner \
        npx cypress run --config-file cypress.config.docker.ts --spec "$spec_pattern" --browser chrome --headless
}

# Function to run all tests
run_all_tests() {
    print_status "Running all E2E tests with Ubuntu-based Cypress..."
    
    # Run Cypress tests
    if docker compose -f "$COMPOSE_FILE" --profile test run --rm cypress-runner; then
        print_success "All E2E tests completed successfully"
        return 0
    else
        print_error "Some E2E tests failed"
        return 1
    fi
}

# Function to generate test reports
generate_reports() {
    print_status "Generating test reports..."
    
    # Check if reports exist
    if docker volume inspect gantt_cypress_reports > /dev/null 2>&1; then
        docker compose -f "$COMPOSE_FILE" --profile report run --rm test-reporter
        print_success "Test reports generated"
        
        # Copy reports to local directory
        local reports_dir="$PROJECT_ROOT/test-reports"
        mkdir -p "$reports_dir"
        
        # Create a temporary container to copy files
        docker run --rm -v gantt_test_reports:/reports -v "$reports_dir":/output alpine:latest \
            sh -c "cp -r /reports/output/* /output/ 2>/dev/null || echo 'No output files found'"
        
        print_status "Reports available in: $reports_dir"
    else
        print_warning "No test reports found"
    fi
}

# Function to show test results
show_results() {
    print_status "Test execution summary:"
    
    # Get container exit codes and logs
    local cypress_logs=$(docker compose -f "$COMPOSE_FILE" logs cypress-runner --tail 20 2>/dev/null || echo "No logs available")
    
    if echo "$cypress_logs" | grep -q "All specs passed"; then
        print_success " All tests passed"
    elif echo "$cypress_logs" | grep -q "failed"; then
        print_error "L Some tests failed"
    else
        print_warning "  Test results unclear"
    fi
    
    # Show video and screenshot locations
    print_status "Test artifacts:"
    echo "  =ù Videos: docker volume gantt_cypress_videos"
    echo "  =ø Screenshots: docker volume gantt_cypress_screenshots"
    echo "  =Ë Reports: docker volume gantt_cypress_reports"
}

# Main execution function
main() {
    local command="${1:-all}"
    local spec_pattern="$2"
    
    # Set cleanup flag
    CLEANUP_ON_EXIT="${CLEANUP:-true}"
    trap cleanup EXIT
    
    print_status "Starting GanttChart WebUI E2E Tests"
    print_status "Alpine Linux constraints bypassed with Ubuntu-based Cypress"
    print_status "=============================================="
    
    # Preliminary checks
    check_docker
    check_env_file
    
    cd "$PROJECT_ROOT"
    
    # Start services
    print_status "Starting test environment services..."
    docker compose -f "$COMPOSE_FILE" up -d postgres-test backend-test frontend-test
    
    # Wait for services to be healthy
    wait_for_service "postgres-test"
    wait_for_service "backend-test"
    wait_for_service "frontend-test"
    
    # Run tests based on command
    case "$command" in
        "all")
            run_all_tests
            ;;
        "spec")
            if [ -z "$spec_pattern" ]; then
                print_error "Spec pattern required for 'spec' command"
                print_status "Usage: $0 spec 'cypress/e2e/specific-test.cy.ts'"
                exit 1
            fi
            run_specific_test "$spec_pattern"
            ;;
        "reports")
            generate_reports
            exit 0
            ;;
        "status")
            docker compose -f "$COMPOSE_FILE" ps
            exit 0
            ;;
        "logs")
            local service="${spec_pattern:-cypress-runner}"
            docker compose -f "$COMPOSE_FILE" logs "$service"
            exit 0
            ;;
        "cleanup")
            print_status "Cleaning up test environment..."
            docker compose -f "$COMPOSE_FILE" --profile test down -v --remove-orphans
            docker compose -f "$COMPOSE_FILE" --profile report down -v --remove-orphans
            docker volume prune -f
            print_success "Cleanup completed"
            exit 0
            ;;
        *)
            print_error "Unknown command: $command"
            print_status "Available commands:"
            echo "  all              - Run all E2E tests (default)"
            echo "  spec <pattern>   - Run specific test spec"
            echo "  reports          - Generate test reports only"
            echo "  status           - Show service status"
            echo "  logs [service]   - Show service logs"
            echo "  cleanup          - Clean up test environment"
            exit 1
            ;;
    esac
    
    # Generate reports if tests were run
    if [ "$command" = "all" ] || [ "$command" = "spec" ]; then
        generate_reports
        show_results
    fi
}

# Help function
show_help() {
    echo "GanttChart WebUI E2E Test Runner"
    echo "================================"
    echo ""
    echo "This script bypasses Alpine Linux Cypress constraints by using Ubuntu-based Cypress."
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  all                    Run all E2E tests (default)"
    echo "  spec <test-pattern>    Run specific test spec"
    echo "  reports               Generate test reports only"
    echo "  status                Show Docker services status"
    echo "  logs [service-name]   Show service logs"
    echo "  cleanup               Clean up test environment"
    echo "  help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 all                               # Run all tests"
    echo "  $0 spec 'cypress/e2e/issues.cy.ts'  # Run specific test"
    echo "  $0 spec 'cypress/e2e/wbs-*.cy.ts'   # Run WBS tests"
    echo "  $0 reports                           # Generate reports only"
    echo "  $0 cleanup                           # Clean up environment"
    echo ""
    echo "Environment Variables:"
    echo "  CLEANUP=false         Skip cleanup on exit"
    echo "  TIMEOUT=300           Service startup timeout in seconds"
    echo ""
}

# Execute main function or show help
if [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_help
else
    main "$@"
fi