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

function csvBuffer(csv: string): ArrayBuffer {
  return new TextEncoder().encode(csv).buffer
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
          'Bonje',
          -0.5,
        ],
        [
          'BRAKE LINING CA33 DNA380 (BRAKE LINING CA33 DNA 380)',
          'BRAKE LINING CA33 DNA380 (BRAKE LINING CA33 DNA 380)',
          'Brake lining',
          'kg',
          'Bonje',
          22,
        ],
      ],
    })

    const result = parseConsumablesWorkbook(buffer, 'bonje')

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

  it('maps product-list snapshot columns by header instead of position', () => {
    const buffer = workbookBuffer({
      Sheet1: [
        ['SKU', 'Product name', 'Category', 'Origin', 'Uom', 'Branch', 'Current Stock', 'pcs/sets'],
        ['BRAKE LINING BC 36 DNA10', 'Brake lining DNA10', 'Brake Linings', 'Imported', 'Kg', 'Bonje', 12.5, 38],
        ['BRAKE LINING BC 37 DNA10', 'Brake lining DNA10B', 'Brake Linings', 'Imported', 'Kg', 'Bonje', 0, 15],
        ['BRAKE LINING BC 38 DNA10', 'Brake lining DNA10C', 'Brake Linings', 'Imported', 'Kg', 'Bonje', -2, 3],
      ],
    })

    const rows = parseConsumablesStock(buffer, 'Sheet1', 'bonje')

    expect(rows).toEqual([
      expect.objectContaining({
        source_row: 2,
        raw_product_name: 'Brake lining DNA10',
        qty: 12.5,
        pieces_sets: 38,
        direction: 'balance',
        category: 'break_linings',
        origin: 'IMPORTED',
      }),
      expect.objectContaining({
        source_row: 3,
        raw_product_name: 'Brake lining DNA10B',
        qty: 0,
        pieces_sets: 15,
        direction: 'balance',
        category: 'break_linings',
        origin: 'IMPORTED',
      }),
      expect.objectContaining({
        source_row: 4,
        raw_product_name: 'Brake lining DNA10C',
        qty: -2,
        pieces_sets: 3,
        direction: 'balance',
        category: 'break_linings',
        origin: 'IMPORTED',
      }),
    ])
  })

  it('reads category and origin from a CSV product snapshot', () => {
    const buffer = csvBuffer(
      [
        'SKU,Product name,Category,Origin,Uom,Branch,Current Stock,pcs/sets',
        'HUB-001,Wheel hub,Trailer Parts,Local Purchase,Kg,Nairobi,3,2',
      ].join('\n')
    )

    const rows = parseConsumablesStock(buffer, 'Sheet1', 'nairobi')

    expect(rows).toEqual([
      expect.objectContaining({
        product_code: 'HUB-001',
        raw_product_name: 'Wheel hub',
        category: 'trailer_parts',
        origin: 'LOCAL_PURCHASE',
        qty: 3,
        pieces_sets: 2,
        direction: 'balance',
      }),
    ])
  })
})
