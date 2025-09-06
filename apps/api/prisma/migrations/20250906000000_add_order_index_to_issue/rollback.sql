-- Rollback script for WBS hierarchical data model changes
-- This script reverts the changes made in migration.sql

-- Drop the unique constraint
ALTER TABLE "issues" DROP CONSTRAINT IF EXISTS "issues_project_id_parent_issue_id_order_index_key";

-- Drop the hierarchical index
DROP INDEX IF EXISTS "issues_project_id_parent_issue_id_order_index_idx";

-- Drop the order_index column
ALTER TABLE "issues" DROP COLUMN IF EXISTS "order_index";