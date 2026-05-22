/*
  Warnings:

  - A unique constraint covering the columns `[branchId,ticketDateKey,number]` on the table `tickets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ticketDateKey` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "tickets_branchId_status_createdAt_idx";

-- DropIndex
DROP INDEX "tickets_number_key";

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "ticketDateKey" VARCHAR(10);

-- Backfill date key for existing rows (Kyiv business day)
UPDATE "tickets"
SET "ticketDateKey" = to_char(("createdAt" AT TIME ZONE 'Europe/Kyiv')::date, 'YYYY-MM-DD')
WHERE "ticketDateKey" IS NULL;

-- Make column required after backfill
ALTER TABLE "tickets" ALTER COLUMN "ticketDateKey" SET NOT NULL;

-- CreateIndex
CREATE INDEX "tickets_branchId_ticketDateKey_status_createdAt_idx" ON "tickets"("branchId", "ticketDateKey", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_branchId_ticketDateKey_number_key" ON "tickets"("branchId", "ticketDateKey", "number");
