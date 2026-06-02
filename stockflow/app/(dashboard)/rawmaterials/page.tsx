import Link from 'next/link'
import { getTenantPrisma } from "@/lib/tenant-prisma"
import { requireActiveAuth } from "@/lib/auth"
import { withRetry } from '@/lib/prisma'
import { RAW_MATERIAL_CATEGORIES } from '@/lib/raw-materials'
import { updateRawMaterialReceipt } from '@/actions/raw-materials'

export const dynamic = 'force-dynamic';

export default async function RawmaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const params = await searchParams
  const query = (params.q || '').trim()
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);
  const materialSearch = query
    ? {
        OR: [
          { sku: { contains: query, mode: 'insensitive' as const } },
          { materialName: { contains: query, mode: 'insensitive' as const } },
          { category: { contains: query, mode: 'insensitive' as const } },
          { diameter: { contains: query, mode: 'insensitive' as const } },
          { length: { contains: query, mode: 'insensitive' as const } },
          { width: { contains: query, mode: 'insensitive' as const } },
          { height: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : undefined
  const receiptSearch = query
    ? {
        OR: [
          { reference: { contains: query, mode: 'insensitive' as const } },
          { loggedBy: { contains: query, mode: 'insensitive' as const } },
          { RawMaterial: materialSearch },
        ],
      }
    : undefined

  const materials = await withRetry(() => db.rawMaterial.findMany({
    where: materialSearch,
    orderBy: [{ category: 'asc' }, { materialName: 'asc' }],
  }), undefined);
  
  const receipts = await withRetry(() => db.materialReceipt.findMany({
    where: receiptSearch,
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
      <form action="/rawmaterials" className="card mb-24" style={{display:'flex',gap:'12px',alignItems:'end'}}>
        <div className="form-group" style={{flex:1,marginBottom:0}}>
          <label className="form-label" htmlFor="raw-material-search">Search raw materials</label>
          <input
            id="raw-material-search"
            name="q"
            type="search"
            className="form-input"
            defaultValue={query}
            placeholder="Search material, category, dimensions, reference, or user"
          />
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
        {query && <Link href="/rawmaterials" className="btn btn-ghost">Clear</Link>}
      </form>
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
                  <div style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>
                    {query ? 'No matching materials in this category.' : 'No materials in this category.'}
                  </div>
                )}
              </div>
            </section>
          )
        })}
        {materials.length === 0 && (
          <div style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>
            {query ? `No raw materials match "${query}".` : 'No raw materials defined.'}
          </div>
        )}
      </div>
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Receipt history</div></div>
        <table>
          <thead><tr><th>Date</th><th>Category</th><th>Material</th><th>Dimensions</th><th>Kg received</th><th>Pieces</th><th>Reference</th><th>Logged by</th><th>Action</th></tr></thead>
          <tbody>
            {receipts.map(r => {
              const formId = `receipt-${r.id}`
              return (
                <tr key={r.id}>
                  <td>{r.createdAt.toLocaleDateString()}</td>
                  <td>{r.RawMaterial.category}</td>
                  <td>{r.RawMaterial.materialName}</td>
                  <td>{r.RawMaterial.length || '—'} L · {r.RawMaterial.width || '—'} W/D · {r.RawMaterial.height || '—'} H</td>
                  <td>
                    <input
                      form={formId}
                      name="kgReceived"
                      type="number"
                      className="form-input"
                      defaultValue={r.kgReceived.toNumber().toFixed(2)}
                      min="0.01"
                      step="0.01"
                      style={{ width: '110px' }}
                    />
                  </td>
                  <td>
                    <input
                      form={formId}
                      name="piecesReceived"
                      type="number"
                      className="form-input"
                      defaultValue={r.piecesReceived}
                      min="1"
                      step="1"
                      style={{ width: '90px' }}
                    />
                  </td>
                  <td>
                    <input
                      form={formId}
                      name="reference"
                      type="text"
                      className="form-input"
                      defaultValue={r.reference || ''}
                      placeholder="Reference"
                      style={{ minWidth: '130px' }}
                    />
                  </td>
                  <td>{r.loggedBy || 'System'}</td>
                  <td>
                    <form id={formId} action={updateRawMaterialReceipt}>
                      <input type="hidden" name="receiptId" value={r.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {receipts.length === 0 && (
              <tr><td colSpan={9} style={{textAlign: 'center', color: 'var(--muted)'}}>
                {query ? `No receipts match "${query}".` : 'No receipts found.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
