-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('Task', 'Milestone');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN "type" "IssueType" NOT NULL DEFAULT 'Task';

-- CreateIndex
CREATE INDEX "issues_type_idx" ON "issues"("type");