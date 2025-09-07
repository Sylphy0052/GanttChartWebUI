-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "password_hash" TEXT,
    "calendar_id" TEXT,
    "schedulingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultConstraints" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_issue_id" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "estimate_value" INTEGER NOT NULL,
    "estimate_unit" TEXT NOT NULL,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "assignee_id" TEXT,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "labels" TEXT[],
    "relations" JSONB,
    "attachments" JSONB,
    "external_links" JSONB,
    "milestone_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_scheduled_at" TIMESTAMP(3),
    "schedule_locked" BOOLEAN NOT NULL DEFAULT false,
    "float_time" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_nodes" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "parent" TEXT,
    "sort_index" INTEGER NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "wbs_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependencies" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "predecessor_id" TEXT NOT NULL,
    "successor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "lag" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "working_days" INTEGER[],
    "holidays" TEXT[],
    "daily_hours" INTEGER NOT NULL DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "issue_id" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "computed_schedules" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculated_by" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "original_end_date" TIMESTAMP(3) NOT NULL,
    "computed_end_date" TIMESTAMP(3) NOT NULL,
    "total_duration" INTEGER NOT NULL,
    "constraints" JSONB NOT NULL,
    "task_schedules" JSONB NOT NULL,
    "critical_path" TEXT[],
    "conflicts" JSONB NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "applied_at" TIMESTAMP(3),
    "rollback_id" TEXT,

    CONSTRAINT "computed_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_schedule_history" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "computed_schedule_id" TEXT NOT NULL,
    "original_start_date" TIMESTAMP(3) NOT NULL,
    "original_end_date" TIMESTAMP(3) NOT NULL,
    "computed_start_date" TIMESTAMP(3) NOT NULL,
    "computed_end_date" TIMESTAMP(3) NOT NULL,
    "float_time" INTEGER NOT NULL,
    "critical_path" BOOLEAN NOT NULL,
    "conflicts" JSONB NOT NULL,

    CONSTRAINT "task_schedule_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_members_project_id_role_idx" ON "project_members"("project_id", "role");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE INDEX "projects_visibility_idx" ON "projects"("visibility");

-- CreateIndex
CREATE INDEX "issues_project_id_parent_issue_id_idx" ON "issues"("project_id", "parent_issue_id");

-- CreateIndex
CREATE INDEX "issues_project_id_parent_issue_id_order_index_idx" ON "issues"("project_id", "parent_issue_id", "order_index");

-- CreateIndex
CREATE INDEX "issues_project_id_updated_at_idx" ON "issues"("project_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "issues_project_id_due_date_idx" ON "issues"("project_id", "due_date");

-- CreateIndex
CREATE INDEX "issues_assignee_id_status_idx" ON "issues"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "issues_milestone_id_idx" ON "issues"("milestone_id");

-- CreateIndex
CREATE INDEX "issues_deleted_at_idx" ON "issues"("deleted_at");

-- CreateIndex
CREATE INDEX "issues_created_by_idx" ON "issues"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "issues_project_id_parent_issue_id_order_index_key" ON "issues"("project_id", "parent_issue_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "wbs_nodes_issue_id_key" ON "wbs_nodes"("issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "wbs_nodes_parent_sort_index_key" ON "wbs_nodes"("parent", "sort_index");

-- CreateIndex
CREATE INDEX "wbs_nodes_project_id_parent_idx" ON "wbs_nodes"("project_id", "parent");

-- CreateIndex
CREATE UNIQUE INDEX "dependencies_project_id_predecessor_id_successor_id_type_key" ON "dependencies"("project_id", "predecessor_id", "successor_id", "type");

-- CreateIndex
CREATE INDEX "dependencies_project_id_predecessor_id_idx" ON "dependencies"("project_id", "predecessor_id");

-- CreateIndex
CREATE INDEX "dependencies_project_id_successor_id_idx" ON "dependencies"("project_id", "successor_id");

-- CreateIndex
CREATE INDEX "milestones_project_id_due_date_idx" ON "milestones"("project_id", "due_date");

-- CreateIndex
CREATE INDEX "milestones_project_id_status_idx" ON "milestones"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calendars_project_id_name_key" ON "calendars"("project_id", "name");

-- CreateIndex
CREATE INDEX "activity_logs_project_id_created_at_idx" ON "activity_logs"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_project_id_entity_type_entity_id_idx" ON "activity_logs"("project_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_project_id_actor_idx" ON "activity_logs"("project_id", "actor");

-- CreateIndex
CREATE INDEX "activity_logs_issue_id_created_at_idx" ON "activity_logs"("issue_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "computed_schedules_project_id_calculated_at_idx" ON "computed_schedules"("project_id", "calculated_at");

-- CreateIndex
CREATE INDEX "computed_schedules_project_id_applied_idx" ON "computed_schedules"("project_id", "applied");

-- CreateIndex
CREATE INDEX "task_schedule_history_task_id_computed_schedule_id_idx" ON "task_schedule_history"("task_id", "computed_schedule_id");

-- CreateIndex
CREATE INDEX "task_schedule_history_computed_schedule_id_critical_path_idx" ON "task_schedule_history"("computed_schedule_id", "critical_path");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_issue_id_fkey" FOREIGN KEY ("parent_issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_nodes" ADD CONSTRAINT "wbs_nodes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_fkey" FOREIGN KEY ("actor") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computed_schedules" ADD CONSTRAINT "computed_schedules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "computed_schedules" ADD CONSTRAINT "computed_schedules_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_schedule_history" ADD CONSTRAINT "task_schedule_history_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_schedule_history" ADD CONSTRAINT "task_schedule_history_computed_schedule_id_fkey" FOREIGN KEY ("computed_schedule_id") REFERENCES "computed_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;