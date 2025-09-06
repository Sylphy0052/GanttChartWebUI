-- CreateIndex
-- Add order_index column to issues table for WBS hierarchical data model
ALTER TABLE "issues" ADD COLUMN "order_index" INTEGER NOT NULL DEFAULT 0;

-- Create index for hierarchical queries (projectId, parentIssueId, orderIndex)
CREATE INDEX "issues_project_id_parent_issue_id_order_index_idx" ON "issues"("project_id", "parent_issue_id", "order_index");

-- Add unique constraint to ensure unique ordering within parent
-- This prevents duplicate order_index values for the same parent
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_parent_issue_id_order_index_key" UNIQUE ("project_id", "parent_issue_id", "order_index");

-- Update existing records to have sequential order_index values
-- This ensures backward compatibility with existing data
UPDATE "issues" 
SET "order_index" = subquery.row_num - 1
FROM (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY "project_id", "parent_issue_id" 
            ORDER BY "created_at"
        ) as row_num
    FROM "issues"
) as subquery
WHERE "issues".id = subquery.id;