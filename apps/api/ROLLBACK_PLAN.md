# Rollback Plan for Enhanced Data Models Migration

## Overview
This document provides the rollback plan for the Prisma data model enhancements implemented in migration `20250906110058_enhanced_data_models`.

## Changes Made
1. **Schema Enhancements**: Added missing fields to existing models
2. **New Models**: Created WBSNode and Milestone models 
3. **Field Additions**: Added relations, attachments, externalLinks, milestoneId, closedAt, createdBy to Issue
4. **Naming Conventions**: Standardized all table and column names to snake_case
5. **Relationships**: Enhanced foreign key relationships and indexes

## Rollback Steps

### 1. Emergency Rollback (Data Loss Acceptable)
```bash
# If data loss is acceptable and you need immediate rollback
npx prisma migrate reset
# This will reset to the initial migration state
```

### 2. Safe Rollback (Preserve Data)
```sql
-- Step 1: Remove new foreign key constraints
ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_milestone_id_fkey";
ALTER TABLE "wbs_nodes" DROP CONSTRAINT IF EXISTS "wbs_nodes_issue_id_fkey";
ALTER TABLE "wbs_nodes" DROP CONSTRAINT IF EXISTS "wbs_nodes_project_id_fkey";
ALTER TABLE "milestones" DROP CONSTRAINT IF EXISTS "milestones_project_id_fkey";

-- Step 2: Drop new tables
DROP TABLE IF EXISTS "wbs_nodes";
DROP TABLE IF EXISTS "milestones";

-- Step 3: Remove new columns from Issue table
ALTER TABLE "issues" DROP COLUMN IF EXISTS "relations";
ALTER TABLE "issues" DROP COLUMN IF EXISTS "attachments";
ALTER TABLE "issues" DROP COLUMN IF EXISTS "external_links";
ALTER TABLE "issues" DROP COLUMN IF EXISTS "milestone_id";
ALTER TABLE "issues" DROP COLUMN IF EXISTS "closed_at";
ALTER TABLE "issues" DROP COLUMN IF EXISTS "created_by";

-- Step 4: Remove new column from Project table
ALTER TABLE "projects" DROP COLUMN IF EXISTS "calendar_id";

-- Step 5: Revert table names to original PascalCase (requires careful handling)
-- This step is complex and may require application downtime
```

### 3. Application Code Rollback
```bash
# 1. Revert Prisma schema to previous version
git checkout HEAD~1 apps/api/prisma/schema.prisma

# 2. Regenerate Prisma client
npx prisma generate

# 3. Update any application code that uses new models
# (WBSNode, Milestone, new Issue fields)
```

## Rollback Testing
Before executing rollback in production:

1. **Test in Development**:
   ```bash
   npm run test
   npm run test:e2e
   ```

2. **Verify Data Integrity**:
   ```bash
   node validate-schema.js  # Should fail gracefully
   ```

3. **Check Application Functionality**:
   - Test existing API endpoints
   - Verify database queries work
   - Ensure no breaking changes in UI

## Recovery Steps (After Rollback)
If rollback was successful but you need to restore enhanced functionality:

1. **Re-apply Migration**:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

2. **Data Migration** (if needed):
   - Migrate any data that was lost during rollback
   - Restore backup data if available

## Risk Assessment
- **Low Risk**: New models (WBSNode, Milestone) - can be dropped without affecting existing data
- **Medium Risk**: New Issue fields - may cause application errors if code expects them
- **High Risk**: Table/column renaming - requires coordinated application updates

## Prevention for Future Migrations
1. Always use feature flags for new functionality
2. Implement backward-compatible schema changes
3. Deploy schema changes separately from application code
4. Maintain comprehensive test coverage
5. Use blue-green deployment strategies for major schema changes

## Contact Information
For rollback assistance:
- Database Admin: [contact info]
- DevOps Team: [contact info]
- Development Team Lead: [contact info]