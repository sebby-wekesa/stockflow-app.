import { prisma } from "@/lib/prisma"
import CatalogueClient from "./CatalogueClient";

export const dynamic = 'force-dynamic';

export default async function CataloguePage() {
  const products = await prisma.finishedGoods.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      Design: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return <CatalogueClient products={products} />;
}