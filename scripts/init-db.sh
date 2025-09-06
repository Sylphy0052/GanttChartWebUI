#!/bin/bash
# Database initialization script for PostgreSQL

set -e

echo "🔧 Initializing Gantt Chart database..."

# Wait for PostgreSQL to be ready
until pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run any additional initialization if needed
echo "📊 Database initialization completed successfully!"