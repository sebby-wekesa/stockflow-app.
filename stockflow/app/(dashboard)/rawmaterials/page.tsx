import Link from 'next/link'
import { getTenantPrisma } from "@/lib/tenant-prisma"
import { requireActiveAuth } from "@/lib/auth"
import { withRetry } from '@/lib/prisma'
import { RAW_MATERIAL_CATEGORIES } from '@/lib/raw-materials'

export const dynamic = 'force-dynamic';

export default async function RawmaterialsPage() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const materials = await withRetry(() => db.rawMaterial.findMany({
    orderBy: [{ category: 'asc' }, { materialName: 'asc' }],
  }), undefined);
  
  const receipts = await withRetry(() => db.materialReceipt.findMany({
    include: { RawMaterial: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  }), undefined).catch(() => []); // Temporary fallback if schema is out of sync

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Raw materials</div>
          <div className="section-sub">Current stock levels in kg and pieces</div>
        </div>
        <Link href="/import" className="btn btn-primary">+ Receive stock</Link>
      </div>
      <div className="mb-24" style={{display:'grid',gap:'24px'}}>
        {RAW_MATERIAL_CATEGORIES.map((category) => {
          const categoryMaterials = materials.filter((m) => m.category === category)
          return (
            <section key={category}>
              <div className="section-header mb-16">
                <div className="section-title">{category}</div>
                <span className="badge badge-muted">{categoryMaterials.length} materials</span>
              </div>
              <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
                {categoryMaterials.map(m => {
                  const availableNum = m.availableKg.toNumber();
                  const reservedNum = m.reservedKg.toNumber();
                  const free = availableNum - reservedNum;
                  const trend = free > 500 ? 'teal' : free > 0 ? 'amber' : 'red';
                  return (
                    <div key={m.id} className={`stat-card ${trend}`}>
                      <div className="stat-label">{m.materialName}</div>
                      <div className="stat-sub">{m.length || '—'} L · {m.width || '—'} W/D · {m.height || '—'} H · {m.diameter}</div>
                      <div className="stat-value">{availableNum.toLocaleString()}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
                      <div className="stat-sub"><span>{m.availablePieces.toLocaleString()} pieces</span> · {Math.max(0, free).toLocaleString()} kg free · {reservedNum.toLocaleString()} kg reserved</div>
                    </div>
                  )
                })}
                {categoryMaterials.length === 0 && (
                  <div style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>No materials in this category.</div>
                )}
              </div>
            </section>
          )
        })}
        {materials.length === 0 && (
          <div style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>No raw materials defined.</div>
        )}
      </div>
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Receipt history</div></div>
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Material</th><th>Dimensions</th><th>Kg received</th><th>Pieces</th><th>Reference</th><th>Logged by</th></tr></thead>
          <tbody>
            {receipts.map(r => (
              <tr key={r.id}>
                <td>{r.createdAt.toLocaleDateString()}</td>
                <td>{r.RawMaterial.category}</td>
                <td>{r.RawMaterial.materialName}</td>
                <td>{r.RawMaterial.length || '—'} L · {r.RawMaterial.width || '—'} W/D · {r.RawMaterial.height || '—'} H</td>
                <td><span className="job-kg">{r.kgReceived.toNumber().toFixed(2)} kg</span></td>
                <td>{r.piecesReceived.toLocaleString()}</td>
                <td>{r.reference || '—'}</td>
                <td>{r.loggedBy || 'System'}</td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr><td colSpan={8} style={{textAlign: 'center', color: 'var(--muted)'}}>No receipts found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
