-- DropIndex
DROP INDEX "projects_name_idx";

-- DropIndex
DROP INDEX "projects_name_key";

-- CreateIndex
CREATE INDEX "projects_name_is_deleted_idx" ON "projects"("name", "is_deleted");
