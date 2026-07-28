type TransactionClient = any

/**
 * Consume catalogue-product kg when a production order actually enters its
 * operation/output step. The movement reference makes retries safe.
 */
export async function consumeProductKgForOperation(
  tx: TransactionClient,
  input: {
    organizationId: string
    productionOrderId: string
    productId?: string | null
    kgIn: number
  },
) {
  const kgIn = Number(input.kgIn)
  if (!input.productId || !Number.isFinite(kgIn) || kgIn <= 0) return false

  const existingMovement = await tx.stockMovement.findFirst({
    where: {
      organizationId: input.organizationId,
      productId: input.productId,
      movementType: 'operation',
      reference: input.productionOrderId,
    },
    select: { id: true },
  })
  if (existingMovement) return false

  const consumed = await tx.product.updateMany({
    where: {
      id: input.productId,
      organizationId: input.organizationId,
      currentStock: { gte: kgIn },
    },
    data: {
      currentStock: { decrement: kgIn },
    },
  })

  if (consumed.count === 0) {
    throw new Error(`Insufficient product kg stock for production order ${input.productionOrderId}`)
  }

  await tx.stockMovement.create({
    data: {
      organizationId: input.organizationId,
      productId: input.productId,
      movementType: 'operation',
      quantity: -kgIn,
      piecesSets: 0,
      reference: input.productionOrderId,
      notes: `Kg consumed when production operation started (${kgIn} kg)`,
    },
  })

  return true
}
