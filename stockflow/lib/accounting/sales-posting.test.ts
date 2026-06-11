import { postSaleToLedger, voidSalePosting } from "./sales-posting";

function accountingDb() {
  return {
    chartAccount: {
      findMany: jest.fn().mockResolvedValue([
        { id: "ar", description: "key:accounts_receivable" },
        { id: "sales", description: "key:sales_revenue" },
      ]),
    },
    journalEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "journal-1",
        entryNumber: "JE-2026-000001",
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

test("posts confirmed sale value to receivables and sales revenue", async () => {
  const db = accountingDb();
  const result = await postSaleToLedger(
    db as never,
    "org-1",
    {
      id: "sale-1",
      totalAmount: 1_500,
      date: new Date("2026-06-11T00:00:00.000Z"),
    },
    "user-1",
  );

  expect(result).toEqual({ posted: true });
  expect(db.journalEntry.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        source: "SALE",
        sourceId: "sale-1",
        lines: {
          create: [
            expect.objectContaining({ accountId: "ar", debit: 1_500 }),
            expect.objectContaining({ accountId: "sales", credit: 1_500 }),
          ],
        },
      }),
    }),
  );
});

test("skips a sale that is already posted", async () => {
  const db = accountingDb();
  db.journalEntry.findFirst.mockResolvedValue({
    id: "journal-existing",
  } as never);

  const result = await postSaleToLedger(db as never, "org-1", {
    id: "sale-1",
    totalAmount: 1_500,
    date: new Date("2026-06-11T00:00:00.000Z"),
  });

  expect(result).toEqual({ posted: false, reason: "already posted" });
  expect(db.journalEntry.create).not.toHaveBeenCalled();
});

test("voids a posted sale when the order is cancelled", async () => {
  const db = accountingDb();
  await voidSalePosting(db as never, "sale-1");

  expect(db.journalEntry.updateMany).toHaveBeenCalledWith({
    where: {
      source: "SALE",
      sourceType: "SaleOrder",
      sourceId: "sale-1",
      status: "POSTED",
    },
    data: { status: "VOID" },
  });
});
