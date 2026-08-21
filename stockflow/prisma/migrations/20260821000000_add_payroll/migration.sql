CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

CREATE TABLE "PayrollRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "payDate" TIMESTAMP(3) NOT NULL,
  "status" "PayrollRunStatus" NOT NULL DEFAULT 'POSTED',
  "journalEntryId" TEXT,
  "totalGrossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNetPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdBy" TEXT,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "basicSalary" DECIMAL(14,2) NOT NULL,
  "absenteeism" DECIMAL(14,2) NOT NULL,
  "leaveArrears" DECIMAL(14,2) NOT NULL,
  "benefits" DECIMAL(14,2) NOT NULL,
  "overtime" DECIMAL(14,2) NOT NULL,
  "houseAllowance" DECIMAL(14,2) NOT NULL,
  "grossPay" DECIMAL(14,2) NOT NULL,
  "nssf" DECIMAL(14,2) NOT NULL,
  "taxablePay" DECIMAL(14,2) NOT NULL,
  "grossPaye" DECIMAL(14,2) NOT NULL,
  "personalRelief" DECIMAL(14,2) NOT NULL,
  "insuranceRelief" DECIMAL(14,2) NOT NULL,
  "shif" DECIMAL(14,2) NOT NULL,
  "housingLevy" DECIMAL(14,2) NOT NULL,
  "nita" DECIMAL(14,2) NOT NULL,
  "advanceLoan" DECIMAL(14,2) NOT NULL,
  "netPaye" DECIMAL(14,2) NOT NULL,
  "totalDeductions" DECIMAL(14,2) NOT NULL,
  "netPay" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRun_organizationId_period_key" ON "PayrollRun"("organizationId", "period");
CREATE UNIQUE INDEX "PayrollRun_journalEntryId_key" ON "PayrollRun"("journalEntryId");
CREATE INDEX "PayrollRun_organizationId_idx" ON "PayrollRun"("organizationId");
CREATE INDEX "PayrollRun_organizationId_period_idx" ON "PayrollRun"("organizationId", "period");
CREATE UNIQUE INDEX "PayrollEntry_payrollRunId_employeeId_key" ON "PayrollEntry"("payrollRunId", "employeeId");
CREATE INDEX "PayrollEntry_organizationId_idx" ON "PayrollEntry"("organizationId");
CREATE INDEX "PayrollEntry_organizationId_employeeId_idx" ON "PayrollEntry"("organizationId", "employeeId");

ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PayrollRun"
  USING ("organizationId" = public.current_org_id())
  WITH CHECK ("organizationId" = public.current_org_id());
ALTER TABLE "PayrollEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PayrollEntry"
  USING ("organizationId" = public.current_org_id())
  WITH CHECK ("organizationId" = public.current_org_id());
