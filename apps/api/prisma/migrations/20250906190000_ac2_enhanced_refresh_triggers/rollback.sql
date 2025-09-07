-- AC2 Rollback: Remove enhanced refresh trigger mechanisms
-- This restores the basic trigger system from AC1

-- Drop enhanced triggers
DROP TRIGGER IF EXISTS trg_computed_schedules_enhanced_refresh ON computed_schedules;
DROP TRIGGER IF EXISTS trg_task_schedule_history_enhanced_refresh ON task_schedule_history;
DROP TRIGGER IF EXISTS trg_issues_enhanced_refresh ON issues;
DROP TRIGGER IF EXISTS trg_dependencies_enhanced_refresh ON dependencies;

-- Drop enhanced functions
DROP FUNCTION IF EXISTS trigger_enhanced_computed_schedule_refresh();
DROP FUNCTION IF EXISTS process_computed_schedule_refresh_batch(UUID, INT, INT);
DROP FUNCTION IF EXISTS cleanup_computed_schedule_refresh_history(INT);

-- Drop new tables
DROP TABLE IF EXISTS computed_schedule_refresh_queue;
DROP TABLE IF EXISTS computed_schedule_refresh_batches;

-- Restore original simple triggers from AC1
CREATE OR REPLACE FUNCTION trigger_refresh_computed_schedule_view()
RETURNS TRIGGER AS $$
BEGIN
    -- Schedule async refresh to avoid blocking the main transaction
    PERFORM pg_notify('computed_schedule_refresh', 
        jsonb_build_object(
            'project_id', COALESCE(NEW.project_id, OLD.project_id),
            'action', TG_OP,
            'table', TG_TABLE_NAME,
            'timestamp', NOW()
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate original triggers
CREATE TRIGGER trg_computed_schedules_refresh
    AFTER INSERT OR UPDATE OR DELETE ON computed_schedules
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_computed_schedule_view();

CREATE TRIGGER trg_task_schedule_history_refresh  
    AFTER INSERT OR UPDATE OR DELETE ON task_schedule_history
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_computed_schedule_view();

CREATE TRIGGER trg_issues_refresh
    AFTER UPDATE ON issues
    FOR EACH ROW 
    WHEN (OLD.start_date IS DISTINCT FROM NEW.start_date 
          OR OLD.due_date IS DISTINCT FROM NEW.due_date
          OR OLD.status IS DISTINCT FROM NEW.status
          OR OLD.progress IS DISTINCT FROM NEW.progress)
    EXECUTE FUNCTION trigger_refresh_computed_schedule_view();

-- Remove indexes created for enhanced system
DROP INDEX IF EXISTS idx_refresh_queue_project_priority;
DROP INDEX IF EXISTS idx_refresh_queue_unprocessed;
DROP INDEX IF EXISTS idx_refresh_queue_batch;
DROP INDEX IF EXISTS idx_refresh_batches_project_time;
DROP INDEX IF EXISTS idx_refresh_batches_performance;
DROP INDEX IF EXISTS idx_activity_logs_materialized_view;