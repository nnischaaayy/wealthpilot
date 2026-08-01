-- AlterTable
ALTER TABLE "upload_jobs" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "upload_jobs_workspaceId_idempotencyKey_key" ON "upload_jobs"("workspaceId", "idempotencyKey");

