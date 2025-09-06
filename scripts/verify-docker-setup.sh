#!/bin/bash

# Docker Environment Verification Script
# Validates all acceptance criteria for task_001_2

set -e

echo "🔧 Verifying Docker Development Environment Setup..."
echo "=================================================="

# Function to check if a service is running
check_service() {
    local service=$1
    local container=$2
    
    if docker ps --filter "name=$container" --filter "status=running" | grep -q "$container"; then
        echo "✅ $service is running"
        return 0
    else
        echo "❌ $service is NOT running"
        return 1
    fi
}

# Function to check service health
check_health() {
    local service=$1
    local url=$2
    local timeout=${3:-10}
    
    echo "🔍 Checking $service health at $url..."
    
    if curl -f -s --max-time $timeout "$url" > /dev/null 2>&1; then
        echo "✅ $service health check passed"
        return 0
    else
        echo "❌ $service health check failed"
        return 1
    fi
}

echo ""
echo "1️⃣  Testing: docker-compose -f docker-compose.dev.yml up starts all services"
echo "--------------------------------------------------------------------------"

# Start all services
echo "🚀 Starting all services..."
docker compose -f docker-compose.dev.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to initialize (60 seconds)..."
sleep 60

# Check if all containers are running
echo ""
echo "🔍 Checking container status..."
check_service "PostgreSQL Database" "gantt-postgres-dev"
POSTGRES_OK=$?

check_service "API Service" "gantt-api-dev"
API_OK=$?

check_service "Web Service" "gantt-web-dev"
WEB_OK=$?

echo ""
echo "2️⃣  Testing: PostgreSQL database is accessible and healthy"
echo "--------------------------------------------------------"

if [ $POSTGRES_OK -eq 0 ]; then
    if docker exec gantt-postgres-dev pg_isready -U gantt_user -d gantt_chart_dev; then
        echo "✅ PostgreSQL is accessible and healthy"
        POSTGRES_HEALTH_OK=0
    else
        echo "❌ PostgreSQL health check failed"
        POSTGRES_HEALTH_OK=1
    fi
else
    echo "❌ PostgreSQL container not running, skipping health check"
    POSTGRES_HEALTH_OK=1
fi

echo ""
echo "3️⃣  Testing: Environment variables are properly loaded"
echo "-----------------------------------------------------"

# Check API environment variables
if [ $API_OK -eq 0 ]; then
    ENV_CHECK=$(docker exec gantt-api-dev env | grep -E "(NODE_ENV|DATABASE_URL|JWT_SECRET)" | wc -l)
    if [ $ENV_CHECK -ge 3 ]; then
        echo "✅ API environment variables loaded"
        API_ENV_OK=0
    else
        echo "❌ API environment variables not properly loaded"
        API_ENV_OK=1
    fi
else
    echo "❌ API container not running, skipping env check"
    API_ENV_OK=1
fi

# Check Web environment variables
if [ $WEB_OK -eq 0 ]; then
    ENV_CHECK=$(docker exec gantt-web-dev env | grep -E "(NODE_ENV|NEXT_PUBLIC_API_URL)" | wc -l)
    if [ $ENV_CHECK -ge 2 ]; then
        echo "✅ Web environment variables loaded"
        WEB_ENV_OK=0
    else
        echo "❌ Web environment variables not properly loaded"
        WEB_ENV_OK=1
    fi
else
    echo "❌ Web container not running, skipping env check"
    WEB_ENV_OK=1
fi

echo ""
echo "4️⃣  Testing: Services can communicate with each other"
echo "----------------------------------------------------"

# Test API health endpoint
if [ $API_OK -eq 0 ]; then
    check_health "API Service" "http://localhost:3001/health" 15
    API_HEALTH_OK=$?
else
    echo "❌ API container not running, skipping communication test"
    API_HEALTH_OK=1
fi

# Test Web health endpoint (which tests API communication)
if [ $WEB_OK -eq 0 ]; then
    check_health "Web Service" "http://localhost:3000/api/health" 15
    WEB_HEALTH_OK=$?
else
    echo "❌ Web container not running, skipping communication test"
    WEB_HEALTH_OK=1
fi

echo ""
echo "📊 Summary of Results"
echo "===================="

TOTAL_TESTS=6
PASSED_TESTS=0

[ $POSTGRES_OK -eq 0 ] && ((PASSED_TESTS++)) || echo "❌ PostgreSQL container startup"
[ $POSTGRES_HEALTH_OK -eq 0 ] && ((PASSED_TESTS++)) || echo "❌ PostgreSQL health check"
[ $API_ENV_OK -eq 0 ] && ((PASSED_TESTS++)) || echo "❌ API environment variables"
[ $WEB_ENV_OK -eq 0 ] && ((PASSED_TESTS++)) || echo "❌ Web environment variables"
[ $API_HEALTH_OK -eq 0 ] && ((PASSED_TESTS++)) || echo "❌ API health endpoint"
[ $WEB_HEALTH_OK -eq 0 ] && ((PASSED_TESTS++)) || echo "❌ Web health endpoint"

echo ""
if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo "🎉 All acceptance criteria passed! ($PASSED_TESTS/$TOTAL_TESTS)"
    echo "✅ Docker development environment is fully functional"
    exit 0
else
    echo "⚠️  Some tests failed ($PASSED_TESTS/$TOTAL_TESTS passed)"
    echo "❌ Docker development environment needs attention"
    
    echo ""
    echo "🔧 Container logs for debugging:"
    echo "================================"
    
    if [ $API_OK -ne 0 ] || [ $API_HEALTH_OK -ne 0 ]; then
        echo "--- API Service Logs ---"
        docker logs gantt-api-dev --tail 20 || echo "Could not retrieve API logs"
        echo ""
    fi
    
    if [ $WEB_OK -ne 0 ] || [ $WEB_HEALTH_OK -ne 0 ]; then
        echo "--- Web Service Logs ---"
        docker logs gantt-web-dev --tail 20 || echo "Could not retrieve Web logs"
        echo ""
    fi
    
    exit 1
fi