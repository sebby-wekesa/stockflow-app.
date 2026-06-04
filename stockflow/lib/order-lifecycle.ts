type TransactionClient = any

type SaleOrderWithItems = {
  id: string
  status: string
  SaleItem: Array<{
    finishedGoodsId: string
    quantity: number
    FinishedGoods?: { sku: string; quantity: number; reservedQuantity: number }
  }>
}

export async function reserveSaleOrder(tx: TransactionClient, order: SaleOrderWithItems) {
  if (order.status !== 'PENDING') {
    throw new Error('Only pending sales orders can be confirmed')
  }

  for (const item of order.SaleItem) {
    const reserved = await tx.finishedGoods.updateMany({
      where: {
        id: item.finishedGoodsId,
        quantity: { gte: item.quantity },
      },
      data: {
        quantity: { decrement: item.quantity },
        reservedQuantity: { increment: item.quantity },
      },
    })

    if (reserved.count === 0) {
      throw new Error(
        `Insufficient available finished goods for ${item.FinishedGoods?.sku ?? 'sale item'}`
      )
    }
  }

  return tx.saleOrder.update({
    where: { id: order.id },
    data: { status: 'CONFIRMED' },
  })
}

export async function releaseSaleOrderReservation(tx: TransactionClient, order: SaleOrderWithItems) {
  if (order.status !== 'CONFIRMED') return

  for (const item of order.SaleItem) {
    const released = await tx.finishedGoods.updateMany({
      where: {
        id: item.finishedGoodsId,
        reservedQuantity: { gte: item.quantity },
      },
      data: {
        quantity: { increment: item.quantity },
        reservedQuantity: { decrement: item.quantity },
      },
    })

    if (released.count === 0) {
      throw new Error(
        `Reserved finished goods are inconsistent for ${item.FinishedGoods?.sku ?? 'sale item'}`
      )
    }
  }
}

export async function consumeSaleOrderReservation(tx: TransactionClient, order: SaleOrderWithItems) {
  if (order.status !== 'CONFIRMED') {
    throw new Error('Only confirmed sales orders can be fulfilled')
  }

  for (const item of order.SaleItem) {
    const consumed = await tx.finishedGoods.updateMany({
      where: {
        id: item.finishedGoodsId,
        reservedQuantity: { gte: item.quantity },
      },
      data: {
        reservedQuantity: { decrement: item.quantity },
      },
    })

    if (consumed.count === 0) {
      throw new Error(
        `Reserved finished goods are inconsistent for ${item.FinishedGoods?.sku ?? 'sale item'}`
      )
    }
  }
}

export async function incrementProductShadowStock(
  tx: TransactionClient,
  sku: string | null,
  quantity: number
) {
  if (!sku) return
  await tx.finishedGoods.updateMany({
    where: { sku },
    data: { quantity: { increment: Math.floor(quantity) } },
  })
}

export async function syncProductShadowStock(
  tx: TransactionClient,
  oldSku: string | null,
  newSku: string | null,
  totalStock: number
) {
  if (!oldSku) return
  const shadow = await tx.finishedGoods.findFirst({ where: { sku: oldSku } })
  if (!shadow) return

  const available = Math.floor(totalStock) - shadow.reservedQuantity
  if (available < 0) {
    throw new Error('Product stock cannot be adjusted below its reserved quantity')
  }

  await tx.finishedGoods.update({
    where: { id: shadow.id },
    data: {
      sku: newSku ?? oldSku,
      quantity: available,
    },
  })
}
