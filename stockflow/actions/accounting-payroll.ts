"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  calculatePayroll,
  type PayrollCalculation,
  type PayrollInput,
} from "@/lib/accounting/payroll";
import {
  getSystemAccounts,
  postJournalEntry,
  SYSTEM_ACCOUNT_KEYS,
} from "@/lib/accounting/posting";
import { getTenantPrisma, withTenantTransaction } from "@/lib/tenant-prisma";

const ACCOUNTING_ROLES = ["ADMIN", "MANAGER", "ACCOUNTS"] as const;
const EMPLOYEE_ROLES = [
  "ADMIN",
  "MANAGER",
  "ACCOUNTS",
  "OPERATOR",
  "SALES",
  "PACKAGING",
  "WAREHOUSE",
] as const;

export type PayrollEmployeeOption = {
  id: string;
  name: string;
  email: string;
};

export type PayrollRunSummary = {
  id: string;
  period: string;
  payDate: string;
  status: string;
  entryNumber: string | null;
  employeeCount: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
};

export type PayrollWorkspaceData = {
  employees: PayrollEmployeeOption[];
  runs: PayrollRunSummary[];
};

type PayrollRowInput = Omit<PayrollInput, "employeeId"> & { employeeId: string };

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validPeriod(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function ensureNonNegative(row: PayrollRowInput, index: number) {
  const fields = [
    "basicSalary",
    "absenteeism",
    "benefits",
    "overtime",
    "houseAllowance",
    "nita",
    "advanceLoan",
  ] as const;
  for (const field of fields) {
    const value = Number(row[field] ?? 0);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Payroll row ${index + 1}: ${field} must be zero or more`);
    }
  }
  const leaveArrears = Number(row.leaveArrears ?? 0);
  if (!Number.isFinite(leaveArrears)) {
    throw new Error(`Payroll row ${index + 1}: leave arrears must be a valid number`);
  }
}

async function ensurePayrollAccounts(tx: any) {
  const required = [
    { code: "5100", name: "Salaries & Wages", type: "EXPENSE", key: SYSTEM_ACCOUNT_KEYS.SALARIES_WAGES },
    { code: "1210", name: "Employee Receivables", type: "ASSET", key: SYSTEM_ACCOUNT_KEYS.EMPLOYEE_RECEIVABLES },
    { code: "2110", name: "PAYE Payable", type: "LIABILITY", key: SYSTEM_ACCOUNT_KEYS.PAYE_PAYABLE },
    { code: "2130", name: "NSSF Payable", type: "LIABILITY", key: SYSTEM_ACCOUNT_KEYS.NSSF_PAYABLE },
    { code: "2140", name: "SHIF Payable", type: "LIABILITY", key: SYSTEM_ACCOUNT_KEYS.SHIF_PAYABLE },
    { code: "2150", name: "Affordable Housing Levy Payable", type: "LIABILITY", key: SYSTEM_ACCOUNT_KEYS.HOUSING_LEVY_PAYABLE },
    { code: "2160", name: "NITA Payable", type: "LIABILITY", key: SYSTEM_ACCOUNT_KEYS.NITA_PAYABLE },
    { code: "2210", name: "Employee Payables", type: "LIABILITY", key: SYSTEM_ACCOUNT_KEYS.EMPLOYEE_PAYABLES },
  ] as const;

  for (const item of required) {
    const account = await tx.chartAccount.findFirst({
      where: { code: item.code },
      select: { id: true, type: true, normalBalance: true, isActive: true, isSystem: true, description: true },
    });
    const expectedBalance = item.type === "EXPENSE" || item.type === "ASSET" ? "DEBIT" : "CREDIT";
    if (account && (account.type !== item.type || account.normalBalance !== expectedBalance || !account.isActive)) {
      throw new Error(`${item.name} account ${item.code} is inactive or has the wrong type`);
    }
    if (account) {
      if (!account.isSystem || account.description !== `key:${item.key}`) {
        await tx.chartAccount.update({
          where: { id: account.id },
          data: { isSystem: true, description: `key:${item.key}` },
        });
      }
      continue;
    }
    await tx.chartAccount.create({
      data: {
        code: item.code,
        name: item.name,
        type: item.type,
        normalBalance: expectedBalance,
        isSystem: true,
        description: `key:${item.key}`,
      },
    });
  }

  const systemAccounts = await getSystemAccounts(tx);
  const requiredKeys = [
    SYSTEM_ACCOUNT_KEYS.SALARIES_WAGES,
    SYSTEM_ACCOUNT_KEYS.PAYE_PAYABLE,
    SYSTEM_ACCOUNT_KEYS.NSSF_PAYABLE,
    SYSTEM_ACCOUNT_KEYS.SHIF_PAYABLE,
    SYSTEM_ACCOUNT_KEYS.HOUSING_LEVY_PAYABLE,
    SYSTEM_ACCOUNT_KEYS.NITA_PAYABLE,
    SYSTEM_ACCOUNT_KEYS.EMPLOYEE_PAYABLES,
    SYSTEM_ACCOUNT_KEYS.EMPLOYEE_RECEIVABLES,
  ];
  for (const key of requiredKeys) {
    if (!systemAccounts[key]) {
      throw new Error(`Required payroll account is missing: ${key}`);
    }
  }
  return systemAccounts;
}

export async function getPayrollWorkspaceData(): Promise<PayrollWorkspaceData> {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const db = getTenantPrisma(user.organizationId);
  const [employees, runs] = await Promise.all([
    db.user.findMany({
      where: { role: { in: [...EMPLOYEE_ROLES] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    db.payrollRun.findMany({
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: 12,
      include: {
        journalEntry: { select: { entryNumber: true } },
        _count: { select: { entries: true } },
      },
    }),
  ]);

  return {
    employees: employees.map((employee) => ({
      id: employee.id,
      name: employee.name || employee.email,
      email: employee.email,
    })),
    runs: runs.map((run) => ({
      id: run.id,
      period: run.period,
      payDate: run.payDate.toISOString().slice(0, 10),
      status: run.status,
      entryNumber: run.journalEntry?.entryNumber ?? null,
      employeeCount: run._count.entries,
      totalGrossPay: Number(run.totalGrossPay),
      totalDeductions: Number(run.totalDeductions),
      totalNetPay: Number(run.totalNetPay),
    })),
  };
}

export async function postPayroll(input: {
  period: string;
  payDate: string;
  rows: PayrollRowInput[];
}) {
  const user = await requireRole(...ACCOUNTING_ROLES);
  const period = input.period.trim();
  const payDate = parseDate(input.payDate);
  if (!validPeriod(period)) return { success: false, error: "Enter a valid payroll period (YYYY-MM)" };
  if (!payDate) return { success: false, error: "Enter a valid pay date" };
  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { success: false, error: "Add at least one employee to the payroll" };
  }

  try {
    for (const [index, row] of input.rows.entries()) {
      if (!row.employeeId) throw new Error(`Payroll row ${index + 1}: employee is required`);
      ensureNonNegative(row, index);
    }
    const employeeIds = input.rows.map((row) => row.employeeId);
    if (new Set(employeeIds).size !== employeeIds.length) {
      throw new Error("An employee can only appear once in a payroll run");
    }

    const result = await withTenantTransaction(user.organizationId, async (tx) => {
      const existing = await tx.payrollRun.findFirst({ where: { period }, select: { id: true } });
      if (existing) throw new Error(`Payroll for ${period} has already been posted`);

      const employees = await tx.user.findMany({
        where: { id: { in: employeeIds }, role: { in: [...EMPLOYEE_ROLES] } },
        select: { id: true, name: true, email: true },
      });
      if (employees.length !== employeeIds.length) {
        throw new Error("Every payroll employee must belong to your organization");
      }

      const calculations: PayrollCalculation[] = input.rows.map((row) => calculatePayroll(row));
      if (calculations.some((row) => row.grossPay < 0 || row.netPay < 0)) {
        throw new Error("Payroll cannot post a negative gross or net pay");
      }
      const totals = calculations.reduce(
        (sum, row) => ({
          gross: round2(sum.gross + row.grossPay),
          deductions: round2(sum.deductions + row.totalDeductions),
          net: round2(sum.net + row.netPay),
        }),
        { gross: 0, deductions: 0, net: 0 },
      );
      if (totals.gross <= 0) throw new Error("Payroll gross pay must be greater than zero");
      const payrollRun = await tx.payrollRun.create({
        data: {
          period,
          payDate,
          status: "DRAFT",
          totalGrossPay: totals.gross,
          totalDeductions: totals.deductions,
          totalNetPay: totals.net,
          createdBy: user.id,
        },
        select: { id: true },
      });

      const accounts = await ensurePayrollAccounts(tx);
      const lines = [
        { accountId: accounts[SYSTEM_ACCOUNT_KEYS.SALARIES_WAGES], debit: totals.gross, description: `Gross salaries - ${period}` },
        { accountId: accounts[SYSTEM_ACCOUNT_KEYS.EMPLOYEE_PAYABLES], credit: totals.net, description: `Net salaries payable - ${period}` },
        { accountId: accounts[SYSTEM_ACCOUNT_KEYS.PAYE_PAYABLE], credit: round2(calculations.reduce((sum, row) => sum + row.netPaye, 0)), description: `PAYE - ${period}` },
        { accountId: accounts[SYSTEM_ACCOUNT_KEYS.NSSF_PAYABLE], credit: round2(calculations.reduce((sum, row) => sum + row.nssf, 0)), description: `NSSF - ${period}` },
        { accountId: accounts[SYSTEM_ACCOUNT_KEYS.SHIF_PAYABLE], credit: round2(calculations.reduce((sum, row) => sum + row.shif, 0)), description: `SHIF - ${period}` },
        { accountId: accounts[SYSTEM_ACCOUNT_KEYS.HOUSING_LEVY_PAYABLE], credit: round2(calculations.reduce((sum, row) => sum + row.housingLevy, 0)), description: `Affordable Housing Levy - ${period}` },
        { accountId: accounts[SYSTEM_ACCOUNT_KEYS.NITA_PAYABLE], credit: round2(calculations.reduce((sum, row) => sum + row.nita, 0)), description: `NITA - ${period}` },
      ];
      const advances = round2(calculations.reduce((sum, row) => sum + row.advanceLoan, 0));
      if (advances > 0) {
        lines.push({ accountId: accounts[SYSTEM_ACCOUNT_KEYS.EMPLOYEE_RECEIVABLES], credit: advances, description: `Employee advances and loans - ${period}` });
      }
      const journal = await postJournalEntry(tx, user.organizationId, {
        date: payDate,
        memo: `Payroll for ${period}`,
        source: "MANUAL",
        sourceType: "Payroll",
        sourceId: payrollRun.id,
        lines,
      }, user.id);

      await tx.payrollEntry.createMany({
        data: calculations.map((row) => ({
          payrollRunId: payrollRun.id,
          employeeId: row.employeeId,
          basicSalary: row.basicSalary,
          absenteeism: row.absenteeism,
          leaveArrears: row.leaveArrears,
          benefits: row.benefits,
          overtime: row.overtime,
          houseAllowance: row.houseAllowance,
          grossPay: row.grossPay,
          nssf: row.nssf,
          taxablePay: row.taxablePay,
          grossPaye: row.grossPaye,
          personalRelief: row.personalRelief,
          insuranceRelief: row.insuranceRelief,
          shif: row.shif,
          housingLevy: row.housingLevy,
          nita: row.nita,
          advanceLoan: row.advanceLoan,
          netPaye: row.netPaye,
          totalDeductions: row.totalDeductions,
          netPay: row.netPay,
        })),
      });
      await tx.payrollRun.update({
        where: { id: payrollRun.id },
        data: { status: "POSTED", journalEntryId: journal.id, postedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "ACCOUNTING_PAYROLL_POSTED",
          entityType: "PayrollRun",
          entityId: payrollRun.id,
          details: JSON.stringify({ period, employeeCount: calculations.length, journalEntryId: journal.id, ...totals }),
        },
      });

      return { payrollRunId: payrollRun.id, entryNumber: journal.entryNumber, ...totals };
    });

    for (const path of ["/accounting", "/accounting/ledger", "/accounting/trial-balance", "/accounting/profit-loss", "/accounting/balance-sheet"]) {
      revalidatePath(path);
    }
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not post payroll" };
  }
}
