import { getTenantPrisma } from "@/lib/tenant-prisma"
import { requireActiveAuth } from "@/lib/auth"
import DesignsClient from "./DesignsClient";

export const dynamic = 'force-dynamic';

export default async function DesignsPage() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const designs = await db.design.findMany({
    include: {
      stages: {
        orderBy: { sequence: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return <DesignsClient designs={designs} />;
}