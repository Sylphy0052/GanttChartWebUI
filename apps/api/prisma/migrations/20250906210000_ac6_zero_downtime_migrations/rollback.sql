-- AC6 Rollback: Remove zero-downtime migration infrastructure

-- Drop functions
DROP FUNCTION IF EXISTS rollback_migration_schema(UUID);
DROP FUNCTION IF EXISTS complete_migration_cleanup(UUID, JSONB);
DROP FUNCTION IF EXISTS activate_migration_schema(UUID, JSONB);
DROP FUNCTION IF EXISTS prepare_migration_snapshot(UUID);
DROP FUNCTION IF EXISTS validate_migration_phase_transition(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS manage_migration_phase(VARCHAR, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS zero_downtime_refresh_computed_schedule_view(UUID, BOOLEAN, INT);

-- Drop indexes
DROP INDEX IF EXISTS idx_schema_migration_control_name;
DROP INDEX IF EXISTS idx_schema_migration_control_phase;
DROP INDEX IF EXISTS idx_materialized_view_refresh_log_view;
DROP INDEX IF EXISTS idx_materialized_view_refresh_log_migration;

-- Drop shadow table
DROP TABLE IF EXISTS computed_schedule_view_v2_shadow;

-- Drop tables
DROP TABLE IF EXISTS materialized_view_refresh_log;
DROP TABLE IF EXISTS schema_migration_control;