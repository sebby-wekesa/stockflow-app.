import {
  calculateGrossPaye,
  calculatePayroll,
  NSSF_CAP,
  PERSONAL_RELIEF,
} from "./payroll";

describe("payroll calculations", () => {
  it("uses the graduated PAYE bands", () => {
    expect(calculateGrossPaye(24000)).toBe(2400);
    expect(calculateGrossPaye(24001)).toBe(2400.25);
    expect(calculateGrossPaye(32333)).toBe(4483.25);
    expect(calculateGrossPaye(500001)).toBe(122383.58);
    expect(calculateGrossPaye(800001)).toBe(219883.6);
  });

  it("calculates the PAYE sheet columns and caps NSSF", () => {
    const result = calculatePayroll({
      employeeId: "employee-1",
      basicSalary: 100000,
      absenteeism: 2000,
      leaveArrears: 1000,
      benefits: 500,
      overtime: 1500,
      houseAllowance: 20000,
      nita: 100,
      advanceLoan: 5000,
    });

    expect(result.grossPay).toBe(121000);
    expect(result.nssf).toBe(NSSF_CAP);
    expect(result.taxablePay).toBe(118840);
    expect(result.grossPaye).toBe(30435.35);
    expect(result.personalRelief).toBe(PERSONAL_RELIEF);
    expect(result.shif).toBe(3327.5);
    expect(result.insuranceRelief).toBe(499.13);
    expect(result.housingLevy).toBe(1815);
    expect(result.netPaye).toBe(27536.22);
    expect(result.totalDeductions).toBe(39938.72);
    expect(result.netPay).toBe(81061.28);
  });

  it("does not produce negative PAYE for low taxable pay", () => {
    const result = calculatePayroll({
      employeeId: "employee-2",
      basicSalary: 20000,
    });

    expect(result.grossPay).toBe(20000);
    expect(result.netPaye).toBe(0);
    expect(result.netPay).toBeGreaterThan(0);
  });
});
