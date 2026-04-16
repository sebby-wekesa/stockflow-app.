import { Metadata } from 'next'
import { ManagerApprovalQueue } from '@/components/ManagerApprovalQueue'
import { requireRole } from '@/lib/auth'
import { Toast } from '@/components/Toast'

export const metadata: Metadata = {
  title: 'Manager Approval Queue | StockFlow',
  description: 'Review and approve pending production orders',
}

export default async function ApprovalsPage() {
  // Verify user is admin
  let userRole = null
  try {
    const user = await requireRole('ADMIN')
    userRole = user.role
  } catch (error) {
    // User is not authorized, but we'll let the component handle the UI feedback
  }

  return (
    <div>
      <div className="section-header mb-16">
        <div>
          <div className="section-title">Order approvals</div>
          <div className="section-sub">Review specifications and release to production</div>
        </div>
      </div>
      {userRole ? (
        <div>
          {[
            {id:'PO-0041',design:'Hex bolt M12',qty:'500 units',kg:'120 kg',mat:'Steel rod 16mm · 120 kg reserved',client:'Apex Hardware',specs:'M12 × 60mm, hot-dip galvanised'},
            {id:'PO-0043',design:'Foundation bolt',qty:'200 units',kg:'240 kg',mat:'Steel rod 25mm · 240 kg reserved',client:'BuildPro Ltd',specs:'M20 × 200mm, zinc plated'},
            {id:'PO-0044',design:'Machine screw',qty:'1000 units',kg:'45 kg',mat:'Steel rod 8mm · 45 kg reserved',client:'Mech Supplies',specs:'M6 × 30mm, plain'},
          ].map(o => (
            <div key={o.id} className="approval-card">
              <div className="approval-header">
                <div>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--muted)'}}>{o.id}</span>
                  <div style={{fontFamily:'var(--font-head)',fontSize:'16px',fontWeight:'700',margin:'4px 0'}}>{o.design}</div>
                  <div style={{fontSize:'12px',color:'var(--muted)'}}>{o.client}</div>
                </div>
                <span className="badge badge-amber">Pending approval</span>
              </div>
              <div className="grid-2" style={{gap:'10px',marginBottom:'2px'}}>
                <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>Quantity</div><div style={{fontWeight:'600',marginTop:'3px'}}>{o.qty}</div></div>
                <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>Kg reserved</div><div style={{fontFamily:'var(--font-mono)',marginTop:'3px',color:'var(--accent)'}}>{o.kg}</div></div>
                <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>Material</div><div style={{fontSize:'12px',marginTop:'3px'}}>{o.mat}</div></div>
                <div className="card-sm"><div style={{fontSize:'10px',color:'var(--muted)'}}>Specifications</div><div style={{fontSize:'12px',marginTop:'3px'}}>{o.specs}</div></div>
              </div>
              <div className="approval-actions">
                <button className="btn btn-teal" onClick={() => alert('Order approved — released to Cutting dept')}>Approve & release</button>
                <button className="btn btn-ghost">Edit specs</button>
                <button className="btn btn-red btn-sm" style={{marginLeft:'auto'}} onClick={() => alert('Order rejected')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <p className="text-muted text-sm">You don't have permission to view this page.</p>
        </div>
      )}
    </div>
  )
}