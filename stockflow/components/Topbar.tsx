'use client';

interface TopbarProps {
  currentRole: string;
  onRoleSwitch: (role: string) => void;
}

export function Topbar({ currentRole, onRoleSwitch }: TopbarProps) {
  return (
    <div className="topbar">
      <span style={{fontSize:'11px', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'1px'}}>
        Preview role:
      </span>
      <div className="topbar-role-switcher">
        {['admin', 'manager', 'operator', 'sales', 'packaging', 'warehouse'].map(role => (
          <button
            key={role}
            className={`role-btn ${currentRole === role ? 'active' : ''}`}
            onClick={() => onRoleSwitch(role)}
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </button>
        ))}
      </div>
      <div className="topbar-right">
        <div className="notif-dot pulse"></div>
        <div className="avatar">JM</div>
      </div>
    </div>
  );
}