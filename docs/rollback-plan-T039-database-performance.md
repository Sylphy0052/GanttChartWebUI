# T039 Database Performance Optimization - Rollback Plan

## Overview
This document provides a comprehensive rollback strategy for the T039 Database Query Performance & Indexing Optimization implementation in case performance issues or unexpected behavior occur.

## Rollback Scenarios

### Scenario 1: Database Migration Issues
**Symptoms**: Migration fails or causes database errors

**Immediate Actions**:
```bash
# 1. Stop the application
npm run stop

# 2. Rollback the database migration
cd apps/api
npm run prisma:migrate:reset --skip-seed

# 3. Restore from backup (if needed)
pg_restore -d gantt_db backup_pre_t039.sql

# 4. Start with original schema
npm run prisma:db:push
npm run start:dev
```

### Scenario 2: Performance Degradation
**Symptoms**: Queries are slower after optimization, high CPU usage

**Step-by-Step Rollback**:

1. **Disable Performance Monitoring** (reduces overhead):
   ```typescript
   // In prisma.service.ts - remove performance monitoring
   constructor() {
     super({
       datasourceUrl: process.env.DATABASE_URL,
       log: ['error'], // Minimal logging
     });
   }
   ```

2. **Switch to Original Services**:
   ```typescript
   // In projects.module.ts
   providers: [
     ProjectsService, // Keep original
     // ProjectsOptimizedService, // Comment out
     // PrismaPerformanceService, // Comment out
   ]
   ```

3. **Remove Problematic Indexes** (if write performance affected):
   ```sql
   -- Remove indexes causing issues
   DROP INDEX IF EXISTS "issues_project_parent_order_status_idx";
   DROP INDEX IF EXISTS "dependencies_project_pred_succ_idx";
   DROP INDEX IF EXISTS "project_members_user_active_role_idx";
   -- Add others if needed
   ```

### Scenario 3: Application Errors
**Symptoms**: New services causing runtime errors, API failures

**Quick Fix**:
```typescript
// 1. Comment out PerformanceModule in app.module.ts
imports: [
  // PerformanceModule, // Disable
]

// 2. Revert to original ProjectsService only
providers: [
  ProjectsService, // Original working service
]
```

## File-by-File Rollback Instructions

### Core Database Changes

**File**: `apps/api/prisma/schema.prisma`
- **Action**: No changes made, no rollback needed
- **Note**: All optimizations were done via migrations

**File**: `apps/api/prisma/migrations/20250907_001_performance_indexes/migration.sql`
- **Rollback**: Delete the entire migration directory
- **Command**: 
  ```bash
  rm -rf prisma/migrations/20250907_001_performance_indexes/
  npm run prisma:migrate:reset --skip-seed
  ```

### Service Layer Changes

**File**: `apps/api/src/prisma/prisma.service.ts`
- **Original Backup**: Create backup before changes
- **Rollback**: Replace with original simple version:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Disconnected from database');
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}
```

**Files to Remove** (New files that can be safely deleted):
- `apps/api/src/prisma/prisma-performance.service.ts`
- `apps/api/src/projects/projects-optimized.service.ts`  
- `apps/api/src/performance/performance.controller.ts`
- `apps/api/src/performance/performance.module.ts`

### Module Configuration Rollback

**File**: `apps/api/src/app.module.ts`
```typescript
// Remove PerformanceModule import and usage
imports: [
  // Remove this line:
  // PerformanceModule,
]
```

**File**: `apps/api/src/projects/projects.module.ts`
```typescript
// Revert to original simple version
providers: [
  ProjectsService,      // Keep
  ProjectAuthService,   // Keep
  // Remove these:
  // ProjectsOptimizedService,
  // PrismaPerformanceService,
]
```

## Validation Steps After Rollback

### 1. Database Verification
```sql
-- Check that original indexes still exist
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Verify data integrity
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM issues;
SELECT COUNT(*) FROM dependencies;
```

### 2. API Testing
```bash
# Test critical endpoints
curl -X GET http://localhost:3000/projects
curl -X GET http://localhost:3000/projects/{id}/gantt
curl -X GET http://localhost:3000/projects/{id}/wbs

# Check response times are reasonable (< 1s)
curl -w "@curl-format.txt" -X GET http://localhost:3000/projects
```

### 3. Performance Baseline
```bash
# Run load test to confirm performance is acceptable
npm run test:load:baseline

# Expected results after rollback:
# - No errors
# - Response times similar to pre-optimization
# - No query timeouts
```

## Staged Rollback Approach

If issues are unclear, use this staged approach:

### Stage 1: Disable New Features (Keep Optimizations)
```typescript
// Only remove new controllers/modules, keep optimized queries
imports: [
  // PerformanceModule, // Remove monitoring only
]
```

### Stage 2: Disable Query Optimizations (Keep Indexes)
```typescript
// Switch back to original services, keep database indexes
providers: [
  ProjectsService, // Original service only
]
```

### Stage 3: Full Database Rollback (Last Resort)
```bash
# Remove all indexes and revert database
npm run prisma:migrate:reset --skip-seed
```

## Recovery Checklist

- [ ] Application starts without errors
- [ ] All API endpoints respond
- [ ] Database connections are stable
- [ ] No performance degradation vs baseline
- [ ] User workflows function correctly
- [ ] No error logs in application logs
- [ ] Database connection pool is healthy

## Contact and Escalation

If rollback issues persist:

1. **Immediate**: Check application logs for specific error messages
2. **Database Issues**: Verify PostgreSQL service status and connectivity
3. **Performance Problems**: Check system resources (CPU, memory, disk I/O)
4. **Data Integrity**: Run data validation queries to ensure no corruption

## Prevention for Future Optimizations

### Testing Strategy
1. Always test optimizations in staging environment first
2. Run load tests before and after changes
3. Create database backup before applying migrations
4. Monitor application for 24-48 hours after deployment

### Monitoring Setup
1. Set up alerts for query performance degradation
2. Monitor database connection pool utilization
3. Track API response times and error rates
4. Set up automated rollback triggers for critical issues

## Emergency Contacts

- **Database Issues**: DBA team
- **Application Errors**: Development team  
- **Performance Problems**: DevOps team
- **User Impact**: Product team

## Success Criteria for Rollback Completion

✅ Application is stable and functional  
✅ Performance is at acceptable baseline levels  
✅ No increase in error rates  
✅ Database is healthy and responsive  
✅ All user workflows are working  
✅ System resources are at normal levels  

## Post-Rollback Actions

1. **Document Issues**: Record what went wrong and why rollback was needed
2. **Review Logs**: Analyze error patterns and performance metrics
3. **Plan Fixes**: Address root causes before attempting re-implementation
4. **Update Tests**: Improve testing procedures to catch similar issues
5. **Communicate**: Inform stakeholders about rollback and next steps