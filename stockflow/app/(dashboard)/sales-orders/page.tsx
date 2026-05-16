import { prisma } from "@/lib/prisma";
import { SalesOrderForm } from "@/components/SalesOrderForm";
import { SalesOrderList } from "@/components/SalesOrderList";

async function getSaleOrders() {
  return await prisma.saleOrder.findMany({
    include: {
      SaleItem: {
        include: {
          FinishedGoods: {
            include: {
              Design: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function getAvailableStock() {
  return await prisma.finishedGoods.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      Design: {
        select: {
          name: true,
          code: true,
          targetWeight: true
        }
      }
    }
  });
}

export default async function SalesOrdersPage() {
  const [rawSaleOrders, stock] = await Promise.all([
    getSaleOrders(),
    getAvailableStock()
  ]);

  // Transform saleOrders to match component expectations
  const saleOrders = rawSaleOrders.map(order => ({
    ...order,
    items: order.SaleItem.map(item => ({
      ...item,
      finishedGoods: item.FinishedGoods
    })),
    amount: Number(order.totalAmount)
  }));

  // Transform the data to satisfy the 'CatalogueItem' type for SalesOrderForm
  const formattedProducts = stock.map(item => ({
    id: item.id,
    name: item.Design.name,
    code: item.Design.code,
    availableQty: item.quantity,
    kgProduced: Number(item.kgProduced),
    createdAt: item.createdAt
  }));

  return (
    <div className="p-8 bg-[#0f1113] min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Sales Orders</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Create New Order</h2>
          <SalesOrderForm products={formattedProducts} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Recent Orders</h2>
          <SalesOrderList orders={saleOrders} />
        </div>
      </div>
    </div>
  );
}