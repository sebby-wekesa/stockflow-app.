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
  searchParams: Promise<{ q?: string; category?: string }>
}) {
  const params = await searchParams
  const query = (params.q || '').trim()
  const category = RAW_MATERIAL_CATEGORIES.includes(params.category as (typeof RAW_MATERIAL_CATEGORIES)[number])
    ? params.category as (typeof RAW_MATERIAL_CATEGORIES)[number]
    : ''
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);
  const materialSearch = query
    ? {
        OR: [
          { sku: { contains: query, mode: 'insensitive' as const } },
          { materialName: { contains: query, mode: 'insensitive' as const } },
          { diameter: { contains: query, mode: 'insensitive' as const } },
          { length: { contains: query, mode: 'insensitive' as const } },
          { width: { contains: query, mode: 'insensitive' as const } },
          { height: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : undefined
  const materials = await withRetry(() => db.rawMaterial.findMany({
    where: { category: { in: [...RAW_MATERIAL_CATEGORIES] } },
    orderBy: [{ category: 'asc' }, { materialName: 'asc' }],
  }), undefined);

  const matchingMaterials = (query || category)
    ? await withRetry(() => db.rawMaterial.findMany({
        where: {
          ...(category ? { category } : { category: { in: [...RAW_MATERIAL_CATEGORIES] } }),
          ...(materialSearch ?? {}),
        },
        orderBy: [{ category: 'asc' }, { materialName: 'asc' }],
      }), undefined)
    : []
  
  const receipts = await withRetry(() => db.materialReceipt.findMany({
    include: { RawMaterial: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  }), undefined).catch(() => []); // Temporary fallback if schema is out of sync

  const totalKg = materials.reduce((sum, material) => sum + material.availableKg.toNumber(), 0)
  const totalReservedKg = materials.reduce((sum, material) => sum + material.reservedKg.toNumber(), 0)
  const categoryLabels: Record<(typeof RAW_MATERIAL_CATEGORIES)[number], string> = {
    'Flat Bars': 'Flat Bars',
    'Round Bars': 'Round Bar',
    'Spring Bushes': 'Spring Bushes',
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Raw materials</div>
          <div className="section-sub">Current stock totals by raw material category</div>
        </div>
        <Link href="/import" className="btn btn-primary">+ Receive stock</Link>
      </div>

      <div className="stats-grid mb-24">
        <div className="stat-card amber">
          <div className="stat-label">Total raw materials</div>
          <div className="stat-value">{materials.length.toLocaleString()}</div>
          <div className="stat-sub">Across 3 categories</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Total available kg</div>
          <div className="stat-value">{totalKg.toLocaleString()}<span className="stat-suffix">kg</span></div>
          <div className="stat-sub">{Math.max(0, totalKg - totalReservedKg).toLocaleString()} kg free</div>
        </div>
        {RAW_MATERIAL_CATEGORIES.map((category) => {
          const categoryMaterials = materials.filter((m) => m.category === category)
          const categoryKg = categoryMaterials.reduce((sum, material) => sum + material.availableKg.toNumber(), 0)
          const categoryPieces = categoryMaterials.reduce((sum, material) => sum + material.availablePieces, 0)
          return (
            <div key={category} className="stat-card purple">
              <div className="stat-label">{categoryLabels[category]}</div>
              <div className="stat-value">{categoryKg.toLocaleString()}<span className="stat-suffix">kg</span></div>
              <div className="stat-sub">
                {categoryMaterials.length} materials · {categoryPieces.toLocaleString()} pieces
              </div>
            </div>
          )
        })}
      </div>

      <div className="card mb-24">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Find Raw Materials</div>
            <div className="section-sub">Search the complete raw material database</div>
          </div>
        </div>
        <form action="/rawmaterials" className="mb-16" style={{display:'flex',gap:'12px',alignItems:'end',flexWrap:'wrap'}}>
          <div className="form-group" style={{flex:1,marginBottom:0}}>
            <label className="form-label" htmlFor="raw-material-search">Search raw materials</label>
            <input
              id="raw-material-search"
              name="q"
              type="search"
              className="form-input"
              defaultValue={query}
              placeholder="Search by SKU, material name, or dimensions"
            />
          </div>
          <div className="form-group" style={{minWidth:'190px',marginBottom:0}}>
            <label className="form-label" htmlFor="raw-material-category">Category</label>
            <select
              id="raw-material-category"
              name="category"
              className="form-input"
              defaultValue={category}
            >
              <option value="">All categories</option>
              {RAW_MATERIAL_CATEGORIES.map((item) => (
                <option key={item} value={item}>{categoryLabels[item]}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Filter</button>
          {(query || category) && <Link href="/rawmaterials" className="btn btn-ghost">Clear</Link>}
        </form>

        {(query || category) && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>SKU</th><th>Category</th><th>Material</th><th>Dimensions</th><th>Available kg</th><th>Reserved kg</th><th>Pieces</th></tr>
              </thead>
              <tbody>
                {matchingMaterials.map((material) => (
                  <tr key={material.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{material.sku}</td>
                    <td>{categoryLabels[material.category as keyof typeof categoryLabels] || material.category}</td>
                    <td>{material.materialName}</td>
                    <td>{material.length || '—'} L · {material.width || '—'} W/D · {material.height || '—'} H · {material.diameter}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{material.availableKg.toNumber().toLocaleString()} kg</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{material.reservedKg.toNumber().toLocaleString()} kg</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{material.availablePieces.toLocaleString()}</td>
                  </tr>
                ))}
                {matchingMaterials.length === 0 && (
                  <tr><td colSpan={7} style={{textAlign: 'center', color: 'var(--muted)'}}>No raw materials match the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Receipt history</div>
            <div className="section-sub">Most recent raw material receipts</div>
          </div>
        </div>
        <div className="table-wrap">
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
                No receipts found.
              </td></tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
