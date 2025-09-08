-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'in_progress', 'done', 'blocked');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FS');

-- CreateEnum
CREATE TYPE "ChangeEntityType" AS ENUM ('Project', 'Issue', 'Comment', 'Dependency', 'GlobalSettings');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description_md" TEXT,
    "shared_password_hash" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL,
    "weekend_off" BOOLEAN NOT NULL DEFAULT true,
    "holiday_dates" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "title" TEXT NOT NULL,
    "description_md" TEXT,
    "assignee" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "start_date" DATE,
    "end_date" DATE,
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "effort_hours" DOUBLE PRECISION,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "labels" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependencies" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "predecessor_issue_id" TEXT NOT NULL,
    "successor_issue_id" TEXT NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FS',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body_md" TEXT NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_logs" (
    "id" TEXT NOT NULL,
    "entity_type" "ChangeEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "project_id" TEXT,
    "diff_json" JSONB NOT NULL,
    "user_hint" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_paths" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_paths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");

-- CreateIndex
CREATE INDEX "projects_is_deleted_idx" ON "projects"("is_deleted");

-- CreateIndex
CREATE INDEX "projects_name_idx" ON "projects"("name");

-- CreateIndex
CREATE INDEX "issues_project_id_is_deleted_idx" ON "issues"("project_id", "is_deleted");

-- CreateIndex
CREATE INDEX "issues_parent_id_idx" ON "issues"("parent_id");

-- CreateIndex
CREATE INDEX "issues_status_idx" ON "issues"("status");

-- CreateIndex
CREATE INDEX "issues_start_date_idx" ON "issues"("start_date");

-- CreateIndex
CREATE INDEX "issues_end_date_idx" ON "issues"("end_date");

-- CreateIndex
CREATE INDEX "issues_assignee_idx" ON "issues"("assignee");

-- CreateIndex
CREATE INDEX "issues_sort_order_idx" ON "issues"("sort_order");

-- CreateIndex
CREATE INDEX "issues_deleted_at_idx" ON "issues"("deleted_at");

-- CreateIndex
CREATE INDEX "dependencies_project_id_idx" ON "dependencies"("project_id");

-- CreateIndex
CREATE INDEX "dependencies_predecessor_issue_id_idx" ON "dependencies"("predecessor_issue_id");

-- CreateIndex
CREATE INDEX "dependencies_successor_issue_id_idx" ON "dependencies"("successor_issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "dependencies_predecessor_issue_id_successor_issue_id_key" ON "dependencies"("predecessor_issue_id", "successor_issue_id");

-- CreateIndex
CREATE INDEX "comments_issue_id_idx" ON "comments"("issue_id");

-- CreateIndex
CREATE INDEX "comments_created_at_idx" ON "comments"("created_at");

-- CreateIndex
CREATE INDEX "change_logs_entity_type_entity_id_idx" ON "change_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "change_logs_project_id_idx" ON "change_logs"("project_id");

-- CreateIndex
CREATE INDEX "change_logs_created_at_idx" ON "change_logs"("created_at");

-- CreateIndex
CREATE INDEX "image_paths_issue_id_idx" ON "image_paths"("issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "image_paths_path_key" ON "image_paths"("path");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_predecessor_issue_id_fkey" FOREIGN KEY ("predecessor_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_successor_issue_id_fkey" FOREIGN KEY ("successor_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_paths" ADD CONSTRAINT "image_paths_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
