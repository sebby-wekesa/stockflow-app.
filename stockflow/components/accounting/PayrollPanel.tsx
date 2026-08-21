"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { postPayroll, type PayrollWorkspaceData } from "@/actions/accounting-payroll";
import { calculatePayroll, type PayrollInput } from "@/lib/accounting/payroll";
import styles from "./AccountingWorkspace.module.css";

type PayrollRow = PayrollInput;
type EditableField =
  | "basicSalary"
  | "absenteeism"
  | "leaveArrears"
  | "benefits"
  | "overtime"
  | "houseAllowance"
  | "nita"
  | "advanceLoan";

const EDITABLE_FIELDS: { key: EditableField; label: string }[] = [
  { key: "basicSalary", label: "Basic salary" },
  { key: "absenteeism", label: "Absentism" },
  { key: "leaveArrears", label: "Leave/Arr" },
  { key: "benefits", label: "Benefits" },
  { key: "overtime", label: "Overtime" },
  { key: "houseAllowance", label: "House allowance" },
  { key: "nita", label: "NITA" },
  { key: "advanceLoan", label: "Advance / loan" },
];

function initialRow(employeeId = ""): PayrollRow {
  return {
    employeeId,
    basicSalary: 0,
    absenteeism: 0,
    leaveArrears: 0,
    benefits: 0,
    overtime: 0,
    houseAllowance: 0,
    nita: 0,
    advanceLoan: 0,
  };
}

function number(value: number | undefined) {
  return value && value !== 0 ? String(value) : "";
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function calculatePreview(row: PayrollRow) {
  return calculatePayroll(row);
}

export function PayrollPanel({
  payroll,
  pending,
  runAction,
}: {
  payroll: PayrollWorkspaceData;
  pending: boolean;
  runAction: (action: () => Promise<{ success: boolean; error?: string }>, successText: string) => void;
}) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<PayrollRow[]>(() =>
    payroll.employees.slice(0, 1).map((employee) => initialRow(employee.id)),
  );

  const totalGross = rows.reduce((sum, row) => sum + calculatePreview(row).grossPay, 0);
  const totalDeductions = rows.reduce((sum, row) => sum + calculatePreview(row).totalDeductions, 0);
  const totalNet = rows.reduce((sum, row) => sum + calculatePreview(row).netPay, 0);

  function updateRow(index: number, patch: Partial<PayrollRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function addRow() {
    const used = new Set(rows.map((row) => row.employeeId));
    const employee = payroll.employees.find((item) => !used.has(item.id));
    if (employee) setRows((current) => [...current, initialRow(employee.id)]);
  }

  function submit() {
    runAction(
      () => postPayroll({ period, payDate, rows }),
      "Payroll posted",
    );
  }

  return (
    <section className={`${styles.panel} ${styles.fullWidth}`}>
      <div className={styles.panelHeader}>
        <div>
          <div className={styles.panelTitle}>PAYE payroll</div>
          <div className={styles.panelSub}>
            Enter earnings and manual deductions. Statutory values are calculated from the PAYE sheet formulas before posting to the ledger.
          </div>
        </div>
        <div className={styles.payrollActions}>
          <button type="button" className={styles.ghostButton} onClick={addRow} disabled={pending || rows.length >= payroll.employees.length}>
            <UserPlus size={15} aria-hidden="true" /> Add employee
          </button>
          <button type="button" className={styles.button} onClick={submit} disabled={pending || rows.length === 0}>
            {pending ? "Posting…" : "Post payroll"}
          </button>
        </div>
      </div>

      <div className={styles.payrollToolbar}>
        <label className={styles.field}>
          <span>Payroll period</span>
          <input className={styles.input} type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Pay date</span>
          <input className={styles.input} type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} />
        </label>
        <div className={styles.payrollSummary}>
          <span>Gross <strong>KES {money(totalGross)}</strong></span>
          <span>Deductions <strong>KES {money(totalDeductions)}</strong></span>
          <span>Net pay <strong>KES {money(totalNet)}</strong></span>
        </div>
      </div>

      {payroll.employees.length === 0 ? (
        <div className={styles.payrollNotice}>No employee users are available for payroll yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.payrollTable}`}>
            <thead>
              <tr>
                <th>NAME</th>
                {EDITABLE_FIELDS.map((field) => <th key={field.key}>{field.label}</th>)}
                <th>GROSS PAY</th>
                <th>NSSF</th>
                <th>TAXABLE PAY</th>
                <th>PAYE</th>
                <th>PERSONAL RELIEF</th>
                <th>INS RELIEF</th>
                <th>SHIF</th>
                <th>HSE LEVY</th>
                <th>NET PAYE</th>
                <th>TOTAL DEDUCTIONS</th>
                <th>NET PAY</th>
                <th aria-label="Remove row" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const preview = calculatePreview(row);
                const usedByOtherRow = new Set(rows.filter((_, rowIndex) => rowIndex !== index).map((item) => item.employeeId));
                return (
                  <tr key={`${row.employeeId}-${index}`}>
                    <td>
                      <select className={styles.select} value={row.employeeId} onChange={(event) => updateRow(index, { employeeId: event.target.value })}>
                        <option value="">Select employee</option>
                        {payroll.employees.map((employee) => (
                          <option key={employee.id} value={employee.id} disabled={usedByOtherRow.has(employee.id)}>{employee.name}</option>
                        ))}
                      </select>
                    </td>
                    {EDITABLE_FIELDS.map((field) => (
                      <td key={field.key}>
                        <input
                          className={styles.input}
                          type="number"
                          min={field.key === "leaveArrears" ? undefined : 0}
                          step="0.01"
                          value={number(row[field.key])}
                          onChange={(event) => updateRow(index, { [field.key]: Number(event.target.value || 0) })}
                        />
                      </td>
                    ))}
                    <td className={styles.num}>{money(preview.grossPay)}</td>
                    <td className={styles.num}>{money(preview.nssf)}</td>
                    <td className={styles.num}>{money(preview.taxablePay)}</td>
                    <td className={styles.num}>{money(preview.grossPaye)}</td>
                    <td className={styles.num}>{money(preview.personalRelief)}</td>
                    <td className={styles.num}>{money(preview.insuranceRelief)}</td>
                    <td className={styles.num}>{money(preview.shif)}</td>
                    <td className={styles.num}>{money(preview.housingLevy)}</td>
                    <td className={styles.num}>{money(preview.netPaye)}</td>
                    <td className={styles.num}>{money(preview.totalDeductions)}</td>
                    <td className={styles.num}>{money(preview.netPay)}</td>
                    <td>
                      <button type="button" className={styles.iconButton} onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} aria-label="Remove employee">
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.payrollNote}>
        PAYE is posted as net tax after personal and insurance relief. Advance/loan deductions reduce Employee Receivables; net pay is credited to Employee Payables.
      </div>

      <div className={styles.payrollHistory}>
        <div className={styles.panelTitle}>Posted payroll runs</div>
        {payroll.runs.length === 0 ? (
          <div className={styles.empty}>No payroll runs posted yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Period</th><th>Pay date</th><th>Employees</th><th className={styles.num}>Gross</th><th className={styles.num}>Deductions</th><th className={styles.num}>Net pay</th><th>Journal</th><th>Status</th></tr></thead>
              <tbody>{payroll.runs.map((run) => <tr key={run.id}><td>{run.period}</td><td>{run.payDate}</td><td>{run.employeeCount}</td><td className={styles.num}>{money(run.totalGrossPay)}</td><td className={styles.num}>{money(run.totalDeductions)}</td><td className={styles.num}>{money(run.totalNetPay)}</td><td>{run.entryNumber ?? "-"}</td><td><span className={styles.badge}>{run.status}</span></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
