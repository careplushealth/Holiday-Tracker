-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeWorkSchedule" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeWorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ANNUAL',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "EmployeeWorkSchedule_employeeId_idx" ON "EmployeeWorkSchedule"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeWorkSchedule_employeeId_weekday_key" ON "EmployeeWorkSchedule"("employeeId", "weekday");

-- CreateIndex
CREATE INDEX "LeaveEntry_employeeId_date_idx" ON "LeaveEntry"("employeeId", "date");

-- CreateIndex
CREATE INDEX "LeaveEntry_branchId_date_idx" ON "LeaveEntry"("branchId", "date");

-- CreateIndex
CREATE INDEX "PublicHoliday_date_idx" ON "PublicHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_date_region_key" ON "PublicHoliday"("date", "region");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeWorkSchedule" ADD CONSTRAINT "EmployeeWorkSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEntry" ADD CONSTRAINT "LeaveEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEntry" ADD CONSTRAINT "LeaveEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
