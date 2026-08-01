-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('checking', 'savings', 'credit', 'brokerage');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('upload', 'manual', 'adapter');

-- CreateEnum
CREATE TYPE "UploadJobStatus" AS ENUM ('pending', 'mapping_required', 'processing', 'done', 'error');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "type" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "merchantRaw" TEXT,
    "merchantNormalized" TEXT,
    "category" TEXT NOT NULL DEFAULT 'uncategorized',
    "subcategory" TEXT,
    "source" "TransactionSource" NOT NULL DEFAULT 'upload',
    "redactedFieldsHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "matcherPattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "UploadJobStatus" NOT NULL DEFAULT 'pending',
    "fileName" TEXT NOT NULL,
    "detectedFormat" TEXT,
    "errorDetail" TEXT,
    "rawRowsJson" JSONB,
    "columnMapping" JSONB,
    "transactionCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_workspaceId_idx" ON "accounts"("workspaceId");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_postedAt_idx" ON "transactions"("workspaceId", "postedAt");

-- CreateIndex
CREATE INDEX "transactions_workspaceId_category_idx" ON "transactions"("workspaceId", "category");

-- CreateIndex
CREATE INDEX "category_rules_workspaceId_priority_idx" ON "category_rules"("workspaceId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "category_rules_workspaceId_matcherPattern_key" ON "category_rules"("workspaceId", "matcherPattern");

-- CreateIndex
CREATE INDEX "upload_jobs_workspaceId_createdAt_idx" ON "upload_jobs"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
