import {
  maskAccountingAccountNumber,
  primaryCurrencyBalance,
  resolveClassifiedSource,
  summarizeCurrencyBalances,
} from "./workspace";

test("summarizes active cash-book balances by currency without mixing currencies", () => {
  const balances = summarizeCurrencyBalances([
    { currency: "KES", balance: 250_000, isActive: true },
    { currency: "kes", balance: 85_000, isActive: true },
    { currency: "USD", balance: 500, isActive: true },
    { currency: "KES", balance: 10_000, isActive: false },
  ]);

  expect(balances).toEqual([
    { currency: "KES", amount: 335_000 },
    { currency: "USD", amount: 500 },
  ]);
  expect(primaryCurrencyBalance(balances)).toBe(335_000);
});

test("masks account numbers while preserving the last four characters", () => {
  expect(maskAccountingAccountNumber("1234567890")).toBe("**** 7890");
  expect(maskAccountingAccountNumber("4521")).toBe("**** 4521");
  expect(maskAccountingAccountNumber(null)).toBeNull();
});

test("links classified sources to matching existing entities", () => {
  const parties = [
    { id: "customer-1", name: "Acme", type: "Customer" as const },
    { id: "supplier-1", name: "Acme", type: "Supplier" as const },
  ];

  expect(
    resolveClassifiedSource(parties, {
      sourceName: "Acme",
      sourceId: "customer-1",
      sourceType: "Customer",
    }),
  ).toEqual(parties[0]);

  expect(
    resolveClassifiedSource(parties, {
      sourceName: "Acme",
      sourceId: "customer-1",
      sourceType: "Supplier",
    }),
  ).toEqual(parties[1]);
});
