-- T039: Database Performance Optimization - Strategic Indexes
-- This migration adds critical indexes to improve query performance

-- Performance indexes for User queries
CREATE INDEX IF NOT EXISTS "users_email_is_active_idx" ON "users" ("email", "is_active");
CREATE INDEX IF NOT EXISTS "users_is_active_created_at_idx" ON "users" ("is_active", "created_at" DESC);

-- Performance indexes for Project queries  
CREATE INDEX IF NOT EXISTS "projects_visibility_created_at_idx" ON "projects" ("visibility", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "projects_scheduling_enabled_idx" ON "projects" ("scheduling_enabled");

-- Composite indexes for ProjectMember queries (user access patterns)
CREATE INDEX IF NOT EXISTS "project_members_user_active_role_idx" ON "project_members" ("user_id", "is_active", "role");
CREATE INDEX IF NOT EXISTS "project_members_project_active_joined_idx" ON "project_members" ("project_id", "is_active", "joined_at" DESC);

-- Critical indexes for Issue queries (most frequently accessed)
CREATE INDEX IF NOT EXISTS "issues_project_status_updated_idx" ON "issues" ("project_id", "status", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "issues_assignee_status_due_idx" ON "issues" ("assignee_id", "status", "due_date");
CREATE INDEX IF NOT EXISTS "issues_parent_status_order_idx" ON "issues" ("parent_issue_id", "status", "order_index");
CREATE INDEX IF NOT EXISTS "issues_project_parent_order_status_idx" ON "issues" ("project_id", "parent_issue_id", "order_index", "status");
CREATE INDEX IF NOT EXISTS "issues_start_due_status_idx" ON "issues" ("start_date", "due_date", "status");

-- Indexes for WBS tree queries
CREATE INDEX IF NOT EXISTS "wbs_nodes_project_parent_sort_idx" ON "wbs_nodes" ("project_id", "parent", "sort_index");
CREATE INDEX IF NOT EXISTS "wbs_nodes_issue_project_idx" ON "wbs_nodes" ("issue_id", "project_id");

-- Indexes for Dependency queries (Gantt chart critical path)
CREATE INDEX IF NOT EXISTS "dependencies_project_pred_succ_idx" ON "dependencies" ("project_id", "predecessor_id", "successor_id");
CREATE INDEX IF NOT EXISTS "dependencies_successor_type_lag_idx" ON "dependencies" ("successor_id", "type", "lag");
CREATE INDEX IF NOT EXISTS "dependencies_predecessor_type_idx" ON "dependencies" ("predecessor_id", "type");

-- Indexes for Milestone queries
CREATE INDEX IF NOT EXISTS "milestones_project_due_status_idx" ON "milestones" ("project_id", "due_date", "status");
CREATE INDEX IF NOT EXISTS "milestones_due_status_idx" ON "milestones" ("due_date", "status");

-- Indexes for Activity Log queries (audit trail)
CREATE INDEX IF NOT EXISTS "activity_logs_project_entity_created_idx" ON "activity_logs" ("project_id", "entity_type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_logs_issue_action_created_idx" ON "activity_logs" ("issue_id", "action", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "activity_logs_actor_created_idx" ON "activity_logs" ("actor", "created_at" DESC);

-- Indexes for ComputedSchedule queries
CREATE INDEX IF NOT EXISTS "computed_schedules_project_applied_calculated_idx" ON "computed_schedules" ("project_id", "applied", "calculated_at" DESC);
CREATE INDEX IF NOT EXISTS "computed_schedules_algorithm_calculated_idx" ON "computed_schedules" ("algorithm", "calculated_at" DESC);

-- Indexes for TaskScheduleHistory queries
CREATE INDEX IF NOT EXISTS "task_schedule_history_task_computed_idx" ON "task_schedule_history" ("task_id", "computed_schedule_id");
CREATE INDEX IF NOT EXISTS "task_schedule_history_computed_critical_idx" ON "task_schedule_history" ("computed_schedule_id", "critical_path");

-- Indexes for Auth and Security queries
CREATE INDEX IF NOT EXISTS "auth_sessions_project_active_expires_idx" ON "auth_sessions" ("project_id", "is_active", "expires_at");
CREATE INDEX IF NOT EXISTS "auth_sessions_client_active_idx" ON "auth_sessions" ("client_id", "is_active");
CREATE INDEX IF NOT EXISTS "rate_limit_attempts_client_type_locked_idx" ON "rate_limit_attempts" ("client_id", "attempt_type", "locked_until");

-- Indexes for Business Metrics and ROI
CREATE INDEX IF NOT EXISTS "business_metrics_project_type_period_measured_idx" ON "business_metrics" ("project_id", "metric_type", "period", "measured_at" DESC);
CREATE INDEX IF NOT EXISTS "business_metrics_user_type_measured_idx" ON "business_metrics" ("user_id", "metric_type", "measured_at" DESC);
CREATE INDEX IF NOT EXISTS "roi_reports_project_period_start_status_idx" ON "roi_reports" ("project_id", "report_period", "start_date", "status");

-- Partial indexes for soft-deleted records
CREATE INDEX IF NOT EXISTS "issues_active_project_status_idx" ON "issues" ("project_id", "status") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "issues_active_assignee_status_idx" ON "issues" ("assignee_id", "status") WHERE "deleted_at" IS NULL AND "assignee_id" IS NOT NULL;

-- Comment explaining the optimization strategy
COMMENT ON INDEX "issues_project_parent_order_status_idx" IS 'Optimizes WBS tree queries with hierarchy traversal';
COMMENT ON INDEX "dependencies_project_pred_succ_idx" IS 'Optimizes Gantt chart dependency resolution';
COMMENT ON INDEX "project_members_user_active_role_idx" IS 'Optimizes user access verification queries';