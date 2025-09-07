-- Rollback: Remove ComputedSchedule Materialized View

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_issues_refresh ON issues;
DROP TRIGGER IF EXISTS trg_task_schedule_history_refresh ON task_schedule_history;
DROP TRIGGER IF EXISTS trg_computed_schedules_refresh ON computed_schedules;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_refresh_computed_schedule_view();
DROP FUNCTION IF EXISTS refresh_computed_schedule_view(UUID);

-- Drop materialized view and its indexes
DROP MATERIALIZED VIEW IF EXISTS computed_schedule_view;

-- Drop indexes on base tables
DROP INDEX IF EXISTS idx_task_schedule_history_computed_schedule;
DROP INDEX IF EXISTS idx_computed_schedules_project_applied;