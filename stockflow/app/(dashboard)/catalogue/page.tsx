import { getTenantPrisma } from "@/lib/tenant-prisma"
import { requireActiveAuth } from "@/lib/auth"
import CatalogueClient from "./CatalogueClient";

export const dynamic = 'force-dynamic';

export default async function CataloguePage() {
  const user = await requireActiveAuth();
  const db = getTenantPrisma(user.organizationId);

  const [finishedGoods, generalProducts, designs] = await Promise.all([
    db.finishedGoods.findMany({
      where: { quantity: { gt: 0 } },
      include: { design: true },
      orderBy: { createdAt: 'desc' }
    }),
    db.product.findMany({
      where: { currentStock: { gt: 0 } },
      select: { id: true, name: true, sku: true, currentStock: true, uom: true, origin: true, unitCost: true, createdAt: true },
    }),
    db.design.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        targetWeight: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
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
     price: p.unitCost ?? null,
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
     price: p.unitCost ?? null,
     createdAt: p.createdAt.toISOString(),
     source: 'product' as const,
   }));

  const madeToOrder = designs.map(d => ({
    id: d.id,
    designId: d.id,
    design: {
      name: d.name,
      code: d.code,
      description: d.description ?? undefined,
    },
    quantity: 999999,
    kgProduced: d.targetWeight ? Number(d.targetWeight) : 0,
    price: null,
    createdAt: d.createdAt.toISOString(),
    source: 'design' as const,
  }));

  const catalogueProducts = [...manufactured, ...madeToOrder, ...others];

  return <CatalogueClient products={catalogueProducts} />;
}
