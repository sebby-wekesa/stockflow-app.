import { RoleGuard } from "@/components/RoleGuard";
import OperatorDashboard from "./OperatorDashboard";

export default function OperatorPage() {
  return (
    <RoleGuard allowedRoles={['OPERATOR', 'ADMIN']}>
      <OperatorDashboard />
    </RoleGuard>
  );
}