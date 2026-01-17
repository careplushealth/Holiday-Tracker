/*
  Warnings:

  - You are about to drop the column `endDate` on the `LeaveEntry` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `LeaveEntry` table. All the data in the column will be lost.
  - You are about to alter the column `hours` on the `LeaveEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal(7,2)` to `Decimal(5,2)`.
  - Added the required column `date` to the `LeaveEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LeaveEntry_branchId_startDate_idx";

-- DropIndex
DROP INDEX "LeaveEntry_employeeId_startDate_idx";

-- AlterTable
ALTER TABLE "LeaveEntry" DROP COLUMN "endDate",
DROP COLUMN "startDate",
ADD COLUMN     "date" DATE NOT NULL,
ALTER COLUMN "hours" SET DATA TYPE DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "LeaveEntry_employeeId_date_idx" ON "LeaveEntry"("employeeId", "date");

-- CreateIndex
CREATE INDEX "LeaveEntry_branchId_date_idx" ON "LeaveEntry"("branchId", "date");
