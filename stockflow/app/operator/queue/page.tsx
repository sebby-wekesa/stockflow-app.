import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

async function getOperatorStats(department: string | null) {
  if (!department) return null;

  const pendingJobs = await prisma.productionOrder.findMany({
    where: { status: "IN_PRODUCTION" },
    include: {
      design: { include: { stages: true } },
      logs: { orderBy: { sequence: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return { pendingJobs, department };
}

export default async function OperatorQueuePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
  });

  if (!dbUser) redirect("/login");

  const department = dbUser.dept;
  const stats = department ? await getOperatorStats(department) : null;

  if (!stats) {
    return (
      <div className="card">
        <p className="text-muted text-sm">No department assigned</p>
      </div>
    );
  }

  return (
    <div className="mb-24">
      <div className="section-header mb-16">
        <div>
          <div className="section-title">{department} dept — job queue</div>
          <div className="section-sub">
            Welcome back, {user.name || user.email}
          </div>
        </div>
      </div>
      {stats.pendingJobs.length === 0 ? (
        <div className="card">
          <p className="text-muted text-sm">No jobs in queue</p>
        </div>
      ) : (
        <div>
          {stats.pendingJobs.map((order) => (
            <JobCard key={order.id} order={order} department={department} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ order, department }: { order: any; department: string }) {
  const currentStage = order.design.stages.find((s: any) => s.sequence === order.currentStage);

  return (
    <div className="job-card inprog" style={{ marginBottom: "10px" }}>
      <Link href={`/jobs/${order.id}`} className="block">
        <div className="job-header">
          <span className="job-id">{order.id.slice(0, 8)} · Stage {order.currentStage}/{order.design.stages.length}</span>
          <span className="badge badge-amber">In progress</span>
        </div>
        <div className="job-design">{order.design.name} — {currentStage?.name || "Unknown"}</div>
        <div className="job-meta" style={{ marginTop: "8px" }}>
          <span>Target: <span className="job-kg">{order.targetKg} kg</span></span>
          <span>Qty: {order.quantity} units</span>
        </div>
      </Link>
    </div>
  );
}