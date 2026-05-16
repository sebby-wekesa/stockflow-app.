"use client";

interface SaleOrder {
  id: string;
  customerName: string;
  amount: number;
  status: string;
  createdAt: Date;
  items: any[]; // TODO: proper type
}

interface SalesOrderListProps {
  orders: SaleOrder[];
}

export function SalesOrderList({ orders }: SalesOrderListProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      {(orders || []).length === 0 ? (
        <p className="text-gray-400">No sales orders yet.</p>
      ) : (
        <div className="space-y-4">
          {(orders || []).map((order) => (
            <div key={order.id} className="bg-gray-700 p-4 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-white font-semibold">{order.customerName}</h3>
                  <p className="text-gray-300">Status: {order.status}</p>
                  <p className="text-gray-300">Items: {order.items.length}</p>
                   <p className="text-gray-300">Total: ${order.amount.toFixed(2)}</p>
                  <p className="text-gray-300">Date: {order.createdAt.toLocaleDateString()}</p>
                </div>
                <div className="space-x-2">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                    View
                  </button>
                  <button className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}