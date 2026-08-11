import { recordFinishedGoodsProduction } from './finished-goods'
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

beforeEach(() => {
  jest.clearAllMocks()
})

it('increments the selected spring product and its Mombasa stock in the same production transaction', async () => {
  const branchFindFirst = jest.fn().mockResolvedValue({
    id: 'branch-mombasa',
    code: 'MSA',
    name: 'Mombasa',
  })
  const productFindFirst = jest.fn().mockResolvedValue({
    id: 'spring-product-1',
    name: 'Spring 100 x 200',
  })
  const productUpdate = jest.fn().mockResolvedValue({ id: 'spring-product-1' })
  const productBranchStockUpsert = jest.fn().mockResolvedValue({ id: 'branch-stock-1' })
  const stockMovementCreate = jest.fn().mockResolvedValue({ id: 'movement-1' })
  const tx = {
    finishedGoodsProductionLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'production-log-1' }),
    },
    product: { update: productUpdate },
    productBranchStock: { upsert: productBranchStockUpsert },
    stockMovement: { create: stockMovementCreate },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  }

  mockedRequireActiveAuth.mockResolvedValue({
    id: 'user-1',
    organizationId: 'org-1',
    role: 'MANAGER',
  } as never)
  mockedGetTenantPrisma.mockReturnValue({
    branch: { findFirst: branchFindFirst },
    product: { findFirst: productFindFirst },
  } as never)
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, callback) => callback(tx as never))

  const formData = new FormData()
  formData.set('jobCardNo', 'JC-1001')
  formData.set('productionDate', '2026-08-11')
  formData.set('springProductId', 'spring-product-1')
  formData.set('pcsProduced', '10')
  formData.set('weightPerPiece', '2.45')
  formData.set('totalWeight', '24.5')

  await recordFinishedGoodsProduction(formData)

  expect(productUpdate).toHaveBeenCalledWith({
    where: { id: 'spring-product-1' },
    data: {
      currentStock: { increment: 24.5 },
      piecesSets: { increment: 10 },
    },
  })
  expect(productBranchStockUpsert).toHaveBeenCalledWith({
    where: {
      branchId_productId: {
        branchId: 'branch-mombasa',
        productId: 'spring-product-1',
      },
    },
    update: {
      availableQty: { increment: 24.5 },
      availablePiecesSets: { increment: 10 },
    },
    create: {
      productId: 'spring-product-1',
      branchId: 'branch-mombasa',
      availableQty: 24.5,
      availablePiecesSets: 10,
    },
  })
  expect(stockMovementCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      productId: 'spring-product-1',
      branchId: 'branch-mombasa',
      movementType: 'production',
      quantity: 24.5,
      piecesSets: 10,
      reference: 'JC-1001',
    }),
  })
})

it('ignores a repeated submission for an existing job card', async () => {
  const branchFindFirst = jest.fn().mockResolvedValue({
    id: 'branch-mombasa',
    code: 'MSA',
    name: 'Mombasa',
  })
  const productFindFirst = jest.fn().mockResolvedValue({
    id: 'spring-product-1',
    name: 'Spring 100 x 200',
  })
  const productionLogFindFirst = jest.fn().mockResolvedValue({ id: 'production-log-1' })
  const productionLogCreate = jest.fn()
  const tx = {
    finishedGoodsProductionLog: {
      findFirst: productionLogFindFirst,
      create: productionLogCreate,
    },
  }

  mockedRequireActiveAuth.mockResolvedValue({
    id: 'user-1',
    organizationId: 'org-1',
    role: 'MANAGER',
  } as never)
  mockedGetTenantPrisma.mockReturnValue({
    branch: { findFirst: branchFindFirst },
    product: { findFirst: productFindFirst },
  } as never)
  mockedWithTenantTransaction.mockImplementation(async (_organizationId, callback) => callback(tx as never))

  const formData = new FormData()
  formData.set('jobCardNo', 'JC-1001')
  formData.set('productionDate', '2026-08-11')
  formData.set('springProductId', 'spring-product-1')
  formData.set('pcsProduced', '10')
  formData.set('weightPerPiece', '2.45')
  formData.set('totalWeight', '24.5')

  await recordFinishedGoodsProduction(formData)

  expect(productionLogCreate).not.toHaveBeenCalled()
})
