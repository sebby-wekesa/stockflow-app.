import { prisma } from "@/lib/prisma"
import CatalogueClient from "./CatalogueClient";

export const dynamic = 'force-dynamic';

export default async function CataloguePage() {
  const products = await prisma.finishedGoods.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      design: true
    },
    orderBy: { createdAt: 'desc' }
  });

  // Map unitCost → price for client component compatibility
  const catalogueProducts = products.map(p => ({
    ...p,
    price: p.unitCost,
  }));

  return <CatalogueClient products={catalogueProducts} />;
}