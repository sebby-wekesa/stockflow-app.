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

  const plainDesigns = designs.map((design) => ({
    ...design,
    targetWeight: design.targetWeight == null ? null : Number(design.targetWeight),
    createdAt: design.createdAt.toISOString(),
    updatedAt: design.updatedAt.toISOString(),
    lastSeenAt: design.lastSeenAt?.toISOString() ?? null,
    stages: design.stages.map((stage) => ({
      ...stage,
      createdAt: stage.createdAt.toISOString(),
      updatedAt: stage.updatedAt.toISOString(),
    })),
  }));

  return <DesignsClient designs={plainDesigns} />;
}
