"use client";

import { useState, useEffect } from "react";
import { Role } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/Modal";

interface DashboardData {
  rawMaterialStock: number;
  activeOrders: number;
  finishedGoods: number;
  scrapThisWeek: number;
  pendingApprovals: number;
  recentOrders: any[];
  departmentScrap: any[];
  throughput: any[];
}

// Screen components will be implemented below
function DashboardScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Mock data for now - in production, fetch from API
      const mockData: DashboardData = {
        rawMaterialStock: 4820,
        activeOrders: 12,
        finishedGoods: 1340,
        scrapThisWeek: 82,
        pendingApprovals: 3,
        recentOrders: [
          { id: "PO-0041", design: "Hex bolt M12", kg: 120, status: "PENDING", dept: null },
          { id: "PO-0040", design: "Stud rod 8mm", kg: 85, status: "IN_PRODUCTION", dept: "Threading" },
          { id: "PO-0039", design: "Anchor bolt", kg: 200, status: "IN_PRODUCTION", dept: "Electroplate" },
          { id: "PO-0038", design: "Hex bolt M10", kg: 60, status: "COMPLETED", dept: "Done" },
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
      setData(mockData);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading || !data) {
    return <div className="card"><p>Loading...</p></div>;
  }

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
        <div className="stat-card amber">
          <div className="stat-label">Raw material stock</div>
          <div className="stat-value">{data.rawMaterialStock.toLocaleString()}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub">3 materials · <span>+200 kg today</span></div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Active production orders</div>
          <div className="stat-value">{data.activeOrders}</div>
          <div className="stat-sub">{data.pendingApprovals} pending approval · <span>{data.activeOrders - data.pendingApprovals} in production</span></div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">Finished goods ready</div>
          <div className="stat-value">{data.finishedGoods.toLocaleString()}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub"><span>247 units</span> across 6 designs</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Scrap this week</div>
          <div className="stat-value">{data.scrapThisWeek}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
          <div className="stat-sub"><span className="down">↑ 12 kg</span> vs last week</div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Recent production orders</div><button className="btn btn-ghost btn-sm" onClick={() => navigate('orders')}>View all</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Design</th><th>Kg reserved</th><th>Status</th><th>Dept</th></tr></thead>
              <tbody>
                {data.recentOrders.map(order => (
                  <tr key={order.id}>
                    <td><span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>{order.id}</span></td>
                    <td>{order.design}</td>
                    <td><span className="job-kg">{order.kg} kg</span></td>
                    <td><span className={`badge ${order.status === 'PENDING' ? 'badge-amber' : order.status === 'IN_PRODUCTION' ? 'badge-purple' : 'badge-green'}`}>{order.status === 'PENDING' ? 'Pending approval' : order.status === 'IN_PRODUCTION' ? 'In production' : 'Complete'}</span></td>
                    <td>{order.dept || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="section-header mb-16"><div className="section-title">Scrap by department</div><div style={{fontSize:'11px',color:'var(--muted)'}}>This week</div></div>
          {data.departmentScrap.map(item => {
            const cls = item.pct > 10 ? 'bad' : item.pct > 5 ? 'warn' : 'good';
            return <div key={item.dept} className="scrap-bar-wrap"><div className="scrap-bar-label"><span>{item.dept}</span><span>{item.kg} kg · {item.pct}%</span></div><div className="scrap-bar"><div className={`scrap-bar-fill ${cls}`} style={{width:`${item.pct*4}%`}}></div></div></div>;
          })}
        </div>
      </div>

      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Department throughput — today</div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Department</th><th>Jobs active</th><th>Kg processed</th><th>Kg scrap</th><th>Yield</th><th>Operators</th></tr></thead>
            <tbody>
              {data.throughput.map(dept => (
                <tr key={dept.dept}>
                  <td>{dept.dept}</td>
                  <td>{dept.jobs}</td>
                  <td><span className="job-kg">{dept.kg} kg</span></td>
                  <td>{dept.scrap} kg</td>
                  <td><span className={`badge ${dept.yield < 70 ? 'badge-red' : dept.yield < 90 ? 'badge-amber' : 'badge-green'}`}>{dept.yield}%</span></td>
                  <td>{dept.ops}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DesignsScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Design templates</div><div className="section-sub">Standardised product designs with process stages and dimensions</div></div>
        <button className="btn btn-primary" onClick={() => { setModalContent('new_design'); setModalOpen(true); }}>+ New design</button>
      </div>
      <div className="grid-3 mb-24">
        {[
          {name:'Hex bolt M12',code:'HB-M12',stages:['Cut','Forge','Thread','Plate'],dims:'M12 × 60mm',yield:'88%',mat:'Steel rod 16mm'},
          {name:'Stud rod 8mm',code:'SR-08',stages:['Cut','Thread','Lock'],dims:'8mm × 120mm',yield:'93%',mat:'Steel rod 10mm'},
          {name:'Anchor bolt',code:'AB-16',stages:['Cut','Forge','Chamfer','Thread','Drill','Plate'],dims:'M16 × 150mm',yield:'82%',mat:'Steel rod 20mm'},
          {name:'Hex bolt M10',code:'HB-M10',stages:['Cut','Thread','Plate'],dims:'M10 × 50mm',yield:'91%',mat:'Steel rod 14mm'},
          {name:'Foundation bolt',code:'FB-20',stages:['Cut','Forge','Thread','Lock','Plate'],dims:'M20 × 200mm',yield:'85%',mat:'Steel rod 25mm'},
          {name:'Machine screw',code:'MS-06',stages:['Cut','Chamfer','Thread','Grind'],dims:'M6 × 30mm',yield:'95%',mat:'Steel rod 8mm'},
        ].map(d => (
          <div className="card" style={{cursor:'pointer'}} onClick={() => { setModalContent('view_design'); setModalOpen(true); }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <div>
                <div style={{fontFamily:'var(--font-head)',fontSize:'15px',fontWeight:'700'}}>{d.name}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--muted)',marginTop:'2px'}}>{d.code}</div>
              </div>
              <span className="badge badge-green">{d.yield} yield</span>
            </div>
            <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'8px'}}>Material: {d.mat}</div>
            <div style={{fontSize:'11px',color:'var(--muted)',marginBottom:'10px'}}>Dims: {d.dims}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
              {d.stages.map((s,i) => <span style={{background:'rgba(139,124,248,0.12)',color:'var(--purple)',fontSize:'10px',padding:'2px 7px',borderRadius:'10px',fontWeight:'500'}}>{i+1}. {s}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalsScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Order approvals</div><div className="section-sub">Review specifications and release to production</div></div>
      </div>
      {[
        {id:'PO-0041',design:'Hex bolt M12',qty:'500 units',kg:'120 kg',mat:'Steel rod 16mm · 120 kg reserved',client:'Apex Hardware',specs:'M12 × 60mm, hot-dip galvanised'},
        {id:'PO-0043',design:'Foundation bolt',qty:'200 units',kg:'240 kg',mat:'Steel rod 25mm · 240 kg reserved',client:'BuildPro Ltd',specs:'M20 × 200mm, zinc plated'},
        {id:'PO-0044',design:'Machine screw',qty:'1000 units',kg:'45 kg',mat:'Steel rod 8mm · 45 kg reserved',client:'Mech Supplies',specs:'M6 × 30mm, plain'},
      ].map(o => (
        <div className="approval-card">
          <div className="approval-header">
            <div>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--muted)'}}>{o.id}</span>
              <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:'700',margin:'4px 0'}}>{o.design}</div>
              <div style={{fontSize:'12px',color:'var(--muted)'}}>{o.client}</div>
            </div>
            <span className="badge badge-amber">Pending approval</span>
          </div>
          <div className="grid-2" style={{gap:'10px',marginBottom:'2px'}}>
            <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Quantity</div><div style={{fontWeight:'600',marginTop:'3px'}}>{o.qty}</div></div>
            <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Kg reserved</div><div style={{fontFamily:'var(--font-mono)',fontWeight:'600',marginTop:'3px',color:'var(--accent)'}}>{o.kg}</div></div>
            <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Material</div><div style={{fontSize:'12px',marginTop:'3px'}}>{o.mat}</div></div>
            <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Specifications</div><div style={{fontSize:'12px',marginTop:'3px'}}>{o.specs}</div></div>
          </div>
          <div className="approval-actions">
            <button className="btn btn-teal" onClick={() => alert('Order approved — released to Cutting dept')}>Approve & release</button>
            <button className="btn btn-ghost">Edit specs</button>
            <button className="btn btn-red btn-sm" style={{marginLeft:'auto'}} onClick={() => alert('Order rejected')}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function OperatorQueueScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Cutting dept — job queue</div><div className="section-sub">Jobs ready for your department</div></div>
      </div>
      <div className="job-card urgent" onClick={() => navigate('operator_log')}>
        <div className="job-header">
          <span className="job-id">PO-0040 · Stage 1/3</span>
          <span className="badge badge-red">Urgent</span>
        </div>
        <div className="job-design">Stud rod 8mm — Cut to 120mm</div>
        <div className="job-meta" style={{marginTop:'8px'}}>
          <span>Received: <span className="job-kg">85 kg</span></span>
          <span>Target dims: 8mm × 120mm</span>
          <span>Client: BuildPro Ltd</span>
        </div>
      </div>
      <div className="job-card inprog" onClick={() => navigate('operator_log')}>
        <div className="job-header">
          <span className="job-id">PO-0039 · Stage 1/6</span>
          <span className="badge badge-amber">In progress</span>
        </div>
        <div className="job-design">Anchor bolt — Cut to 170mm</div>
        <div className="job-meta" style={{marginTop:'8px'}}>
          <span>Received: <span className="job-kg">200 kg</span></span>
          <span>Target dims: 16mm × 170mm</span>
          <span>Client: Apex Hardware</span>
        </div>
      </div>
      <div className="job-card">
        <div className="job-header">
          <span className="job-id">PO-0045 · Stage 1/4</span>
          <span className="badge badge-muted">Queued</span>
        </div>
        <div className="job-design">Hex bolt M12 — Cut to 70mm</div>
        <div className="job-meta" style={{marginTop:'8px'}}>
          <span>Received: <span className="job-kg">120 kg</span></span>
          <span>Target dims: 12mm × 70mm</span>
          <span>Client: Mech Supplies</span>
        </div>
      </div>
    </div>
  );
}

function OperatorLogScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  const [kgOut, setKgOut] = useState('');
  const [kgScrap, setKgScrap] = useState('');
  const kgIn = 85;

  const total = (parseFloat(kgOut) || 0) + (parseFloat(kgScrap) || 0);
  const isValid = !kgOut && !kgScrap ? null : Math.abs(total - kgIn) < 0.01;

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Log stage output</div><div className="section-sub">PO-0040 · Stud rod 8mm · Cutting stage</div></div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('operator_queue')}>← Back to queue</button>
      </div>
      <div className="card mb-16">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px'}}>
          <div>
            <div style={{fontSize:'11px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>Job details</div>
            <div style={{fontFamily:'var(--font-head)',fontSize:'17px',fontWeight:'700',marginTop:'4px'}}>Stud rod 8mm — Cutting</div>
          </div>
          <span className="badge badge-amber">In progress</span>
        </div>
        <div className="grid-3" style={{gap:'10px',marginBottom:'14px'}}>
          <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>KG RECEIVED</div><div style={{fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--accent)',marginTop:'4px'}}>{kgIn} kg</div></div>
          <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>TARGET DIMS</div><div style={{fontSize:'13px',marginTop:'4px'}}>8mm × 120mm</div></div>
          <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>NEXT DEPT</div><div style={{fontSize:'13px',marginTop:'4px',color:'var(--purple)'}}>Threading</div></div>
        </div>
        <div style={{fontSize:'10px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>Stage progress</div>
        <div className="kg-trail">
          <div className="kg-stage done"><div className="kg-stage-name">Received</div><div className="kg-stage-val">{kgIn} kg</div></div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage active"><div className="kg-stage-name">Cutting</div><div className="kg-stage-val">— kg</div></div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage"><div className="kg-stage-name">Threading</div><div className="kg-stage-val">—</div></div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage"><div className="kg-stage-name">Locking</div><div className="kg-stage-val">—</div></div>
          <div className="kg-arrow">→</div>
          <div className="kg-stage"><div className="kg-stage-name">Finished</div><div className="kg-stage-val">—</div></div>
        </div>
      </div>
      <div className="log-form">
        <div style={{fontSize:'13px',fontWeight:'600',marginBottom:'4px'}}>Record cutting output</div>
        <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'14px'}}>Kg in must equal kg passed forward + kg scrap</div>
        <div className="kg-inputs">
          <div className="kg-input-group"><label>Kg in (received)</label><input type="number" value={kgIn} readOnly style={{opacity:'0.6'}}/></div>
          <div className="kg-input-group output"><label>Kg out (to threading)</label><input type="number" value={kgOut} onChange={(e) => setKgOut(e.target.value)} placeholder="0"/></div>
          <div className="kg-input-group scrap"><label>Kg scrap</label><input type="number" value={kgScrap} onChange={(e) => setKgScrap(e.target.value)} placeholder="0"/></div>
        </div>
        <div className={`kg-balance ${isValid === null ? '' : isValid ? 'valid' : 'invalid'}`}>
          {isValid === null ? 'Enter kg out and scrap to verify balance' : isValid ? `✓ Balanced — ${kgOut} kg forward + ${kgScrap} kg scrap = ${kgIn} kg` : `✗ Mismatch — ${kgOut} + ${kgScrap} = ${total} kg (expected ${kgIn} kg)`}
        </div>
        <div style={{marginTop:'14px',display:'flex',gap:'10px'}}>
          <button className="btn btn-primary" onClick={() => { if (isValid) { alert(`Stage complete!\n\n${kgOut} kg passed to Threading dept\n${kgScrap} kg logged as scrap\n\nThreading dept notified.`); navigate('operator_queue'); } else { alert('Please ensure kg out + kg scrap = ' + kgIn + ' kg before completing the stage.'); } }}>Mark stage complete → send to threading</button>
          <button className="btn btn-ghost">Save draft</button>
        </div>
      </div>
    </div>
  );
}

function CatalogueScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Available stock</div><div className="section-sub">Finished goods ready to order</div></div>
      </div>
      <div className="product-grid">
        {[
          {name:'Hex bolt M12',code:'HB-M12',kg:340,units:120,desc:'M12 × 60mm · Hot-dip galvanised'},
          {name:'Stud rod 8mm',code:'SR-08',kg:180,units:65,desc:'8mm × 120mm · Plain finish'},
          {name:'Anchor bolt',code:'AB-16',kg:520,units:62,desc:'M16 × 150mm · Zinc plated'},
          {name:'Hex bolt M10',code:'HB-M10',kg:95,units:45,desc:'M10 × 50mm · Hot-dip galvanised'},
          {name:'Foundation bolt',code:'FB-20',kg:205,units:30,desc:'M20 × 200mm · Zinc plated'},
        ].map(p => (
          <div className="product-card" onClick={() => { setModalContent('place_order_modal'); setModalOpen(true); }}>
            <div className="product-name">{p.name}</div>
            <div className="product-code">{p.code}</div>
            <div style={{fontSize:'12px',color:'var(--muted)'}}>{p.desc}</div>
            <div className="product-stock">
              <div><div className="product-kg">{p.kg} kg</div><div className="product-unit">{p.units} units in stock</div></div>
              <button className="btn btn-teal btn-sm">Order</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PackQueueScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Packaging queue</div><div className="section-sub">Sale orders awaiting fulfilment</div></div>
      </div>
      {[
        {id:'SO-0091',product:'Hex bolt M12',qty:'50 units · 140 kg',client:'Apex Hardware',priority:'high',date:'Today · 09:14'},
        {id:'SO-0090',product:'Anchor bolt',qty:'20 units · 167 kg',client:'BuildPro Ltd',priority:'high',date:'Today · 08:51'},
        {id:'SO-0089',product:'Stud rod 8mm',qty:'30 units · 83 kg',client:'Mech Supplies',priority:'normal',date:'Yesterday · 16:30'},
        {id:'SO-0088',product:'Hex bolt M10',qty:'45 units · 95 kg',client:'Apex Hardware',priority:'normal',date:'Yesterday · 14:20'},
        {id:'SO-0087',product:'Foundation bolt',qty:'10 units · 68 kg',client:'KenSteel Ltd',priority:'normal',date:'Yesterday · 11:05'},
      ].map(o => (
        <div className="pack-card">
          <div className="pack-priority" style={{background:o.priority==='high'?'var(--red)':'var(--border2)'}}></div>
          <div className="pack-info">
            <div className="pack-order">{o.id} · {o.date}</div>
            <div className="pack-product">{o.product}</div>
            <div className="pack-detail">{o.qty} · {o.client}</div>
          </div>
          <div className="pack-actions">
            {o.priority==='high'?<span className="badge badge-red">Priority</span>:''}
            <button className="btn btn-teal btn-sm" onClick={() => alert('Order ' + o.id + ' marked as fulfilled')}>Mark fulfilled</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RawMaterialsScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Raw materials</div><div className="section-sub">Current stock levels in kg</div></div>
        <button className="btn btn-primary" onClick={() => navigate('receive')}>+ Receive stock</button>
      </div>
      <div className="stats-grid mb-24" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        {[
          {name:'Steel rod 16mm',kg:'1,840',reserved:'960',free:'880',trend:'teal'},
          {name:'Steel rod 20mm',kg:'1,420',reserved:'640',free:'780',trend:'teal'},
          {name:'Steel rod 25mm',kg:'1,560',reserved:'1,200',free:'360',trend:'amber'},
        ].map(m => (
          <div className={`stat-card ${m.trend}`}>
            <div className="stat-label">{m.name}</div>
            <div className="stat-value">{m.kg}<span style={{fontSize:'14px',color:'var(--muted)'}}> kg</span></div>
            <div className="stat-sub"><span>{m.free} kg free</span> · {m.reserved} kg reserved</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="section-header mb-16"><div className="section-title">Receipt history</div></div>
        <table>
          <thead><tr><th>Date</th><th>Material</th><th>Kg received</th><th>Reference</th><th>Logged by</th></tr></thead>
          <tbody>
            <tr><td>25 Mar 2026</td><td>Steel rod 16mm</td><td><span className="job-kg">200 kg</span></td><td>GRN-2241</td><td>Warehouse</td></tr>
            <tr><td>24 Mar 2026</td><td>Steel rod 25mm</td><td><span className="job-kg">500 kg</span></td><td>GRN-2240</td><td>Warehouse</td></tr>
            <tr><td>23 Mar 2026</td><td>Steel rod 20mm</td><td><span className="job-kg">300 kg</span></td><td>GRN-2239</td><td>Warehouse</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReceiveScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Receive raw materials</div><div className="section-sub">Log incoming stock into warehouse</div></div>
      </div>
      <div className="card" style={{maxWidth:'560px'}}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Material type</label><select className="form-input"><option>Steel rod 16mm</option><option>Steel rod 20mm</option><option>Steel rod 25mm</option></select></div>
          <div className="form-group"><label className="form-label">Quantity (kg)</label><input type="number" className="form-input" placeholder="e.g. 200"/></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">GRN / Reference</label><input type="text" className="form-input" placeholder="e.g. GRN-2242"/></div>
          <div className="form-group"><label className="form-label">Supplier</label><select className="form-input"><option>Steel Masters Ltd</option><option>KenSteel Supply</option></select></div>
        </div>
        <div className="form-group mb-16"><label className="form-label">Notes</label><input type="text" className="form-input" placeholder="Optional"/></div>
        <button className="btn btn-primary" onClick={() => alert('Stock received and logged')}>Confirm receipt</button>
      </div>
    </div>
  );
}

function FinishedGoodsScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Finished goods</div><div className="section-sub">Stock ready for sale</div></div>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Design</th><th>Code</th><th>Units</th><th>Total kg</th><th>Kg/unit</th><th>Production order</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Hex bolt M12</td><td><span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>HB-M12</span></td><td>120</td><td><span className="job-kg">340 kg</span></td><td>2.83 kg</td><td>PO-0038</td><td><span className="badge badge-teal">Available</span></td></tr>
            <tr><td>Stud rod 8mm</td><td><span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>SR-08</span></td><td>65</td><td><span className="job-kg">180 kg</span></td><td>2.77 kg</td><td>PO-0036</td><td><span className="badge badge-teal">Available</span></td></tr>
            <tr><td>Anchor bolt</td><td><span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>AB-16</span></td><td>62</td><td><span className="job-kg">520 kg</span></td><td>8.39 kg</td><td>PO-0035</td><td><span className="badge badge-teal">Available</span></td></tr>
            <tr><td>Hex bolt M10</td><td><span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>HB-M10</span></td><td>45</td><td><span className="job-kg">95 kg</span></td><td>2.11 kg</td><td>PO-0034</td><td><span className="badge badge-teal">Available</span></td></tr>
            <tr><td>Foundation bolt</td><td><span style={{fontFamily:'var(--font-mono)',color:'var(--muted)'}}>FB-20</span></td><td>30</td><td><span className="job-kg">205 kg</span></td><td>6.83 kg</td><td>PO-0033</td><td><span className="badge badge-amber">Partial reserve</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersScreen({ navigate, setModalContent, setModalOpen }: { navigate: (screen: string) => void; setModalContent: (content: string) => void; setModalOpen: (open: boolean) => void }) {
  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Users & roles</div><div className="section-sub">Manage team access and department assignments</div></div>
        <button className="btn btn-primary">+ Invite user</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>James Mwangi</td><td style={{color:'var(--muted)'}}>james@co.ke</td><td><span className="badge badge-amber">Admin</span></td><td>All</td><td><span className="badge badge-green">Active</span></td></tr>
            <tr><td>Sarah Otieno</td><td style={{color:'var(--muted)'}}>sarah@co.ke</td><td><span className="badge badge-amber">Manager</span></td><td>All</td><td><span className="badge badge-green">Active</span></td></tr>
            <tr><td>Peter Njoroge</td><td style={{color:'var(--muted)'}}>peter@co.ke</td><td><span className="badge badge-purple">Operator</span></td><td>Cutting</td><td><span className="badge badge-green">Active</span></td></tr>
            <tr><td>Alice Kamau</td><td style={{color:'var(--muted)'}}>alice@co.ke</td><td><span className="badge badge-purple">Operator</span></td><td>Cutting, Threading</td><td><span className="badge badge-green">Active</span></td></tr>
            <tr><td>David Wekesa</td><td style={{color:'var(--muted)'}}>david@co.ke</td><td><span className="badge badge-purple">Operator</span></td><td>Electroplating</td><td><span className="badge badge-green">Active</span></td></tr>
            <tr><td>Grace Akinyi</td><td style={{color:'var(--muted)'}}>grace@co.ke</td><td><span className="badge badge-teal">Sales</span></td><td>—</td><td><span className="badge badge-green">Active</span></td></tr>
            <tr><td>Tom Ochieng</td><td style={{color:'var(--muted)'}}>tom@co.ke</td><td><span className="badge badge-green">Packaging</span></td><td>—</td><td><span className="badge badge-green">Active</span></td></tr>
            <tr><td>Faith Muthoni</td><td style={{color:'var(--muted)'}}>faith@co.ke</td><td><span className="badge badge-muted">Warehouse</span></td><td>—</td><td><span className="badge badge-green">Active</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const screens = {
  dashboard: DashboardScreen,
  designs: DesignsScreen,
  approvals: ApprovalsScreen,
  operator_queue: OperatorQueueScreen,
  operator_log: OperatorLogScreen,
  catalogue: CatalogueScreen,
  pack_queue: PackQueueScreen,
  rawmaterials: RawMaterialsScreen,
  receive: ReceiveScreen,
  finishedgoods: FinishedGoodsScreen,
  users: UsersScreen,
  // Add other screens as needed
};

export default function DashboardPage() {
  const [currentRole, setCurrentRole] = useState<Role>('ADMIN');
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  const navigate = (screen: string) => {
    setCurrentScreen(screen);
  };

  useEffect(() => {
    if (currentScreen === 'dashboard' && !dashboardData) {
      fetchDashboardData();
    }
  }, [currentScreen]);

  const fetchDashboardData = async () => {
    try {
      // For now, use mock data. In a real implementation, fetch from APIs
      const mockData = {
        rawMaterialStock: 4820,
        activeOrders: 12,
        finishedGoods: 1340,
        scrapThisWeek: 82,
        pendingApprovals: 3,
        recentOrders: [
          { id: "PO-0041", design: "Hex bolt M12", kg: 120, status: "PENDING", dept: null },
          { id: "PO-0040", design: "Stud rod 8mm", kg: 85, status: "IN_PRODUCTION", dept: "Threading" },
          { id: "PO-0039", design: "Anchor bolt", kg: 200, status: "IN_PRODUCTION", dept: "Electroplate" },
          { id: "PO-0038", design: "Hex bolt M10", kg: 60, status: "COMPLETED", dept: "Done" },
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
      setDashboardData(mockData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const ScreenComponent = screens[currentScreen] || (() => <div className="card"><p style={{color:'var(--muted)'}}>Screen: {currentScreen}</p></div>);

  return (
    <div className="app">
      <Sidebar
        user={{ role: currentRole, name: 'Test User' }}
        currentRole={currentRole.toLowerCase()}
        currentScreen={currentScreen}
        onNavigate={navigate}
      />
      <div className="main">
        <div className="topbar">
          <span style={{fontSize:'11px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px'}}>Preview role:</span>
          <div className="topbar-role-switcher">
            <button className={`role-btn ${currentRole === "ADMIN" ? "active" : ""}`} onClick={() => setCurrentRole("ADMIN")}>Admin</button>
            <button className={`role-btn ${currentRole === "MANAGER" ? "active" : ""}`} onClick={() => setCurrentRole("MANAGER")}>Manager</button>
            <button className={`role-btn ${currentRole === "OPERATOR" ? "active" : ""}`} onClick={() => setCurrentRole("OPERATOR")}>Operator</button>
            <button className={`role-btn ${currentRole === "SALES" ? "active" : ""}`} onClick={() => setCurrentRole("SALES")}>Sales</button>
            <button className={`role-btn ${currentRole === "PACKAGING" ? "active" : ""}`} onClick={() => setCurrentRole("PACKAGING")}>Packaging</button>
            <button className={`role-btn ${currentRole === "WAREHOUSE" ? "active" : ""}`} onClick={() => setCurrentRole("WAREHOUSE")}>Warehouse</button>
          </div>
          <div className="topbar-right">
            <div className="notif-dot pulse"></div>
            <div className="avatar">TU</div>
          </div>
        </div>
        <div className="content">
          <ScreenComponent navigate={navigate} setModalContent={setModalContent} setModalOpen={setModalOpen} />
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
        {modalContent === 'new_design' && (
          <div>
            <div className="modal-title">New design template</div>
            <div className="modal-sub">Define process stages, dimensions and expected yield</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Design name</label><input className="form-input" placeholder="e.g. Hex bolt M14"/></div>
              <div className="form-group"><label className="form-label">Design code</label><input className="form-input" placeholder="e.g. HB-M14"/></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Raw material</label><select className="form-input"><option>Steel rod 16mm</option><option>Steel rod 20mm</option><option>Steel rod 25mm</option></select></div>
              <div className="form-group"><label className="form-label">Target dimensions</label><input className="form-input" placeholder="e.g. M14 × 70mm"/></div>
            </div>
            <div className="form-group" style={{marginBottom:'10px'}}><label className="form-label">Select process stages (in order)</label></div>
            <div className="stage-builder" id="stage-builder">
              {['Cutting','Chamfering','Forging','Skimming','Threading','Locking','Electroplating','Drilling','Grinding'].map((s,i) => (
                <div className="stage-chip off" key={i} id={`chip-${i}`} onClick={() => toggleChip(i,'${s}')}>
                  <span className="chip-num" id={`cn-${i}`}>·</span>{s}
                </div>
              ))}
            </div>
            <div className="form-row" style={{marginTop:'14px'}}>
              <div className="form-group"><label className="form-label">Expected yield (%)</label><input className="form-input" type="number" placeholder="e.g. 88"/></div>
              <div className="form-group"><label className="form-label">Kg per finished unit</label><input className="form-input" type="number" placeholder="e.g. 2.83"/></div>
            </div>
            <button className="btn btn-primary" style={{marginTop:'6px'}} onClick={() => { alert('Design saved'); setModalOpen(false); }}>Save design</button>
          </div>
        )}
        {modalContent === 'view_design' && (
          <div>
            <div className="modal-title">Hex bolt M12</div>
            <div className="modal-sub" style={{fontFamily:'var(--font-mono)'}}>HB-M12 · Steel rod 16mm · M12 × 60mm</div>
            <div className="grid-2" style={{gap:'10px',marginBottom:'16px'}}>
              <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>EXPECTED YIELD</div><div style={{fontWeight:'600',color:'var(--teal)',marginTop:'3px'}}>88%</div></div>
              <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>KG PER UNIT</div><div style={{fontFamily:'var(--font-mono)',marginTop:'3px'}}>2.83 kg</div></div>
            </div>
            <div style={{fontSize:'11px',color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'8px'}}>Process stages</div>
            {['Cutting — 12mm rod → 70mm length','Forging — head formation','Threading — M12 thread cut','Electroplating — hot-dip galvanise'].map((s,i)=>(
              <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',background:'var(--surface2)',borderRadius:'var(--radius-sm)',marginBottom:'6px'}}>
                <span style={{width:'20px',height:'20px',borderRadius:'50%',background:'rgba(139,124,248,0.2)',color:'var(--purple)',fontSize:'10px',fontWeight:'700',display:'flex',alignItems:'center',justifyContent:'center'}}>{i+1}</span>
                <span style={{fontSize:'13px'}}>{s}</span>
                <span className="badge badge-purple" style={{marginLeft:'auto'}}>{['Cutting','Forging','Threading','Electroplating'][i]} dept</span>
              </div>
            ))}
            <button className="btn btn-ghost" style={{marginTop:'10px'}} onClick={() => setModalOpen(false)}>Close</button>
          </div>
        )}
        {modalContent === 'place_order_modal' && (
          <div>
            <div className="modal-title">Place sale order</div>
            <div className="modal-sub">Hex bolt M12 — 120 units / 340 kg available</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Quantity (units)</label><input className="form-input" type="number" placeholder="max 120"/></div>
              <div className="form-group"><label className="form-label">Client</label><input className="form-input" placeholder="Client name"/></div>
            </div>
            <div className="form-group mb-16"><label className="form-label">Notes</label><input className="form-input" placeholder="Optional delivery notes"/></div>
            <button className="btn btn-teal" onClick={() => { alert('Order placed — sent to packaging queue'); setModalOpen(false); }}>Place order → packaging</button>
          </div>
        )}
      </Modal>
    </div>
  );
}