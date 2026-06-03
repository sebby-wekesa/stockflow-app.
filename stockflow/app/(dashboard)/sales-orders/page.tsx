import { SalesOrderForm } from "@/components/SalesOrderForm";
import { SalesOrderList } from "@/components/SalesOrderList";
import { getTenantPrisma } from "@/lib/tenant-prisma";
import { requireActiveAuth } from "@/lib/auth";

export default async function SalesOrdersPage() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const [rawSaleOrders, stock, products, designs] = await Promise.all([
    db.saleOrder.findMany({
      include: {
        SaleItem: {
          include: {
            FinishedGoods: {
              include: {
                design: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    db.finishedGoods.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        design: {
          select: {
            name: true,
            code: true,
            targetWeight: true
          }
        }
      }
    }),
    db.product.findMany({
      where: { currentStock: { gt: 0 } },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        uom: true,
        origin: true,
        unitCost: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
    db.design.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        targetWeight: true,
        createdAt: true,
        billOfMaterials: { select: { id: true }, take: 1 },
        stages: { select: { id: true }, take: 1 },
      },
      orderBy: { name: 'asc' },
    })
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

  // Manufactured / Design items (current FinishedGoods with design info)
  const manufactured = stock.map(item => ({
    id: item.id,
    name: item.design.name,
    code: item.design.code,
    availableQty: item.quantity,
    kgProduced: Number(item.kgProduced),
    price: item.unitCost ? Number(item.unitCost) : undefined,
    createdAt: item.createdAt,
    source: 'manufactured' as const,
  }));

  // General catalog products (can be services, imported, local purchase, etc.)
  const otherProducts = products.map(p => ({
    id: p.id,                    // Note: for these we will create a shadow FinishedGoods on submit
    name: p.name,
    code: p.sku || p.id.slice(0, 8),
    availableQty: Math.floor(p.currentStock),
    kgProduced: 0,
    price: p.unitCost ? Number(p.unitCost) : undefined,
    createdAt: p.createdAt,
    source: 'product' as const,
    origin: p.origin,
    uom: p.uom,
  }));

  const madeToOrder = designs.map(d => ({
    id: d.id,
    designId: d.id,
    name: d.name,
    code: d.code,
    availableQty: 999999,
    kgProduced: d.targetWeight ? Number(d.targetWeight) : 0,
    price: undefined,
    createdAt: d.createdAt,
    source: 'design' as const,
    origin: d.billOfMaterials.length > 0 && d.stages.length > 0 ? 'Made to order' : 'Setup incomplete',
    uom: 'KG',
  }));

  const formattedProducts = [...manufactured, ...madeToOrder, ...otherProducts];

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
