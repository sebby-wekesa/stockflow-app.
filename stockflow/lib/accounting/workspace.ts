export type CurrencyBalanceInput = {
  currency: string;
  balance: number;
  isActive: boolean;
};

export type CurrencyBalanceSummary = {
  currency: string;
  amount: number;
};

export type SourceClassificationType = "Customer" | "Supplier" | "Employee" | "Other";

export type SourceClassificationOption = {
  id: string;
  name: string;
  type: SourceClassificationType;
};

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function summarizeCurrencyBalances(
  accounts: CurrencyBalanceInput[],
): CurrencyBalanceSummary[] {
  const totals = new Map<string, number>();
  for (const account of accounts) {
    if (!account.isActive) continue;
    const currency = account.currency.trim().toUpperCase() || "KES";
    totals.set(currency, round2((totals.get(currency) ?? 0) + account.balance));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ currency, amount }));
}

export function primaryCurrencyBalance(
  balances: CurrencyBalanceSummary[],
  preferredCurrency = "KES",
) {
  return balances.find((balance) => balance.currency === preferredCurrency)?.amount ??
    balances[0]?.amount ??
    0;
}

export function maskAccountingAccountNumber(value?: string | null) {
  const cleaned = value?.replace(/\s+/g, "") ?? "";
  if (!cleaned) return null;
  if (cleaned.length <= 4) return `**** ${cleaned}`;
  return `**** ${cleaned.slice(-4)}`;
}

export function resolveClassifiedSource(
  parties: SourceClassificationOption[],
  input: {
    sourceName: string;
    sourceId: string | null;
    sourceType: SourceClassificationType;
  },
) {
  const selectedParty = input.sourceId
    ? parties.find((party) => party.id === input.sourceId)
    : null;
  if (selectedParty?.type === input.sourceType) {
    return selectedParty;
  }

  return parties.find(
    (party) =>
      party.type === input.sourceType &&
      party.name.toLowerCase() === input.sourceName.trim().toLowerCase(),
  ) ?? null;
}
