/**
 * StockFlow Inventory Processor
 * Automates categorization and routing of new stock arrivals.
 */

export type OriginType = 'IMPORTED' | 'LOCAL_PURCHASE' | 'FACTORY_MADE';
export type UOM = 'PCS' | 'KGS';

export interface ProcessedItem {
  itemName: string;
  originType: OriginType;
  unitCost: number;
  landingCost: number;
  quantity: number;
  uom: UOM;
  receivingBranch: string;
  vendor?: string;
}

const LANDING_COST_MULTIPLIER = 1.25;

/**
 * Processes a raw string item list into structured inventory data.
 * Example input: "500 Long Nuts (Imported)"
 */
export function processStockArrivals(items: string[]): ProcessedItem[] {
  return items.map((rawItem) => {
    const item = rawItem.trim();
    
    // 1. Extract Quantity (assuming it's at the start)
    const qtyMatch = item.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kgs|pcs)?\s*(.*)/i);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
    const description = qtyMatch ? qtyMatch[2] : item;

    // 2. Determine Origin Logic
    let originType: OriginType = 'LOCAL_PURCHASE'; // Default
    let branch = 'Nairobi'; // Default
    let uom: UOM = 'PCS';

    const upperDesc = description.toUpperCase();

    if (upperDesc.includes('(IMPORTED)') || upperDesc.includes('(IMP)')) {
      originType = 'IMPORTED';
      branch = 'Nairobi Primary Store';
    } else if (upperDesc.includes('(SRZ)') || upperDesc.includes('(SARAZO)')) {
      originType = 'FACTORY_MADE';
      branch = 'Mombasa Finished Goods';
    } else if (upperDesc.includes('(LOCAL)') || upperDesc.includes('(JUA KALI)')) {
      originType = 'LOCAL_PURCHASE';
      branch = upperDesc.includes('BUNJE') ? 'Bunje Branch' : 'Nairobi';
    }

    // 3. UOM Logic
    if (item.toLowerCase().includes('kg') || item.toLowerCase().includes('steel rod') || item.toLowerCase().includes('wire rod')) {
      uom = 'KGS';
    }

    // 4. Landing Cost Calculation
    const baseCost = 1.0; // Placeholder: In a real scenario, this would come from a price list or input
    const landingCost = originType === 'IMPORTED' ? baseCost * LANDING_COST_MULTIPLIER : baseCost;

    // 5. Clean Item Name (remove the tags)
    const itemName = description
      .replace(/\(IMPORTED\)|\(IMP\)|\(SRZ\)|\(SARAZO\)|\(LOCAL\)|\(JUA KALI\)/gi, '')
      .trim();

    return {
      itemName,
      originType,
      unitCost: baseCost,
      landingCost,
      quantity,
      uom,
      receivingBranch: branch,
      vendor: originType === 'LOCAL_PURCHASE' ? 'Local Vendor' : undefined
    };
  });
}

/**
 * Generates a CSV string for export
 */
export function generateInventoryCSV(processedItems: ProcessedItem[]): string {
  const headers = ['item_name', 'origin_type', 'unit_cost', 'landing_cost', 'stock_level_increment', 'receiving_branch'];
  const rows = processedItems.map(item => [
    `"${item.itemName}"`,
    item.originType,
    item.unitCost.toFixed(2),
    item.landingCost.toFixed(2),
    `"${item.quantity} ${item.uom}"`,
    `"${item.receivingBranch}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
