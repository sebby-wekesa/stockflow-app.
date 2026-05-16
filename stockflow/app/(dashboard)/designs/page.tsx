import { prisma } from "@/lib/prisma"
import DesignsClient from "./DesignsClient";

export const dynamic = 'force-dynamic';

export default async function DesignsPage() {
  const designs = await prisma.design.findMany({
    include: {
      stages: {
        orderBy: { sequence: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return <DesignsClient designs={designs} />;
}