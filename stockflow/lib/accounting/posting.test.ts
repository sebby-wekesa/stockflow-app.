import { postJournalEntry } from "./posting";

function accountingDb(accountIds = ["cash", "sales"]) {
  return {
    chartAccount: {
      findMany: jest.fn().mockResolvedValue(
        accountIds.map((id) => ({ id })),
      ),
    },
    branch: {
      findFirst: jest.fn().mockResolvedValue({ id: "branch-1" }),
    },
    journalEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: "journal-1",
        entryNumber: "JE-2026-000001",
      }),
    },
  };
}

test("posts a balanced journal using active tenant accounts", async () => {
  const db = accountingDb();

  await postJournalEntry(
    db as never,
    "org-1",
    {
      date: new Date("2026-06-11T00:00:00.000Z"),
      lines: [
        { accountId: "cash", debit: 250 },
        { accountId: "sales", credit: 250 },
      ],
    },
    "user-1",
  );

  expect(db.journalEntry.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-1",
        status: "POSTED",
        lines: {
          create: [
            expect.objectContaining({ accountId: "cash", debit: 250 }),
            expect.objectContaining({ accountId: "sales", credit: 250 }),
          ],
        },
      }),
    }),
  );
});

test("stores the branch class when supplied", async () => {
  const db = accountingDb();

  await postJournalEntry(
    db as never,
    "org-1",
    {
      date: new Date("2026-06-11T00:00:00.000Z"),
      branchId: "branch-1",
      lines: [
        { accountId: "cash", debit: 250 },
        { accountId: "sales", credit: 250 },
      ],
    },
    "user-1",
  );

  expect(db.branch.findFirst).toHaveBeenCalledWith({
    where: { id: "branch-1" },
    select: { id: true },
  });
  expect(db.journalEntry.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        branchId: "branch-1",
      }),
    }),
  );
});

test("rejects an unbalanced journal", async () => {
  await expect(
    postJournalEntry(accountingDb() as never, "org-1", {
      date: new Date("2026-06-11T00:00:00.000Z"),
      lines: [
        { accountId: "cash", debit: 250 },
        { accountId: "sales", credit: 200 },
      ],
    }),
  ).rejects.toThrow(/do not equal/);
});

test("rejects a journal line that is outside the tenant account set", async () => {
  await expect(
    postJournalEntry(accountingDb(["cash"]) as never, "org-1", {
      date: new Date("2026-06-11T00:00:00.000Z"),
      lines: [
        { accountId: "cash", debit: 250 },
        { accountId: "other-org-sales", credit: 250 },
      ],
    }),
  ).rejects.toThrow("active account from your organization");
});
