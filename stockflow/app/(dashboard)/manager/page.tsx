import { RoleGuard } from "@/components/RoleGuard";
import ManagerDashboard from "@/components/ManagerDashboard";

export default function ManagerDashboardPage() {
  return (
    <RoleGuard allowedRoles={['MANAGER', 'ADMIN']}>
      <ManagerDashboard />
    </RoleGuard>
  );
}
