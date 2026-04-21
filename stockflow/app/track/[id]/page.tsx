// app/track/[id]/page.tsx
import { getOrderProgress } from "@/lib/actions/customer";

export default async function TrackingPage({ params }: { params: { id: string } }) {
  const order = await getOrderProgress(params.id);

  if (!order) return <div className="p-10 text-center">Order not found.</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 mt-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black">StockFlow Live</h1>
        <p className="text-gray-500">Tracking Order: {order.orderNumber}</p>
      </div>

      <div className="bg-white border rounded-3xl p-8 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{order.product}</h2>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
            {order.status}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-4 rounded-full mb-8 overflow-hidden">
          <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${order.progress}%` }} />
        </div>

        {/* Vertical Stepper */}
        <div className="space-y-6">
          {order.stages.map((stage, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                stage.isCompleted ? 'bg-green-500 text-white' : 
                stage.isCurrent ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-200 text-gray-400'
              }`}>
                {stage.isCompleted ? '✓' : idx + 1}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${stage.isCurrent ? 'text-blue-600' : 'text-gray-700'}`}>
                  {stage.name}
                </p>
                {stage.isCurrent && <p className="text-xs text-blue-400 font-medium">In Progress</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs text-gray-400">
          Last updated: {order.lastUpdate.toLocaleString()}
        </div>
      </div>
    </div>
  );
}