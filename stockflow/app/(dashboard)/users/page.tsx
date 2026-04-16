export default function UsersPage() {
  const users = [
    {name:'James Mwangi',email:'james@co.ke',role:'Admin',dept:'All',status:'Active'},
    {name:'Sarah Otieno',email:'sarah@co.ke',role:'Manager',dept:'All',status:'Active'},
    {name:'Peter Njoroge',email:'peter@co.ke',role:'Operator',dept:'Cutting',status:'Active'},
    {name:'Alice Kamau',email:'alice@co.ke',role:'Operator',dept:'Cutting, Threading',status:'Active'},
    {name:'David Wekesa',email:'david@co.ke',role:'Operator',dept:'Electroplating',status:'Active'},
    {name:'Grace Akinyi',email:'grace@co.ke',role:'Sales',dept:'—',status:'Active'},
    {name:'Tom Ochieng',email:'tom@co.ke',role:'Packaging',dept:'—',status:'Active'},
    {name:'Faith Muthoni',email:'faith@co.ke',role:'Warehouse',dept:'—',status:'Active'},
  ];

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
            {users.map(u => (
              <tr key={u.email}>
                <td>{u.name}</td>
                <td style={{color:'var(--muted)'}}>{u.email}</td>
                <td><span className={`badge ${u.role === 'Admin' ? 'badge-amber' : u.role === 'Manager' ? 'badge-amber' : u.role === 'Operator' ? 'badge-purple' : u.role === 'Sales' ? 'badge-teal' : u.role === 'Packaging' ? 'badge-green' : 'badge-muted'}`}>{u.role}</span></td>
                <td>{u.dept}</td>
                <td><span className="badge badge-green">{u.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}