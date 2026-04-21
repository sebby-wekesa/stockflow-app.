// The Dynamic Data Store
const Store = {
  rawMaterials: [
    { id: 'mat-1', name: 'High-Tensile Steel Rod', diameter: '16mm', availableKg: 4820, threshold: 500, supplier: 'SteelCo Kenya' },
    { id: 'mat-2', name: 'Aluminum Alloy Rod', diameter: '10mm', availableKg: 1200, threshold: 800, supplier: 'AluMetals' },
    { id: 'mat-3', name: 'Stainless Steel 304', diameter: '12mm', availableKg: 340, threshold: 500, supplier: 'Nairobi Steel' }
  ],

  designs: [
    { id: 'des-1', name: 'Hex bolt M12', code: 'HB-M12', matId: 'mat-1', stages: ['Cutting', 'Forging', 'Threading'], yield: 95 },
    { id: 'des-2', name: 'Stud rod 8mm', code: 'SR-08', matId: 'mat-2', stages: ['Cutting', 'Threading'], yield: 92 }
  ],

  orders: [
    { id: 'PO-0041', designId: 'des-1', targetKg: 120, status: 'PENDING', currentDept: 'Cutting', priority: 'NORMAL' },
    { id: 'PO-0040', designId: 'des-2', targetKg: 85, status: 'IN_PRODUCTION', currentDept: 'Threading', priority: 'URGENT' }
  ],

  currentUser: JSON.parse(localStorage.getItem('stockflow_user')) || null,
  users: JSON.parse(localStorage.getItem('stockflow_db_users')) || [
    { email: 'admin@stockflow.com', password: '123', name: 'Sebby', role: 'admin' }
  ]
};

// The Multi-Screen Render Engine
const SCREENS = {
  rawmaterials: () => {
    const rows = Store.rawMaterials.map(mat => `
      <tr>
        <td><span style="font-weight:600">${mat.name}</span></td>
        <td style="font-family:var(--font-mono)">${mat.diameter}</td>
        <td class="job-kg">${mat.availableKg} kg</td>
        <td>
          <span class="badge ${mat.availableKg < mat.threshold ? 'badge-red' : 'badge-green'}">
            ${mat.availableKg < mat.threshold ? 'Low Stock' : 'Healthy'}
          </span>
        </td>
        <td><button class="btn btn-ghost btn-sm">Receive Stock</button></td>
      </tr>
    `).join('');

    return `
      <div class="section-header mb-16">
        <div class="section-title">Raw Materials</div>
        <div class="section-sub">Live inventory tracking from warehouse</div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Material Name</th><th>Size</th><th>Current Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  orders: () => {
    const rows = Store.orders.map(order => {
      // Relational Lookup: Find the design name using the designId
      const design = Store.designs.find(d => d.id === order.designId);

      return `
        <tr>
          <td style="font-family:var(--font-mono); color:var(--muted)">${order.id}</td>
          <td style="font-weight:600">${design ? design.name : 'Unknown Design'}</td>
          <td class="job-kg">${order.targetKg} kg</td>
          <td><span class="badge ${order.status === 'PENDING' ? 'badge-amber' : 'badge-purple'}">${order.status}</span></td>
          <td><span class="badge badge-muted">${order.currentDept}</span></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="card">
        <div class="section-header mb-16">
          <div class="section-title">Recent Production Orders</div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Order #</th><th>Product</th><th>Target Weight</th><th>Status</th><th>Current Dept</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  signup: () => `
    <div style="max-width: 400px; margin: 80px auto;">
      <div class="card">
        <div class="modal-title">Create Account</div>
        <p class="modal-sub">Join the StockFlow manufacturing network</p>

        <div class="form-group mb-16">
          <label class="form-label">Full Name</label>
          <input type="text" id="reg-name" class="form-input" placeholder="e.g. John Doe">
        </div>
        <div class="form-group mb-16">
          <label class="form-label">Email Address</label>
          <input type="email" id="reg-email" class="form-input" placeholder="name@company.com">
        </div>
        <div class="form-group mb-24">
          <label class="form-label">Password</label>
          <input type="password" id="reg-pass" class="form-input" placeholder="••••••••">
        </div>

        <button class="btn btn-primary w-full mb-16" onclick="Auth.signUp(
          document.getElementById('reg-name').value,
          document.getElementById('reg-email').value,
          document.getElementById('reg-pass').value
        )">Create Account</button>

        <p class="text-center" style="font-size:12px; color:var(--muted)">
          Already have an account? <span class="text-accent cursor-pointer" onclick="renderScreen('login')">Log In</span>
        </p>
      </div>
    </div>
  `
};

// The Auth Logic (Sign Up & Log Out)
const Auth = {
  signUp: (name, email, password, role = 'operator') => {
    // Check if user exists
    if (Store.users.find(u => u.email === email)) return alert("User already exists");

    const newUser = { name, email, password, role };
    Store.users.push(newUser);

    // Persist "Database"
    localStorage.setItem('stockflow_db_users', JSON.stringify(Store.users));

    alert("Account created! Please log in.");
    renderScreen('login');
  },

  login: (email, password) => {
    const user = Store.users.find(u => u.email === email && u.password === password);
    if (user) {
      Store.currentUser = user;
      localStorage.setItem('stockflow_user', JSON.stringify(user));
      switchRole(user.role); // Redirect to dashboard
    } else {
      alert("Invalid credentials");
    }
  },

  logout: () => {
    Store.currentUser = null;
    localStorage.removeItem('stockflow_user');
    location.reload(); // Hard reset to login screen
  }
};

// Logic Implementation: Real-Time Calculations
function calculateStats() {
  const totalRaw = Store.rawMaterials.reduce((acc, mat) => acc + mat.availableKg, 0);
  const activeJobs = Store.orders.filter(o => o.status === 'IN_PRODUCTION').length;

  // You would then inject these into your dashboard HTML:
  // document.getElementById('stat-raw-total').textContent = totalRaw.toLocaleString();
}

// Auto-Redirect on Page Load
window.onload = () => {
  if (!Store.currentUser) {
    renderScreen('signup'); // Default to signup if no session
    // Hide the sidebar and topbar for a clean auth experience
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.topbar').style.display = 'none';
  } else {
    switchRole(Store.currentUser.role);
  }
};

module.exports = { Store, SCREENS, Auth, calculateStats };