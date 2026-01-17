/*
  Warnings:

  - You are about to drop the column `date` on the `LeaveEntry` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `LeaveEntry` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `LeaveEntry` table. All the data in the column will be lost.
  - You are about to alter the column `hours` on the `LeaveEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal(5,2)` to `DoublePrecision`.
  - Added the required column `endDate` to the `LeaveEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `LeaveEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LeaveEntry_branchId_date_idx";

-- DropIndex
DROP INDEX "LeaveEntry_employeeId_date_idx";

-- AlterTable
ALTER TABLE "LeaveEntry" DROP COLUMN "date",
DROP COLUMN "notes",
DROP COLUMN "status",
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "hours" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "type" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "LeaveEntry_branchId_idx" ON "LeaveEntry"("branchId");

-- CreateIndex
CREATE INDEX "LeaveEntry_employeeId_idx" ON "LeaveEntry"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveEntry_startDate_idx" ON "LeaveEntry"("startDate");

-- CreateIndex
CREATE INDEX "LeaveEntry_endDate_idx" ON "LeaveEntry"("endDate");
