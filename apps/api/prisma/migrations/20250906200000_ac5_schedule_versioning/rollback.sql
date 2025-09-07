-- AC5 Rollback: Remove schedule versioning system

-- Drop triggers
DROP TRIGGER IF EXISTS trg_auto_create_schedule_version ON computed_schedules;

-- Drop functions
DROP FUNCTION IF EXISTS auto_create_schedule_version();
DROP FUNCTION IF EXISTS rollback_to_schedule_version(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS apply_schedule_version(UUID, UUID);
DROP FUNCTION IF EXISTS create_schedule_version(UUID, VARCHAR, UUID, UUID, JSONB, JSONB, JSONB, JSONB, INT);

-- Drop indexes
DROP INDEX IF EXISTS idx_schedule_versions_project_version;
DROP INDEX IF EXISTS idx_schedule_versions_created_at;
DROP INDEX IF EXISTS idx_schedule_versions_type_applied;
DROP INDEX IF EXISTS idx_schedule_versions_parent;
DROP INDEX IF EXISTS idx_dependency_change_log_version;
DROP INDEX IF EXISTS idx_dependency_change_log_dependency;
DROP INDEX IF EXISTS idx_task_schedule_change_log_version;
DROP INDEX IF EXISTS idx_task_schedule_change_log_task;

-- Drop tables
DROP TABLE IF EXISTS task_schedule_change_log;
DROP TABLE IF EXISTS dependency_change_log;
DROP TABLE IF EXISTS schedule_versions;