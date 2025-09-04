-- AlterTable
ALTER TABLE "Project" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'private';
ALTER TABLE "Project" ADD COLUMN "password_hash" TEXT;

-- CreateIndex
CREATE INDEX "Project_visibility_idx" ON "Project"("visibility");