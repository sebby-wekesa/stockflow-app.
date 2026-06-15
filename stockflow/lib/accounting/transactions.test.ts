import {
  buildBillLines,
  buildEquityLines,
  buildExpenseLines,
  buildIncomeLines,
  buildInvoiceLines,
  buildTransferLines,
  splitVatInclusive,
} from "./transactions";

function totals(lines: { debit?: number; credit?: number }[]) {
  return lines.reduce<{ debit: number; credit: number }>(
    (sum, line) => ({
      debit: sum.debit + (line.debit ?? 0),
      credit: sum.credit + (line.credit ?? 0),
    }),
    { debit: 0, credit: 0 },
  );
}

test("splits VAT-inclusive amounts using the Kenyan 16 percent rate", () => {
  expect(splitVatInclusive(1_160, true)).toEqual({
    net: 1_000,
    vat: 160,
    gross: 1_160,
  });
  expect(splitVatInclusive(99.99, false)).toEqual({
    net: 99.99,
    vat: 0,
    gross: 99.99,
  });
});

test.each([
  [buildExpenseLines({
    amount: 1_160,
    hasVat: true,
    expenseAccountId: "expense",
    bankAccountId: "bank",
    vatInputAccountId: "vat-input",
  })],
  [buildIncomeLines({
    amount: 1_160,
    hasVat: true,
    incomeAccountId: "income",
    bankAccountId: "bank",
    vatOutputAccountId: "vat-output",
  })],
  [buildBillLines({
    amount: 1_160,
    hasVat: true,
    purchaseAccountId: "expense",
    payableAccountId: "payable",
    vatInputAccountId: "vat-input",
  })],
  [buildInvoiceLines({
    amount: 1_160,
    hasVat: true,
    receivableAccountId: "receivable",
    salesAccountId: "sales",
    vatOutputAccountId: "vat-output",
  })],
  [buildTransferLines({
    amount: 1_160,
    fromAccountId: "bank-a",
    toAccountId: "bank-b",
  })],
  [buildEquityLines({
    kind: "CAPITAL",
    amount: 1_160,
    equityAccountId: "capital",
    bankAccountId: "bank",
  })],
  [buildEquityLines({
    kind: "DRAWINGS",
    amount: 1_160,
    equityAccountId: "drawings",
    bankAccountId: "bank",
  })],
])("builds a balanced transaction journal", (lines) => {
  expect(totals(lines)).toEqual({ debit: 1_160, credit: 1_160 });
});

test("requires the relevant VAT account when VAT is enabled", () => {
  expect(() =>
    buildExpenseLines({
      amount: 1_160,
      hasVat: true,
      expenseAccountId: "expense",
      bankAccountId: "bank",
    }),
  ).toThrow("required VAT account");
});
