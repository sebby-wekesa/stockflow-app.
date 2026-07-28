import { consumeProductKgForOperation } from './production-stock'

function makeTransaction(existingMovement: unknown = null) {
  return {
    stockMovement: {
      findFirst: jest.fn().mockResolvedValue(existingMovement),
      create: jest.fn().mockResolvedValue({ id: 'movement-1' }),
    },
    product: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  }
}

test('operation processing deducts product kg and records an idempotent movement', async () => {
  const tx = makeTransaction()

  await consumeProductKgForOperation(tx, {
    organizationId: 'org-1',
    productionOrderId: 'po-1',
    productId: 'product-1',
    kgIn: 12.5,
  })

  expect(tx.product.updateMany).toHaveBeenCalledWith({
    where: {
      id: 'product-1',
      organizationId: 'org-1',
      currentStock: { gte: 12.5 },
    },
    data: { currentStock: { decrement: 12.5 } },
  })
  expect(tx.stockMovement.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      organizationId: 'org-1',
      productId: 'product-1',
      movementType: 'operation',
      quantity: -12.5,
      piecesSets: 0,
      reference: 'po-1',
    }),
  })
})

test('a retried operation does not deduct product kg twice', async () => {
  const tx = makeTransaction({ id: 'movement-1' })

  await consumeProductKgForOperation(tx, {
    organizationId: 'org-1',
    productionOrderId: 'po-1',
    productId: 'product-1',
    kgIn: 12.5,
  })

  expect(tx.product.updateMany).not.toHaveBeenCalled()
  expect(tx.stockMovement.create).not.toHaveBeenCalled()
})
