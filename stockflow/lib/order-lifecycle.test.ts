import {
  consumeSaleOrderReservation,
  releaseSaleOrderReservation,
  reserveSaleOrder,
} from './order-lifecycle'

const order = {
  id: 'SO-1',
  status: 'PENDING',
  SaleItem: [{
    finishedGoodsId: 'fg-1',
    quantity: 5,
    FinishedGoods: { sku: 'SKU-1', quantity: 10, reservedQuantity: 0 },
  }],
}

function transaction(updateCount = 1) {
  return {
    finishedGoods: {
      updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
    },
    saleOrder: {
      update: jest.fn().mockResolvedValue({ id: order.id, status: 'CONFIRMED' }),
    },
  }
}

test('confirmation moves available finished goods into reserved stock', async () => {
  const tx = transaction()
  await reserveSaleOrder(tx, order)

  expect(tx.finishedGoods.updateMany).toHaveBeenCalledWith({
    where: { id: 'fg-1', quantity: { gte: 5 } },
    data: {
      quantity: { decrement: 5 },
      reservedQuantity: { increment: 5 },
    },
  })
  expect(tx.saleOrder.update).toHaveBeenCalledWith({
    where: { id: 'SO-1' },
    data: { status: 'CONFIRMED' },
  })
})

test('confirmation fails atomically when available stock cannot be reserved', async () => {
  await expect(reserveSaleOrder(transaction(0), order)).rejects.toThrow(
    'Insufficient available finished goods for SKU-1'
  )
})

test('cancellation releases confirmed reservations', async () => {
  const tx = transaction()
  await releaseSaleOrderReservation(tx, { ...order, status: 'CONFIRMED' })

  expect(tx.finishedGoods.updateMany).toHaveBeenCalledWith({
    where: { id: 'fg-1', reservedQuantity: { gte: 5 } },
    data: {
      quantity: { increment: 5 },
      reservedQuantity: { decrement: 5 },
    },
  })
})

test('packaging consumes reserved stock without decrementing available stock again', async () => {
  const tx = transaction()
  await consumeSaleOrderReservation(tx, { ...order, status: 'CONFIRMED' })

  expect(tx.finishedGoods.updateMany).toHaveBeenCalledWith({
    where: { id: 'fg-1', reservedQuantity: { gte: 5 } },
    data: { reservedQuantity: { decrement: 5 } },
  })
})
