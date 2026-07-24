import { confirmStockTransfer } from './stock'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma, withTenantTransaction } from '@/lib/tenant-prisma'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  requireActiveAuth: jest.fn(),
}))

jest.mock('@/lib/tenant-prisma', () => ({
  getTenantPrisma: jest.fn(),
  withTenantTransaction: jest.fn(),
}))

const mockedRequireActiveAuth = jest.mocked(requireActiveAuth)
const mockedGetTenantPrisma = jest.mocked(getTenantPrisma)
const mockedWithTenantTransaction = jest.mocked(withTenantTransaction)

const pendingTransfer = {
  id: 'transfer-1',
  reference: 'TRANSFER-1',
  productId: 'product-1',
  destinationBranchId: 'branch-destination',
  quantity: 12.5,
  quantityUnit: 'KG',
  notes: null,
  Product: { sku: 'SPRING-1', name: 'Spring 1' },
  SourceBranch: { name: 'Mombasa' },
  DestinationBranch: { name: 'Nairobi' },
}

function setupReceiptMocks() {
  const branchStockUpsert = jest.fn().mockResolvedValue({
    id: 'branch-stock-1',
  })
  const tx = {
    stockTransfer: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productBranchStock: {
      upsert: branchStockUpsert,
    },
    product: {
      update: jest.fn().mockResolvedValue({ id: 'product-1' }),
    },
    stockMovement: {
      create: jest.fn().mockResolvedValue({ id: 'movement-1' }),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  }

  mockedRequireActiveAuth.mockResolvedValue({
    id: 'user-1',
    organizationId: 'org-1',
    role: 'WAREHOUSE',
    branches: [{ id: 'branch-destination', name: 'Nairobi' }],
  } as never)
  mockedGetTenantPrisma.mockReturnValue({
    stockTransfer: {
      findFirst: jest.fn().mockResolvedValue(pendingTransfer),
    },
  } as never)
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, fn) => fn(tx as never))

  return { branchStockUpsert, productUpdate: tx.product.update }
}

beforeEach(() => {
  jest.clearAllMocks()
})

it('increments an existing receiving-branch stock row or creates it when absent', async () => {
  const { branchStockUpsert, productUpdate } = setupReceiptMocks()

  await confirmStockTransfer('transfer-1')

  expect(branchStockUpsert).toHaveBeenCalledWith({
    where: {
      branchId_productId: {
        branchId: 'branch-destination',
        productId: 'product-1',
      },
    },
    update: { availableQty: { increment: 12.5 } },
    create: {
      productId: 'product-1',
      branchId: 'branch-destination',
      availableQty: 12.5,
      availablePiecesSets: 0,
    },
  })
  expect(productUpdate).toHaveBeenCalledWith({
    where: { id: 'product-1' },
    data: { branchId: 'branch-destination' },
  })
})
