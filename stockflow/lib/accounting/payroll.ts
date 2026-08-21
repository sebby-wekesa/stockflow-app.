export const PERSONAL_RELIEF = 2400;
export const NSSF_RATE = 0.06;
export const NSSF_CAP = 2160;
export const SHIF_RATE = 0.0275;
export const INSURANCE_RELIEF_RATE = 0.15;
export const HOUSING_LEVY_RATE = 0.015;

export type PayrollInput = {
  employeeId: string;
  basicSalary: number;
  absenteeism?: number;
  leaveArrears?: number;
  benefits?: number;
  overtime?: number;
  houseAllowance?: number;
  nita?: number;
  advanceLoan?: number;
};

export type PayrollCalculation = PayrollInput & {
  absenteeism: number;
  leaveArrears: number;
  benefits: number;
  overtime: number;
  houseAllowance: number;
  nita: number;
  advanceLoan: number;
  grossPay: number;
  nssf: number;
  taxablePay: number;
  grossPaye: number;
  personalRelief: number;
  insuranceRelief: number;
  shif: number;
  housingLevy: number;
  netPaye: number;
  totalDeductions: number;
  netPay: number;
};

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const amount = (value: number | undefined) => round2(Number(value ?? 0));

export function calculateGrossPaye(taxablePay: number) {
  const taxable = Math.max(0, taxablePay);
  if (taxable > 800000) return round2(219883.25 + (taxable - 800000) * 0.35);
  if (taxable > 500000) return round2(122383.25 + (taxable - 500000) * 0.325);
  if (taxable > 32333) return round2(4483.25 + (taxable - 32333) * 0.3);
  if (taxable > 24000) return round2(2400 + (taxable - 24000) * 0.25);
  return round2(taxable * 0.1);
}

export function calculatePayroll(input: PayrollInput): PayrollCalculation {
  const basicSalary = amount(input.basicSalary);
  const absenteeism = amount(input.absenteeism);
  const leaveArrears = amount(input.leaveArrears);
  const benefits = amount(input.benefits);
  const overtime = amount(input.overtime);
  const houseAllowance = amount(input.houseAllowance);
  const nita = amount(input.nita);
  const advanceLoan = amount(input.advanceLoan);
  const grossPay = round2(
    basicSalary - absenteeism + leaveArrears + benefits + overtime + houseAllowance,
  );
  const nssf = round2(Math.min(grossPay * NSSF_RATE, NSSF_CAP));
  const taxablePay = round2(Math.max(0, grossPay - nssf));
  const grossPaye = calculateGrossPaye(taxablePay);
  const shif = round2(grossPay * SHIF_RATE);
  const insuranceRelief = round2(shif * INSURANCE_RELIEF_RATE);
  const housingLevy = round2(grossPay * HOUSING_LEVY_RATE);
  const netPaye = round2(
    Math.max(0, grossPaye - (PERSONAL_RELIEF + insuranceRelief)),
  );
  const totalDeductions = round2(
    nssf + netPaye + shif + housingLevy + nita + advanceLoan,
  );
  const netPay = round2(grossPay - totalDeductions);

  return {
    ...input,
    basicSalary,
    absenteeism,
    leaveArrears,
    benefits,
    overtime,
    houseAllowance,
    nita,
    advanceLoan,
    grossPay,
    nssf,
    taxablePay,
    grossPaye,
    personalRelief: PERSONAL_RELIEF,
    insuranceRelief,
    shif,
    housingLevy,
    netPaye,
    totalDeductions,
    netPay,
  };
}
