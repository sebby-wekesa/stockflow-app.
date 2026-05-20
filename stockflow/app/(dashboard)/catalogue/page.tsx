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

  // Transform to plain objects (convert Decimal → number, Date → string)
  const catalogueProducts = products.map(p => ({
    id: p.id,
    design: {
      name: p.design.name,
      code: p.design.code,
      description: p.design.description,
    },
    quantity: p.quantity,
    kgProduced: Number(p.kgProduced),
    price: p.unitCost,
    createdAt: p.createdAt.toISOString(),
  }));

  return <CatalogueClient products={catalogueProducts} />;
}