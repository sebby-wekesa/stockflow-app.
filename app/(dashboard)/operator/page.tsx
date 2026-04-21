import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export default async function OperatorPage() {
  const user = await requireAuth()

  const jobs = await prisma.productionOrder.findMany({
    where: {
      currentDept: user.department,
      status: "IN_PRODUCTION",
    },
    include: { design: true },
    orderBy: { priority: 'desc' }
  })

  return (
    <div>
      <h1>Operator Dashboard - {user.department}</h1>
      {jobs.map(job => (
        <div key={job.id}>
          <h2>{job.design.name} - {job.orderNumber}</h2>
          <p>Priority: {job.priority}</p>
          <p>Quantity: {job.quantity}</p>
        </div>
      ))}
    </div>
  )
}