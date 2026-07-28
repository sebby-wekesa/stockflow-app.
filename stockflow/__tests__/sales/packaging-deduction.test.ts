import { fulfillOrder } from '@/app/actions/packaging'
import { requireActiveAuth } from '@/lib/auth'
import { getTenantPrisma } from '@/lib/tenant-prisma'

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  requireActiveAuth: jest.fn(),
}))

jest.mock('@/lib/tenant-prisma', () => ({
  getTenantPrisma: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  withRetry: jest.fn((operation: () => unknown) => operation()),
}))

const mockedRequireActiveAuth = jest.mocked(requireActiveAuth)
const mockedGetTenantPrisma = jest.mocked(getTenantPrisma)

beforeEach(() => {
  jest.clearAllMocks()
})

it('consumes the finished-goods reservation without changing product kg or pcs/sets', async () => {
  const finishedGoodsUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
  const saleOrderUpdate = jest.fn().mockResolvedValue({})
  const transaction = {
    saleOrder: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'order-1',
        status: 'CONFIRMED',
        customerName: 'Test customer',
        SaleItem: [{
          quantity: 12,
          piecesSets: 7.5,
          unitPrice: 100,
          totalPrice: 750,
          FinishedGoods: {
            sku: 'SPRING-1',
            reservedQuantity: 12,
            design: { name: 'Spring 1' },
          },
        }],
      }),
      update: saleOrderUpdate,
    },
    finishedGoods: { updateMany: finishedGoodsUpdateMany },
  }

  mockedRequireActiveAuth.mockResolvedValue({
    id: 'user-1',
    organizationId: 'org-1',
    role: 'PACKAGING',
  } as never)
  mockedGetTenantPrisma.mockReturnValue({
    $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
  } as never)

  await fulfillOrder('order-1')

  expect(saleOrderUpdate).toHaveBeenCalledWith({
    where: { id: 'order-1' },
    data: { status: 'READY_FOR_DISPATCH' },
  })
})
