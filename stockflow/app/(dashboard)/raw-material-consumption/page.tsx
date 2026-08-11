import Link from 'next/link'
import { recordManualMaterialConsumption } from '@/app/actions/material-consumption'
import { getTenantPrisma } from '@/lib/tenant-prisma'
import { requireRole } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function parseDateInput(value: string | undefined) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date
}

export default async function RawMaterialConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const user = await requireRole('ADMIN', 'MANAGER')
  const db = getTenantPrisma(user.organizationId)
  const params = await searchParams
  const fromValue = params.from ?? ''
  const toValue = params.to ?? ''
  const fromDate = parseDateInput(params.from)
  const toDate = parseDateInput(params.to)
  const filterError = (params.from && !fromDate)
    ? 'Enter a valid From date.'
    : (params.to && !toDate)
      ? 'Enter a valid To date.'
      : (fromDate && toDate && fromDate > toDate)
        ? 'From date cannot be after To date.'
        : null
  const endDate = toDate ? new Date(toDate) : null
  if (endDate) endDate.setUTCDate(endDate.getUTCDate() + 1)
  const consumedAtFilter = !filterError && (fromDate || endDate)
    ? {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(endDate ? { lt: endDate } : {}),
      }
    : undefined

  const [logs, orders, rawMaterials] = await Promise.all([
    db.materialConsumptionLog.findMany({
      where: consumedAtFilter ? { consumedAt: consumedAtFilter } : undefined,
      include: {
        RawMaterial: { select: { materialName: true, sku: true } },
        ProductionOrder: {
          select: {
            id: true,
            orderNumber: true,
            materials: {
              select: {
                rawMaterialId: true,
                pieces: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
      orderBy: { consumedAt: 'desc' },
    }),
    db.productionOrder.findMany({
      where: { status: { in: ['APPROVED', 'IN_PRODUCTION', 'COMPLETED'] } },
      select: { id: true, orderNumber: true, productName: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.rawMaterial.findMany({
      select: { id: true, sku: true, materialName: true, availableKg: true, availablePieces: true },
      orderBy: { materialName: 'asc' },
    }),
  ])

  const totalConsumedKg = logs.reduce((sum, log) => sum + Number(log.quantityConsumed), 0)
  const distinctOrders = new Set(logs.map((log) => log.productionOrderId)).size

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Raw Material Consumption</div>
          <div className="section-sub">Track raw material issued to production orders</div>
        </div>
        <Link href="/jobs" className="btn btn-ghost">View production orders</Link>
      </div>

      <div className="stats-grid mb-24">
        <div className="stat-card amber">
          <div className="stat-label">Total consumed</div>
          <div className="stat-value">{totalConsumedKg.toLocaleString()}<span className="stat-suffix">kg</span></div>
          <div className="stat-sub">Across all consumption records</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Production orders</div>
          <div className="stat-value">{distinctOrders.toLocaleString()}</div>
          <div className="stat-sub">Orders with material consumption</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Consumption records</div>
          <div className="stat-value">{logs.length.toLocaleString()}</div>
          <div className="stat-sub">Auditable material issues</div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">View consumption</div>
            <div className="section-sub">Choose a date range to view every consumption recorded during that period</div>
          </div>
        </div>
        <form method="get" action="/raw-material-consumption" style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="consumption-from">From date</label>
            <input
              id="consumption-from"
              name="from"
              type="date"
              className="form-input"
              defaultValue={fromValue}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="consumption-to">To date</label>
            <input
              id="consumption-to"
              name="to"
              type="date"
              className="form-input"
              defaultValue={toValue}
            />
          </div>
          <button type="submit" className="btn btn-primary">View consumption</button>
          {(fromValue || toValue) && <Link href="/raw-material-consumption" className="btn btn-ghost">Clear</Link>}
        </form>
        {filterError && <div className="section-sub" role="alert" style={{ color: 'var(--red)', marginTop: '10px' }}>{filterError}</div>}
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Record consumption</div>
            <div className="section-sub">Fill in the consumption details and save the stock issue</div>
          </div>
        </div>

        <div className="table-wrap mb-24">
          <form action={recordManualMaterialConsumption}>
            <table>
              <thead>
                <tr>
                  <th>Job Card No</th>
                  <th>Date</th>
                  <th>Raw Material Description</th>
                  <th>Pcs Cut</th>
                  <th>Weight per Pcs</th>
                  <th>Total Weight Cut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <input
                      name="jobCardNo"
                      type="text"
                      className="form-input"
                      list="job-card-options"
                      required
                      placeholder="Enter job card no."
                    />
                    <datalist id="job-card-options">
                      {orders.map((order) => (
                        <option key={order.id} value={order.orderNumber}>
                          {order.productName || 'Production order'}
                        </option>
                      ))}
                    </datalist>
                  </td>
                  <td>
                    <input
                      name="consumedAt"
                      type="date"
                      className="form-input"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </td>
                  <td>
                    <select name="rawMaterialId" className="form-input" required defaultValue="">
                      <option value="" disabled>Select raw material</option>
                      {rawMaterials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.materialName} · {material.sku} ({Number(material.availableKg).toFixed(2)} kg, {material.availablePieces} pcs)
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input name="piecesCut" type="number" min="1" step="1" className="form-input" required placeholder="0" />
                  </td>
                  <td>
                    <input name="weightPerPiece" type="number" min="0.0001" step="0.0001" className="form-input" required placeholder="0.0000" />
                  </td>
                  <td>
                    <input name="totalWeightCut" type="number" min="0.0001" step="0.0001" className="form-input" required placeholder="0.0000" />
                  </td>
                  <td>
                    <button type="submit" className="btn btn-primary btn-sm">Save</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </form>
        </div>

        <div className="section-header mb-16">
          <div>
            <div className="section-title">Consumption history</div>
            <div className="section-sub">Material quantities recorded against production</div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job Card No</th>
                <th>Date</th>
                <th>Raw Material Description</th>
                <th>Pcs Cut</th>
                <th>Weight per Pcs</th>
                <th>Total Weight Cut</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const materialLine = log.ProductionOrder.materials.find(
                  (line) => line.rawMaterialId === log.rawMaterialId,
                )
                const totalWeightCut = Number(log.quantityConsumed)
                const pcsCut = log.piecesCut ?? materialLine?.pieces ?? null
                const weightPerPiece = log.weightPerPiece
                  ? Number(log.weightPerPiece)
                  : pcsCut
                    ? totalWeightCut / pcsCut
                    : null

                return (
                  <tr key={log.id}>
                    <td>
                      <Link href={`/jobs/${log.ProductionOrder.id}`} className="font-mono">
                        {log.ProductionOrder.orderNumber}
                      </Link>
                    </td>
                    <td>{log.consumedAt.toLocaleDateString()}</td>
                    <td>
                      <div>{log.RawMaterial.materialName}</div>
                      <div className="section-sub">{log.RawMaterial.sku}</div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {pcsCut?.toLocaleString() ?? '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {weightPerPiece != null ? `${weightPerPiece.toLocaleString()} kg` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {totalWeightCut.toLocaleString()} kg
                    </td>
                  </tr>
                )
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No raw material consumption has been recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
