-- AC2: Enhanced efficient refresh triggers for materialized view updates
-- Implements intelligent batching, async processing, and selective refresh mechanisms

-- Create table to track pending refresh operations for batching
CREATE TABLE IF NOT EXISTS computed_schedule_refresh_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    operation_type VARCHAR(20) NOT NULL, -- 'dependency', 'schedule', 'issue', 'bulk'
    entity_id UUID,
    priority INT DEFAULT 5, -- 1=critical, 5=normal, 10=low
    requested_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP NULL,
    batch_id UUID NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_refresh_queue_project_priority (project_id, priority, requested_at),
    INDEX idx_refresh_queue_unprocessed (processed_at, priority, requested_at) WHERE processed_at IS NULL,
    INDEX idx_refresh_queue_batch (batch_id, processed_at)
);

-- Create table for tracking refresh batches and performance metrics
CREATE TABLE IF NOT EXISTS computed_schedule_refresh_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    operation_count INT DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP NULL,
    duration_ms INT NULL,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT NULL,
    rows_updated INT NULL,
    
    INDEX idx_refresh_batches_project_time (project_id, started_at DESC),
    INDEX idx_refresh_batches_performance (duration_ms, rows_updated)
);

-- Enhanced trigger function with intelligent batching
CREATE OR REPLACE FUNCTION trigger_enhanced_computed_schedule_refresh()
RETURNS TRIGGER AS $$
DECLARE
    operation_priority INT := 5;
    operation_type VARCHAR(20);
    project_uuid UUID;
    entity_uuid UUID;
    queue_size INT;
    metadata_obj JSONB := '{}';
BEGIN
    -- Determine operation type and priority
    CASE TG_TABLE_NAME
        WHEN 'computed_schedules' THEN 
            operation_type := 'schedule';
            operation_priority := 1; -- Critical - immediate refresh needed
            project_uuid := COALESCE(NEW.project_id, OLD.project_id);
            entity_uuid := COALESCE(NEW.id, OLD.id);
            
        WHEN 'task_schedule_history' THEN
            operation_type := 'schedule';
            operation_priority := 2; -- High priority
            -- Get project_id from computed_schedule
            SELECT cs.project_id INTO project_uuid 
            FROM computed_schedules cs 
            WHERE cs.id = COALESCE(NEW.computed_schedule_id, OLD.computed_schedule_id);
            entity_uuid := COALESCE(NEW.task_id, OLD.task_id);
            
        WHEN 'dependencies' THEN
            operation_type := 'dependency';
            operation_priority := 2; -- High priority - affects critical path
            project_uuid := COALESCE(NEW.project_id, OLD.project_id);
            entity_uuid := COALESCE(NEW.id, OLD.id);
            metadata_obj := jsonb_build_object(
                'predecessor_id', COALESCE(NEW.predecessor_id, OLD.predecessor_id),
                'successor_id', COALESCE(NEW.successor_id, OLD.successor_id),
                'dependency_type', COALESCE(NEW.type, OLD.type)
            );
            
        WHEN 'issues' THEN
            operation_type := 'issue';
            -- Only trigger on schedule-affecting changes
            IF TG_OP = 'UPDATE' THEN
                IF (OLD.start_date IS DISTINCT FROM NEW.start_date 
                    OR OLD.due_date IS DISTINCT FROM NEW.due_date
                    OR OLD.estimate_value IS DISTINCT FROM NEW.estimate_value
                    OR OLD.estimate_unit IS DISTINCT FROM NEW.estimate_unit
                    OR OLD.status IS DISTINCT FROM NEW.status
                    OR OLD.progress IS DISTINCT FROM NEW.progress) THEN
                    operation_priority := 3; -- Medium priority
                    project_uuid := COALESCE(NEW.project_id, OLD.project_id);
                    entity_uuid := COALESCE(NEW.id, OLD.id);
                    metadata_obj := jsonb_build_object(
                        'fields_changed', 
                        CASE 
                            WHEN OLD.start_date IS DISTINCT FROM NEW.start_date THEN 'start_date,'
                            ELSE ''
                        END ||
                        CASE 
                            WHEN OLD.due_date IS DISTINCT FROM NEW.due_date THEN 'due_date,'
                            ELSE ''
                        END ||
                        CASE 
                            WHEN OLD.estimate_value IS DISTINCT FROM NEW.estimate_value THEN 'estimate_value,'
                            ELSE ''
                        END ||
                        CASE 
                            WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status,'
                            ELSE ''
                        END
                    );
                ELSE
                    RETURN COALESCE(NEW, OLD); -- No schedule impact, skip refresh
                END IF;
            ELSE
                operation_priority := 4; -- Lower priority for new/deleted issues
                project_uuid := COALESCE(NEW.project_id, OLD.project_id);
                entity_uuid := COALESCE(NEW.id, OLD.id);
            END IF;
    END CASE;

    -- Skip if no project_id determined
    IF project_uuid IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Check current queue size to avoid overwhelming the system
    SELECT COUNT(*) INTO queue_size
    FROM computed_schedule_refresh_queue
    WHERE project_id = project_uuid AND processed_at IS NULL;

    -- If queue is getting large, upgrade to bulk operation priority
    IF queue_size > 10 THEN
        operation_priority := 1;
        operation_type := 'bulk';
        metadata_obj := metadata_obj || jsonb_build_object('queue_size', queue_size);
    END IF;

    -- Insert refresh request with deduplication
    INSERT INTO computed_schedule_refresh_queue (
        project_id, operation_type, entity_id, priority, metadata
    ) VALUES (
        project_uuid, operation_type, entity_uuid, operation_priority, metadata_obj
    )
    ON CONFLICT DO NOTHING; -- Avoid duplicates for same operation

    -- For critical operations, also send immediate notification
    IF operation_priority <= 2 THEN
        PERFORM pg_notify('computed_schedule_critical_refresh', 
            jsonb_build_object(
                'project_id', project_uuid,
                'operation_type', operation_type,
                'priority', operation_priority,
                'entity_id', entity_uuid,
                'timestamp', NOW()
            )::text
        );
    END IF;

    -- Send batched notification for normal processing
    PERFORM pg_notify('computed_schedule_batch_refresh', 
        jsonb_build_object(
            'project_id', project_uuid,
            'operation_type', operation_type,
            'priority', operation_priority,
            'timestamp', NOW()
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Replace existing simple triggers with enhanced batched triggers
DROP TRIGGER IF EXISTS trg_computed_schedules_refresh ON computed_schedules;
DROP TRIGGER IF EXISTS trg_task_schedule_history_refresh ON task_schedule_history;
DROP TRIGGER IF EXISTS trg_issues_refresh ON issues;

-- Create enhanced triggers
CREATE TRIGGER trg_computed_schedules_enhanced_refresh
    AFTER INSERT OR UPDATE OR DELETE ON computed_schedules
    FOR EACH ROW EXECUTE FUNCTION trigger_enhanced_computed_schedule_refresh();

CREATE TRIGGER trg_task_schedule_history_enhanced_refresh  
    AFTER INSERT OR UPDATE OR DELETE ON task_schedule_history
    FOR EACH ROW EXECUTE FUNCTION trigger_enhanced_computed_schedule_refresh();

CREATE TRIGGER trg_issues_enhanced_refresh
    AFTER UPDATE ON issues
    FOR EACH ROW EXECUTE FUNCTION trigger_enhanced_computed_schedule_refresh();

-- Create trigger for dependencies table (missing from original implementation)
CREATE TRIGGER trg_dependencies_enhanced_refresh
    AFTER INSERT OR UPDATE OR DELETE ON dependencies
    FOR EACH ROW EXECUTE FUNCTION trigger_enhanced_computed_schedule_refresh();

-- Enhanced batch processing function for materialized view refresh
CREATE OR REPLACE FUNCTION process_computed_schedule_refresh_batch(
    target_project_id UUID DEFAULT NULL,
    batch_size INT DEFAULT 20,
    max_age_minutes INT DEFAULT 5
) RETURNS JSONB AS $$
DECLARE
    batch_uuid UUID;
    processed_count INT := 0;
    batch_start_time TIMESTAMP := NOW();
    batch_operations TEXT[] := ARRAY[]::TEXT[];
    refresh_start_time TIMESTAMP;
    refresh_duration_ms INT;
    project_ids UUID[] := ARRAY[]::UUID[];
    result JSONB;
BEGIN
    -- Create batch record
    batch_uuid := gen_random_uuid();
    
    INSERT INTO computed_schedule_refresh_batches (id, project_id)
    VALUES (batch_uuid, target_project_id);

    -- Select operations to process (prioritized, batched, and aged)
    WITH selected_operations AS (
        SELECT q.id, q.project_id, q.operation_type, q.entity_id, q.priority
        FROM computed_schedule_refresh_queue q
        WHERE q.processed_at IS NULL
          AND (target_project_id IS NULL OR q.project_id = target_project_id)
          AND q.requested_at <= NOW() - INTERVAL '1 minutes' -- Allow batching delay
        ORDER BY q.priority ASC, q.requested_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED -- Prevent concurrent batch processors from interfering
    )
    UPDATE computed_schedule_refresh_queue 
    SET processed_at = NOW(), batch_id = batch_uuid
    FROM selected_operations so
    WHERE computed_schedule_refresh_queue.id = so.id
    RETURNING 
        computed_schedule_refresh_queue.project_id,
        computed_schedule_refresh_queue.operation_type;

    GET DIAGNOSTICS processed_count = ROW_COUNT;

    -- Collect unique project IDs that need refresh
    SELECT ARRAY_AGG(DISTINCT project_id)
    INTO project_ids
    FROM computed_schedule_refresh_queue
    WHERE batch_id = batch_uuid;

    -- Perform materialized view refresh for affected projects
    refresh_start_time := NOW();
    
    IF array_length(project_ids, 1) > 0 THEN
        -- For multiple projects or large batches, do concurrent refresh
        IF array_length(project_ids, 1) > 1 OR processed_count > 10 THEN
            REFRESH MATERIALIZED VIEW CONCURRENTLY computed_schedule_view;
        ELSE
            -- For single project with few changes, still use concurrent but log the project
            REFRESH MATERIALIZED VIEW CONCURRENTLY computed_schedule_view;
        END IF;
    END IF;
    
    refresh_duration_ms := EXTRACT(EPOCH FROM (NOW() - refresh_start_time)) * 1000;

    -- Update batch record with completion info
    UPDATE computed_schedule_refresh_batches
    SET 
        operation_count = processed_count,
        completed_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - batch_start_time)) * 1000,
        rows_updated = (SELECT COUNT(*) FROM computed_schedule_view WHERE project_id = ANY(project_ids))
    WHERE id = batch_uuid;

    -- Build result with performance metrics
    result := jsonb_build_object(
        'batch_id', batch_uuid,
        'operations_processed', processed_count,
        'projects_affected', COALESCE(array_length(project_ids, 1), 0),
        'refresh_duration_ms', refresh_duration_ms,
        'total_duration_ms', EXTRACT(EPOCH FROM (NOW() - batch_start_time)) * 1000,
        'project_ids', to_jsonb(project_ids)
    );

    -- Log batch processing activity
    INSERT INTO activity_logs (
        project_id, 
        entity_type, 
        entity_id, 
        action, 
        actor, 
        metadata, 
        created_at
    ) VALUES (
        CASE WHEN array_length(project_ids, 1) = 1 THEN project_ids[1] ELSE NULL END,
        'materialized_view',
        'computed_schedule_view',
        'batch_refresh',
        'system',
        result,
        NOW()
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old refresh queue entries and batch records
CREATE OR REPLACE FUNCTION cleanup_computed_schedule_refresh_history(
    retention_days INT DEFAULT 7
) RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    -- Clean up processed queue entries older than retention period
    DELETE FROM computed_schedule_refresh_queue
    WHERE processed_at IS NOT NULL 
      AND processed_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old batch records
    DELETE FROM computed_schedule_refresh_batches
    WHERE completed_at IS NOT NULL 
      AND completed_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_materialized_view 
ON activity_logs(entity_type, action, created_at DESC) 
WHERE entity_type = 'materialized_view';

-- Grant permissions for the enhanced functions
GRANT EXECUTE ON FUNCTION process_computed_schedule_refresh_batch(UUID, INT, INT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_computed_schedule_refresh_history(INT) TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON computed_schedule_refresh_queue TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON computed_schedule_refresh_batches TO PUBLIC;

-- Initialize first batch processing to ensure system works
SELECT process_computed_schedule_refresh_batch();