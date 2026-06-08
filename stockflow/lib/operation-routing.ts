// Internal helper for production routing. NOT a server action — lives in lib so
// it can be imported by multiple server actions and called inside transactions.

// Internal: create one OperationLog per applicable RouteOperation for an order.
// Used both by the manual "start routing" action and automatically at order
// creation. Returns the number of operations created, or an error string.
// `db` may be a tenant client or a transaction client.
export async function materializeOperationsForOrder(
  db: any,
  organizationId: string,
  orderId: string,
  routeType: "FML" | "HML",
  selectedOptionalNames?: string[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const route = await db.productionRoute.findFirst({
    where: { routeType, isActive: true },
    include: { operations: { orderBy: { sequence: "asc" } } },
  });
  if (!route || route.operations.length === 0) {
    return { ok: false, error: `No active ${routeType} route configured. Seed routes first.` };
  }

  const existing = await db.operationLog.count({ where: { productionOrderId: orderId } });
  if (existing > 0) {
    return { ok: false, error: "Routing already started for this order" };
  }

  const selected = new Set((selectedOptionalNames ?? []).map((s) => s.trim()));

  await db.operationLog.createMany({
    data: route.operations.map((op: any) => {
      const isSelected = !op.optional || selected.has(op.name);
      return {
        organizationId,
        productionOrderId: orderId,
        routeOperationId: op.id,
        operationName: op.name,
        sequence: op.sequence,
        section: op.section,
        optional: op.optional,
        status: op.optional && !isSelected ? "SKIPPED" : "PENDING",
      };
    }),
  });

  return { ok: true, count: route.operations.length };
}
