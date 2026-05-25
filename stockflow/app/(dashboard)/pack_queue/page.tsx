import { getTenantPrisma } from "@/lib/tenant-prisma"
import { requireActiveAuth } from "@/lib/auth"

export const dynamic = 'force-dynamic';

export default async function PackQueuePage() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const orders = await db.saleOrder.findMany({
    where: { status: 'PENDING' },
    include: {
      SaleItem: {
        include: {
          FinishedGoods: {
            include: { design: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Packaging queue</div><div className="section-sub">Sale orders awaiting fulfilment</div></div>
      </div>
      {orders.map(o => {
        const productSummary = o.SaleItem.map((i: any) => i.FinishedGoods.design.name).join(", ");
        const totalUnits = o.SaleItem.reduce((acc: number, i: any) => acc + i.quantity, 0);
        const totalKg = o.SaleItem.reduce((acc: number, i: any) => {
          const kgPerUnit = i.FinishedGoods.quantity > 0 ? (i.FinishedGoods.kgProduced.toNumber() / i.FinishedGoods.quantity) : 0;
          return acc + (i.quantity * kgPerUnit);
        }, 0);

        return (
          <div key={o.id} className="pack-card">
            <div className="pack-priority" style={{background:'var(--border2)'}}></div>
            <div className="pack-info">
              <div className="pack-order">Order {o.id.slice(-6).toUpperCase()} · {o.createdAt.toLocaleDateString()}</div>
              <div className="pack-product">{productSummary || 'Empty Order'}</div>
              <div className="pack-detail">{totalUnits} units · {totalKg.toFixed(2)} kg · {o.customerName}</div>
            </div>
            <div className="pack-actions">
              <form action={async () => { 'use server'; console.log("Fulfill action bypassed"); }}>
                <button type="submit" className="btn btn-teal btn-sm">Mark fulfilled</button>
              </form>
            </div>
          </div>
        )
      })}
      {orders.length === 0 && (
        <div style={{ padding: '20px', color: 'var(--muted)' }}>No pending orders in packaging queue.</div>
      )}
    </div>
  );
}