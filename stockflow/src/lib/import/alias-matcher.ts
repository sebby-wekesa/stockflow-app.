// Normalise product names for alias matching
// This removes punctuation, normalises spaces, and converts to lowercase
export function normaliseForMatching(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalise spaces
    .trim()
}