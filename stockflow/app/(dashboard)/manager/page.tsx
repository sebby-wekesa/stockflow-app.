import { RoleGuard } from "@/components/RoleGuard";
import ManagerContent from "./ManagerContent";

export default function ManagerDashboardPage() {
  return (
    <RoleGuard allowedRoles={['MANAGER', 'ADMIN']}>
      <ManagerContent />
    </RoleGuard>
  );
}