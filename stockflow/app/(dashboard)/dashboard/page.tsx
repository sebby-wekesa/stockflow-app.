import { requireAuth } from '@/lib/auth'
import { Role } from '@/lib/auth'
import { RawMaterial } from '@prisma/client'
import { TeamRole } from '@/lib/proxy'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ previewRole?: string }>
}) {
  const params = await searchParams;
  const user = await requireAuth();

  // Use previewRole from URL if present, else user role
  const effectiveRole = (params.previewRole || user.role).toUpperCase() as Role;
  const role = effectiveRole.toLowerCase() as TeamRole;
  return <TeamDashboard role={role} user={user} />;
}

// Pending Dashboard - Shows pending approval message
function PendingView({ user }: { user: any }) {
  return (
    <div className="space-y-8">
      <div className="card">
        <div className="text-center py-12">
          <div className="mx-auto mb-6 w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text mb-4">Account Pending Approval</h2>
          <p className="text-muted mb-6 max-w-md mx-auto">
            Your account has been created successfully and is waiting for administrator approval.
            You will receive access to the system once your account is approved.
          </p>
          <div className="bg-surface2 border border-border rounded-lg p-4 max-w-sm mx-auto">
            <div className="text-sm">
              <div className="font-medium text-text">Welcome, {user.name || user.email}!</div>
              <div className="text-muted mt-1">Role: Pending Approval</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Operator Dashboard - Shows "My jobs" and "History"
async function OperatorQueue({ user, role }: { user: any; role: TeamRole }) {
  // Import the existing operator components
  const { getOperatorQueue } = await import('@/actions/production')
  const orders = await getOperatorQueue(role.toUpperCase(), user.department)

  const { getOperatorHistory } = await import('@/actions/production')
  const history = await getOperatorHistory()

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">My Jobs</div>
          <div className="section-sub">Jobs assigned to your department</div>
        </div>
      </div>

      {/* Active Jobs Section */}
      <div className="card mb-16">
        <div className="section-header mb-16">
          <div className="section-title">Active Jobs</div>
        </div>
        {orders.length > 0 ? (
          orders.map((order) => {
            const isUrgent = order.priority === "URGENT" || order.priority === "HIGH"
            return (
              <div key={order.id} className={`job-card ${isUrgent ? 'urgent' : ''}`} style={{marginBottom: '16px'}}>
                <div className="job-header">
                  <span className="job-id">{order.orderNumber} · Stage {order.currentStage}/{order.totalStages}</span>
                  <span className={`badge ${isUrgent ? 'badge-red' : 'badge-amber'}`}>
                    {isUrgent ? 'Urgent' : 'In progress'}
                  </span>
                </div>
                <div className="job-design">{order.designName} — {order.workDescription}</div>
                <div className="job-meta" style={{marginTop:'8px', display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--muted)'}}>
                  <span>Received: <span className="job-kg">{order.inheritedKg.toFixed(2)} kg</span></span>
                  <span>Target init: {order.targetKg.toFixed(2)} kg</span>
                </div>
              </div>
            )
          })
        ) : (
          <div style={{ padding: '20px', color: 'var(--muted)', textAlign: 'center' }}>
            No jobs currently assigned to your department.
          </div>
        )}
      </div>

      {/* History Section */}
      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title">Job History</div>
          <div className="section-sub">Recently completed jobs</div>
        </div>
        {history.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Design</th>
                  <th>Completed</th>
                  <th>Output</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item: any) => (
                  <tr key={item.id}>
                    <td>
                      <span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{item.orderNumber}</span>
                    </td>
                    <td>{item.designName}</td>
                    <td>{new Date(item.completedAt).toLocaleDateString()}</td>
                    <td>
                      <span className="job-kg">{item.kgOut} kg</span>
                    </td>
                    <td>
                      <span className="badge badge-green">Completed</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '20px', color: 'var(--muted)', textAlign: 'center' }}>
            No completed jobs yet.
          </div>
        )}
      </div>
    </div>
  )
}

// Sales Dashboard - Shows "Catalogue" and "My Orders"
async function SalesView({ user, role }: { user: any; role: TeamRole }) {
  // Import sales-specific data
  const { getCatalogue } = await import('@/actions/sales')
  const { getSalesOrders } = await import('@/app/actions/sales-orders')

  const products = await getCatalogue()
  const orders = await getSalesOrders(role.toUpperCase())

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Sales Dashboard</div>
          <div className="section-sub">Manage orders and browse catalogue</div>
        </div>
        <a href="/catalogue" className="btn btn-primary">Place New Order</a>
      </div>

      {/* Catalogue Section */}
      <div className="card mb-16">
        <div className="section-header mb-16">
          <div className="section-title">Available Catalogue</div>
          <div className="section-sub">Products ready for ordering</div>
        </div>
        {products.length > 0 ? (
          <div className="grid-3">
            {products.map((product: any) => (
              <div key={product.id} className="product-card">
                <div className="product-name">{product.name}</div>
                <div className="product-code">{product.code}</div>
                <div className="product-stock">
                  <span className="job-kg">{product.availableQty} units</span> available
                </div>
                <div className="product-price">${product.price}/unit</div>
                <a href="/catalogue" className="btn btn-sm">Order Now</a>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px', color: 'var(--muted)', textAlign: 'center' }}>
            No products available in catalogue.
          </div>
        )}
      </div>

      {/* My Orders Section */}
      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title">My Orders</div>
          <div className="section-sub">Track your order history</div>
        </div>
        {orders.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any) => (
                  <tr key={order.id}>
                    <td>
                      <span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{order.orderNumber}</span>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>{order.itemCount} items</td>
                    <td>${order.amount.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${
                        order.status === 'PENDING' ? 'badge-amber' :
                        order.status === 'CONFIRMED' ? 'badge-purple' :
                        order.status === 'SHIPPED' ? 'badge-blue' : 'badge-green'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '20px', color: 'var(--muted)', textAlign: 'center' }}>
            No orders placed yet.
          </div>
        )}
      </div>
    </div>
  )
}

// Warehouse Dashboard - Shows inventory and receiving
async function WarehouseView({ user, role }: { user: any; role: TeamRole }) {
  const { prisma } = await import('@/lib/prisma')

  // Initialize with the specific Prisma type
  let materials: RawMaterial[] = []

  try {
    materials = await prisma.rawMaterial.findMany({
      orderBy: {
        materialName: "asc",
      },
    })
  } catch (error) {
    console.warn('Failed to fetch raw materials:', error)
    materials = []
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Warehouse Dashboard</div>
          <div className="section-sub">Manage raw materials and receiving</div>
        </div>
        <button className="btn btn-primary">Receive Stock</button>
      </div>

      {/* Raw Materials Inventory */}
      <div className="card">
        <div className="section-header mb-16">
          <div className="section-title">Raw Materials Inventory</div>
          <div className="section-sub">Current stock levels</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Diameter</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material: any) => (
                <tr key={material.id}>
                  <td>{material.materialName}</td>
                  <td>{material.diameter}</td>
                  <td>
                    <span className="job-kg">{material.availableKg} kg</span>
                  </td>
                  <td>{material.reservedKg} kg</td>
                  <td>{material.supplier || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Manager Dashboard - Shows production management overview
async function ManagerOverview({ user, role }: { user: any; role: TeamRole }) {
  const data = await import('@/app/actions/dashboard').then(m => m.getDashboardStats(user, role.toUpperCase() as Role))
  const { stats, recentOrders, departmentScrap, throughput } = data

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Production Management</div>
          <div className="section-sub">Oversee production orders and department performance</div>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          <a href="/manager" className="btn btn-primary">View Approvals</a>
          <button className="btn btn-ghost">+ New order</button>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat: any, i: number) => (
          <div key={i} className={`stat-card ${stat.color}`}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">
              {stat.value}{stat.suffix && <span style={{fontSize:'14px',color:'var(--muted)'}}> {stat.suffix}</span>}
            </div>
            <div className="stat-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-16">
        {recentOrders.length > 0 && (
          <div className="card">
            <div className="section-header mb-16">
              <div className="section-title">Recent production orders</div>
              <div style={{fontSize:'11px',color:'var(--muted)'}}>Orders requiring attention</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Design</th>
                    <th>Kg target</th>
                    <th>Status</th>
                    <th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.slice(0, 5).map((order: any) => (
                    <tr key={order.id}>
                      <td>
                        <span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{order.id}</span>
                      </td>
                      <td>{order.design}</td>
                      <td>
                        <span className="job-kg">{order.kg} kg</span>
                      </td>
                      <td>
                        <span className={`badge ${
                          order.status === 'Pending approval' ? 'badge-amber' :
                          order.status === 'In production' ? 'badge-purple' :
                          'badge-green'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td>{order.dept || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {departmentScrap.length > 0 && (
          <div className="card">
            <div className="section-header mb-16">
              <div className="section-title">Department performance</div>
              <div style={{fontSize:'11px',color:'var(--muted)'}}>Scrap rates this week</div>
            </div>
            {departmentScrap.slice(0, 4).map((item: any) => {
              const cls = item.pct > 10 ? 'bad' : item.pct > 5 ? 'warn' : 'good'
              return (
                <div key={item.dept} className="scrap-bar-wrap">
                  <div className="scrap-bar-label">
                    <span>{item.dept}</span>
                    <span>{item.kg} kg · {item.pct}%</span>
                  </div>
                  <div className="scrap-bar">
                    <div className={`scrap-bar-fill ${cls}`} style={{width:`${Math.min(item.pct*4, 100)}%`}} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {throughput.length > 0 && (
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title">Department activity — today</div>
            <div style={{fontSize:'11px',color:'var(--muted)'}}>Real-time production metrics</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Active jobs</th>
                  <th>Kg processed</th>
                  <th>Yield rate</th>
                  <th>Operators</th>
                </tr>
              </thead>
              <tbody>
                {throughput.map((dept: any) => (
                  <tr key={dept.dept}>
                    <td>{dept.dept}</td>
                    <td>{dept.jobs}</td>
                    <td>
                      <span className="job-kg">{dept.kg} kg</span>
                    </td>
                    <td>
                      <span className={`badge ${
                        dept.yield < 70 ? 'badge-red' :
                        dept.yield < 90 ? 'badge-amber' : 'badge-green'
                      }`}>
                        {dept.yield}%
                      </span>
                    </td>
                    <td>{dept.ops}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// TeamDashboard component - switches views based on role
const TeamDashboard = ({ role, user }: { role: TeamRole; user: any }) => {
  switch (role) {
    case 'sales':
      return <SalesView user={user} role={role} />;
    case 'packaging':
      return <PackagingView user={user} role={role} />;
    case 'warehouse':
      return <WarehouseView user={user} role={role} />;
    case 'manager':
      return <ManagerOverview user={user} role={role} />;
    case 'operator':
      return <OperatorQueue user={user} role={role} />;
    case 'admin':
      return <AdminView user={user} role={role} />;
    default:
      return <AdminView user={user} role={role} />;
  }
};

// Packaging Dashboard - Shows packaging operations overview
async function PackagingView({ user, role }: { user: any; role: TeamRole }) {
  // For now, show basic packaging-focused stats
  // TODO: Implement proper packaging dashboard data
  const data = await import('@/app/actions/dashboard').then(m => m.getDashboardStats(user, role.toUpperCase() as Role))
  const { stats } = data

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Packaging Operations</div>
          <div className="section-sub">Manage order fulfillment and shipping</div>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          <a href="/packaging" className="btn btn-primary">View Packaging Queue</a>
          <button className="btn btn-ghost">+ New shipment</button>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat: any, i: number) => (
          <div key={i} className={`stat-card ${stat.color}`}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">
              {stat.value}{stat.suffix && <span style={{fontSize:'14px',color:'var(--muted)'}}> {stat.suffix}</span>}
            </div>
            <div className="stat-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title">Packaging Status</div>
            <div style={{fontSize:'11px',color:'var(--muted)'}}>Current queue overview</div>
          </div>
          <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>
            Packaging queue and shipment tracking will be displayed here.
            <br />
            <a href="/packaging" className="btn btn-primary" style={{marginTop: '16px', display: 'inline-block'}}>
              Go to Packaging Queue
            </a>
          </div>
        </div>

        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title">Recent Shipments</div>
            <div style={{fontSize:'11px',color:'var(--muted)'}}>Orders marked as shipped</div>
          </div>
          <div style={{padding: '20px', textAlign: 'center', color: 'var(--muted)'}}>
            Recent shipment history will be displayed here.
          </div>
        </div>
      </div>
    </div>
  )
}

// Admin Dashboard - Shows the full overview
async function AdminView({ user, role }: { user: any; role: TeamRole }) {
  const data = await import('@/app/actions/dashboard').then(m => m.getDashboardStats(user, role.toUpperCase() as Role))
  const { stats, recentOrders, departmentScrap, throughput } = data

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Management Overview</div>
          <div className="section-sub">Full production and inventory insights</div>
        </div>
        <button className="btn btn-primary">+ New production order</button>
      </div>

      <div className="stats-grid">
        {stats.map((stat: any, i: number) => (
          <div key={i} className={`stat-card ${stat.color}`}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">
              {stat.value}{stat.suffix && <span style={{fontSize:'14px',color:'var(--muted)'}}> {stat.suffix}</span>}
            </div>
            <div className="stat-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2 mb-16">
        {recentOrders.length > 0 && (
          <div className="card">
            <div className="section-header mb-16">
              <div className="section-title">Recent production orders</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Design</th>
                    <th>Kg reserved</th>
                    <th>Status</th>
                    <th>Dept</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order: any) => (
                    <tr key={order.id}>
                      <td>
                        <span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{order.id}</span>
                      </td>
                      <td>{order.design}</td>
                      <td>
                        <span className="job-kg">{order.kg} kg</span>
                      </td>
                      <td>
                        <span className={`badge ${
                          order.status === 'Pending approval' ? 'badge-amber' :
                          order.status === 'In production' ? 'badge-purple' :
                          'badge-green'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td>{order.dept || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {departmentScrap.length > 0 && (
          <div className="card">
            <div className="section-header mb-16">
              <div className="section-title">Scrap by department</div>
              <div style={{fontSize:'11px',color:'var(--muted)'}}>This week</div>
            </div>
            {departmentScrap.map((item: any) => {
              const cls = item.pct > 10 ? 'bad' : item.pct > 5 ? 'warn' : 'good'
              return (
                <div key={item.dept} className="scrap-bar-wrap">
                  <div className="scrap-bar-label">
                    <span>{item.dept}</span>
                    <span>{item.kg} kg · {item.pct}%</span>
                  </div>
                  <div className="scrap-bar">
                    <div className={`scrap-bar-fill ${cls}`} style={{width:`${item.pct*4}%`}} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {throughput.length > 0 && (
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title">Department throughput — today</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Jobs active</th>
                  <th>Kg processed</th>
                  <th>Kg scrap</th>
                  <th>Yield</th>
                  <th>Operators</th>
                </tr>
              </thead>
              <tbody>
                {throughput.map((dept: any) => (
                  <tr key={dept.dept}>
                    <td>{dept.dept}</td>
                    <td>{dept.jobs}</td>
                    <td>
                      <span className="job-kg">{dept.kg} kg</span>
                    </td>
                    <td>{dept.scrap} kg</td>
                    <td>
                      <span className={`badge ${
                        dept.yield < 70 ? 'badge-red' :
                        dept.yield < 90 ? 'badge-amber' : 'badge-green'
                      }`}>
                        {dept.yield}%
                      </span>
                    </td>
                    <td>{dept.ops}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
