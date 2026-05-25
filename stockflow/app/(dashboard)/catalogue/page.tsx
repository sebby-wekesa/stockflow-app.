import { getTenantPrisma } from "@/lib/tenant-prisma"
import { requireActiveAuth } from "@/lib/auth"
import CatalogueClient from "./CatalogueClient";

export const dynamic = 'force-dynamic';

export default async function CataloguePage() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const [finishedGoods, generalProducts] = await Promise.all([
    db.finishedGoods.findMany({
      where: { quantity: { gt: 0 } },
      include: { design: true },
      orderBy: { createdAt: 'desc' }
    }),
    db.product.findMany({
      where: { currentStock: { gt: 0 } },
      select: { id: true, name: true, sku: true, currentStock: true, uom: true, origin: true, unitCost: true, createdAt: true },
    })
  ]);

   // Manufactured items
   const manufactured = finishedGoods.map(p => ({
     id: p.id,
     design: {
       name: p.design.name,
       code: p.design.code,
       description: p.design.description ?? undefined,
     },
     quantity: p.quantity,
     kgProduced: Number(p.kgProduced),
     price: p.unitCost,
     createdAt: p.createdAt.toISOString(),
     source: 'manufactured' as const,
   }));

   // Other sellable products from the main catalog
   const others = generalProducts.map(p => ({
     id: p.id,
     design: {
       name: p.name,
       code: p.sku || p.id.slice(0, 8),
       description: undefined,
     },
     quantity: Math.floor(p.currentStock),
     kgProduced: 0,
     price: p.unitCost,
     createdAt: p.createdAt.toISOString(),
     source: 'product' as const,
   }));

  const catalogueProducts = [...manufactured, ...others];

  return <CatalogueClient products={catalogueProducts} />;
}