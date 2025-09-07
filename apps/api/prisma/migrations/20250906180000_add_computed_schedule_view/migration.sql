-- AC1: ComputedSchedule Materialized View for pre-calculated ES/EF/LS/LF/TF values
-- This materialized view stores pre-calculated schedule data from the latest applied computed schedule

-- First, create index on computed_schedules for performance
CREATE INDEX IF NOT EXISTS idx_computed_schedules_project_applied 
ON computed_schedules(project_id, applied, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_schedule_history_computed_schedule
ON task_schedule_history(computed_schedule_id, critical_path, float_time);

-- Create materialized view for optimized schedule data access
CREATE MATERIALIZED VIEW computed_schedule_view AS
SELECT 
    cs.project_id,
    cs.id as computed_schedule_id,
    cs.calculated_at,
    cs.calculated_by,
    cs.algorithm,
    cs.computed_end_date,
    cs.total_duration,
    cs.critical_path,
    
    -- Task-level pre-calculated values (ES/EF/LS/LF/TF)
    tsh.task_id,
    tsh.original_start_date,
    tsh.original_end_date,
    tsh.computed_start_date as earliest_start_date,  -- ES
    tsh.computed_end_date as earliest_finish_date,   -- EF
    
    -- Extract latest start/finish from task schedules JSON when available
    COALESCE(
        (cs.task_schedules->>tsh.task_id::text->>'latestStart')::timestamp,
        tsh.computed_start_date
    ) as latest_start_date,    -- LS
    
    COALESCE(
        (cs.task_schedules->>tsh.task_id::text->>'latestFinish')::timestamp,
        tsh.computed_end_date
    ) as latest_finish_date,   -- LF
    
    tsh.float_time as total_float,     -- TF (in minutes, convert to days: float_time / 1440.0)
    tsh.critical_path,
    tsh.conflicts,
    
    -- Additional optimization data
    i.title as task_title,
    i.assignee_id,
    i.status as task_status,
    i.progress,
    i.estimate_value,
    i.estimate_unit,
    
    -- Performance optimization: pre-calculate common aggregations
    CASE 
        WHEN tsh.float_time <= 60 THEN 'critical'      -- <= 1 hour
        WHEN tsh.float_time <= 480 THEN 'near_critical' -- <= 8 hours  
        ELSE 'normal'
    END as risk_level
    
FROM computed_schedules cs
JOIN task_schedule_history tsh ON cs.id = tsh.computed_schedule_id
JOIN issues i ON tsh.task_id = i.id
WHERE cs.applied = true  -- Only include applied schedules
AND i.deleted_at IS NULL; -- Only include active issues

-- Create indexes on the materialized view for fast queries
CREATE UNIQUE INDEX idx_computed_schedule_view_project_task 
ON computed_schedule_view(project_id, task_id);

CREATE INDEX idx_computed_schedule_view_project_calculated 
ON computed_schedule_view(project_id, calculated_at DESC);

CREATE INDEX idx_computed_schedule_view_critical_path 
ON computed_schedule_view(project_id, critical_path, total_float);

CREATE INDEX idx_computed_schedule_view_risk_level 
ON computed_schedule_view(project_id, risk_level);

CREATE INDEX idx_computed_schedule_view_assignee 
ON computed_schedule_view(project_id, assignee_id, task_status);

-- Add function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_computed_schedule_view(project_id_param UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    -- Full refresh if no project specified, otherwise concurrent refresh
    IF project_id_param IS NULL THEN
        REFRESH MATERIALIZED VIEW computed_schedule_view;
    ELSE
        -- For project-specific updates, we need to refresh the whole view
        -- since PostgreSQL doesn't support partial materialized view refresh
        REFRESH MATERIALIZED VIEW CONCURRENTLY computed_schedule_view;
    END IF;
    
    -- Log refresh for monitoring
    INSERT INTO activity_logs (
        project_id, 
        entity_type, 
        entity_id, 
        action, 
        actor, 
        metadata, 
        created_at
    ) VALUES (
        COALESCE(project_id_param, '00000000-0000-0000-0000-000000000000'::UUID),
        'materialized_view',
        'computed_schedule_view',
        'refresh',
        'system',
        jsonb_build_object(
            'project_id', project_id_param,
            'refresh_type', CASE WHEN project_id_param IS NULL THEN 'full' ELSE 'project' END,
            'timestamp', NOW()
        ),
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Add trigger function for automatic refresh on data changes
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

-- Create triggers for automatic refresh
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

-- Initial population of the materialized view
SELECT refresh_computed_schedule_view();

-- Grant appropriate permissions
GRANT SELECT ON computed_schedule_view TO PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_computed_schedule_view(UUID) TO PUBLIC;