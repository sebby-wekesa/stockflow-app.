import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatKg } from '@/lib/production'
import { ReceiveForm } from '../_components/receive-form'

const RM_MOVEMENT_LABELS: Record<string, { label: string; color: string }> = {
  purchase_receipt: { label: 'Purchase in', color: 'text-teal' },
  issued_to_production: { label: 'Issued to job', color: 'text-purple' },
  adjustment_in: { label: 'Adjust +', color: 'text-accent' },
  adjustment_out: { label: 'Adjust −', color: 'text-accent' },
  scrap_out: { label: 'Scrap', color: 'text-red' },
}

export default async function RawMaterialDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const material = await prisma.rawMaterial.findUnique({
    where: { id: params.id },
  })
  if (!material) notFound()

  const [balance, movements] = await Promise.all([
    prisma.rawMaterialBalance.findUnique({ where: { raw_material_id: material.id } }),
    prisma.rawMaterialMovement.findMany({
      where: { raw_material_id: material.id },
      orderBy: { movement_date: 'desc' },
      take: 30,
      include: { created_by_user: { select: { full_name: true } } },
    }),
  ])

  const kg = balance ? Number(balance.qty_kg) : 0
  const bars = balance?.qty_bars ?? 0

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <Link href="/raw-materials" className="text-sm text-muted hover:text-text">
          ← Back to raw materials
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="font-head text-2xl font-bold font-mono">{material.code}</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              material.material_type === 'flat_bar'
                ? 'bg-accent/15 text-accent'
                : 'bg-purple/15 text-purple'
            }`}
          >
            {material.material_type === 'flat_bar' ? 'Flat bar' : 'Round bar'}
          </span>
        </div>
        <p className="text-muted text-sm mt-1">{material.label}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Bars in stock</div>
          <div className="font-head text-3xl font-bold font-mono">{bars}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-muted mb-1">Total weight</div>
          <div className={`font-head text-3xl font-bold font-mono ${kg > 0 ? 'text-teal' : 'text-muted'}`}>
            {formatKg(kg)}
          </div>
        </div>
      </div>

      {/* RECEIVE FORM */}
      <ReceiveForm rawMaterialId={material.id} />

      {/* MOVEMENT HISTORY */}
      {movements.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="font-head font-bold text-sm">Recent movements</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted text-left border-b border-border">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium text-right">Bars</th>
                  <th className="px-4 py-2 font-medium text-right">kg</th>
                  <th className="px-4 py-2 font-medium">Reference</th>
                  <th className="px-4 py-2 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const meta = RM_MOVEMENT_LABELS[m.movement_type] ?? {
                    label: m.movement_type,
                    color: 'text-muted',
                  }
                  const isOut = m.qty_kg && Number(m.qty_kg) < 0
                  return (
                    <tr key={m.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                        {new Date(m.movement_date).toLocaleDateString()}
                      </td>
                      <td className={`px-4 py-2 text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${isOut ? 'text-red' : 'text-teal'}`}>
                        {isOut ? '' : '+'}{m.qty_bars}
                      </td>
                      <td className={`px-4 py-2 text-right font-mono ${isOut ? 'text-red' : 'text-teal'}`}>
                        {isOut ? '' : '+'}{formatKg(Number(m.qty_kg))}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono text-muted">
                        {m.reference ?? m.supplier_name ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted">
                        {m.created_by_user.full_name}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
