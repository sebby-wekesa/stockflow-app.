"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Truck, AlertTriangle, CheckCircle } from "lucide-react";

interface WarehouseStats {
  totalRawMaterials: number;
  lowStockItems: number;
  recentDeliveries: number;
  pendingOrders: number;
}

interface RecentDelivery {
  id: string;
  material: {
    materialName: string;
    diameter: string;
  };
  kgReceived: number;
  createdAt: string;
}

interface LowStockItem {
  id: string;
  materialName: string;
  diameter: string;
  availableKg: number;
}

export default function WarehousePage() {
  const router = useRouter();
  const [stats, setStats] = useState<WarehouseStats>({
    totalRawMaterials: 0,
    lowStockItems: 0,
    recentDeliveries: 0,
    pendingOrders: 0
  });
  const [recentDeliveries, setRecentDeliveries] = useState<RecentDelivery[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWarehouseData = async () => {
      try {
        // Fetch stats
        const statsResponse = await fetch('/api/warehouse/stats');
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }

        // Fetch recent deliveries
        const deliveriesResponse = await fetch('/api/warehouse/recent-deliveries');
        if (deliveriesResponse.ok) {
          const deliveriesData = await deliveriesResponse.json();
          setRecentDeliveries(deliveriesData);
        }

        // Fetch low stock alerts
        const lowStockResponse = await fetch('/api/warehouse/low-stock');
        if (lowStockResponse.ok) {
          const lowStockData = await lowStockResponse.json();
          setLowStockAlerts(lowStockData);
        }
      } catch (error) {
        console.error('Error fetching warehouse data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWarehouseData();
  }, []);

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Warehouse Team Dashboard</div><div className="section-sub">Manage inventory and track stock levels</div></div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card teal">
          <div className="stat-label">Total materials</div>
          <div className="stat-value">{isLoading ? '...' : stats.totalRawMaterials}</div>
          <div className="stat-sub">Active inventory</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Low stock alerts</div>
          <div className="stat-value">{isLoading ? '...' : stats.lowStockItems}</div>
          <div className="stat-sub">Need attention</div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Receiving</div><Link href="/receive" className="btn btn-ghost btn-sm">Receive stock</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Material</th><th>Kg received</th><th>Date</th></tr></thead>
              <tbody>
                {recentDeliveries.slice(0, 4).map((delivery) => (
                  <tr key={delivery.id}>
                    <td>{delivery.material.materialName} {delivery.material.diameter}</td>
                    <td><span className="job-kg">{delivery.kgReceived} kg</span></td>
                    <td>{new Date(delivery.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Stock levels</div><Link href="/rawmaterials" className="btn btn-ghost btn-sm">View all</Link></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Material</th><th>Available</th><th>Status</th></tr></thead>
              <tbody>
                {lowStockAlerts.slice(0, 4).map((item) => (
                  <tr key={item.id}>
                    <td>{item.materialName} {item.diameter}</td>
                    <td><span className="job-kg">{item.availableKg} kg</span></td>
                    <td><span className={`badge ${item.availableKg < 100 ? 'badge-red' : 'badge-teal'}`}>{item.availableKg < 100 ? 'Low' : 'Good'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Low Stock Alerts */}
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <AlertTriangle className="h-5 w-5" style={{color: 'var(--red)'}} />
              Low Stock Alerts
            </div>
            <div className="section-sub">Materials that need attention</div>
          </div>
          {lowStockAlerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto mb-4" style={{color: 'var(--teal)'}} />
              <p style={{color: 'var(--muted)'}}>All materials are well stocked!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockAlerts.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3" style={{background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)'}}>
                  <div>
                    <p className="font-medium" style={{color: 'var(--text)'}}>{item.materialName}</p>
                    <p className="text-sm" style={{color: 'var(--muted)'}}>
                      Size: {item.diameter}
                    </p>
                  </div>
                  <span className="badge badge-red">
                    {item.availableKg} kg
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Deliveries */}
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Truck className="h-5 w-5" style={{color: 'var(--teal)'}} />
              Recent Deliveries
            </div>
            <div className="section-sub">Latest stock received</div>
          </div>
          {recentDeliveries.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="h-12 w-12 mx-auto mb-4" style={{color: 'var(--muted)'}} />
              <p style={{color: 'var(--muted)'}}>No recent deliveries</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="flex items-center justify-between p-3" style={{background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)'}}>
                  <div>
                    <p className="font-medium" style={{color: 'var(--text)'}}>{delivery.material.materialName}</p>
                    <p className="text-sm" style={{color: 'var(--muted)'}}>
                      {new Date(delivery.createdAt).toLocaleDateString()} · {delivery.material.diameter}
                    </p>
                  </div>
                  <span className="badge badge-muted">
                    {delivery.kgReceived} kg
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
