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
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        currentStock: true,
        piecesSets: true,
        uom: true,
        origin: true,
        unitCost: true,
        createdAt: true,
        Branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const availableBySku = new Map(finishedGoods.map(item => [item.sku, item.quantity]));

   // Manufactured items
   const manufactured = finishedGoods.map(p => ({
     id: p.id,
     name: p.design.name,
     code: p.sku || p.design.code,
     description: p.design.description ?? '',
     quantity: p.quantity,
     reservedQuantity: p.reservedQuantity,
     kgProduced: Number(p.kgProduced),
     piecesSets: p.quantity,
     uom: 'pcs',
     category: 'Finished goods',
     origin: 'FACTORY_MADE',
     price: p.unitCost ?? null,
     createdAt: p.createdAt.toISOString(),
     branchName: null,
     source: 'manufactured' as const,
   }));

   // Other sellable products from the main catalog
   const others = generalProducts.map(p => ({
     id: p.id,
     name: p.name,
     code: p.sku || p.id.slice(0, 8),
     description: '',
     quantity: p.sku && availableBySku.has(p.sku)
       ? availableBySku.get(p.sku)!
       : Math.floor(p.currentStock),
     kgProduced: 0,
     piecesSets: p.piecesSets,
     uom: p.uom,
     category: p.category,
     origin: p.origin,
     price: p.unitCost ?? null,
     createdAt: p.createdAt.toISOString(),
     branchName: p.Branch?.name ?? null,
     source: 'product' as const,
   }));

  const catalogueProducts = [...manufactured, ...others];

  return <CatalogueClient products={catalogueProducts} />;
}
