export const dynamic = 'force-dynamic';

import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";

export default async function AdminDashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/unauthorized");

  return <AdminDashboard user={user} />;
}
