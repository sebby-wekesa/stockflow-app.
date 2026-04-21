export function UsersScreen() {
  return (
    <>
      <div className="section-header mb-16">
        <div><div className="section-title">Users & roles</div><div className="section-sub">Manage team access and department assignments</div></div>
        <button className="btn btn-primary" onClick={() => alert('Invite user modal would open')}>+ Invite user</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td colSpan={5} style={{textAlign: 'center', color: 'var(--muted)', padding: '40px'}}>No users to display</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}