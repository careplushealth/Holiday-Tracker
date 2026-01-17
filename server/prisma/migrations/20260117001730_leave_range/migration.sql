/*
  Warnings:

  - You are about to drop the column `date` on the `LeaveEntry` table. All the data in the column will be lost.
  - Added the required column `endDate` to the `LeaveEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `LeaveEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LeaveEntry_branchId_date_idx";

-- DropIndex
DROP INDEX "LeaveEntry_employeeId_date_idx";

-- AlterTable
ALTER TABLE "LeaveEntry" DROP COLUMN "date",
ADD COLUMN     "endDate" DATE NOT NULL,
ADD COLUMN     "startDate" DATE NOT NULL;

-- CreateIndex
CREATE INDEX "LeaveEntry_employeeId_startDate_idx" ON "LeaveEntry"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "LeaveEntry_branchId_startDate_idx" ON "LeaveEntry"("branchId", "startDate");
