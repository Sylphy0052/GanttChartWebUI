# Database Rollback Strategy

## Overview
This document provides rollback procedures for the Prisma database schema and data.

## Rollback Procedures

### 1. Schema Rollback

#### Option A: Full Reset (Development Only)
```bash
# WARNING: This will delete all data
npm run prisma:db:reset
```

#### Option B: Migration Rollback (Production Safe)
```bash
# Roll back to a specific migration
npx prisma migrate resolve --rolled-back <migration_name>

# Then apply previous migration
npx prisma migrate deploy
```

### 2. Data Rollback

#### Database Backup Before Changes
```bash
# Create backup
pg_dump -h localhost -p 5432 -U gantt_user gantt_chart_dev > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -h localhost -p 5432 -U gantt_user -d gantt_chart_dev < backup_20250906_120000.sql
```

#### Seed Data Reset
```bash
# Reset to clean state and reseed
npm run db:reset
```

### 3. Emergency Rollback Checklist

1. **Stop Application Services**
   ```bash
   # Stop API server
   pkill -f "nest start"
   
   # Stop web server
   pkill -f "next dev"
   ```

2. **Backup Current State**
   ```bash
   pg_dump gantt_chart_dev > emergency_backup_$(date +%Y%m%d_%H%M%S).sql
   ```

3. **Roll Back Schema**
   ```bash
   # Identify last known good migration
   npx prisma migrate status
   
   # Roll back to that migration
   npx prisma migrate resolve --rolled-back <problematic_migration>
   ```

4. **Restore Data (if needed)**
   ```bash
   psql gantt_chart_dev < last_known_good_backup.sql
   ```

5. **Restart Services**
   ```bash
   npm run start:dev
   ```

### 4. Validation After Rollback

```bash
# Verify schema is correct
npx prisma db pull
npx prisma generate

# Verify data integrity
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM projects;"
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM issues;"
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM dependencies;"

# Test application startup
npm run start:dev
```

### 5. Prevention Best Practices

- Always backup before migrations in production
- Test migrations in development/staging first
- Use `prisma migrate diff` to preview changes
- Keep migration files version controlled
- Document breaking changes clearly

## Contact

For emergency rollback assistance, refer to the development team documentation or create an issue in the project repository.