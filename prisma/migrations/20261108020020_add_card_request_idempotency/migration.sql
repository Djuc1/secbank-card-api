/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `card_requests` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "card_requests" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "card_requests_idempotencyKey_key" ON "card_requests"("idempotencyKey");
