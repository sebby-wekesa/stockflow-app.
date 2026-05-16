import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic';

export default async function PackQueuePage() {
  const orders = await prisma.saleOrder.findMany({
    where: { status: 'PENDING' },
    include: {
      items: {
        include: {
          finishedGoods: {
            include: { Design: true }
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
        const productSummary = o.items.map(i => i.finishedGoods.Design.name).join(", ");
        const totalUnits = o.items.reduce((acc, i) => acc + i.quantity, 0);
        const totalKg = o.items.reduce((acc, i) => {
          const kgPerUnit = i.finishedGoods.quantity > 0 ? (i.finishedGoods.kgProduced.toNumber() / i.finishedGoods.quantity) : 0;
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