#!/bin/bash

# Test script for Dependencies API
# Usage: ./test-dependencies.sh

BASE_URL="http://localhost:3001"
PROJECT_ID="550e8400-e29b-41d4-a716-446655440001"
AUTH_HEADER="Authorization: Bearer test-jwt-token"

echo "=== Testing Dependencies API ==="
echo "Base URL: $BASE_URL"
echo "Project ID: $PROJECT_ID"
echo ""

echo "1. Testing GET /projects/${PROJECT_ID}/dependencies (list dependencies)"
echo "================================================="
curl -s -X GET "${BASE_URL}/projects/${PROJECT_ID}/dependencies" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | python3 -m json.tool || echo "Raw response (not JSON)"
echo -e "\n"

echo "2. Testing POST /projects/${PROJECT_ID}/dependencies (create dependency)"
echo "================================================================="
# We need actual issue IDs from the database. Let's use a sample request first:
curl -s -X POST "${BASE_URL}/projects/${PROJECT_ID}/dependencies" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "predecessorId": "550e8400-e29b-41d4-a716-446655440001",
    "successorId": "550e8400-e29b-41d4-a716-446655440002",
    "type": "FS",
    "lag": 0
  }' | python3 -m json.tool || echo "Raw response (not JSON)"
echo -e "\n"

echo "3. Testing GET /projects/${PROJECT_ID}/dependencies (after creation)"
echo "==========================================================="
curl -s -X GET "${BASE_URL}/projects/${PROJECT_ID}/dependencies" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" | python3 -m json.tool || echo "Raw response (not JSON)"
echo -e "\n"

echo "4. Testing error cases"
echo "======================"

echo "4a. Invalid successor ID (should return 404)"
curl -s -X POST "${BASE_URL}/projects/${PROJECT_ID}/dependencies" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "predecessorId": "550e8400-e29b-41d4-a716-446655440001",
    "successorId": "00000000-0000-0000-0000-000000000000",
    "type": "FS",
    "lag": 0
  }' | python3 -m json.tool || echo "Raw response (not JSON)"
echo -e "\n"

echo "4b. Duplicate dependency (should return 409)"
curl -s -X POST "${BASE_URL}/projects/${PROJECT_ID}/dependencies" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "predecessorId": "550e8400-e29b-41d4-a716-446655440001",
    "successorId": "550e8400-e29b-41d4-a716-446655440002",
    "type": "FS",
    "lag": 0
  }' | python3 -m json.tool || echo "Raw response (not JSON)"
echo -e "\n"

echo "=== Test completed ==="