export function ApprovalsScreen() {
  return (
    <>
      <div className="section-header mb-16">
        <div><div className="section-title">Order approvals</div><div className="section-sub">Review specifications and release to production</div></div>
      </div>
      <div style={{padding: '40px', textAlign: 'center', color: 'var(--muted)'}}>
        No orders pending approval
      </div>
    </>
  );
}