import { buildImportMovementReference } from './specialized-commit'

describe('specialized import identity', () => {
  it('keeps the same movement identity when the imported quantity changes', () => {
    const originalRow = {
      source_row: 12,
      branch: 'nairobi',
      direction: 'in',
      reference: 'consumables IN-OUT import',
      qty: 4,
    } as const
    const changedRow = {
      source_row: 12,
      branch: 'nairobi',
      direction: 'in',
      reference: 'consumables IN-OUT import',
      qty: 9,
    } as const

    const original = buildImportMovementReference(originalRow)
    const changedQuantity = buildImportMovementReference(changedRow)

    expect(changedQuantity).toBe(original)
    expect(original).toBe('IMPORT:consumables IN-OUT import:nairobi:in:12')
  })
})
