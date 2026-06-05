import * as XLSX from 'xlsx'
import {
  parseConsumablesStock,
  parseConsumablesWorkbook,
} from './specialized-parsers'

function workbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName)
  }

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('specialized consumables parser', () => {
  it('does not reject product names containing "in"', () => {
    const buffer = workbookBuffer({
      'consumables IN-OUT': [
        ['Product', 'Qty In', 'Product', 'Qty Out'],
        ['Brake lining cleaner', 7, 'Center bolt', 2],
      ],
    })

    const rows = parseConsumablesStock(buffer, 'consumables IN-OUT', 'nairobi')

    expect(rows).toEqual([
      expect.objectContaining({
        raw_product_name: 'Brake lining cleaner',
        qty: 7,
        direction: 'in',
      }),
      expect.objectContaining({
        raw_product_name: 'Center bolt',
        qty: 2,
        direction: 'out',
      }),
    ])
  })

  it('finds consumables sheets without an exact IN-OUT tab name', () => {
    const buffer = workbookBuffer({
      Summary: [['Heading']],
      Consumables: [
        ['Item', 'Quantity'],
        ['Grease cartridge', 4],
      ],
    })

    const result = parseConsumablesWorkbook(buffer, 'mombasa')

    expect(result.candidateSheetNames).toEqual(['Consumables'])
    expect(result.rows).toEqual([
      expect.objectContaining({
        raw_product_name: 'Grease cartridge',
        qty: 4,
        direction: 'in',
      }),
    ])
  })

  it('parses stock snapshot rows with quantity in the sixth column', () => {
    const buffer = workbookBuffer({
      Consumables: [
        ['Product', 'Name', 'Category', 'UOM', 'Branch', 'Current Stock'],
        [
          'BRAKE LINING CA 33 DNA 10 (BRAKE LINING CA 33 DNA 10)',
          'BRAKE LINING CA 33 DNA 10 (BRAKE LINING CA 33 DNA 10)',
          'Brake lining',
          'kg',
          'Bunje',
          -0.5,
        ],
        [
          'BRAKE LINING CA33 DNA380 (BRAKE LINING CA33 DNA 380)',
          'BRAKE LINING CA33 DNA380 (BRAKE LINING CA33 DNA 380)',
          'Brake lining',
          'kg',
          'Bunje',
          22,
        ],
      ],
    })

    const result = parseConsumablesWorkbook(buffer, 'bunje')

    expect(result.rows).toEqual([
      expect.objectContaining({
        raw_product_name: 'BRAKE LINING CA 33 DNA 10 (BRAKE LINING CA 33 DNA 10)',
        qty: 0.5,
        direction: 'out',
      }),
      expect.objectContaining({
        raw_product_name: 'BRAKE LINING CA33 DNA380 (BRAKE LINING CA33 DNA 380)',
        qty: 22,
        direction: 'in',
      }),
    ])
  })
})
