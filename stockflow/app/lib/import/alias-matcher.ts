// Normalise text for alias matching — remove punctuation, lowercase, etc.
export function normaliseForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ') // normalise whitespace
    .trim()
}

// Matches raw product names in import rows to canonical products using aliases
export async function matchImportBatch(batchId: string) {
  throw new Error('Legacy alias matching is unavailable on the current schema')
}