-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('equity', 'bond', 'cash', 'real_estate', 'commodity', 'crypto', 'other');

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "costBasisMinor" INTEGER NOT NULL,
    "currentPriceMinor" INTEGER,
    "currency" TEXT NOT NULL,
    "assetClass" "AssetClass" NOT NULL DEFAULT 'equity',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "holdings_workspaceId_idx" ON "holdings"("workspaceId");

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
