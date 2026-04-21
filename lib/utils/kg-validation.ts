// lib/utils/kg-validation.ts
export function validateBalance(input: number, out: number, scrap: number) {
  const balance = input - (out + scrap);
  const isValid = balance === 0;
  return { balance, isValid };
}