"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');

  const mockData = {
    rawMaterialStock: 4820,
    activeOrders: 12,
    finishedGoods: 1340,
    scrapThisWeek: 82,
    pendingApprovals: 3,
    recentOrders: [
      { id: "PO-0041", design: "Hex bolt M12", kg: 120, status: "Pending approval", dept: null },
      { id: "PO-0040", design: "Stud rod 8mm", kg: 85, status: "In production", dept: "Threading" },
      { id: "PO-0039", design: "Anchor bolt", kg: 200, status: "In production", dept: "Electroplate" },
      { id: "PO-0038", design: "Hex bolt M10", kg: 60, status: "Complete", dept: "Done" },
    ],
    departmentScrap: [
      { dept: "Cutting", kg: 8, pct: 4 },
      { dept: "Forging", kg: 22, pct: 11 },
      { dept: "Threading", kg: 5, pct: 2 },
      { dept: "Electroplating", kg: 31, pct: 15 },
      { dept: "Drilling", kg: 16, pct: 8 },
    ],
    throughput: [
      { dept: "Cutting", jobs: 3, kg: 340, scrap: 14, yield: 95.9, ops: 2 },
      { dept: "Forging / chamfer", jobs: 2, kg: 180, scrap: 22, yield: 87.8, ops: 2 },
      { dept: "Threading / locking", jobs: 4, kg: 210, scrap: 5, yield: 97.6, ops: 3 },
      { dept: "Electroplating", jobs: 1, kg: 95, scrap: 31, yield: 67.4, ops: 1 },
      { dept: "Drilling / grinding", jobs: 2, kg: 120, scrap: 10, yield: 91.7, ops: 2 },
    ]
  };

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Overview</div>
          <div className="section-sub">Today — Wednesday 25 Mar 2026</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setModalContent('new_order'); setModalOpen(true); }}>+ New production order</button>
      </div>

      <div className="stats-grid">
        <StatCard label="Raw material stock" value={mockData.rawMaterialStock} suffix="kg" sub="+200 kg today" />
        <StatCard label="Active production orders" value={mockData.activeOrders} sub="4 pending approval · 8 in production" />
        <StatCard label="Finished goods ready" value={mockData.finishedGoods} suffix="kg" sub="247 units across 6 designs" />
        <StatCard label="Scrap this week" value={mockData.scrapThisWeek} suffix="kg" sub="↓ 12 kg vs last week" down />
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title">Recent production orders</div>
            <button className="btn btn-ghost btn-sm">View all</button>
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
                {mockData.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <code className="text-xs font-mono text-blue-400 bg-blue-900/20 px-2 py-1 rounded">
                        {order.id}
                      </code>
                    </td>
                    <td>{order.design}</td>
                    <td>
                      <span className="job-kg">{order.kg} kg</span>
                    </td>
                    <td>
                      <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-md border ${
                        order.status === "Pending approval"
                          ? "bg-amber-900/20 border-amber-500/30 text-amber-100"
                          : order.status === "In production"
                          ? "bg-purple-900/20 border-purple-500/30 text-purple-100"
                          : "bg-emerald-900/20 border-emerald-500/30 text-emerald-100"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{order.dept || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="section-header mb-16">
            <div className="section-title">Scrap by department</div>
            <div style={{ fontSize: "11px", color: "var(--muted)" }}>This week</div>
          </div>
          {mockData.departmentScrap.map((item) => {
            const cls = item.pct > 10 ? "bad" : item.pct > 5 ? "warn" : "good";
            return (
              <div key={item.dept} className="scrap-bar-wrap">
                <div className="scrap-bar-label">
                  <span>{item.dept}</span>
                  <span>{item.kg} kg · {item.pct}%</span>
                </div>
                <div className="scrap-bar">
                  <div className={`scrap-bar-fill ${cls}`} style={{ width: `${item.pct * 4}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
              {mockData.throughput.map((dept) => (
                <tr key={dept.dept}>
                  <td>{dept.dept}</td>
                  <td>{dept.jobs}</td>
                  <td>
                    <span className="job-kg">{dept.kg} kg</span>
                  </td>
                  <td>{dept.scrap} kg</td>
                  <td>
                    <span className={`badge ${
                      dept.yield < 70 ? "badge-red" :
                      dept.yield < 90 ? "badge-amber" : "badge-green"
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        {modalContent === 'new_order' && (
          <div>
            <div className="modal-title">New production order</div>
            <div className="modal-sub">Select a design to auto-fill the process stages</div>
            <div className="form-group mb-16"><label className="form-label">Design template</label><select className="form-input"><option>Hex bolt M12</option><option>Stud rod 8mm</option><option>Anchor bolt</option></select></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Quantity (units)</label><input className="form-input" type="number" placeholder="e.g. 500"/></div>
              <div className="form-group"><label className="form-label">Kg to reserve</label><input className="form-input" type="number" placeholder="Auto-calculated"/></div>
            </div>
            <div className="form-group mb-16"><label className="form-label">Client / reference</label><input className="form-input" type="text" placeholder="e.g. Apex Hardware"/></div>
            <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'12px',marginBottom:'16px'}}>
              <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Process stages (from design)</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
                {['1. Cut','2. Forge','3. Thread','4. Electroplate'].map(s=><span style={{background:'rgba(139,124,248,0.12)',color:'var(--purple)',fontSize:'11px',padding:'3px 8px',borderRadius:'10px'}}>{s}</span>)}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => { alert('Order created — sent to manager for approval'); setModalOpen(false); }}>Create order → send for approval</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, suffix = "", sub = "", down = false, color = "" }: {
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  down?: boolean;
  color?: "" | "amber" | "teal" | "purple" | "red" | "green";
}) {
  const colorMap: Record<string, string> = {
    "": "",
    "amber": "amber",
    "teal": "teal",
    "purple": "purple",
    "red": "red",
    "green": "teal",
  };
  return (
    <div className={`stat-card ${colorMap[color] || ""}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {suffix && <span style={{ fontSize: "14px", color: "var(--muted)" }}> {suffix}</span>}
      </div>
      {sub && (
        <div className="stat-sub">
          {sub.includes("vs last week") ? (
            <>
              <span className={down ? "down" : ""}>{sub.split("vs last week")[0]}</span>
              vs last week
            </>
          ) : (
            sub
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({ order }: { order: { id: string; design: { name: string; stages: { sequence: number; name: string }[] }; currentStage: number; targetKg: number; quantity: number }; department: string }) {
  const currentStage = order.design.stages.find((s) => s.sequence === order.currentStage);
  
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