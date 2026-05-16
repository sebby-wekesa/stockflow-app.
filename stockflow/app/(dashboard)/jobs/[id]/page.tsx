import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { StageCompletionForm } from "@/components/StageCompletionForm";

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const user = await getUser();
  if (!user) redirect("/login");

  const order = await prisma.productionOrder.findUnique({
    where: { id },
    include: {
      Design: { include: { stages: { orderBy: { sequence: "asc" } } } },
      logs: { orderBy: { sequence: "desc" } },
    },
  });

  if (!order) {
    return <div>Order not found</div>;
  }

  const currentStage = order.Design.stages.find((s) => s.sequence === order.currentStage);
  const lastLog = order.logs[0];

  const statusColors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-blue-100 text-blue-800",
    IN_PRODUCTION: "bg-purple-100 text-purple-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{order.Design.name}</h1>
          <p className="text-zinc-500">Order #{order.id.slice(0, 8)}</p>
        </div>
        <span className={`px-3 py-1 text-sm font-medium rounded ${statusColors[order.status]}`}>
          {order.status}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-zinc-200">
          <p className="text-xs font-medium text-zinc-500 uppercase">Quantity</p>
          <p className="text-xl font-bold text-zinc-900">{order.quantity}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-zinc-200">
          <p className="text-xs font-medium text-zinc-500 uppercase">Target Kg</p>
          <p className="text-xl font-bold text-zinc-900">{order.targetKg.toNumber()} kg</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-zinc-200">
          <p className="text-xs font-medium text-zinc-500 uppercase">Current Stage</p>
          <p className="text-xl font-bold text-zinc-900">
            {currentStage?.name || "Completed"}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-zinc-200">
          <p className="text-xs font-medium text-zinc-500 uppercase">Progress</p>
          <p className="text-xl font-bold text-zinc-900">
            {order.currentStage}/{order.Design.stages.length}
          </p>
        </div>
      </div>

      {order.status !== "COMPLETED" && currentStage && (
        <div className="bg-white p-6 rounded-lg border border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">
            Stage {order.currentStage}: {currentStage.name}
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            Enter kg values. The system validates: kg In = kg Out + kg Scrap
          </p>
          <StageCompletionForm
            orderId={order.id}
            stageName={currentStage.name}
            sequence={order.currentStage}
            stageCount={order.Design.stages.length}
            operatorId={user.id}
            previousKgOut={lastLog?.kgOut?.toNumber()}
          />
        </div>
      )}

      {order.logs.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <h2 className="text-lg font-semibold text-zinc-900 p-4 border-b border-zinc-200">
            Production History
          </h2>
          <table className="w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Stage</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Kg In</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Kg Out</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Kg Scrap</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Balance</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {order.logs.map((log) => {
                const kgInNum = log.kgIn.toNumber();
                const kgOutNum = log.kgOut.toNumber();
                const kgScrapNum = log.kgScrap.toNumber();
                const balance = kgInNum - (kgOutNum + kgScrapNum);
                return (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {log.sequence}. {log.stageName}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{kgInNum.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{kgOutNum.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{kgScrapNum.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={Math.abs(balance) < 0.001 ? "text-green-600" : "text-red-600"}>
                        {balance.toFixed(3)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">
                      {log.completedAt.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}