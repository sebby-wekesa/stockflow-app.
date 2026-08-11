import Link from "next/link"
import { getTenantPrisma } from "@/lib/tenant-prisma"
import { requireActiveAuth } from "@/lib/auth"
import { recordFinishedGoodsProduction } from "@/app/actions/finished-goods"
import SpringTypePicker from "@/components/finished-goods/SpringTypePicker"

export const dynamic = 'force-dynamic';

function parseDateInput(value: string | undefined) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

export default async function FinishedgoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);
  const params = await searchParams;
  const fromValue = params.from ?? '';
  const toValue = params.to ?? '';
  const fromDate = parseDateInput(params.from);
  const toDate = parseDateInput(params.to);
  const filterError = (params.from && !fromDate)
    ? 'Enter a valid From date.'
    : (params.to && !toDate)
      ? 'Enter a valid To date.'
      : (fromDate && toDate && fromDate > toDate)
        ? 'From date cannot be after To date.'
        : null;
  const endDate = toDate ? new Date(toDate) : null;
  if (endDate) endDate.setUTCDate(endDate.getUTCDate() + 1);
  const productionDateFilter = !filterError && (fromDate || endDate)
    ? {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(endDate ? { lt: endDate } : {}),
      }
    : undefined;

  const mombasaBranch = await db.branch.findFirst({
    where: {
      OR: [
        { code: 'MSA' },
        { name: { contains: 'Mombasa', mode: 'insensitive' } },
        { location: { contains: 'Mombasa', mode: 'insensitive' } },
      ],
    },
    select: { id: true, code: true },
  });

  const mombasaSpringWhere = mombasaBranch
    ? {
        category: 'springs' as const,
        OR: [
          { branchId: { in: [mombasaBranch.id, mombasaBranch.code, 'mombasa'] } },
          { branchStocks: { some: { branchId: mombasaBranch.id } } },
        ],
      }
    : { category: 'springs' as const, id: '__no_mombasa_branch__' };

  const springTypes = await db.product.findMany({
    where: mombasaSpringWhere,
    select: { id: true, name: true, sku: true },
    orderBy: { name: 'asc' },
  });
  const manualLogs = mombasaBranch
    ? await db.finishedGoodsProductionLog.findMany({
        where: {
          branchId: mombasaBranch.id,
          ...(productionDateFilter ? { productionDate: productionDateFilter } : {}),
        },
        include: { Product: { select: { name: true } } },
        orderBy: [{ productionDate: 'desc' }, { createdAt: 'desc' }],
      })
    : [];

  const orders = await db.productionOrder.findMany({
    where: {
      status: 'COMPLETED',
    },
    select: {
      id: true,
      orderNumber: true,
      productName: true,
      routeType: true,
      quantity: true,
      expectedPieces: true,
      actualPieces: true,
      actualWeightOut: true,
      targetKg: true,
      completedAt: true,
      productionFinishedAt: true,
      outputRecordedAt: true,
      updatedAt: true,
      product: { select: { name: true } },
      design: { select: { name: true } },
      StageLog: {
        orderBy: { sequence: 'desc' },
        take: 1,
        select: { piecesOut: true, kgOut: true, completedAt: true },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  const completedRows = orders.map((order) => {
    const lastStage = order.StageLog[0];
    const pcsProduced = lastStage?.piecesOut ?? order.actualPieces ?? order.expectedPieces ?? order.quantity;
    const totalWeight = order.actualWeightOut != null
      ? Number(order.actualWeightOut)
      : lastStage?.kgOut != null
        ? Number(lastStage.kgOut)
        : Number(order.targetKg);
    const date = order.completedAt ?? order.productionFinishedAt ?? order.outputRecordedAt ?? lastStage?.completedAt ?? order.updatedAt;

    return {
      id: order.id,
      source: 'Completed job' as const,
      href: `/jobs/${order.id}`,
      jobCard: order.orderNumber,
      date,
      springType: order.product?.name ?? order.design?.name ?? order.productName ?? order.routeType ?? '—',
      pcsProduced,
      totalWeight,
      weightPerPiece: pcsProduced > 0 ? totalWeight / pcsProduced : null,
    };
  }).filter((row) => {
    if (filterError || (!fromDate && !endDate)) return true;
    return (!fromDate || row.date >= fromDate) && (!endDate || row.date < endDate);
  });

  const manualRows = manualLogs.map((log) => ({
    id: log.id,
    source: 'Manual entry' as const,
    href: null,
    jobCard: log.jobCardNo,
    date: log.productionDate,
    springType: log.Product.name,
    pcsProduced: log.pcsProduced,
    totalWeight: Number(log.totalWeight),
    weightPerPiece: Number(log.weightPerPiece),
  }));
  const productionRows = [...manualRows, ...completedRows].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
  const totalPieces = productionRows.reduce((sum, row) => sum + row.pcsProduced, 0);
  const totalWeight = productionRows.reduce((sum, row) => sum + row.totalWeight, 0);

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Finished goods production</div>
          <div className="section-sub">Record output and monitor Mombasa finished-goods stock</div>
        </div>
        <Link href="/jobs" className="btn btn-ghost">View production orders</Link>
      </div>

      <div className="stats-grid mb-24">
        <div className="stat-card amber">
          <div className="stat-label">Production records</div>
          <div className="stat-value">{productionRows.length.toLocaleString()}</div>
          <div className="stat-sub">Manual entries and completed jobs</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Pcs produced</div>
          <div className="stat-value">{totalPieces.toLocaleString()}</div>
          <div className="stat-sub">Across production records</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Total weight</div>
          <div className="stat-value">{totalWeight.toLocaleString()}<span className="stat-suffix">kg</span></div>
          <div className="stat-sub">Added to finished-goods stock</div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">View production</div>
            <div className="section-sub">Choose a date range to view every production recorded during that period</div>
          </div>
        </div>
        <form method="get" action="/finishedgoods" style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="finished-goods-from">From date</label>
            <input
              id="finished-goods-from"
              name="from"
              type="date"
              className="form-input"
              defaultValue={fromValue}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="finished-goods-to">To date</label>
            <input
              id="finished-goods-to"
              name="to"
              type="date"
              className="form-input"
              defaultValue={toValue}
            />
          </div>
          <button type="submit" className="btn btn-primary">View production</button>
          {(fromValue || toValue) && <Link href="/finishedgoods" className="btn btn-ghost">Clear</Link>}
        </form>
        {filterError && <div className="section-sub" role="alert" style={{ color: 'var(--red)', marginTop: '10px' }}>{filterError}</div>}
      </div>

      <div className="card">
        <div className="section-header mb-16">
          <div>
            <div className="section-title">Record production</div>
            <div className="section-sub">Fill in the production details and add finished goods to Mombasa stock</div>
          </div>
        </div>

        <div className="table-wrap mb-24">
          <form action={recordFinishedGoodsProduction}>
            <table>
              <thead>
                <tr>
                  <th>Job Card No</th>
                  <th>Date</th>
                  <th>Spring Type</th>
                  <th>Pcs Produced</th>
                  <th>Weight per Pcs</th>
                  <th>Total Weight</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><input className="form-input" name="jobCardNo" placeholder="Job card No" required /></td>
                  <td><input className="form-input" name="productionDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></td>
                  <td style={{ minWidth: '240px' }}>
                    <SpringTypePicker options={springTypes} name="springProductId" id="finished-goods-spring-picker" />
                    <input className="form-input" name="newSpringType" placeholder="Or add new spring type" style={{ marginTop: '6px' }} />
                  </td>
                  <td><input className="form-input" name="pcsProduced" type="number" min="1" step="1" placeholder="0" required /></td>
                  <td><input className="form-input" name="weightPerPiece" type="number" min="0.0001" step="0.0001" placeholder="0.0000" required /></td>
                  <td><input className="form-input" name="totalWeight" type="number" min="0.0001" step="0.0001" placeholder="0.0000" required /></td>
                  <td><button type="submit" className="btn btn-primary btn-sm">Save</button></td>
                </tr>
              </tbody>
            </table>
          </form>
        </div>

        {!mombasaBranch && <div className="section-sub" style={{ marginTop: '-12px', marginBottom: '24px', color: 'var(--danger)' }}>Mombasa Branch is not configured, so production cannot be recorded.</div>}

        <div className="section-header mb-16">
          <div>
            <div className="section-title">Production history</div>
            <div className="section-sub">Production output recorded against completed jobs and manual entries</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Job Card No</th><th>Date</th><th>Spring Type</th><th>Source</th><th>Pcs Produced</th><th>Weight per Pcs</th><th>Total Weight</th></tr></thead>
            <tbody>
              {productionRows.map((row) => (
                <tr key={`${row.source}-${row.id}`}>
                  <td>
                    {row.href ? (
                      <Link href={row.href} className="font-mono" style={{ color: 'var(--accent)' }}>{row.jobCard}</Link>
                    ) : (
                      <span className="font-mono">{row.jobCard}</span>
                    )}
                  </td>
                  <td>{row.date.toLocaleDateString()}</td>
                  <td>{row.springType}</td>
                  <td><span className={`badge ${row.source === 'Manual entry' ? 'badge-teal' : 'badge-muted'}`}>{row.source}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.pcsProduced.toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.weightPerPiece != null ? `${row.weightPerPiece.toFixed(4)} kg` : '—'}</td>
                  <td><span className="job-kg">{row.totalWeight.toFixed(2)} kg</span></td>
                </tr>
              ))}
              {productionRows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>No production records match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
