-- AC5: Schedule versioning tracks calculation timestamps and dependency changes
-- Implements comprehensive versioning system for schedule calculations and changes

-- Create table for schedule version tracking
CREATE TABLE IF NOT EXISTS schedule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    version_number INT NOT NULL,
    computed_schedule_id UUID NULL, -- References computed_schedules.id
    parent_version_id UUID NULL, -- References schedule_versions.id for history chain
    
    -- Version metadata
    version_type VARCHAR(20) NOT NULL DEFAULT 'calculation', -- 'calculation', 'manual', 'batch_update', 'dependency_change'
    created_by UUID NOT NULL, -- User who created this version
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Change tracking
    changes_summary JSONB DEFAULT '{}', -- Summary of what changed
    dependency_changes JSONB DEFAULT '[]', -- Specific dependency changes
    task_changes JSONB DEFAULT '[]', -- Specific task changes
    algorithm_config JSONB DEFAULT '{}', -- Algorithm configuration used
    
    -- Performance and validation metadata
    calculation_duration_ms INT NULL,
    validation_results JSONB DEFAULT '{}', -- Validation results and conflicts
    is_applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP NULL,
    applied_by UUID NULL,
    
    -- Rollback and recovery
    rollback_data JSONB DEFAULT '{}', -- Data needed for rollback
    is_rollback BOOLEAN DEFAULT FALSE,
    rollback_target_version_id UUID NULL,
    
    -- Index constraints
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (computed_schedule_id) REFERENCES computed_schedules(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_version_id) REFERENCES schedule_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (applied_by) REFERENCES users(id),
    FOREIGN KEY (rollback_target_version_id) REFERENCES schedule_versions(id),
    
    UNIQUE (project_id, version_number),
    CHECK (version_number > 0)
);

-- Create table for dependency change tracking
CREATE TABLE IF NOT EXISTS dependency_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_version_id UUID NOT NULL,
    dependency_id UUID NULL, -- NULL for deleted dependencies
    change_type VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
    
    -- Change details
    predecessor_id UUID NULL,
    successor_id UUID NULL,
    old_predecessor_id UUID NULL,
    old_successor_id UUID NULL,
    
    dependency_type VARCHAR(10) NULL, -- 'FS', 'SS', 'SF', 'FF'
    old_dependency_type VARCHAR(10) NULL,
    
    lag_time INT NULL,
    old_lag_time INT NULL,
    
    -- Metadata
    changed_at TIMESTAMP DEFAULT NOW(),
    changed_by UUID NOT NULL,
    change_reason TEXT,
    
    FOREIGN KEY (schedule_version_id) REFERENCES schedule_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (dependency_id) REFERENCES dependencies(id) ON DELETE SET NULL,
    FOREIGN KEY (predecessor_id) REFERENCES issues(id) ON DELETE SET NULL,
    FOREIGN KEY (successor_id) REFERENCES issues(id) ON DELETE SET NULL,
    FOREIGN KEY (old_predecessor_id) REFERENCES issues(id) ON DELETE SET NULL,
    FOREIGN KEY (old_successor_id) REFERENCES issues(id) ON DELETE SET NULL,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Create table for task schedule change tracking
CREATE TABLE IF NOT EXISTS task_schedule_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_version_id UUID NOT NULL,
    task_id UUID NOT NULL,
    change_type VARCHAR(20) NOT NULL, -- 'schedule_update', 'manual_update', 'batch_update'
    
    -- Schedule changes
    old_start_date TIMESTAMP NULL,
    new_start_date TIMESTAMP NULL,
    old_due_date TIMESTAMP NULL,
    new_due_date TIMESTAMP NULL,
    
    -- Estimate changes
    old_estimate_value INT NULL,
    new_estimate_value INT NULL,
    old_estimate_unit VARCHAR(5) NULL,
    new_estimate_unit VARCHAR(5) NULL,
    
    -- Float and critical path changes
    old_total_float NUMERIC(10,2) NULL, -- in days
    new_total_float NUMERIC(10,2) NULL,
    old_critical_path BOOLEAN NULL,
    new_critical_path BOOLEAN NULL,
    
    -- Status and progress changes  
    old_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NULL,
    old_progress INT NULL,
    new_progress INT NULL,
    
    -- Metadata
    changed_at TIMESTAMP DEFAULT NOW(),
    changed_by UUID NOT NULL,
    change_reason TEXT,
    impact_assessment JSONB DEFAULT '{}', -- Assessment of change impact
    
    FOREIGN KEY (schedule_version_id) REFERENCES schedule_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX idx_schedule_versions_project_version ON schedule_versions(project_id, version_number DESC);
CREATE INDEX idx_schedule_versions_created_at ON schedule_versions(created_at DESC);
CREATE INDEX idx_schedule_versions_type_applied ON schedule_versions(version_type, is_applied, created_at DESC);
CREATE INDEX idx_schedule_versions_parent ON schedule_versions(parent_version_id, created_at DESC);

CREATE INDEX idx_dependency_change_log_version ON dependency_change_log(schedule_version_id, changed_at DESC);
CREATE INDEX idx_dependency_change_log_dependency ON dependency_change_log(dependency_id, change_type, changed_at DESC);

CREATE INDEX idx_task_schedule_change_log_version ON task_schedule_change_log(schedule_version_id, changed_at DESC);
CREATE INDEX idx_task_schedule_change_log_task ON task_schedule_change_log(task_id, change_type, changed_at DESC);

-- Function to create a new schedule version
CREATE OR REPLACE FUNCTION create_schedule_version(
    p_project_id UUID,
    p_version_type VARCHAR(20) DEFAULT 'calculation',
    p_created_by UUID,
    p_computed_schedule_id UUID DEFAULT NULL,
    p_changes_summary JSONB DEFAULT '{}',
    p_dependency_changes JSONB DEFAULT '[]',
    p_task_changes JSONB DEFAULT '[]',
    p_algorithm_config JSONB DEFAULT '{}',
    p_calculation_duration_ms INT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    new_version_number INT;
    new_version_id UUID;
    parent_version_id UUID;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 
    INTO new_version_number
    FROM schedule_versions 
    WHERE project_id = p_project_id;
    
    -- Get current latest version as parent
    SELECT id INTO parent_version_id
    FROM schedule_versions 
    WHERE project_id = p_project_id 
      AND version_number = new_version_number - 1;
    
    -- Create new version
    INSERT INTO schedule_versions (
        project_id,
        version_number,
        computed_schedule_id,
        parent_version_id,
        version_type,
        created_by,
        changes_summary,
        dependency_changes,
        task_changes,
        algorithm_config,
        calculation_duration_ms
    ) VALUES (
        p_project_id,
        new_version_number,
        p_computed_schedule_id,
        parent_version_id,
        p_version_type,
        p_created_by,
        p_changes_summary,
        p_dependency_changes,
        p_task_changes,
        p_algorithm_config,
        p_calculation_duration_ms
    ) RETURNING id INTO new_version_id;
    
    RETURN new_version_id;
END;
$$ LANGUAGE plpgsql;

-- Function to apply a schedule version
CREATE OR REPLACE FUNCTION apply_schedule_version(
    p_version_id UUID,
    p_applied_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
    version_record RECORD;
    rollback_data JSONB := '{}';
BEGIN
    -- Get version details
    SELECT * INTO version_record
    FROM schedule_versions 
    WHERE id = p_version_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule version not found: %', p_version_id;
    END IF;
    
    IF version_record.is_applied THEN
        RAISE EXCEPTION 'Schedule version already applied: %', p_version_id;
    END IF;
    
    -- Collect rollback data (current state before applying)
    SELECT jsonb_build_object(
        'issues', json_agg(json_build_object(
            'id', i.id,
            'start_date', i.start_date,
            'due_date', i.due_date,
            'estimate_value', i.estimate_value,
            'estimate_unit', i.estimate_unit,
            'status', i.status,
            'progress', i.progress,
            'version', i.version
        )),
        'dependencies', (
            SELECT json_agg(json_build_object(
                'id', d.id,
                'predecessor_id', d.predecessor_id,
                'successor_id', d.successor_id,
                'type', d.type,
                'lag', d.lag
            ))
            FROM dependencies d 
            WHERE d.project_id = version_record.project_id
        )
    ) INTO rollback_data
    FROM issues i
    WHERE i.project_id = version_record.project_id 
      AND i.deleted_at IS NULL;
    
    -- Apply the computed schedule if one is associated
    IF version_record.computed_schedule_id IS NOT NULL THEN
        -- Mark computed schedule as applied
        UPDATE computed_schedules 
        SET applied = TRUE, applied_at = NOW()
        WHERE id = version_record.computed_schedule_id;
        
        -- Apply task schedule changes from task_schedule_history
        UPDATE issues 
        SET 
            start_date = tsh.computed_start_date,
            due_date = tsh.computed_end_date,
            float_time = tsh.float_time,
            last_scheduled_at = NOW(),
            version = version + 1
        FROM task_schedule_history tsh
        WHERE issues.id = tsh.task_id 
          AND tsh.computed_schedule_id = version_record.computed_schedule_id
          AND issues.project_id = version_record.project_id;
    END IF;
    
    -- Mark version as applied with rollback data
    UPDATE schedule_versions 
    SET 
        is_applied = TRUE,
        applied_at = NOW(),
        applied_by = p_applied_by,
        rollback_data = rollback_data
    WHERE id = p_version_id;
    
    -- Queue materialized view refresh
    INSERT INTO computed_schedule_refresh_queue (
        project_id, operation_type, priority, metadata
    ) VALUES (
        version_record.project_id,
        'version_apply',
        1, -- Critical priority
        jsonb_build_object(
            'version_id', p_version_id,
            'version_number', version_record.version_number,
            'applied_by', p_applied_by
        )
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback to a specific version
CREATE OR REPLACE FUNCTION rollback_to_schedule_version(
    p_target_version_id UUID,
    p_rollback_by UUID,
    p_reason TEXT DEFAULT 'Manual rollback'
) RETURNS UUID AS $$
DECLARE
    target_version RECORD;
    rollback_version_id UUID;
    rollback_data JSONB;
BEGIN
    -- Get target version details
    SELECT * INTO target_version
    FROM schedule_versions 
    WHERE id = p_target_version_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target schedule version not found: %', p_target_version_id;
    END IF;
    
    IF NOT target_version.is_applied OR target_version.rollback_data IS NULL THEN
        RAISE EXCEPTION 'Cannot rollback to version that was not applied or lacks rollback data: %', p_target_version_id;
    END IF;
    
    rollback_data := target_version.rollback_data;
    
    -- Restore issues from rollback data
    IF rollback_data ? 'issues' THEN
        UPDATE issues SET
            start_date = (rb_issue->>'start_date')::timestamp,
            due_date = (rb_issue->>'due_date')::timestamp,
            estimate_value = (rb_issue->>'estimate_value')::int,
            estimate_unit = rb_issue->>'estimate_unit',
            status = rb_issue->>'status',
            progress = (rb_issue->>'progress')::int,
            version = version + 1,
            updated_at = NOW()
        FROM jsonb_array_elements(rollback_data->'issues') rb_issue
        WHERE issues.id = (rb_issue->>'id')::uuid
          AND issues.project_id = target_version.project_id;
    END IF;
    
    -- Create rollback version record
    SELECT create_schedule_version(
        target_version.project_id,
        'rollback',
        p_rollback_by,
        NULL, -- No computed schedule for rollbacks
        jsonb_build_object(
            'reason', p_reason,
            'rollback_target_version', target_version.version_number,
            'rollback_timestamp', NOW()
        ),
        '[]'::jsonb,
        '[]'::jsonb,
        '{}'::jsonb,
        NULL
    ) INTO rollback_version_id;
    
    -- Update rollback version with target reference
    UPDATE schedule_versions 
    SET 
        is_rollback = TRUE,
        rollback_target_version_id = p_target_version_id,
        is_applied = TRUE,
        applied_at = NOW(),
        applied_by = p_rollback_by
    WHERE id = rollback_version_id;
    
    RETURN rollback_version_id;
END;
$$ LANGUAGE plpgsql;

-- Enhanced trigger function to automatically create version records
CREATE OR REPLACE FUNCTION auto_create_schedule_version()
RETURNS TRIGGER AS $$
DECLARE
    version_id UUID;
    changes_summary JSONB := '{}';
    task_changes JSONB := '[]';
BEGIN
    -- Only create versions for applied computed schedules
    IF TG_TABLE_NAME = 'computed_schedules' AND NEW.applied = TRUE AND 
       (OLD IS NULL OR OLD.applied = FALSE) THEN
        
        changes_summary := jsonb_build_object(
            'trigger', 'computed_schedule_applied',
            'algorithm', NEW.algorithm,
            'total_duration', NEW.total_duration,
            'critical_path_length', jsonb_array_length(NEW.critical_path)
        );
        
        SELECT create_schedule_version(
            NEW.project_id,
            'calculation',
            NEW.calculated_by,
            NEW.id,
            changes_summary,
            '[]'::jsonb,
            task_changes,
            jsonb_build_object('algorithm', NEW.algorithm),
            NULL
        ) INTO version_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic version creation
CREATE TRIGGER trg_auto_create_schedule_version
    AFTER UPDATE ON computed_schedules
    FOR EACH ROW EXECUTE FUNCTION auto_create_schedule_version();

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_schedule_version(UUID, VARCHAR, UUID, UUID, JSONB, JSONB, JSONB, JSONB, INT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION apply_schedule_version(UUID, UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION rollback_to_schedule_version(UUID, UUID, TEXT) TO PUBLIC;

GRANT SELECT, INSERT, UPDATE ON schedule_versions TO PUBLIC;
GRANT SELECT, INSERT ON dependency_change_log TO PUBLIC;
GRANT SELECT, INSERT ON task_schedule_change_log TO PUBLIC;