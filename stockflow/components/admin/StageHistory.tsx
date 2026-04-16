import { Clock, User, Package } from "lucide-react";

interface StageLog {
  id: string;
  stageName: string;
  sequence: number;
  kgIn: number;
  kgOut: number;
  kgScrap: number;
  scrapReason?: string;
  department?: string;
  operator: { name: string };
  completedAt: string;
  notes?: string;
}

interface StageHistoryProps {
  orderId: string;
  logs: StageLog[];
}

export function StageHistory({ orderId, logs }: StageHistoryProps) {
  // Sort logs by completedAt ascending
  const sortedLogs = [...logs].sort((a, b) =>
    new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-[#0f1113] border border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
          <Clock size={20} />
        </div>
        <h3 className="text-white font-bold">Stage History</h3>
        <span className="text-xs text-zinc-500 ml-auto">
          {logs.length} entries
        </span>
      </div>

      {sortedLogs.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <Package size={32} className="mx-auto mb-3 opacity-50" />
          <p>No stage logs yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedLogs.map((log, index) => (
            <div key={log.id} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                {index < sortedLogs.length - 1 && (
                  <div className="w-px h-full bg-zinc-700 mt-2" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">
                        Stage {log.sequence}: {log.stageName}
                      </span>
                      {log.department && (
                        <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                          {log.department}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-500">
                      {formatDate(log.completedAt)} at {formatTime(log.completedAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-medium">
                      {log.kgOut}kg out
                    </div>
                    {log.kgScrap > 0 && (
                      <div className="text-red-400 text-sm">
                        {log.kgScrap}kg scrap
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-zinc-400">
                  <div className="flex items-center gap-1">
                    <User size={14} />
                    <span>{log.operator.name}</span>
                  </div>
                  <div>
                    In: {log.kgIn}kg
                  </div>
                  {log.scrapReason && (
                    <div className="text-red-400">
                      Reason: {log.scrapReason}
                    </div>
                  )}
                </div>

                {log.notes && (
                  <div className="mt-2 text-sm text-zinc-500 bg-zinc-900/50 p-2 rounded">
                    {log.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}