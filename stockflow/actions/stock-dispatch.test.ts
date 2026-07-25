import { dispatchTransfer } from './stock'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  requireActiveAuth: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  withRetry: jest.fn((operation: () => unknown) => operation()),
}))

jest.mock('@/lib/tenant-prisma', () => ({
  getTenantPrisma: jest.fn(),
  withTenantTransaction: jest.fn(),
}))

const mockedRequireActiveAuth = jest.mocked(requireActiveAuth)
const mockedGetTenantPrisma = jest.mocked(getTenantPrisma)
const mockedWithTenantTransaction = jest.mocked(withTenantTransaction)

beforeEach(() => {
  jest.clearAllMocks()
})

it('dispatches multiple products atomically as separate auditable transfer lines', async () => {
  const products = [
    {
      id: 'product-1',
      sku: 'SPRING-1',
      name: 'Spring 1',
      currentStock: 100,
      piecesSets: 0,
      branchId: 'branch-source',
    },
    {
      id: 'product-2',
      sku: 'SPRING-2',
      name: 'Spring 2',
      currentStock: 80,
      piecesSets: 0,
      branchId: 'branch-source',
    },
  ]
  const branchFindMany = jest.fn().mockResolvedValue([
    { id: 'branch-source', name: 'Mombasa HQ', code: 'mombasa', location: null },
    { id: 'branch-destination', name: 'Nairobi', code: 'nairobi', location: null },
  ])
  const productFindMany = jest.fn().mockResolvedValue(products)
  const stockUpsert = jest.fn()
    .mockResolvedValueOnce({ id: 'source-stock-1' })
    .mockResolvedValueOnce({ id: 'source-stock-2' })
  const stockUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
  const stockMovementCreate = jest.fn().mockResolvedValue({ id: 'movement-1' })
  const stockTransferCreate = jest.fn().mockResolvedValue({ id: 'transfer-1' })
  const auditLogCreate = jest.fn().mockResolvedValue({ id: 'audit-1' })
  const tx = {
    productBranchStock: { upsert: stockUpsert, updateMany: stockUpdateMany },
    stockMovement: { create: stockMovementCreate },
    stockTransfer: { create: stockTransferCreate },
    auditLog: { create: auditLogCreate },
  }

  mockedRequireActiveAuth.mockResolvedValue({
    id: 'user-1',
    organizationId: 'org-1',
    role: 'MANAGER',
    branches: [],
  } as never)
  mockedGetTenantPrisma.mockReturnValue({
    branch: { findMany: branchFindMany },
    product: { findMany: productFindMany },
  } as never)
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, fn) => fn(tx as never))

  const formData = new FormData()
  formData.set('items', JSON.stringify([
    { product_id: 'product-1', qty: '12.5', quantity_unit: 'KG' },
    { product_id: 'product-2', qty: '4', quantity_unit: 'PCS_SETS' },
  ]))
  formData.set('source_branch', 'mombasa')
  formData.set('dest_branch', 'nairobi')
  formData.set('notes', 'Truck 42')

  await dispatchTransfer(formData)

  expect(stockUpsert).toHaveBeenCalledTimes(2)
  expect(stockUpdateMany).toHaveBeenCalledTimes(2)
  expect(stockMovementCreate).toHaveBeenCalledTimes(2)
  expect(stockTransferCreate).toHaveBeenCalledTimes(2)
  expect(auditLogCreate).toHaveBeenCalledTimes(2)
  expect(stockTransferCreate.mock.calls[0][0].data).toEqual(expect.objectContaining({
    productId: 'product-1',
    quantity: 12.5,
    quantityUnit: 'KG',
    notes: 'Truck 42',
  }))
  expect(stockTransferCreate.mock.calls[1][0].data).toEqual(expect.objectContaining({
    productId: 'product-2',
    quantity: 4,
    quantityUnit: 'PCS_SETS',
    notes: 'Truck 42',
  }))
  expect(stockTransferCreate.mock.calls[0][0].data.reference).toMatch(/-01$/)
  expect(stockTransferCreate.mock.calls[1][0].data.reference).toMatch(/-02$/)
  expect(stockTransferCreate.mock.calls[0][0].data.reference.split('-').slice(0, -1).join('-'))
    .toBe(stockTransferCreate.mock.calls[1][0].data.reference.split('-').slice(0, -1).join('-'))
})
